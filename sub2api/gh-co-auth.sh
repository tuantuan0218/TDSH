#!/bin/bash
# 重跑 Mac 上的 copilot-api device-flow 认证，取回一个新鲜可用的 code
# （旧 code 0989-1311 已随 auth 进程退出而失效，见 SIGNUP-WALL-DATADOME-EVIDENCE.md §二）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
mkdir -p ~/copilot-api-run
cd ~/copilot-api-run || exit 1
pkill -f "copilot-api.*auth" 2>/dev/null
nohup npx -y copilot-api@latest auth > auth2.log 2>&1 &
echo "started pid=$!"
sleep 50
echo "--- code lines ---"
grep -oE '[0-9A-Z]{4}-[0-9A-Z]{4}' auth2.log | head -3
echo "--- log tail ---"
tail -12 auth2.log
REMOTE
