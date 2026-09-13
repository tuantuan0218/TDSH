# 免费 API Key 五论坛增量报告 — 2026-09-13 深夜轮

> 本轮定位：**只做增量**（并发会话已产 `FREE-API-FIVE-FORUMS.md` / `FREE_API_KEYS_2026.md`）。
> 增量内容 = 本周新帖线索 + GoAIHop 实测目录挖掘 + 33 个端点匿名实测 + 公开明文 key 生死验证。
> 纪律：本文件**不记录任何 key 明文**（只记前缀指纹与长度），凭据类原文只留在仓外
> `D:\tdsh\forum_leads_20260913\`（该目录不在 git 仓内，避免把第三方 key 提交进仓）。

## 0. 方法与可达性（先说清哪些路走得通）

| 目标 | 直抓结果 | 可用替代通道 |
|------|---------|-------------|
| linux.do（.json/.rss/c 页面） | 403（Cloudflare） | ✅ `t.me/s/linuxdoit` 镜像 + 搜索引擎限周检索 |
| nodeseek（帖子页） | 403（CF） | ⚠️ 只拿到标题/摘要，站域名需浏览器过 CF（受限项） |
| v2ex | ✅ 200（`/t/<id>` 纯 HTML 可读全帖含回复） | 直抓即可；`/api/topics/show.json` 已 404 |
| forum.naixi.net | ✅ 200，但**游客不能搜索**；帖子页可读 | 直抓 thread 页 |
| x.com | ❌ 登录墙 | 仅搜索引镜，无法看评论区兑换码（受限项） |

**阳性对照（防假绿）**：`https://text.pollinations.ai/openai/models` → 200 ANON-OPEN，
证明"匿名 `/v1/models` 扫描"这套方法**能**识别开放端点 → 因此下文"零匿名开放"是真结论。

## 1. linux.do 本周新线索（福利羊毛区，全部"注册/签到/抢"制）

| 线索 | 链接 | 福利 | 获取门槛 |
|------|------|------|---------|
| SoleAPI 新站试运营 | https://linux.do/t/topic/2866001 | 注册送 $5 + 进群再送 $5 = $10（Claude/Codex/国模） | 注册 + TG 群 |
| CUN.AI 会员体系 | 福利羊毛置顶 | **L 站账号登录每天领 $0.50**；内附 300 张兑换码；首充送 50% | L 站 Connect |
| 首个中转站自由市场 | 福利羊毛热帖 | 评论 ID 送盲盒，**首次保底 2.5$**，最高 500$ | 回帖 + 注册 |
| PQH 中转站 | 福利羊毛 | 新用户 $5 体验额度 | 注册 |
| 快跑AI | 福利羊毛 | 注册送 10$；**GLM-5.3-Flash / Qwen3.8-Flash 限时免费** | 注册 |
| 哲の深夜测试 | https://linux.do/t/topic/2821740 | 3 个时段 × 100 份 × 10 刀额度（dsv4flash，并发小） | 蹲点抢 |
| PM公益站 Free组 | https://linux.do/t/topic/2894645 | Free 组上线 deepseek-v4.1-flash（公益推广标签） | L 站登录领 |
| 松贝公益站 | 镜像可读到主贴 | 免费生图（已接 LINUX DO Connect） | L 站登录 |
| Workbuddy（国际版 App） | 热帖 | deepseek-v4.1-flash **倍率 0 免费用**；每日签到 100 点；GLM-5.3-Flash 0.06x | 装 App 注册 |
| 智谱 ZCode | t.me 摘要 | 免费发 **3 亿 Token**（未开套餐也可领，曾被撤回又恢复） | 智谱账号 |

## 2. v2ex（本轮唯一"明文 key"样本 → 已实测死亡）

- **`https://www.v2ex.com/t/1236455`「Ox Alpha 公益模型」**（8/22，1993 点击）
  帖内直接贴出：base `https://api.aitokensflux.com/v1` + **公开 key（指纹 `sk-PfYs8…`，长度 43）**，模型 `ox-alpha`。
  本轮匿名实测（21:46）：`GET /v1/models` → **401 Invalid token**；`POST /chat/completions` → **401**。
  帖内 8/25 已有佬友报 `401 new_api_error 无效的令牌`。→ **判定：失效。**
  - 这条即"论坛免费 key"的典型生命周期样本：**发帖到集体蹬废 ≈ 3 天**。
  - 附带线索：`https://tokenra.io/zh/models/ox-alpha.html` 网页版免费用（其 API 端点 `tokenra.io/v1/models` 亦 401）。
