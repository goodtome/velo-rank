#!/usr/bin/env python3
"""
批量清理 teams 表中 uci_code IS NULL 的脏数据：
1. 按车队名模糊匹配到正确的 clean team（有 uci_code）
2. 将 stage_results 外键修正到正确 team_id
3. 删除脏车队记录

匹配规则：脏车队名包含_clean_车队名关键词_ 或反之。
对于无法自动匹配的，打印警告并跳过。
"""

import pymysql
import sys
import re
from difflib import SequenceMatcher

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_CONFIG = {
    'host': 'localhost',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',
    'database': 'jersey_db',
    'charset': 'utf8mb4',
    'autocommit': False,
}

def normalize_name(name):
    """标准化车队名用于匹配"""
    if not name:
        return ''
    return re.sub(r'[^a-z0-9]', '', name.lower())

def similarity(a, b):
    return SequenceMatcher(None, normalize_name(a), normalize_name(b)).ratio()

def find_best_match(cursor, dirty_name, clean_teams, threshold=0.70):
    """
    在 clean_teams 中找最佳匹配。
    返回 (clean_team_dict, score) 或 (None, 0)
    """
    best = None
    best_score = 0
    for ct in clean_teams:
        name = ct['name']
        # 直接包含关系
        n_dirty = normalize_name(dirty_name)
        n_clean = normalize_name(name)
        if n_dirty in n_clean or n_clean in n_dirty:
            s = similarity(dirty_name, name)
            if s > best_score:
                best_score = s
                best = ct
        else:
            s = similarity(dirty_name, name)
            if s > best_score:
                best_score = s
                best = ct
    if best and best_score >= threshold:
        return best, best_score
    return None, best_score

def main():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    try:
        # 1. 加载所有 clean teams
        cursor.execute("""
            SELECT id, uci_code, COALESCE(team_name_en, team_name) as name, country
            FROM teams
            WHERE uci_code IS NOT NULL AND uci_code != ''
            ORDER BY uci_code
        """)
        clean_teams = cursor.fetchall()
        print(f"✅ 加载 {len(clean_teams)} 条 clean teams")

        # 2. 加载所有 dirty teams
        cursor.execute("""
            SELECT id, COALESCE(team_name_en, team_name) as name, country
            FROM teams
            WHERE uci_code IS NULL OR uci_code = ''
            ORDER BY COALESCE(team_name_en, team_name)
        """)
        dirty_teams = cursor.fetchall()
        print(f"📋 待清理 dirty teams: {len(dirty_teams)} 条\n")

        matched = []    # [(dirty_id, dirty_name, clean_id, clean_name, uci_code, score)]
        unmatched = []  # [(dirty_id, dirty_name)]

        for dt in dirty_teams:
            dirty_id = dt['id']
            dirty_name = dt['name'] or '(null)'
            clean_team, score = find_best_match(cursor, dirty_name, clean_teams)
            if clean_team:
                matched.append((dirty_id, dirty_name, clean_team['id'], clean_team['name'], clean_team['uci_code'], score))
                print(f"  ✅ 匹配: [{clean_team['uci_code']}] {clean_team['name']}  ←  \"{dirty_name}\"  (相似度={score:.2f})")
            else:
                unmatched.append((dirty_id, dirty_name))
                print(f"  ⚠️  未匹配: \"{dirty_name}\" (best score={score:.2f})")

        print(f"\n📊 匹配统计: {len(matched)} 条可自动匹配, {len(unmatched)} 条需手动处理\n")

        if unmatched:
            print("⚠️  以下 dirty teams 无法自动匹配，将跳过：")
            for uid, uname in unmatched:
                print(f"   - [{uid[:8]}] {uname}")
            print()

        # 3. 执行修正
        print("🚀 开始执行修正...\n")
        update_total = 0
        delete_total = 0

        for dirty_id, dirty_name, clean_id, clean_name, uci_code, score in matched:
            # 统计受影响记录数
            cursor.execute(
                "SELECT COUNT(*) as cnt FROM stage_results WHERE team_id = %s",
                (dirty_id,)
            )
            sr_cnt = cursor.fetchone()['cnt']

            if sr_cnt > 0:
                cursor.execute(
                    "UPDATE stage_results SET team_id = %s WHERE team_id = %s",
                    (clean_id, dirty_id)
                )
                print(f"  ✅ [{uci_code}] {clean_name}: 更新 {cursor.rowcount} 条 stage_results")
                update_total += cursor.rowcount
            else:
                print(f"  ℹ️  [{uci_code}] {clean_name}: 无 stage_results 关联，直接删除")

            # 删除脏记录
            cursor.execute("DELETE FROM teams WHERE id = %s", (dirty_id,))
            print(f"     🗑️  已删除脏记录 [{dirty_id[:8]}] {dirty_name}\n")
            delete_total += 1

        conn.commit()
        print(f"🎉 完成！共更新 {update_total} 条 stage_results，删除 {delete_total} 条脏车队记录")

        # 4. 验证
        cursor.execute("SELECT COUNT(*) as cnt FROM teams WHERE uci_code IS NULL OR uci_code = ''")
        remaining = cursor.fetchone()['cnt']
        print(f"🔍 验证: 剩余 uci_code IS NULL 的车队记录: {remaining} 条")

    except Exception as e:
        conn.rollback()
        print(f"❌ 错误，已回滚：{e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
