#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复 Giro 2026 DNF 数据 - 只将 PCS HTML 中明确标识为 DNF 的车手标记为 DNF
正确逻辑：
  - td[0] == 'DNF' → DNF 车手 → time_gap = 'DNF'
  - td[0] 是数字 → 完赛车手 → time_gap = 时间值（不是 'DNF'）
"""

import sys
import os
import pymysql
from bs4 import BeautifulSoup
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',
    'database': 'jersey_db',
    'charset': 'utf8mb4'
}

PCS_BASE = 'https://www.procyclingstats.com/race/giro-d-italia/2026/stage-'

def parse_stage_html(html_file):
    """解析 PCS 赛段 HTML，返回 DNF 车手的 rider_name 集合"""
    if not os.path.exists(html_file):
        print(f'  ⚠️  文件不存在: {html_file}')
        return set(), []
    
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
    
    # 找主表格（第一个有 tbody 的 table）
    tbl = None
    for t in soup.find_all('table'):
        if t.find('tbody'):
            tbl = t
            break
    
    if not tbl:
        print(f'  ⚠️  未找到表格: {html_file}')
        return set(), []
    
    rows = tbl.find('tbody').find_all('tr')
    print(f'  表格行数: {len(rows)}')
    
    dnf_riders = set()  # DNF 车手名字集合
    all_riders = []    # 所有车手 (rider_name, rank_text)
    
    for row in rows:
        tds = row.find_all('td')
        if not tds:
            continue
        
        rank_text = tds[0].get_text(strip=True)
        
        # 提取车手名字（td[7] 对于 13 列表格）
        rider_name = ''
        if len(tds) >= 8:
            a_tag = tds[7].find('a', href=lambda x: x and 'rider/' in x)
            if a_tag:
                # 正确提取车手名字
                span = a_tag.find('span', class_='uppercase')
                if span:
                    surname = span.get_text(strip=True)
                    # 找 firstname（span 后面的文本）
                    firstname = ''
                    for content in a_tag.contents:
                        if isinstance(content, str) and span.get_text(strip=True) in content:
                            continue
                        if isinstance(content, str) and content.strip():
                            firstname = content.strip()
                            break
                    rider_name = f"{surname} {firstname}".strip()
        
        if not rider_name:
            continue
        
        # 判断是否是 DNF
        if rank_text == 'DNF':
            dnf_riders.add(rider_name)
            print(f'  DNF: {rider_name}')
        elif rank_text.isdigit() or rank_text == 'DNS':
            all_riders.append((rider_name, rank_text))
    
    print(f'  找到 DNF 车手: {len(dnf_riders)} 人')
    return dnf_riders, all_riders


def fix_stage_dnf(conn, stage_id, dnf_riders):
    """修复单个赛段的 DNF 数据"""
    cursor = conn.cursor()
    
    # 1. 先将该赛段所有 time_gap = 'DNF' 的记录改回 NULL
    cursor.execute(
        "UPDATE stage_results SET time_gap = NULL WHERE stage_id = %s AND time_gap = 'DNF'",
        (stage_id,)
    )
    reset_count = cursor.rowcount
    print(f'  重置 DNF 标记: {reset_count} 条')
    
    # 2. 只将明确是 DNF 的车手标记为 DNF
    if not dnf_riders:
        print(f'  ℹ️  无 DNF 车手')
        conn.commit()
        return reset_count, 0
    
    # 通过 rider_name 匹配 riders 表，然后更新 stage_results
    dnf_count = 0
    for rider_name in dnf_riders:
        # 先找 rider_id
        cursor.execute(
            "SELECT id FROM riders WHERE rider_name = %s LIMIT 1",
            (rider_name,)
        )
        rider_row = cursor.fetchone()
        if not rider_row:
            print(f'  ⚠️  未找到车手: {rider_name}')
            continue
        
        rider_id = rider_row[0]
        
        # 更新 stage_results
        cursor.execute(
            "UPDATE stage_results SET time_gap = 'DNF' WHERE stage_id = %s AND rider_id = %s",
            (stage_id, rider_id)
        )
        if cursor.rowcount > 0:
            dnf_count += 1
    
    conn.commit()
    print(f'  正确标记 DNF: {dnf_count} 条')
    return reset_count, dnf_count


def main():
    html_dir = Path(__file__).parent / 'pcs_html'
    
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # 获取所有 Giro 2026 赛段
    cursor.execute(
        "SELECT id, stage_number FROM stages WHERE race_id = %s ORDER BY stage_number",
        ('e597183f-8ea4-4fb0-a469-661c57c5a958',)
    )
    stages = cursor.fetchall()
    
    print(f'找到 {len(stages)} 个赛段')
    print()
    
    total_reset = 0
    total_dnf = 0
    
    for stage_id, stage_num in stages:
        print(f'处理赛段 {stage_num}...')
        
        # 找 HTML 文件
        html_file = html_dir / f'giro_s{stage_num}.html'
        if not html_file.exists():
            print(f'  ⚠️  HTML 文件不存在，跳过')
            print()
            continue
        
        # 解析 HTML
        dnf_riders, all_riders = parse_stage_html(str(html_file))
        
        # 修复数据库
        reset_count, dnf_count = fix_stage_dnf(conn, stage_id, dnf_riders)
        total_reset += reset_count
        total_dnf += dnf_count
        
        print()
    
    print(f'=== 修复完成 ===')
    print(f'总重置 DNF 标记: {total_reset} 条')
    print(f'总正确标记 DNF: {total_dnf} 条')
    
    cursor.close()
    conn.close()


if __name__ == '__main__':
    main()