- **`https://www.v2ex.com/t/1236342`「GoAIHop」** — 本轮最大金矿（见 §5/§6）：真实请求驱动的中转站实测目录，带
  `公益中转站`(/public-benefit) 与 `领福利`(/benefits) 两个专页。**注意其自述：严厉打击恶意薅羊毛，滥用封号。**
- `v2ex.com/tag/公益站` 页面 200 但主题列表为前端渲染，HTML 里取不到（需换 API 或渲染）。
- 旁支目录站（同类可长期蹲）：`lmspeed.net`（含"小天公益站"DuckDuck API 免费档价表）、`freemodels.net`。

## 3. NodeSeek（帖子可读性差，只拿到摘要；域名需浏览器）

| 线索 | 链接 | 关键内容 |
|------|------|---------|
| 「仅剩的好用的公益站，只此一家了」 | https://www.nodeseek.com/post-923808-1 | 一个 Key 调 gpt-6-astra / claude-opus-5 / glm-5.3 / deepseek-v4-flash；2 天前编辑 |
| 「评论福利：评论留言用户ID，新用户送 $3」 | https://www.nodeseek.com/post-922604-1 | **未付费账号每天 20 次免费调用**，付费后 50 次/天；0 点刷新；独立 key |
| 「Dooong 公益 AI API 站」 | https://www.nodeseek.com/post-662180-1 | 免费 CodeX / GPT-5.1~5.2 系列接入 |
| 「现在各种中转站/公益站的低价 api 哪来的」 | https://www.nodeseek.com/post-646470-1 | 供给侧真相帖（号池/2api/网关），看风险用 |
| api.66o.uk（免费调用中转） | 摘要帖内 | 实测 `/v1/models` → **401**（需注册领 key） |

## 4. 奶昔 forum.naixi.net（官方 New API，机制最清楚）

- 公告帖 https://forum.naixi.net/thread-9924-1-1.html（2026-02-16，仍为现行机制）：
  - 端点 `https://newapi.naixi.net/v1`（+ `/v1/chat/completions`），令牌**以 SK- 开头**，分 4 组：
    `default` / `claudecode`（CC 专用） / `translate`（沉浸式翻译） / `experience`（测试模型，勿上生产）。
  - 额度来源：**开户送 5 刀** + **每日签到 1–2 刀** + **论坛点数在积分商城兑换礼品卡 → 钱包兑换卡密**。
  - 登录方式：`newapi.naixi.net/login` 选「使用 OIDC 继续」→ 需先开通**奶昔 SSO**（与论坛号不同，指引 thread-4975）。
- 游客限制：`search.php` → 「抱歉，您所在的用户组(游客)无法进行此操作」→ 站内检索需账号。
- ⚠️ 本机连通性：`https://newapi.naixi.net/*` 本轮 **fetch failed**（解析/TLS 不通）→ 需走代理或浏览器复核，入池前先测。
- 旧结论复核：上一轮记录的"开户送5刀"帖（thread-9924）为真；thread-5507（送$100）/ tid=6651（Nyxar 1000刀兑换码）**本轮未能验证**（游客不可搜 + 时效不明）。

## 5. GoAIHop 公益中转站目录（6 家，本轮**逐家匿名实测**）

> 目录页 https://goaihop.com/public-benefit （人工标记公益性质，自带近 7 天可用率与榜单评分）

| 站点 | 端点域名 | 福利方式 | 近7天可用率 | 评分 | 本轮实测 `/v1/models` |
|------|---------|---------|-----------|------|--------------------|
| **Agent Router** | agentrouter.org | 签到领取·随机 3 模型（OpenAI/Anthropic） | **100%** | **96.00** | 阿里云 WAF JS 挑战页（需浏览器） |
| **columbina** | newapi.columbina.eu.org | 签到领取·随机 2 模型（xAI/其他） | **50%** | 70.00 | 401 Invalid token（服务活，需 key） |
| GoRouter | gorouter.app | 签到领取·随机 2 模型（Anthropic） | 0% | 45 | 403 Cloudflare |
| JustDoWork | api.justwoker.icu | 签到 + **注册领 70 美元额度** | 0% | 45 | 401（服务活，需 key） |
| TaBiAI | tabitoken.com | 签到领取（Anthropic） | 0% | 45 | 403 Cloudflare |
| Any Router | anyrouter.top | 签到 + **注册领 50 美元额度**，另有 1 条（7 模型 OpenAI/Anthropic/Google） | 0% | 20.00 | 401 未提供令牌（服务活） |

