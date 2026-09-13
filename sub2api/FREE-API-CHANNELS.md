# 免费 API 渠道地图 — sub2api Tuan 池（2026-09-13 盘点，持续更新）

**职责**：往 Tuan 池里丢免费 API（只新增账号/映射，不碰已有账号调度）。
**教训铁律**：免费≠无限——所有免费档都有额度/速率上限，用尽即 402/429（SiliconFlow 先例），
入池一律 prio 90 兜底位 + concurrency 1 + error_rate 自动避让，绝不升为主力。
**⚠️ 2026-09-13 配置语义两条实证修正**：
1. **网关按精确模型名匹配 model_mapping**：外部（DSH）只发 `model=Tuan`；往映射里加
   `Tuan-xxx` 别名键**无效**——网关路由表不认未注册名，直接 502 且不进 usage_logs。
   正确做法：一账号一 `Tuan→上游模型`；要换免费模型就改该账号 Tuan 键的目标值（动前问用户）。
2. **priority 现状=1-19 连续自动位**（新账号递增，非 90 兜底制；本会话曾把 19 号设 90 又被
   并发体系重排回 14）。以当先调度约定为准，不擅动 priority（"一切按照配置来"）。
**2026-09-13 补充：linux.do（liunxddo）公益 API 收集完成**，详见 `liunxddo/LINUXDO-PUBLIC-API-COLLECTION.md`。
结论：官方公益中转 hub.linux.do 需 linux.do Connect 登录领 key；NVIDIA NIM 免费模型最多
（82 模型 /models 匿名 200，chat 需 key）；候选均需用户注册 key 后走 add-free-api-pool.mjs 入池。
**网关与第二张清单（同日）**：
- **本地 keyless 公益 API 网关已部署**（`liunxddo/keyless-gateway.mjs`，127.0.0.1:8787，
  **33 源**全实测（六轮扩展）：一言/60s/天气×2/汇率×2/笑话×2/猫×2/邮编×2/建议/歌词/ISS/狗狗/
  圣经/二维码/咖啡/性别/年龄/书目/瑞克莫蒂/星战/名言/梗图/IP/随机用户/FDA药品/足球/Chuck笑话/
  地震/老爸笑话；**v2 功能**：缓存 TTL60s（X-Cache 头）、限流（每 IP 10s 30 次）、优雅错误
  JSON、301/302 跟随 + per-source headers；唯一失败源 openlib（代理 TLS 抖动预期内）；
  启动 `start-keyless-gateway.cmd`）
- **免费 key 渠道第二张实测清单**（`liunxddo/FREE-KEY-CHANNELS-VERIFIED.md`）：Cerebras/Groq/
  Mistral/ZenMux/Poe 匿名 /models 全部需 key（403/401/404），NIM 是唯一可匿名验证模型列表的平台；
  扩池推荐序 NIM > hub.linux.do > Cerebras > Mistral > 国内三家

## ✅ 已入池免费来源（只读核对 2026-09-13 06:1x）

| 账号 | 免费模型 | 状态 | 备注 |
|------|---------|------|------|
| 12 tokenrouter | `z-ai/glm-5.3-free` | ✅ 稳定 200 | 直连实测通过；唯一免费模型 |
| 9 aio-freeshare | sn/deepseek-v4-flash 等 9 个 | ⚠️ 间歇限流 | active-session=1 硬限制 |
| 17 siliconflow-free | DeepSeek-V3/Qwen2.5-7B/Qwen3.5-4B | ❌ error(402) | 免费额度耗尽，需充值/重置 |
| **18 pollinations-free** | `openai` 等（见下） | ✅ **已真实接单** | **keyless 匿名，无需任何 key** |
| **19 hub-linuxdo** | `qwen3.8-flash`（Tuan 映射） | ✅ **2026-09-13 入池** | hub.linux.do AxonHub 网关，key 有效，2688 模型可列；qwen3.8-flash chat 200 "pong" 铁证；prio 90/concurrency 1/group 5 |

### 18 pollinations-free（keyless，2026-09-13 自主接入）
- 平台：`https://text.pollinations.ai/openai`（openai 兼容，**匿名免费无需 key**，
  占位 key="anonymous"；/v1/responses 该聚合端点有限需注意，默认 force_chat_completions）
- 实测：`openai` 模型匿名 5/5 200，平均 ~560ms（含 "pong!" 正常返回）；
  `openai-fast` 需 key 不可用；`mistral/llama/qwen/deepseek/gpt-4o-mini` 模型名 404
  （该聚合端点仅开放部分路由，以 /models 返回为准）
