# SiliconFlow 免费模型入池 — 2026-09-13 轮次摘要（脱敏版，可公开）

**任务**：把 SiliconFlow 免费模型（Qwen2.5-7B-Instruct / DeepSeek-V3 / Qwen3.5-4B）作为新上游
加入 sub2api Tuan 池并验证路由。DSH 配置零改动。

## 结果

- **入池**：账号 17 `siliconflow-free`（openai/apikey，base `https://api.siliconflow.cn/v1`，
  Tuan→`deepseek-ai/DeepSeek-V3`，identity 映射 Qwen2.5-7B-Instruct / Qwen3.5-4B；
  extra：`openai_responses_mode=force_chat_completions` + `openai_responses_supported=false`
  + billing 关；绑 group 5；priority 90 兜底位；concurrency 1）
- **路由验证**（usage_logs 铁证，账号 17 共 13 条）：05:23-05:29 期间 `Tuan→DeepSeek-V3`
  真实路由 13/13 成功，DSH（deepseek-harness）与 pi（蜂群）双端流量自动接入；
  隔离验证法：临时下线其余活跃账号→网关只剩 17 号→请求 200→恢复（脚本幂等）

## 关键结论（沉淀）

1. SiliconFlow 免费档有 TPM/QPM 硬限，DeepSeek-V3 间歇 429，failover 已兜底；
   并发 3 会自撞限流 → 降到 1；prio 90 兜底位避免主流量压到免费档。
2. SiliconFlow `/v1/responses` 404 → 账号必须配 `force_chat_completions` +
   `openai_responses_supported=false`，否则 DSH 走 responses 必 400（bai1 同类坑）。
3. Qwen3.5-4B 是思考模型：content 全在 `reasoning_content`，标准客户端收空；
   `enable_thinking:false` 可解。Tuan 别名绝不指向它，identity 映射保留。
4. 网关 ScheduledTestRunner 会自动恢复死号（本轮 2/4/5/6/7/8/14 复活为 active），
   属网关自身运维；死号再次 403/429 由调度器 error_rate 自动避让。

## 产物（本地，含完整 key 勿外传）

- `TUAN-POOL-HANDOVER.md`（权威交接文档，含完整 key，仅本地）
- `add-siliconflow-pool.mjs` / `mac-add-siliconflow.sh`（入池脚本，含 key，仅本地）
- `verify-siliconflow.mjs` / `probe-siliconflow.mjs` / `probe-qwen35-empty.mjs`（验证脚本，含 key，仅本地）
- `mac-sf-*.sh`（隔离/恢复/取证，无敏感，可公开）
- `tuan-pool-snapshot.public.json`（脱敏快照，可公开；完整版 tuan-pool-snapshot.json 仅本地）