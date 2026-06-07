#!/usr/bin/env python3
"""
环意 Giro d'Italia 2026 - 补充 DNF/DNS 数据
逻辑：
  1. 从 PCS 下载各赛段 HTML（curl --compressed 绕过 Cloudflare）
  2. 解析所有车手：完赛（time 列有值）+ DNF/DNS（time 列为空或含 DNF 标记）
  3. 更新 stage_results 表：根据 rider_slug 匹配，更新 time_gap 字段
用法: python import_giro_dnf_v2.py
"""
import sys, os, subprocess, uuid, json, time
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import pymysql
from bs4 import BeautifulSoup

DB_CONFIG = dict(
    host='127.0.0.1', port=13306,
    user='root', password='mysql123456',
    database='jersey_db', charset='utf8mb4'
)
PCS_BASE = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-'
HTML_DIR = os.path.join(os.path.dirname(__file__), 'pcs_html')
os.makedirs(HTML_DIR, exist_ok=True)

# ============================================================
# 1. 下载 HTML
# ============================================================
def download_stage_html(stage_num):
    """下载赛段 HTML 到本地，返回文件路径"""
    url = f"{PCS_BASE}{stage_num}/result/result"
    fname = f"giro_s{stage_num}.html"
    fpath = os.path.join(HTML_DIR, fname)

    if os.path.exists(fpath) and os.path.getsize(fpath) > 10000:
        print(f"  [S{stage_num}] 已存在 ({os.path.getsize(fpath)//1024}KB)，跳过下载")
        return fpath

    print(f"  [S{stage_num}] 下载中... {url}")
    cmd = [
        'curl', '-s', '--compressed', '-L',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        url, '-o', fpath
    ]
    ret = subprocess.run(cmd, capture_output=True, text=True).returncode
    size = os.path.getsize(fpath) if os.path.exists(fpath) else 0
    if ret == 0 and size > 10000:
        print(f"  [S{stage_num}] 下载成功 ({size//1024}KB)")
        return fpath
    else:
        print(f"  [S{stage_num}] 下载失败 (ret={ret}, size={size})")
        if os.path.exists(fpath):
            os.remove(fpath)
        return None

# ============================================================
# 2. 解析 HTML
# ============================================================
def parse_rider_name_from_td(td):
    """从车手名列 td 中解析：(full_name, rider_slug)"""
    a = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a:
        return None, None
    slug = a['href'].replace('rider/', '').strip()
    # surname = span.uppercase 的文本
    span = a.find('span', class_='uppercase')
    if span:
        surname = span.get_text(strip=True)
        # firstname = a 标签中 span 后面的文本节点
        first_parts = []
        for c in a.contents:
            if hasattr(c, 'name'):
                continue
            t = str(c).strip()
            if t:
                first_parts.append(t)
        firstname = ' '.join(first_parts).strip()
        full = f"{surname} {firstname}".strip()
    else:
        full = a.get_text(strip=True)
    return full, slug

def parse_time_from_td(td):
    """从时间列 td 中提取时间字符串，优先 <span class='hide'>"""
    sp = td.find('span', class_='hide')
    if sp:
        return sp.get_text(strip=True)
    font = td.find('font')
    if font:
        return font.get_text(strip=True)
    txt = td.get_text(strip=True)
    return txt if txt else None

def parse_stage_html(html_file, stage_num):
    """
    解析赛段 HTML，返回：
      finishers: [{'rider_slug', 'time_gap'}, ...]
      dnf_list:  [{'rider_slug', 'status'}, ...]   status='DNF'/'DNS'
    """
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')

    # 找主成绩表格（class 包含 'results'）
    tbl = None
    for t in soup.find_all('table'):
        cls = t.get('class', [])
        if 'results' in cls:
            tbl = t
            break
    if not tbl:
        print(f"  [S{stage_num}] 找不到 results 表格")
        return [], []

    tbody = tbl.find('tbody')
    if not tbody:
        print(f"  [S{stage_num}] 表格无 tbody")
        return [], []

    rows = tbody.find_all('tr')
    print(f"  [S{stage_num}] 表格共 {len(rows)} 行")

    finishers = []
    dnf_list = []

    for row in rows:
        tds = row.find_all('td')
        if not tds or len(tds) < 3:
            continue

        # 判断表格列数
        ncols = len(tds)

        # 找车手名所在的 td（包含 <a href="rider/..."> 的 td）
        rider_td = None
        time_td = None

        if ncols >= 13:
            # 13 列：Rnk|GC|Timelag|BIB|H2H|Specialty|Age|Rider|Team|UCI|Pnt|Time
            rider_td = tds[7]
            time_td = tds[11] if ncols > 11 else tds[-1]
        elif ncols >= 10:
            # 10 列：Rnk|GC|Timelag|BIB|Specialty|Rider|Team|UCI|Pnt|Time
            rider_td = tds[5]
            time_td = tds[9]
        else:
            # 未知格式：找包含 rider/ 链接的 td
            for i, td in enumerate(tds):
                if td.find('a', href=lambda x: x and 'rider/' in x):
                    rider_td = td
                    # 假设时间列是最后一个 td
                    time_td = tds[-1]
                    break

        if not rider_td:
            continue

        # 解析车手名和 slug
        full_name, rider_slug = parse_rider_name_from_td(rider_td)
        if not rider_slug:
            continue

        # 检查是否是 DNF/DNS 行（rank 列 = 'DNF' 或 'DNS'）
        rank_text = tds[0].get_text(strip=True)
        if rank_text in ('DNF', 'DNS', 'OTL', 'DF'):
            dnf_list.append({
                'rider_slug': rider_slug,
                'status': rank_text
            })
            continue

        # 正常完赛行：提取时间
        if time_td:
            time_gap = parse_time_from_td(time_td)
            finishers.append({
                'rider_slug': rider_slug,
                'time_gap': time_gap   # 可能是 None（DNF 车手 time 列为空）
            })

    print(f"  [S{stage_num}] 完赛: {len(finishers)} 条, DNF/DNS: {len(dnf_list)} 条")
    return finishers, dnf_list

