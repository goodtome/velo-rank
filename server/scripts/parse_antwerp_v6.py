#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""解析 Antwerp Port Epic 2026 PCS 成绩页面 → stage_data.json
正确提取：车手名（只取 <a> 标签内文本，不含 showIfMobile div）、
时间（优先取 <span class="hide">，其次 <font>）
"""

import json
import sys
import re

# 修复 Windows 控制台 UTF-8 编码问题
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from bs4 import BeautifulSoup

HTML_FILE = 'pcs_antwerp_2026.html'
OUTPUT_FILE = 'stage_data.json'

with open(HTML_FILE, 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

# 找主结果表格（class 包含 'results'）
results_table = None
for t in soup.find_all('table'):
    cls = t.get('class', [])
    if 'results' in cls:
        results_table = t
        break

if results_table is None:
    print("ERROR: 找不到结果表格", file=sys.stderr)
    sys.exit(1)

print(f"找到结果表格: class={results_table.get('class')}")

# 解析数据行
tbody = results_table.find('tbody')
if tbody is None:
    rows = [tr for tr in results_table.find_all('tr') if tr.find('td')]
else:
    rows = tbody.find_all('tr')

print(f"共 {len(rows)} 行数据")

results = []
parse_errors = []

for row_idx, row in enumerate(rows):
    tds = row.find_all('td')
    if len(tds) < 10:
        continue

    # ---- td[0] = Rnk ----
    rank_text = tds[0].get_text(strip=True)
    # 去掉末尾的点（如 "1." → "1"）
    rank_text = re.sub(r'\.+$', '', rank_text)
    if not rank_text or rank_text in ('DNF', 'DNS', 'OTL', 'DF', 'NP'):
        continue  # 跳过未完赛
    try:
        rank = int(rank_text)
    except ValueError:
        parse_errors.append(f"  行 {row_idx+1}: 无法解析排名 '{rank_text}'")
        continue

    # ---- td[1] = BIB ----
    bib_text = tds[1].get_text(strip=True)
    bib = int(bib_text) if bib_text.isdigit() else None

    # ---- td[5] = Rider name ----
    rider_td = tds[5]
    a_tag = rider_td.find('a', href=lambda x: x and 'rider/' in x)
    if a_tag is None:
        parse_errors.append(f"  行 {row_idx+1}: 找不到车手链接")
        continue

    # 正确提取车手名：
    # <a ...><span class="uppercase">Hagenes</span> Per Strand</a>
    # 只取 <a> 标签内的文本，不包含后面的 <div class="showIfMobile">
    # 方法：用 a_tag 的 .contents，只取文本节点和 span 的文本
    surname_span = a_tag.find('span', class_='uppercase')
    if surname_span:
        surname = surname_span.get_text(strip=True)
        # 获取 <a> 内、surname_span 之后的文本节点
        firstname = ''
        found_span = False
        for content in a_tag.contents:
            if found_span and isinstance(content, str):
                firstname += content.strip() + ' '
            if hasattr(content, 'name') and content == surname_span:
                found_span = True
        # 也检查 span 后面的其他元素
        next_sib = surname_span.find_next_sibling(string=True)
        if next_sib:
            firstname += next_sib.strip()
        firstname = firstname.strip()
        rider_name = f"{surname} {firstname}".strip()
    else:
        # 备用：直接取 <a> 的文本（可能缺少空格）
        raw_name = a_tag.get_text(strip=True)
        # 在大写字母处拆分（如 "HagenesPer Strand" → "Hagenes Per Strand"）
        # 但更简单的是：直接用正则表达式找 "UPPERCASE lowercase" 模式
        match = re.match(r'^([A-Z]+)(.*)$', raw_name)
        if match:
            rider_name = f"{match.group(1)} {match.group(2)}".strip()
        else:
            rider_name = raw_name

    rider_slug = a_tag['href'].replace('rider/', '').strip()

    # ---- td[6] = Team ----
    team_td = tds[6]
    team_a = team_td.find('a')
    if team_a:
        team_name = team_a.get_text(strip=True)
        team_slug = team_a['href'].replace('team/', '').strip()
    else:
        team_name = team_td.get_text(strip=True)
        team_slug = ''

    # ---- td[9] = Time ----
    time_td = tds[9]
    time_str = None

    # 优先取 <span class="hide">（始终包含正确值）
    hide_span = time_td.find('span', class_='hide')
    if hide_span:
        time_str = hide_span.get_text(strip=True)

    # 备用：取 <font> 标签
    if not time_str:
        font_tag = time_td.find('font')
        if font_tag:
            time_str = font_tag.get_text(strip=True)
            # 去掉可能的重复（如 "4:26:534:26:53"）
            if len(time_str) > 10 and time_str.count(':') > 2:
                mid = len(time_str) // 2
                time_str = time_str[:mid].strip()

    # 备用：直接取单元格文本
    if not time_str:
        time_str = time_td.get_text(strip=True)
        if len(time_str) > 10 and time_str.count(':') > 2:
            mid = len(time_str) // 2
            time_str = time_str[:mid].strip()

    # 清理时间字符串：去掉 ",,"（PCS 的"同时到达"标记）
    if time_str and time_str.startswith(','):
        time_str = time_str.lstrip(',')
    if not time_str or time_str == ',' or time_str == '':
        time_str = None

    # ---- td[7] = UCI points ----
    uci_text = tds[7].get_text(strip=True)
    uci_points = int(uci_text) if uci_text.isdigit() else None

    # ---- td[8] = Pnt points ----
    pnt_text = tds[8].get_text(strip=True)
    pnt_points = int(pnt_text) if pnt_text.isdigit() else None

    result = {
        'rank': rank,
        'bib': bib,
        'rider_name': rider_name,
        'rider_slug': rider_slug,
        'team_name': team_name,
        'team_slug': team_slug,
        'time': time_str,
        'uci_points': uci_points,
        'pnt_points': pnt_points,
    }
    results.append(result)

print(f"\n成功解析 {len(results)} 条成绩")
if parse_errors:
    print(f"解析警告（已跳过）:")
    for e in parse_errors[:10]:
        print(e)

print("\n前5名:")
for r in results[:5]:
    print(f"  {r['rank']}. {r['rider_name']} ({r['team_name']}) - {r['time']}")

print("\n后5名:")
for r in results[-5:]:
    print(f"  {r['rank']}. {r['rider_name']} ({r['team_name']}) - {r['time']}")

# 保存为 JSON
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"\n已保存到 {OUTPUT_FILE}")
