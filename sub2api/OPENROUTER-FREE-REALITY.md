# OpenRouter 免费模型 — 实测边界与就绪配置（2026-09-13）

> 本文回答一个具体问题：**OpenRouter 的免费模型到底能不能白嫖、怎么用。**
> 全部结论来自本机 curl 实测 + 实时目录解析，非二手整理。

## 一、先给结论（最重要的一条）

| 问题 | 实测结果 |
|---|---|
| 免费模型列表能否免 key 查看？ | ✅ **能**。`GET https://openrouter.ai/api/v1/models` 免 key 返回 **HTTP 200**，445 个模型全量可见 |
| 免费模型能否免 key 调用？ | ❌ **不能**。`POST /chat/completions` 免 key 返回 **HTTP 401** `No cookie auth credentials found` |
| 那"免费"是什么意思？ | **免费 = 注册账号后调用不扣费**（价格字段为 0），**不是"免注册可用"**。门槛是一个免费 OpenRouter 账号 + 一把 `sk-or-v1-*` key |

**一句话**：OpenRouter 免费档是**真免费**（不收钱），但**必须先免费注册拿 key**，不存在"无 key 直接蹬"的路径。

## 二、22 个零价模型（实测判据：`pricing.prompt == 0 && pricing.completion == 0`）

已按**可用性价值**分四级（分级逻辑见 `build-openrouter-free-config.mjs`）：

| 级别 | 数量 | 含义 |
|---|---|---|
| **A** | **9** | 纯文本 + 大上下文，可当主力/兜底 |
| B | 8 | 多模态或条件一般，可作次选 |
| C | 3 | 音频/多模态专用，非文本对话 |
| D | 2 | 安全审核模型、极小模型，不可当通用主力 |

### A 级全表（推荐优先用这些）

| 模型 ID | 上下文 | 备注 |
|---|---|---|
| `openrouter/free` | 200K | **官方免费聚合路由**，自动选可用免费模型 —— 最省心，推荐首选 |
| `nvidia/nemotron-3.5-lightning:free` | **1M** | 超长上下文 |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | **1M** | 550B 大模型 |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262K | 120B |
| `cohere/north-mini-code:free` | 256K | **代码向** |
| `inclusionai/ling-3.0-flash-sante:free` | 262K | — |
| `inclusionai/ling-3.0-flash-fin:free` | 262K | — |
| `poolside/laguna-s-2.1:free` | 262K | — |
| `poolside/laguna-xs-2.1:free` | 262K | — |

## 三、拿来即用（key 到位后 1 条命令入池）

本机已有入池工具，配置**已预先备好**在 `openrouter-free-config.json`：

```powershell
# 1) 去 https://openrouter.ai/keys 免费注册并创建 key（sk-or-v1-...）
# 2) 执行（把 <your-key> 换成你的 key）
$env:SF_NAME   = "openrouter-free"
$env:SF_BASE   = "https://openrouter.ai/api/v1"
$env:SF_KEY    = "<your-key>"
$env:SF_MODELS = '{"Tuan":"openrouter/free","nvidia/nemotron-3.5-lightning:free":"nvidia/nemotron-3.5-lightning:free","nvidia/nemotron-3-ultra-550b-a55b:free":"nvidia/nemotron-3-ultra-550b-a55b:free"}'
node D:\tdsh\sub2api\add-free-api-pool.mjs
```

也可用标准 OpenAI SDK 直连（任何 key 到位后）：

```python
from openai import OpenAI
client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key="sk-or-v1-...")
r = client.chat.completions.create(model="openrouter/free",
        messages=[{"role": "user", "content": "hi"}])
print(r.choices[0].message.content)
```

## 四、注意（免费档的真实限制）

- 免费模型约有 **~20 req/min、50–1000 req/day** 的速率限制（以官方页面为准）。
- 免费模型**随上游变动**（可能突然下架或转收费）—— 本机 `free-official-tiers.mjs` 已在追踪，转收费会告警 `💸 零价模型消失/转收费`。
- 部分模型可能要求账户有余额记录（OpenRouter 政策曾变动），**首次使用前先跑一次实测**。

## 五、复现

```bash
curl -sL https://openrouter.ai/api/v1/models -o openrouter_models.json
node build-openrouter-free-config.mjs openrouter_models.json openrouter-free-config.json
```

原始数据：`_freeapi_probe/openrouter_models.json`
