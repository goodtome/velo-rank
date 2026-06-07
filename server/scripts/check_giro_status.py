import sys, pymysql
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

conn = pymysql.connect(host='127.0.0.1', port=13306, user='root', password='mysql123456', database='jersey_db', charset='utf8mb4')
cur = conn.cursor()

cur.execute("SELECT id, stage_number FROM stages WHERE race_id = 'e597183f-8ea4-4fb0-a469-661c57c5a958' ORDER BY stage_number")
stages = cur.fetchall()

print("环意 2026 各赛段 time_gap 分布：")
print(f"{'赛段':>4} {'总数':>6} {'有值':>6} {'DNF':>6} {'DNS':>6} {'空值':>6}")
print("-" * 50)
for stage_id, stage_num in stages:
    cur.execute("SELECT COUNT(*) FROM stage_results WHERE stage_id = %s", (stage_id,))
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM stage_results WHERE stage_id = %s AND time_gap IS NOT NULL AND time_gap != ''", (stage_id,))
    has_value = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM stage_results WHERE stage_id = %s AND time_gap = 'DNF'", (stage_id,))
    dnf = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM stage_results WHERE stage_id = %s AND time_gap = 'DNS'", (stage_id,))
    dns = cur.fetchone()[0]
    empty = total - has_value
    print(f"{stage_num:>4} {total:>6} {has_value:>6} {dnf:>6} {dns:>6} {empty:>6}")

cur.close()
conn.close()
print("\n完成！")
