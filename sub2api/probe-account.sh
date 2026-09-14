#!/bin/bash
# 单号只读验真（跨平台通用，取代本会话的一次性 _tmp_olomc_probe/_tmp_pick48 脚本）
# 用法: bash probe-account.sh <账号id> [模型名]
#   例: bash probe-account.sh 48            # 用该号 model_mapping 里的模型
#       bash probe-account.sh 48 cb/deepseek-v4.1-flash
# 做三件事：/models 码 → chat 真出词 → 该号 picks 最近时间戳（判"是否真在接单"）
# 纪律：base_url/api_key 只在 Mac 内从 PG 读取并使用，**绝不打印、绝不出机**；本脚本零写操作。
# ⚠️ 已知缺陷（2026-09-14 本会话）：chat 段在 Mac 侧 bash 下偶发**无输出**（/models 与 picks 段正常），
#    未定位前请把本脚本当"凭据/映射/picks 取证"用；**要 chat 健康判据请用 free-pool-probe.sh**（全池版已实跑 37 号验证）。
#    待办：定位 chat 段吞输出的原因（怀疑与 set -u + 数组展开或 curl 输出文件有关）。
set -u
ID="${1:?用法: bash probe-account.sh <账号id> [模型名]}"
MO_ARG="${2:-}"
case "$ID" in (*[!0-9]*|'') echo "id 必须是数字"; exit 1;; esac
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 \
  "ID=$ID MO_ARG=$(printf '%q' "$MO_ARG") bash -s" <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
P="psql -h 127.0.0.1 -U postgres -d sub2api -At -F|"
NAME=$($P -c "SELECT name FROM accounts WHERE id=$ID AND deleted_at IS NULL")
[ -z "$NAME" ] && { echo "账号 $ID 不存在或已删除"; exit 1; }
BASE=$($P -c "SELECT coalesce(credentials->>'base_url','') FROM accounts WHERE id=$ID")
KEY=$($P -c "SELECT coalesce(credentials->>'api_key','') FROM accounts WHERE id=$ID")
ST=$($P -c "SELECT status||'/sched='||schedulable::text||'/prio='||priority::text||'/rate='||rate_multiplier::text FROM accounts WHERE id=$ID")
MO=$MO_ARG
[ -z "$MO" ] && MO=$($P -c "SELECT coalesce(credentials->'model_mapping'->>'Tuan','') FROM accounts WHERE id=$ID")
[ -z "$MO" ] && MO=$($P -c "SELECT coalesce((SELECT value FROM jsonb_each_text(credentials->'model_mapping') LIMIT 1),'') FROM accounts WHERE id=$ID")
echo "账号 #${ID} ${NAME}  [${ST}]"
echo "  base_url(库内): ${BASE:-（空）}   key: $([ -n "$KEY" ] && echo "已设置($(printf %s "$KEY" | wc -c) 字符，不打印)" || echo '（无 key = keyless 端点）')"
echo "  探活模型: ${MO:-（未指定，取 /models 第一个）}"
[ -n "$KEY" ] && HA=(-H "Authorization: Bearer $KEY") || HA=()
MC=$(curl -s -o /tmp/pa_m.json -m 20 -w '%{http_code}' "${HA[@]}" "${BASE%/}/models")
MIDS=$(python3 -c "
import json
try: d=json.load(open('/tmp/pa_m.json'))
except Exception: print(''); raise SystemExit
a=d.get('data') or d.get('items') or []
ids=[x.get('id') or '' for x in a if x.get('id')]
print(len(ids), ','.join(ids[:6]))" 2>/dev/null)
echo "  /models -> HTTP $MC  (n= ${MIDS})"
[ -z "$MO" ] && MO=$(python3 -c "
import json
try: d=json.load(open('/tmp/pa_m.json'))
except Exception: print(''); raise SystemExit
a=d.get('data') or d.get('items') or []
print((a[0].get('id') if a and a[0].get('id') else ''))" 2>/dev/null)
if [ -z "$MO" ]; then echo "  chat -> 跳过（既无映射也拿不到模型名）"; else
CC=$(curl -s -o /tmp/pa_c.json -m 90 -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  "${HA[@]}" -d "{\"model\":\"$MO\",\"max_tokens\":64,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
  "${BASE%/}/chat/completions")
python3 -c "
import json,re,sys
code,mo=sys.argv[1],sys.argv[2]
raw=open('/tmp/pa_c.json','rb').read().decode('utf8','ignore')
# 流式(SSE)端点回 "data: {...}" 而非裸 JSON（实测 16 tele-qwen 200 却非 JSON）→ 取第一个 data: 行
if not raw.lstrip().startswith('{'):
    for ln in raw.splitlines():
        s=ln.strip()
        if s.startswith('data:'): s=s[5:].strip()
        if s.startswith('{'): raw=s; break
try: d=json.loads(raw)
except Exception: print('  chat -> HTTP '+code+' 非JSON响应: '+raw[:90].replace(chr(10),' ')); raise SystemExit
ch=(d.get('choices') or [{}])[0]; msg=ch.get('message') or {}
c=str(msg.get('content') or '').strip(); rc=str(msg.get('reasoning_content') or '').strip()
fin=str(ch.get('finish_reason') or ''); err=str((d.get('error') or {}).get('message') or d.get('message') or '')
blob=(c+' '+err).lower()
silent=re.search(r'budget|quota|exhausted|rate.?limit|insufficient|try again later|invalid api key|api key used|无可用|额度.{0,6}用尽|payment required',blob)
print(f'  chat({mo}) -> HTTP {code}')
if code=='429': print('    🟡 限流(非坏号，等窗口或降并发): '+(err or raw[:60])[:80].replace(chr(10),' '))
elif code!='200':
    print('    ❌ 明确失败: '+ (err or raw[:80])[:90].replace(chr(10),' '))
elif silent: print('    🔴 静默失败(200+错误正文): \"'+(c or err)[:80]+'\"')
elif (c or rc or fin): print('    ✅ 可用  fin='+(fin or '-')+' 正文=\"'+c[:24]+'\"'+('  [reasoning_only 正文空属正常]' if (rc and not c) else ''))
else: print('    ⚠ 200 但无结构')
" "$CC" "$MO"
fi
$P -c "SELECT '  picks: 共 '||count(*)::text||' 条(7d)，最近 '||coalesce(to_char(max(created_at),'MM-DD HH24:MI:SS'),'无') FROM usage_logs WHERE account_id=$ID AND created_at > now() - interval '7 days'"
$P -c "SELECT '  最近错误(7d): '||coalesce(string_agg(DISTINCT left(error_message,70), ' | '),'无') FROM ops_error_logs WHERE account_id=$ID AND created_at > now() - interval '7 days'"
REMOTE
