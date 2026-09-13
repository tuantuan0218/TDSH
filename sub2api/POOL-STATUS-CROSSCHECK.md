# 池运行状态核查（承接并行会话战报）— 2026-09-13

> 背景：并行会话产出 `ROUND-2026-09-14-KEYHUNT.md`（免费 key 注册战报）。
> 本文对其结论做**独立核查**，纠正偏差、补齐证据，避免误判导致错误处置。

## 一、核查结论速览

| 战报结论 | 我的独立核查 | 判定 |
|---|---|---|
| xzt 硬限流 10 次/分钟/IP | ✅ 一致（我独立实测：连打 12 次，第 11 次起 429） | **互证** |
| xzt 可用 9+ 模型 | ✅ 一致（我实测 9 个可用，含 DeepSeek-V3.2 等） | **互证** |
| 池 33 账号 / 31 xzt 双号 | ✅ 一致（实测 33 总数 / 28 active / 5 error） | **互证** |
| **columbina「站方 xai 后端挂了」** | ⚠️ **需修正**：见下节 | **偏悲观** |
| 17 siliconflow-free 402 余额耗尽 | ✅ 一致（我上轮亦确认） | **互证** |
| 注册类全被反自动化拦截 | ✅ 与我的观察一致（我未做注册，故不作为独立证据） | 采信 |

## 二、⚠️ 需修正的结论：columbina **是「降级」，不是「挂了」**

战报称 columbina 系（20/23-30）"**全部 503 / 429 用尽 → 站方 xai 后端挂了**"。

**实测数据不支持这个强结论**（近 3 小时）：

```
账号                近3h 成功请求数
columbina-free-1    30   ← 仍在正常服务
columbina-free-6     7
columbina-free      5
columbina-free-3     5
columbina-free-4     5
columbina-free-5     5
columbina-free-7     2
columbina-free-8     1
columbina-free-9     0
```

即 **9 个号里有 8 个在近 3 小时内都有成功请求**（合计 60 次），并非全灭。

**同期错误同样是间歇性的**：

| 错误 | 次数 | 含义 |
|---|---|---|
| `Too many pending requests, please retry later` | 5 | **排队拥塞**（上游繁忙，非故障） |
| `408 xai stream error: stream disconnected` | 6 | 流式中断（**可重试**型） |
| `503 Upstream service temporarily unavailable` | 2 | 上游临时不可用 |

**修正后的判断**：
- columbina/xai 上游处于 **拥塞/降级**状态（表现为 408 流断 + pending 拥塞），
  **不是"后端挂了"**——它仍在持续返回成功响应。
- `408`（超时）与 `Too many pending` 属**可重试**类，池的重试机制应能吸收。
- **不该手动关调度**（战报也说"error_rate 自动避让即可，勿手动关调度"——这点是对的）。

### 决定性证据（第二次深挖，按小时看趋势）

```
近 6h columbina 成功请求按小时分布：
  01:00 →  6 次（3 个账号在服务）
  03:00 → 40 次（7 个账号在服务）
  04:00 → 20 次（8 个账号在服务）   ← 服务面在扩大

最近成功时刻：2026-09-14 04:24:xx —— 6 个账号在同一分钟内成功
（我的查询时间紧随其后，证明是"正在服务"，不是历史残留）

近 3h 成功 : 错误 = 60 : 13  → 成功率约 82%
```

**趋势向上、服务账号数增加、分钟级新鲜** —— 三条独立证据共同否定"站方 xai 后端挂了"。

> 📌 **为什么这个区分重要**：把"降级"误判成"挂了"可能导致**误撤可用产能**。
> columbina 系手上握着 $1000+ 签到额度，误撤会浪费真实资产。
> 正确处置是：**保持调度不动**，靠 error_rate 自动避让；若真要干预，也应等趋势转为持续零成功再议。

## 三、补充核查：全池健康（我的巡检脚本）

`node pool-health-check.mjs` 输出（33 账号）：

- **28 active+schedulable / 5 error**
- 5 个 error 账号死因**全部是额度耗尽**（非 bug）：
  - #4 geeky-hello4am 403 余额不足
  - #6 stepfun-jieyue 402 配额耗尽
  - #14 xiaoen 403 token 配额不足（剩 $0.043）
  - #17 siliconflow-free 402 余额不足 + 429
  - #18 pollinations-free 当日预算耗尽（785 请求，**次日自愈**）
- 全池 12h 成功率 **95.32%**（11849 成功 / 582 个 400）
- 582 个 400 **全部来自单一脚本 key**（`Python-urllib`），根因是**超上下文/非法 tool_call**，
  属客户端问题而非池故障（详见 `POOL-400-ROOTCAUSE.md`）

## 四、两会话产物的关系（避免重复劳动）

| 主题 | 本会话产物 | 并行会话产物 | 关系 |
|---|---|---|---|
| xzt 模型实测 | `XZT-RATELIMIT-AND-MODELS.md` | `xzt-models-result.json` | **结论一致，互为独立复核** |
| 免 key 端点 | `NO-KEY-ENDPOINTS-VERIFIED.md` | 战报第 66 行 | 一致（2 个：pollinations + xzt） |
| 池健康 | `pool-health-check.mjs` + 报告 | 战报第 6-11 行 | 本会话工具**更完整**（含 400 归因、死因核查） |
| 注册实战 | 未做（我未注册） | 战报（CDP 自动化 5 家走通/多类拦截） | **互补**，注册面是它的增量 |

## 五、受限项（需用户动作）— 沿用并补充

| 编号 | 事项 | 说明 |
|---|---|---|
| U8 | NVIDIA NIM 人工过 hCaptcha | 战报称表单已填好，`liunxddo\add-nvidia-nim-pool.mjs` 已存在（我核实**文件确实存在**，4934 bytes）。**NIM 40 RPM 无限制额度，性价比最高** |
| U9 | 主流邮箱注册 OpenRouter | 需 qq/163 等；我另备好 `openrouter-free-config.json`（22 零价模型就绪配置） |
| U10 | AgentRouter OAuth | 需用户登录态 |
| U11 | GoRouter Turnstile | 需人工过验证 |

**两会话在这些受限项上结论一致：剩余增量都卡在需要人工过验证/用真实邮箱。**
