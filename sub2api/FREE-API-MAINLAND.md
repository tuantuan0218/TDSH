# 免费 API 权威清单（大陆直连 + OpenAI 兼容）

> 数据源：yangmao.ai 结构化数据集（全库 168 家，schema 2026-05-07，生成于 2026-06-24T23:24:29.534Z）
> 筛选口径：`has_free_api && china_direct && openai_compatible`，剔除纯本地自托管项
> 漏斗：全库 168 家 → 有免费 API 82 家 → 大陆直连 39 家 → **本表 18 家**
> 本文件由 `build-free-api-mainland.mjs` 脚本生成，勿手改；解析结果已用 node 实测校验。

| 厂商 | 免费额度 | 速率限制 | 代表模型 | 入口 |
|---|---|---|---|---|
| 零一万物 | ¥10 | 5 RPM | Yi-Lightning | https://www.lingyiwanwu.com |
| 百川智能 | 500万 tokens | 5 RPM | Baichuan 4 | https://www.baichuan-ai.com |
| 智谱清言 (智谱AI) | 500万 tokens | 5 RPM | GLM-4 | https://chatglm.cn |
| ClawBrain | 30 free conversations/day | 未公开 | Agent 优化大模型 API | https://www.clawbrain.dev/ |
| Cloudflare Workers AI | 每天 10000 神经元（永久有效） | 10000 requests/day | @cf/meta/llama-3.1-8b-instruct, @cf/meta/llama-3.3-70b-instruct-fp8-fast, @cf/google/gemma-7b-it-lora | https://ai.cloudflare.com |
| DeepSeek | $5 | 2 RPM | DeepSeek-V4-Pro, DeepSeek-V4-Flash, DeepSeek-V3 | https://platform.deepseek.com |
| DGX Cloud Lepton (原 Lepton AI) | $10 free credits | 10 RPM | Llama 3.3 70B, Mixtral 8x7B | https://build.nvidia.com/explore/discover |
| 豆包 (字节跳动) | 50万 tokens | 5 RPM | Seed 2.0 Pro, Seed 2.0 Code, Seed 2.0 Mini | https://www.doubao.com |
| 讯飞星火 | 200万 tokens | 5 RPM | Spark 4.0 Ultra | https://xinghuo.xfyun.cn |
| Jina AI | 1M free tokens for new users. | Token-quota based; verify model-specific limits in the Jina dashboard. | jina-embeddings-v3, jina-reranker-v2-base-multilingual | https://jina.ai/ |
| Kimi (月之暗面) | ¥15 + 充 $5 送 $5 | 3 RPM | Kimi-K2.5, Kimi-K2 | https://kimi.moonshot.cn |
| MiniMax (稀宇科技) | ¥15 | Varies | MiniMax-M2.7, MiniMax-01 | https://www.minimaxi.com |
| NVIDIA Build (NIM API) | 无限制（已取消额度限制） | 40 RPM（可申请提升到 200 RPM） | MiniMax M2.7, Kimi K2.5, GLM-5.1 | https://build.nvidia.com/ |
| 通义千问 (阿里) | 7000 万 tokens（新用户一次性；DashScope/Bailian 控制台为准） | 按模型和账号层级不同（RPM/TPM/并发以控制台为准） | Qwen3.6-Plus, Qwen3.6-27B, Qwen-Max | https://tongyi.aliyun.com |
| 商汤日日新 SenseNova | 公测免费额度 | 待官方控制台确认 | DeepSeek-V4-Flash | https://platform.sensenova.cn/?utm_source=yangmao.ai&utm_medium=referral&utm_campaign=sensenova_token_plan&utm_content=provider_profile |
| 硅基流动 (SiliconFlow) | ¥14 | Varies by model/account (RPM, TPM, context, and queue limits) | DeepSeek-V3 (hosted), Qwen2.5-72B (hosted) | https://siliconflow.cn |
| 阶跃星辰 | ¥10 | 5 RPM | Step-2 | https://www.stepfun.com |
| 腾讯混元 | 100万 tokens | 5 RPM | Hunyuan-Large | https://hunyuan.tencent.com |

## 为什么优先用这一类

- **全部是「自己注册拿 key」**：无中间人、无公益站跑路风险、额度规则可追溯。
- 对比论坛公益站（注册送额度型）：后者寿命以天/周计，本表以月/年计。
- 额度与限速仍会随平台政策变动，**以官方控制台为准**；本表是入口索引，不是额度承诺。

## 复现

```bash
curl -sL https://yangmao.ai/data/exports/ai-free-tiers.json -o ai-free-tiers.json
node build-free-api-mainland.mjs ai-free-tiers.json FREE-API-MAINLAND.md
```

原始 JSON 备份：`_freeapi_probe/ai-free-tiers.json`（含 `last_verified`、`proof_url` 等核验字段）。
