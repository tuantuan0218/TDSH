# 免注册可用推理端点 — 实测清单（2026-09-13）

> 本文回答：**哪些大模型端点是真的"不用注册、不用 key、直接能调"？**
> 全部结论来自本机 curl 实测（HTTP 状态码 + 真实出词），不采信宣传。

## 一、结论（一句话）

**能真正"零门槛免 key 出词"的，实测有 2 个：Pollinations 与 ai-api.xzt.plus。**
其余知名端点（OpenRouter / Groq / Cerebras / Together / Mistral / NVIDIA / HF）**全部需要 key**。

> ⚠️ **2026-09-13 深夜更新（第二轮复扫）**：新增发现 **`https://ai-api.xzt.plus/v1`** —— 免 key
> 提供 24 个模型，其中 **6 个实测真出词**（含 DeepSeek-V3.2、nemotron-3-ultra、gemma-4-31b-it），
> 且同一模型连测 3 次稳定通过。详见第三节。

## 二、实测矩阵（2026-09-13，本机 curl.exe）

| 端点 | 实测结果 | 判定 |
|---|---|---|
| **`https://text.pollinations.ai/openai`** | **HTTP 200，真出词 `PONG`** | ✅ **免 key 可用** |
| **`https://ai-api.xzt.plus/v1/chat/completions`** | **HTTP 200，真出词 `PONG`（6/10 模型可用、单模型 3/3 稳定）** | ✅ **免 key 可用** |
| `https://bazaarlink.ai/api/v1/chat/completions` | HTTP 401 `Missing API key. Use: Bearer sk-bl-...` | ❌ 需 key（models 免 key 可列） |
| `https://openrouter.ai/api/v1/chat/completions` | HTTP 401 `No cookie auth credentials found` | ❌ 需 key |
| `https://api.groq.com/openai/v1/chat/completions` | HTTP 403 `Forbidden` | ❌ 需 key |
| `https://api.cerebras.ai/v1/chat/completions` | HTML 拦截页（非 JSON） | ❌ 需 key |
| `https://api.together.xyz/v1/chat/completions` | `Missing API key` | ❌ 需 key |
| `https://api.mistral.ai/v1/chat/completions` | HTTP 401 `Invalid API Key` | ❌ 需 key |
| `https://integrate.api.nvidia.com/v1/chat/completions` | HTTP 410（模型已于 2026-08-26 下线） | ❌ 需 key 且模型已换 |
| `https://router.huggingface.co/v1/chat/completions` | 返回 HTML（登录页） | ❌ 需 key |
| `https://duckduckgo.com/duckchat/v1/chat` | HTTP 418 `ERR_CHALLENGE` | ❌ 有人机挑战 |
| `https://playground.ai.cloudflare.com/api/inference` | HTTP 404 | ❌ 端点不存在 |
| `https://free.empero.org/v1` | HTTP 503 `maintenance`（站点根 200，服务活着） | ⏳ 维护中，**可能复活** |

**阳性对照**：Pollinations 与 xzt 均出词 `PONG` → 证明探测链路正常，"其余全需 key"是真结论而非假阴性。

## 三、免 key 可用项详解

### 3.1 Pollinations（GPT-OSS 20B）

```
Base URL : https://text.pollinations.ai/openai
Model    : openai-fast   （别名：openai / gpt-oss / gpt-oss-20b / ovh-reasoning）
Key      : 不需要（任意值即可）
模态     : 纯文本输入输出；支持 tools；不支持 vision/audio
上游     : GPT-OSS 20B Reasoning LLM（OVH 托管）
层级     : 官方 catalog 标注 tier="anonymous"
```

### 3.2 ai-api.xzt.plus ★ 新发现（24 模型 / 6 个实测可用）

```
Base URL : https://ai-api.xzt.plus/v1
Key      : 不需要（实测空 Authorization 直接 200）
身份     : "AI Proxy — OpenAI 兼容的 AI 代理服务：多 Provider 路由"
模型目录 : GET /v1/models 免 key 返回 24 个模型
```

**免 key 出词实测结果（2026-09-13）**：

| 模型 | 结果 |
|---|---|
| `deepseek-ai/DeepSeek-V3.2` | ✅ 出词（**连测 3/3 稳定**） |
| `nemotron-3-ultra` | ✅ 出词 |
| `nemotron-3-super` | ✅ 出词 |
| `gemma-4-31b-it` | ✅ 出词 |
| `Qwen/Qwen3-8B` | ✅ 出词 |
| `kilo-auto/free` | ✅ 出词 |
| `gpt-oss-20b` | ❌ HTTP 200 但无正文 |
| `openrouter/free` | ❌ HTTP 200 但无正文 |
| `step-3.7-flash` | ❌ HTTP 403 |
| `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B` | ❌ HTTP 403 |

**其余 14 个模型未逐一实测**（`agnes-2.5-flash`、`muse-glimmer-30b`、`nemotron-3.5-lightning-30b-a3b`、
`Qwen/Qwen3.5-4B/9B`、`THUDM/GLM-Z1-9B-0414`、`tencent/Hunyuan-MT-7B`、`PaddlePaddle/PaddleOCR-VL-1.5`、
`deepseek-ai/DeepSeek-OCR`、`diffusiongemma-26b-a4b-it`、`ising-calibration-1.5-31b`、
`nemotron-3-nano-omni-30b-a3b-reasoning`、`step-3.5-flash` 等）。