- Tuan→`openai` 映射，prio 90 / concurrency 1 / group 5 / force_chat_completions
- **路由已实证**：06:19-06:20 两条真实 Tuan→`gpt-oss` 请求 200，0 错误（usage_logs 账号 18）
- **限流观测（06:3x）**：匿名按 IP 有队列硬限（`429 Queue full for IP: …: 1 requests already
  queued`），并发/高频探测会撞墙；`openai-fast` 需 key；模型名扩展（gpt-5.x/claude/gemini/
  llama/mistral/qwen3/deepseek 等）多数 429/404——**只开放 `openai` 单模型匿名路由**，
  只能作兜底，不要扩展映射
- 注意：匿名限流按 IP（freellmpool 报告 ~200 req/hour 量级），只可作兜底
- **入口对比（06:5x 探测）**：`text.pollinations.ai/openai`（当前用）与
  `text.pollinations.ai/v1/chat/completions`（无前缀）均 200 稳定；`/openai/responses` 也
  200（但保留 force_chat_completions 无害）；`api.pollinations.ai`（新域名）**522 不稳**
  （Cloudflare 源超时）——**保持 text.pollinations.ai/openai 不变即可，勿切 api 域名**
- **已验证不可用（需 key/非匿名）**：Vercel AI Gateway（ai-gateway.vercel.sh，376 模型但 chat 401
  需 Authorization）、NVIDIA NIM（integrate.api.nvidia.com，82 模型但 401 需 key，且部分模型
  已 EOL 410）、Cloudflare Workers AI（403 需 X-Auth-Email/X-Auth-Key）、OpenCode Zen（404）、
  **HuggingFace router（router.huggingface.co/v1，/models 200 可匿名列 142 模型含 DeepSeek-V4.1/
  GLM-5.3/Qwen3.8，但 chat 全 401 需 HF token）**；
  此前已有 OVHcloud content 空 / Kilo 404 / LLM7 401 / HF 不可达 / GitHub Models 退休 /
  freeshare 代理 403
- **结论（2026-09-13 重扫完结）**：所有已知 keyless 匿名端点仅 Pollinations 可自主接入；
  其余均需注册 key。**第三个自主渠道不存在**，扩大免费池只能靠用户提供 key（OpenRouter 19个
  :free 收益最大）
- **候选（需用户注册/给 key）**：OpenRouter（19 个 :free 见下）、Gemini AI Studio、Groq、
  Cerebras、NVIDIA NIM、Cloudflare Workers AI、Mistral、Z.ai/GLM（1000 req/day）

## 可探索的新渠道（需用户提供 key 或注册动作）

### 0. linux.do 公益 API 候选（2026-09-13 收集，全部需 key/注册）
- **hub.linux.do**（Linux DO 官方闲置 API 置换公益站，AxonHub 网关）：
  `https://hub.linux.do/v1`（备用 `hub.oaifree.com/v1`）；需 linux.do Connect 登录注册领 key，
  闲置额度挂渠道赚 credits 再消费别的模型；**最正规候选，优先**
- **2026 新公益站（补充收集 2026-09-13，全部需 linux.do 账号=受限项）**：V-API
  （v-api.de5.net，实测活：/api/status 200、/v1/models 401 需 key；New API 系，Connect
  鉴权+LDC 兑换）· 魔方公益站（Connect 鉴权+签到 10-100 额度，RPM 10，域名图片不可见未提取）·
  汐洛公益（原帖失效，邀请码+签到）· GG_API（5000 刀/日共享额度）· picpi 皮皮（Codex 主力，
  邀请码制，原帖失效）· **FreeModel.dev（/v1/models 匿名 200 可列 7 个 GPT-5.x 前沿模型，
  chat 需 key；注册送 $100-300，有邀请返利非纯公益）** · Zero Bug（提及待补）。共性：Connect
  鉴权+签到/积分兑换防滥用；hub（marketplace 型）比这些（公共号池型）更可持续，推荐序不变
- **NVIDIA NIM**：`https://integrate.api.nvidia.com/v1`；**/models 匿名 200 已实测 82 模型**
  （z-ai/glm-5.3-flash、deepseek-v4-flash/pro、kimi-k3、gpt-oss-20b、nemotron-3.5-lightning 等），
  chat 需 key（rpm 40）；key 免费注册 build.nvidia.com → 入池脚本模板
  `liunxddo/add-nvidia-nim-pool.mjs` 已就绪，key 到手即跑
  **复查（2026-09-13 14:5x）**：82 模型不变、8 核心免费模型全在、无新增下架——状态未漂移
- **阿里 ModelScope**：`https://api-inference.modelscope.cn/v1`，每天 2000 次（单模型≤500）
- **字节火山方舟**：每模型每天 250 万 token（豆包系 + deepseek-v3.2/kimi-k2）
- **美团 LongCat**：每天 50 万 token；**七牛 AI**：300 万 token 一年（可调 OpenAI/Claude 系）
- **Cerebras**：glm-4.7 免费（tpd 100 万 / rpm 10）；**智谱 GLM-Flash**：免费小模型
- 其余老帖公益站（oaipro/7xnn/WONG 等）时效差，仅作参考不优先

