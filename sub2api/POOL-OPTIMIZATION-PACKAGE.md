# 池优化单一批准包（2026-09-14）— 一句话批准即可全部执行

> 把僵尸账号处置 + error_owner 误标修复 + error 账号处置合并为一份批准包。
> **批准方式**：回复"同意A"→ 我按本包全部执行；或逐项批准。
> 依据：`ZOMBIE-ACCOUNTS-PLAN.md`、`ERROR-OWNER-MISLABEL-PLAN.md`、`POOL-HEALTH-REPORT.md`。

---

## A. 僵尸账号处置（3 个，零风险可逆）

**问题**：#5 infer / #2 kimi2-hello4am / #8 amd-radeon active+schedulable 但无 base_url，
排在位次 25/26/32，挡 14 个可用账号（failover 救回，不降成功率但耗重试）。

**改动**（schedulable=false，保留数据可逆）：
```sql
UPDATE accounts SET schedulable = false
WHERE id IN (2, 5, 8) AND deleted_at IS NULL;
-- 核对
SELECT id, name, status, schedulable, priority FROM accounts WHERE id IN (2,5,8);
```

## B. error_owner 400 误标修复（调度口径）

**问题**：12h 400 共 321 条全被归 provider（93.1% 超上下文 + 2.5% 非法 tool_call 是客户端
问题），若按 error_owner 做账号降权会错误惩罚无辜上游（#3 agenes 295 条全因此被拖累）。

**改动**（错误记录语义识别后归 client）：
- 网关错误记录处（error_owner 赋值逻辑）增加 400 语义分流：
  - `max_input_tokens` 超上游上限 → client（超上下文）
  - `tools[].function.name` 为空 / message 缺字段 → client（非法构造）
  - 其余 400 保留 provider
- 需在 Mac 网关源码定位赋值处后改；**若不便改源码**，备选：账号降权/健康分计算排除 400
  （只按 5xx/429/超时计上游故障，改动面更小）

## C. error 账号处置建议（5 个，不删除保留归因）

| id | 账号 | 死因 | 建议 |
|---|---|---|---|
| 4 | geeky-hello4am | 403 余额不足 | 保留 error 状态，需上游充值/换 key |
| 6 | stepfun-jieyue | 402 超配额 | 保留，需上游续额 |
| 14 | xiaoen | 403 余额 $0.04 | 保留，需上游充值 |
| 17 | siliconflow-free | 402 余额不足 | 保留，等官方额度重置 |
| 18 | pollinations-free | 预算耗尽(已被21/22取代) | **建议直接删除**（#21/#22 已承接，留着占位无意义） |

**C 项可选改动**：
```sql
-- 仅当批准"删除 #18"时执行（其余保留归因）
DELETE FROM accounts WHERE id = 18 AND deleted_at IS NULL;
```

## 执行清单（批准后我按此跑）

1. 僵尸 SQL（A）→ 核对 schedulable=false
2. #18 pollinations-free 删除（C 可选）→ 核对
3. error_owner 修复（B）→ 定位 Mac 网关源码赋值处，改后重跑 `node pool-health-check.mjs`
   核对 400 段不再全归 provider
4. 更新交接文档 + 备份

## 风险与回滚

- A：可逆（schedulable=true 即恢复）；零猜测
- B：改判断一处，无数据迁移，可回滚
- C：删除仅限 #18（已被 #21/#22 取代）；其余 4 个保留
