# 僵尸账号处置方案 — 2026-09-14（待用户批准）

> 来源：`node pool-health-check.mjs` 巡检（2026-09-14），完整报告 `POOL-HEALTH-REPORT.md`。
> **本方案不执行**——处置会改动池配置，按纪律等你点头。

## 问题

3 个账号 `active + schedulable=true` 但 **无 base_url**（没有上游地址，永远无法服务）：

| id | name | priority | concurrency | 历史调用 | model_mapping |
|---|---|---|---|---|---|
| 5 | infer | 23 | 3 | 0 | (none) |
| 2 | kimi2-hello4am | 24 | 3 | 0 | (none) |
| 8 | amd-radeon | 28 | 3 | 0 | {"DeepSeek-V4-Flash": "DeepSeek-V4-Flash"}（半成品） |

**影响**：排在调度位次 23/24/28，**其后 16 个可用账号被挡**（37,36,35,21,22,31,32,38…）。
选中后必然失败 → 消耗 failover 重试（当前靠 failover 救回，成功率未降，但白耗重试与 TTFT）。

## 处置选项（二选一，或组合）

### 选项 A：置 schedulable=false（推荐，零风险）

把 3 个僵尸移出调度序列，后 16 个账号立即前置。

```sql
UPDATE accounts SET schedulable = false
WHERE id IN (2, 5, 8) AND deleted_at IS NULL;
-- 核对：
SELECT id, name, status, schedulable, priority
FROM accounts WHERE id IN (2,5,8);
```

- 保留账号数据（归因用），只移除调度
- 若日后补全 base_url，一条 UPDATE 即可复活

### 选项 B：补全 base_url（需先查明上游归属）

- #8 amd-radeon 的 model_mapping 指向 DeepSeek-V4-Flash——疑似"配置到一半"，
  上游归属不明（`ZOMBIE-UPSTREAM-TRACING.md` 只查明了 #7 智谱无余额）
- #5/#2 完全无 mapping，无从推断
- **不推荐**：归属不明时补 base_url 是猜，容易把错误上游接进池（先例：#7 补了也 429）

## 推荐

**选 A**（schedulable=false 三行），理由：
1. 零猜测、零风险、可逆
2. 立竿见影：16 个可用账号前置，减少无效重试
3. 僵尸保留在表里，后续查清归属可再决定补 base_url 还是删除

## 执行方式

批准后走 Mac PG（`ssh zhaozicheng@192.168.1.3` + psql，参照 mac-*.sh 模板），
或走网关 admin API（若有 key）。执行后跑 `node pool-health-check.mjs` 核对僵尸段消失。

> ⚠️ 裸 SQL 不写 scheduler_outbox（历史坑）——若走 SQL 改动需确认是否要补事件进调度快照；
> 优先用官方 admin API（若你能给 admin key）。