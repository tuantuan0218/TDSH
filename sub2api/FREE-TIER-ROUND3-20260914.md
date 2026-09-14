# 免费层第三轮盘点 FREE-TIER-ROUND3 — 2026-09-14

> 目的：寻找 9-13 两轮（50+ 候选）之外的**新免 key 端点/新 free 档**。
> 结果：**1 个重要新发现（OVHcloud AI Endpoints 免 key 候选）**，结论已附验证边界。

---

## ★ 核心发现：OVHcloud AI Endpoints（第三个免 key 候选）

- **端点（OpenAI 兼容）**：`https://oai.endpoints.kepler.ai.cloud.ovh.net/v1`
- **匿名 /v1/models**：**200，25 模型**（当日实测）
  - `Qwen3.5-397B-A17B` / `Qwen3-32B` / `Qwen3.6-27B` 等，含定价元数据
  - 免费匿名档官方文档确认存在："no API key, no signup"（itsfree.ai / OVH docs）
- **匿名 chat**：官方限流 `2 req/min per IP per model`；
  **双出口实测均 429**（本机 IPv4 + Mac IPv6 2409:8a3c 前缀同网段）：
  - 429 带 request_id（服务侧接受后限流，非 401 拒绝），且 /models 双出口均 200
  - ⚠️ 但两出口同网段，无法排除"该网段匿名配额已打满"或"匿名 chat 实际需更长冷却/真实 key"
- **定性（修正版）**：✅ 端点与 /models 匿名访问真实存在（双出口铁证 + 官方文档）；
  ⚠️ **匿名 chat 未能复现 200**（双出口 429）——不能据此断定可用，也不能断定不可用
- **价值**：/models 匿名可列仍是有用信息（模型清单验证），但 **chat 未过门 → 暂不能入池**；
  9-13 "仅 2 个免 key 端点" 结论**暂不推翻**（待 chat 200 复现）
- **验证计划**：换**独立网段**出口（手机热点/机场节点）单发一次 chat；
  若 200 → 入池（prio 90 / concurrency 1 / group 5，2 RPM 仅兜底）并更新
  `NO-KEY-ENDPOINTS-VERIFIED.md`（2 → 3）

## 其余候选（均为已知/需 key，无新增免 key）

| 候选 | 结论 |
|---|---|
| Groq | 已有结论：免费 key 需注册，rpm 10-60；无变化 |
| Google AI Studio | 需 Google 登录 + AIza key；无变化 |
| ChatAnywhere/GPT_API_free | 10000 点/日刷新，需 token；已知候选，非免 key |
| FreeLLM-API-KeyHub（GitHub 汇总） | 国内平台汇总（百炼/智谱等），均为云账号+实名系；已知 |
| OVHcloud 免费试用 $200 | 需 Public Cloud 项目/信用卡；非本项目可用 |

## 结论与下一步

1. **唯一实质增量 = OVHcloud 免 key 候选**，验证卡在"匿名 2 RPM/IP"极严限流
2. 下一步：换出口 IP 复测 chat 200 → 通过则入池（concurrency 1，兜底位），
   并更新 `NO-KEY-ENDPOINTS-VERIFIED.md`（2 → 3 个免 key 端点）
3. 其余渠道维持既有结论（U8 NIM / U9 OpenRouter / ModelScope），无新免费档出现

## 状态账

- 本次为匿名只读探测：无 key、无账号、无池改动
- 待办：IP 冷却后复测 OVH chat（受限项=换出口需你或我换通道）