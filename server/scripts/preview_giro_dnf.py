#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预览 Giro 2026 DNF 数据修复 - 只查询，不修改
"""

import sys
import pymysql
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

def main():
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
    
    for stage_id, stage_num in stages:
        print(f'=== 赛段 {stage_num} ===')
        
        # 查询被标记为 DNF 的记录
        cursor.execute('''
            SELECT sr.rank_pos, r.rider_name, sr.time_gap
            FROM stage_results sr
            JOIN riders r ON sr.rider_id = r.id
            WHERE sr.stage_id = %s AND sr.time_gap = 'DNF'
            ORDER BY sr.rank_pos
        ''', (stage_id,))
        
        dnf_rows = cursor.fetchall()
        print(f'  标记为 DNF 的记录: {len(dnf_rows)} 条')
        for row in dnf_rows[:5]:  # 只显示前5条
            print(f'    #{row[0]} {row[1]} (time_gap={repr(row[2])})')
        if len(dnf_rows) > 5:
            print(f'    ... 还有 {len(dnf_rows) - 5} 条')
        
        # 查询 time_gap 为空的记录
        cursor.execute('''
            SELECT COUNT(*)
            FROM stage_results
            WHERE stage_id = %s AND (time_gap IS NULL OR time_gap = '')
        ''', (stage_id,))
        empty_count = cursor.fetchone()[0]
        print(f'  time_gap 为空的记录: {empty_count} 条')
        
        print()
    
    cursor.close()
    conn.close()
    
    print('=== 预览完成 ===')
    print('如需修复，请运行 fix_giro_dnf.py')


if __name__ == '__main__':
    main()
