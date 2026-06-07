#!/bin/bash
# 批量获取和导入环日本 Tour of Japan 2026 所有赛段数据
# Stage 1-8

BASE_URL="https://www.procyclingstats.com/race/tour-of-japan/2026/stage-"
SCRIPT_DIR="D:/codes/velo-rank/server/scripts"
PYTHON="C:/Users/feng/.workbuddy/binaries/python/versions/3.13.12/python.exe"

echo "=== 环日本 Tour of Japan 2026 批量导入 ==="
echo ""

for stage in 1 2 3 4 5 6 7 8; do
    echo "========== Stage $stage =========="
    
    # Step 1: 获取数据
    echo "[Step 1/3] 从 PCS 获取 Stage $stage 数据..."
    "$PYTHON" "$SCRIPT_DIR/fetch_pcs_stage.py" "${BASE_URL}${stage}" 2>&1 | tail -3
    
    # Step 2: 补充缺失的车队和车手
    echo "[Step 2/3] 补充缺失的车队和车手..."
    "$PYTHON" "$SCRIPT_DIR/insert_missing_riders_teams.py" "$SCRIPT_DIR/stage_data.json" 2>&1 | tail -5
    
    # Step 3: 导入数据
    echo "[Step 3/3] 导入 Stage $stage 数据..."
    "$PYTHON" "$SCRIPT_DIR/import_stage_data.py" "$SCRIPT_DIR/stage_data.json" 2>&1 | tail -20
    
    echo ""
done

echo "=== 全部完成！==="
