#!/bin/bash
# 只读观察：18 号 pollinations 长期稳定性（usage 趋势/失败率/限流）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
echo "=== 18 号 usage 总量/区间/均延迟 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT count(*), min(created_at), max(created_at), round(avg(duration_ms))||'ms avg', percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_ms)::int||'ms p90' FROM usage_logs WHERE account_id=18"
echo "=== 18 号按小时分布 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT to_char(created_at,'MM-DD HH24:00') AS hr, count(*) FROM usage_logs WHERE account_id=18 GROUP BY 1 ORDER BY 1"
echo "=== 18 号相关 upstream 错误（全量）==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT count(*), string_agg(distinct left(error_body::text,60), ' | ') FROM ops_error_logs WHERE account_id=18"
echo "=== 网关整体近 5 分钟健康 ==="
psql -h 127.0.0.1 -U postgres -d sub2api -tAc "SELECT to_char(max(created_at),'HH24:MI:SS'), count(*) FROM usage_logs WHERE created_at > now() - interval '5 minutes'"
REMOTE