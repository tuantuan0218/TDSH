# olomc 网关深度画像 — 2026-09-14（voyager.olomc.top）

> 来源：浏览器实测 + `/stats.json` + `/gw/catalog` 双公开端点 + 错误响应指纹。
> 与本池关联：olomc-free = 池账号 48（见 `POOL-ADMISSION-20260913.md` §十、
> `DECISION-CARD.md`「olomc-free(48) 假故障根因」）。本文是**网关本体**的第一手档案。

## 一、这是什么

- **私有 LLM 聚合网关**（one-api/new-api 同类），单端点讲 OpenAI + Anthropic 双协议。
- 站点自称：没有评论 / 没有账号 / 没有追踪；**key 不对外分发**（私有服务）。
- 服务端：`nginx/1.24.0 (Ubuntu)` 反代；API 错误格式 OpenAI 兼容
  （`{"error":{"message":...,"type":"authentication_error","code":"invalid_api_key"}}`）。

## 二、公开端点（无 key 可读）

| 端点 | 结果 | 用途 |
|---|---|---|
| `/` | 200 HTML（状态页：tokens/请求/模型目录/渠道健康） | 门户 |
| `/gw/catalog` | 200 JSON（`families` + `meta` + `fetched`） | **模型目录 + 上下文长度 + 渠道来源** |
| `/stats.json` | 200 JSON（`tokens_total/requests_total/tokens_today/models_total/models/families`） | 聚合统计 |
| `/gw/v1/models` | 401（需 key） | API 模型清单 |
| `/gw/v1/chat/completions` | 401（缺 key）；路径正确 | API 主入口 |

## 三、规模快照（2026-09-14 ~19:23Z 实测）

- tokens_total **803.3M** / requests_total **7.3k** / tokens_today **472.7M**
- 模型 **86 个**，渠道 **7 个 family**
- 流量分布（catalog 内按 tokens 排序前六）：
  `cb/deepseek-v4.1-flash` 469M > `aclw/deepseek-v4-flash-vision-exp-free` 112M >
  `aclw/deepseek-v4-pro` 97M > `oe/muse-spark-1.3` 44.7M > `aclw/glm-5.3-free` 30.3M >
  `aclw/deepseek-v4-flash` 26.9M
- **cb 渠道扛大头**（3.6k 请求 / 469M tokens ≈ 池总量 58%）

## 四、渠道来源标注（`/gw/catalog` 的 `meta.by` 字段 = 权威出处）

| family | 模型数 | 来源（by） | 上下文 cl / 输出 mo | 池映射备注 |
|---|---|---|---|---|
| aclw | 5 | `autoclaw-relay` | cl 400k / mo 131k–393k | glm-5.3 + deepseek-v4 系 |
| anuma | 52 | 无 by（`resp/` 命名） | cl 130k–280k / mo 空 | claude-sonnet-5、gemini-3.x、gpt-5.4/5.6、grok-4.6、kimi、minimax、qwen、deepseek-r1 **名义模型最全** |
| cb | 2 | `workbuddy` | cl **1M** / mo 64k–128k | hy4-preview + deepseek-v4.1-flash ← **热模型在此** |
| oe | 4 | `opencode` | mo 131072 | muse-spark 系（contributor-free 免费档） |
| qwen | 6 | `qwen` | cl/mo 空 | qwen3.5–3.8 系 |
| relay | 5 | `free-relay-hub` | cl/mo 空 | deepseek/glm/kimi/qwen 免费聚合 |
| windsurf | 12 | `windsurf` | cl 200k–**1M** / mo 128k | SWE 1.6–2 系 + glm-5-2（含 -1m 长上下文变体） |

> 判读：anuma 的 `resp/` 前缀 + 无 by = 典型**第三方 resp 代理映射**；windsurf/opencode/
> workbuddy/autoclaw = 借用平台免费额度或共享 key。**模型名是名义映射，非官方直连。**

## 五、渠道健康（rolling 24h，状态页实测）

- aclw **78/100**（HTTP 400×2）、windsurf **96/100**（ECONNREFUSED×2）、
  cb **93/100**（HTTP 429×204、连败×21）、oe **100/100**
