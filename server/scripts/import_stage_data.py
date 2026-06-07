#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
完整导入赛段数据到数据库
读取 fetch_pcs_stage.py 生成的JSON文件，导入所有数据：
- 赛段成绩 (stage_results)
- 总成绩 (general_classification)
- 冲刺积分 (points_classification)
- 爬坡积分 (mountains_classification)
- 青年成绩 (youth_classification)
- 领骑衫 (jerseys)
"""

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

def find_team_id(cursor, team_name):
    """根据车队名查找team_id - 支持模糊匹配"""
    if not team_name:
        return None
    
    # 0. 精确匹配
    cursor.execute("SELECT id FROM teams WHERE team_name = %s", (team_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 1. 标准化名称：去掉 " - " 及之后的部分，去掉 "(" 及之后的部分
    clean_name = team_name.split(' - ')[0].split('(')[0].strip()
    
    # 2. 模糊匹配（标准化后）
    # 尝试：数据库中的 team_name 包含 clean_name 的主要部分
    keywords = clean_name.split()
    if len(keywords) >= 2:
        # 使用第一个和最后一个关键词
        pattern = f'%{keywords[0]}%{keywords[-1]}%'
        cursor.execute("SELECT id, team_name FROM teams WHERE team_name LIKE %s LIMIT 5", (pattern,))
    else:
        cursor.execute("SELECT id, team_name FROM teams WHERE team_name LIKE %s LIMIT 5", (f'%{clean_name}%',))
    
    results = cursor.fetchall()
    if results:
        # 如果只有一个结果，返回
        if len(results) == 1:
            return results[0][0]
        
        # 多个结果：选择包含最多关键词的
        best_match = None
        max_score = 0
        
        for team_id, db_team_name in results:
            # 简单评分：统计 clean_name 中的词在 db_team_name 中出现的次数
            score = 0
            for keyword in keywords:
                if keyword.lower() in db_team_name.lower():
                    score += 1
            
            if score > max_score:
                max_score = score
                best_match = team_id
        
        if best_match and max_score >= len(keywords) / 2:
            return best_match
    
    # 3. 模糊匹配（去掉可能的后缀，如 " (WTW)"）
    clean_name2 = team_name.split(' (')[0].strip()
    if clean_name2 != clean_name:
        cursor.execute("SELECT id FROM teams WHERE team_name LIKE %s LIMIT 1", (f'{clean_name2}%',))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    # 4. 匹配 team_name_zh（中文名）
    cursor.execute("SELECT id FROM teams WHERE team_name_zh = %s", (team_name,))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    # 5. 模糊匹配 team_name_zh
    cursor.execute("SELECT id FROM teams WHERE team_name_zh LIKE %s LIMIT 1", (f'%{clean_name}%',))
    result = cursor.fetchone()
    if result:
        return result[0]
    
    return None

def delete_stage_data(cursor, stage_id):
    """删除赛段的所有现有数据"""
    tables = [
        'stage_results',
        'general_classification',
        'points_classification',
        'mountains_classification',
        'youth_classification',
        'jerseys'
    ]
    
    for table in tables:
        cursor.execute(f"DELETE FROM {table} WHERE stage_id = %s", (stage_id,))
        print(f"  已删除 {table} 中现有数据")
    
    print()

def import_stage_results(cursor, stage_id, results):
    """导入赛段成绩到 stage_results 表"""
    print(f"导入赛段成绩: {len(results)} 条")
    inserted = 0
    skipped = 0
    
    import uuid
    
    for result in results:
        rank = int(result.get('rank', 0))
        rider_name = result.get('rider', '')
        team_name = result.get('team', '')
        time_gap = result.get('stage_time', '')
        nationality = result.get('nationality', '')
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, result.get('rider_id', ''))
        team_id = find_team_id(cursor, team_name)
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        if not team_id:
            print(f"  跳过: 找不到车队 {team_name}")
            skipped += 1
            continue
        
        # 处理 time_gap 格式
        if time_gap == 's.t.' or time_gap == '':
            time_gap = '+ 0:00'
        elif not time_gap.startswith('+'):
            time_gap = f'+ {time_gap}'
        
        try:
            record_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO stage_results (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (record_id, stage_id, rank, rider_id, team_id, nationality, time_gap))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入成绩失败: {e}")
            skipped += 1
    
    print(f"  [OK] 成功: {inserted} 条, 跳过: {skipped} 条\n")
    return inserted

def import_gc(cursor, stage_id, gc_data):
    """导入总成绩到 general_classification 表"""
    print(f"导入总成绩(GC): {len(gc_data)} 条")
    inserted = 0
    skipped = 0
    
    import uuid
    
    for item in gc_data:
        rank = int(item.get('rank', 0))
        rider_name = item.get('rider', '')
        time_gap = item.get('time_gap', '0:00')
        total_time = item.get('total_time', '')
        nationality = item.get('nationality', 'UN')
        team_name = item.get('team', '')
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, item.get('rider_id', ''))
        team_id = find_team_id(cursor, team_name) if team_name else None
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            record_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO general_classification (id, stage_id, rider_id, team_id, nationality, `rank`, total_time, time_gap)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (record_id, stage_id, rider_id, team_id, nationality, rank, total_time, time_gap))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入GC数据失败: {e}")
            skipped += 1
    
    print(f"  [OK] 成功: {inserted} 条, 跳过: {skipped} 条\n")
    return inserted

def import_points(cursor, stage_id, points_data):
    """导入冲刺积分到 points_classification 表"""
    print(f"导入冲刺积分: {len(points_data)} 条")
    inserted = 0
    skipped = 0
    
    import uuid
    
    for item in points_data:
        rank = int(item.get('rank', 0))
        rider_name = item.get('rider', '')
        points_str = item.get('points', '0')
        
        # 正确处理 points 字段（可能是数字字符串或空）
        try:
            points = int(points_str)
        except (ValueError, TypeError):
            points = 0
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, item.get('rider_id', ''))
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            # 不插入 id 字段，让它自增
            cursor.execute("""
                INSERT INTO points_classification (stage_id, rider_id, `rank`, points)
                VALUES (%s, %s, %s, %s)
            """, (stage_id, rider_id, rank, points))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入积分数据失败: {e}")
            skipped += 1
    
    print(f"  [OK] 成功: {inserted} 条, 跳过: {skipped} 条\n")
    return inserted

def import_kom(cursor, stage_id, kom_data):
    """导入爬坡积分到 mountains_classification 表"""
    print(f"导入爬坡积分: {len(kom_data)} 条")
    inserted = 0
    skipped = 0
    
    import uuid
    
    for item in kom_data:
        rank = int(item.get('rank', 0))
        rider_name = item.get('rider', '')
        
        # 正确处理 points 字段（可能是数字字符串或空）
        points_str = item.get('points', '0')
        try:
            points = int(points_str)
        except (ValueError, TypeError):
            points = 0
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, item.get('rider_id', ''))
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            # 不插入 id 字段，让它自增
            cursor.execute("""
                INSERT INTO mountains_classification (stage_id, rider_id, `rank`, points)
                VALUES (%s, %s, %s, %s)
            """, (stage_id, rider_id, rank, points))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入KOM数据失败: {e}")
            skipped += 1
    
    print(f"  [OK] 成功: {inserted} 条, 跳过: {skipped} 条\n")
    return inserted

def import_youth(cursor, stage_id, youth_data):
    """导入青年成绩到 youth_classification 表"""
    print(f"导入青年成绩: {len(youth_data)} 条")
    inserted = 0
    skipped = 0
    
    import uuid
    
    for item in youth_data:
        rank = int(item.get('rank', 0))
        rider_name = item.get('rider', '')
        time_gap = item.get('time_gap', '0:00')
        total_time = item.get('total_time', '')
        
        if not rider_name or not rank:
            skipped += 1
            continue
        
        rider_id = find_rider_id(cursor, rider_name, item.get('rider_id', ''))
        
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
            print(f"  错误: 插入青年成绩失败: {e}")
            skipped += 1
    
    print(f"  [OK] 成功: {inserted} 条, 跳过: {skipped} 条\n")
    return inserted

def import_jerseys(cursor, stage_id, jersey_holders):
    """导入领骑衫到 jerseys 表"""
    print(f"导入领骑衫: {len(jersey_holders)} 条")
    inserted = 0
    skipped = 0
    
    import uuid
    
    # 颜色到领骑衫类型的映射
    color_map = {
        'PINK': 'PINK',
        'PURPLE': 'PURPLE',
        'BLUE': 'BLUE_SPRINT',
        'WHITE': 'WHITE_YOUTH',
        'YELLOW': 'YELLOW',
        'GREEN': 'GREEN',
        'RED': 'RED_POLKADOT',
    }
    
    for jersey in jersey_holders:
        color = jersey.get('color', '')
        rider_name = jersey.get('rider', '')
        team_name = jersey.get('team', '')
        
        if not rider_name:
            skipped += 1
            continue
        
        # 判断领骑衫类型
        jersey_type = 'PINK'  # 默认粉衫
        for key, value in color_map.items():
            if key in color.upper():
                jersey_type = value
                break
        
        rider_id = find_rider_id(cursor, rider_name, jersey.get('rider_id', ''))
        team_id = find_team_id(cursor, team_name)
        
        if not rider_id:
            print(f"  跳过: 找不到车手 {rider_name}")
            skipped += 1
            continue
        
        try:
            record_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO jerseys (id, stage_id, jersey_type, rider_id, team_id)
                VALUES (%s, %s, %s, %s, %s)
            """, (record_id, stage_id, jersey_type, rider_id, team_id))
            inserted += 1
        except Exception as e:
            print(f"  错误: 插入领骑衫失败: {e}")
            skipped += 1
    
    print(f"  [OK] 成功: {inserted} 条, 跳过: {skipped} 条\n")
    return inserted

