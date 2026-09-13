# 免费 API Key 搜集 · 实测清单

> 采集日期：2026-09-13
> 来源社区：linux.do / v2ex.com / nodeseek.com / forum.naixi.net / x.com
> 方法：搜索引擎检索 → 抓取原帖/站点 → **curl 实测端点**（不看宣传，只认 HTTP 响应）

---

## 一、结论速览（第一性原理）

「免费 API key」本质只有三类载体，**风险与寿命完全不同**：

| 类型 | 本质 | 寿命 | 建议 |
|---|---|---|---|
| A. 官方厂商免费额度 | 厂商自掏预算做拉新，**你自己注册拿 key** | 月~年，规则会变但不会跑路 | ✅ 主力，长期可用 |
| B. 公益站/中转站 | 个人或社区搭的 New API 网关，送额度 | **天~周，随时关停** | ⚠️ 补充，别依赖 |
| C. 公开分享的裸 key / 公共端点 | 别人贴出的 key 或"任意 key 可用"端点 | **小时~天，随时被封/失效** | ❌ 仅临时测试 |

**本次实测最重要的发现：C 类基本已死。** 详见第三节。

---

## 二、✅ A 类：官方免费额度（推荐，实测控制台可达）

全部为**你自己注册**获得，无中间人、无跑路风险。

| 平台 | 免费额度 | 控制台（实测 HTTP） | 备注 |
|---|---|---|---|
| **Google AI Studio** | Gemini 免费档，15 RPM（Flash） | 200 → https://aistudio.google.com/apikey | 免信用卡，最推荐 |
| **Groq** | 约 14,400 次/天，LPU 极快 | 403（Cloudflare 拦 bot，浏览器可开）→ https://console.groq.com/keys | 速度第一 |
| **Cerebras** | 免费推理额度 | 403（同上）→ https://cloud.cerebras.ai/ | 大模型高速 |
| **OpenRouter** | 多个 `:free` 模型 | 200 → https://openrouter.ai/keys | 聚合，一个 key 多模型 |
| **智谱 GLM** | 新用户赠送额度 | 200 → https://open.bigmodel.cn/usercenter/apikeys | 国内直连 |
| **阿里百炼（通义千问）** | 新用户 7000 万 tokens | 200 → https://bailian.console.aliyun.com/ | 国内最慷慨之一 |
| **硅基流动 SiliconFlow** | 14+ 模型免费 | 200 → https://cloud.siliconflow.cn/account/ak | 国内直连 |
| **GitHub Models** | 免费调用 GPT/Claude/Llama | 200 → https://github.com/marketplace/models | 用 GitHub 账号 |
| **Cloudflare Workers AI** | 每日免费 neuron 额度 | 200 → https://dash.cloudflare.com/ | 边缘部署 |
| **Mistral** | 免费档 | 303（重定向，正常）→ https://console.mistral.ai/api-keys | 欧洲厂商 |

> 结构化数据源（162 家 / 每日更新）：https://yangmao.ai/zh/data/ai-free-tiers/ （含 JSON / CSV 下载）

---

## 三、🔴 C 类实测：公开 key 渠道**已大面积失效**

这是本次刷站最有价值的结论，**避免你再花时间去撞**：

