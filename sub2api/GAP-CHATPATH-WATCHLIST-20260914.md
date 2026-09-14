# 带前缀缺口站 chatPath 预警清单 — 2026-09-14 19:5x 实测

> 来源：`PATHMAP-AUDIT-20260914.md` §五（DB 权威比对）发现的 16 覆盖缺口中
> **5 个带非 /v1 前缀站**，本轮用只读探测逐一实测确认。目的：将来这些号补进
> store / 入池时，`chatPath` 直接可用，杜绝重演 olomc(48) 假 BAD。

## 实测结论（401/200 = 路径真实存在；与 DB base_url 前缀全部一致 ✅）

| 池账号名 | DB base_url | 实测 chatPath | 证据 |
|---|---|---|---|
| `aitools-free` | platform.aitools.cfd/api/v1 | `/api/v1/chat/completions` | `/api/v1/models` 401、`/v1/models` 404 ✅ |
| `pollinations-fast-free` / `pollinations-free` / `pollinations-text-free` | text.pollinations.ai/openai | `/openai/chat/completions` | `/openai/models` 200 返回 `openai-fast`（ovh）✅ |
| `tele-muse` | llm.teleapi.top/oe/v1 | `/oe/v1/chat/completions` | `/oe/v1/models` 401（POST）✅ |
| `tele-qwen` | llm.teleapi.top/qwen/v1 | `/qwen/v1/chat/completions` | `/qwen/v1/chat/completions` 401（POST）✅ |

## 入池时的填法（free-pool-add / free-lane-audit 的 chatPath 覆盖）

```jsonc
// site-accounts.json 对应条目补两键（与 archive-olomc.top 同款）：
"chatPath": "/api/v1/chat/completions",        // 按上表选
"verifiedModel": "<该站热模型名>",              // 防 audit 回退成 grok-4.5 之类假 BAD
```

- 这些号**若走 audit 默认拼法（base + /v1/chat/completions）必 404 假 BAD**：
  aitools 的 /v1 404、tele-muse/tele-qwen 的根 /v1 虽 401 但不是它们的租户、
  pollinations 的 /v1 是原生格式非 OpenAI 兼容。
- `free-lane-pathcheck.mjs` 会把这些 chatPath 与 DB `base_url` 自动对账，
  补完跑一次即可确认漂移 0。

## 附带：pollinations 免 key 备注

- `/models`（原生）200 返回 `openai-fast`（tier: anonymous，免 key）；
- `/openai/models`（OpenAI 兼容）200 返回 `{"object":"list"...}`；
- `/openai/v1/models` 200 但提示 key 预算到顶 → 池内映射走 `/openai`（DB 现状正确），
  勿改 `/openai/v1`。

## 2026-09-14 20:0x 收口：3 个 active 站已补入 store ✅（缺口 16→13，pathcheck 验证漂移 0）\n\n- aitools-free → \platform.aitools.cfd\（chatPath=/api/v1/chat/completions, verifiedModel=google/gemma-4-31b 实测）\n- tele-muse → \llm.teleapi.top#oe\（chatPath=/oe/v1/chat/completions, verifiedModel=opencode/muse-spark-1.3 实测）\n- tele-qwen → \llm.teleapi.top#qwen\（chatPath=/qwen/v1/chat/completions, verifiedModel=qwen3.7-plus 实测）\n- pollinations×3 为 error 不服务，未补（恢复后再补）\n- 🆕 关联发现：olomc 的 qwen family 上游 = tele-qwen、oe family 上游 = tele-muse（catalog 模型清单完全一致）→ 48 号 key 的 cb 模型是 olomc 的独有增量\n\n## beizhi.sylu.cc 复查（2026-09-14 19:5x）

- 19:3x 首测：HTTP 522（CF 源站超时）；**19:5x 复查：仍 HTTP 522** → 源站持续故障，
  与配置无关（浏览器 UA 亦 522）。建议：列入"定期复查"，恢复前不列为可入池站。

## 2026-09-14 20:1x 最终收口：覆盖缺口 16 → 5（pathcheck 复验）

- 8 个 active 无前缀站已补 store：aio-freeshare、freemodel-free、hub-linuxdo、tokenrouter、
  xuanwu-free、xzt-ai-proxy-free、xzt-free、columbina-free 主号（键 newapi.columbina.eu.org#main）。
- 剩余 5 个合理缺口：pollinations×3（error，产能已恢复待用户点头）、siliconflow-free（＄0）、
  wb2api（本地 127.0.0.1:7863）。
- 漂移 0；audit 覆盖 = 全部 active 外部免费渠道 100%。
- ⚠️ 并发备忘：FREE-POOL-INVENTORY-20260914.md 被并行会话高频写入（发现编号已到 74），
  本结论未再追加该台账（避免读-改-写覆盖风险），以本文档为准。