def main():
    if len(sys.argv) < 2:
        print("用法: python import_stage_data.py <json_file>")
        print("示例: python import_stage_data.py stage_data.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    if not Path(json_file).exists():
        print(f"错误: 找不到文件 {json_file}")
        sys.exit(1)
    
    # 读取JSON文件
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"读取JSON文件: {json_file}")
    print(f"  URL: {data.get('url', '')}")
    print(f"  成绩数: {len(data.get('results', []))}")
    print(f"  领骑衫数: {len(data.get('jersey_holders', []))}")
    print(f"  GC数: {len(data.get('gc', []))}")
    print(f"  Points数: {len(data.get('points', []))}")
    print(f"  KOM数: {len(data.get('kom', []))}")
    print(f"  Youth数: {len(data.get('youth', []))}\n")
    
    # 连接数据库
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 查找 stage_id - 通用方法：通过 stage_code 查找
        url = data.get('url', '')
        import re
        
        # 从URL提取 stage_code（如 "stage-1", "stage-2"）
        stage_match = re.search(r'stage-(\d+)', url)
        if not stage_match:
            print(f"错误: 无法从URL中提取赛段信息: {url}")
            sys.exit(1)
        
        stage_code = f'stage-{stage_match.group(1)}'
        
        # 直接通过 stage_code 查找（最可靠的方法）
        cursor.execute("SELECT id FROM stages WHERE stage_code = %s", (stage_code,))
        result = cursor.fetchone()
        
        if not result:
            print(f"错误: 找不到赛段 (stage_code='{stage_code}')")
            sys.exit(1)
        
        stage_id = result[0]
        print(f"找到赛段ID: {stage_id}\n")
        
        # 删除现有数据
        print("=== 删除现有数据 ===")
        delete_stage_data(cursor, stage_id)
        
        # 导入数据
        print("=== 导入新数据 ===")
        
        # 1. 赛段成绩
        if data.get('results'):
            import_stage_results(cursor, stage_id, data['results'])
        
        # 2. 总成绩(GC)
        if data.get('gc'):
            import_gc(cursor, stage_id, data['gc'])
        
        # 3. 冲刺积分
        if data.get('points'):
            import_points(cursor, stage_id, data['points'])
        
        # 4. 爬坡积分
        if data.get('kom'):
            import_kom(cursor, stage_id, data['kom'])
        
        # 5. 青年成绩
        if data.get('youth'):
            import_youth(cursor, stage_id, data['youth'])
        
        # 6. 领骑衫
        if data.get('jersey_holders'):
            import_jerseys(cursor, stage_id, data['jersey_holders'])
        
        # 提交事务
        conn.commit()
        
        print("="*50)
        print("[OK] 所有数据导入完成!")
        print("="*50)
        
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
