# -*- coding: utf-8 -*-
"""Sync local MySQL stages + results → production TiDB"""
import pymysql, sys
sys.stdout.reconfigure(encoding='utf-8')

LOCAL = {"host":"127.0.0.1","port":13306,"user":"root","password":"mysql123456","database":"jersey_db","charset":"utf8mb4"}
PROD = {"host":"gateway01.ap-northeast-1.prod.aws.tidbcloud.com","port":4000,"user":"2A7GiKTCf4sRJLw.root","password":"JkDXt0GyOnhMIagc","database":"jersey_db","charset":"utf8mb4","ssl":{"ssl":{"fake":True}}}

STAGE_COLS = ["id","race_id","stage_number","stage_name","stage_type","date","distance_km","elevation_m","start_city","finish_city","stage_code"]

TABLES = {
    'stage_results': ["id","stage_id","rank_pos","rider_id","team_id","nationality","time_gap","is_same_time","sprint_points","mountain_points","youth_eligible","jersey_earned"],
    'general_classification': ["id","stage_id","`rank`","rider_id","team_id","nationality","total_time","time_gap"],
    'points_classification': ["id","stage_id","rider_id","`rank`","points","jersey_type"],
    'mountains_classification': ["id","stage_id","rider_id","`rank`","points","jersey_type"],
    'youth_classification': ["id","stage_id","rider_id","`rank`","time","time_gap","jersey_type"],
}

def main():
    local = pymysql.connect(**LOCAL)
    prod = pymysql.connect(**PROD)
    lc = local.cursor(pymysql.cursors.DictCursor)
    pc = prod.cursor(pymysql.cursors.DictCursor)

    # 1. Build stage_code mapping
    print("=== Building stage mapping ===")
    lc.execute("SELECT id, stage_code FROM stages")
    local_sid_by_code = {r['stage_code']: r['id'] for r in lc.fetchall()}
    pc.execute("SELECT id, stage_code FROM stages")
    prod_sid_by_code = {r['stage_code']: r['id'] for r in pc.fetchall()}
    prod_existing_ids = set(prod_sid_by_code.values())

    # Map local stage_id → prod stage_id
    lid_to_pid = {}
    new_stage_codes = []
    for scode, lid in local_sid_by_code.items():
        if scode in prod_sid_by_code:
            lid_to_pid[lid] = prod_sid_by_code[scode]
        else:
            new_stage_codes.append(scode)

    print(f"Stage mapping: {len(lid_to_pid)} matched, {len(new_stage_codes)} new")

    # 2. Insert new stages
    if new_stage_codes:
        print("\n=== Inserting new stages ===")
        placeholders = ','.join(['%s']*len(new_stage_codes))
        lc.execute(f"SELECT {','.join(STAGE_COLS)} FROM stages WHERE stage_code IN ({placeholders})", new_stage_codes)
        inserted = 0
        vph = ','.join(['%s']*len(STAGE_COLS))
        for r in lc.fetchall():
            vals = [r[c] for c in STAGE_COLS]
            pc.execute(f"INSERT IGNORE INTO stages ({','.join(STAGE_COLS)}) VALUES ({vph})", tuple(vals))
            if pc.rowcount > 0:
                inserted += 1
        prod.commit()
        print(f"  +{inserted} stages")

        # Refresh mapping
        pc.execute("SELECT id, stage_code FROM stages")
        prod_sid_by_code = {r['stage_code']: r['id'] for r in pc.fetchall()}
        for scode, lid in local_sid_by_code.items():
            if scode in prod_sid_by_code:
                lid_to_pid[lid] = prod_sid_by_code[scode]

    # 3. Sync results for all local stages that have prod mapping
    print("\n=== Syncing results ===")
    local_sids = list(lid_to_pid.keys())

    for tbl, cols in TABLES.items():
        # Only sync records not already in prod (by id)
        placeholders = ','.join(['%s']*len(local_sids))
        lc.execute(f"SELECT {','.join(cols)} FROM {tbl} WHERE stage_id IN ({placeholders})", local_sids)
        records = list(lc.fetchall())

        # Check which IDs already exist in prod
        if records:
            lc.execute(f"SELECT id FROM {tbl} WHERE stage_id IN ({placeholders})", local_sids)
            local_ids = {r['id'] for r in lc.fetchall()}
            pc.execute(f"SELECT id FROM {tbl}")
            prod_ids = {r['id'] for r in pc.fetchall()}
            new_local_ids = local_ids - prod_ids

            new_records = [r for r in records if r['id'] in new_local_ids]
            print(f"  {tbl}: {len(new_records)} new / {len(records)} total (local)")

            if new_records:
                batch = []
                total = 0
                vph = ','.join(['%s']*len(cols))
                for r in new_records:
                    vals = [r[c] for c in cols]
                    # Replace stage_id
                    if 'stage_id' in cols:
                        sidx = cols.index('stage_id')
                        vals[sidx] = lid_to_pid.get(r['stage_id'], r['stage_id'])
                    batch.append(tuple(vals))
                    total += 1
                    if len(batch) >= 500:
                        pc.executemany(f"INSERT IGNORE INTO {tbl} ({','.join(cols)}) VALUES ({vph})", batch)
                        prod.commit()
                        print(f"    Progress: {total}/{len(new_records)}")
                        batch = []
                if batch:
                    pc.executemany(f"INSERT IGNORE INTO {tbl} ({','.join(cols)}) VALUES ({vph})", batch)
                    prod.commit()
                print(f"    Done: {total}")

    # 4. Verify
    print("\n=== Verification ===")
    for tbl in ['teams','riders','stages','stage_results','general_classification']:
        pc.execute(f"SELECT COUNT(*) as cnt FROM {tbl}")
        print(f"  prod.{tbl}: {pc.fetchone()['cnt']}")

    local.close()
    prod.close()
    print("\nSync complete!")

if __name__ == "__main__":
    main()
