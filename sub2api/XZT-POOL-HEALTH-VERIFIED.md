# xzt 池内健康度实测 — 2026-09-13

> 承接 `XZT-RATELIMIT-AND-MODELS.md` 提出的风险：xzt 端点有 **10 次/分钟/IP 硬限流**，
> 而池内账号 `concurrency=1` 不等于速率受控。**本轮用池的真实运维数据证伪/证实该风险。**

## 一、结论（先给答案）

**风险在原理上成立，但在当前池配置下没有发生。**

xzt 两个账号（31 `xzt-ai-proxy-free`、32 `xzt-free`）在**近 12 小时内零调用、零错误、零限流记录**。

## 二、证据链（池真实数据，SSH→Mac PG 只读）

### ① 账号级限流字段：全部为空

`accounts` 表有权威限流字段 `rate_limited_at` / `rate_limit_reset_at` / `error_message`：

```
31|xzt-ai-proxy-free|active|schedulable=t|rate_limited_at=(null)|reset_at=(null)|err=(null)
32|xzt-free|active|schedulable=t|rate_limited_at=(null)|reset_at=(null)|err=(null)
```

### ② 错误日志表：xzt 零记录

`ops_error_logs` 是富错误表（含 `status_code`/`upstream_status_code`/`retry_after_seconds`）。
近 12h 内按 `account_id` 查 xzt：**无任何行**。

### ③ 调用量：零

`usage_logs`（只记成功调用，无 status 列）近 12h：

```
31|xzt-ai-proxy-free|0 次
32|xzt-free         |0 次
```

### ④ 生态对照：其它账号**确实**在撞限流（证明检测链路有效）

```
全池 12h 上游错误分布（局部）：
  yunshu-relay   502 ×281
  yunshu-tdsh    502 ×165
  tokenrouter    503 ×27、429 ×19     ← 真实 429 案例
  tele-qwen      503 ×9
  yunshu-tdsh    429 ×3
```

**这条对照很关键**：如果 xzt 真在撞限流，`ops_error_logs` 会记录下来（其它账号的 429 就被记下了）。
**xzt 无记录 = 它没在承受压⼒**，而不是"监控看不见"。

### ⑤ 账号状态对照

| 账号 | status | rate_limited_at |
|---|---|---|
| 31 xzt-ai-proxy-free | active | (null) |
| 32 xzt-free | active | (null) |
| 17 siliconflow-free | **error** | 2026-09-13 05:30:29 |
| 9 aio-freeshare | active | 2026-09-13 19:57:24 |

## 三、为什么没发生？（机制解释）

当前全池 12h 调用量 TOP：

```
yunshu-relay 2952 | yunshu-tdsh 2361 | baiqwen 1818 | bai1-glm 1719
tele-muse 1189 | agenes 1140 | tele-qwen 201 | hub-linuxdo 200
```

xzt 的 priority 是 **31/32**，而实际接单的是 priority 1–19 的账号。
**兜底位的设计语义就是"前排打满/失败时才接管"** —— 前排健康，xzt 自然零流量。
故 10 次/分钟限流**不会被触及**。

## 四、遗留风险与建议（不擅自改池）

1. **只在极端情况暴露**：若前排大面积失败，xzt 被大量调用 → 立即撞 429。
   届时池的 `rate_limited_at` 机制会记录并（按既有设计）临时停用该账号，**属可自愈**。
2. **不建议提升 xzt 优先级** —— 它承受不了并发，兜底位是正确归属。
3. **若未来要压测**：必须先确认该端点限流窗口是否为滚动制（本轮观察到"连打 12 次，第 11 次起 429"，
   符合滚动窗口特征，但**未做跨分钟验证**，故此点标记为**未完全证实**）。

## 五、方法论

**判定"某个资源是否健康"不应只看它对不对（单点探测），而应看它在真实负载下的记录（运维数据）。**
本轮把"我担心它会撞限流"这一**推测**，用池的 `accounts` + `ops_error_logs` + `usage_logs` 三张表**实证**为
"当前没有发生，且若发生会被记录"。这比反复手工 curl 更有说服力。

## 六、复现

```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519 zhaozicheng@192.168.1.3 'bash -s' <<'EOF'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -At -F'|' -c \
"SELECT id,name,status,rate_limited_at,rate_limit_reset_at FROM accounts WHERE name ILIKE '%xzt%';"
EOF
```
