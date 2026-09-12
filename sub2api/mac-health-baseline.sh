#!/bin/bash
# 只读：17/18 号当前状态 + 池整体分布（健康基线）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "=== 17/18 号状态 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,status,schedulable,priority,coalesce(error_message,'') FROM accounts WHERE id IN (17,18) ORDER BY id"
echo "=== 池今日用量 Top8 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT upstream_model, count(*) FROM usage_logs WHERE created_at > date_trunc('day', now()) GROUP BY upstream_model ORDER BY 2 DESC LIMIT 8"
echo "=== 可调度活跃账号数 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT count(*) FROM accounts WHERE schedulable=true AND status='active' AND deleted_at IS NULL"
REMOTE