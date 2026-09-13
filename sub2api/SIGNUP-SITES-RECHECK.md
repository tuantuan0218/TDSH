# 注册站可达性复核（对并行会话「放弃」判定的独立核查）— 2026-09-13

> 背景：并行会话战报把 Groq / Cerebras 列为「放弃」，把 NVIDIA / OpenRouter 等列为受限项。
> 本文独立复核，**区分"站点真死"与"反爬挡脚本"**——后者会让人误弃可用通道。

## 一、核心区分方法（本轮的判据）

**网页 403 ≠ 站点故障。** 必须分开看三层：

| 层 | 判据 | 含义 |
|---|---|---|
| 网页（HTML） | 403 + 完整浏览器头仍 403 | Cloudflare 反爬挡**脚本**，浏览器可正常访问 |
| API 端点 | 200 = 免 key 可列；401 = 只需 key | **API 活着** |
| 真实可用 | 带 key 能出词 | 最终判据 |

## 二、复核结果

| 站点 | 网页实测 | API 端点实测 | 我的判定 |
|---|---|---|---|
| **Groq** | `403`（带完整浏览器头仍 403） | `api.groq.com` → **403** | ⚠️ **CF 反爬挡脚本**，非站点死亡 |
| **Cerebras** | `403`（同上） | `api.cerebras.ai` → **403** | ⚠️ 同上 |
| **NVIDIA NIM** | `200` | `integrate.api.nvidia.com` → **200**（列 82 模型） | ✅ 站点活，只差 key |
| **OpenRouter** | `200` | `openrouter.ai/api/v1/models` → **200**（列模型） | ✅ 站点活，只差 key |
| AgentRouter | `200` | — | 可达（注册受限非网络问题） |
| GoRouter | `200` | — | 可达 |
| NexoToken | `200` | — | 可达 |
| llm7 | `200` | — | 可达 |
| ModelScope | `200` | — | 可达 |

## 三、温和纠正并行会话的两处「放弃」

战报原文：
- Groq：「返回 JSON `{"error":{"message":"Forbidden"}}`」→ **放弃**
- Cerebras：「Cloudflare 硬拦截页（Attention Required）」→ **放弃**

**这两处判定的问题在于**：它们描述的是**自动化脚本被反爬挡住**，
而**不等于"该通道不可用"**。这两家都是可正常注册领取免费额度的知名厂商。

**但我也要诚实标注我的边界**：
- ✅ 我**实测确认**的是：curl（含完整浏览器头）访问其网页与 API 均得 403
- ❓ 我**未能独立验证**的是："真实浏览器能否正常注册" —— 我无法驱动真实浏览器，
  也不应擅自使用你的登录态
- 因此我的结论是**"无法据 403 判定为放弃"**，而非断言"一定能注册"

> 📌 **建议**：Groq 与 Cerebras 应保留在**候选清单**（而非"放弃"），
> 若你愿意用浏览器试一次，可能各拿一份免费额度。
> 它们的 API 免费档在业内有口碑（Groq 以极快推理著称，Cerebras 免费额度大）。

## 四、与既有结论的一致性

本会话此前已独立得出**同一模式**（见 `NO-KEY-ENDPOINTS-VERIFIED.md` 第十二节）：
> "Groq / Cerebras 为 **403（Cloudflare 挡 bot）** → 403 是**反爬不是站点故障**，
> 浏览器可正常打开，勿误判为死站。"

本轮复核**复现了该结论**（不同时间、不同方法，结果一致）。

## 五、复核后的受限项清单（修正版）

| 编号 | 事项 | 状态 | 备注 |
|---|---|---|---|
| **U8** | NVIDIA NIM | ✅ **通道确认可用**，仅差人工过 hCaptcha | ⭐ 40 RPM / 82 模型 / 无限制额度 |
| U9 | OpenRouter | ✅ 通道确认可用，需主流邮箱 | 22 零价模型，配置已就绪 |
| U10 | AgentRouter | ✅ 站点可达，需 OAuth 登录态 | — |
| U11 | GoRouter | ✅ 站点可达，需过 Turnstile | — |
| **新增 U12** | **Groq** | ⚠️ **建议从"放弃"恢复为候选** | CF 挡脚本，浏览器可试 |
| **新增 U13** | **Cerebras** | ⚠️ **建议从"放弃"恢复为候选** | 同上 |

## 六、复现

```bash
# 网页层（403 = 反爬，非死亡）
curl -s -o /dev/null -w "%{http_code}\n" https://console.groq.com/keys
curl -s -o /dev/null -w "%{http_code}\n" https://cloud.cerebras.ai/

# API 层（活着的证据）
curl -s -o /dev/null -w "%{http_code}\n" https://integrate.api.nvidia.com/v1/models  # 200
curl -s -o /dev/null -w "%{http_code}\n" https://openrouter.ai/api/v1/models        # 200
```
