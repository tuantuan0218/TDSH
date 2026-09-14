#!/bin/bash
# BazaarLink 一键入池脚本（本地, 幂等, 2026-09-14 预置）
# 前置: 用户已在 bazaarlink.ai 注册拿到 sk-bl-* key
# 用法: ./bazaarlink-pool.sh <SK_KEY>   或  export BAZ_KEY=sk-bl-... && ./bazaarlink-pool.sh
# 流程: 验证 key 可达 → /v1/models 取模型 → 入池 SQL → 核对
set -u
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
KEY="${1:-${BAZ_KEY:-}}"
if [ -z "$KEY" ]; then
  echo "用法: $0 <sk-bl-...>  或  export BAZ_KEY=sk-bl-... ; $0"
  echo " key 获取: bazaarlink.ai 注册（Turnstile 点一下）→ 控制台复制"
  exit 1
fi
BASE="https://api.bazaarlink.ai/v1"
RUN_DIR="/tmp/bazaarlink-pool"
mkdir -p "$RUN_DIR"

echo "===== 0. 验证 key（/v1/models）====="
MS=$(curl -s -m 20 -H "Authorization: Bearer $KEY" "$BASE/models")
CNT=$(echo "$MS" | grep -o '"id"' | wc -l | tr -d ' ')
echo "models 数: $CNT"
if [ "$CNT" -eq 0 ]; then echo "❌ key 无效或不可达: $(echo "$MS" | head -c 200)"; exit 2; fi

echo "===== 1. 验证 chat 可用（auto:free）====="
CHAT=$(curl -s -m 30 -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  "$BASE/chat/completions" \
  -d '{"model":"auto:free","messages":[{"role":"user","content":"say pong"}],"max_tokens":20}')
echo "chat: $(echo "$CHAT" | head -c 180)"
echo "$CHAT" | grep -q '"error"' && { echo "❌ chat 报错: $CHAT"; exit 3; }

echo "===== 2. 入池 SQL（幂等）====="
# 经 Mac PG 直改（Windows→WSL→SSH→Mac，参照 mac-add-*.sh 模式）
WKEY=$(echo "$KEY" | sed "s/'/''/g")
SQL="
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, concurrency, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT 'bazaarlink-free','openai','apikey',
  jsonb_build_object('api_key','${WKEY}','base_url','${BASE}','model_mapping', jsonb_build_object('Tuan','auto:free')),
  jsonb_build_object('model_mapping', jsonb_build_object('Tuan','auto:free'),'openai_responses_mode','force_chat_completions','openai_responses_supported',false,'openai_long_context_billing_enabled',false),
  'active', true, 1, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='bazaarlink-free' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable;
"
# 写临时 sh 给 WSL 走
cat > "$RUN_DIR/pool.sh" <<REMOTE
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "\$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'SSH'
export PATH=/usr/local/opt/postgresql@16/bin:\$PATH
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
${SQL}
SQL
echo '--- 绑定 group 5 ---'
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
INSERT INTO account_groups (account_id, group_id)
SELECT a.id, 5 FROM accounts a WHERE a.name='bazaarlink-free' AND a.deleted_at IS NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
SQL
echo '--- 核对 ---'
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,status,schedulable,priority FROM accounts WHERE name='bazaarlink-free' AND deleted_at IS NULL"
SSH
REMOTE
echo "===== 执行入池（Mac PG）====="
wsl.exe -e bash -c "bash '$RUN_DIR/pool.sh'" 2>&1 | head -40

echo "===== DONE: bazaarlink-free 入池完成 ====="
echo "限流 10 RPM/50 日, 内容审查违规 403（非故障）; prio 90/conc 1/group 5"
