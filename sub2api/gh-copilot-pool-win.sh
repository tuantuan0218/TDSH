#!/bin/bash
# copilot-free（Windows 本机反代版）一键入池 — 读 gh-copilot-win-ready.json 的 base/model，走 WSL→SSH→Mac PG
# 用法: bash gh-copilot-pool-win.sh [--print]   (--print 只打印 SQL，可手动在 Mac 执行，绕开 SSH)
# 与 Mac 侧 copilot-pool.sh 的差异：base_url 指向 Windows LAN (192.168.1.8:4141)，Mac 网关可回连
set -u
READY="D:/tdsh/sub2api/gh-copilot-win-ready.json"
WINJSON=$(node -e "try{const c=require('D:/tdsh/sub2api/gh-copilot-win-ready.json');console.log(c.base+'|'+c.model)}catch(e){console.log('')}")
BASE=$(echo "$WINJSON" | cut -d'|' -f1)
MID=$(echo "$WINJSON" | cut -d'|' -f2)
if [ -z "$BASE" ]; then echo "❌ gh-copilot-win-ready.json 不存在/不完整——先跑 node gh-copilot-win-pipeline.mjs（三步门全过才会写此文件）"; exit 1; fi
echo "入池参数: base=$BASE model=$MID name=copilot-free prio=90 conc=1 group=5(兜底)"
SQL="
INSERT INTO accounts (name, platform, type, credentials, extra, status, schedulable, concurrency, priority, rate_multiplier, quota_dimension, auto_pause_on_expired)
SELECT 'copilot-free','openai','apikey',
  jsonb_build_object('api_key','copilot-local-proxy','base_url','${BASE}','model_mapping', jsonb_build_object('Tuan','${MID}')),
  jsonb_build_object('model_mapping', jsonb_build_object('Tuan','${MID}'),'openai_responses_mode','force_chat_completions','openai_responses_supported',false,'openai_long_context_billing_enabled',false),
  'active', true, 1, 90, 1.0, 'global', true
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL)
RETURNING id, name, status, schedulable;
INSERT INTO scheduler_outbox (event_type, account_id, group_id, payload)
SELECT 'account_changed', a.id, NULL, NULL FROM accounts a
WHERE a.name='copilot-free' AND a.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM scheduler_outbox o WHERE o.account_id=a.id);
INSERT INTO account_groups (account_id, group_id)
SELECT a.id, 5 FROM accounts a WHERE a.name='copilot-free' AND a.deleted_at IS NULL
ON CONFLICT (account_id, group_id) DO NOTHING;
SELECT id,name,status,schedulable,priority,credentials->>'base_url' AS base FROM accounts WHERE name='copilot-free' AND deleted_at IS NULL;
"
if [ "${1:-}" = "--print" ]; then echo "----- SQL (复制到 Mac 的 psql -h 127.0.0.1 -U postgres -d sub2api 执行) -----"; echo "$SQL"; exit 0; fi
W="/tmp/_ghcop_pool_$$.sh"
cat > "$W" <<REMOTE
ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new zhaozicheng@192.168.1.3 'bash -s' <<'SSH'
export PATH=/usr/local/opt/postgresql@16/bin:\$PATH
psql -h 127.0.0.1 -U postgres -d sub2api <<SQL
${SQL}
SQL
SSH
REMOTE
echo "===== 执行入池（WSL→SSH→Mac）====="
wsl.exe -e bash -c "bash -s" < "$W" 2>&1
rm -f "$W"
echo "===== 完毕；T+10min 用 usage_logs picks 核对是否真接单 ====="