读法：**只有 Agent Router(100%) 与 columbina(50%) 值得花时间**；三家 0% 基本瘫；JustDoWork 的"$70"与 AnyRouter 的"$50"
是注册额度（数字大＝多为高倍率等价额度，先小额实测再定级）。

## 6. GoAIHop 福利码中心（/benefits — 积分兑换，全部"登录后领取"）

| 商家 | 福利 | 使用条件 | 剩余 | 距结束 |
|------|------|---------|------|-------|
| FluxionAI | $3 无门槛体验额度 | 无 | 120 | 46 天 |
| Orbelis | 10U 试用订阅周卡（7 天有效） | 仅未领过、每号一次 | 72 | 18 天 |
| RickToken | $3 无门槛 | 无 | 67 | 15 天 |
| I Code Easy | ¥3 新用户体验（30 天） | 限新用户、无充值记录 | 58 | 4 天 |
| 元流 Token | $5 无门槛 | 无 | 42 | 15 天 |
| Z-API | 3 元体验额度（30 天） | 仅未领过、每号一次 | 39 | 16 天 |
| AI 聚合平台 | 5 算力（=¥5 额度，不可提现） | 赠送算力不可提现 | 37 | 2 天 |
| Top API | $3 无门槛 | 每号一次，加 Q 群找客服另有新人额度 | 27 | 16 天 |
| CodeGo | $3 无门槛 | 无 | 19 | 16 天 |
| LV Ping | 3 天 $20 体验额度（倍率 1x） | 3 天有效 | 8 | 17 天 |

**这是本轮"最像免费 key 的东西"**：码是真、库存明码、有效期明确；但兑换需 **GoAIHop 账号 + 已验证邮箱 + 积分**（积分来自站内行为），属**需用户点头的注册类受限项**，我不擅自开账号。

## 7. 端点面扫描（防遗漏，27 家一并测）

对 §GoAIHop 目录抓到的 27 个中转域名逐个匿名 `GET /v1/models`：
**结果 = ANON-OPEN: NONE**（全部 401 `API_KEY_REQUIRED` / `Invalid token`、403 CF、404 或返回 HTML）。
含 `baizhu.vip`（`API Key 无效或已被吊销`）、`fluxionai.space`、`api.ykh.ai`、`codeproxy.dev` 等。
→ 与 §2 结论一致：**这类站没有"无 key 即用"的口子**，与上一轮"唯一真匿名 = Pollinations"互相印证。

## 8. 净结论（增量部分）

1. **论坛明文 key 的真实寿命 ≈ 3 天**：本轮抓到并实测的唯一样本（v2ex Ox Alpha）已 401 死亡；帖内第 4 天就有人报废。
2. **本轮零新增可入池匿名端**。33 个端点（6 公益 + 27 中转）匿名全灭，阳性对照通过 → 结论可信。
3. **"免费 key"其实是三类不同东西**：① 官方免费档（一次注册长期用，唯一可依赖）② 公益站注册/签到额度（日抛，靠蹲）③ 目录站积分兑码（要账号，明码有效期，§6 表可直接抄作业）。
4. **可持续白嫖点（性价比排序，均需注册）**：CUN.AI 每日 $0.50 → 奶昔 New API 每日 1–2 刀 → GoAIHop §6 十家体验码 → Agent Router/columbina 签到 → SoleAPI/快跑AI/PQH 一次性 $5~$10。
5. **x.com 本轮无法覆盖**（登录墙），只搜到非 API 类兑换码帖 → 记为受限项。

## 9. 受限项待办（需用户点头，我不擅自做账号操作）

