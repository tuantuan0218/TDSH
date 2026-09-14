#!/bin/bash
# 全池"免费/公益号"探活（只读）—— 与 free-lane-audit.mjs 的区别是本脚本以**网关库为准**：
#   base_url / api_key / model_mapping 全部取自 PG accounts，不依赖仓外 site-accounts.json。
# 动机（2026-09-14 实证）：audit 用 store 的纯主机名 base 拼 '/v1/chat/completions'，
#   与网关库真实 base_url（如 https://voyager.olomc.top/gw/v1）不一致 → 404 → 3 次重试全 BAD
#   → 误荐停池（olomc-free/48 号就是这样被冤枉的，号从来没坏）。store 覆盖也只有 26/44 号。
# 复用已验证的判据（同 probe-dormant.sh）：
#   1) key 只在 Mac 内使用，绝不打印、绝不出机
#   2) 状态码与正文形态分开判：非200=明确失败；200+错误正文=静默失败(假成功)；
#      200+content/reasoning_content/finish_reason 任一存在=可用（推理模型小预算会把 content 留空，那不是坏）
#   3) 402/429 分「token 级(可救)」与「账号级余额(只能充值)」
#   4) 便宜判据：max_tokens=64（够拿到 fin/reasoning，不烧额度）
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
P="psql -h 127.0.0.1 -U postgres -d sub2api -At -F|"
# 选号：免费/公益特征的号（含本会话与并发会话加的）
IDS=$($P -c "SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND coalesce(credentials->>'base_url','')<>'' AND (a.name ~* '(free|columbina|pollinat|xzt|aitools|xuanwu|freemodel|olomc|tokenrouter|hub-linuxdo|wb2api|tele-)') ORDER BY a.id")
N=$(echo $IDS | wc -w)
echo "全池免费/公益号（有 base_url）: $N 个"
printf '%-5s %-22s %-12s %-6s %-6s %s\n' ID NAME STATUS MOD CHAT VERDICT
for ID in $IDS; do
  NAME=$($P -c "SELECT name FROM accounts WHERE id=$ID")
  BASE=$($P -c "SELECT credentials->>'base_url' FROM accounts WHERE id=$ID")
  KEY=$($P -c "SELECT coalesce(credentials->>'api_key','') FROM accounts WHERE id=$ID")
  ST=$($P -c "SELECT status||'/'||schedulable::text FROM accounts WHERE id=$ID")
  # 探活模型：优先该号自己的 Tuan 映射（别名流量真正用的），回退 deepseek-v4.1-flash 类显式名，再回退 common
  MO=$($P -c "SELECT coalesce(credentials->'model_mapping'->>'Tuan','') FROM accounts WHERE id=$ID")
  [ -z "$MO" ] && MO=$($P -c "SELECT coalesce((SELECT value FROM jsonb_each_text(credentials->'model_mapping') LIMIT 1),'') FROM accounts WHERE id=$ID")
  M=$(curl -s -o /tmp/ppm.json -m 15 -w '%{http_code}' -H "Authorization: Bearer $KEY" "${BASE%/}/models")
  if [ -z "$MO" ]; then
    MO=$(python3 -c "
import json,re
try: d=json.load(open('/tmp/ppm.json'))
except Exception: print(''); raise SystemExit
a=d.get('data') or d.get('items') or []
ids=[x.get('id') or '' for x in a if x.get('id')]
cheap=[i for i in ids if re.search(r'flash|lite|mini|small|turbo|free|express',i,re.I)]
print((cheap or ids)[:1][0] if (cheap or ids) else '')" 2>/dev/null)
  fi
  if [ -z "$KEY" ]; then
    # keyless 端点（pollinations/xzt 等）：无 api_key 也照打，只是不带 Authorization
    printf '%-5s %-22s %-12s %-6s %-6s %s\n' "$ID" "$NAME" "$ST" "$M" "-" "⚪ keyless(store 外，无 api_key)"
    continue
  fi
  if [ -z "$MO" ]; then
    printf '%-5s %-22s %-12s %-6s %-6s %s\n' "$ID" "$NAME" "$ST" "$M" "-" "⚪ 拿不到模型名"
    continue
  fi
  CC=$(curl -s -o /tmp/ppc.json -m 60 -w '%{http_code}' -X POST \
    -H "Content-Type: application/json" -H "Authorization: Bearer $KEY" \
    -d "{\"model\":\"$MO\",\"max_tokens\":64,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
    "${BASE%/}/chat/completions")
  V=$(python3 -c "
import json,re,sys
code=sys.argv[1]
raw=open('/tmp/ppc.json','rb').read().decode('utf8','ignore')
# 流式(SSE)端点会回 "data: {...}" 而非裸 JSON（实测 16 tele-qwen 200 却非 JSON）→ 取第一个 data: 行解析
if not raw.lstrip().startswith('{'):
    for ln in raw.splitlines():
        s=ln.strip()
        if s.startswith('data:'): s=s[5:].strip()
        if s.startswith('{'): raw=s; break
try: d=json.loads(raw)
except Exception: print('❌ 非JSON(HTTP'+code+') 前60字:'+raw[:60].replace(chr(10),' ')); raise SystemExit
ch=(d.get('choices') or [{}])[0]
msg=ch.get('message') or {}
c=str(msg.get('content') or '').strip()
rc=str(msg.get('reasoning_content') or '').strip()
fin=str(ch.get('finish_reason') or '')
err=str((d.get('error') or {}).get('message') or d.get('message') or '')
blob=(c+' '+err).lower()
silent=re.search(r'budget|quota|exhausted|rate.?limit|insufficient|try again later|invalid api key|api key used|无可用|额度.{0,6}用尽|payment required',blob)
if code=='429': print('🟡 限流(非坏号，等窗口或降并发) '+err[:30])
elif code!='200':
    if 'token quota' in blob or 'remain quota' in blob: print('🟡 HTTP'+code+' token级(重发token可救) '+err[:30])
    elif 'balance' in blob or '充值' in err or '余额' in err or 'payment required' in blob or '额度不足' in err: print('🔴 HTTP'+code+' 账号级余额(只能充值) '+err[:26])
    elif 'not found' in blob or 'does not exist' in blob: print('⚪ HTTP'+code+' 无此模型 '+err[:24])
    else: print('❌ HTTP'+code+' '+err[:34])
elif silent: print('🔴 200假成功(正文即错误) \"'+ (c or err)[:26] +'\"')
elif (c or rc or fin): print('✅可用 \"'+((c or rc)[:10] or '')+'\" fin='+(fin or '-')+(' think' if (rc and not c) else ''))
else: print('⚠ 200无结构')
" "$CC" 2>/dev/null)
  printf '%-5s %-22s %-12s %-6s %-6s %s\n' "$ID" "$NAME" "$ST" "$M" "$CC" "$V"
done
echo "说明：MOD/CHAT 是 HTTP 码；✅可用=非静默且(有正文|有reasoning|有finish_reason)；🔴200假成功=200但正文是预算/鉴权错误"
REMOTE
