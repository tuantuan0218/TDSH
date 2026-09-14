#!/bin/bash
# 只读诊断：Mac 侧到 github.com 的出网状态（不改任何配置）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
echo "--- github.com:443 ---"
curl -s -m 12 -o /dev/null -w "github_https:%{http_code} time:%{time_total}s\n" https://github.com/ || echo "github_https:FAIL"
echo "--- api.github.com ---"
curl -s -m 12 -o /dev/null -w "api_https:%{http_code}\n" https://api.github.com/zen || echo "api_https:FAIL"
echo "--- dns ---"
dscacheutil -q host -a name github.com 2>&1 | head -6
echo "--- proxy env ---"
env | grep -i proxy || echo "no_proxy_env"
echo "--- general net ---"
curl -s -m 12 -o /dev/null -w "example:%{http_code}\n" https://example.com || echo "example:FAIL"
echo "--- token/auth state ---"
stat -f "%z bytes" ~/.local/share/copilot-api/github_token 2>/dev/null || echo "no token"
pgrep -fl "copilot-api.*auth" || echo "auth 进程无"
REMOTE
