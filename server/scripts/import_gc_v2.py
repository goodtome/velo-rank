#!/usr/bin/env python3
"""
导入GC总成绩数据到 general_classification 表
时间差（time_gap）通过计算每个车手与领先者的时间差得出
"""

import json
import pymysql
import sys
import re

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

def parse_time_to_seconds(time_str):
    """将时间字符串解析为秒数。支持格式：HH:MM:SS 或 MM:SS"""
    if not time_str:
        return None
    
    time_str = time_str.strip()
    
    # 匹配 HH:MM:SS 或 MM:SS
    match = re.match(r'^(?:(\d+):)?(\d{1,2}):(\d{2})$', time_str)
    if not match:
        return None
    
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2))
    seconds = int(match.group(3))
    
    return hours * 3600 + minutes * 60 + seconds

def format_time_gap(seconds_diff):
    """将时间差（秒）格式化为字符串。领先者返回 '0:00'，其他返回 '+M:SS'"""
    if seconds_diff is None or seconds_diff == 0:
        return "0:00"
    
    minutes = seconds_diff // 60
    seconds = seconds_diff % 60
    
    return f"+{minutes}:{seconds:02d}"

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
        
        # 第一步：收集所有车手的数据，计算时间差
        gc_records = []
        min_total_time_seconds = None
        
        for gc in gc_data:
            rank = int(gc.get('rank', 0))
            rider_name = gc.get('rider', '')
            team_name = gc.get('team', '')
            time_str = gc.get('time', '')  # JSON中的字段名是'time'（如 "62:10:26"）
            
            if not rider_name or not rank:
                continue
            
            # 解析总时间
            total_time_seconds = parse_time_to_seconds(time_str)
            
            if total_time_seconds is not None:
                if min_total_time_seconds is None or total_time_seconds < min_total_time_seconds:
                    min_total_time_seconds = total_time_seconds
            
            gc_records.append({
                'rank': rank,
                'rider_name': rider_name,
                'team_name': team_name,
                'nationality': gc.get('nationality', ''),
                'total_time_str': total_time_str,
                'total_time_seconds': total_time_seconds,
            })
        
        print(f"解析完成: {len(gc_records)} 条有效记录")
        print(f"领先者总时间: {gc_records[0]['total_time_str'] if gc_records else 'N/A'}")
        
        # 第二步：计算时间差并导入数据库
        inserted = 0
        for rec in gc_records:
            rank = rec['rank']
            rider_name = rec['rider_name']
            team_name = rec['team_name']
            total_time_seconds = rec['total_time_seconds']
            
            # 计算时间差
            if total_time_seconds is not None and min_total_time_seconds is not None:
                time_gap_seconds = total_time_seconds - min_total_time_seconds
                time_gap = format_time_gap(time_gap_seconds)
            else:
                time_gap = "0:00"  # 无法计算时默认为0
            
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
                INSERT INTO general_classification (id, stage_id, `rank`, rider_id, team_id, nationality, time_gap, total_time)
                VALUES (UUID(), %s, %s, %s, %s, %s, %s, %s)
            """, (
                stage_id,
                rank,
                rider_id,
                team_id,
                rec['nationality'],
                time_gap,
                rec['total_time_str']
            ))
            
            inserted += 1
            
            if inserted % 50 == 0:
                print(f"  已处理 {inserted}/{len(gc_records)}...")
        
        conn.commit()
        print(f"\n✓ GC数据导入完成: {inserted} 条")
        
        # 验证前5名
        cursor.execute("""
            SELECT gc.`rank`, r.rider_name, gc.time_gap
            FROM general_classification gc
            LEFT JOIN riders r ON gc.rider_id = r.id
            WHERE gc.stage_id = %s
            ORDER BY gc.`rank`
            LIMIT 5
        """, (stage_id,))
        
        print("\n验证前5名:")
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} ({row[2]})")
        
    except Exception as e:
        conn.rollback()
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    json_file = 'stage-16-complete.json'  # 使用之前保存的数据
    race_id = 'e597183f-8ea4-4fb0-a469-661c57c5a958'  # 2026男子环意
    stage_num = 16
    
    import_gc_data(json_file, race_id, stage_num)
