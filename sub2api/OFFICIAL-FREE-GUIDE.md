# 官方免费档申请攻略（待用户执行，key 到手即入池）— 2026-09-13

> 公益站会跑路，官方档长期有效。按"稳→快→全"排序，任选 2 家即可。
> 入池脚本已 dry-run 验证可用（缺参 STOP 止动正常，见 add-free-api-pool.mjs）。

## 1. 硅基流动（国内首选，注册送约1亿 token）

- 注册：https://siliconflow.cn → 手机号注册 → 新用户送 14 元配额
- 建 key：控制台 → API 密钥 → 新建 → 复制 `sk-...`
- 免费模型：Qwen2.5 / 部分模型限时免费（以控制台 /models 为准）
- 入池（发我 key 即跑）：
```
$env:SF_NAME="siliconflow-free"; $env:SF_BASE="https://api.siliconflow.cn/v1"
$env:SF_KEY="<sk-...>"; $env:SF_MODELS='{"Tuan":"Qwen/Qwen2.5-7B-Instruct"}'
node add-free-api-pool.mjs
```

## 2. ModelScope（阿里，每天 2000 次）

- 注册：https://modelscope.cn → 注册 → 个人中心 → AccessToken
- 端点：`https://api-inference.modelscope.cn/v1`，模型名如 `Qwen/Qwen2.5-7B-Instruct`
- 免费量：每天 2000 calls（单模型≤500）
- 入池：
```
$env:SF_NAME="modelscope-free"; $env:SF_BASE="https://api-inference.modelscope.cn/v1"
$env:SF_KEY="<token>"; $env:SF_MODELS='{"Tuan":"Qwen/Qwen2.5-7B-Instruct"}'
node add-free-api-pool.mjs
```

## 3. OpenRouter（模型最全，:free 每天 50 次）

- 注册：https://openrouter.ai → 注册（无信用卡）→ Keys → Create → `sk-or-v1-...`
- 免费模型（19 个 :free，2026-09-13 实测，以官网 /models 为准）：
  `google/gemma-4-26b-a4b-it:free` / `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` /
  `cohere/north-mini-code:free` / `liquid/lfm-2.5-2.6b:free` ……
- 入池：
```
$env:SF_NAME="openrouter-free"; $env:SF_BASE="https://openrouter.ai/api/v1"
$env:SF_KEY="<sk-or-v1-...>"; $env:SF_MODELS='{"Tuan":"google/gemma-4-26b-a4b-it:free"}'
node add-free-api-pool.mjs
```

## 4. 其余（按需）

- 火山方舟：volcengine 注册，每模型每天 250 万 token（豆包+DS/K2）
- NVIDIA NIM：build.nvidia.com 注册，rpm 40（入池脚本 liunxddo/add-nvidia-nim-pool.mjs 就绪）
- Groq / Cerebras：邮箱注册即用，速度快、量小，适合突发
- Google AI Studio：`AIza...`，gemini-flash 限频免费

用户只需做：注册 → 复制 key 发我 → 我跑入池+验证 200+回报告。
