# linux.do 公益 API 部署 Runbook（key 获取 + 一键入池）

> 配套：`LINUXDO-PUBLIC-API-COLLECTION.md`（渠道清单）、`add-nvidia-nim-pool.mjs`（NIM 入池脚本）
> 目标状态：**用户按本节拿到 key → 复制一行命令 → 入池完成**。所有入池动作走
> `add-free-api-pool.mjs` / `add-nvidia-nim-pool.mjs`（prio 90 兜底 / concurrency 1 /
> group 5 / force_chat_completions / supported=false 铁律不变）。

## 0. 总览

| # | 渠道 | key 获取难度 | 免费量 | 实测状态 |
|---|------|-------------|--------|---------|
| 1 | hub.linux.do | 有 linux.do 账号即可 | 闲置置换 credits | ✅ /models 401（需 key 正常） |
| 2 | NVIDIA NIM | build.nvidia.com 免费注册 | 模型多 rpm 40 | ✅ /models 匿名 200 列出 82 模型 |
| 3 | DeepLX 翻译 | linux.do Connect 领取 | 免费翻译 | ✅ 端点活（错误 key 401） |
| 4 | ModelScope | modelscope.cn 注册 | 2000 次/天 | 待测（无 token） |
| 5 | 火山方舟 | volcengine.com 注册 | 每模型 250w token/天 | 待测 |
| 6 | 七牛 AI | qiniu.com 领取资源包 | 300w token/年 | 待测 |
| 7 | oaipro / WONG | 站点注册送额度 | 不定 | ✅ 端点活（401 需 key） |

## 1. hub.linux.do（Linux DO 官方闲置 API 置换公益站）⭐最优先

- **流程**：
  1. 打开 https://hub.linux.do ，点 Sign up / Log in → linux.do Connect 授权登录
  2. 控制台 → API Keys → 创建 key（AxonHub 网关，key 用于 `Authorization: Bearer <key>`）
  3. 可把自己的 OpenAI/Anthropic 等闲置 key 作为 channel 挂出赚 credits，或用 credits 消费他人渠道
- **端点**：`https://hub.linux.do/v1`（备用 `https://hub.oaifree.com/v1`）
- **验证**：`curl https://hub.linux.do/v1/models -H "Authorization: Bearer <key>"` 应 200
- **入池**：
  ```powershell
  $env:SF_NAME="hub-linuxdo"; $env:SF_BASE="https://hub.linux.do/v1"
  $env:SF_KEY="<拿到的新建 key>"
  $env:SF_MODELS='{"Tuan":"<hub 上实际可用的模型 id>"}'
  node add-free-api-pool.mjs
  ```
- ⚠️ 模型 id 以 `/v1/models` 返回为准；hub 是 marketplace，渠道/模型会随他人挂载变动。

## 2. NVIDIA NIM（模型最全的免费档）⭐次优先

- **流程**：
  1. https://build.nvidia.com 注册（免费，邮箱即可）
  2. 任选一模型页 → Get API Key → 生成 `nvapi-...` key
  3. 免费模型实测可匿名列（82 个），chat 需 key：z-ai/glm-5.3-flash、deepseek-ai/deepseek-v4-flash-0731、
     moonshotai/kimi-k3、openai/gpt-oss-20b、nvidia/nemotron-3.5-lightning-30b-a3b 等
- **端点**：`https://integrate.api.nvidia.com/v1`
- **验证**：`curl https://integrate.api.nvidia.com/v1/models -H "Authorization: Bearer nvapi-xxx"` 应 200
- **入池**（脚本模板 `add-nvidia-nim-pool.mjs` 已就绪）：
  ```powershell
  $env:SF_NAME="nvidia-nim"; $env:SF_BASE="https://integrate.api.nvidia.com/v1"
  $env:SF_KEY="nvapi-xxx"; $env:SF_MODELS='{"Tuan":"z-ai/glm-5.3-flash"}'
  node liunxddo\add-nvidia-nim-pool.mjs
  ```
- ⚠️ 免费档 rpm 40 硬限：concurrency 1 必须，绝不升权（脚本已内置）。

## 3. DeepLX 免费翻译（linux.do Connect）

- **流程**：
  1. 需 linux.do 账号 → https://connect.linux.do 登录
  2. 页面上的 `DeepLX Api Key` 那一串 → 即 `<api-key>`
- **端点**：`https://api.deeplx.org/<api-key>/translate`（POST JSON：
  `{"text":"hello","source_lang":"EN","target_lang":"ZH"}`）
- **实测**：无 key → 400 invalid arguments；错误 key → 401 invalid api key；（vercel 版已被 451 封锁勿用）
- **入池**：翻译类不属 LLM 池，若 Tuan 池需要翻译能力另行评估；此处仅记录接入方式。
- ⚠️ key 是 connect 密钥，**禁止明文入库/入文档**（AGENTS §8），只经环境变量传递。

## 4. 阿里 ModelScope 魔搭（最稳国内）

- **流程**：modelscope.cn 注册 → 个人中心创建 API token（`<your-token>`）
- **端点**：`https://api-inference.modelscope.cn/v1/chat/completions`，模型名 `Qwen/Qwen2.5-7B-Instruct` 格式
- **免费量**：每天总 2000 次调用，单模型 ≤500（大模型 R1/V3.1 单模型 200/天）
- **入池**：
  ```powershell
  $env:SF_NAME="modelscope-free"; $env:SF_BASE="https://api-inference.modelscope.cn/v1"
  $env:SF_KEY="<token>"; $env:SF_MODELS='{"Tuan":"Qwen/Qwen2.5-7B-Instruct"}'
  node add-free-api-pool.mjs
  ```

## 5. 字节火山方舟（量大）

- **流程**：volcengine.com 注册 → 方舟控制台开通模型推理 → 创建 API key
- **端点**：`https://ark.cn-beijing.volces.com/api/v3`（模型以 endpoint id 或 model 名调用）
- **免费量**：每模型每天 250 万 token（豆包系 + deepseek-v3.2 / kimi-k2）
- **入池**：拿到 key 后同上模板（SF_BASE 填方舟 /api/v3）

## 6. 七牛 AI 大模型推理（可跑 OpenAI/Claude 系）

- **流程**：qiniu.com/ai/chat 注册 → 领取 300 万 token 免费资源包（有效期一年）
  → 控制台「订单管理/资源包管理/资源包明细」查看适用模型（含 claude/gpt 系）
- **端点**：见控制台文档（OpenAI 兼容）
- **入池**：拿到 key 后同上模板

## 7. 老牌公益中转（oaipro / WONG）—— 备选，时效差

- **oaipro**：`https://api.oaipro.com`（始皇 OAI），注册送额度，实测端点活（401=需 key）
- **WONG**：`https://wzw.pp.ua`（New API 系），实测端点活
- **7xnn**：`https://api.7xnn.cn` **已挂（TLS 拒绝）**，勿再尝试
- 这些公益站随时可能关闭/限流，只作兜底候选，不优先入池。

## 8. 入池后验证（铁律）

1. `node probe-free-models.mjs` 确认 /models 可达
2. 直连 chat 单发 200（免费结论以"200+不限量/已确认额度"为准）
3. SSH→Mac PG 只读核对 usage_logs 路由（account_id 查新账号）
4. 观察 429/402：error_rate 自动避让即可，勿手动关调度