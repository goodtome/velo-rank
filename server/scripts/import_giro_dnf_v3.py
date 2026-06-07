#!/usr/bin/env python3
"""
环意 Giro d'Italia 2026 - 补充 DNF/DNS 数据（只更新 time_gap）
逻辑：
  1. 从 PCS 下载各赛段 HTML
  2. 解析所有车手：time 列有值=完赛，为空=DNF
  3. 根据 rider_slug 匹配数据库，更新 time_gap 字段
用法: python import_giro_dnf_v3.py
"""
import sys, os, subprocess, pymysql, uuid
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

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
    url = f"{PCS_BASE}{stage_num}/result/result"
    fname = f"giro_s{stage_num}.html"
    fpath = os.path.join(HTML_DIR, fname)
    if os.path.exists(fpath) and os.path.getsize(fpath) > 10000:
        print(f"  [S{stage_num}] 已存在 ({os.path.getsize(fpath)//1024}KB)，跳过")
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
    a = td.find('a', href=lambda x: x and 'rider/' in x)
    if not a:
        return None, None
    slug = a['href'].replace('rider/', '').strip()
    span = a.find('span', class_='uppercase')
    if span:
        surname = span.get_text(strip=True)
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
    sp = td.find('span', class_='hide')
    if sp:
        return sp.get_text(strip=True)
    font = td.find('font')
    if font:
        return font.get_text(strip=True)
    txt = td.get_text(strip=True)
    return txt if txt else None

def parse_stage_html(html_file, stage_num):
    from bs4 import BeautifulSoup
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    tbl = None
    for t in soup.find_all('table'):
        cls = t.get('class', [])
        if 'results' in cls:
            tbl = t
            break
    if not tbl:
        print(f"  [S{stage_num}] 找不到 results 表格")
        return []
    tbody = tbl.find('tbody')
    if not tbody:
        print(f"  [S{stage_num}] 表格无 tbody")
        return []
    rows = tbody.find_all('tr')
    print(f"  [S{stage_num}] 表格共 {len(rows)} 行")
    results = []
    for row in rows:
        tds = row.find_all('td')
        if not tds or len(tds) < 3:
            continue
        # 找车手名所在的 td（包含 rider/ 链接）
        rider_td = None
        time_td = None
        ncols = len(tds)
        # 根据列数判断位置
        if ncols >= 13:
            # 13列：Rnk|GC|Timelag|BIB|H2H|Specialty|Age|Rider|Team|UCI|Pnt|Time
            rider_td = tds[7]
            time_td = tds[11] if ncols > 11 else tds[-1]
        elif ncols >= 10:
            # 10列：Rnk|GC|Timelag|BIB|H2H|Rider|Team|UCI|Pnt|Time
            rider_td = tds[5]
            time_td = tds[9]
        else:
            for i, td in enumerate(tds):
                if td.find('a', href=lambda x: x and 'rider/' in x):
                    rider_td = td
                    time_td = tds[-1]
                    break
        if not rider_td:
            continue
        full_name, rider_slug = parse_rider_name_from_td(rider_td)
        if not rider_slug:
            continue
        # 判断是否是 DNF/DNS（time 列为空）
        time_val = parse_time_from_td(time_td) if time_td else None
        is_dnf = not time_val or time_val.strip() == ''
        results.append({
            'rider_slug': rider_slug,
            'time_gap': 'DNF' if is_dnf else time_val,
            'is_dnf': is_dnf,
        })
    dnf_count = sum(1 for r in results if r['is_dnf'])
    print(f"  [S{stage_num}] 解析完成：完赛 {len(results)-dnf_count} 条，DNF/DNS {dnf_count} 条")
    return results

# ============================================================
# 3. 更新数据库（只更新 time_gap）
# ============================================================
def update_stage_results(stage_id, results):
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        # 验证赛段存在
        cur.execute('SELECT id FROM stages WHERE id = %s', (stage_id,))
        if not cur.fetchone():
            print(f"  [DB] 赛段不存在: {stage_id[:8]}...")
            return False
        updated = 0
        dnf_updated = 0
        not_found = 0
        for rec in results:
            # 根据 rider_slug 找 rider_id
            cur.execute('SELECT id FROM riders WHERE rider_slug = %s', (rec['rider_slug'],))
            row = cur.fetchone()
            if not row:
                not_found += 1
                continue
            rider_id = row[0]
            # 更新 time_gap
            cur.execute(
                'UPDATE stage_results SET time_gap = %s WHERE stage_id = %s AND rider_id = %s',
                (rec['time_gap'], stage_id, rider_id)
            )
            if cur.rowcount > 0:
                updated += 1
                if rec['is_dnf']:
                    dnf_updated += 1
        conn.commit()
        print(f"  [DB] 更新完成！共 {updated} 条（DNF/DNS: {dnf_updated} 条，未找到车手: {not_found} 条）")
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
    conn = pymysql.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute(
        'SELECT stage_number, id FROM stages WHERE race_id = %s ORDER BY stage_number',
        ('e597183f-8ea4-4fb0-a469-661c57c5a958',)
    )
    stages = cur.fetchall()
    cur.close()
    conn.close()
    print(f'数据库中共有 {len(stages)} 个赛段\n')
    for stage_num, stage_id in stages:
        print(f'--- Stage {stage_num} ({stage_id[:8]}...) ---')
        # 1. 下载 HTML
        html_file = download_stage_html(stage_num)
        if not html_file:
            print(f"  [Skip] 下载失败\n")
            continue
        # 2. 解析 HTML
        results = parse_stage_html(html_file, stage_num)
        if not results:
            print(f"  [Skip] 没有解析到数据\n")
            continue
        # 3. 更新数据库
        update_stage_results(stage_id, results)
        print()

if __name__ == '__main__':
    main()
