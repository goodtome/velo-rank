import json
import pymysql
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

def parse_time_gap(time_str):
    """解析时间差字符串，确保有+前缀"""
    if not time_str or time_str == "0:00":
        return "0:00"
    
    # 去掉空白
    time_str = time_str.strip()
    
    # 如果已经有+或-前缀，直接返回
    if time_str.startswith(('+', '-')):
        return time_str
    
    # 如果是数字开头（如 "4:03"），加上+前缀
    if re.match(r'^\d', time_str):
        return '+' + time_str
    
    return time_str

def main():
    # 读取GC数据
    try:
        with open('stage-16-gc-v4.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("错误: 找不到 stage-16-gc-v4.json，请先运行 fetch_pcs_stage.py")
        return
    
    gc_data = data.get('gc', [])
    print(f"准备导入GC数据: {len(gc_data)} 条")
    
    if not gc_data:
        print("错误: 没有GC数据")
        return
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 查找2026男子环意（使用参数化查询避免单引号问题）
        cursor.execute("SELECT id FROM races WHERE race_name = %s AND start_date = %s", ('Giro d\'Italia', '2026-05-08'))
        race_result = cursor.fetchone()
        
        if not race_result:
            print("错误: 找不到2026年男子环意赛事")
            return
        
        race_id = race_result[0]
        print(f"赛事ID: {race_id}")
        
        # 查找Stage 16
        cursor.execute("SELECT id FROM stages WHERE race_id = %s AND stage_number = %s", (race_id, 16))
        stage_result = cursor.fetchone()
        
        if not stage_result:
            print("错误: 找不到Stage 16")
            return
        
        stage_id = stage_result[0]
        print(f"赛段ID: {stage_id}")
        
        # 先删除旧的GC数据
        cursor.execute("DELETE FROM general_classification WHERE stage_id = %s", (stage_id,))
        print(f"已删除旧的GC数据")
        
        # 获取第1名的总时间（用于计算时间差）
        first_total_time = None
        for gc in gc_data:
            if gc.get('rank') == '1':
                total_time_str = gc.get('total_time', '')
                if total_time_str:
                    first_total_time = total_time_str
                    print(f"第1名总时间: {first_total_time}")
                break
        
        # 导入新的GC数据
        imported = 0
        skipped = 0
        
        for gc in gc_data:
            rank = int(gc.get('rank', 0))
            rider_name = gc.get('rider', '')
            team_name = gc.get('team', '')
            total_time_str = gc.get('total_time', '')  # 可能是总时间或时间差
            
            if not rider_name or not rank:
                skipped += 1
                continue
            
            # 查找rider_id
            cursor.execute("SELECT id FROM riders WHERE LOWER(rider_name) = LOWER(%s)", (rider_name,))
            rider_result = cursor.fetchone()
            
            if not rider_result:
                # 尝试用rider_id (slug)查找
                rider_slug = gc.get('rider_id', '')
                if rider_slug:
                    cursor.execute("SELECT id FROM riders WHERE rider_slug = %s", (rider_slug,))
                    rider_result = cursor.fetchone()
                
                if not rider_result:
                    print(f"  跳过: 找不到车手 {rider_name} (rank {rank})")
                    skipped += 1
                    continue
            
            rider_id = rider_result[0]
            
            # 查找team_id
            team_id = None
            if team_name:
                cursor.execute("SELECT id FROM teams WHERE LOWER(team_name) = LOWER(%s) LIMIT 1", (team_name,))
                team_result = cursor.fetchone()
                if team_result:
                    team_id = team_result[0]
            
            # 处理时间差
            time_gap = ""
            if rank == 1:
                time_gap = "0:00"
            else:
                # total_time字段实际上是时间差（如 "4:03"）
                time_gap = parse_time_gap(total_time_str)
            
            # 获取国籍
            nationality = gc.get('nationality', 'UN')
            if not nationality:
                nationality = 'UN'
            
            # 插入GC数据（提供UUID作为id，以及nationality）
            try:
                cursor.execute("""
                    INSERT INTO general_classification (id, stage_id, rider_id, team_id, `rank`, nationality, time_gap)
                    VALUES (UUID(), %s, %s, %s, %s, %s, %s)
                """, (stage_id, rider_id, team_id, rank, nationality, time_gap))
                imported += 1
            except Exception as e:
                print(f"  错误插入 rank {rank}: {e}")
                skipped += 1
        
        conn.commit()
        print(f"\n✓ GC数据导入完成:")
        print(f"  成功: {imported} 条")
        print(f"  跳过: {skipped} 条")
        
        # 验证导入的数据
        cursor.execute("""
            SELECT gc.rank, r.rider_name, gc.time_gap
            FROM general_classification gc
            JOIN stages s ON gc.stage_id = s.id
            LEFT JOIN riders r ON gc.rider_id = r.id
            WHERE s.race_id = %s AND s.stage_number = %s
            ORDER BY gc.rank
            LIMIT 5
        """, (race_id, 16))
        
        print(f"\n=== 验证：GC前5名 ===")
        for row in cursor.fetchall():
            print(f"{row[0]}: {row[1]} | 时间差: {row[2]}")
        
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
