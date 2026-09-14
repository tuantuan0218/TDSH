#!/bin/bash
# sub2api 合法扩池统一入口（2026-09-14）
# 用法: bash pool-entry.sh [NIM|BAZAARLINK|OPENROUTER|COPILOT]
# 无参数 = 显示当前 4 通道状态与下一步
# 有参数 + key 在手 = 自动路由到对应入池脚本
#
# ⚠️ 环境变量必须在 BASH 里设（PowerShell 的 $env: 不会自动传到 bash 子进程）：
#   bash -c 'BAZ_KEY=sk-bl-... bash pool-entry.sh BAZAARLINK'
#   bash -c 'NIM_KEY=nvapi-... bash pool-entry.sh NIM'
#   bash -c 'OR_KEY=sk-or-v1-... bash pool-entry.sh OPENROUTER'
#   bash pool-entry.sh COPILOT   (Mac 已授权，无需 key)
set -u
export PATH="/usr/local/opt/postgresql@16/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
BASE=/mnt/d/tdsh/sub2api   # WSL 侧路径
DIR="$(cd "$(dirname "$0")" && pwd)"

STATUS() {
  cat <<EOF
=== sub2api 合法扩池 4 通道状态 ===
EOF
  # BazaarLink
  if [ -n "${BAZ_KEY:-}" ]; then echo "🥇 BazaarLink: key 已提供 → 直接入池: $0 BAZAARLINK"; else echo "🥇 BazaarLink: 待 bazaarlink.ai 注册拿 sk-bl-* key (门槛最低)"; fi
  if [ -n "${NIM_KEY:-}" ]; then echo "🥉 NIM: key 已提供 → $0 NIM"; else echo "🥉 NIM: 待 build.nvidia.com 过 hCaptcha 拿 nvapi-* key"; fi
  if [ -n "${OR_KEY:-}" ]; then echo "4  OpenRouter: key 已提供 → $0 OPENROUTER"; else echo "4  OpenRouter: 待注册拿 sk-or-v1-* key"; fi
  # copilot (Mac 侧 token)
  CPTOK=$(wsl.exe -e bash -lc "ssh -o BatchMode=yes -o ConnectTimeout=8 -i /tmp/sshkey/id zhaozicheng@192.168.1.3 'wc -c < ~/.local/share/copilot-api/github_token 2>/dev/null || echo 0'" 2>/dev/null | tr -d '[:space:]')
  if [ "${CPTOK:-0}" != "0" ]; then echo "🥈 copilot: 已授权 → 一键入池: $0 COPILOT"; else echo "🥈 copilot: 待 github.com/login/device 输 code (Mac auth 存活)"; fi
  echo "=== 用法: 设好 env key 后 $0 <通道名> ==="
  echo "  BAZAARLINK  (BAZ_KEY=sk-bl-...)"
  echo "  NIM         (NIM_KEY=nvapi-...)"
  echo "  OPENROUTER  (OR_KEY=sk-or-v1-...)"
  echo "  COPILOT     (Mac 已授权)"
}

case "${1:-}" in
  BAZAARLINK)
    if [ -z "${BAZ_KEY:-}" ]; then echo "❌ 未设 BAZ_KEY (bazaarlink.ai 注册拿 sk-bl-...)"; exit 1; fi
    # 走 WSL 调 bazaarlink-pool.sh（/mnt/d 为 D: 盘 WSL 挂载，小写 d）
    # key 通过 shell 位置参数传入（避免 env 跨 WSL 边界丢失）
    wsl.exe -e bash -c "bash /mnt/d/tdsh/sub2api/bazaarlink-pool.sh '$BAZ_KEY'" 2>&1
    ;;
  NIM)
    if [ -z "${NIM_KEY:-}" ]; then echo "❌ 未设 NIM_KEY"; exit 1; fi
    export SF_NAME="nvidia-nim" SF_BASE="https://integrate.api.nvidia.com/v1" SF_KEY="$NIM_KEY"
    export SF_MODELS='{"Tuan":"z-ai/glm-5.3-flash"}'
    exec node "$DIR/liunxddo/add-nvidia-nim-pool.mjs"
    ;;
  OPENROUTER)
    if [ -z "${OR_KEY:-}" ]; then echo "❌ 未设 OR_KEY"; exit 1; fi
    export SF_NAME="openrouter-free" SF_BASE="https://openrouter.ai/api/v1" SF_KEY="$OR_KEY"
    export SF_MODELS='{"Tuan":"openrouter/free"}'
    exec node "$DIR/add-free-api-pool.mjs"
    ;;
  COPILOT)
    echo "=== copilot 一键入池（Mac 侧已授权才有效）==="
    wsl.exe -e bash -lc "ssh -o BatchMode=yes -o ConnectTimeout=8 -i /tmp/sshkey/id zhaozicheng@192.168.1.3 'bash ~/copilot-api-run/copilot-pool.sh'" 2>&1 | tail -30
    ;;
  *)
    STATUS
    ;;
esac
