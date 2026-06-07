#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入KOM/Points/Youth数据到数据库
读取 fetch_pcs_stage.py 生成的JSON文件，导入到对应的分类表
"""

import json
import sys
import pymysql
from pathlib import Path

# 数据库连接配置
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
    """根据车手名查找rider_id"""
    if rider_slug:
        cursor.execute("SELECT id FROM riders WHERE rider_slug = %s", (rider_slug,))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def find_team_id(cursor, team_name):
    """根据车队名查找team_id"""
    if not team_name:
        return None
    cursor.execute("SELECT id FROM teams WHERE team_name = %s", (team_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    cursor.execute("SELECT id FROM teams WHERE team_name LIKE %s", (f'%{team_name}%',))
    result = cursor.fetchone()
    return result[0] if result else None

def import_kom(json_file, stage_id, conn):
    """导入KOM数据到 mountains_classification 表"""
    cursor = conn.cursor()
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    kom_data = data.get('kom', [])
    print(f"准备导入KOM数据: {len(kom_data)} 条")
    
    if not kom_data:
        print("警告: 没有KOM数据")
        return 0
    
    # 先删除旧的KOM数据
    cursor.execute("DELETE FROM mountains_classification WHERE stage_id = %s", (stage_id,))
    
    inserted = 0
    skipped = 0
    
    for kom in kom_data:
        rank = int(kom.get('rank', 0))
        rider_name = kom.get('rider', '')
        points = int(kom.get('points', 0))
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, kom.get('rider_id', ''))
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            cursor.execute("""
                INSERT INTO mountains_classification (stage_id, rider_id, `rank`, points)
                VALUES (%s, %s, %s, %s)
            """, (stage_id, rider_id, rank, points))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入KOM数据失败: {e}")
            skipped += 1
    
    conn.commit()
    cursor.close()
    
    print(f"✓ KOM数据导入完成: {inserted} 条成功, {skipped} 条跳过")
    return inserted

def import_points(json_file, stage_id, conn):
    """导入Points数据到 points_classification 表"""
    cursor = conn.cursor()
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    points_data = data.get('points', [])
    print(f"准备导入Points数据: {len(points_data)} 条")
    
    if not points_data:
        print("警告: 没有Points数据")
        return 0
    
    # 先删除旧的Points数据
    cursor.execute("DELETE FROM points_classification WHERE stage_id = %s", (stage_id,))
    
    inserted = 0
    skipped = 0
    
    for points in points_data:
        rank = int(points.get('rank', 0))
        rider_name = points.get('rider', '')
        points_val = int(points.get('points', 0))
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, points.get('rider_id', ''))
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            cursor.execute("""
                INSERT INTO points_classification (stage_id, rider_id, `rank`, points)
                VALUES (%s, %s, %s, %s)
            """, (stage_id, rider_id, rank, points_val))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入Points数据失败: {e}")
            skipped += 1
    
    conn.commit()
    cursor.close()
    
    print(f"✓ Points数据导入完成: {inserted} 条成功, {skipped} 条跳过")
    return inserted

def import_youth(json_file, stage_id, conn):
    """导入Youth数据到 youth_classification 表"""
    cursor = conn.cursor()
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    youth_data = data.get('youth', [])
    print(f"准备导入Youth数据: {len(youth_data)} 条")
    
    if not youth_data:
        print("警告: 没有Youth数据")
        return 0
    
    # 先删除旧的Youth数据
    cursor.execute("DELETE FROM youth_classification WHERE stage_id = %s", (stage_id,))
    
    inserted = 0
    skipped = 0
    
    for youth in youth_data:
        rank = int(youth.get('rank', 0))
        rider_name = youth.get('rider', '')
        time_gap = youth.get('time_gap', '0:00')
        total_time = youth.get('total_time', '')
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, youth.get('rider_id', ''))
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            cursor.execute("""
                INSERT INTO youth_classification (stage_id, rider_id, `rank`, `time`, time_gap)
                VALUES (%s, %s, %s, %s, %s)
            """, (stage_id, rider_id, rank, total_time, time_gap))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入Youth数据失败: {e}")
            skipped += 1
    
    conn.commit()
    cursor.close()
    
    print(f"✓ Youth数据导入完成: {inserted} 条成功, {skipped} 条跳过")
    return inserted

def main():
    json_file = 'stage-16-kom-youth.json'
    
    if not Path(json_file).exists():
        print(f"错误: 找不到文件 {json_file}")
        print(f"请先运行: python fetch_pcs_stage.py <URL> > {json_file}")
        sys.exit(1)
    
    # 获取stage_id
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 查找2026男子环意Stage 16
        cursor.execute("SELECT id FROM races WHERE race_name = %s AND start_date = %s", 
                    ('Giro d\'Italia', '2026-05-08'))
        race_result = cursor.fetchone()
        
        if not race_result:
            print("错误: 找不到2026年男子环意赛事")
            sys.exit(1)
        
        race_id = race_result[0]
        
        cursor.execute("SELECT id FROM stages WHERE race_id = %s AND stage_number = %s", 
                    (race_id, 16))
        stage_result = cursor.fetchone()
        
        if not stage_result:
            print("错误: 找不到Stage 16")
            sys.exit(1)
        
        stage_id = stage_result[0]
        print(f"赛事ID: {race_id}")
        print(f"赛段ID: {stage_id}\n")
        
        # 导入KOM数据
        print("=== 导入KOM数据 ===")
        kom_count = import_kom(json_file, stage_id, conn)
        
        # 导入Points数据
        print("\n=== 导入Points数据 ===")
        points_count = import_points(json_file, stage_id, conn)
        
        # 导入Youth数据
        print("\n=== 导入Youth数据 ===")
        youth_count = import_youth(json_file, stage_id, conn)
        
        print(f"\n{'='*50}")
        print(f"导入完成汇总:")
        print(f"  KOM: {kom_count} 条")
        print(f"  Points: {points_count} 条")
        print(f"  Youth: {youth_count} 条")
        print(f"{'='*50}")
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
