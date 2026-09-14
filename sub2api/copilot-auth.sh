#!/bin/bash
# copilot 认证自助工具（2026-09-14）—— 把 device flow 全流程固化为可复用脚本
# 场景: copilot-api 的 auth 命令 --proxy-env 有 bug（undici 全局 fetch 不走代理），
#       本脚本用 curl -x 走代理，绕开该 bug，实现完整 device flow。
#
# 用法:
#   1) ./copilot-auth.sh code           # 获取 user_code（用户去 github.com/login/device 输入）
#   2) ./copilot-auth.sh poll           # 用户授权后轮询换 token 并写入文件
#   3) ./copilot-auth.sh pool           # token 就绪后触发一键入池
#   4) ./copilot-auth.sh status         # 查看当前认证状态
# 说明: 脚本运行在 Windows Git Bash，内部经 WSL 调 Mac（Mac 有 mihomo 代理 7897）。
set -u
PROXY="http://127.0.0.1:7897"
CLIENT="Iv1.b507a08c87ecfe98"   # copilot-api 的 GitHub OAuth client_id (src/lib/api-config.ts)
MAC="zhaozicheng@192.168.1.3"
SSHKEY="/tmp/sshkey/id"          # 临时 600 权限 key（WSL 侧）
TOKEN_PATH="~/.local/share/copilot-api/github_token"
DC_FILE="$HOME/.copilot-device-code"

mac() { wsl.exe -e bash -lc "ssh -o BatchMode=yes -o ConnectTimeout=8 -i '$SSHKEY' $MAC '$1'" 2>&1; }

case "${1:-status}" in
  code)
    echo "=== 获取 device code（走 mihomo 7897 代理）==="
    RESP=$(wsl.exe -e bash -lc "ssh -o BatchMode=yes -o ConnectTimeout=8 -i '$SSHKEY' $MAC 'curl -s -m 20 -x $PROXY -X POST -H \"Accept: application/json\" -H \"Content-Type: application/json\" -d \"{\\\"client_id\\\":\\\"$CLIENT\\\",\\\"scope\\\":\\\"read:user user:email repo workflow\\\"}\" https://github.com/login/device/code'" 2>&1)
    echo "RESP: $RESP"
    DC=$(echo "$RESP" | grep -oE '"device_code":"[^"]*"' | cut -d'"' -f4)
    UC=$(echo "$RESP" | grep -oE '"user_code":"[^"]*"' | cut -d'"' -f4)
    EXPIRE=$(echo "$RESP" | grep -oE '"expires_in":[0-9]+' | cut -d: -f2)
    echo "$DC" > "$DC_FILE"
    echo "──────────────────────────────"
    echo "👉 用户操作: 打开 https://github.com/login/device"
    echo "            输入 user_code:  $UC"
    echo "    （有效期 ${EXPIRE}s，约 ${EXPIRE}s 分钟）"
    echo "    授权完成后运行: bash copilot-auth.sh poll"
    echo "──────────────────────────────"
    ;;
  poll)
    DC=$(cat "$DC_FILE" 2>/dev/null || echo "")
    if [ -z "$DC" ]; then echo "❌ 未先运行 code（无 device_code）"; exit 1; fi
    echo "=== 轮询 access_token（授权后 5s 内返回 token）==="
    for i in $(seq 1 12); do
      RESP=$(wsl.exe -e bash -lc "ssh -o BatchMode=yes -o ConnectTimeout=8 -i '$SSHKEY' $MAC 'curl -s -m 15 -x $PROXY -X POST -H \"Accept: application/json\" -H \"Content-Type: application/json\" -d \"{\\\"client_id\\\":\\\"$CLIENT\\\",\\\"device_code\\\":\\\"$DC\\\",\\\"grant_type\\\":\\\"urn:ietf:params:oauth:grant-type:device_code\\\"}\" https://github.com/login/oauth/access_token'" 2>&1)
      echo "poll#$i: $RESP"
      TOK=$(echo "$RESP" | grep -oE '"access_token":"[^"]*"' | cut -d'"' -f4)
      if [ -n "$TOK" ]; then
        echo "$TOK" > /tmp/_gh_token
        wsl.exe -e bash -lc "scp -o BatchMode=yes -o ConnectTimeout=8 -i '$SSHKEY' /mnt/d/tdsh/sub2api/_gh_token $MAC:$TOKEN_PATH 2>/dev/null || echo SCP_FAIL" 2>&1
        echo "✅ token 已写入 Mac: $TOKEN_PATH"
        rm -f /tmp/_gh_token
        exit 0
      fi
      if echo "$RESP" | grep -qE 'authorization_pending|slow_down'; then sleep 6; else break; fi
    done
    echo "⚠️ 未授权或已过期。运行 code 重新获取。"
    ;;
  pool)
    echo "=== 触发一键入池（Mac 侧 copilot-pool.sh）==="
    mac 'bash ~/copilot-api-run/copilot-pool.sh' 2>&1 | tail -30
    ;;
  status)
    echo "=== 认证状态 ==="
    mac "ls -la $TOKEN_PATH 2>/dev/null && wc -c $TOKEN_PATH" 2>&1
    ;;
  *)
    echo "用法: bash copilot-auth.sh [code|poll|pool|status]"
    ;;
esac
