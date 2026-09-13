# 免注册可用推理端点 — 实测清单（2026-09-13）

> 本文回答：**哪些大模型端点是真的"不用注册、不用 key、直接能调"？**
> 全部结论来自本机 curl 实测（HTTP 状态码 + 真实出词），不采信宣传。

## 一、结论（一句话）

**能真正"零门槛免 key 出词"的，实测只有 1 个：Pollinations。**
其余知名端点（OpenRouter / Groq / Cerebras / Together / Mistral / NVIDIA / HF）**全部需要 key**。

## 二、实测矩阵（2026-09-13，本机 curl.exe）

| 端点 | 实测结果 | 判定 |
|---|---|---|
| **`https://text.pollinations.ai/openai`** | **HTTP 200，真出词 `PONG`** | ✅ **免 key 可用** |
| `https://openrouter.ai/api/v1/chat/completions` | HTTP 401 `No cookie auth credentials found` | ❌ 需 key |
| `https://api.groq.com/openai/v1/chat/completions` | HTTP 403 `Forbidden` | ❌ 需 key |
| `https://api.cerebras.ai/v1/chat/completions` | HTML 拦截页（非 JSON） | ❌ 需 key |
| `https://api.together.xyz/v1/chat/completions` | `Missing API key` | ❌ 需 key |
| `https://api.mistral.ai/v1/chat/completions` | HTTP 401 `Invalid API Key` | ❌ 需 key |
| `https://integrate.api.nvidia.com/v1/chat/completions` | HTTP 410（模型已于 2026-08-26 下线） | ❌ 需 key 且模型已换 |
| `https://router.huggingface.co/v1/chat/completions` | 返回 HTML（登录页） | ❌ 需 key |
| `https://duckduckgo.com/duckchat/v1/chat` | HTTP 418 `ERR_CHALLENGE` | ❌ 有人机挑战 |
| `https://playground.ai.cloudflare.com/api/inference` | HTTP 404 | ❌ 端点不存在 |

**阳性对照**：Pollinations 出词 `PONG` → 证明探测链路正常，"其余全需 key"是真结论而非假阴性。

## 三、唯一可用项详解：Pollinations

```
Base URL : https://text.pollinations.ai/openai
Model    : openai-fast   （别名：openai / gpt-oss / gpt-oss-20b / ovh-reasoning）
Key      : 不需要（任意值即可）
模态     : 纯文本输入输出；支持 tools；不支持 vision/audio
上游     : GPT-OSS 20B Reasoning LLM（OVH 托管）
层级     : 官方 catalog 标注 tier="anonymous"
```

### 实测细节

- `GET https://text.pollinations.ai/models` 返回该端点**当前可用模型目录**（带 `tier` 字段）。
- **当前只开放 1 个模型**：`openai-fast`（即 gpt-oss-20b 推理模型）。
- 实测以下模型名均 **HTTP 404**（已下线/仅注册用户）：`mistral`、`qwen-coder`、`llama-fast-roblox`、`deepseek-reasoning`。
- 出词带 `reasoning` 字段 → 该模型会先输出推理过程，`max_tokens` 给小了可能拿不到正文。

### 直接调用

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

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://text.pollinations.ai/openai \
  -H "Content-Type: application/json" \
  -d '{"model":"openai-fast","messages":[{"role":"user","content":"PONG"}],"max_tokens":16}'
# 期望：200 且响应含 "content":"PONG"
```

## 六、与本机既有体系的关系

- 本机 `free-quota-monitor.mjs` 的**阳性对照**就是这个 Pollinations 端点（已入池账号 18）。
- 本轮独立复验一致：**Pollinations 仍是唯一真匿名可用端点**，与既有监控结论互为交叉验证。
