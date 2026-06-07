#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 stage_data.json 补充 Youth 数据（年龄≤25）"""

import json
import sys
import pymysql
from pathlib import Path

# 修复Windows控制台编码问题
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 数据库配置
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',
    'database': 'jersey_db',
    'charset': 'utf8mb4'
}

def get_connection():
    return pymysql.connect(**DB_CONFIG)

def find_rider_id(cursor, rider_name, rider_slug=''):
    """根据车手名或slug查找rider_id - 支持多种名称格式"""
    if not rider_name:
        return None
    
    # 0. 尝试精确匹配 rider_slug
    if rider_slug:
        cursor.execute("SELECT id FROM riders WHERE rider_slug = %s", (rider_slug,))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    # 1. 尝试精确匹配 rider_name（可能是 "SURNAME Firstname" 或 "Firstname Surname"）
    cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 2. 尝试交换名字顺序后再匹配
    # 处理 "Firstname Surname" → "SURNAME Firstname" 格式
    if ' ' in rider_name:
        parts = rider_name.split(' ', 1)
        # 尝试：姓大写 + 名（数据库格式）
        swapped = f"{parts[1].upper()} {parts[0]}"
        cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (swapped,))
        result = cursor.fetchone()
        if result:
            return result[0]
        
        # 尝试：只匹配姓氏（模糊）
        surname = parts[1].upper()  # 假设格式是 "Firstname Surname"
        cursor.execute("SELECT id FROM riders WHERE rider_name LIKE %s LIMIT 1", (f'{surname}%',))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    # 3. 尝试模糊匹配（去掉可能的后缀，如 " (WTW)"）
    clean_name = rider_name.split(' (')[0].strip()
    cursor.execute("SELECT id FROM riders WHERE rider_name LIKE %s LIMIT 1", (f'{clean_name}%',))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 4. 尝试匹配 "SURNAME Firstname" 格式（数据库格式）
    if ' ' in rider_name:
        parts = rider_name.split(' ', 1)
        # 假设格式是 "SURNAME Firstname"
        surname_upper = parts[0].upper()
        firstname = parts[1]
        cursor.execute("SELECT id FROM riders WHERE rider_name LIKE %s AND rider_name LIKE %s LIMIT 1", 
                    (f'{surname_upper}%', f'%{firstname}%'))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    return None

def main():
    json_file = sys.argv[1] if len(sys.argv) > 1 else 'stage_data.json'
    stage_id = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"读取JSON文件: {json_file}")
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"  URL: {data.get('url', '')}")
    print(f"  成绩数: {len(data.get('results', []))}")
    
    # 找出年龄 ≤ 25的车手
    youth_riders = []
    for result in data.get('results', []):
        age = result.get('age', '')
        if age and age.isdigit() and int(age) <= 25:
            youth_riders.append(result)
    
    print(f"  青年车手数 (年龄≤25): {len(youth_riders)}")
    
    if not youth_riders:
        print("警告: 没有找到青年车手！")
        return
    
    # 连接到数据库
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 获取 stage_id（如果命令行未提供）
        if not stage_id:
            # 从 stage_results 表获取唯一的 stage_id
            cursor.execute("SELECT DISTINCT stage_id FROM stage_results LIMIT 1")
            result = cursor.fetchone()
            if result:
                stage_id = result[0]
        
        if not stage_id:
            print("错误: 找不到赛段ID！")
            return
        
        print(f"\n找到赛段ID: {stage_id}")
        
        # 删除现有的 Youth 数据
        print(f"\n=== 删除现有 Youth 数据 ===")
        cursor.execute("DELETE FROM youth_classification WHERE stage_id = %s", (stage_id,))
        deleted = cursor.rowcount
        print(f"  已删除 {deleted} 条现有数据")
        
        # 插入新的 Youth 数据
        print(f"\n=== 插入新的 Youth 数据 ===")
        inserted = 0
        skipped = 0
        
        for yr in youth_riders:
            rank = int(yr.get('rank', 0))
            rider_name = yr.get('rider', '')
            rider_slug = yr.get('rider_id', '')
            
            if not rider_name or not rank:
                skipped += 1
                continue
            
            # 查找 rider_id
            rider_id = find_rider_id(cursor, rider_name, rider_slug)
            
            if not rider_id:
                print(f"  跳过: 找不到车手 {rider_name}")
                skipped += 1
                continue
            
            try:
                # 插入数据（id 是自增，不插入）
                # youth_classification 表结构：
                # id (int, auto_increment), stage_id, rider_id, rank, time, time_gap, jersey_type, created_at, updated_at
                cursor.execute("""
                    INSERT IGNORE INTO youth_classification (`stage_id`, `rank`, `rider_id`, `time_gap`)
                    VALUES (%s, %s, %s, '+0:00')
                """, (stage_id, rank, rider_id))
                inserted += 1
            except Exception as e:
                print(f"  错误: 插入Youth数据失败: {e}")
                skipped += 1
        
        conn.commit()
        print(f"\n  [OK] 成功: {inserted} 条, 跳过: {skipped} 条")
        
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
