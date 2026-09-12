#!/bin/bash
# 修正 siliconflow-free 配置（降权+降并发）+ 恢复池
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "=== 降权+降并发 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "UPDATE accounts SET priority=90, concurrency=1, updated_at=now() WHERE id=17"
echo "=== 恢复其他账号 ==="
IDS=$(tr '\n' ',' < /tmp/iso.bak | sed 's/,$//')
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "UPDATE accounts SET schedulable=true WHERE id IN ($IDS)"
echo "=== 最终 17 号配置 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -x -c "SELECT id,name,status,schedulable,priority,concurrency,error_message,last_used_at FROM accounts WHERE id=17"
echo "=== 可调度账号（应 10 个含 17）==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,priority FROM accounts WHERE schedulable=true AND status='active' AND deleted_at IS NULL ORDER BY id"
REMOTE
