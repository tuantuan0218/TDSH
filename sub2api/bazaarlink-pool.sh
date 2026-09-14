#!/bin/bash
# BazaarLink 一键入池（Windows 侧调用，走 WSL→SSH→Mac PG，2026-09-14）
# 用法: bash bazaarlink-pool.sh <sk-bl-key>
# 前置: 已在 bazaarlink.ai 注册拿到 sk-bl-* key
set -u
KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo "用法: bash bazaarlink-pool.sh <sk-bl-...>"
  exit 1
fi
BASE="https://api.bazaarlink.ai/v1"
WKEY=$(echo "$KEY" | sed "s/'/''/g")

echo "===== 0. 验证 key（/v1/models）====="
MS=$(curl -s -m 20 -H "Authorization: Bearer $KEY" "$BASE/models")
CNT=$(echo "$MS" | grep -o '"id"' | wc -l | tr -d ' ')
echo "models 数: $CNT"
if [ "$CNT" -eq 0 ]; then
  echo "❌ key 无效或不可达: $(echo "$MS" | head -c 200)"
  exit 2
fi

echo "===== 1. 验证 chat（auto:free）====="
CHAT=$(curl -s -m 30 -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
  "$BASE/chat/completions" \
  -d '{"model":"auto:free","messages":[{"role":"user","content":"say pong"}],"max_tokens":20}')
echo "chat: $(echo "$CHAT" | head -c 180)"
if echo "$CHAT" | grep -q '"error"'; then
  echo "❌ chat 报错: $CHAT"
  exit 3
fi

echo "===== 2. 入池（SSH→Mac PG，幂等）====="
SQL="
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, concurrency, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT 'bazaarlink-free','openai','apikey',
  jsonb_build_object('api_key','${WKEY}','base_url','${BASE}','model_mapping', jsonb_build_object('Tuan','auto:free')),
  jsonb_build_object('model_mapping', jsonb_build_object('Tuan','auto:free'),'openai_responses_mode','force_chat_completions','openai_responses_supported',false,'openai_long_context_billing_enabled',false),
  'active', true, 1, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='bazaarlink-free' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable;
INSERT INTO account_groups (account_id, group_id)
SELECT a.id, 5 FROM accounts a WHERE a.name='bazaarlink-free' AND a.deleted_at IS NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
SELECT id,name,status,schedulable,priority,credentials->>'base_url' AS base FROM accounts WHERE name='bazaarlink-free' AND deleted_at IS NULL;
"
# 生成临时 WSL 可执行脚本（走 WSL→SSH→Mac，与 mac-add-*.sh 同模式）
W="/mnt/d/tdsh/sub2api/_bl_pool_$$.sh"
cat > "$W" <<REMOTE
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "\$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'SSH'
export PATH=/usr/local/opt/postgresql@16/bin:\$PATH
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
${SQL}
SQL
SSH
REMOTE
wsl.exe -e bash -c "bash '$W'" 2>&1
rm -f "$W"
echo "===== DONE: bazaarlink-free 入池（concurrency 1 / group 5 / prio 默认 DB 值）====="
