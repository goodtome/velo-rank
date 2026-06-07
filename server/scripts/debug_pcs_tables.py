#!/usr/bin/env python3
"""
调试脚本：分析PCS页面表格结构，找出GC/Points/KOM/Youth表的正确列索引
"""

import subprocess
import json
from bs4 import BeautifulSoup

def clean(text):
    return text.strip().replace('\n', ' ').replace('\r', '') if text else ""

def debug_pcs_tables(url):
    """获取PCS页面并分析所有表格结构"""
    
    # 用curl获取页面（绕过Cloudflare）
    cmd = ['curl', '-s', '-L', '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    html = result.stdout
    
    if not html or len(html) < 1000:
        print(f"错误: HTML内容太短 ({len(html)} bytes)")
        return
    
    soup = BeautifulSoup(html, 'html.parser')
    tables = soup.find_all('table')
    
    print(f"找到 {len(tables)} 个表格\n")
    
    # 分析前12个表格
    for i, table in enumerate(tables[:12]):
        rows = table.find_all('tr')
        print(f"{'='*60}")
        print(f"Table {i}: {len(rows)} 行")
        
        if not rows:
            continue
        
        # 检查前3行
        for row_idx, row in enumerate(rows[:3]):
            tds = row.find_all(['td', 'th'])
            print(f"\n  Row {row_idx}: {len(tds)} 个单元格")
            
            for td_idx, td in enumerate(tds[:15]):
                text = clean(td.get_text())[:40]
                has_a = '🔗' if td.find('a') else '  '
                has_span = '📝' if td.find('span') else '  '
                classes = td.get('class', [])
                class_str = f" [{', '.join(classes)}]" if classes else ""
                
                print(f"    td[{td_idx:2d}]: \"{text:40s}\" {has_a}{has_span}{class_str}")
        
        # 如果是GC表（通过表头判断）
        first_row = rows[0]
        if first_row.find('th'):
            headers = [clean(th.get_text()) for th in first_row.find_all(['th', 'td'])]
            print(f"\n  表头: {headers[:10]}")

if __name__ == '__main__':
    url = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-16'
    debug_pcs_tables(url)
