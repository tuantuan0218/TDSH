#!/bin/bash
# 单号只读验真（跨平台通用）
# 用法: bash probe-account.sh <账号id> [模型名]
#   例: bash probe-account.sh 48
#       bash probe-account.sh 48 cb/deepseek-v4.1-flash
# 输出四段：凭据形态（不打印 key 值）→ /models → chat 真出词 → 该号 picks 与近期错误
# 纪律：base_url/api_key 只在 Mac 内从 PG 读取并使用，**绝不打印、绝不出机**；本脚本零写操作。
#
# 判据（本会话踩坑固化，勿改回）：
#   1) 状态码与正文形态分开判：非200=明确失败；200+错误正文=静默失败(假成功)；200+有内容/有finish_reason=可用
#   2) 推理模型 max_tokens 小时 content 恒空、token 全在 reasoning_content + fin=length → 那是探针预算问题，不是号坏
#   3) 流式(SSE)端点回 data:{...} 分片（实测 16 tele-qwen），正文在 choices[].delta.content 而非 message.content
#      → 必须逐分片累积，否则会把好的号判成"200 无结构"
#   4) 402/429/403 分「token 级(可重发)」「账号级余额(只能充值)」「并发/限流(非坏)」
#   5) 429 是限流不是坏号：本脚本连打同一个号就会撞 maxConcurrent，须结合 picks 判读
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
KL=$([ -n "$KEY" ] && printf %s "$KEY" | wc -c | tr -d ' ' || echo 0)
MO=$MO_ARG
[ -z "$MO" ] && MO=$($P -c "SELECT coalesce(credentials->'model_mapping'->>'Tuan','') FROM accounts WHERE id=$ID")
[ -z "$MO" ] && MO=$($P -c "SELECT coalesce((SELECT value FROM jsonb_each_text(credentials->'model_mapping') LIMIT 1),'') FROM accounts WHERE id=$ID")
echo "账号 #${ID} ${NAME}  [${ST}]"
echo "  base_url(库内): ${BASE:-（空）}   key: $([ -n "$KEY" ] && echo "已设置(${KL} 字符，不打印)" || echo '（无 key = keyless 端点）')"
echo "  探活模型: ${MO:-（未指定，将取 /models 第一个）}"
if [ -n "$KEY" ]; then HA=(-H "Authorization: Bearer $KEY"); else HA=(); fi
MC=$(curl -s -o /tmp/pa_m.json -m 20 -w '%{http_code}' "${HA[@]}" "${BASE%/}/models")
MSUM=$(python3 -c '
import json
try: d=json.load(open("/tmp/pa_m.json"))
except Exception: print("解析失败"); raise SystemExit
a=d.get("data") or d.get("items") or []
ids=[x.get("id") or "" for x in a if x.get("id")]
print("n="+str(len(ids))+" "+",".join(ids[:6])+(" ..." if len(ids)>6 else ""))' 2>/dev/null || echo 解析失败)
echo "  /models -> HTTP $MC  ($MSUM)"
[ -z "$MO" ] && MO=$(python3 -c '
import json
try: d=json.load(open("/tmp/pa_m.json"))
except Exception: print(""); raise SystemExit
a=d.get("data") or d.get("items") or []
print((a[0].get("id") if a and a[0].get("id") else ""))' 2>/dev/null)
if [ -z "$MO" ]; then
  echo "  chat -> 跳过（既无映射也拿不到模型名）"
else
  CC=$(curl -s -o /tmp/pa_c.json -m 90 -w '%{http_code}' -X POST -H "Content-Type: application/json" \
    "${HA[@]}" -d "{\"model\":\"$MO\",\"max_tokens\":64,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
    "${BASE%/}/chat/completions")
  # 注意：这段 python 用**单引号定界**，内部一律双引号，避免 bash 双引号被裸引号提前终结（本会话实测踩过的坑）
  V=$(python3 -c '
import json,re,sys
code=sys.argv[1]
raw=open("/tmp/pa_c.json","rb").read().decode("utf8","ignore")
chunks=[]
if raw.lstrip().startswith("{"):
    try: chunks=[json.loads(raw)]
    except Exception: chunks=[]
else:
    for ln in raw.splitlines():
        s=ln.strip()
        if s.startswith("data:"): s=s[5:].strip()
        if s.startswith("{"):
            try: chunks.append(json.loads(s))
            except Exception: pass
content=""; reasoning=""; fin=""; err=""
for ck in chunks:
    ch=(ck.get("choices") or [{}])[0]
    msg=ch.get("message") or ch.get("delta") or {}
    content += str(msg.get("content") or "")
    reasoning += str(msg.get("reasoning_content") or "")
    fin = fin or str(ch.get("finish_reason") or "")
    err = err or str((ck.get("error") or {}).get("message") or ck.get("message") or "")
if not chunks:
    print("  chat -> HTTP "+code+" 非JSON响应: "+raw[:90].replace(chr(10)," ")); raise SystemExit
blob=(content+" "+err).lower()
silent=re.search(r"budget|quota|exhausted|rate.?limit|insufficient|try again later|invalid api key|api key used|无可用|额度.{0,6}用尽|payment required",blob)
print("  chat -> HTTP "+code)
if code=="429": print("    🟡 限流/并发上限（非坏号，等窗口或降并发；结合下面 picks 判读）: "+(err or content or raw[:60])[:70].replace(chr(10)," "))
elif code!="200":
    if "token quota" in blob or "remain quota" in blob: print("    🟡 token级（重发token/提额度可救）: "+err[:60])
    elif "balance" in blob or "充值" in err or "余额" in err or "额度不足" in err or "payment required" in blob: print("    🔴 账号级余额（只能充值）: "+err[:60])
    elif "not found" in blob or "does not exist" in blob: print("    ⚪ 无此模型: "+err[:60])
    else: print("    ❌ 明确失败: "+(err or raw[:70])[:70].replace(chr(10)," "))
elif silent: print("    🔴 静默失败(200+错误正文，用户会看到垃圾): "+(content or err)[:70].replace(chr(10)," "))
elif (content.strip() or reasoning.strip() or fin):
    note="  [仅 reasoning，正文空属推理模型正常]" if (reasoning.strip() and not content.strip()) else ""
    print("    ✅ 可用  fin="+(fin or "-")+" 正文="+repr(content.strip()[:28])+note)
else: print("    ⚠ 200 但无结构（分片里既无正文也无 finish_reason）")
' "$CC" 2>/dev/null)
  [ -z "$V" ] && V="  chat -> HTTP $CC 但判读失败（python 异常，看 /tmp/pa_c.json）"
  echo "$V"
fi
$P -c "SELECT '  picks: 共 '||count(*)::text||' 条(7d)，最近 '||coalesce(to_char(max(created_at),'MM-DD HH24:MI:SS'),'无') FROM usage_logs WHERE account_id=$ID AND created_at > now() - interval '7 days'"
$P -c "SELECT '  最近错误(7d): '||coalesce(string_agg(DISTINCT left(error_message,70), ' | '),'无') FROM ops_error_logs WHERE account_id=$ID AND created_at > now() - interval '7 days'"
REMOTE
