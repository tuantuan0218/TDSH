@echo off
REM ============================================================
REM  MuseScore MCP - 一键连接脚本 (Windows)
REM  作用: 1) 检查 MuseScore 是否在运行
REM        2) 检查 WebSocket 端口 8765 是否监听
REM        3) 若未监听，提示用户在 MuseScore GUI 手动启用插件
REM        4) 监听后启动 MCP server 并保持运行
REM  用法: 双击运行，或 cmd /c "D:\tmp_roleai\start-musescore-mcp.cmd"
REM ============================================================
setlocal enabledelayedexpansion
chcp 65001 > nul

echo ==========================================================
echo   MuseScore MCP - 一键连接
echo ==========================================================
echo.

REM ---- 1. 检查 MuseScore 进程 ----
tasklist /FI "IMAGENAME eq MuseScore4.exe" 2>nul | find /i "MuseScore4.exe" >nul
if errorlevel 1 (
    echo [!] MuseScore 4 未运行，正在启动...
    start "" "C:\Program Files\MuseScore 4\bin\MuseScore4.exe" "D:\tmp_roleai\output\professional_piano_piece.mid"
    echo [*] 已启动 MuseScore 并加载钢琴曲工程
    echo [*] 请等待窗口出现后，执行下面第 2 步的插件启用
    echo.
) else (
    echo [OK] MuseScore 4 正在运行
)

REM ---- 2. 检查 WebSocket 端口 8765 ----
echo [*] 检查 WebSocket 端口 8765 ...
:CHECK_PORT
netstat -ano 2>nul | findstr ":8765" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo.
    echo [!] WebSocket 服务未启动 (端口 8765 无监听)
    echo.
    echo     请在 MuseScore 窗口手动执行以下步骤（只需一次）:
    echo       1. 菜单 Plugins -^> Plugin Manager  ^(或中文: 插件 -^> 插件管理器^)
    echo       2. 找到 "MuseScore API Server"，勾选启用，点 OK
    echo       3. 菜单 Plugins -^> MuseScore API Server -^> 点击运行
    echo       4. 状态栏出现:  "Starting MuseScore API Server on port 8765"
    echo.
    choice /c YN /t 120 /d N /m "等待插件启用... 已启用请按 Y，跳过按 N"
    if errorlevel 2 goto :PORT_FAIL
    goto :CHECK_PORT
)

echo [OK] WebSocket 端口 8765 已监听!
echo.

REM ---- 3. 验证桥连接 ----
echo [*] 验证 MuseScore 桥连接...
set MCP_MUSESCORE_HOST=localhost
set MCP_MUSESCORE_PORT=8765
"J:\tmp_roleai\mcp-musescore\.venv\Scripts\python.exe" "J:\tmp_roleai\mcp-musescore\skills\mcp-musescore\scripts\probe-musescore-bridge.py"
if errorlevel 1 (
    echo [!] 桥连接验证失败，请确认插件已正确启用
    exit /b 1
)
echo [OK] 桥连接验证通过!
echo.

REM ---- 4. 安装依赖(如缺) ----
echo [*] 确保依赖就绪...
"J:\tmp_roleai\mcp-musescore\.venv\Scripts\python.exe" -c "import fastmcp, websockets" 2>nul
if errorlevel 1 (
    echo [*] 安装依赖 (阿里云镜像)...
    "J:\tmp_roleai\mcp-musescore\.venv\Scripts\python.exe" -m pip install "mcp<2" websockets -i https://mirrors.aliyun.com/pypi/simple/ --quiet
)

REM ---- 5. 启动 MCP server (保持前台) ----
echo.
echo [*] 启动 MuseScore MCP Server (Ctrl+C 停止)...
echo.
cd /d "J:\tmp_roleai\mcp-musescore"
"J:\tmp_roleai\mcp-musescore\.venv\Scripts\python.exe" "J:\tmp_roleai\mcp-musescore\server.py"

goto :EOF

:PORT_FAIL
echo.
echo [X] 未检测到 WebSocket 服务。请手动在 MuseScore GUI 启用插件后重跑本脚本。
exit /b 1