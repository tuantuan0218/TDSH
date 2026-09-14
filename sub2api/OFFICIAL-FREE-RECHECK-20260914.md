# 官方免费层复核 + GitHub 注册机路线否决 — 2026-09-14

> 性质：只读复核 + 决策固化。本会话收到"用注册机批量注册 GitHub/国际版账号进池"的提议，
> 经事实核查否决（见第三节）。不新增任何账号、不改任何池配置。

---

## 一、复核结果（匿名直测，当日时效）

### 1.1 OpenRouter `:free` 清单 — 零漂移 ✅

- 匿名 `GET https://openrouter.ai/api/v1/models`：**445 模型 / 19 个 `:free`**
- 19 个 `:free` 与 2026-09-13 盘点逐项一致，**无新增、无下架**：
  - ling-3.0-flash-vl / nex-n2.5-mini / nex-n2.5-pro / ling-3.0-flash-sante / ling-3.0-flash-fin
  - dots-3-note-preview / lfm-2.5-2.6b / nemotron-3.5-lightning / inkling-small / laguna-s-2.1
  - inkling / laguna-xs-2.1 / north-mini-code / nemotron-3.5-content-safety
  - nemotron-3-ultra-550b / nemotron-3-nano-omni-30b-reasoning / gemma-4-26b-a4b-it
  - gemma-4-31b-it / nemotron-3-super-120b
- 结论：`OFFICIAL-FREE-GUIDE.md` 第 3 节清单仍准确，可直接按原配置入池（需主流邮箱 key）。

### 1.2 Pollinations — 主端点仍活 ✅，`/models` 502 是端点差异

- `POST text.pollinations.ai/openai`（=池内 #18/21/22 所用端点）：**200**，
  返回 `pllns_*` 会话 id + "pong" 铁证 → **服务未挂，保持现状勿切域名**
- `POST text.pollinations.ai/v1/chat/completions`：本次超时（网络抖动，非结论）
- `GET text.pollinations.ai/models`：502 —— 该端点本就不在池的调用路径上，
  **不能据此判定服务故障**（之前文档亦记载 522/波动属常态）
- 维持既有结论：池内仅有的两个免 key 端点（pollinations + xzt）状态不变，
  见 `NO-KEY-ENDPOINTS-VERIFIED.md`。

### 1.3 GitHub Models — 已退役，无可薅额度 ❌

- 2026-09-13 实测：**410 退役 brownout**（`REGISTER-BATTLE-20260913.md` 存量巡检段）
- 含义：GitHub 账号能换到的免费模型推理额度**已不存在**，
  "注册机批量建 GitHub 号 → 薅 Models 免费额度" 的收益目标为空。

### 1.4 官方免费层全量复核（2026-09-14 当日直测）✅

| 渠道 | 当日实测 | 状态 |
|---|---|---|
| NVIDIA NIM `integrate.api.nvidia.com/v1/models` | 200，**82 模型** | ✅ 无损，U8 待用户过 hCaptcha |
| OpenRouter `/api/v1/models` | 200，**445 模型 / 19 个 :free** | ✅ 无损，U9 待主流邮箱 |
| ModelScope `api-inference.modelscope.cn/v1/models` | 200，**49 模型**（当日复测 48→49，+1 属漂移） | ✅ 可达，待阿里云 token |
| BazaarLink `api.bazaarlink.ai/v1/models` | 200，**173 模型** | ✅ 可达，注册拿 `sk-bl-*`（🥇门槛最低） |
| SiliconFlow `api.siliconflow.cn/v1/models` | **401 Token is invalid** | ⚠️ 与文档一致（额度耗尽） |
| Pollinations `text.pollinations.ai/openai` | 200 "pong" | ✅ 无损（§1.2） |

> 结论：官方免费层 9-13 的判定全部成立、零漂移；扩池主线 = U8（NIM，40RPM/82模型）
> > U9（OpenRouter）> ModelScope。进一步备选反代评估见 `REVERSE-PROXIES-INVENTORY.md`。

**U9 配置核查（同日）**：`openrouter-free-config.json` 标 `freeModels: 22`，含 19 个
`:free` + `openrouter/free` 别名 + 2 个 `google/lyria-3-*-preview`（音频模型，无 :free 后缀）。
与当日直测（19 个 :free）**完全一致零漂移**；"22 vs 19" 是口径差异非配置过期，
U9 key 到手可直接按 `recommendedPoolMapping` 入池（Tuan→openrouter/free）。

---

## 二、2026 注册墙结构性事实（为什么注册机必然撞墙）

摘自 `SIGNUP-WALLS-FINAL-CLASSIFICATION.md` + `REGISTER-BATTLE-20260913.md` 实测：

- **2026 年免费 key 全前置反羊毛**：人机验证（Turnstile/hCaptcha）/ 邮箱短信码 / OAuth /
  云账号实名，四选一；"邮箱直注即发 key" 的形态已不存在
- GitHub 登录页、Google OAuth 等登录态隔离：CDP 自动化解决不了"用户浏览器登录态"
- 结论：**批量注册连"绕过验证"的第一道门都过不去**——不是合规上不行，技术上也是死路

---

## 三、本会话决策：注册机/批量账号路线否决（含合规）

| 提议 | 判定 | 依据 |
|---|---|---|
| 找/搭 GitHub 注册机批量建号 | ❌ 否决 | GitHub ToS 禁自动化创建账号；且 1.3 已证无可薅额度 |
| 用 mac 上 wb 脚本走反代批量注册"国际版"账号进池 | ❌ 否决 | 批量养号违反目标平台 ToS；实名类平台踩《网络安全法》红线；free-tier 额度按人发放，多号套取构成滥用/欺诈风险 |
| 用户本人实名注册 1 个号 → 官方 key 入池 | ✅ 替代 | 合规、稳定、可长期存活（OAuth/短信门对真人无感） |

**执行边界**：本会话不创建注册机 goal、不运行任何批量注册动作、
不把"账号农场"包装成"免费池扩展"来推进。替代推进方向（官方免费层盘点/池健康化/一真人多项目）
见 `HANDOFF-FREE-API-SUMMARY.md` §三 待办 U8/U9。

---

## 四、状态账

- 池内免 key 端点：pollinations 主端点复核 200 ✅ / xzt 未动（沿用 9-13 结论）
- 本文件不新增账号、不改配置、不产生新 key
- 待用户（如要继续合法扩池）：U8 NVIDIA NIM 过 hCaptcha、U9 提供主流邮箱（OpenRouter 19 free）