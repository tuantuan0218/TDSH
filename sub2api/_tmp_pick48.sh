#!/usr/bin/env bash
# 只读：48号(olomc-free)最近一条 usage_logs picks 时间戳 + audit BAD 时刻对照
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -At -c "SELECT to_char(max(created_at),'YYYY-MM-DD HH24:MI:SS') FROM usage_logs WHERE account_id=48"
REMOTE
