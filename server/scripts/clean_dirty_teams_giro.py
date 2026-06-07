#!/usr/bin/env python3
"""
清理 Giro d'Italia 2026 中关联的 2 条脏车队数据：
1. Alpecin - Premier Tech (脏 ID) → 修正到 APC 正确记录
2. Team Picnic PostNL (脏 ID) → 修正到 TPP 正确记录
"""

import pymysql
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DB_CONFIG = {
    'host': 'localhost',
    'port': 13306,
    'user': 'root',
    'password': 'mysql123456',
    'database': 'jersey_db',
    'charset': 'utf8mb4',
    'autocommit': False
}

# 脏 team_id（无 uci_code，name 重复）
DIRTY_TEAMS = [
    {
        'dirty_id': 'af93722a-8ebc-44ef-88d6-0a713e85fe11',
        'correct_uci': 'APC',
        'name': 'Alpecin - Premier Tech'
    },
    {
        'dirty_id': '47be9a4e-d096-4942-9da2-f926df242250',
        'correct_uci': 'TPP',
        'name': 'Team Picnic PostNL'
    },
]

def main():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    try:
        for item in DIRTY_TEAMS:
            dirty_id = item['dirty_id']
            correct_uci = item['correct_uci']
            name = item['name']

            # 1. 查找正确的 team_id
            cursor.execute(
                'SELECT id, team_name_en, uci_code FROM teams WHERE uci_code = %s LIMIT 1',
                (correct_uci,)
            )
            correct = cursor.fetchone()
            if not correct:
                print(f'❌ 未找到 UCI={correct_uci} 的正确车队记录，跳过 {name}')
                continue

            correct_id = correct['id']
            correct_name = correct['team_name_en'] or correct['uci_code']
            print(f'📌 {name}')
            print(f'   脏 ID: {dirty_id}')
            print(f'   正确 ID: {correct_id} ({correct_name}, {correct_uci})')

            # 2. 统计将受影响的 stage_results 记录数
            cursor.execute(
                'SELECT COUNT(*) as cnt FROM stage_results WHERE team_id = %s',
                (dirty_id,)
            )
            sr_cnt = cursor.fetchone()['cnt']

            cursor.execute(
                'SELECT COUNT(DISTINCT stage_id) as cnt FROM stage_results WHERE team_id = %s',
                (dirty_id,)
            )
            stage_cnt = cursor.fetchone()['cnt']

            print(f'   影响 stage_results: {sr_cnt} 条，涉及 {stage_cnt} 个赛段')

            if sr_cnt == 0:
                print(f'   ℹ️  无关联记录，直接删除脏车队')
            else:
                # 3. 更新 stage_results 到正确的 team_id
                cursor.execute(
                    'UPDATE stage_results SET team_id = %s WHERE team_id = %s',
                    (correct_id, dirty_id)
                )
                print(f'   ✅ 已更新 {cursor.rowcount} 条 stage_results')

            # 4. 删除脏车队记录
            cursor.execute('DELETE FROM teams WHERE id = %s', (dirty_id,))
            print(f'   ✅ 已删除脏车队记录 ({cursor.rowcount} 条)')
            print()

        conn.commit()
        print('🎉 全部完成，事务已提交！')

    except Exception as e:
        conn.rollback()
        print(f'❌ 错误，已回滚：{e}')
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