| 渠道 | 社区口碑 | 实测结果 | 判定 |
|---|---|---|---|
| **alistaitsacle/free-llm-api-keys** (GitHub) | linux.do / nodeseek / v2ex 三站都在推，号称"最简单免费 key" | `Repository access blocked` — **GitHub 以 tos 理由封禁，2026-07-08**；raw 404 | 💀 **已死** |
| **FreeLLMKeys.com** | nodeseek 帖推荐 | 前端 JS 动态加载，**真实数据源就是上面那个被封的仓库** → 列表为空；其 base URL `aiapiv2.pekpik.com` 实测返回 `new_api_error: Invalid token` | 💀 **已死** |
| **Empero**（`free.empero.org`） | V2EX 8/27 帖 + X 上最火，号称"任意 key 可用" | 实测 **HTTP 503**：`We are switching the free endpoint to new models` | ⚠️ **维护中**，可能复活 |
| **TokenHarbor**（`tokenharbor.ai`） | V2EX 推荐 | 实测明确拒绝：**封中国大陆 / 港澳 / 受制裁地区** | ❌ 大陆不可用 |
| **速语/云悟/bazaarlink** | 多站推广 | 站点 200 存活，但需注册登录，未实测出 key | ⚠️ 待验证 |
| **qwq.aigpu.cn** | — | 连接超时 | ❌ 挂了 |
| **free-llm.cupsfunny.com** | nodeseek 7/8 帖 | 连接失败 | ❌ 挂了 |

---

## 四、⚠️ B 类：公益站 / 中转站（有实测存活的）

**本次唯一实测存活且可用的**：

| 站点 | 实测 | 说明 |
|---|---|---|
| **AIHubMix** `aihubmix.com/v1` | ✅ **models 接口 200，返回真实模型列表**（含 `gpt-6-astra`、`gemini-3.8-flash`、`auto` 智能路由） | 免费项：Coding GLM 5.3，需注册拿 key。https://aihubmix.com/models?q=free |
| **WECODING** `wecoding.xyz` | ✅ 站点 200，`/health` 返回 `{"status":"ok"}`；`/v1/models` 返回 `API_KEY_REQUIRED`（**说明服务真实存活，注册后可拿 key**） | 号称"无条件的免费 AI 中转站"。https://www.wecoding.xyz/register |

**其他社区提及的公益站**（未逐一实测，寿命短，仅供参考）：
- linux.do：始皇 oaipro、GG 公益站、魔方公益站、Leaf（Qwen 逆向）、Axonhub 闲置 API 置换（https://linux.do/t/topic/2005411）
- nodeseek：Dooong AI、catcup 公益站、省省 API（tokenshengsheng.com）、baobu.xyz
- 奶昔论坛：**奶昔 New API**（https://forum.naixi.net/thread-4932-1-1.html，需奶昔 SSO + 积分兑换）、Nyxar API（送 1000 刀兑换码）

---

## 五、关于 x.com

**x.com 不是免费 LLM key 的分享源。** 查证结论：
- X 官方 API 自 2026 年起**已取消免费读取额度**，改为按量付费
- X 上的相关信息是**转发**其他来源（如 Empero 的推广），原始出处仍是 V2EX / linux.do
- 若要抓 X 内容，需第三方 API（Sorsa 等）或 MCP 服务，均非免费

---

## 六、行动建议

1. **立刻做**：去 Google AI Studio + 智谱 + 阿里百炼 + 硅基流动 各注册一个 key —— 这四个是国内可直连、最稳的长期免费档。
2. **补充**：OpenRouter 一个 key 覆盖多模型；Groq 要速度。
3. **别碰**：公开贴出的裸 key、alistaitsacle 系列、FreeLLMKeys —— 已死或随时死。
4. **公益站只当彩蛋**：用前先看 `/models` 是否能返回，别写进生产代码。

---

## 附：原始线索链接

- V2EX 免费模型汇总（2026-08-27，6 个 base URL）：https://www.v2ex.com/t/1237723
- V2EX 30+ 模型靠谱渠道（2026-09-01）：https://www.v2ex.com/t/1238825
- linux.do 长期稳定免费额度整理：https://linux.do/t/topic/1349579
- linux.do 免费 API 集合帖：https://linux.do/t/topic/278809
- nodeseek 无需注册免费领 key：https://www.nodeseek.com/post-855226-1
- nodeseek 无条件免费中转站：https://www.nodeseek.com/post-878033-1
- 奶昔论坛 New API 限免：https://forum.naixi.net/thread-4932-1-1.html
