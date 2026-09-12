#!/bin/bash
# siliconflow 路由隔离验证 - 步骤 A: 下线其余账号（只留 17，恢复名单落盘 isolate-backup.txt）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "=== 下线前 17 号状态 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,schedulable FROM accounts WHERE id=17"
echo "=== 记录并下线其他活跃账号 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id FROM accounts WHERE id<>17 AND deleted_at IS NULL AND schedulable=true AND status='active' ORDER BY id" | tr -d ' ' | grep -E '^[0-9]+$' > /tmp/isolate-backup.txt
cat /tmp/isolate-backup.txt
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "UPDATE accounts SET schedulable=false WHERE id<>17 AND deleted_at IS NULL AND schedulable=true AND status='active'"
echo "=== 下线后仍可调度 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name FROM accounts WHERE schedulable=true AND status='active' AND deleted_at IS NULL"
REMOTE
