@echo off
REM ============================================================
REM  keyless public API gateway - manual launcher (double-click)
REM  Start: node keyless-gateway.mjs [port]
REM  Log:   gateway.log (same dir, stdout+stderr redirected)
REM  Check: curl http://127.0.0.1:8787/health
REM  Stop:  close this window (or Ctrl+C)
REM  Note:  manual entry only; no scheduled task / startup / service.
REM  Port:  edit PORT below (default 8787)
REM ============================================================
setlocal
set PORT=8787
cd /d "%~dp0"
echo [%date% %time%] starting keyless gateway on port %PORT%...
node keyless-gateway.mjs %PORT% >> gateway.log 2>&1
echo [%date% %time%] gateway exited with code %ERRORLEVEL% (see gateway.log)
pause