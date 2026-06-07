#!/usr/bin/env python3
"""检查环意 Giro d'Italia 各赛段 DNF 数据情况"""
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import pymysql

DB_CONFIG = dict(
    host='127.0.0.1', port=13306,
    user='root', password='mysql123456',
    database='jersey_db', charset='utf8mb4'
)

conn = pymysql.connect(**DB_CONFIG)
cur = conn.cursor()

# 找男子环意 2026
cur.execute(
    "SELECT id, race_name, start_date, end_date "
    "FROM races "
    "WHERE race_name = 'Giro d''Italia'"
)
giro = cur.fetchone()

if not giro:
    print("找不到男子环意赛事")
    cur.close()
    conn.close()
    sys.exit(1)

giro_id = giro[0]
print(f"找到赛事: {giro[1]}")
print(f"  ID: {giro_id}")
print(f"  日期: {giro[2]} ~ {giro[3]}")
print()

# 查各赛段数据分布
sql = """
    SELECT
        s.stage_number,
        COUNT(*) as total,
        SUM(CASE WHEN sr.time_gap IS NULL OR sr.time_gap = '' THEN 1 ELSE 0 END) as no_time,
        SUM(CASE WHEN sr.time_gap = 'DNF' THEN 1 ELSE 0 END) as dnf,
        SUM(CASE WHEN sr.time_gap = 'DNS' THEN 1 ELSE 0 END) as dns
    FROM stages s
    LEFT JOIN stage_results sr ON s.id = sr.stage_id
    WHERE s.race_id = %s
    GROUP BY s.stage_number
    ORDER BY s.stage_number
"""
cur.execute(sql, (giro_id,))
rows = cur.fetchall()

print(f"{'赛段':>4} {'总数':>6} {'无时间':>8} {'DNF':>6} {'DNS':>6}")
print("-" * 40)
for row in rows:
    print(f"{row[0]:>4} {row[1]:>6} {row[2]:>8} {row[3]:>6} {row[4]:>6}")

# 检查哪些赛段完全没有数据
cur.execute(
    "SELECT stage_number, id FROM stages "
    "WHERE race_id = %s "
    "ORDER BY stage_number",
    (giro_id,)
)
all_stages = cur.fetchall()
print()
print("各赛段数据状态:")
for stage_num, stage_id in all_stages:
    cur.execute(
        "SELECT COUNT(*) FROM stage_results WHERE stage_id = %s",
        (stage_id,)
    )
    cnt = cur.fetchone()[0]
    status = "有数据" if cnt > 0 else "无数据"
    print(f"  Stage {stage_num}: {status} ({cnt} 条)")

cur.close()
conn.close()
print("\n完成！")