- relay / qwen / anuma **「—」无样本**（24h 无流量 = 不是故障）
- 全站均延 29.7s（含推理长请求）；各渠道 p95 15–73s —— **延迟波动大**

## 六、探活路径坑（现场复现，2026-09-14 19:2x）

audit 默认拼 `store.base + '/v1/chat/completions'`，而 olomc 真路径带前缀：

```
https://voyager.olomc.top/v1/chat/completions           → HTTP 404（复现 ✅ = 假 BAD 根因）
https://voyager.olomc.top/gw/v1/chat/completions        → HTTP 401（✅ 路径正确，缺 key 所致）
```

**凡带路径前缀的网关（`/gw/v1`、`/api/v1`、`/oe/v1`、`/openai`）都会被旧拼法打成假 BAD**，
与 `DECISION-CARD.md` 根因结论一致。已有修复：store 键补 `chatPath`/`verifiedModel`、
`free-lane-audit.mjs` 支持 per-account `chatPath`、`free-lane-pathcheck.mjs` 巡检漂移。

## 七、接入要点

- BASE URL：`https://voyager.olomc.top/gw/v1`；协议：OpenAI `/chat/completions` + Anthropic `/messages`
- 认证：`Authorization: Bearer <key>`（OpenAI）或 `x-api-key`（Anthropic）；`/gw/v1/models` 401 = key 无效/缺失
- 模型名带 `family/` 前缀（如 `cb/deepseek-v4.1-flash`、`anuma/resp/anthropic/claude-sonnet-5`）
- 请求不存在的模型时，错误响应会附带当前 key 可用的完整清单
- **数据经第三方中继**：不传敏感信息；上游随时可能断流（429 连击 / ECONNREFUSED 现场可见）

## 八、给池的结论

1. 48 号（olomc-free）映射 `cb/deepseek-v4.1-flash` = 网关**最热模型**，选型正确。
2. 该网关容量充足（803M tokens 累计），但**稳定性一般**（p95 高、有连败），适合兜底/备胎位，
   与 `DECISION-CARD`「48 是 v4.1 双源备胎」定位一致。
3. ~~第二映射候选 aclw/oe~~ **已实测否定（2026-09-14 19:4x，用 48 号 key）**：
   请求 `aclw/deepseek-v4-pro`、`oe/opencode/muse-spark-1.3` 均返回
   `403 key not authorized for family: aclw/oe`，错误响应自带清单
   `"available_models": ["cb/deepseek-v4.1-flash"]` → **该 key 仅授权 1 个模型**，
   cb family 的 hy4-preview 亦未授权。**第二映射在当前 key 下不存在**；
   要扩模型必须另拿新 key（或站主扩授权）。
4. 探活一律走 `chatPath` 覆盖；模型探活名用 `verifiedModel`，防回退成 grok-4.5 假 BAD。

---
**池内实证（2026-09-15 00:0x 查 usage_logs）**：48 号 7d picks=37 全在 24h 内、最近一单 00:01、24h 用户可见错误 0、Recovered 3 → 真实接单中。\n\n*快照时刻 2026-09-14 19:25Z；`/gw/catalog` fetched=1789413868231（目录 19:19Z 更新）。*

## 2026-09-14 20:1x cb 渠道故障窗口实测（quality-check）

- 48 号 cb/deepseek-v4.1-flash 最小 chat 请求 88s 无响应（fetch failed，第二次复现）。
- stats.json 佐证（20:16Z）：**streak=74 连败**、24h 走势末两格失败 165/115（近 4h 飙升）、
  ms_p95=73983、错误 HTTP 429×212 / 503×67 / 502×10（**上游限流/不可用**）。
- 判读：cb 上游（workbuddy）当前故障窗口，48 号 37 picks 为窗口前累计；
  **非 48 号配置问题，无需处置**；网关 Recovered 机制会兜底（用户可见失败仍可为 0）。
- 与 DECISION-CARD「48 是 v4.1 备胎」定位一致：主力抖时备胎也可能接不住。