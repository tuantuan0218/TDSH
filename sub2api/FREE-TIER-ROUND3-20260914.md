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
- **定性（最终修正）**：✅ 端点与 /models 匿名访问真实存在（铁证）；
  ❌ **匿名 chat 三出口全 429**（本机 IPv4 / Mac IPv6 / Clash 代理 42.200.166.227
  独立网段）——统一 `API rate limit exceeded` 强烈指向"匿名免费档的 chat 实际不可用，
  429 是请注册/领 key 的门禁"（/models 开放仅展示目录）。**暂不构成免 key 端点**
- **价值**：模型清单可公开核验（25 模型），但 chat 未过门 → **不入池**；
  9-13 "仅 2 个免 key 端点" 结论**维持**
- **想用 OVH**：注册 OVHcloud 账号领 key（免费档 2 RPM 极严，性价比低于 U8 NIM）；
  不优先

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

## 附：9-13 遗留待测项闭环（duck.ai / poli-text）

- **duck.ai**：`GET/POST /api/chat`、`/api/v1/chat/completions`、`/v1/chat/completions`、
  `/api/models` 全部返回同一 React SPA 壳（`data-version-tag: serp_20260913...`）——
  是 DuckDuckGo 网页应用，**非开放 API**（前端 XHR 路径不在静态资源），**不构成候选**
- **poli-text**：9-13 记录"匿名可列"，维持原结论（`text.pollinations.ai` 主端点当日复核 200）
- 两个遗留项至此全部闭环