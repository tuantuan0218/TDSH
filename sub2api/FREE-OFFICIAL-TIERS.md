# 官方免费档追踪（yangmao 数据集 + OpenRouter 实时目录）
> 生成 2026-09-14T04:12:17.217Z · yangmao generated_at=2026-06-24T23:24:29.534Z · schema 2026-05-07
> 双源口径：**yangmao**=厂商入口索引（含额度/限速描述，但可能滞后）；**OpenRouter**=当下是否真免费的实时价格判据（源：openrouter-live）。
> 漏斗：全库 168 → 有免费API 82 → 大陆直连 39 → 大陆+OpenAI兼容 **24**
> 追踪口径：有免费 API 且非本地自托管（共 76 家）。**不含任何 key 明文**。

## 与上轮 diff
⏳ **源数据陈旧**：源数据已 81 天未更新（generated_at=2026-06-24T23:24:29.534Z）→ 厂商额度结论可能已过期，需去官方控制台复核
🟢 **新鲜源在线**：OpenRouter 实时目录抓到 22 个零价模型（可随时复核，不受 yangmao 陈旧拖累）
🔍 **交叉判读**：yangmao 描述陈旧（81 天）但 OpenRouter 价格字段是实时的 → 前者当"厂商入口索引"用，后者当"当下是否真免费"的权威判据

## OpenRouter 实时零价模型（22 个）
> 判据：`pricing.prompt == 0 && pricing.completion == 0`（实时可复核，非二手描述）

| 模型 ID | 上下文 | 模态 |
|---|---|---|
| cohere/north-mini-code:free | 256000 | text->text |
| dots-studio/dots-3-note-preview:free | 512000 | text+image->text |
| google/gemma-4-26b-a4b-it:free | 262144 | text+image+video->text |
| google/gemma-4-31b-it:free | 262144 | text+image+video->text |
| google/lyria-3-clip-preview | 1048576 | text+image->text+audio |
| google/lyria-3-pro-preview | 1048576 | text+image->text+audio |
| inclusionai/ling-3.0-flash-fin:free | 262144 | text->text |
| inclusionai/ling-3.0-flash-sante:free | 262144 | text->text |
| inclusionai/ling-3.0-flash-vl:free | 262144 | text+image+video->text |
| liquid/lfm-2.5-2.6b:free | 65536 | text->text |
| nex-agi/nex-n2.5-mini:free | 262144 | text+image->text |
| nex-agi/nex-n2.5-pro:free | 262144 | text+image->text |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | 256000 | text+image+audio+video->text |
| nvidia/nemotron-3-super-120b-a12b:free | 262144 | text->text |
| nvidia/nemotron-3-ultra-550b-a55b:free | 1000000 | text->text |
| nvidia/nemotron-3.5-content-safety:free | 128000 | text+image->text |
| nvidia/nemotron-3.5-lightning:free | 1000000 | text->text |
| openrouter/free | 200000 | text+image->text |
| poolside/laguna-s-2.1:free | 262144 | text->text |
| poolside/laguna-xs-2.1:free | 262144 | text->text |
| thinkingmachines/inkling-small:free | 1048576 | text+image+audio->text |
| thinkingmachines/inkling:free | 1048576 | text+image+audio->text |

