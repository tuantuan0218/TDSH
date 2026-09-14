#!/usr/bin/env bash
# 只读：打印 olomc-free 48 号 credentials 的**字段名列表**（不含值），用于定位 key 字段名
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -At -c "SELECT jsonb_object_keys(credentials) FROM (SELECT credentials FROM accounts WHERE id=48) x"
REMOTE
