# 池健康巡检报告说明 — 2026-09-13

> 配套脚本：`pool-health-check.mjs`（**只读**，仅执行 SELECT）
> 一键体检：`node pool-health-check.mjs [--hours 24] [--account xzt]`

## 一、为什么有这个脚本

本会话为验证「xzt 端点的 10 次/分钟限流会不会打爆池」，我**手工连写了 5 个临时 SQL 脚本**才查清结论
（依次试错才发现：`usage_logs` 没有 `status` 列 → 才找到 `accounts.rate_limited_at` → 才发现 `ops_error_logs` 富错误表）。
这套"用池运维数据验证假说"的方法价值高但每次都要重来，故固化成脚本。

**安全边界**：全程只读，脚本内置 `assertReadOnly()` 守卫，若未来有人误加写操作会直接拒绝执行。
已验证运行前后池状态完全一致（33 总数 / 28 active / 5 error）。

## 二、巡检发现的真实问题：5 个 error 账号死因

`node pool-health-check.mjs` 自动给出的**死因核查**结果：

| # | 账号 | 死因（权威字段 `error_message`） | 性质 |
|---|---|---|---|
| 4 | geeky-hello4am | `403 Insufficient account balance`（`consecutive_403=3/3`） | 💰 **余额不足** |
| 6 | stepfun-jieyue | `402 You exceeded your current quota` | 💰 **配额耗尽** |
| 14 | xiaoen | `403 token quota is not enough`（剩 $0.043250） | 💰 **配额不足** |
| 17 | siliconflow-free | `402 account balance is insufficient` + 429 限流 | 💰 **余额不足** |
| 18 | pollinations-free | `pollinations free budget exhausted (785 requests today)` | 📊 **当日预算耗尽** |

### 关键判断：**这 5 个都不是 bug，是额度耗尽**

- 死因全部指向**账户侧额度/余额**，而非代码缺陷、网络故障或配置错误
- **修复方式 = 换新 key / 充值 / 等次日重置**，不是"修程序"
- 其中 #18 `pollinations-free` 是**每日重置**型（785 请求/天），次日会自动恢复

### 附带发现：#18 暴露了一个真实设计问题

`pollinations-free` 的错误信息写明：

> `returns 200+budget-error-text`

即**预算耗尽时端点仍返回 HTTP 200，只是正文是错误文本**。
这类"200 里藏错误"的响应，纯看状态码的探针会**误判为可用**。
本机 `free-quota-monitor.mjs` 已有 `BAD_OUT` 正则专门识别这类文本
（`budget|quota|exhausted|...`），故监控侧能兜住——但**说明"只看 HTTP 200"是不够的**。

## 三、⚠️ 另一项巡检发现：全池 400 错误量很大（值得你关注）

12h 上游错误分布中，**除 5xx 外，还有大量 HTTP 400**：

```
agenes        HTTP 400 × 400     ← 数量最大
yunshu-relay  HTTP 400 ×  83
yunshu-tdsh   HTTP 400 ×  39
tele-muse     HTTP 400 ×  37
baiqwen       HTTP 400 ×  13
aio-freeshare HTTP 400 ×   8
```

**400 = 客户端请求错误**（非上游故障）。这**不是账号问题，而是上游拒绝我们的请求格式**。
可能原因：模型名不匹配、参数不被支持、请求体格式差异等。

> **此点本轮仅发现、未深挖**（超出当前目标范围）。若你想让我继续查清"400 到底在说什么"，
> 可以查 `ops_error_logs.error_message` / `error_body` 拿到具体原因。

## 四、正常状态 vs 异常状态的判读规则（写入报告末尾，防误读）

| 现象 | 含义 |
|---|---|
| `rate_limited_at` 非空 | 该账号曾撞上游限流；池会**自动临时停用**，属**可自愈** |
| `reqs=0` 且 `status=active` | 兜底位**正常待命**（前排健康时不会接单）—— **不是故障** |
| `status=error` 且 24h 有错误 | **真故障**，需人工介入 |
| `status=error` 但 24h 无错误 | 多为额度耗尽后的**静止状态**，非持续报错 |

⚠️ 特别提醒：**xzt（31/32）、columbina、pollinations-text/fast 等 `reqs=0` 是设计使然**，
不要误判为"这些账号坏了"——它们的 priority 排在 31/32/33，前排（prio 1–19）健康时轮不到它们。

## 五、复现

```bash
node pool-health-check.mjs                    # 全量（12h 窗口）
node pool-health-check.mjs --hours 24         # 24h 窗口
node pool-health-check.mjs --account xzt      # 只看 xzt 相关账号
# 输出同时落盘 → POOL-HEALTH-REPORT.md
```
