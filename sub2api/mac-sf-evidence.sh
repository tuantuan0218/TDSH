#!/bin/bash
# 快速隔离→单发→取证→恢复（一个 SSH 会话内完成，抢在网关回写缓存前拿路由铁证）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
PSQL="psql -h 127.0.0.1 -U postgres -d sub2api"
echo "=== 1. 记录+下线 ==="
$PSQL -tAc "SELECT id FROM accounts WHERE id<>17 AND deleted_at IS NULL AND schedulable=true AND status='active' ORDER BY id" | tr -d ' ' | grep -E '^[0-9]+$' > /tmp/iso.bak
IDS=$(tr '\n' ',' < /tmp/iso.bak | sed 's/,$//')
$PSQL -tAc "UPDATE accounts SET schedulable=false WHERE id IN ($IDS)"
echo "=== 2. usage_logs 列名 ==="
$PSQL -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='usage_logs' ORDER BY ordinal_position" | tr '\n' ' '
echo ""
echo "=== 3. 当前 17 号 usage 行数（基线）==="
$PSQL -tAc "SELECT count(*) FROM usage_logs WHERE account_id=17" 2>&1
echo "BACKUP_IDS: $(cat /tmp/iso.bak | tr '\n' ' ')"
REMOTE
