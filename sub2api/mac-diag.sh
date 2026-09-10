#!/bin/bash
# Mac sub2api 一键诊断:TTFT 高 + 上游错误率高 + SLA 低 + 健康分低
# 用法: BASE=http://127.0.0.1:PORT ADMIN_KEY=xxx ./mac-diag.sh
# 只读查询,不改任何配置。API 不通时可用 --sql 模式直查库:
#   ./mac-diag.sh --sql "postgres://user:pass@127.0.0.1:5432/sub2api?sslmode=disable"
set -u
BASE="${BASE:-http://127.0.0.1:8080}"
KEY="${ADMIN_KEY:-${SUB2API_ADMIN_KEY:-}}"

if [ "${1:-}" = "--sql" ]; then
  DSN="${2:-${PGDSN:-}}"
  [ -z "$DSN" ] && { echo "need DSN: $0 --sql <postgres-dsn> (or PGDSN env)"; exit 1; }
  command -v psql >/dev/null || { echo "need psql"; exit 1; }
  echo "=== 上游错误 Top(近2h,按账号/状态码分组) ==="
  psql "$DSN" -c "
SELECT account_id, upstream_status_code, count(*) n,
       left(max(error_message),100) example
FROM ops_error_logs
WHERE created_at > now()-interval '2 hours'
  AND error_owner='provider' AND NOT is_business_limited
GROUP BY 1,2 ORDER BY n DESC LIMIT 15;"
  echo "=== 请求错误 Top(近2h,用户可见) ==="
  psql "$DSN" -c "
SELECT account_id, status_code, count(*) n,
       left(max(error_message),100) example
FROM ops_error_logs
WHERE created_at > now()-interval '2 hours'
  AND status_code>=400 AND NOT is_business_limited
GROUP BY 1,2 ORDER BY n DESC LIMIT 15;"
  echo "=== 口径速算(对齐面板,含预聚合一致性说明) ==="
  # 注意:面板近5分钟走直查、历史走预聚合(ops_metrics_hourly),两者口径一致
  # (error_agg:upstream_excl 不要求 status>=400; 都排除 is_count_tokens)。
  # 唯一已知差异:预聚合 usage 侧 INNER JOIN groups,无 group 的成功行会丢;
  # 误差方向:分母偏小 → 错误率/SLA 偏悲观。小流量窗口建议以直查为准。
  psql "$DSN" -c "
WITH s AS (SELECT count(*) c FROM usage_logs WHERE created_at > now()-interval '2 hours'),
     e AS (SELECT count(*) FILTER (WHERE status_code>=400 AND NOT is_business_limited) sla_err,
                  count(*) FILTER (WHERE error_owner='provider' AND NOT is_business_limited
                    AND coalesce(upstream_status_code,status_code,0) NOT IN (429,529)) up_err
           FROM ops_error_logs WHERE created_at > now()-interval '2 hours'
             AND is_count_tokens = FALSE)
SELECT s.c success, e.sla_err, e.up_err,
  round(100.0*s.c/(s.c+e.sla_err),2) AS sla_pct,
  round(100.0*e.sla_err/(s.c+e.sla_err),2) AS err_pct,
  round(100.0*e.up_err/(s.c+e.sla_err),2) AS upstream_pct
FROM s,e;"
  echo "判读: upstream_pct>>err_pct → failover 在救; 401/403=号废; 429=限流; 529/5xx=过载或代理抖"
  exit 0
fi

[ -z "$KEY" ] && { echo "need ADMIN_KEY env"; exit 1; }
command -v curl >/dev/null || { echo "need curl"; exit 1; }
H=(-s --max-time 15 -H "Authorization: Bearer $KEY")
fail=0

echo "=== 0. 自检 ==="
code=$(curl "${H[@]}" -o /dev/null -w "%{http_code}" "$BASE/api/v1/admin/ops/dashboard/overview" || echo 000)
echo "overview http=$code (000/401/403 → 检查 BASE/ADMIN_KEY; 5xx → 服务本身有问题)"
[ "$code" != "200" ] && { echo "自检失败,改用 --sql 模式直查库"; exit 2; }

echo; echo "=== 1. 总览(确认五个指标) ==="
curl "${H[@]}" "$BASE/api/v1/admin/ops/dashboard/overview" | python3 -m json.tool | head -60 || fail=1

