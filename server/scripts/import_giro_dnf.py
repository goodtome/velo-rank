#!/usr/bin/env python3
"""
环意 Giro d'Italia 2026 - 批量补充 DNF/DNS 数据
方案：
1. 从 PCS 下载各赛段 HTML（curl --compressed 绕过 Cloudflare）
2. 解析所有车手（完赛 + DNF/DNS）
3. 更新 stage_results 表（先删除旧数据，再重新插入）
"""
import sys
import os
import json
import pymysql
import uuid
from bs4 import BeautifulSoup
from urllib.parse import urljoin

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_CONFIG = dict(
    host='127.0.0.1', port=13306,
    user='root', password='mysql123456',
    database='jersey_db', charset='utf8mb4'
)

PCS_BASE = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-'

# 环意 2026 共 21 个赛段
STAGE_NUMS = list(range(1, 22))


def download_stage_html(stage_num, output_dir='pcs_html'):
    """下载赛段 HTML 到本地"""
    url = f"{PCS_BASE}{stage_num}/result/result"
    output_file = os.path.join(output_dir, f'giro_s{stage_num}.html')
    os.makedirs(output_dir, exist_ok=True)

    if os.path.exists(output_file):
        print(f"  [S{stage_num}] 已存在，跳过下载")
        return output_file

    import subprocess
    cmd = [
        'curl', '-s', '--compressed',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '-L',
        url, '-o', output_file
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0 and os.path.exists(output_file):
        size = os.path.getsize(output_file)
        print(f"  [S{stage_num}] 下载成功 ({size//1024}KB)")
        return output_file
    else:
        print(f"  [S{stage_num}] 下载失败: {result.stderr[:100]}")
        return None


def parse_time_gap(td):
    """从时间列提取时间差，优先取 <span class='hide'>"""
    hide_span = td.find('span', class_='hide')
    if hide_span:
        return hide_span.get_text(strip=True)
    font = td.find('font')
    if font:
        return font.get_text(strip=True)
    return td.get_text(strip=True) or None


def parse_rider_name(td):
    """从 td[7] 或 td[5] 正确解析车手名"""
    a_tag = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a_tag:
        return None, None
    rider_slug = a_tag['href'].replace('rider/', '').strip()
    span = a_tag.find('span', class_='uppercase')
    if span:
        surname = span.get_text(strip=True)
        firstname_parts = []
        for content in a_tag.contents:
            if hasattr(content, 'name'):
                continue
            txt = str(content).strip()
            if txt:
                firstname_parts.append(txt)
        firstname = ' '.join(firstname_parts).strip()
        full_name = f"{surname} {firstname}".strip()
    else:
        full_name = a_tag.get_text(strip=True)
        surname = ''
    return full_name, rider_slug


def parse_stage_html(html_file, stage_num):
    """解析赛段 HTML，返回 (finishers, dnf_list)"""
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # 找主表格（通常是第一个 results 表格）
    tbl = soup.find('table', class_='results')
    if not tbl:
        # 尝试找任何包含 rider/ 链接的表格
        tables = soup.find_all('table')
        for t in tables:
            if t.find('a', href=lambda x: x and 'rider/' in x):
                tbl = t
                break
    if not tbl:
        print(f"  [S{stage_num}] 找不到成绩表格")
        return [], []

    tbody = tbl.find('tbody')
    if not tbody:
        print(f"  [S{stage_num}] 表格没有 tbody")
        return [], []

    rows = tbody.find_all('tr')
    print(f"  [S{stage_num}] 表格共 {len(rows)} 行")

    finishers = []
    dnf_list = []

    for i, row in enumerate(rows):
        tds = row.find_all('td')
        if not tds:
            continue

        # 判断表格列数
        num_cols = len(tds)

        # 找 rank 列（通常是 td[0]）
        rank_text = tds[0].get_text(strip=True)

        # 检查是否是 DNF/DNS 行
        row_text = row.get_text()
        is_dnf = 'DNF' in row_text or 'DNS' in row_text or 'OTL' in row_text

        if is_dnf:
            # DNF/DNS 行：td[0] = 'DNF' 或 'DNS'
            status = 'DNF' if 'DNF' in row_text else ('DNS' if 'DNS' in row_text else 'DNF')
            # 车手名在不同列位置
            rider_td = tds[5] if num_cols >= 10 else tds[7]
            name, slug = parse_rider_name(rider_td)
            if name:
                dnf_list.append({
                    'rank_pos': None,  # 稍后分配
                    'rider_name': name,
                    'rider_slug': slug,
                    'status': status,
                })
            continue

        # 正常完赛行
        try:
            rank_pos = int(rank_text)
        except ValueError:
            continue

        # 根据列数确定各列位置
        if num_cols >= 13:
            # 13 列：Rnk|GC|Timelag|BIB|H2H|Specialty|Age|Rider|Team|UCI|Pnt|Time
            rider_td = tds[7]
            time_td = tds[11] if num_cols > 11 else tds[-1]
        elif num_cols >= 10:
            # 10 列：Rnk|GC|Timelag|BIB|Specialty|Rider|Team|UCI|Pnt|Time
            rider_td = tds[5]
            time_td = tds[9]
        else:
            rider_td = tds[5] if len(tds) > 5 else tds[-2]
            time_td = tds[-1]

        name, slug = parse_rider_name(rider_td)
        if not name:
            continue

        time_gap = parse_time_gap(time_td)
        finishers.append({
            'rank_pos': rank_pos,
            'rider_name': name,
            'rider_slug': slug,
            'time_gap': time_gap,
        })

    # 为 DNF 分配 rank_pos
    max_rank = max((r['rank_pos'] for r in finishers), default=0)
    for j, dnf in enumerate(dnf_list):
        dnf['rank_pos'] = max_rank + j + 1

    print(f"  [S{stage_num}] 完赛: {len(finishers)}, DNF/DNS: {len(dnf_list)}")
    return finishers, dnf_list


def get_or_create_rider(cur, rider_name, rider_slug):
    """查找或创建车手"""
    if rider_slug:
        cur.execute('SELECT id FROM riders WHERE rider_slug = %s', (rider_slug,))
    else:
        cur.execute('SELECT id FROM riders WHERE rider_name = %s', (rider_name,))
    row = cur.fetchone()
    if row:
        return row[0]

    rider_id = str(uuid.uuid4())
    sql = '''INSERT INTO riders (id, rider_name, rider_slug, nationality, is_retired)
              VALUES (%s, %s, %s, %s, %s)'''
    cur.execute(sql, (rider_id, rider_name, rider_slug, 'XX', 0))
    return rider_id


def get_or_create_team(cur, team_name, team_slug):
    """查找或创建车队"""
    if team_slug:
        cur.execute('SELECT id FROM teams WHERE team_slug = %s', (team_slug,))
    else:
        cur.execute('SELECT id FROM teams WHERE team_name = %s', (team_name,))
    row = cur.fetchone()
    if row:
        return row[0]

    team_id = str(uuid.uuid4())
    sql = '''INSERT INTO teams (id, team_name, team_slug)
              VALUES (%s, %s, %s)'''
    cur.execute(sql, (team_id, team_name, team_slug))
    return team_id


def import_stage_results(stage_id, finishers, dnf_list):
    """将完赛 + DNF/DNS 数据入库"""
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # 清除该赛段现有数据
        cur.execute('DELETE FROM stage_results WHERE stage_id = %s', (stage_id,))
        deleted = cur.rowcount
        print(f"  [DB] 清除现有数据: {deleted} 条")

        all_records = finishers + dnf_list

        for rec in all_records:
            rider_id = get_or_create_rider(cur, rec['rider_name'], rec.get('rider_slug'))

            # 从 rider_name 推断 team_name（需要从 HTML 重新解析）
            # 暂时用默认值
            team_id = get_or_create_team(cur, 'Unknown', None)

            time_gap = rec.get('time_gap') or rec.get('status') or ''

            rec_id = str(uuid.uuid4())
            sql = '''INSERT INTO stage_results
                      (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap)
                      VALUES (%s, %s, %s, %s, %s, %s, %s)'''
            cur.execute(sql, (
                rec_id, stage_id,
                rec['rank_pos'],
                rider_id, team_id, 'XX', time_gap
            ))

        conn.commit()
        print(f"  [DB] 入库完成！共 {len(all_records)} 条")
        return True

    except Exception as e:
        conn.rollback()
        print(f"  [DB] 错误: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cur.close()
        conn.close()


def main():
    print('=== 环意 Giro d\'Italia 2026 - DNF 数据补充 ===\n')

    # 连接数据库，获取所有赛段
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()

    cur.execute(
        'SELECT id, stage_number FROM stages '
        'WHERE race_id = %s '
        'ORDER BY stage_number',
        ('e597183f-8ea4-4fb0-a469-661c57c5a958',)
    )
    stages = cur.fetchall()
    print(f'数据库中共有 {len(stages)} 个赛段\n')

    cur.close()
    conn.close()

    # 先只处理前 3 个赛段作为验证
    for stage_num, stage_id in stages[:3]:
        print(f'--- Stage {stage_num} ---')

        # 下载 HTML
        html_file = download_stage_html(stage_num)
        if not html_file:
            continue

        # 解析
        finishers, dnf_list = parse_stage_html(html_file, stage_num)
        if not finishers and not dnf_list:
            print(f"  [Skip] 没有解析到数据")
            continue

        # 入库
        import_stage_results(stage_id, finishers, dnf_list)
        print()


if __name__ == '__main__':
    main()