## 大陆直连免费档（33 家）
| 厂商 | 免费额度 | 限速 | 模型 | 入口 | 核验 |
|---|---|---|---|---|---|
| Civitai | $0 | 未公开 | AI 模型社区与图片生成 | https://civitai.com | 2026-06-24 |
| ClawBrain | 30 free conversations/day | 未公开 | Agent 优化大模型 API | https://www.clawbrain.dev/ | 2026-06-24 |
| Cloudflare Workers AI | 每天 10000 神经元（永久有效） | 10000 requests/day | @cf/baai/bge-base-en-v1.5, @cf/google/gemma-7b-it-lora, @cf/meta/llama-3.1-8b-instruct | https://ai.cloudflare.com | 2026-06-24 |
| DGX Cloud Lepton (原 Lepton AI) | $10 free credits | 10 RPM | Llama 3.3 70B, Mixtral 8x7B | https://build.nvidia.com/explore/discover | 2026-06-24 |
| DeepSeek | $5 | 2 RPM | DeepSeek-R1, DeepSeek-V3, DeepSeek-V4-Flash | https://platform.deepseek.com | 2026-06-24 |
| FireRed-OpenStoryline | Unlimited self-hosted | Local/self-hosted | OpenStoryline Video Editing Agent | https://github.com/FireRedTeam/FireRed-OpenStoryline | 2026-06-24 |
| Google AI (Gemini) | 免费 API 无需信用卡 | 15 RPM (Flash) | Gemini 3.1 Flash, Gemini 3.1 Flash Lite, Gemini 3.1 Pro | https://aistudio.google.com | 2026-06-24 |
| Hugging Face | Free tier | Varies | Various Open Models | https://huggingface.co | 2026-06-24 |
| Jina AI | 1M free tokens for new users. | Token-quota based; verify model-specific limits in the Jina dashboard. | jina-embeddings-v3, jina-reranker-v2-base-multilingual | https://jina.ai/ | 2026-06-24 |
| Kimi (月之暗面) | ¥15 + 充 $5 送 $5 | 3 RPM | Kimi-K2, Kimi-K2.5 | https://kimi.moonshot.cn | 2026-06-24 |
| Krea AI | $0 | 未公开 | AI creative suite | https://www.krea.ai/ | 2026-06-24 |
| MiniMax (稀宇科技) | ¥15 | Varies | MiniMax-01, MiniMax-M2.7 | https://www.minimaxi.com | 2026-06-24 |
| NVIDIA Build (NIM API) | 无限制（已取消额度限制） | 40 RPM（可申请提升到 200 RPM） | DeepSeek R1, DeepSeek V3.2, GLM-5.1 | https://build.nvidia.com/ | 2026-06-24 |
| PixVerse AI | $0 | 未公开 | AI 视频生成平台 | https://pixverse.ai/ | 2026-06-24 |
| Pollo AI | $0 | 未公开 | AI image & video creation platform | https://pollo.ai/ | 2026-06-24 |
| Recraft AI | $0 | 未公开 | AI design platform | https://www.recraft.ai/ | 2026-06-24 |
| Vidu | $1 | N/A | Vidu Q3 | https://www.vidu.com | 2026-06-24 |
| dots.mocr | Public Gradio endpoint | 未公开 | dots.mocr | https://dotsocr.xiaohongshu.com/ | 2026-06-24 |
| 上海电信 Token 算力套餐 | 1 元约 25 万额度点（低价套餐，待实测） | 待确认：并发、RPM/TPM、有效期、是否仅上海电信用户 | 多模型 API 套餐 | https://www.chinatelecom.com.cn/ | 2026-06-24 |
| 商汤日日新 SenseNova | 公测免费额度 | 待官方控制台确认 | DeepSeek-V4-Flash | https://platform.sensenova.cn/?utm_source=yangmao.ai&utm_medium=referral&utm_campaign=sensenova_token_plan&utm_content=provider_profile | 2026-06-24 |
| 天工 AI (昆仑万维) | Free tier | Varies | 天工大模型 | https://www.tiangong.cn | 2026-06-24 |
| 扣子 (字节跳动) | Free tier | Varies | 多模型可选 | https://www.coze.cn | 2026-06-24 |
| 文心一言 (百度) | Free tier | 5 RPM | ERNIE 4.5 | https://yiyan.baidu.com | 2026-06-24 |
| 智谱清言 (智谱AI) | 500万 tokens | 5 RPM | GLM-4 | https://chatglm.cn | 2026-06-24 |
| 百川智能 | 500万 tokens | 5 RPM | Baichuan 4 | https://www.baichuan-ai.com | 2026-06-24 |
| 硅基流动 (SiliconFlow) | ¥14 | Varies by model/account (RPM, TPM, context, and queue limits) | DeepSeek-V3 (hosted), Qwen2.5-72B (hosted) | https://siliconflow.cn | 2026-06-24 |
| 秘塔AI搜索 | $0 | 未公开 | AI 搜索引擎 | https://metaso.cn/ | 2026-06-24 |
| 腾讯混元 | 100万 tokens | 5 RPM | Hunyuan-Large | https://hunyuan.tencent.com | 2026-06-24 |
| 讯飞星火 | 200万 tokens | 5 RPM | Spark 4.0 Ultra | https://xinghuo.xfyun.cn | 2026-06-24 |
| 豆包 (字节跳动) | 50万 tokens | 5 RPM | Seed 2.0 Code, Seed 2.0 Lite, Seed 2.0 Mini | https://www.doubao.com | 2026-06-24 |
| 通义千问 (阿里) | 7000 万 tokens（新用户一次性；DashScope/Bailian 控制台为准） | 按模型和账号层级不同（RPM/TPM/并发以控制台为准） | Qwen-Max, Qwen-VL, Qwen3.6-27B | https://tongyi.aliyun.com | 2026-06-24 |
| 阶跃星辰 | ¥10 | 5 RPM | Step-2 | https://www.stepfun.com | 2026-06-24 |
| 零一万物 | ¥10 | 5 RPM | Yi-Lightning | https://www.lingyiwanwu.com | 2026-06-24 |

