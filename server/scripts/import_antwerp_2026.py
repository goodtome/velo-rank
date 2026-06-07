#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导入 Antwerp Port Epic 2026 成绩到 stage_results 表"""

import json
import sys
import pymysql
from datetime import datetime
import uuid

# 数据库配置（与 import_stage16_v2.py 一致）
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',
    'database': 'jersey_db',
    'charset': 'utf8mb4'
}

JSON_FILE = 'stage_data.json'

# 默认国籍（新车手未知时）
DEFAULT_NATIONALITY = 'XX'


def get_conn():
    return pymysql.connect(**DB_CONFIG)


def find_race(cursor, race_name, year):
    """查找赛事"""
    cursor.execute(
        "SELECT id FROM races WHERE race_name LIKE %s AND YEAR(start_date) = %s",
        (f"%{race_name}%", year)
    )
    return cursor.fetchone()


def find_stage(cursor, race_id, stage_number):
    """查找赛段"""
    cursor.execute(
        "SELECT id FROM stages WHERE race_id = %s AND stage_number = %s",
        (race_id, stage_number)
    )
    return cursor.fetchone()


def create_stage(cursor, race_id):
    """为单日赛创建赛段（stage_number=1）"""
    stage_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO stages (id, race_id, stage_number, stage_code, stage_name, date, stage_type)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (stage_id, race_id, 1, 'antwerp-port-epic-2026-s1',
         'Antwerp Port Epic 2026', '2026-05-24', 'Classic')
    )
    return stage_id


def find_rider_by_slug(cursor, slug):
    cursor.execute("SELECT id, nationality FROM riders WHERE rider_slug = %s", (slug,))
    return cursor.fetchone()


def find_rider_by_name(cursor, name):
    cursor.execute("SELECT id, nationality FROM riders WHERE rider_name = %s", (name,))
    return cursor.fetchone()


def create_rider(cursor, name, slug, nationality):
    rider_id = str(uuid.uuid4())
    nat = nationality if nationality and len(nationality) == 2 else DEFAULT_NATIONALITY
    cursor.execute(
        "INSERT INTO riders (id, rider_name, rider_slug, nationality) VALUES (%s, %s, %s, %s)",
        (rider_id, name, slug, nat)
    )
    return rider_id


def find_or_create_rider(cursor, name, slug):
    """查找或创建车手，返回 (rider_id, is_new)"""
    if slug:
        row = find_rider_by_slug(cursor, slug)
        if row:
            return row[0], False
    row = find_rider_by_name(cursor, name)
    if row:
        # 更新 slug
        if slug:
            cursor.execute("UPDATE riders SET rider_slug = %s WHERE id = %s", (slug, row[0]))
        return row[0], False
    # 创建
    rid = create_rider(cursor, name, slug, DEFAULT_NATIONALITY)
    return rid, True


def find_team_by_name(cursor, name):
    cursor.execute("SELECT id FROM teams WHERE team_name = %s", (name,))
    return cursor.fetchone()


def create_team(cursor, name):
    tid = str(uuid.uuid4())
    cursor.execute("INSERT INTO teams (id, team_name) VALUES (%s, %s)", (tid, name))
    return tid


def find_or_create_team(cursor, name):
    if not name:
        return None
    row = find_team_by_name(cursor, name)
    if row:
        return row[0]
    return create_team(cursor, name)


def main():
    # 读 JSON
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        results = json.load(f)

    print(f"读取 {len(results)} 条成绩记录")

    conn = get_conn()
    cursor = conn.cursor()

    try:
        # 1. 查找赛事（男子赛）
        cursor.execute(
            "SELECT id FROM races WHERE race_name LIKE %s",
            ('%Antwerp Port Epic / Sels Trophy%',)
        )
        race_row = cursor.fetchone()
        if not race_row:
            print("ERROR: 找不到 Antwerp Port Epic 赛事，请先在 races 表创建")
            return

        race_id = race_row[0]
        print(f"赛事 ID: {race_id}")

        # 2. 查找或创建赛段（单日赛 = stage_number 1）
        stage_row = find_stage(cursor, race_id, 1)
        if stage_row:
            stage_id = stage_row[0]
            print(f"使用现有赛段 ID: {stage_id}")
            # 删除旧成绩
            cursor.execute("DELETE FROM stage_results WHERE stage_id = %s", (stage_id,))
            print("  已删除旧成绩")
        else:
            stage_id = create_stage(cursor, race_id)
            print(f"已创建赛段 ID: {stage_id}")

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
            team_slug = r.get('team_slug', '')
            time_str = r.get('time', '') or ''
            uci = r.get('uci_points') or 0
            pnt = r.get('pnt_points') or 0

            if not rider_name or rank is None:
                skipped += 1
                continue

            # 查找/创建车手
            rider_id, is_new_rider = find_or_create_rider(cursor, rider_name, rider_slug)
            if is_new_rider:
                new_riders += 1

            # 查找/创建车队
            team_id = find_or_create_team(cursor, team_name)
            if team_id and is_new_rider:
                new_teams += 1

            # 处理时间
            time_gap = time_str if time_str else '0:00'
            # 去掉开头的 +（如果有）
            if time_gap.startswith('+'):
                time_gap = time_gap[1:]

            is_same_time = 1 if time_gap == '0:00' else 0

            try:
                cursor.execute(
                    """INSERT INTO stage_results
                       (id, stage_id, rank_pos, rider_id, team_id, time_gap,
                        is_same_time, sprint_points, mountain_points, youth_eligible)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        str(uuid.uuid4()),
                        stage_id,
                        rank,
                        rider_id,
                        team_id,
                        time_gap,
                        is_same_time,
                        pnt or 0,
                        0,  # mountain_points - 本赛事无爬坡积分
                        0   # youth_eligible - 暂不设
                    )
                )
                success += 1
                if success <= 5 or success % 20 == 0:
                    print(f"  ✓ #{rank} {rider_name} ({time_gap})")
            except Exception as e:
                print(f"  ✗ 跳过 #{rank} {rider_name}: {e}")
                skipped += 1
                continue

        conn.commit()
        print(f"\n✓ 成功导入 {success} 条，跳过 {skipped} 条")
        print(f"  新车手: {new_riders} 人，新车队: {new_teams} 个")

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
            print(f"  #{row[0]} rider_id={row[1][:8]}... time={row[2]}")

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
