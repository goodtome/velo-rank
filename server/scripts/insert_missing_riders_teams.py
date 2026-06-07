#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 stage_data.json 补充缺失的车队和车手"""

import json
import sys
import pymysql
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

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

def insert_team(cursor, team_name):
    """插入车队记录（如果不存在）"""
    if not team_name:
        return None
    
    # 检查是否已存在
    cursor.execute("SELECT id FROM teams WHERE team_name = %s", (team_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 尝试模糊匹配
    import uuid
    team_id = str(uuid.uuid4())
    
    try:
        cursor.execute("""
            INSERT IGNORE INTO teams (id, team_name, team_name_en, country)
            VALUES (%s, %s, %s, 'JP')
        """, (team_id, team_name, team_name))
        
        cursor.execute("SELECT id FROM teams WHERE team_name = %s", (team_name,))
        result = cursor.fetchone()
        if result:
            print(f"  新增车队: {team_name}")
            return result[0]
    except Exception as e:
        print(f"  插入车队失败 {team_name}: {e}")
        return None
    
    return None

def insert_rider(cursor, rider_name, nationality, rider_slug):
    """插入车手记录（如果不存在）"""
    if not rider_name:
        return None
    
    # 检查是否已存在
    cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 尝试模糊匹配
    if rider_slug:
        cursor.execute("SELECT id FROM riders WHERE rider_slug = %s", (rider_slug,))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    # 创建新记录
    import uuid
    rider_id = str(uuid.uuid4())
    
    # 使用最基本的字段
    try:
        cursor.execute("""
            INSERT IGNORE INTO riders (id, rider_name, nationality, rider_slug)
            VALUES (%s, %s, %s, %s)
        """, (rider_id, rider_name, nationality or 'UN', rider_slug or ''))
        
        cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
        result = cursor.fetchone()
        if result:
            print(f"  新增车手: {rider_name} ({nationality})")
            return result[0]
    except Exception as e:
        # 可能缺少必填字段
        try:
            cursor.execute("""
                INSERT IGNORE INTO riders (id, rider_name, nationality)
                VALUES (%s, %s, %s)
            """, (rider_id, rider_name, nationality or 'UN'))
            
            cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
            result = cursor.fetchone()
            if result:
                print(f"  新增车手(简单): {rider_name} ({nationality})")
                return result[0]
        except Exception as e2:
            print(f"  插入车手失败 {rider_name}: {e2}")
            return None
    
    return None

def main():
    json_file = sys.argv[1] if len(sys.argv) > 1 else 'stage_data.json'
    
    print(f"读取 JSON: {json_file}")
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 收集所有车队和车手
        teams_set = set()
        riders_set = set()  # (name, nat, slug)
        
        for section in ['results', 'gc', 'points', 'kom', 'youth']:
            for item in data.get(section, []):
                team = item.get('team', '')
                rider = item.get('rider', '')
                nat = item.get('nationality', '')
                slug = item.get('rider_id', '')
                
                if team:
                    teams_set.add(team)
                if rider:
                    riders_set.add((rider, nat, slug))
        
        print(f"\n找到 {len(teams_set)} 个车队, {len(riders_set)} 个车手")
        
        # 插入车队
        print("\n=== 插入缺失的车队 ===")
        teams_added = 0
        for team in sorted(teams_set):
            if insert_team(cursor, team):
                teams_added += 1
        
        # 插入车手
        print(f"\n=== 插入缺失的车手 ===")
        riders_added = 0
        for rider, nat, slug in sorted(riders_set):
            if insert_rider(cursor, rider, nat, slug):
                riders_added += 1
        
        conn.commit()
        print(f"\n完成: 插入 {teams_added} 个车队, {riders_added} 个车手")
    
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
