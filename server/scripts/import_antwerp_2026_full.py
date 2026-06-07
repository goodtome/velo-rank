#!/usr/bin/env python3
"""
Antwerp Port Epic 2026 - 完整入库脚本（完赛车手 + DNF + DNS）
用法: python import_antwerp_2026_full.py
"""
import sys
import json
import pymysql
import uuid
from bs4 import BeautifulSoup

# 修复 Windows 控制台编码
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_CONFIG = dict(
    host='127.0.0.1', port=13306,
    user='root', password='mysql123456',
    database='jersey_db', charset='utf8mb4'
)

HTML_FILE = 'pcs_antwerp_2026.html'
STAGE_ID = 'f0925c69-7e8a-4ec6-a694-a166d8162379'

# DNF/DNS 等未完赛状态
DNF_STATUSES = {'DNF', 'DNS', 'OTL', 'DF'}


def parse_rider_name(td):
    """从 td[5] 正确解析车手名：surname (uppercase) + firstname"""
    a_tag = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a_tag:
        return None, None, None
    rider_slug = a_tag['href'].replace('rider/', '').strip()
    # 方法：取 span.uppercase 的文字作为 surname，后面的文本节点作为 firstname
    span = a_tag.find('span', class_='uppercase')
    if span:
        surname = span.get_text(strip=True)
        # firstname = a_tag 中 span 后面的文本节点
        firstname_parts = []
        for content in a_tag.contents:
            if hasattr(content, 'name'):
                continue  # 跳过 Tag
            txt = str(content).strip()
            if txt:
                firstname_parts.append(txt)
        firstname = ' '.join(firstname_parts).strip()
        full_name = f"{surname} {firstname}".strip()
    else:
        full_name = a_tag.get_text(strip=True)
        surname = ''
        firstname = ''
    return full_name, surname, rider_slug


def parse_time_gap(td):
    """从时间列提取时间差，优先取 <span class='hide'>"""
    hide_span = td.find('span', class_='hide')
    if hide_span:
        return hide_span.get_text(strip=True)
    font = td.find('font')
    if font:
        return font.get_text(strip=True)
    return td.get_text(strip=True) or None


def parse_all_rows(html_file):
    """解析所有行：完赛 + DNF + DNS"""
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    tbl = soup.find('table', class_='results')
    if not tbl:
        raise ValueError('找不到 results 表格')
    tbody = tbl.find('tbody')
    if not tbody:
        raise ValueError('表格没有 tbody')

    rows = tbody.find_all('tr')
    print(f"表格共 {len(rows)} 行")

    results = []
    dnf_results = []

    for i, row in enumerate(rows):
        tds = row.find_all('td')
        if not tds or len(tds) < 10:
            continue

        rank_text = tds[0].get_text(strip=True)

        # 检查是否是 DNF/DNS 等未完赛
        if rank_text in DNF_STATUSES:
            status = rank_text  # 'DNF' or 'DNS'
            name, surname, slug = parse_rider_name(tds[5])
            if not name:
                print(f"  [{status}] 跳过第 {i+1} 行（无法解析车手名）")
                continue

            team_a = tds[6].find('a', href=lambda x: x and 'team/' in x)
            team_name = team_a.get_text(strip=True) if team_a else tds[6].get_text(strip=True)
            team_slug = team_a['href'].replace('team/', '').strip() if team_a else None

            gc_rank = tds[1].get_text(strip=True)
            bib = tds[4].get_text(strip=True)

            dnf_results.append({
                'status': status,       # 'DNF' or 'DNS'
                'rank_pos': None,        # 稍后分配
                'rider_name': name,
                'rider_slug': slug,
                'team_name': team_name,
                'team_slug': team_slug,
                'gc_rank': gc_rank,
                'bib': bib,
                'time_gap': status,   # 存 'DNF' 或 'DNS'
                'is_dnf': True,
            })
            continue

        # 正常完赛行
        try:
            rank_pos = int(rank_text)
        except ValueError:
            print(f"  跳过第 {i+1} 行（rank={rank_text}）")
            continue

        name, surname, slug = parse_rider_name(tds[5])
        if not name:
            print(f"  跳过第 {i+1} 行（无法解析车手名）")
            continue

        team_a = tds[6].find('a', href=lambda x: x and 'team/' in x)
        team_name = team_a.get_text(strip=True) if team_a else tds[6].get_text(strip=True)
        team_slug = team_a['href'].replace('team/', '').strip() if team_a else None

        time_gap = parse_time_gap(tds[9])

        points_text = tds[8].get_text(strip=True)
        points = int(points_text) if points_text.isdigit() else 0

        results.append({
            'rank_pos': rank_pos,
            'rider_name': name,
            'rider_slug': slug,
            'team_name': team_name,
            'team_slug': team_slug,
            'time_gap': time_gap,
            'points': points,
            'is_dnf': False,
        })

    # 为 DNF/DNS 分配 rank_pos（从 max(finisher_rank)+1 开始）
    max_rank = max(r['rank_pos'] for r in results) if results else 0
    for j, dnf in enumerate(dnf_results):
        dnf['rank_pos'] = max_rank + j + 1

    print(f"完赛: {len(results)} 条, 未完赛: {len(dnf_results)} 条")
    dnf_counts = {}
    for r in dnf_results:
        s = r['status']
        dnf_counts[s] = dnf_counts.get(s, 0) + 1
    for s, c in dnf_counts.items():
        print(f"  {s}: {c} 条")
    return results, dnf_results


def get_or_create_rider(cur, rider_name, rider_slug):
    """查找或创建车手，返回 rider_id"""
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
    """查找或创建车队，返回 team_id"""
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


def import_results(results, dnf_results):
    """将完赛 + DNF/DNS 数据入库"""
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # 检查赛段是否存在
        cur.execute('SELECT id FROM stages WHERE id = %s', (STAGE_ID,))
        if not cur.fetchone():
            print(f"错误：找不到赛段 {STAGE_ID}")
            return

        # 清除该赛段现有数据（以便重新导入）
        cur.execute('DELETE FROM stage_results WHERE stage_id = %s', (STAGE_ID,))
        deleted = cur.rowcount
        print(f"已清除赛段现有数据: {deleted} 条")

        all_records = results + dnf_results
        inserted = 0

        for rec in all_records:
            rider_id = get_or_create_rider(cur, rec['rider_name'], rec.get('rider_slug'))
            team_id = get_or_create_team(cur, rec['team_name'], rec.get('team_slug'))

            rec_id = str(uuid.uuid4())
            time_gap = rec['time_gap'] if rec.get('is_dnf') else rec.get('time_gap', '')

            sql = '''INSERT INTO stage_results
                      (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap)
                      VALUES (%s, %s, %s, %s, %s, %s, %s)'''
            cur.execute(sql, (
                rec_id, STAGE_ID,
                rec['rank_pos'],
                rider_id, team_id, 'XX', time_gap
            ))
            inserted += 1

        conn.commit()
        print(f"\n[OK] 入库完成！共 {inserted} 条记录")
        print(f"  完赛: {len(results)} 条")
        print(f"  未完赛: {len(dnf_results)} 条")
        # 统计各状态
        from collections import Counter
        status_counts = Counter(r['status'] for r in dnf_results)
        for s, c in status_counts.items():
            print(f"    {s}: {c} 条")

    except Exception as e:
        conn.rollback()
        print(f"[ERR] 错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    print('=== Antwerp Port Epic 2026 完整入库 ===\n')
    results, dnf_results = parse_all_rows(HTML_FILE)
    import_results(results, dnf_results)
