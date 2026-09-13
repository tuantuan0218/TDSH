# linux.do 公益 API 收集清单（2026-09-13 采集）

> 来源：linux.do 论坛公开帖（r.jina.ai 通道采集，原始文本见同目录 topic-*.txt）
> 用途：为 sub2api Tuan 池补充免费渠道候选。
> ⚠️ 公益站时效性极差（多数半年内失效/私密），入池前必须逐个实测。

## 一、官方/大站（优先）

| 渠道 | 端点 | 状态 | 说明 |
|------|------|------|------|
| **hub.linux.do**（Linux DO 官方闲置API置换公益站） | `https://hub.linux.do/v1`（备用 `https://hub.oaifree.com/v1`） | ✅ 可达，需 key | 基于 AxonHub 网关；把闲置额度挂成公开渠道赚 credits，再消费别的模型；需 linux.do Connect 登录注册领取 key（**受限项：需用户注册**） |
| 始皇 OAI（api.oaipro.com） | `https://api.oaipro.com/v1` | ✅ 可达，需 key（401） | 老牌公益中转，linux.do 多个帖力推 |
| WONG 公益站（wzw.pp.ua） | `https://wzw.pp.ua/v1` | ✅ 可达，需 key（401） | New API 系公益站 |
| api.7xnn.cn 公益中转 | `https://api.7xnn.cn/v1` | ❌ TLS 拒绝（疑似已挂） | 2024 帖，注册送 10 刀 |

## 二、官方厂商免费档（需注册 key，比公益站稳定）

| 平台 | 免费内容 | 关键限制 |
|------|---------|---------|
| **NVIDIA NIM**（build.nvidia.com） | glm-4.7 / minimax-m2.1 / deepseek-v3.2 / qwen3-coder-480b / kimi-k2-thinking 等；FLUX.1-dev 文生图 25 req | rpm 40；`https://integrate.api.nvidia.com/v1`；此前探测 401 需 key |
| **Cerebras** | glm-4.7 免费（20260109 起） | 每天 100 万 token（tpd-1M），rpm 10；inference-docs.cerebras.ai |
| **阿里 ModelScope 魔搭** | API-Inference 每天总 2000 次，单模型 ≤500（大模型 R1/V3.1 单模型 200/天） | `https://api-inference.modelscope.cn/v1/chat/completions`，需 token |
| **字节火山方舟** | 每模型每天免费 250 万 token | 豆包系 + deepseek-v3.2 / kimi-k2-0905；rpm 1000~10000 |
| **美团 LongCat** | 每账号每天 50 万 token | 输出 max 8K tokens，超限 429；longcat.chat |
| **七牛 AI 大模型推理** | 300 万免费 token，有效期一年 | 号称能调 OpenAI/Claude/Gemini（疑似 2API 渠道）；qiniu.com/ai/chat |
| **智谱 GLM Flash 系** | GLM-4-Flash / 4.1V-Thinking-Flash / Cogview-3-Flash 免费 | 并发 200/10；bigmodel.cn 福利专区 |
| **快手 KAT-Coder** | KAT-Coder-Air 长期免费 | 高峰 120 req/6h，非高峰 200 req/6h |
| **硅基流动** | 小模型（7B/8B/9B）长期免费 | tpm-50k；**已有池账号 17（额度耗尽 402）** |
| **OpenRouter :free** | 19 个 :free 模型 | 免充 50 rpd，充 10 刀 1000 rpd；**已列为候选（需用户注册 key）** |
| **Mistral** | 免费额度极大（tpm 50 万 / 月 10 亿 token） | 官方 chat 效果一般；le-chat API |
| **Groq** | kimi-k2 / gpt-oss-120b / llama-4-maverick 免费 | rpm 10~60，日 token 仅 10~50 万 |
| **ZenMux** | gemini-3-flash-preview-free / mimo-v2-flash / kat-coder-pro / glm-4.6v-flash | 新平台（25-08 运营），稳定性待观察 |
| **Poe** | 免费用户每天 3000 points（仅当日） | 不支持结构化输出，不推荐 API 用 |

## 三、公益 API 细分类（老帖收录，多数需逐一验证）

### AI 对话
- DDG-Chat（逆向 ChatGPT API）：linux.do/t/topic/251446
- FastGPT 系列（免费，可接 New API）：topic 223036/183289/182256
- GPT 部分模型公益 API：topic 187639
- 谷歌送 Claude API：topic 187088
- 50 刀免费 GPT+Claude Key（1000 刀总量）：topic 183123

