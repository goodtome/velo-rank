import subprocess
from bs4 import BeautifulSoup
import re

url = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-16'
cmd = ['curl', '-s', '-L', '-H', 'User-Agent: Mozilla/5.0', url]
result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
soup = BeautifulSoup(result.stdout, 'html.parser')
tables = soup.find_all('table')

print(f'Total tables: {len(tables)}\n')

# 分析 Table 1 (应该是GC表)
if len(tables) > 1:
    table = tables[1]
    rows = table.find_all('tr')
    print(f'=== Table 1 (GC表?) 分析：{len(rows)} 行 ===\n')
    
    # 检查前5行
    for i, row in enumerate(rows[:5]):
        tds = row.find_all(['td', 'th'])
        print(f'Row {i}: {len(tds)} 列')
        
        if tds:
            # 显示每列的文本和是否包含时间格式
            for j, td in enumerate(tds[:15]):
                text = td.get_text(strip=True)[:40]
                # 检查是否包含时间差格式 (+X:XX 或数字:X:XX)
                has_time_gap = bool(re.search(r'(\+\d)|(^\d:\d{2})', text))
                has_total_time = bool(re.search(r'\d{2}:\d{2}:\d{2}', text))
                
                marker = ''
                if has_time_gap:
                    marker += '⏱️GAP '
                if has_total_time:
                    marker += '⏱️TOTAL'
                
                if marker:
                    print(f'  td[{j:2d}] {marker} "{text}"')
                elif j < 3:  # 只显示前3列的非时间行
                    print(f'  td[{j:2d}]          "{text}"')
        print()
