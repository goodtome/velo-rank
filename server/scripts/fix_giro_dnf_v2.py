#!/usr/bin/env python3
# -*- coding: utf-8 -*-

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
    
    print('=== 开始修复 Giro 2026 DNF 数据 ===')
    print()
    
    # 1. 统计需要修复的记录数
    cursor.execute("SELECT COUNT(*) FROM stage_results WHERE time_gap = 'DNF'")
    total_dnf = cursor.fetchone()[0]
    print(f'总 DNF 记录数: {total_dnf}')
    
    if total_dnf == 0:
        print('✅ 没有需要修复的 DNF 记录')
        cursor.close()
        conn.close()
        return
    
    # 2. 按赛段统计
    print()
    print('各赛段 DNF 记录数:')
    cursor.execute('''
        SELECT s.stage_number, COUNT(*) as cnt
        FROM stage_results sr
        JOIN stages s ON sr.stage_id = s.id
        WHERE sr.time_gap = 'DNF'
        GROUP BY s.stage_number
        ORDER BY s.stage_number
    ''')
    for row in cursor.fetchall():
        print(f'  Stage {row[0]}: {row[1]} 条')
    
    print()
    print('=== 开始修复 ===')
    print('将所有 DNF 记录改回 NULL...')
    
    # 3. 修复：将所有 DNF 记录改回 NULL
    cursor.execute("UPDATE stage_results SET time_gap = NULL WHERE time_gap = 'DNF'")
    reset_count = cursor.rowcount
    print(f'已修复 {reset_count} 条记录')
    
    conn.commit()
    print('✅ 修复完成')
    
    cursor.close()
    conn.close()
    
    print()
    print('=== 下一步 ===')
    print('现在需要重新导入正确的 DNF 数据。')
    print('请手动提供 DNF 车手列表，或者告诉我正确的数据源。')


if __name__ == '__main__':
    main()
