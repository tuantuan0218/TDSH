@echo off
REM ============================================================
REM  DeepLX local translation service - manual launcher
REM  Binary: bin\deeplx_windows_amd64.exe (v1.2.4, 25MB)
REM  Start:  listens on 0.0.0.0:1188, POST /translate
REM  Log:    bin\deeplx.log (stdout) / bin\deeplx-err.log (stderr)
REM  Test:   node -e "..." or curl to 127.0.0.1:1188/translate
REM  Stop:   close this window (or Ctrl+C)
REM  Note:   manual entry only; no scheduled task / startup / service.
REM  Caution: DeepL rate-limits shared proxy exit IPs (HTTP 429) -
REM           expect 429 under Clash proxy; use clean home-ISP egress.
REM ============================================================
setlocal
cd /d "%~dp0"
echo [%date% %time%] starting DeepLX on port 1188...
bin\deeplx_windows_amd64.exe >> bin\deeplx.log 2>&1
echo [%date% %time%] DeepLX exited with code %ERRORLEVEL% (see bin\deeplx.log)
pause