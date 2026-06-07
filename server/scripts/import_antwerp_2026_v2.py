#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导入 Antwerp Port Epic 2026 成绩到 stage_results 表
修正：所有 NOT NULL 字段都必须提供值
"""

import json
import sys
import pymysql
import uuid

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

JSON_FILE = 'stage_data.json'
DEFAULT_NATIONALITY = 'XX'


def get_conn():
    return pymysql.connect(**DB_CONFIG)


def find_race(cursor):
    """查找 Antwerp Port Epic / Sels Trophy 2026"""
    cursor.execute(
        "SELECT id, race_name, start_date FROM races WHERE race_name LIKE %s",
        ('%Sels Trophy%',)
    )
    return cursor.fetchone()


def find_stage(cursor, race_id):
    """查找或返回赛段（单日赛 = stage_number 1）"""
    cursor.execute(
        "SELECT id FROM stages WHERE race_id = %s AND stage_number = %s",
        (race_id, 1)
    )
    return cursor.fetchone()


def create_stage(cursor, race_id):
    """为单日赛创建赛段"""
    stage_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO stages (id, race_id, stage_number, stage_code, stage_name, date, stage_type)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (stage_id, race_id, 1,
         'antwerp-port-epic-2026-s1',
         'Antwerp Port Epic / Sels Trophy 2026',
         '2026-05-25',
         'Classic')
    )
    return stage_id


def find_rider_by_slug(cursor, slug):
    if not slug:
        return None, None
    cursor.execute("SELECT id, nationality FROM riders WHERE rider_slug = %s", (slug,))
    row = cursor.fetchone()
    return (row[0], row[1]) if row else (None, None)


def find_rider_by_name(cursor, name):
    if not name:
        return None, None
    cursor.execute("SELECT id, nationality FROM riders WHERE rider_name = %s", (name,))
    row = cursor.fetchone()
    return (row[0], row[1]) if row else (None, None)


def create_rider(cursor, name, slug):
    rider_id = str(uuid.uuid4())
    nat = DEFAULT_NATIONALITY
    cursor.execute(
        "INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (%s, %s, %s, %s)",
        (rider_id, name, slug, nat)
    )
    return rider_id, nat


def get_or_create_rider(cursor, name, slug):
    """返回 (rider_id, nationality)"""
    if slug:
        rid, nat = find_rider_by_slug(cursor, slug)
        if rid:
            return rid, nat
    rid, nat = find_rider_by_name(cursor, name)
    if rid:
        if slug and not nat:
            cursor.execute("UPDATE riders SET rider_slug = %s WHERE id = %s", (slug, rid))
        return rid, nat
    return create_rider(cursor, name, slug)


def find_team_by_name(cursor, name):
    if not name:
        return None
    cursor.execute("SELECT id FROM teams WHERE team_name = %s", (name,))
    row = cursor.fetchone()
    return row[0] if row else None


def create_team(cursor, name):
    tid = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO teams (id, team_name) VALUES (%s, %s)",
        (tid, name)
    )
    return tid


def get_or_create_team(cursor, name):
    if not name:
        return None
    tid = find_team_by_name(cursor, name)
    if tid:
        return tid
    return create_team(cursor, name)


def main():
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        results = json.load(f)

    print(f"读取 {len(results)} 条成绩记录")

    conn = get_conn()
    cursor = conn.cursor()

    try:
        # 1. 查找赛事
        race_row = find_race(cursor)
        if not race_row:
            print("ERROR: 找不到 Antwerp Port Epic / Sels Trophy 2026 赛事")
            print("请在 races 表中先创建该赛事")
            return

        race_id = race_row[0]
        print(f"赛事: {race_row[1]} (id={race_id[:8]}...)")

        # 2. 查找或创建赛段
        stage_row = find_stage(cursor, race_id)
        if stage_row:
            stage_id = stage_row[0]
            print(f"使用现有赛段: {stage_id[:8]}...")
            # 删除旧成绩
            cursor.execute("DELETE FROM stage_results WHERE stage_id = %s", (stage_id,))
            print("  已删除旧成绩")
        else:
            stage_id = create_stage(cursor, race_id)
            print(f"已创建赛段: {stage_id[:8]}...")

        conn.commit()

        # 3. 导入成绩
        print(f"\n导入 {len(results)} 条成绩...")
        success = 0
        skipped = 0
        new_riders = 0
        new_teams = 0

        for r in results:
            rank = r.get('rank')
            rider_name = r.get('rider_name', '')
            rider_slug = r.get('rider_slug', '')
            team_name = r.get('team_name', '')
            time_str = r.get('time', '') or ''
            pnt = r.get('pnt_points') or 0

            if not rider_name or rank is None:
                skipped += 1
                continue

            # 查找/创建车手 → (rider_id, nationality)
            rid, nat = get_or_create_rider(cursor, rider_name, rider_slug)
            if nat == DEFAULT_NATIONALITY:
                new_riders += 1

            # 查找/创建车队（team_id NOT NULL）
            tid = get_or_create_team(cursor, team_name)
            if tid is None:
                # 单车手无车队
                print(f"  WARN: 车手 {rider_name} 无车队信息，跳过")
                skipped += 1
                continue

            # 处理时间
            time_gap = time_str if time_str else '0:00'
            if time_gap.startswith('+'):
                time_gap = time_gap[1:]

            is_same_time = 1 if time_gap == '0:00' else 0

            try:
                cursor.execute(
                    """INSERT INTO stage_results
                       (id, stage_id, rank_pos, rider_id, team_id, nationality, time_gap,
                        is_same_time, sprint_points, mountain_points, youth_eligible)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        str(uuid.uuid4()),
                        stage_id,
                        rank,
                        rid,
                        tid,
                        nat or DEFAULT_NATIONALITY,
                        time_gap,
                        is_same_time,
                        pnt or 0,
                        0,   # mountain_points
                        0    # youth_eligible
                    )
                )
                success += 1
                if success <= 5 or success % 20 == 0:
                    print(f"  ok #{rank} {rider_name} ({time_gap})")
            except Exception as e:
                print(f"  FAIL #{rank} {rider_name}: {e}")
                skipped += 1
                continue

        conn.commit()
        print(f"\nOK 成功导入 {success} 条，跳过 {skipped} 条")
        print(f"  新车手: {new_riders} 人")

        # 4. 验证
        cursor.execute("SELECT COUNT(*) FROM stage_results WHERE stage_id = %s", (stage_id,))
        count = cursor.fetchone()[0]
        print(f"\n验证: stage_results 共 {count} 条记录")

        cursor.execute(
            "SELECT rank_pos, rider_id, time_gap FROM stage_results WHERE stage_id = %s ORDER BY rank_pos LIMIT 5",
            (stage_id,)
        )
        print("前5名:")
        for row in cursor.fetchall():
            print(f"  #{row[0]} rider={row[1][:8]}... gap={row[2]}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    main()