### 1. OpenRouter :free 模型（最推荐，量大）
- 平台：`https://openrouter.ai/api/v1`（openai 兼容）
- key：需注册 openrouter.ai（免费，无信用卡），key 格式 `sk-or-v1-…`
- 免费机制：模型名带 `:free` 后缀 = 官方免费变体，限频约 20 req/min、50-1000 req/day
- **实测清单（2026-09-13 直拉 openrouter.ai/api/v1/models，445 模型中 19 个 :free）**：
  `inclusionai/ling-3.0-flash-vl:free`、`nex-agi/nex-n2.5-mini:free`、`nex-agi/nex-n2.5-pro:free`、
  `inclusionai/ling-3.0-flash-sante:free`、`inclusionai/ling-3.0-flash-fin:free`、
  `dots-studio/dots-3-note-preview:free`、`liquid/lfm-2.5-2.6b:free`、
  `nvidia/nemotron-3.5-lightning:free`、`thinkingmachines/inkling-small:free`、
  `poolside/laguna-s-2.1:free`、`thinkingmachines/inkling:free`、`poolside/laguna-xs-2.1:free`、
  `cohere/north-mini-code:free`、`nvidia/nemotron-3.5-content-safety:free`、
  `nvidia/nemotron-3-ultra-550b-a55b:free`、`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`、
  `google/gemma-4-26b-a4b-it:free`、`google/gemma-4-31b-it:free`、
  `nvidia/nemotron-3-super-120b-a12b:free`；另有 `openrouter/free` 别名（200k ctx 免费路由）
- **入池方式**：`$env:SF_NAME="openrouter-free"; $env:SF_BASE="https://openrouter.ai/api/v1";
  $env:SF_KEY="sk-or-v1-…"; $env:SF_MODELS='{"Tuan":"google/gemma-4-26b-a4b-it:free",…}';
  node add-free-api-pool.mjs`（一键入池，自动 extra 四字段/prio 90/concurrency 1/group 5）
- **泄漏探测**：freeshare.cc.cd **不代理** OpenRouter :free（403 model not allowed，key 白名单）——
  不能拿现有聚合 key 蹭，必须独立 OpenRouter key

### 2. Google Gemini 免费档
- 平台：`https://generativelanguage.googleapis.com/v1beta`（需 gemini 平台类型或 openai 兼容端点）
- key：Google AI Studio 免费 key（`AIza…`，无信用卡，有限频）
- 免费模型：gemini-2.5-flash 等（限频严格，80k token/day 级别）

### 3. Cerebras / SambaNova / Groq 免费档
- 平台均为 openai 兼容 `/v1`，免费 key 需注册（邮箱即可，限频几 req/min）
- 免费模型：qwen3 系列 / deepseek 系列 / llama 系列（各平台不同）

### 4. SiliconFlow 恢复（已有 key，额度问题）
- 充值 ¥10+ 或等官方免费额度重置 → 同 key 复测 200 即自动复活（status=error 是自动降权，
  admin 侧 `set-status 17 active` 或网关自动恢复）

### 5. ModelScope 阿里（需 token，2026-09-13 探测）
- 端点：`https://api-inference.modelscope.cn/v1/chat/completions`（可达，需 Bearer token，
  401 无 token 时；模型名格式 `Qwen/Qwen2.5-7B-Instruct` 验证有效）
- 免费额度：2,000 calls/day 总量（freellmpool 报告）；token 需从 modelscope.cn 申请
- 入池：拿到 token 走 add-free-api-pool.mjs（SF_BASE=api-inference.modelscope.cn/v1）

## 入池标准动作（新渠道 key 到手后）

1. `node probe-free-models.mjs`（predict：/models 能列出哪些）→ 确认模型 ID 与免费性
2. 直连 chat 单发 200 + 余额/额度实证（免费结论以"200+不限量"为准，警惕隐藏额度）
3. 写账号模板（参照 `add-siliconflow-pool.mjs`：openai/apikey + extra 四字段 +
   force_chat_completions + supported=false + prio 90 + concurrency 1 + group 5）
4. SSH→Mac PG 入池（`mac-add-siliconflow.sh` 模板）→ 只读核对 usage_logs 路由铁证
5. 更新本地图 + 交接文档 + 快照

## 关键区别（免费 vs 付费的池语义）

- 免费档是**冗余/兜底资源**：主流量仍由付费快号承担，免费档只填峰谷与降级期
- 免费档 402/429 是常态：error_rate 自动避让 + failover 无感，**不要**手动关调度
- 免费档永远 concurrency 1（防自撞限流），prio 90（兜底位），不升权