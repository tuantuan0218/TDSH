#!/bin/bash
# 只读检查：Mac 上 copilot-api 的 device-code 授权是否仍在等待（决定要不要另起新 code）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
echo "--- token dir ---"
ls -la ~/.local/share/copilot-api/ 2>/dev/null || echo "no token dir (未授权)"
echo "--- auth.log tail ---"
tail -8 ~/copilot-api-run/auth.log 2>/dev/null || echo "no auth.log"
echo "--- auth 进程 ---"
pgrep -fl "copilot-api.*auth" 2>/dev/null || echo "auth 进程已退出"
echo "--- 反代是否已在跑 (4141) ---"
curl -s -m 5 -o /dev/null -w "4141:%{http_code}\n" http://127.0.0.1:4141/v1/models 2>/dev/null || echo "4141 无响应"
REMOTE
