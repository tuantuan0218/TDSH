#!/bin/bash
# copilot device-code 保持器：始终维持一个"新鲜可用"的 code；token 一落盘就交棒给 autopipe（起反代→三步门→入池）
# 用法: bash gh-copilot-authkeeper.sh [总时长分钟=50]
MAX_MIN="${1:-50}"
KEY="$HOME/.ssh/id_ed25519"
MAC="zhaozicheng@192.168.1.3"
end=$(( $(date +%s) + MAX_MIN * 60 ))
authorized=0
while [ "$(date +%s)" -lt "$end" ]; do
  out=$(ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$KEY" "$MAC" 'bash -s' <<'REMOTE' 2>&1
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
T="$HOME/.local/share/copilot-api/github_token"
L="$HOME/copilot-api-run/auth2.log"
sz=$(stat -f %z "$T" 2>/dev/null || echo 0)
if [ "$sz" -gt 20 ]; then echo "AUTHORIZED size=$sz"; exit 0; fi
alive=$(pgrep -f "copilot-api.*auth" | head -1)
age=9999
[ -f "$L" ] && age=$(( $(date +%s) - $(stat -f %m "$L") ))
if [ -n "$alive" ] && [ "$age" -lt 600 ]; then
  code=$(grep -oE '[0-9A-Z]{4}-[0-9A-Z]{4}' "$L" | tail -1)
  echo "WAITING code=${code:-PENDING} (auth pid=$alive, log_age=${age}s)"
else
  echo "auth 进程已退出/code 已过期(log_age=${age}s) -> 重发新 code"
  pkill -f "copilot-api.*auth" 2>/dev/null; sleep 1
  mkdir -p "$HOME/copilot-api-run"; cd "$HOME/copilot-api-run" || exit 1
  nohup npx -y copilot-api@latest auth > auth2.log 2>&1 &
  # npx 冷启动可能 >40s（拉包），轮询直到 code 真的出现（最多 150s），否则会取到空值
  code=""
  for i in $(seq 1 30); do
    sleep 5
    code=$(grep -oE '[0-9A-Z]{4}-[0-9A-Z]{4}' auth2.log 2>/dev/null | tail -1)
    [ -n "$code" ] && break
  done
  if [ -z "$code" ]; then
    echo "FRESH_CODE=NONE"; tail -5 auth2.log
  else
    echo "FRESH_CODE=$code"
  fi
fi
REMOTE
)
  echo "[$(date +%H:%M:%S)] $out" | tr '\n' ' '; echo
  case "$out" in *AUTHORIZED*) authorized=1; break;; esac
  sleep 45
done
if [ "$authorized" != 1 ]; then echo "!! 总时长内未获授权，跳过入池（不产生任何池改动）"; exit 2; fi
echo "=== 授权完成，交棒 autopipe（起反代→三步门→兜底位入池）==="
cd "$(dirname "$0")" && bash gh-copilot-autopipe.sh 3
