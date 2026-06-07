#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查 Antwerp Port Epic 2026 HTML 表格结构"""

import sys
sys.path.insert(0, r'D:\codes\velo-rank\server\scripts')

from bs4 import BeautifulSoup

with open('pcs_antwerp_2026.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
tables = soup.find_all('table')
print(f'找到 {len(tables)} 个表格')

for i, t in enumerate(tables):
    cls = t.get('class', [])
    id_attr = t.get('id', '')
    print(f'  表格{i}: class={cls} id={id_attr}')

# 找主结果表格
results_table = None
for t in tables:
    cls = t.get('class', [])
    if cls and ('tablesorter' in cls or 'result' in ' '.join(cls)):
        results_table = t
        break

if results_table is None and len(tables) > 0:
    # 尝试找包含 "ridername" 列的表格
    for t in tables:
        first_row = t.find('tr')
        if first_row and 'ridername' in str(first_row):
            results_table = t
            break

if results_table is None and len(tables) > 0:
    results_table = tables[0]

print(f'\n使用表格，class={results_table.get("class")}')

# 检查表头
thead = results_table.find('thead')
if thead:
    ths = thead.find_all('th')
    print(f'表头 {len(ths)} 列:')
    for i, th in enumerate(ths):
        print(f'  th[{i}]: {repr(th.get_text(strip=True))}')

# 获取第一行数据
tbody = results_table.find('tbody')
if tbody is None:
    print('没有 tbody，尝试直接找 tr')
    rows = results_table.find_all('tr')
else:
    rows = tbody.find_all('tr')

print(f'\n总共 {len(rows)} 行数据')

if len(rows) > 0:
    first_row = rows[0]
    tds = first_row.find_all('td')
    print(f'第一行有 {len(tds)} 列:')
    for i, td in enumerate(tds):
        text = td.get_text(strip=True)
        # 检查是否有 a 标签
        a_tag = td.find('a')
        extra = f' [a.href={a_tag.get("href")}]' if a_tag else ''
        print(f'  td[{i}]: {repr(text[:60])}{extra}')

    # 详细检查 ridername 列（通常是第5列或第6列）
    print('\n--- 详细检查车手名字列 ---')
    for idx in [5, 6]:
        if idx < len(tds):
            td = tds[idx]
            print(f'\ntd[{idx}] HTML 结构:')
            print(f'  完整文本: {repr(td.get_text(strip=True))}')
            # 找 a 标签
            a_tag = td.find('a')
            if a_tag:
                print(f'  <a> 标签文本: {repr(a_tag.get_text(strip=True))}')
                print(f'  <a> href: {a_tag.get("href")}')
                # 检查 a 标签内的 span
                spans = a_tag.find_all('span')
                for s in spans:
                    print(f'    <span class="{s.get("class")}">: {repr(s.get_text(strip=True))}')
            # 检查 showIfMobile div
            mobile_div = td.find('div', class_='showIfMobile')
            if mobile_div:
                print(f'  showIfMobile div: {repr(mobile_div.get_text(strip=True))}')
            # 打印 td 的内部 HTML（前200字符）
            inner = str(td)[:300]
            print(f'  td inner HTML: {repr(inner)}')
