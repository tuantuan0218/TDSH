# 池优化单一批准包（2026-09-14）— 一句话批准即可全部执行

> 把僵尸账号处置 + error_owner 误标修复 + error 账号处置合并为一份批准包。
> **批准方式**：回复"同意A"→ 我按本包全部执行；或逐项批准。
> 依据：`ZOMBIE-ACCOUNTS-PLAN.md`、`ERROR-OWNER-MISLABEL-PLAN.md`、`POOL-HEALTH-REPORT.md`、
> 并行会话 `FREE-LANE-HANDOVER.md`（关键坑：裸 SQL 不写 scheduler_outbox → 号永不接单）。

---

## ⚠️ 0. 执行前提（并行会话 FREE-LANE-HANDOVER 硬知识，违反则改动无效）

1. **裸 SQL 插 accounts 不会写 `scheduler_outbox`** → 新号/改动**永不进调度快照、永不接单**。
   补法：`INSERT INTO scheduler_outbox(event_type, account_id, group_id, payload)
   VALUES('account_changed', <id>, NULL, NULL);` —— **本包所有 SQL 改动必须附带 outbox 写入**，
   否则执行了等于没执行（白改）。
2. **选路顺序读 Redis zset（`sched:5:openai:single:v*`）的 score，不是 accounts.priority**——
   `priority` 字段只是入池初始值，改它不影响已在 zset 中的位次（`pool-health-check.mjs`
   是权威视图）。置 schedulable=false 会从 zset 摘除（这才是有效的）。
3. **判断"有没有用"只看 `usage_logs`**（按号统计的 picks），不是 status/文档快照。

## A. 僵尸账号处置（3 个，零风险可逆）

**问题**：#5 infer / #2 kimi2-hello4am / #8 amd-radeon active+schedulable 但无 base_url，
排在位次 25/26/32，挡 14 个可用账号（failover 救回，不降成功率但耗重试）。

**改动**（schedulable=false + **outbox 事件**，保留数据可逆）：
```sql
UPDATE accounts SET schedulable = false
WHERE id IN (2, 5, 8) AND deleted_at IS NULL;
-- ⚠️ 必须补 outbox 事件，否则改动不生效（见 §0）
INSERT INTO scheduler_outbox (event_type, account_id, group_id, payload)
SELECT 'account_changed', id, NULL, NULL FROM accounts WHERE id IN (2,5,8);
-- 核对
SELECT id, name, status, schedulable, priority FROM accounts WHERE id IN (2,5,8);
```

## B. error_owner 400 误标修复（调度口径）

**问题**：12h 400 共 321 条全被归 provider（93.1% 超上下文 + 2.5% 非法 tool_call 是客户端
问题），若按 error_owner 做账号降权会错误惩罚无辜上游（#3 agenes 295 条全因此被拖累）。

**改动**（错误记录语义识别后归 client）：
- ✅ **精确定位根因（2026-09-14 读网关源码 `ops_error_logger.go:2358
  classifyOpsErrorOwner`）**：归因完全按 **phase** 判定——
  `request/auth→client`、`upstream/network/account_auth→provider`、`routing/internal→platform`。
  **client 分类已存在且正确**（测试 `ops_error_logger_test.go` 断言 request→client 通过）。
  超上下文/坏 body 的 400 被误标 provider，是因为它们的 **phase 被归成了 upstream**
  （网关转发后上游返 400，phase 记为 upstream），而非缺 client 逻辑。
- **精确改动点**（二选一）：
  1. **推荐**：在归因前加一层"400 + message 含 `context`/`request body`/`tool_call` →
     强制 phase=request"，复用现有 `request→client` 通路（改动最小、语义正确）
  2. 或在 `classifyOpsErrorOwner` default 分支加 message 特征判 client
- 需改网关源码后重启才生效（属 src 改动，按纪律**先经你点头**，我不擅动运行中服务）

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

> ✅ **SQL 已实机验证（2026-09-14 BEGIN...ROLLBACK 零改动）**：A 僵尸 UPDATE 3 + outbox
> INSERT 0 3 通过；C 删除 #18（先删 group 再删 account，外键顺序正确）通过；
> `scheduler_outbox` 列结构确认（id/event_type/account_id/group_id/payload/created_at/**dedup_key**）。
> ⚠️ 待执行时关注 `dedup_key` 列——若有唯一约束，重复补事件可能需带 dedup_key 值（当前 NOT
> EXISTS 已避重，实跑时以实际报错为准微调）。

1. 僵尸 SQL（A）→ 核对 schedulable=false + 跑 `pool-health-check.mjs` 确认 zset 快照已摘除
2. #18 pollinations-free 删除（C 可选）→ 核对
3. error_owner 修复（B）→ 定位 Mac 网关源码赋值处，改后重跑 `node pool-health-check.mjs`
   核对 400 段不再全归 provider
4. 更新交接文档 + 备份

## 风险与回滚

- A：可逆（schedulable=true 即恢复）；零猜测
- B：改判断一处，无数据迁移，可回滚
- C：删除仅限 #18（已被 #21/#22 取代）；其余 4 个保留
