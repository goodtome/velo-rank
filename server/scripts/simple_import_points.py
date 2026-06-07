#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化导入脚本 - 只导入积分数据
从 stage_data.json 导入 points/mountains/youth 数据
"""

import json
import sys
import pymysql
from pathlib import Path

# 修复Windows控制台编码问题
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='ignore')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='ignore')

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

def find_rider_id(cursor, rider_name):
    """根据车手名查找rider_id（模糊匹配）"""
    if not rider_name:
        return None
    
    # 1. 精确匹配
    cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 2. 模糊匹配（去掉可能的后缀）
    clean_name = rider_name.split(' (')[0].strip()
    cursor.execute("SELECT id FROM riders WHERE rider_name LIKE %s LIMIT 1", (f'{clean_name}%',))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    return None

def import_points_only(cursor, stage_id, points_data):
    """只导入冲刺积分到 points_classification 表"""
    print(f"[导入] 冲刺积分: {len(points_data)} 条")
    inserted = 0
    skipped = 0
    
    for item in points_data:
        rank = int(item.get('rank', 0))
        rider_name = item.get('rider', '')
        points = int(item.get('points', 0))
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name)
        
        if not rider_id:
            print(f"  [跳过] 找不到车手: {rider_name}")
            skipped += 1
            continue
        
        try:
            # points_classification 表的 id 是自动递增，不插入 id 字段
            cursor.execute("""
                INSERT INTO points_classification (stage_id, rider_id, `rank`, points)
                VALUES (%s, %s, %s, %s)
            """, (stage_id, rider_id, rank, points))
            inserted += 1
        except Exception as e:
            print(f"  [错误] 插入积分数据失败: {e}")
            skipped += 1
    
    print(f"[OK] 冲刺积分导入完成: {inserted} 条成功, {skipped} 条跳过\n")
    return inserted

def main():
    if len(sys.argv) < 2:
        print("用法: python simple_import_points.py <json_file>")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    if not Path(json_file).exists():
        print(f"[错误] 找不到文件: {json_file}")
        sys.exit(1)
    
    # 读取JSON文件
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"[读取] JSON文件: {json_file}")
    print(f"  Points数: {len(data.get('points', []))}")
    print(f"  KOM数: {len(data.get('kom', []))}")
    print(f"  Youth数: {len(data.get('youth', []))}\n")
    
    # 连接数据库
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        stage_id = 'dae5a35c-7cc3-4f67-8cec-5249adfa381a'
        
        # 删除现有积分数据
        cursor.execute("DELETE FROM points_classification WHERE stage_id = %s", (stage_id,))
        print(f"[删除] 已删除 points_classification 中现有数据: {cursor.rowcount} 条\n")
        
        # 导入冲刺积分
        if data.get('points'):
            import_points_only(cursor, stage_id, data['points'])
        
        # 提交事务
        conn.commit()
        
        print("="*50)
        print("[OK] 积分数据导入完成!")
        print("="*50)
        
    except Exception as e:
        print(f"[错误] {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
