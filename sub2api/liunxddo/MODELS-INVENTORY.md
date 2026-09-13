# 免费模型清单参照表（key 到手后入池对照用，2026-09-13 快照）
> 来源：NVIDIA NIM / FreeModel.dev /models 匿名实测。
> 用途：拿到 key 后从本表选模型 id 填 SF_MODELS 入池。

## 一、NVIDIA NIM（82 模型，rpm 40）

| 模型 id | 备注 |
|---------|------|
| `01-ai/yi-large` | |
| `adept/fuyu-8b` | |
| `ai21labs/jamba-1.5-large-instruct` | |
| `aisingapore/sea-lion-7b-instruct` | |
| `bigcode/starcoder2-15b` | |
| `databricks/dbrx-instruct` | |
| `deepseek-ai/deepseek-coder-6.7b-instruct` | |
| `deepseek-ai/deepseek-v4-flash-0731` | |
| `deepseek-ai/deepseek-v4-pro-0813` | |
| `google/codegemma-1.1-7b` | |
| `google/codegemma-7b` | |
| `google/deplot` | |
| `google/diffusiongemma-26b-a4b-it` | |
| `google/gemma-2b` | |
| `google/gemma-3-12b-it` | |
| `google/gemma-3-4b-it` | |
| `google/gemma-4-31b-it` | |
| `google/recurrentgemma-2b` | |
| `ibm/granite-3.0-3b-a800m-instruct` | |
| `ibm/granite-3.0-8b-instruct` | |
| `ibm/granite-34b-code-instruct` | |
| `ibm/granite-8b-code-instruct` | |
| `meta/codellama-70b` | |
| `meta/llama2-70b` | |
| `meta/llama-3.2-11b-vision-instruct` | |
| `meta/llama-3.2-90b-vision-instruct` | |
| `meta/llama-guard-4-12b` | |
| `meta/muse-glimmer-30b` | |
| `microsoft/kosmos-2` | |
| `microsoft/phi-3.5-moe-instruct` | |
| `microsoft/phi-3-vision-128k-instruct` | |
| `mistralai/codestral-22b-instruct-v0.1` | |
| `mistralai/mistral-7b-instruct-v0.3` | |
| `mistralai/mistral-large` | |
| `mistralai/mistral-large-2-instruct` | |
| `mistralai/mistral-nemotron` | |
| `mistralai/mixtral-8x22b-v0.1` | |
| `moonshotai/kimi-k2.6` | |
| `moonshotai/kimi-k3` | |
| `nvidia/ai-synthetic-video-detector` | |
| `nvidia/cosmos-reason2-8b` | |
| `nvidia/embed-qa-4` | |
| `nvidia/ising-calibration-1.5-31b` | |
| `nvidia/llama-3.1-nemoguard-8b-content-safety` | |
| `nvidia/llama-3.1-nemoguard-8b-topic-control` | |
| `nvidia/llama-3.1-nemotron-51b-instruct` | |
| `nvidia/llama-3.1-nemotron-70b-instruct` | |
| `nvidia/llama-3.1-nemotron-safety-guard-8b-v3` | |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1` | |
| `nvidia/llama-3.2-nemoretriever-1b-vlm-embed-v1` | |
| `nvidia/llama-3.2-nv-embedqa-1b-v1` | |
| `nvidia/llama3-chatqa-1.5-70b` | |
| `nvidia/llama-nemotron-embed-vl-1b-v2` | |
| `nvidia/mistral-nemo-minitron-8b-8k-instruct` | |
| `nvidia/nemotron-3.5-content-safety` | |
| `nvidia/nemotron-3.5-lightning-30b-a3b` | |
| `nvidia/nemotron-3-embed-1b` | |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | |
| `nvidia/nemotron-3-super-120b-a12b` | |
| `nvidia/nemotron-3-ultra-550b-a55b` | |
| `nvidia/nemotron-4-340b-instruct` | |
| `nvidia/nemotron-4-340b-reward` | |
| `nvidia/nemotron-nano-3-30b-a3b` | |
| `nvidia/nemotron-parse` | |
| `nvidia/nemotron-parse-2.0` | |
| `nvidia/neva-22b` | |
| `nvidia/nvclip` | |
| `nvidia/nv-embedqa-mistral-7b-v2` | |
| `nvidia/riva-translate-4b-instruct` | |
| `nvidia/riva-translate-4b-instruct-v1.1` | |
| `nvidia/riva-translate-4b-instruct-v2` | |
| `nvidia/vila` | |
| `nv-mistralai/mistral-nemo-12b-instruct` | |
| `openai/gpt-oss-20b` | |
| `poolside/laguna-xs-2.1` | |
| `snowflake/arctic-embed-l` | |
| `writer/palmyra-creative-122b` | |
| `writer/palmyra-fin-70b-32k` | |
| `writer/palmyra-med-70b` | |
| `writer/palmyra-med-70b-32k` | |
| `z-ai/glm-5.3-flash` | |
| `zyphra/zamba2-7b-instruct` | |

## 二、FreeModel.dev（7 模型，GPT-5.x 前沿）

| 模型 id | 备注 |
|---------|------|
| `gpt-5.3-codex` | 前沿 GPT-5.x |
| `gpt-5.4` | 前沿 GPT-5.x |
| `gpt-5.4-mini` | 前沿 GPT-5.x |
| `gpt-5.5` | 前沿 GPT-5.x |
| `gpt-5.6-luna` | 前沿 GPT-5.x |
| `gpt-5.6-sol` | 前沿 GPT-5.x |
| `gpt-5.6-terra` | 前沿 GPT-5.x |

## 三、推荐入池映射（Tuan→模型）

- NIM 兜底：`z-ai/glm-5.3-flash`（快）/ `deepseek-ai/deepseek-v4-flash-0731`（主力）
- FreeModel：`gpt-5.4-mini`（成本可控）/ `gpt-5.5`（更强）
