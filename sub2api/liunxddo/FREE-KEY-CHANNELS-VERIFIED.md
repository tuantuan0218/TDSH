# 免费 key 渠道实测清单（第二张）— 2026-09-13

> 目的：补全 FREE-API-CHANNELS.md 的候选实证。本轮实测 = **匿名 /models 可达性**；
> 免费模型/限流数据来自 linux.do 帖 1349579（2025-12 最详实厂商整理）。
> **结论先行**：5 个平台全部需 key（受限项），无一匿名可用；扩池必须用户注册。

## 一、本轮匿名实测（2026-09-13）

| 平台 | /models 匿名结果 | 判定 |
|------|-----------------|------|
| Cerebras（api.cerebras.ai） | 403（Cloudflare 挑战页，非数据） | 需 key |
| Groq（api.groq.com/openai/v1） | 403 Forbidden | 需 key |
| Mistral（api.mistral.ai） | 401 Invalid API Key | 需 key |
| ZenMux（zenmux.ai/v1） | 404（路径需查文档） | 需 key |
| Poe（api.poe.com/bot/v1） | 404（bot 端点不同） | 需 key |

**对比**：NVIDIA NIM `/models` 匿名 200（82 模型）是唯一可匿名列模型的平台——
这正是 NIM 排首位的实证基础。
**复查（2026-09-13 14:5x）**：/models 仍匿名 200、模型总数 82 不变、8 个核心免费模型
（glm-5.3-flash / deepseek-v4-flash/pro / kimi-k3 / gpt-oss-20b / nemotron-3.5-lightning /
nemotron-3-ultra / laguna-xs-2.1）全部在列、无新增无下架——候选项状态未漂移，入池即用。
**重要补充（2026-09-13 15:3x）**：**FreeModel.dev 是继 NIM 后第二个匿名可列模型的平台**——
`freemodel.dev/v1/models` 与 `api.freemodel.dev/v1/models` 均匿名 200；`freemodel.dev` 列 7 模型
全为前沿 GPT-5.x（gpt-5.6-sol/terra/luna、gpt-5.5、gpt-5.4、gpt-5.4-mini、gpt-5.3-codex）、
`api.` 子域 3 模型（gpt-5.6 系）。**但 chat 匿名不可用**（/v1/chat/completions 404、
api 子域 403 Unauthorized、/openai/v1 405、/api/v1 401）——chat 需 key（**受限项**），
仅"模型清单可获得"层面与 NIM 并列。注册送 $100-300 额度（有邀请返利，非纯公益）。
模型清单价值：可作为 key 到手后的即时入池参照。

## 二、免费模型与限流（linux.do 帖 1349579 整理）

| 平台 | 免费模型 | 限流 | 价值评估 |
|------|---------|------|---------|
| **Cerebras** | glm-4.7（2026-01 起免费） | tpd 100 万 token / rpm 10 | ⭐ 速度快、量不小 |
| **Mistral** | 全系免费额度极大 | tpm 50 万 / 月 10 亿 token | ⭐ 量最大，chat 效果一般 |
| **Groq** | kimi-k2 / gpt-oss-120b / llama-4-maverick | rpm 10~60 / 日 10~50 万 token | 量小，token 不够用 |
| **ZenMux** | gemini-3-flash-preview-free / mimo-v2-flash / kat-coder-pro / glm-4.6v-flash | 未公布 | 新平台（25-08 运营）稳定性待观察 |
| **Poe** | 每天 3000 points（当日有效） | — | 不支持结构化输出，不推荐 API 用 |

## 三、扩池推荐序（与 FREE-API-CHANNELS 候选合并）

1. **NVIDIA NIM**（已验证 /models 匿名 200 + 82 模型，rpm 40）→ key 到手即入池（脚本就绪）
2. **hub.linux.do**（最正规公益站，但无匿名通道）→ linux.do 账号 Connect 登录领 key
3. **Cerebras**（glm-4.7 免费，日 100 万 token）→ cerebras.ai 注册
4. **Mistral**（额度最大）→ mistral.ai 注册
5. **ModelScope / 火山 / 七牛**（国内稳定）→ 各自注册

**结论**：免费 key 渠道第二张清单完成——全部受限（需用户注册），推荐序明确；
NIM 仍是最高性价比（唯一可匿名验证模型列表）。详见 DEPLOY-RUNBOOK.md 一键入池命令。
