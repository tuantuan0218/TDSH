#!/bin/bash
# siliconflow 路由隔离验证 - 步骤 C: 恢复原有账号 schedulable（读 /tmp/isolate-backup.txt）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "=== 恢复名单 ==="
cat /tmp/isolate-backup.txt 2>/dev/null || echo NO_BACKUP_FILE
IDS=$(tr '\n' ',' < /tmp/isolate-backup.txt 2>/dev/null | sed 's/,$//')
if [ -n "$IDS" ]; then
  psql -h 127.0.0.1 -U postgres -d sub2api -tAc "UPDATE accounts SET schedulable=true WHERE id IN ($IDS)"
fi
echo "=== 恢复后可调度账号（应为 10 个，含 17）==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT id,name,priority FROM accounts WHERE schedulable=true AND status='active' AND deleted_at IS NULL ORDER BY id"
REMOTE