# ============================================================
# 3. 更新数据库
# ============================================================
def update_stage_results(stage_id, finishers, dnf_list):
    """
    更新 stage_results 表：
      - 根据 rider_slug 找到 rider_id
      - 更新 time_gap 字段
    """
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()

    try:
        # 验证赛段存在
        cur.execute('SELECT id FROM stages WHERE id = %s', (stage_id,))
        if not cur.fetchone():
            print(f"  [DB] 赛段不存在: {stage_id[:8]}...")
            return False

        updated_finishers = 0
        updated_dnf = 0

        # 更新完赛车手
        for rec in finishers:
            # 根据 rider_slug 找 rider_id
            cur.execute('SELECT id FROM riders WHERE rider_slug = %s', (rec['rider_slug'],))
            row = cur.fetchone()
            if not row:
                print(f"  [DB] 车手不存在: slug={rec['rider_slug']}")
                continue
            rider_id = row[0]

            # 更新 time_gap
            time_gap = rec.get('time_gap') or ''
            cur.execute(
                'UPDATE stage_results SET time_gap = %s '
                'WHERE stage_id = %s AND rider_id = %s',
                (time_gap, stage_id, rider_id)
            )
            if cur.rowcount > 0:
                updated_finishers += 1

        # 更新 DNF/DNS 车手
        for rec in dnf_list:
            cur.execute('SELECT id FROM riders WHERE rider_slug = %s', (rec['rider_slug'],))
            row = cur.fetchone()
            if not row:
                print(f"  [DB] 车手不存在: slug={rec['rider_slug']}")
                continue
            rider_id = row[0]

            status = rec.get('status', 'DNF')
            cur.execute(
                'UPDATE stage_results SET time_gap = %s '
                'WHERE stage_id = %s AND rider_id = %s',
                (status, stage_id, rider_id)
            )
            if cur.rowcount > 0:
                updated_dnf += 1

        conn.commit()
        print(f"  [DB] 更新完成！完赛: {updated_finishers} 条, DNF/DNS: {updated_dnf} 条")
        return True

    except Exception as e:
        conn.rollback()
        print(f"  [DB] 错误: {e}")
        import traceback; traceback.print_exc()
        return False
    finally:
        cur.close()
        conn.close()

# ============================================================
# 主函数
# ============================================================
def main():
    print('=== 环意 Giro d\'Italia 2026 - DNF 数据补充 ===\n')

    # 从数据库获取所有赛段
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(
        'SELECT stage_number, id FROM stages '
        'WHERE race_id = %s '
        'ORDER BY stage_number',
        ('e597183f-8ea4-4fb0-a469-661c57c5a958',)
    )
    stages = cur.fetchall()
    cur.close()
    conn.close()

    print(f'数据库中共有 {len(stages)} 个赛段\n')

    # 先只处理前 3 个赛段作为验证
    for stage_num, stage_id in stages[:3]:
        print(f'--- Stage {stage_num} ({stage_id[:8]}...) ---')

        # 1. 下载 HTML
        html_file = download_stage_html(stage_num)
        if not html_file:
            print(f"  [Skip] 下载失败\n")
            continue

        # 2. 解析 HTML
        finishers, dnf_list = parse_stage_html(html_file, stage_num)
        if not finishers and not dnf_list:
            print(f"  [Skip] 没有解析到数据\n")
            continue

        # 3. 更新数据库
        ok = update_stage_results(stage_id, finishers, dnf_list)
        print()
        if not ok:
            print(f"  [Skip] 数据库更新失败\n")

if __name__ == '__main__':
    main()
