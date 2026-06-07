#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""解析 Antwerp Port Epic 2026 PCS 成绩页面 → stage_data.json"""

import json
import sys
import re
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
    print("ERROR: 找不到结果表格")
    sys.exit(1)

print(f"找到结果表格: class={results_table.get('class')}")

# 解析表头
thead = results_table.find('thead')
headers = []
if thead:
    ths = thead.find_all('th')
    headers = [th.get_text(strip=True) for th in ths]
    print(f"表头 ({len(headers)} 列): {headers}")

# 解析数据行
tbody = results_table.find('tbody')
if tbody is None:
    rows = [tr for tr in results_table.find_all('tr') if tr.find('td')]
else:
    rows = tbody.find_all('tr')

print(f"共 {len(rows)} 行数据")

results = []
for row_idx, row in enumerate(rows):
    tds = row.find_all('td')
    if len(tds) < 10:
        print(f"  跳过行 {row_idx}: 只有 {len(tds)} 列")
        continue

    # td[0] = Rnk
    rank_text = tds[0].get_text(strip=True)
    if not rank_text or rank_text == '' or rank_text == 'DNF' or rank_text == 'DNS' or rank_text == 'OTL':
        rank = None
    else:
        # 去掉可能的后缀（如 '1.'）
        rank_text = re.sub(r'\..*$', '', rank_text)
        try:
            rank = int(rank_text)
        except ValueError:
            print(f"  行 {row_idx}: 无法解析排名 '{rank_text}'")
            rank = None

    if rank is None:
        continue  # 跳过 DNF/DNS 等

    # td[1] = BIB
    bib_text = tds[1].get_text(strip=True)
    bib = int(bib_text) if bib_text.isdigit() else None

    # td[5] = Rider name
    rider_td = tds[5]
    a_tag = rider_td.find('a', href=lambda x: x and 'rider/' in x)
    if a_tag is None:
        print(f"  行 {row_idx}: 找不到车手链接")
        continue

    # 正确提取车手名字：
    # <a ...><span class="uppercase">Hagenes</span> Per Strand</a>
    surname_span = a_tag.find('span', class_='uppercase')
    if surname_span:
        surname = surname_span.get_text(strip=True)
        # 获取 <a> 标签内、span 之后的文本（即 firstname）
        firstname = ''
        for content in a_tag.contents:
            if isinstance(content, str) and content.strip():
                firstname += content.strip() + ' '
        firstname = firstname.strip()
        rider_name = f"{surname} {firstname}".strip()
    else:
        # 备用方案
        rider_name = a_tag.get_text(strip=True)
        # 尝试在大写字母处拆分
        match = re.match(r'^([A-Z]+)(.*)$', rider_name)
        if match:
            rider_name = f"{match.group(1)} {match.group(2)}".strip()

    rider_slug = a_tag['href'].replace('rider/', '').strip()

    # td[6] = Team
    team_td = tds[6]
    team_a = team_td.find('a')
    if team_a:
        team_name = team_a.get_text(strip=True)
        team_slug = team_a['href'].replace('team/', '').strip()
    else:
        team_name = team_td.get_text(strip=True)
        team_slug = ''

    # td[9] = Time
    time_td = tds[9]
    # PCS 时间格式：<font>4:26:53</font><span class="hide">4:26:53</span>
    # 只需要 <font> 内的文本
    time_font = time_td.find('font')
    if time_font:
        time_str = time_font.get_text(strip=True)
    else:
        time_str = time_td.get_text(strip=True)
        # 如果时间重复了（如 "4:26:534:26:53"），取前半部分
        if len(time_str) > 10 and time_str.count(':') > 2:
            # 找中间重复的位置
            mid = len(time_str) // 2
            time_str = time_str[:mid].strip()

    # td[7] = UCI points
    uci_text = tds[7].get_text(strip=True)
    uci_points = int(uci_text) if uci_text.isdigit() else None

    # td[8] = Pnt points
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
print("\n前3名:")
for r in results[:3]:
    print(f"  {r['rank']}. {r['rider_name']} ({r['team_name']}) - {r['time']}")

print("\n后3名:")
for r in results[-3:]:
    print(f"  {r['rank']}. {r['rider_name']} ({r['team_name']}) - {r['time']}")

# 保存为 JSON
with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"\n已保存到 {OUTPUT_FILE}")
