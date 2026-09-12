#!/bin/bash
# 取证：17 号 usage_logs 明细（修正列名）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "=== 17 号 usage_logs（近 30 分钟）==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT to_char(created_at,'HH24:MI:SS'), model, requested_model, upstream_model, upstream_response_model, duration_ms, first_token_ms, left(coalesce(user_agent,''),28) FROM usage_logs WHERE account_id=17 AND created_at > now() - interval '30 minutes' ORDER BY id"
echo "=== 行数统计 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT count(*) FROM usage_logs WHERE account_id=17"
REMOTE