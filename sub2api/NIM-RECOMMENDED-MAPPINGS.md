# NVIDIA NIM 推荐映射（key 到手粘贴即用）— 2026-09-14

> 由 2026-09-14 当日直拉 `/v1/models`（82 模型）分析生成，**chat 兼容候选** 23 个。
> 用法：key 到手（U8 过 hCaptcha）后，从下表挑一个 Tuan 映射跑
> `liunxddo/add-nvidia-nim-pool.mjs`（脚本已就绪，未显式写 priority，以 DB 实际为准）。

## 推荐（按质量/速度平衡，均可作 Tuan 主映射）

| 模型 id | 家族 | 定位 |
|---|---|---|
| `z-ai/glm-5.3-flash` | 智谱 GLM | ⭐ 首选（先例已实测 200，见 FREE-API-CHANNELS 账号 19 先例） |
| `deepseek-ai/deepseek-v4-flash-0731` | DeepSeek | flash 档快，适合兜底 |
| `deepseek-ai/deepseek-v4-pro-0813` | DeepSeek | pro 档，质量更高 |
| `moonshotai/kimi-k3` | Kimi | 长上下文强 |
| `moonshotai/kimi-k2.6` | Kimi | 前代，若 k3 限流可换 |
| `openai/gpt-oss-20b` | OpenAI 开源系 | 中立可靠 |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Nemotron | 推理型，与 OpenRouter free 同款 |
| `nvidia/nemotron-3-super-120b-a12b` | Nemotron | 大号 super |
| `google/gemma-4-31b-it` | Gemma | 与 OpenRouter free 同款 |
| `google/gemma-3-12b-it` | Gemma | 上一代，备用 |
| `nvidia/llama-3.1-nemotron-70b-instruct` | Nemotron-Llama | 经典强模型 |
| `mistralai/mistral-large-2-instruct` | Mistral | 大号 |

## 完整 chat 兼容候选（23 个，按家族）

```
z-ai/glm-5.3-flash
deepseek-ai/deepseek-v4-flash-0731
deepseek-ai/deepseek-v4-pro-0813
moonshotai/kimi-k2.6
moonshotai/kimi-k3
openai/gpt-oss-20b
google/gemma-2b / gemma-3-4b-it / gemma-3-12b-it / gemma-4-31b-it / diffusiongemma-26b-a4b-it
meta/llama-3.2-11b-vision-instruct / llama-3.2-90b-vision-instruct / llama-guard-4-12b / muse-glimmer-30b
mistralai/codestral-22b-instruct-v0.1 / mistral-7b-instruct-v0.3 / mistral-large / mistral-large-2-instruct / mistral-nemotron / mixtral-8x22b-v0.1
nvidia/llama-3.1-nemotron-51b-instruct / llama-3.1-nemotron-70b-instruct / llama-3.1-nemotron-ultra-253b-v1 / nemotron-3-nano-omni-30b-a3b-reasoning / nemotron-3-super-120b-a12b / nemotron-3-ultra-550b-a55b / nemotron-4-340b-instruct / nemotron-3.5-lightning-30b-a3b
writer/palmyra-creative-122b / palmyra-fin-70b-32k / palmyra-med-70b / palmyra-med-70b-32k
```

> 注：82 模型中含 embed/guard/translate/vision 等非 chat 用途（embed-qa-4、nv-embedqa-*、
> nemoguard-*、riva-translate-*、vila、neva 等），入池 Chat 只用上表；具体以
> `/v1/models` 当日返回为准。rpm 40 硬限 → concurrency 1 不升权。