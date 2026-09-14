#!/bin/bash
# 清理 Mac 上堆积的 copilot-api auth 进程（keeper 旧 bug 周期可能留下多个）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
echo "--- before ---"
pgrep -fl "copilot-api" | head -6 || echo none
pkill -f "copilot-api.*auth" 2>/dev/null
sleep 2
echo "--- after ---"
pgrep -fl "copilot-api.*auth" || echo "auth 进程已清空"
echo "--- token ---"
stat -f "%z bytes" ~/.local/share/copilot-api/github_token 2>/dev/null || echo "no token"
REMOTE