echo; echo "=== 2. 上游错误(含已恢复,看 proxy/账号/状态码) ==="
# 注意:列表项只有基础字段(proxy 归因在详情 upstream_errors 数组里);
# 详情端点 GET /api/v1/admin/ops/upstream-errors/:id 返回 OpsErrorLogDetail
# (upstream_status_code/message/detail + upstream_errors JSON 数组,每项含 proxy_id/proxy_name)。
curl "${H[@]}" "$BASE/api/v1/admin/ops/upstream-errors?page=1&page_size=10" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('data',d) if isinstance(d,dict) else d
items=items.get('items',items) if isinstance(items,dict) else items
print('count=', len(items or []))
first=None
for e in (items or [])[:10]:
    first = first or e.get('id')
    print(e.get('id'), '|', e.get('created_at'), '| status=',e.get('status_code'),
          '| acct=',e.get('account_id'), '| model=',e.get('model'),
          '|', str(e.get('message'))[:120])
if first:
    print('取第一条详情看 proxy 归因: /api/v1/admin/ops/upstream-errors/%s' % first)
" || fail=1
FIRST_ID=$(curl "${H[@]}" "$BASE/api/v1/admin/ops/upstream-errors?page=1&page_size=1" | python3 -c "import json,sys;d=json.load(sys.stdin);i=d.get('data',d);i=i.get('items',i) if isinstance(i,dict) else i;print((i or [{}])[0].get('id',''))" 2>/dev/null)
if [ -n "$FIRST_ID" ]; then
  echo "--- 最新上游错误详情 id=$FIRST_ID (proxy/重试链) ---"
  curl "${H[@]}" "$BASE/api/v1/admin/ops/upstream-errors/$FIRST_ID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
e=d.get('data',d) if isinstance(d,dict) else d
print('upstream_status=',e.get('upstream_status_code'),'| msg=',str(e.get('upstream_error_message'))[:200])
import json as j
try: evs=j.loads(e.get('upstream_errors') or '[]')
except Exception: evs=[]
for v in evs[:8]:
    print(' attempt:',v.get('created_at'),'| acct=',v.get('account_id') or v.get('account'),
          '| proxy=',v.get('proxy_name'),'| status=',v.get('status') or v.get('upstream_status_code'),
          '| stage=',v.get('stage'),'|',str(v.get('message'))[:120])
" || true
fi

echo; echo "=== 3b. 渠道监控矩阵(平台×模型,定位坏池,需开 channel-monitor-v2) ==="
curl "${H[@]}" "$BASE/api/v1/admin/channel-monitor-v2/matrix?range=24h&group_by=platform_model" \
  | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception as ex: print('matrix 不可用(功能未开或版本不支持):',ex); raise SystemExit
m=d.get('data',d) if isinstance(d,dict) else d
rows=m.get('rows',m.get('matrix',[])) if isinstance(m,dict) else m
def rate(r):
    met=r.get('metrics',r)
    return met.get('error_rate', met.get('errorRate'))
rows=sorted((r for r in (rows or []) if r), key=lambda r: (rate(r) or 0), reverse=True)
print('按错误率 Top 8:')
for r in rows[:8]:
    print(' ',r.get('platform'),r.get('model'),'| err=',rate(r),'| ttft_p50=',(r.get('metrics',r).get('ttft_p50_ms') if isinstance(r.get('metrics',r),dict) else None))
" 2>/dev/null || echo "(跳过:channel-monitor-v2 未启用,不影响主流程)"

echo; echo "=== 4. 请求错误(用户可见失败,关联上游) ==="
# 字段名以 OpsErrorLog 为准:message(非 error_message),model,account_id/account_name。
curl "${H[@]}" "$BASE/api/v1/admin/ops/request-errors?page=1&page_size=10" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
items=d.get('data',d) if isinstance(d,dict) else d
items=items.get('items',items) if isinstance(items,dict) else items
print('count=', len(items or []))
for e in (items or [])[:10]:
    print(e.get('id'), '|', e.get('created_at'), '| status=',e.get('status_code'),
          '| acct=',e.get('account_id'), '| model=',e.get('model'),
          '|', str(e.get('message'))[:120])
    print('   关联上游: /api/v1/admin/ops/request-errors/%s/upstream-errors' % e.get('id'))
" || fail=1

echo; echo "=== 5. 判读 ==="
echo "upstream 条数 >> request 条数 → failover 在救,差值=救回数"
echo "401/403 → 账号token废; 429 → 限流; 529/5xx/timeout → 过载或代理抖"
echo "proxy 集中在某一个 → 代理锅; 分散在 1-2 个 acct → 坏号,禁用即回绿"
[ "$fail" != "0" ] && { echo "部分步骤失败,改用 --sql 模式"; exit 3; }
