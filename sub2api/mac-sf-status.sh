#!/bin/bash
# 查 17 号网关侧状态：error/temp_unschedulable/last_used + 今日统计 + 缓存时间线
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "===17_ROW==="
psql -h 127.0.0.1 -U postgres -d sub2api -x -c "SELECT id,name,status,schedulable,error_message,last_used_at,created_at,updated_at FROM accounts WHERE id=17"
echo "===TEMP_UNSCHED==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT temp_unschedulable_until, temp_unschedulable_reason FROM accounts WHERE id=17" 2>&1
echo "===GROUP5_MEMBERS_SCHEDULABLE==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT a.id,a.name,a.schedulable,a.status FROM account_groups g JOIN accounts a ON a.id=g.account_id WHERE g.group_id=5 AND a.deleted_at IS NULL ORDER BY a.id"
echo "===RECENT_OPS_ERRORS==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT created_at,status_code,error_owner,left(coalesce(error_message,''),90) FROM ops_error_logs WHERE created_at > now() - interval '3 minutes' ORDER BY id DESC LIMIT 8" 2>&1
REMOTE
