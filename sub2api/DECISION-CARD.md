# 决策卡（一页 · 实测 2026-09-14 18:4x +0800）

> 只列**需要你动作**的事，按性价比排序；详细出处在 `FREE-LANE-HANDOVER.md` / `FREE-POOL-INVENTORY-20260914.md`。

| # | 你做什么 | 我会做什么 | 收益（实测） |
|---|---|---|---|
| **A** | 给**一个能读信的 QQ/Gmail 邮箱** | 按厂商收益顺序自动开户→验真→入池→补 outbox→追到 `usage_logs` picks | **解锁 13 家「邮件码+签到」站**（本轮新增 `callxyq.xyz`）。厂商多样性：`crowllm[+8厂商] > openrealm[+5] > mzlone[+3]`；**`autorouter.io` 已降为"未核实"（对我 403）** |
| **B** | 点 **`kktoken.cc/?aff=MzG9`** 或 **`api.justwoker.icu/?aff=VTrz`**（GitHub OAuth，实测两站 `/api/status` 200 + 注册页 200） | 你给 key，我入池并验到 picks | **\$75+\$20/日** 或 **\$70+\$22/日**，**都是非 xai 厂商** |
| **C** | 点头：**`UPDATE accounts SET rate_multiplier=0 WHERE name LIKE 'columbina-free%';`**（+补 outbox） | 执行并复核 | 修正账目口径（我这批号被按 `grok-4.5` 价目记价 \$15.45/24h；**经查不是真金损失**：user1 余额 99.98 万名义值、api_key 无配额消耗）→ **不紧急** |
| **D** | 点头：摘掉**持续**报错且属他人配置的号 | `UPDATE accounts SET schedulable=false WHERE id IN (45,46);` + outbox | `45 xuanwu` 403×3、`46 freemodel` 401×3；但 24h picks=0 → **潜伏，不紧急** |
| **E** | 决定要不要做**受控 failover 演练**（短时摘主力） | 只测「排到免费道 + xai 恰好无票」这条唯一未覆盖路径 | 覆盖后我才能说"免费道端到端安全"，否则只能说"无危害证据" |
| **F** | （可选）给 **admin API key**（`x-api-key`，别会话已证实该机制存在、值不在可读范围） | 用官方接口做 A/C 及"改 agenes 上下文准入" | 免裸 SQL、可审计；**今天 436 条用户可见 400 全来自 agenes 超长上下文**，改道本身零成本 |

## 全池免费号权威体检 = `free-pool-probe.sh`（2026-09-14 新工具，别再用 audit 的 12/25）

`free-lane-audit.mjs` 是 **store-based**：仓外 `site-accounts.json` 只 26 条，且 base 会漂移 → 它报的"健康 12/25"**只代表 store 覆盖范围**。
`bash sub2api/free-pool-probe.sh` 改成**以网关库为唯一事实源**（base_url / api_key / model_mapping 全取自 PG，key 只在 Mac 内用、不打印），实跑覆盖 **37 个免费/公益号**，判据复用本会话全部教训（SSE 流式、reasoning-only、token 级 vs 账号级余额、429=限流非坏）。

**实跑结果（20:5x，37 号）——值得你知情的 4 件事**：
| 号 | 判读 | 含义 |
|---|---|---|
| `9 aio-freeshare` / `45 xuanwu-free` / `17 siliconflow-free` / `46 freemodel-free` | 🔴 **账号级余额 ＄0**（403/402/401） | 不是号坏，是没钱；**只能充值**，重发 token 无效 |
| `48 olomc-free` | `429 key concurrency limit reached`，但 **7d 30 picks、最近 20:16:43**，错误全带 `Recovered` 前缀 | **健康且真在接单**；429 是你配置里的 `maxConcurrent:5`，网关已重试救回、用户可见失败 0 |
| `31 xzt-ai-proxy-free` | `429 因违规内容已被封禁或临时限流` + **7d picks=0** | 这条实际没在服务 |
| `16 tele-qwen` | 回 **SSE 流式**（`data:{...}`），按 JSON 解析会判成"非 JSON 失败" | **假阴**，已修判据 |
| `27 wb2api` | `/models` 404（本地 7863 无该路由）；7d 仅 2 picks、错误 `Recovered 503 all accounts unavailable` | v4.1 那条"双源"里 **27 才是较抖的一路**，48 是备胎 |

**一句话**：`v4.1` 双源里备胎（48）反而比主力（27）稳；全池免费产能的真实短板是**四个 ＄0 账号级余额号**，不是任何"号坏了"。


## olomc-free(48)「假故障」根因 = audit 探活 URL 拼错（**不是站方抖动**）

> 本节推翻我自己先前两次归因：①"站方瞬时抖动"（错）②"picks 停在 BAD 之前所以不能证伪"（错，picks 后续 19:27 仍在新增）。

**真根因**（逐层实测定位）：`free-lane-audit.mjs` 用 **store 的 `base`** 拼 `'/v1/chat/completions'`，而 olomc 的 store `base` 是 keyreveal 时代存的**纯主机名** `https://voyager.olomc.top`（网关库 `base_url` 实际是 `https://voyager.olomc.top/gw/v1`）→ 探针打到 `/v1/chat/completions` → **HTTP 404 + HTML 页** → 3 次重试全 BAD → 🔴 建议停池。

**为什么只有 olomc 中招**：columbina 是**巧合正确**——它的 DB `base_url` 恰好就是 `.../v1`，与 audit 默认拼法一致。任何网关带路径前缀的站（`/gw/v1`、`/api/v1`、`/oe/v1`、`/openai`…）都会被这个默认拼法打成假 BAD。

