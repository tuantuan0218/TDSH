#!/bin/bash
# Mac PG 只读探测：现有账号表结构参照（tele-qwen 行）+ 是否已有 siliconflow + 总数
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "===CONNECT_TEST==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT 'CONNECT_OK', version();" 2>&1 | head -1
echo "===EXISTING_SILICONFLOW==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,status,schedulable,priority FROM accounts WHERE name LIKE '%silicon%' AND deleted_at IS NULL;" 2>&1
echo "===ACCOUNT_COUNT==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT count(*) FROM accounts WHERE deleted_at IS NULL;" 2>&1
echo "===TELE_QWEN_ROW(参照)==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,platform,type,status,schedulable,priority,concurrency,credentials->>'base_url',credentials->'model_mapping'->>'Tuan',extra->>'openai_responses_supported',extra->>'openai_responses_mode' FROM accounts WHERE name='tele-qwen' AND deleted_at IS NULL;" 2>&1
echo "===TELE_QWEN_GROUPS==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT account_id,group_id,priority FROM account_groups WHERE account_id=(SELECT id FROM accounts WHERE name='tele-qwen');" 2>&1
echo "===SCHEDULABLE_ACCOUNTS==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,priority FROM accounts WHERE deleted_at IS NULL AND schedulable=true AND status='active' ORDER BY priority DESC;" 2>&1
REMOTE
