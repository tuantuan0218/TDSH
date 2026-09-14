#!/bin/bash
# copilot 自动接续管线（Windows→WSL→SSH→Mac）
# 等 GitHub device-flow 授权落盘 -> 启动 4141 反代 -> 三步门验证 -> 全过才入池(兜底位 prio90/conc1/group5)
# 用法: bash gh-copilot-autopipe.sh [等待授权分钟数, 默认25]
WAIT_MIN="${1:-25}"
ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 "bash -s '$WAIT_MIN'" <<'REMOTE'
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
WAIT_MIN="${1:-25}"
TDIR="$HOME/.local/share/copilot-api"
LOGD="$HOME/copilot-api-run"
mkdir -p "$LOGD"
echo "[1/5] 等待 device-flow 授权落盘（最多 ${WAIT_MIN} 分钟）…"
deadline=$(( $(date +%s) + WAIT_MIN*60 ))
ok=0
while [ $(date +%s) -lt $deadline ]; do
  sz=$(stat -f %z "$TDIR/github_token" 2>/dev/null || echo 0)
  if [ "$sz" -gt 20 ]; then ok=1; echo "  ✅ token 已落盘 size=$sz"; break; fi
  sleep 10
done
if [ "$ok" != 1 ]; then echo "  ❌ 超时未授权（device code 可能已过期，需重跑 gh-co-auth.sh）"; exit 2; fi

echo "[2/5] 启动反代 4141"
if [ -x "$LOGD/start-copilot.sh" ]; then
  bash "$LOGD/start-copilot.sh" start 2>&1 | tail -3
else
  pkill -f "copilot-api.*start" 2>/dev/null; sleep 1
  nohup npx -y copilot-api@latest start --port 4141 --rate-limit 5 --wait > "$LOGD/copilot-api.log" 2>&1 &
  echo "  started pid=$! (无 start-copilot.sh，用 npx 直起)"
fi
sleep 20
code=$(curl -s -m 20 -o /tmp/cop_models.json -w '%{http_code}' http://127.0.0.1:4141/v1/models)
echo "  GET /v1/models -> $code"
[ "$code" != "200" ] && { echo "  ❌ models 不可用"; tail -15 "$LOGD/copilot-api.log"; exit 3; }

echo "[3/5] 三步门之模型探测（id 一律取实测，勿写死）"
MID=$(python3 - <<'PY'
import json,re
j=json.load(open('/tmp/cop_models.json'))
ids=[m.get('id') for m in j.get('data',[]) if m.get('id')]
print('COUNT',len(ids)); print('IDS',' '.join(ids[:40]))
pref=[i for i in ids if re.search(r'gpt-5|gpt-4o|claude|gemini',i,re.I)]
print('PICK ' + (pref[0] if pref else (ids[0] if ids else '')))
PY
) ; echo "$MID" | sed 's/^/  /'
MODEL=$(echo "$MID" | awk '/^PICK/{print $2}')
[ -z "$MODEL" ] && { echo "  ❌ 无可用模型（该号可能未开 Copilot）"; exit 4; }
echo "  选用 MODEL=$MODEL"

echo "[4/5] chat 单发 + 知识门"
r1=$(curl -s -m 90 -o /tmp/cop_c1.json -w '%{http_code}' -X POST http://127.0.0.1:4141/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"$MODEL\",\"max_tokens\":40,\"messages\":[{\"role\":\"user\",\"content\":\"ping, reply with the single word pong\"}]}")
c1=$(python3 -c "import json;d=json.load(open('/tmp/cop_c1.json'));print(repr(((d.get('choices') or [{}])[0].get('message') or {}).get('content'))[:80])" 2>/dev/null)
echo "  chat1 -> $r1 content=$c1"
r2=$(curl -s -m 90 -o /tmp/cop_c2.json -w '%{http_code}' -X POST http://127.0.0.1:4141/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"$MODEL\",\"max_tokens\":60,\"messages\":[{\"role\":\"user\",\"content\":\"What is 17 times 23? Answer with only the number.\"}]}")
c2=$(python3 -c "import json;d=json.load(open('/tmp/cop_c2.json'));print(((d.get('choices') or [{}])[0].get('message') or {}).get('content') or '')" 2>/dev/null)
echo "  chat2 -> $r2 answer=$c2"
echo "$c2" | grep -q "391" || { echo "  ❌ 知识门未过（假服务/空响应），拒绝入池"; exit 5; }
[ "$r1" = "200" ] || { echo "  ❌ chat1 非 200，拒绝入池"; exit 5; }

echo "[5/5] 入池（幂等，兜底位 prio 90 / concurrency 1 / group 5）"
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
MAP="jsonb_build_object('Tuan','$MODEL','$MODEL','$MODEL')"
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, priority, concurrency, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT
  'copilot-free','openai','apikey',
  jsonb_build_object('api_key','copilot-local','base_url','http://127.0.0.1:4141/v1','model_mapping',${MAP}),
  jsonb_build_object('model_mapping',${MAP},'openai_responses_mode','force_chat_completions','openai_responses_supported',false,'openai_long_context_billing_enabled',false),
  'active', true, 90, 1, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable, priority;
-- ⚠️ 硬知识（FREE-LANE-HANDOVER #1）：裸 SQL 不写 scheduler_outbox → 号永不进调度快照、永不接单
INSERT INTO scheduler_outbox (event_type, account_id, group_id, payload)
SELECT 'account_changed', a.id, NULL, NULL FROM accounts a
WHERE a.name='copilot-free' AND a.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM scheduler_outbox o WHERE o.account_id=a.id);
SQL
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
INSERT INTO account_groups (account_id, group_id, priority)
SELECT a.id, 5, 1 FROM accounts a WHERE a.name='copilot-free' AND a.deleted_at IS NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
SQL
echo "--- 核对（含 outbox 事件）---"
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,status,schedulable,priority,credentials->>'base_url' AS base, credentials->'model_mapping'->>'Tuan' AS maps_to, extra->>'openai_responses_mode' AS resp_mode FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL"
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT account_id,group_id FROM account_groups WHERE account_id=(SELECT id FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL)"
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT 'outbox_events='||count(*) FROM scheduler_outbox WHERE account_id=(SELECT id FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL)"
echo "  ✅ 管线完成：copilot-free 已入池（MODEL=$MODEL，含 scheduler_outbox 事件）"
REMOTE