- [ ] 注册 GoAIHop（需验证邮箱）→ 兑 §6 十家体验码（重点：LV Ping 3 天 $20@1x、元流/FluxionAI/RickToken/CodeGo 各 $3）
- [ ] 用 L 站 Connect 登录：CUN.AI（每日 $0.50）、Agent Router、Any Router($50)、JustDoWork($70)、PM公益站 Free 组
- [ ] 奶昔：开 SSO（thread-4975 指引）→ New API 授权登录 → 领 5 刀 + 每日签到；**先排查本机到 newapi.naixi.net 的连通性（本轮 fetch failed，疑似需代理）**
- [ ] NodeSeek post-923808 / post-922604 两站真实域名：需浏览器过 CF（或用户代看一眼帖子）
- [ ] x.com 免费 key 蹲点：需登录态（属账号操作，默认不做）
- [ ] 任何 key 到手 → `add-free-api-pool.mjs` 入池（铁律：prio 90 / concurrency 1 兜底位）

## 10. 复现（本轮脚本，全部在仓外 `D:\tdsh\forum_leads_20260913\`）

`fetch.mjs <out> <url> [...]`（通用抓取）· `parse.mjs/parse2.mjs/parse3.mjs/parse4.mjs`（帖子/镜像/目录解析）
· `probe1.mjs`（v2ex 明文 key 生死）· `probe2.mjs`（6 家公益站）· `probe3.mjs`（27 家中转扫描）
· `probe4.mjs` + `ctrl.mjs`（候选 + 阳性对照）

## 11. 本会话增量补测（22:2x，只读探测，role=资料整理）

- **llm7 47 模型全清单**（`api.llm7.io/v1/models` 匿名 200）：仅 `L3-8B-Lunaris-v1-Turbo` 等少数为真开源权重，
  其余 gpt-5.x/claude/opus-5/gemini/grok/kimi-k3/glm-5.3 均为**网关聚合**（schema_endpoints 全 openai，
  anthropic 面仅 claude 系 7 个）。→ 模型多≠免费多，chat 一律需 `dash.llm7.io` 领 key。
- **llm7 鉴权矩阵**：无 Authorization/空 Bearer → 401 `Missing API key`；`Bearer anonymous` →
  401 `invalid, expired, or revoked... Generate a new key at dash.llm7.io`。→ 无匿名口。
- **freellm.net 链路挖掘**：页内 203KB 无 `sk-` 明文 key；外链 = 各官方 key 页 + `token.llm7.io` +
  `glhf.chat`（超时）+ `aionlabs`。`token.llm7.io/` 仅 669 字节空壳（`Token LLM7.io`），
  `/v1/models` 回 HTML。→ freellm 是导航站不是 key 池。
- **cups 更正复核**：`free-llm.cups.moe/v1/models` → 200 但回 HTML 安全验证页（WAF），非 API；
  与 §8"hCaptcha 挡内容"一致。`api.lolimi.cn` fetch failed（DNS/连通）。
- **角色声明**：本会话 role=资料整理（AGENTS §6），**不做注册/领码/入池等账号操作**；
  上述 key 领取入口（dash.llm7.io / GoAIHop / CUN.AI / 奶昔 SSO）全部列入 §9 受限项待用户点头。

## 12. 第二轮补测（22:4x，只读）

- **dash.llm7.io 任何路径**（`/`、`/api/keys`）→ 200 但 669 字节 SPA 空壳（前端渲染，需浏览器/登录态）。
  → 领 key 入口确认存在但属账号操作，不碰。
- **tokenra.io**：`tokenra.io/v1/models` → 401 new_api_error（New API 系，服务活，需 key）；
  `api.` 子域 DNS 不通。Ox Alpha 系 TokenRa 聚合国产模（豆包/DS/Kimi/GLM），网页版可免费用，
  API 需控制台建 key（受限项）。
- **chutes.ai**：官网 200（去中心化 GPU 网关，注册即钱包）；`api.chutes.ai/v1/models` → nginx 404
  （端点路径不同，需读其 auth 文档：API key 或 OAuth）。免费：每天 200 次试用（腾讯云文）。
  → 注册领 key 后按其文档端点入池（受限项）。
- **净结论不变**：仍无匿名可用新增；三家（llm7/tokenra/chutes）全部"注册领 key"制，已补入 §9 候选。
