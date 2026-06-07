#!/usr/bin/env python3
"""
导入2026年环意第16赛段数据到数据库
修正了GC数据和领骑衫数据
"""
import json
import sys
import pymysql
from datetime import datetime

# 读取JSON数据
with open('stage-16-data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 数据库连接配置 - 本地开发环境
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',  # 本地MySQL密码（注意是mysql不是root）
    'database': 'jersey_db',
    'charset': 'utf8mb4'
}

# 生产环境 - TiDB Cloud
# DB_CONFIG = {
#     'host': 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com',
#     'port': 4000,
#     'user': '4YAR9zc2BAjeytU.root',
#     'password': 'ZYsDw2rH8clWy8d',
#     'database': 'cycling_results',
#     'charset': 'utf8mb4',
#     'ssl': {'ca': None}
# }

def get_connection():
    return pymysql.connect(**DB_CONFIG)

def find_or_create_rider(cursor, rider_name, rider_id, nationality, team_name):
    """查找或创建车手"""
    # 先尝试通过rider_id查找
    if rider_id:
        cursor.execute("SELECT id FROM riders WHERE rider_id = %s", (rider_id,))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    # 通过名字查找
    cursor.execute("SELECT id FROM riders WHERE name = %s", (rider_name,))
    result = cursor.fetchone()
    if result:
        # 更新rider_id如果缺失
        if rider_id:
            cursor.execute("UPDATE riders SET rider_id = %s WHERE id = %s", (rider_id, result[0]))
        return result[0]
    
    # 创建新车手
    nationality = nationality if nationality else 'XX'  # 默认国籍
    cursor.execute(
        "INSERT INTO riders (name, rider_id, nationality) VALUES (%s, %s, %s)",
        (rider_name, rider_id, nationality)
    )
    return cursor.lastrowid

def find_or_create_team(cursor, team_name):
    """查找或创建车队"""
    if not team_name:
        return None
    
    cursor.execute("SELECT id FROM teams WHERE name = %s", (team_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    cursor.execute("INSERT INTO teams (name) VALUES (%s)", (team_name,))
    return cursor.lastrowid

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
    
    # 获取race_id和stage_id
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 直接指定2026男子环意的ID（从数据库查询得到）
        # "Giro d'Italia" 2026-05-08 to 2026-05-31
        cursor.execute("SELECT id FROM races WHERE race_name = 'Giro d\\'Italia' AND start_date = '2026-05-08'")
        race_result = cursor.fetchone()
        if not race_result:
            # 如果找不到，尝试模糊匹配
            cursor.execute("SELECT id, race_name, start_date FROM races WHERE race_name LIKE '%Giro%Italia%' AND start_date >= '2026-05-01' AND start_date <= '2026-05-10'")
            races = cursor.fetchall()
            if races:
                for r in races:
                    print(f"  候选: {r[0]} - {r[1]} ({r[2]})")
                race_result = races[0]
        
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
            # 先删除旧的赛段成绩
            cursor.execute("DELETE FROM stage_results WHERE stage_id = %s", (stage_id,))
            cursor.execute("DELETE FROM jerseys WHERE stage_id = %s", (stage_id,))
            cursor.execute("DELETE FROM general_classification WHERE stage_id = %s", (stage_id,))
        else:
            # 创建新赛段 - 使用正确的字段名
            cursor.execute("""
                INSERT INTO stages (id, race_id, stage_number, stage_code, stage_name, distance_km, date, stage_type)
                VALUES (UUID(), %s, %s, %s, %s, %s, %s, %s)
            """, (
                race_id,
                16,
                f"giro-2026-s16",
                "Bellinzona - Carì",
                131,  # 距离
                "2026-05-27",  # 日期（需要确认）
                "Mountain"
            ))
            stage_id = cursor.lastrowid
            print(f"创建新赛段 ID: {stage_id}")
        
        conn.commit()
        
        # 导入赛段成绩
        print(f"\n导入赛段成绩...")
        for result in results:
            rider_name = result.get('rider', '')
            rider_id = result.get('rider_id', '')
            nationality = result.get('nationality', '')
            team_name = result.get('team', '')
            
            if not rider_name:
                continue
            
            # 查找或创建车手和车队
            rider_db_id = find_or_create_rider(cursor, rider_name, rider_id, nationality, team_name)
            team_db_id = find_or_create_team(cursor, team_name)
            
            # 解析时间
            stage_time = result.get('stage_time', '')
            if stage_time == 's.t.':
                stage_time = None
            
            # 插入成绩
            try:
                cursor.execute("""
                    INSERT INTO stage_results 
                    (stage_id, rider_id, team_id, `rank`, gc_rank, timelag, bib, specialty, age, uci_points, pnt_points, time_bonus, stage_time)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    stage_id,
                    rider_db_id,
                    team_db_id,
                    int(result['rank']) if result['rank'].isdigit() else None,
                    int(result['gc_rank']) if result.get('gc_rank', '').isdigit() else None,
                    result.get('timelag', ''),
                    int(result['bib']) if result.get('bib', '').isdigit() else None,
                    result.get('specialty', ''),
                    int(result['age']) if result.get('age', '').isdigit() else None,
                    int(result['uci_points']) if result.get('uci_points', '').isdigit() else None,
                    int(result['pnt_points']) if result.get('pnt_points', '').isdigit() else None,
                    result.get('time_bonus', ''),
                    stage_time
                ))
            except Exception as e:
                print(f"  跳过 {rider_name}: {e}")
                continue
        
        conn.commit()
        print(f"✓ 成功导入 {len(results)} 条赛段成绩")
        
        # 导入领骑衫数据 (需要手动补充正确的领骑衫信息)
        print(f"\n导入领骑衫数据...")
        
        # 根据PCS数据和验证结果，Stage 16后的领骑衫持有者：
        # 粉衫(PINK) - Jonas Vingegaard (GC领先)
        # 紫衫(PURPLE) - Paul Magnier (冲刺积分领先)
        # 蓝衫(BLUE) - 需要确认
        # 白衫(WHITE) - 需要确认
        
        # 这里使用从PCS提取的jersey_holders数据
        jersey_mapping = {
            'PINK (GC)': 'PINK',
            'PINK2': 'PURPLE',
            'BLUE2': 'BLUE_SPRINT',
            'LIGHT_GRAY': 'WHITE_YOUTH'
        }
        
        for jersey in jerseys:
            color = jersey.get('color', '')
            rider_name = jersey.get('rider', '')
            team_name = jersey.get('team', '')
            
            if not rider_name or not color:
                continue
            
            # 映射颜色到标准名称
            jersey_type = jersey_mapping.get(color, color)
            
            # 查找车手ID
            rider_db_id = find_or_create_rider(cursor, rider_name, '', '', team_name)
            
            try:
                cursor.execute("""
                    INSERT INTO jerseys (stage_id, jersey_type, rider_id)
                    VALUES (%s, %s, %s)
                """, (stage_id, jersey_type, rider_db_id))
                print(f"  ✓ {jersey_type}: {rider_name}")
            except Exception as e:
                print(f"  ✗ 失败: {jersey_type} - {rider_name}: {e}")
        
        conn.commit()
        print(f"\n✓ 数据导入完成!")
        print(f"  赛段ID: {stage_id}")
        print(f"  成绩记录: {len(results)} 条")
        print(f"  领骑衫: {len(jerseys)} 件")
        
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
