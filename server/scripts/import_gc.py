#!/usr/bin/env python3
"""
导入GC总成绩数据到 general_classification 表
"""

import json
import pymysql
import sys

# 数据库连接配置 - 本地开发环境
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

def import_gc_data(json_file, race_id, stage_num):
    """导入GC数据到数据库"""
    
    # 读取JSON文件
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    gc_data = data.get('gc', [])
    print(f"准备导入GC数据: {len(gc_data)} 条")
    
    if not gc_data:
        print("警告: 没有GC数据")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 查找stage_id
        cursor.execute(
            "SELECT id FROM stages WHERE race_id = %s AND stage_number = %s",
            (race_id, stage_num)
        )
        stage_result = cursor.fetchone()
        
        if not stage_result:
            print(f"错误: 找不到 Stage {stage_num}")
            return
        
        stage_id = stage_result[0]
        print(f"Stage ID: {stage_id}")
        
        # 删除该赛段已有的GC数据
        cursor.execute("DELETE FROM general_classification WHERE stage_id = %s", (stage_id,))
        deleted = cursor.rowcount
        if deleted > 0:
            print(f"删除旧GC数据: {deleted} 条")
        
        # 导入新的GC数据
        inserted = 0
        for gc in gc_data:
            rank = int(gc.get('rank', 0))
            rider_name = gc.get('rider', '')
            team_name = gc.get('team', '')
            time_gap = gc.get('time', '')  # GC时间差
            
            if not rider_name or not rank:
                continue
            
            # 查找rider_id
            cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
            rider_result = cursor.fetchone()
            
            if not rider_result:
                print(f"  警告: 找不到车手 {rider_name}，跳过")
                continue
            
            rider_id = rider_result[0]
            
            # 查找team_id
            cursor.execute("SELECT id FROM teams WHERE team_name = %s", (team_name,))
            team_result = cursor.fetchone()
            
            if not team_result:
                print(f"  警告: 找不到车队 {team_name}，使用空ID")
                team_id = ''
            else:
                team_id = team_result[0]
            
            # 插入GC数据
            cursor.execute("""
                INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, time_gap)
                VALUES (UUID(), %s, %s, %s, %s, %s, %s)
            """, (
                stage_id,
                rank,
                rider_id,
                team_id,
                gc.get('nationality', ''),
                time_gap
            ))
            
            inserted += 1
            
            if inserted % 50 == 0:
                print(f"  已处理 {inserted}/{len(gc_data)}...")
        
        conn.commit()
        print(f"\n✓ GC数据导入完成: {inserted} 条")
        
    except Exception as e:
        conn.rollback()
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    json_file = 'stage-16-complete.json'
    race_id = 'e597183f-8ea4-4fb0-a469-661c57c5a958'  # 2026男子环意
    stage_num = 16
    
    import_gc_data(json_file, race_id, stage_num)
