#!/bin/bash
# 取 Mac 上当前有效的 copilot device code 及其年龄（只读）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
L="$HOME/copilot-api-run/auth2.log"
T="$HOME/.local/share/copilot-api/github_token"
sz=$(stat -f %z "$T" 2>/dev/null || echo 0)
echo "token_size=$sz"
pid=$(pgrep -f "copilot-api.*auth" | head -1); echo "auth_pid=${pid:-NONE}"
[ -f "$L" ] && echo "log_age=$(( $(date +%s) - $(stat -f %m "$L") ))s"
grep -oE '[0-9A-Z]{4}-[0-9A-Z]{4}' "$L" 2>/dev/null | tail -1 | sed 's/^/CODE=/'
grep -iE "logged in|success|error|expired" "$L" 2>/dev/null | tail -3
REMOTE