### AI 绘图
- CF Worker 部署无限免费绘图 API（openai 格式，可接 new-api）：topic 222639/186692/185850
- Flux 绘图 API：topic 218423；Flux.1 生图 API：topic 267153

### 翻译
- **DeepLX**（DeepL 免费 API，已切 LINUX DO Connect 认证）：topic 111737
- Deepl API / Deepl Pro 翻译转 API：topic 212038/169303

### 图片
- 公益图床 + 随机图片 API：topic 169025
- Pixiv 图 API：topic 214281

## 四、部署结论（入池决策）

- **本轮可直接入池的候选**：均需 key/注册 → 全部为**受限项（需用户注册/给 key）**。
- **推荐优先级**：
  1. hub.linux.do（若用户有 linux.do 账号，Connect 登录即领 key，最正规）→ 参照 add-free-api-pool.mjs 模板入池
  2. NVIDIA NIM（rpm 40，模型新）→ 需 build.nvidia.com 注册
  3. ModelScope（每天 2000 次，qwen 系稳定）→ 需 token
- **keyless 通道**：仍只有 Pollinations（已在池 18），本轮未发现新 keyless 匿名端点。

## 五、采集记录

- topic-278809-raw.txt：免费&靠谱 API 集合贴（2024-12）
- topic-173592-raw.txt：公益 API 汇总帖（2024-08，含 hub/7xnn 等）
- topic-2005411-raw.txt：闲置 API 置换公益 = hub.linux.do 官方帖（2026-04，955 楼活跃）
- topic-1349579-raw.txt：免费大模型厂商整理（2025-12，最详实）
- topic-1557611-raw.txt：公益站 API 使用指南（令牌创建/签到）
- topic-111737-raw.txt：DeepLX 翻译 API（linux.do Connect 认证）
- 已失效帖：275566（硅基流动公益）、267437（Claude 公益）、144264、261941 → 404/私密

## 六、实测结论补录（2026-09-13 第二轮）

- **hub.linux.do 匿名性**：AxonHub 网关所有 /v1 端点（chat/completions、models）均需
  `Authorization: Bearer <key>`，无匿名通道（源码路由表核实：routes.go 全部 openaiGroup
  端点走认证中间件）。必须注册领 key，无可绕过路径。
- **NVIDIA NIM**：/models 匿名 200 可列 82 模型；chat 匿名 500（需 key）。免费注册即用。
- **oaipro**（api.oaipro.com）：端点活，401 "无效的令牌"（neo_api_error）→ 需 key。
- **WONG**（wzw.pp.ua）：端点活，401 "未提供令牌"（new_api_error）→ 需 key。
- **7xnn**（api.7xnn.cn）：TLS 拒绝，已死，勿再尝试。
- **DeepLX**（api.deeplx.org）：无 key→400 invalid arguments，错 key→401 invalid api key；
  key 从 connect.linux.do 领取（`api.deeplx.org/<api-key>/translate`）；vercel 版已被 451 封锁。
- **非 LLM 公益 API（keyless 实测）**：一言 hitokoto（v1.hitokoto.cn）200 keyless；
  60s API（60s.viki.moe/v2/60s）200 keyless；xxapi.cn / img.viki.moe TLS 拒绝。

## 七、第三轮实测补录（老帖公益站）

- **图床/随机图帖（169025）、Pixiv 图帖（214281）**：均已失效（404/私密），勿再尝试。
- **Flux 绘图 CF Worker 变体（218423）**：帖活，完整 worker 代码（支持 FLUX.1-Schnell-CF /
  DS-8-CF / SD-XL 系列 + 外部提示词 API 选项）→ 与 222639 方案二选一部署，均需 CF 账号。
- **DeepLX 本地 API（111602）**：✅ **已实际部署**（`liunxddo/bin/deeplx_windows_amd64.exe`，
  v1.2.4，2026-08 发布，25MB，D 盘非 C 盘），服务监听 `0.0.0.0:1188`，POST `/translate`
  （JSON: text/source_lang/target_lang）。
  - 实测：本地服务正常响应；当前出口 IP 被 DeepL 官方临时封锁（429 too many requests），
    属上游限流非部署故障——换出口/等待解封即恢复。独立于 linux.do Connect key 的
    **自主部署免费翻译方案**，比 api.deeplx.org（需 connect key）更可控。
  - 启停：启动见 `bin/deeplx.log`；日志在 bin/ 目录；需要常驻时复制到自管目录手动启动。
