#!/bin/bash
# 只读：验证 Mac 上 7897 代理（并行会话 copilot-auth.sh 声称存在）与 GitHub 可达性对照
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
echo "--- Mac 7897 端口 ---"
lsof -nP -iTCP:7897 -sTCP:LISTEN 2>/dev/null | head -3 || echo "7897 无监听"
echo "--- 经 7897 代理访问 github ---"
curl -s -m 15 -x http://127.0.0.1:7897 -o /dev/null -w "proxy_github:%{http_code}\n" https://github.com/ 2>&1 || echo "proxy 不通"
echo "--- 直连 github（对照）---"
curl -s -m 15 -o /dev/null -w "direct_github:%{http_code}\n" https://github.com/ 2>&1 || echo "direct 超时"
echo "--- 代理出口 IP ---"
curl -s -m 15 -x http://127.0.0.1:7897 https://api.ipify.org 2>&1 || echo "proxy ip 不可达"
REMOTE