直接调用：

```bash
curl -s https://ai-api.xzt.plus/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-ai/DeepSeek-V3.2","messages":[{"role":"user","content":"hi"}],"max_tokens":64}'
```

> ⚠️ **性质提醒**：这是第三方聚合代理（非官方厂商直连）。虽实测免 key 可用，
> 但**不保证长期稳定、不保证无日志留存**。建议只用于原型/测试，勿传敏感数据；
> 已纳入本机监控，失效会告警。

### 3.3 实测细节（Pollinations）

- `GET https://text.pollinations.ai/models` 返回该端点**当前可用模型目录**（带 `tier` 字段）。
- **当前只开放 1 个模型**：`openai-fast`（即 gpt-oss-20b 推理模型）。
- 实测以下模型名均 **HTTP 404**（已下线/仅注册用户）：`mistral`、`qwen-coder`、`llama-fast-roblox`、`deepseek-reasoning`。
- 出词带 `reasoning` 字段 → 该模型会先输出推理过程，`max_tokens` 给小了可能拿不到正文。

### 3.4 Pollinations 直接调用

```bash
curl -s https://text.pollinations.ai/openai \
  -H "Content-Type: application/json" \
  -d '{"model":"openai-fast","messages":[{"role":"user","content":"hi"}],"max_tokens":64}'
```

```python
from openai import OpenAI
client = OpenAI(base_url="https://text.pollinations.ai/openai", api_key="none")
print(client.chat.completions.create(
    model="openai-fast",
    messages=[{"role": "user", "content": "hi"}],
    max_tokens=64,
).choices[0].message.content)
```

## 四、为什么"免费"≠"免门槛"（第一性原理）

推理是要烧 GPU 的。任何厂商提供免费推理，必然要想清楚**谁付钱**。三种商业模式：

1. **买 token 送引流**：厂商自掏预算，要注册才有身份可追踪、可风控 → **免费但需注册**（OpenRouter/Groq/硅基流动等，占绝大多数）。
2. **拿数据换算力**：匿名可用，但代价是你的输入被用于训练 → **Pollinations 属此类**（V2EX 帖明确提示"prompt 和回复会被记录，IP 哈希"）。
3. **公益站/中转**：个人贴钱或转售，寿命以天计，且随时跑路 → 见 `FREE-API-FIVE-FORUMS.md`。

**推论**：凡是宣称"免注册无限免费"的商用级端点，要么是 2（你付隐私），要么是 3（随时消失）。
不存在"既免门槛、又稳定、又无限"的第四种——这不是技术问题，是成本结构决定的。

## 五、复现

### 5.1 单点复验（任一端点）

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://text.pollinations.ai/openai \
  -H "Content-Type: application/json" \
  -d '{"model":"openai-fast","messages":[{"role":"user","content":"PONG"}],"max_tokens":16}'
# 期望：200 且响应含 "content":"PONG"
```

### 5.2 批量探测（本会话新增工具）

```bash
node probe-keyless-endpoints.mjs                    # 内置 20 个候选
node probe-keyless-endpoints.mjs urls.txt           # 自备候选（每行一个 base URL）
node probe-keyless-endpoints.mjs --json out.json    # 输出结构化结果
```

**两步门逻辑**：先测 `GET /models` 免 key 是否可列 → 仅当通过才测 `POST /chat/completions` 是否免 key 出词。
① 过 ② 不过 = "仅清单开放（需 key）"，**不算免 key 可用**。

### 5.3 2026-09-13 全量扫描结果（20 候选）

| 判定 | 数量 | 端点 |
|---|---|---|
| ✅ **免 key 真出词** | **2** | `text.pollinations.ai/openai`、`ai-api.xzt.plus/v1` |
| 🟡 仅清单开放（需 key） | 4 | `bazaarlink.ai/api/v1`(171模型)、`api.airforce/v1`(615)、`api.llm7.io/v1`(47)、`free.suyu.io/v1`(9) |
| ⚪ 需 key（models 即 401/403/410） | 14 | 硅基流动 / DeepSeek / 智谱 / 百炼 / Moonshot / 火山方舟 / 腾讯混元 / 百度千帆 / MiniMax / 阶跃 / 零一万物 / 百川 / ChatAnywhere / gpt.ge |

**结论**：国产 12 家大厂**全部**在 `/models` 阶段即返回 401（零一万物 410、百度千帆 403），
**没有任何一家免 key 可列**；能免 key 列模型的 4 家（bazaarlink/airforce/llm7/suyu）聊天仍要 key。
**免 key 真可用端点经过 20 个候选系统扫描后仍稳定为 2 个**，与单点结论一致（互为独立复核）。

## 六、与本机既有体系的关系

- 本机 `free-quota-monitor.mjs` 的**阳性对照**就是这个 Pollinations 端点（已入池账号 18）。
- 本轮独立复验一致：**Pollinations 仍是唯一真匿名可用端点**，与既有监控结论互为交叉验证。
