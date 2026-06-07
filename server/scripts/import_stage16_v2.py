#!/usr/bin/env python3
"""
导入2026年环意第16赛段数据到数据库
使用正确的数据库表结构
"""
import json
import sys
import pymysql
from datetime import datetime
import uuid

# 读取JSON数据
with open('stage-16-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 数据库配置 - 本地开发环境
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

def find_rider_by_slug(cursor, rider_slug):
    """通过slug查找车手"""
    if not rider_slug:
        return None
    cursor.execute("SELECT id FROM riders WHERE rider_slug = %s", (rider_slug,))
    result = cursor.fetchone()
    return result[0] if result else None

def find_rider_by_name(cursor, rider_name):
    """通过名字查找车手"""
    if not rider_name:
        return None
    cursor.execute("SELECT id FROM riders WHERE rider_name = %s", (rider_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def create_rider(cursor, rider_name, rider_slug, nationality):
    """创建新车手"""
    rider_id = str(uuid.uuid4())
    nationality = nationality if nationality and len(nationality) == 2 else 'XX'
    cursor.execute(
        "INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (%s, %s, %s, %s)",
        (rider_id, rider_name, rider_slug, nationality)
    )
    return rider_id

def find_or_create_rider(cursor, rider_name, rider_slug, nationality):
    """查找或创建车手"""
    # 先通过slug查找
    if rider_slug:
        rider_id = find_rider_by_slug(cursor, rider_slug)
        if rider_id:
            return rider_id
    
    # 再通过名字查找
    rider_id = find_rider_by_name(cursor, rider_name)
    if rider_id:
        # 更新slug
        if rider_slug:
            cursor.execute("UPDATE riders SET rider_slug = %s WHERE id = %s", (rider_slug, rider_id))
        return rider_id
    
    # 创建新车手
    return create_rider(cursor, rider_name, rider_slug, nationality)

def find_team_by_name(cursor, team_name):
    """通过名字查找车队"""
    if not team_name:
        return None
    cursor.execute("SELECT id FROM teams WHERE team_name = %s", (team_name,))
    result = cursor.fetchone()
    return result[0] if result else None

def create_team(cursor, team_name):
    """创建新车队"""
    team_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO teams (id, team_name) VALUES (%s, %s)",
        (team_id, team_name)
    )
    return team_id

def find_or_create_team(cursor, team_name):
    """查找或创建车队"""
    if not team_name:
        return None
    
    team_id = find_team_by_name(cursor, team_name)
    if team_id:
        return team_id
    
    return create_team(cursor, team_name)

def main():
    # 验证数据
    results = data.get('results', [])
    jerseys = data.get('jersey_holders', [])
    
    print(f"准备导入:")
    print(f"  - 赛段成绩: {len(results)} 条")
    print(f"  - 领骑衫: {len(jerseys)} 件")
    
    if not results:
        print("错误: 没有赛段成绩数据")
        return
    
    # 连接数据库
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 查找2026男子环意
        cursor.execute("SELECT id FROM races WHERE race_name = 'Giro d\\'Italia' AND start_date = '2026-05-08'")
        race_result = cursor.fetchone()
        
        if not race_result:
            print("错误: 找不到2026年男子环意赛事")
            return
        
        race_id = race_result[0]
        print(f"赛事ID: {race_id}")
        
        # 查找或创建Stage 16
        cursor.execute("SELECT id FROM stages WHERE race_id = %s AND stage_number = %s", (race_id, 16))
        stage_result = cursor.fetchone()
        
        if stage_result:
            stage_id = stage_result[0]
            print(f"更新现有赛段 ID: {stage_id}")
            # 先删除旧数据
            cursor.execute("DELETE FROM stage_results WHERE stage_id = %s", (stage_id,))
            cursor.execute("DELETE FROM jerseys WHERE stage_id = %s", (stage_id,))
            cursor.execute("DELETE FROM general_classification WHERE stage_id = %s", (stage_id,))
        else:
            # 创建新赛段
            stage_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO stages (id, race_id, stage_number, stage_code, stage_name, distance_km, date, stage_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                stage_id,
                race_id,
                16,
                f"giro-2026-s16",
                "Bellinzona - Carì",
                131.0,  # 距离
                "2026-05-27",  # 日期
                "Mountain"
            ))
            print(f"创建新赛段 ID: {stage_id}")
        
        conn.commit()
        
        # 导入赛段成绩
        print(f"\n导入赛段成绩...")
        success_count = 0
        
        for result in results:
            rider_name = result.get('rider', '')
            rider_slug = result.get('rider_id', '')  # PCS的rider_id其实是slug
            nationality = result.get('nationality', '')
            team_name = result.get('team', '')
            
            if not rider_name:
                continue
            
            # 查找或创建车手和车队
            rider_db_id = find_or_create_rider(cursor, rider_name, rider_slug, nationality)
            team_db_id = find_or_create_team(cursor, team_name)
            
            # 解析排名
            rank_pos = int(result['rank']) if result.get('rank', '').isdigit() else None
            
            # 解析时间差
            time_gap = result.get('timelag', '')
            if time_gap == '+0:00' or time_gap == '':
                time_gap = '0:00'
            elif time_gap.startswith('+'):
                time_gap = time_gap[1:]  # 去掉开头的+
            
            # 是否同时到达
            is_same_time = 1 if result.get('stage_time', '') == 's.t.' else 0
            
            # 冲刺积分和爬坡积分
            sprint_points = int(result['pnt_points']) if result.get('pnt_points', '').isdigit() else 0
            # 注意：爬坡积分需要从其他数据源获取，这里暂时设为0
            
            # 是否青年成绩 eligible
            youth_eligible = 1 if result.get('specialty', '').lower() in ['gc', 'climber', 'youth'] else 0
            
            try:
                cursor.execute("""
                    INSERT INTO stage_results 
                    (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap, 
                     is_same_time, sprint_points, mountain_points, youth_eligible)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(uuid.uuid4()),
                    stage_id,
                    rank_pos,
                    rider_db_id,
                    team_db_id,
                    nationality if nationality else None,
                    time_gap,
                    is_same_time,
                    sprint_points,
                    0,  # mountain_points - 需要从其他数据源获取
                    youth_eligible
                ))
                success_count += 1
            except Exception as e:
                print(f"  跳过 {rider_name}: {e}")
                continue
        
        conn.commit()
        print(f"✓ 成功导入 {success_count} 条赛段成绩")
        
        # 导入领骑衫数据
        print(f"\n导入领骑衫数据...")
        
        # 领骑衫颜色映射
        jersey_color_map = {
            'PINK (GC)': 'PINK',
            'PINK2': 'PURPLE',  # 紫衫
            'BLUE2': 'BLUE',     # 蓝衫
            'LIGHT_GRAY': 'WHITE'  # 白衫
        }
        
        jersey_success = 0
        for jersey in jerseys:
            color = jersey.get('color', '')
            rider_name = jersey.get('rider', '')
            team_name = jersey.get('team', '')
            
            if not rider_name or not color:
                continue
            
            # 映射颜色到标准名称
            jersey_type = jersey_color_map.get(color, color)
            
            # 查找车手ID和车队ID
            rider_db_id = find_or_create_rider(cursor, rider_name, '', '')
            team_db_id = find_or_create_team(cursor, team_name)
            
            try:
                cursor.execute("""
                    INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    str(uuid.uuid4()),
                    stage_id,
                    jersey_type,
                    rider_db_id,
                    team_db_id
                ))
                print(f"  ✓ {jersey_type}: {rider_name}")
                jersey_success += 1
            except Exception as e:
                print(f"  ✗ 失败: {jersey_type} - {rider_name}: {e}")
        
        conn.commit()
        print(f"✓ 成功导入 {jersey_success} 件领骑衫")
        
        # 打印导入总结
        print(f"\n✓ 数据导入完成!")
        print(f"  赛段: Stage 16 (Bellinzona - Carì)")
        print(f"  成绩记录: {success_count} 条")
        print(f"  领骑衫: {jersey_success} 件")
        
    except Exception as e:
        conn.rollback()
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    main()
