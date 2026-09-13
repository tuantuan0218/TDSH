@echo off
REM ============================================================
REM  keyless 公益 API 网关 — 用户手动启动入口（双击本文件即可）
REM  启动: node keyless-gateway.mjs [port]
REM  日志: gateway.log（同目录，stdout/stderr 重定向落盘，可随时查）
REM  验证: 启动后浏览器/curl 访问 http://127.0.0.1:8787/health
REM  停止: 关闭本窗口即停（Ctrl+C 或点 X）
REM  说明: 本文件是手动双击入口，不注册任何计划任务/启动项/服务。
REM  换端口: 双击前可改下面 PORT 值（默认 8787）
REM ============================================================
setlocal
set PORT=8787
cd /d "%~dp0"
echo [%date% %time%] starting keyless gateway on port %PORT%...
node keyless-gateway.mjs %PORT% >> gateway.log 2>&1
echo [%date% %time%] gateway exited with code %ERRORLEVEL% (see gateway.log)
pause