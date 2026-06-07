#!/usr/bin/env python3
"""
导入 Stage 18 数据到数据库
从 stage_data.json 读取数据，导入到各相关表
"""
import json
import pymysql
import uuid
from datetime import datetime
import sys
import io

# 强制 stdout/stderr 使用 UTF-8 编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 数据库连接配置
DB_CONFIG = {
    'host': 'localhost',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',
    'database': 'jersey_db',
    'charset': 'utf8mb4'
}

# Stage 18 的 ID
STAGE_ID = '9376b9fa-da48-4bf4-9f39-709b4baea9d0'
RACE_ID = 'e597183f-8ea4-4fb0-a469-661c57c5a958'

def load_json_data():
    """加载 JSON 数据"""
    with open('stage_data.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def get_or_create_rider(cursor, rider_name, rider_id_slug, nationality='UN'):
    """根据 rider_slug 查找或创建车手"""
    # 先查找
    sql = "SELECT id FROM riders WHERE rider_slug=%s"
    cursor.execute(sql, (rider_id_slug,))
    row = cursor.fetchone()
    if row:
        return row[0]
    
    # 创建新车手
    rider_uuid = str(uuid.uuid4())
    sql = """INSERT INTO riders (id, rider_name, rider_name_zh, rider_slug, nationality, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, NOW(), NOW())"""
    cursor.execute(sql, (rider_uuid, rider_name, rider_name, rider_id_slug, nationality))
    print(f"  创建新车手: {rider_name} ({rider_id_slug})")
    return rider_uuid

def get_or_create_team(cursor, team_name):
    """根据队名查找或创建车队"""
    if not team_name:
        return None
    
    # 先查找
    sql = "SELECT id FROM teams WHERE team_name=%s OR team_name_en=%s"
    cursor.execute(sql, (team_name, team_name))
    row = cursor.fetchone()
    if row:
        return row[0]
    
    # 创建新车队
    team_uuid = str(uuid.uuid4())
    sql = """INSERT INTO teams (id, team_name, team_name_en, team_name_zh, created_at)
               VALUES (%s, %s, %s, %s, NOW())"""
    cursor.execute(sql, (team_uuid, team_name, team_name, team_name))
    print(f"  创建新车队: {team_name}")
    return team_uuid

def import_stage_results(cursor, data):
    """导入赛段成绩"""
    results = data.get('results', [])
    print(f"\n导入赛段成绩: {len(results)} 条")
    
    # 先删除已有数据
    cursor.execute("DELETE FROM stage_results WHERE stage_id=%s", (STAGE_ID,))
    
    inserted = 0
    for r in results:
        rank = r.get('rank')
        if not rank or rank == '':
            continue  # 跳过未完赛车手
        
        rider_name = r.get('rider', '')
        rider_slug = r.get('rider_id', '')
        nationality = r.get('nationality', 'UN')
        if not nationality:
            nationality = 'UN'
        team_name = r.get('team', '')
        stage_time = r.get('stage_time', '')
        
        # 获取或创建车手和车队
        rider_uuid = get_or_create_rider(cursor, rider_name, rider_slug, nationality)
        team_uuid = get_or_create_team(cursor, team_name)
        
        # 插入成绩
        result_id = str(uuid.uuid4())
        sql = """INSERT INTO stage_results 
                   (id, stage_id, rider_id, team_id, `rank_pos`, time_gap, nationality, 
                   is_same_time, sprint_points, mountain_points, youth_eligible, jersey_earned, 
                   created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())"""
        
        time_bonus = r.get('time_bonus', '')
        is_same_time = 1 if r.get('stage_time') == 's.t.' else 0
        sprint_points = int(r.get('pnt_points', 0)) if str(r.get('pnt_points', 0)).replace('″','').isdigit() else 0
        mountain_points = 0
        youth_eligible = 1 if r.get('specialty') == 'GC' and int(r.get('age', 0)) < 25 else 0
        
        cursor.execute(sql, (
            result_id, STAGE_ID, rider_uuid, team_uuid,
            int(rank), r.get('timelag', ''),
            nationality,
            is_same_time, sprint_points, mountain_points, youth_eligible,
            json.dumps({'time': stage_time, 'time_bonus': time_bonus})
        ))
        inserted += 1
    
    print(f"  成功导入 {inserted} 条赛段成绩")

def import_jerseys(cursor, data):
    """导入领骑衫持有者"""
    jerseys = data.get('jersey_holders', [])
    print(f"\n导入领骑衫: {len(jerseys)} 件")
    
    # 先删除已有数据
    cursor.execute("DELETE FROM jerseys WHERE stage_id=%s", (STAGE_ID,))
    
    # 领骑衫颜色映射
    color_map = {
        'PINK (GC)': 'PINK',
        'PINK2': 'PURPLE',  # 紫衫（冲刺积分）
        'BLUE2': 'BLUE',    # 蓝衫（爬坡王）
        'LIGHT_GRAY': 'WHITE',  # 白衫（最佳年轻车手）
        'PINK': 'PINK',
        'PURPLE': 'PURPLE',
        'BLUE': 'BLUE',
        'WHITE': 'WHITE',
    }
    
    inserted = 0
    for j in jerseys:
        color = j.get('color', '')
        jersey_type = color_map.get(color, color)
        
        rider_name = j.get('rider', '')
        rider_slug = rider_name.lower().replace(' ', '-')
        team_name = j.get('team', '')
        nationality = j.get('nationality', 'UN')
        if not nationality:
            nationality = 'UN'
        
        # 获取或创建车手和车队
        rider_uuid = get_or_create_rider(cursor, rider_name, rider_slug, nationality)
        team_uuid = get_or_create_team(cursor, team_name)
        
        # 插入领骑衫记录
        jersey_id = str(uuid.uuid4())
        sql = """INSERT INTO jerseys 
                   (id, stage_id, rider_id, team_id, jersey_type, created_at)
                   VALUES (%s, %s, %s, %s, %s, NOW())"""
        cursor.execute(sql, (jersey_id, STAGE_ID, rider_uuid, team_uuid, jersey_type))
        print(f"  {jersey_type} 衫: {rider_name}")
        inserted += 1
    
    print(f"  成功导入 {inserted} 件领骑衫")

def import_gc(cursor, data):
    """导入 GC 总成绩到 general_classification 表"""
    results = data.get('gc', [])
    print(f"\n导入 GC 榜单: {len(results)} 条")
    
    # 先删除已有数据
    cursor.execute("DELETE FROM general_classification WHERE stage_id=%s", (STAGE_ID, ))
    
    inserted = 0
    for r in results:
        rank = r.get('rank')
        if not rank or rank == '':
            continue
            
        rider_name = r.get('rider', '')
        rider_slug = r.get('rider_id', '')
        if not rider_slug:
            rider_slug = rider_name.lower().replace(' ', '-')
        nationality = r.get('nationality', 'UN')
        if not nationality:
            nationality = 'UN'
        
        # 获取或创建车手和车队
        rider_uuid = get_or_create_rider(cursor, rider_name, rider_slug, nationality)
        team_name = r.get('team', '')
        team_uuid = get_or_create_team(cursor, team_name)
        
        # 插入数据
        # 注意：修复后的 extract_classification 输出 total_time 和 time_gap 字段
        # 排名1：total_time = 总时间, time_gap = "0:00"
        # 排名2+：total_time = "", time_gap = "+4:03" 等时间差
        record_id = str(uuid.uuid4())
        total_time = r.get('total_time', '')
        time_gap = r.get('time_gap', '')
        
        sql = """INSERT INTO general_classification 
                   (id, stage_id, rider_id, team_id, nationality, `rank`, total_time, time_gap, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())"""
        cursor.execute(sql, (
            record_id, STAGE_ID, rider_uuid, team_uuid,
            nationality, int(rank), total_time, time_gap
        ))
        inserted += 1
    
    print(f"  成功导入 {inserted} 条 GC 数据")

def import_youth(cursor, data):
    """导入 Youth 总成绩到 youth_classification 表"""
    results = data.get('youth', [])
    print(f"\n导入 YOUTH 榜单: {len(results)} 条")
    
    # 先删除已有数据
    cursor.execute("DELETE FROM youth_classification WHERE stage_id=%s", (STAGE_ID, ))
    
    inserted = 0
    for r in results:
        rank = r.get('rank')
        if not rank or rank == '':
            continue
            
        rider_name = r.get('rider', '')
        rider_slug = r.get('rider_id', '')
        if not rider_slug:
            rider_slug = rider_name.lower().replace(' ', '-')
        nationality = r.get('nationality', 'UN')
        if not nationality:
            nationality = 'UN'
        
        # 获取或创建车手
        rider_uuid = get_or_create_rider(cursor, rider_name, rider_slug, nationality)
        
        # 插入数据
        # 注意：修复后的 extract_classification 输出 total_time 和 time_gap 字段
        # Youth表用 time 和 time_gap（不是 total_time）
        total_time = r.get('total_time', '')
        time_gap = r.get('time_gap', '')
        
        sql = """INSERT INTO youth_classification 
                   (stage_id, rider_id, `rank`, `time`, time_gap, jersey_type, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())"""
        cursor.execute(sql, (
            STAGE_ID, rider_uuid,
            int(rank), total_time, time_gap, 'WHITE'
        ))
        inserted += 1
    
    print(f"  成功导入 {inserted} 条 YOUTH 数据")

def import_points(cursor, data):
    """导入冲刺积分榜到 points_classification 表"""
    results = data.get('points', [])
    print(f"\n导入 POINTS 榜单: {len(results)} 条")
    
    # 先删除已有数据
    cursor.execute("DELETE FROM points_classification WHERE stage_id=%s", (STAGE_ID, ))
    
    inserted = 0
    for r in results:
        rank = r.get('rank')
        if not rank or rank == '':
            continue
            
        rider_name = r.get('rider', '')
        rider_slug = r.get('rider_id', '')
        if not rider_slug:
            rider_slug = rider_name.lower().replace(' ', '-')
        nationality = r.get('nationality', 'UN')
        if not nationality:
            nationality = 'UN'
        
        # 获取或创建车手
        rider_uuid = get_or_create_rider(cursor, rider_name, rider_slug, nationality)
        
        # 插入数据
        points = r.get('points', 0)
        
        sql = """INSERT INTO points_classification 
                   (stage_id, rider_id, `rank`, points, jersey_type, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, NOW(), NOW())"""
        cursor.execute(sql, (
            STAGE_ID, rider_uuid,
            int(rank), int(points) if str(points).isdigit() else 0, 'PURPLE'
        ))
        inserted += 1
    
    print(f"  成功导入 {inserted} 条 POINTS 数据")

def import_kom(cursor, data):
    """导入 KOM 积分榜到 mountains_classification 表"""
    results = data.get('kom', [])
    print(f"\n导入 KOM 榜单: {len(results)} 条")
    
    # 先删除已有数据
    cursor.execute("DELETE FROM mountains_classification WHERE stage_id=%s", (STAGE_ID, ))
    
    inserted = 0
    for r in results:
        rank = r.get('rank')
        if not rank or rank == '':
            continue
            
        rider_name = r.get('rider', '')
        rider_slug = r.get('rider_id', '')
        if not rider_slug:
            rider_slug = rider_name.lower().replace(' ', '-')
        nationality = r.get('nationality', 'UN')
        if not nationality:
            nationality = 'UN'
        
        # 获取或创建车手
        rider_uuid = get_or_create_rider(cursor, rider_name, rider_slug, nationality)
        
        # 插入数据
        points = r.get('points', 0)
        
        sql = """INSERT INTO mountains_classification 
                   (stage_id, rider_id, `rank`, points, jersey_type, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, NOW(), NOW())"""
        cursor.execute(sql, (
            STAGE_ID, rider_uuid,
            int(rank), int(points) if str(points).isdigit() else 0, 'BLUE'
        ))
        inserted += 1
    
    print(f"  成功导入 {inserted} 条 KOM 数据")

def main():
    print("=" * 60)
    print("导入 Stage 18 数据")
    print("=" * 60)
    
    # 加载数据
    data = load_json_data()
    print(f"\n已加载数据:")
    print(f"  赛段信息: {data.get('stage_info', {})}")
    print(f"  赛段成绩: {len(data.get('results', []))} 条")
    print(f"  领骑衫: {len(data.get('jersey_holders', []))} 件")
    print(f"  GC 数据: {len(data.get('gc', []))} 条")
    print(f"  Youth 数据: {len(data.get('youth', []))} 条")
    print(f"  Points 数据: {len(data.get('points', []))} 条")
    print(f"  KOM 数据: {len(data.get('kom', []))} 条")
    
    # 连接数据库
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    try:
        # 导入赛段成绩
        import_stage_results(cursor, data)
        
        # 导入领骑衫
        import_jerseys(cursor, data)
        
        # 导入 GC 总成绩
        import_gc(cursor, data)
        
        # 导入 Youth 总成绩
        import_youth(cursor, data)
        
        # 导入 Points 积分榜
        import_points(cursor, data)
        
        # 导入 KOM 积分榜
        import_kom(cursor, data)
        
        # 提交事务
        conn.commit()
        print("\n" + "=" * 60)
        print("✅ 所有数据导入成功！")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ 导入失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
