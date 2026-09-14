# 免 Key 端点第五轮盘点 — 2026-09-14

> 专攻"无需注册即可调用"的真实 keyless 候选（区别于需 key 的免费档）。
> 结论：**真实免 key 端点维持 9-13 既定结论——仅 2 个（pollinations + xzt）。**

## 新候选实测（全部不成立）

| 候选 | 来源 | 实测结果 | 判定 |
|---|---|---|---|
| **KeylessAI**（keylessai.thryx.workers.dev） | exa 命中，宣称"无 key 无注册" | 直连 TLS 断开；Clash 代理（出口 52.197.35.88）**502** | ❌ Worker 挂/地区限 |
| **LLM7**（api.llm7.io，key="unused"） | antseed 2026-08-18 复核 | `/v1/models` **匿名 200，47 模型**（DeepSeek-V4-Flash、Claude Opus 5、Gemma 等）；但 **chat 401 需 key**（"Generate a new key at dash.llm7.io"），直连+代理双出口均 401 | ❌ 非免 key，需注册 |
| **BazaarLink** | 本轮新发现 | 注册门槛最低（Turnstile 点一下），但 chat 需 `sk-bl-*` key | ⚠️ 需 key（列入第4条合法通道） |

## 外部权威交叉验证（与 9-13 结论一致）

- **antseed.com**（2026-08-18 复核，10 家）："仅 2 家真零账号可用——Pollinations 原始 text 端点 + LLM7（接受字面串 unused 作 key）"。
  但本轮实测 LLM7 chat 401，与 antseed 记录**不符**——LLM7 可能收紧了（从 keyless 改需 key），
  **以当日实测为准：LLM7 现需 key**。
- OpenRouter 免费档 / Google AI Studio / Groq / Cloudflare / GitHub Models / HF
  Inference：**全部需账号**（多免费 key，非免 key）。

## 结论

1. **真实免 key 端点 = 2**（pollinations + xzt，均已入池）。本轮所有新候选验证不通过。
2. 免 key 端点极少是市场常态（antseed 复核 18 家也只确认 2 家）——"再多一个免 key 端点"
   的期望不现实，扩池主战场应在**需 key 但门槛低**的通道（BazaarLink/NIM/OpenRouter）。
3. 更新 `NO-KEY-ENDPOINTS-VERIFIED.md` 结论：**维持 2 个**；LLM7 的 "unused key" 已失效，
   需 dash.llm7.io 注册（低优先级，非主线）。

## 状态账

- 本轮全部只读探测：无 key、无账号、无池改动
- 待办：无新增（BazaarLink 已列入第 4 条合法通道，等待用户注册拿 key）