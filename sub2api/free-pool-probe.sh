#!/bin/bash
# 全池"免费/公益号"探活（只读）—— **以网关库为唯一事实源**
#   base_url / api_key / model_mapping 全部取自 PG accounts，不依赖仓外 site-accounts.json。
# 动机（2026-09-14 实证）：free-lane-audit.mjs 用 store 的纯主机名 base 拼 /v1/chat/completions，
#   与网关库真实 base_url（如 https://voyager.olomc.top/gw/v1）不一致 → 404 → 3 次重试全 BAD
#   → 误荐停池（olomc-free/48 就是这样被冤枉的，号从来没坏）；且 store 只覆盖 26/44 号。
# 判据（本会话踩坑固化，勿改回）：
#   1) 状态码与正文形态分开判：非200=明确失败；200+错误正文=静默失败(假成功)；200+有内容/有fin=可用
#   2) 推理模型小 max_tokens 时 content 恒空、token 全在 reasoning_content + fin=length → 不是号坏
#   3) 流式(SSE)端点回 data:{...} 分片，正文在 choices[].delta.content → 必须逐分片累积（实测 16 tele-qwen）
#   4) 402/429/403 分「token 级(可重发)」「账号级余额(只能充值)」「并发/限流(非坏)」
#   5) 便宜判据 max_tokens=64：够拿到 fin/reasoning，又不烧额度（曾要求正文含 PONG 自烧 40% 额度）
# 纪律：key 只在 Mac 内使用，绝不打印、绝不出机；本脚本零写操作。
# 用法: bash free-pool-probe.sh
ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
P="psql -h 127.0.0.1 -U postgres -d sub2api -At -F|"
IDS=$($P -c "SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND coalesce(credentials->>'base_url','')<>'' AND (a.name ~* '(free|columbina|pollinat|xzt|aitools|xuanwu|freemodel|olomc|tokenrouter|hub-linuxdo|wb2api|tele-)') ORDER BY a.id")
echo "全池免费/公益号（有 base_url）: $(echo $IDS | wc -w) 个"
printf '%-5s %-22s %-12s %-5s %-5s %s\n' ID NAME STATUS MOD CHAT VERDICT
for ID in $IDS; do
  NAME=$($P -c "SELECT name FROM accounts WHERE id=$ID")
  BASE=$($P -c "SELECT credentials->>'base_url' FROM accounts WHERE id=$ID")
  KEY=$($P -c "SELECT coalesce(credentials->>'api_key','') FROM accounts WHERE id=$ID")
  ST=$($P -c "SELECT status||'/'||schedulable::text FROM accounts WHERE id=$ID")
  MO=$($P -c "SELECT coalesce(credentials->'model_mapping'->>'Tuan','') FROM accounts WHERE id=$ID")
  [ -z "$MO" ] && MO=$($P -c "SELECT coalesce((SELECT value FROM jsonb_each_text(credentials->'model_mapping') LIMIT 1),'') FROM accounts WHERE id=$ID")
  if [ -n "$KEY" ]; then HA=(-H "Authorization: Bearer $KEY"); else HA=(); fi
  M=$(curl -s -o /tmp/ppm.json -m 15 -w '%{http_code}' "${HA[@]}" "${BASE%/}/models")
  [ -z "$MO" ] && MO=$(python3 -c '
import json,re
try: d=json.load(open("/tmp/ppm.json"))
except Exception: print(""); raise SystemExit
a=d.get("data") or d.get("items") or []
ids=[x.get("id") or "" for x in a if x.get("id")]
cheap=[i for i in ids if re.search(r"flash|lite|mini|small|turbo|free|express",i,re.I)]
print((cheap or ids)[:1][0] if (cheap or ids) else "")' 2>/dev/null)
  if [ -z "$KEY" ]; then
    printf '%-5s %-22s %-12s %-5s %-5s %s\n' "$ID" "$NAME" "$ST" "$M" "-" "⚪ keyless 端点（无 api_key，未探 chat 以免混淆）"
    continue
  fi
  if [ -z "$MO" ]; then
    printf '%-5s %-22s %-12s %-5s %-5s %s\n' "$ID" "$NAME" "$ST" "$M" "-" "⚪ 拿不到模型名（映射空且 /models 非 $M）"
    continue
  fi
  CC=$(curl -s -o /tmp/ppc.json -m 60 -w '%{http_code}' -X POST -H "Content-Type: application/json" \
    "${HA[@]}" -d "{\"model\":\"$MO\",\"max_tokens\":64,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}" \
    "${BASE%/}/chat/completions")
  # 注意：python 用**单引号定界**，内部一律双引号（bash 双引号会被裸引号提前终结 —— 本会话实测踩过的坑）
  V=$(python3 -c '
import json,re,sys
code=sys.argv[1]
raw=open("/tmp/ppc.json","rb").read().decode("utf8","ignore")
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
blob=(content+" "+err).lower()
silent=re.search(r"budget|quota|exhausted|rate.?limit|insufficient|try again later|invalid api key|api key used|无可用|额度.{0,6}用尽|payment required",blob)
if not chunks: print("❌ 非JSON(HTTP"+code+") "+raw[:40].replace(chr(10)," "))
elif code=="429": print("🟡 限流/并发上限(非坏号) "+(err or content or raw[:30])[:34].replace(chr(10)," "))
elif code!="200":
    if "token quota" in blob or "remain quota" in blob: print("🟡 HTTP"+code+" token级(重发token可救) "+err[:28])
    elif "balance" in blob or "充值" in err or "余额" in err or "额度不足" in err or "payment required" in blob: print("🔴 HTTP"+code+" 账号级余额(只能充值) "+err[:26])
    elif "not found" in blob or "does not exist" in blob: print("⚪ HTTP"+code+" 无此模型 "+err[:24])
    else: print("❌ HTTP"+code+" "+err[:32])
elif silent: print("🔴 200假成功(正文即错误) "+repr((content or err)[:24]))
elif (content.strip() or reasoning.strip() or fin):
    print("✅可用 "+repr(content.strip()[:12] or "(仅reasoning)")+" fin="+(fin or "-"))
else: print("⚠ 200无结构")
' "$CC" 2>/dev/null)
  [ -z "$V" ] && V="判读异常(看 /tmp/ppc.json)"
  printf '%-5s %-22s %-12s %-5s %-5s %s\n' "$ID" "$NAME" "$ST" "$M" "$CC" "$V"
done
echo "口径：MOD/CHAT 为 HTTP 码；✅可用=非静默且有(正文|reasoning|finish_reason)；🔴=明确坏或静默失败；🟡=限流/token级(非坏号)"
echo "注意：本脚本连打同一站点多个号会触发站方限流（429），那属**探针自伤**，判健康请以 picks + 多次采样为准"
REMOTE