**已落地的修复**
1. `site-accounts.json` 的 `archive-olomc.top` 补 `chatPath=/gw/v1/chat/completions` + `verifiedModel=cb/deepseek-v4.1-flash`（缺 model 会回退成 `grok-4.5`，在 olomc 上不存在 = 第二个假 BAD 来源）
2. `free-lane-audit.mjs` 支持 per-account `chatPath` 覆盖（含坑位注释）
3. 新工具 **`free-lane-pathcheck.mjs`**（只读）：逐条比对 store 拼出的 URL 与 DB `base_url + '/chat/completions'`，把"巧合"变成"检查"；另报覆盖缺口。`--selftest` 9/9 PASS，实跑：**路径漂移 0 / 覆盖缺口 16**

**48 号最终判定：健康，无需任何处置**（修 URL 后 audit 直判 `OK 🟢`；Mac 侧独立 curl 亦 200 真出词、`credit=0`）

**覆盖缺口的重要含义**：DB 44 号有 `base_url`，store 只 26 条 → **`free-lane-audit` 的健康率分母只代表 store 覆盖范围，不代表全池**。tele-muse / wb2api / xzt / pollinations 等（别人的号、key 只在 PG）它根本探不到。判全池健康必须回 `usage_logs`，别拿 audit 的 `12/25` 当"池子只有 12 个好"。

## 判据通用教训（本轮实证）

1. **`--selftest` 通过 ≠ 实跑可用**——pathcheck 的 selftest 9/9 绿，但实跑 DB 查询因引号被 shell 吞掉一直失败，是我拿"无输出"当"无漂移"才暴露的。**判"工具能用"必须看真实输出**（本轮又犯第 2 次，同发现 57 的 `rows` 坑）
2. **SQL 含引号一律走 heredoc**（`<<'REMOTE'` 带单引号定界符，本地远端都不展开）；`-c "..."` 跨 node→wsl→ssh 三层必被吃引号
3. 单号站没有"同站 ≥2 号成片故障"保护（`free-lane-audit.mjs` 的 outage 判据要求 `list.length>=2 && badN>=2`）→ **单号站的"建议摘号"要打折读**，先排 URL/模型名这类探针自身错误
4. **推理模型判活别看 `content`**：`max_tokens` 给 8~24 时 token 全吃在 `reasoning_content`，`content` 恒空 + `finish_reason=length` → 仍算活（发现 15 aio-freeshare 前科重演）
5. `accounts.credentials` 的 key 字段名是 **`api_key`** 不是 `key`（写死会 401，且 401 会被误读成"key 失效该摘号"）

## 🔴 凭据仓风险（本轮新发现，比旧那条已作废的 health-check 警报严重）

`forum_leads_20260913/`（**26 把活 key 的 store 所在目录**）实测：`git ls-files` = 0（未跟踪）**但 `git check-ignore` 也 = 空 → 没有 .gitignore 保护**，根 `.gitignore` 无 `forum_leads` 规则。
→ 一次 `git add .` 就会把 26 把 key 带进远端。已补 `.gitignore` 规则（本轮修复项）。
对照：`sub2api/health-check.js` 早已被忽略（发现 55 已纠正我反复误报的那条），但**真正的裸奔目录是 forum_leads**——我此前从未检查过它。


## 现在正在发生的事（实测 19:5x 逐条复核后）
- **A 案三家确认可用**：`crowllm.com` / `api.openrealm.dev` / `mzlone.top` 门都是 `reg=true 邮件验=true 签到=true`、注册页 **200** → **你给邮箱就能开**
- ⚠️ **`autorouter.io` 已变 403**（CF 拦我这侧，上轮我还把它排在前三）→ **A 案顺序以 `crowllm[+8] > openrealm[+5] > mzlone[+3]` 为准**
- ⚠️ `api.hcnsec.cn` 面板 200 但**注册页对我 403** → 不算可开，除非 API 口能通（未测）
- ⛔ `beizhi.sylu.cc` 超时不可达（上轮 523 → 现在连 TCP 都不通）→ 已从首选剔除
- ✅ **B 案两家活着**：`api.justwoker.icu`、`kktoken.cc`（`/api/status` 200 + 注册页 200）；
  `agentrouter.org` 注册页 200 仍在（但它非 new-api 面板，我探不到门）；`tabitoken`/`gorouter` 对我 **403**，你侧可能正常
- 车道账本最后一条：`09:25Z 健康 0/19 · 余额 $2545.6 · 用户可见失败 0 · 静默失效 0`（→ 第 6 次故障仍在进行）
- **xai 可用性实测比"抖动几次"难看得多**：trend 账本 10 次采样里 **7 次降级（4 次 0/19 全灭）→ 可用率 ≈30%**；
  故障期**用户可见失败仍 0**（换号救回，代价 ≈+4.6s/次）。
  → 含两层含义：① 你的主链路**没被它伤到**；② 但**"有 19 个免费号"≠"有可用兜底"**——
  它 70% 的采样是降级状态，把它当 failover 目标≈注定再失败一次（只是不报错给你看）。
  **这是决策卡 A/B 两项的真实背景**：缺的不是号，是**别的上游厂商**。
- 期间**用户可见失败仍 0**（错误全被重试救回，代价 ≈ **+4.6s/次**，`routing_latency_ms` p50）
- `9 aio-freeshare` 也变 403「用户额度不足 \$0」；`agentrouter/autorouter/new.xinjianya/tabitoken` 本轮报 ⚫ 不再回 status（**定点复测后：agentrouter 注册页 200 仍活着，tabitoken/gorouter 是 CF 403 拦我这侧**）
- 签到：**19/19 今日已签**（明日的我会自动跑）

## 我不做的事（省得你担心）
不绕过验证码/人机验证 · 不向第三方邮箱发码 · 不擅自改池配置或调度参数 · 不擅自摘他人号 · 不重复已证否路径 · 不写 C 盘
