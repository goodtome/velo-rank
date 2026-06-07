@echo off
REM 正一领骑项目清理脚本 (Windows版本)
REM 版本: v1.0
REM 日期: 2026-06-03

chcp 65001 >nul
title 正一领骑项目清理工具

echo =========================================
echo   正一领骑项目清理工具
echo =========================================
echo.

echo 正在扫描临时文件...

REM 统计要删除的文件

echo 将要删除以下文件:
echo ----------------------------------------
echo [1] 调试JS脚本:
if exist debug_fetch.js (echo     debug_fetch.js) else (echo     (无))
if exist test_prod_conn.js (echo     test_prod_conn.js) else (echo     (无))

echo.
echo [2] 调试HTML文件:
for /f "delims=" %%f in ('dir /b debug_*.html 2^>nul') do echo     %%f

echo.
echo [3] 历史赛段JSON文件:
if exist stage19_full.json (echo     stage19_full.json) else (echo     (无))
if exist stage20_full.json (echo     stage20_full.json) else (echo     (无))
if exist stage21_full.json (echo     stage21_full.json) else (echo     (无))

echo.
echo [4] 其他临时文件:
if exist alter-output.txt (echo     alter-output.txt) else (echo     (无))
if exist debug-api-output.txt (echo     debug-api-output.txt) else (echo     (无))
if exist debug-city-zh-output.txt (echo     debug-city-zh-output.txt) else (echo     (无))
if exist debug-json-output.txt (echo     debug-json-output.txt) else (echo     (无))
if exist git_stderr.txt (echo     git_stderr.txt) else (echo     (无))
if exist git_stdout.txt (echo     git_stdout.txt) else (echo     (无))
if exist query-stage-names-output.txt (echo     query-stage-names-output.txt) else (echo     (无))
if exist push_result.txt (echo     push_result.txt) else (echo     (无))
if exist stage5-*.json (echo     stage5-*.json (如果有)) else (echo     (无))

echo.
echo [5] 日志文件:
if exist server.log (echo     server.log) else (echo     (无))

echo.
echo [6] 调试图片:
if exist server\debug-*.png (for /f "delims=" %%f in ('dir /b server\debug-*.png 2^>nul') do echo     %%f) else (echo     (无))

echo.
echo ----------------------------------------

set /p confirm="确认删除吗？(y/N): "

if /i not "%confirm%"=="y" (
    echo.
    echo 管理员取消清理操作
    pause
    exit /b 0
)

echo.
echo 开始清理...
echo.

set DELETED_COUNT=0

REM 删除根目录文件
if exist debug_fetch.js (
    del /f /q debug_fetch.js
    echo [OK] 删除: debug_fetch.js
    set /a DELETED_COUNT+=1
)

if exist test_prod_conn.js (
    del /f /q test_prod_conn.js
    echo [OK] 删除: test_prod_conn.js
    set /a DELETED_COUNT+=1
)

for %%f in (debug_*.html) do (
    del /f /q "%%f"
    echo [OK] 删除: %%f
    set /a DELETED_COUNT+=1
)

if exist stage19_full.json (
    del /f /q stage19_full.json
    echo [OK] 删除: stage19_full.json
    set /a DELETED_COUNT+=1
)

if exist stage20_full.json (
    del /f /q stage20_full.json
    echo [OK] 删除: stage20_full.json
    set /a DELETED_COUNT+=1
)

if exist stage21_full.json (
    del /f /q stage21_full.json
    echo [OK] 删除: stage21_full.json
    set /a DELETED_COUNT+=1
)

if exist alter-output.txt (
    del /f /q alter-output.txt
    echo [OK] 删除: alter-output.txt
    set /a DELETED_COUNT+=1
)

if exist debug-api-output.txt (
    del /f /q debug-api-output.txt
    echo [OK] 删除: debug-api-output.txt
    set /a DELETED_COUNT+=1
)

if exist debug-city-zh-output.txt (
    del /f /q debug-city-zh-output.txt
    echo [OK] 删除: debug-city-zh-output.txt
    set /a DELETED_COUNT+=1
)

if exist debug-json-output.txt (
    del /f /q debug-json-output.txt
    echo [OK] 删除: debug-json-output.txt
    set /a DELETED_COUNT+=1
)

if exist git_stderr.txt (
    del /f /q git_stderr.txt
    echo [OK] 删除: git_stderr.txt
    set /a DELETED_COUNT+=1
)

if exist git_stdout.txt (
    del /f /q git_stdout.txt
    echo [OK] 删除: git_stdout.txt
    set /a DELETED_COUNT+=1
)

if exist query-stage-names-output.txt (
    del /f /q query-stage-names-output.txt
    echo [OK] 删除: query-stage-names-output.txt
    set /a DELETED_COUNT+=1
)

if exist push_result.txt (
    del /f /q push_result.txt
    echo [OK] 删除: push_result.txt
    set /a DELETED_COUNT+=1
)

if exist server.log (
    del /f /q server.log
    echo [OK] 删除: server.log
    set /a DELETED_COUNT+=1
)

REM 删除server目录下的调试图片
if exist server (
    cd server
    for %%f in (debug-*.png) do (
        del /f /q "%%f"
        echo [OK] 删除: %%f
        set /a DELETED_COUNT+=1
    )
    cd ..
)

echo.
echo =========================================
echo   清理完成！
echo =========================================
echo 总计删除 %DELETED_COUNT% 个文件
echo.

REM 提交到git
set /p git_confirm="是否要提交更改到 git? (Y/n): "

if not "%git_confirm%"=="n" (
    echo.
    echo 正在提交到 git...
    git add -A
    git commit -m "清理临时文件和调试代码 - 2026-06-03

清理内容:
- 删除调试JS脚本
- 删除调试HTML文件
- 删除历史赛段JSON文件
- 删除调试图片
- 删除日志和临时输出文件

节省空间: ~5MB"

    if !errorlevel! equ 0 (
        echo 提交成功
    ) else (
        echo 提交失败，代码未提交到git
    )
)

echo.
echo 项目的清理完成！
echo.
echo 建议后续操作:
echo 1. 测试后端服务: npm run dev
echo 2. 运行验证: node verify-pagination.js
echo 3. 查看文档: docs/ 目录
echo.

pause
