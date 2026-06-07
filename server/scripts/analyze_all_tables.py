import subprocess
import json
from bs4 import BeautifulSoup
import re

URL = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-16'
HEADERS = {'User-Agent': 'Mozilla/5.0'}

print(f"正在获取 {URL} ...")
result = subprocess.run(
    ['curl', '-s', '-L', '-H', f'User-Agent: {HEADERS["User-Agent"]}', URL],
    capture_output=True, text=True, timeout=30
)
soup = BeautifulSoup(result.stdout, 'html.parser')
tables = soup.find_all('table')
print(f'找到 {len(tables)} 个表格\n')

for i, table in enumerate(tables):
    rows = table.find_all('tr')
    if not rows:
        continue
    
    first_row = rows[0]
    tds = first_row.find_all(['td', 'th'])
    text_sample = first_row.get_text(strip=True)[:80]
    
    # 检查是否包含车手链接（判断是否是车手排名表）
    has_rider_links = len(first_row.find_all('a')) > 0
    
    # 检查表头
    headers = []
    for td in tds:
        headers.append(td.get_text(strip=True)[:15])
    
    print(f'Table {i}: {len(rows)} 行, {len(tds)} 列, 有车手链接: {has_rider_links}')
    print(f'  表头/首行: {headers}')
    print(f'  内容示例: {text_sample[:60]}')
    
    # 如果是车手表，显示前2条记录的车手名
    if has_rider_links and len(rows) > 1:
        rider_cells = []
        for row in rows[1:3]:  # 跳过表头
            a_tags = row.find_all('a')
            if a_tags:
                rider_cells.append(a_tags[0].get_text(strip=True)[:20])
        if rider_cells:
            print(f'  车手示例: {rider_cells}')
    print()
