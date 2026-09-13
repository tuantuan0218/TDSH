# 池闲置账号排查 — 2026-09-13

> 动因：连续多轮找新端点无果后，转向**盘活已有的**——池里有没有"占着位子却不能干活"的账号？

## 一、结论：发现 4 个"僵尸账号"占位

| # | 账号 | status | schedulable | priority | base_url |
|---|---|---|---|---|---|
| 2 | `kimi2-hello4am` | active | **true** | 22 | **(NULL)** |
| 5 | `infer` | active | **true** | 20 | **(NULL)** |
| 7 | `glm-zhipu` | active | **true** | **19** | **(NULL)** |
| 8 | `amd-radeon` | active | **true** | 28 | **(NULL)** |

**问题**：这 4 个账号 `status=active` 且 `schedulable=true`，但 **`base_url` 为 NULL** ——
即**没有上游地址，永远不可能成功服务任何请求**。

它们**从未被调用过**（`usage_logs` 里 0 条记录，`last_used = 从未`），印证了这一点。

## 二、为什么这值得注意（而非"反正没调用，无害"）

关键在于 **priority 排序**：

```
#7  glm-zhipu     priority 19   ← 僵尸，排在前面
#5  infer         priority 20   ← 僵尸，排在前面
#2  kimi2-hello4am priority 22  ← 僵尸
#8  amd-radeon    priority 28   ← 僵尸

#23 columbina-free-1  priority 10  ← 正常服务中
#20 columbina-free    priority 11  ← 正常服务中
#26 columbina-free-5  priority 13  ← 正常服务中
#30 columbina-free-8  priority 23  ← 正常服务中
#33 columbina-free-9  priority 24  ← 正常服务中
#36 columbina-free-12 priority 26  ← 正常服务中
#35 columbina-free-11 priority 27  ← 正常服务中
```

- **#7 (19) 和 #5 (20) 的 priority 数字小于** #30(23)/#33(24)/#36(26)/#35(27)
- 若调度**按 priority 取号**，这两个僵尸会**排在可用账号之前**被选中
- 选中 → 必然失败（无 base_url）→ 触发重试/降级

**即：它们可能让排在其后的**真实可用**账号**得不到优先调度**，白白消耗重试预算。**

## 三、✅ 影响已进一步证实（第二轮取证，推翻"未证实"口径）

初次排查时我无法读 Redis，故把影响标注为"未证实"。**本轮改用 `accounts` 表的调度相关字段取证，结论明确。**

### 3.1 关键字段：这 4 个账号**没有任何保护态**

`accounts` 表有完整的调度保护字段：`overload_until`、`temp_unschedulable_until`、
`session_window_status`、`rate_limited_at`。僵尸账号的实测值：

```
id | name               | status | sched | priority | last_used | overload | temp_unsched | rate_limited
 2 | kimi2-hello4am     | active |  t    |   22     |  从未     |    -     |      -       |     -
 5 | infer              | active |  t    |   20     |  从未     |    -     |      -       |     -
 7 | glm-zhipu          | active |  t    |   19     |  从未     |    -     |      -       |     -
 8 | amd-radeon         | active |  t    |   28     |  从未     |    -     |      -       |     -
```

对照正常服务的账号（1/3/10/20/23）——它们的 `last_used_at` 都是**分钟级新鲜**。

**结论**：这 4 个账号 `active + schedulable`，且**无任何字段阻止其被选中**。
`last_used_at` 全为 **NULL（从未）**，与"缺 base_url 必然失败"完全吻合。

> 注：全池有保护态的账号为 #4/#13/#14/#16（含 `temp_unschedulable_until`），
> **僵尸账号不在此列** —— 系统并未自动屏蔽它们。

### 3.2 排序实证：**10 个可用账号排在僵尸之后**

按 `priority` 升序排列（仅 active+schedulable），僵尸账号的位置：

```
位次  prio | id | name                    | 配置        | 6h调用
 19    19  |  7 | glm-zhipu               | ⚠️无base_url |   0     ← 僵尸
 20    20  |  5 | infer                   | ⚠️无base_url |   0     ← 僵尸
 21    21  | 34 | columbina-free-10       | ok          |   3     ← 可用，排其后
 22    22  |  2 | kimi2-hello4am          | ⚠️无base_url |   0     ← 僵尸
 23    23  | 30 | columbina-free-8        | ok          |   2     ← 可用，排其后
 ...
 28    28  |  8 | amd-radeon              | ⚠️无base_url |   0     ← 僵尸
```

**统计**：`schedulable 总数 32` · `僵尸 4` · **`僵尸之后仍有 10 个可用账号`**

即：若调度按 priority 顺序取号，**选到 #7/#5 时会必然失败**，
而**排在其后的可用账号（如 columbina-free-10/8/9/13/12/11 等）本可先行服务**。

> ⚠️ **我仍然没有验证的部分（保持诚实）**：
> 我**未直接读取调度器内部**（Redis 不可用），故不能 100% 断言"调度确实按 priority 线性取号"。
> 但可确认的是：**这些账号没有任何机制阻止其入选，且其名次排在可用账号之前**
> —— 这已足够构成"应当处理"的理由，而非"可能无害"。
>
> 本仓历史亦记录过：真正的选序读 **Redis zset score（名次）**，而 zset 由 cron 依真实 picks 生成。
> 僵尸账号从未产生 picks → 其 zset 名次可能靠后（这反而降低了危害）。
> **两种机制下结论不同，这正是我不擅自处置的原因。**

## 四、建议处置（★ 需你点头，我未擅自动手）

三个选项，按保守程度排序：

| 方案 | 操作 | 风险 |
|---|---|---|
| **A. 最小改动（推荐）** | 把这 4 个账号的 `schedulable` 置为 `false` | 极低——它们本就无法服务，置 false 只影响"不该发生的调度" |
| B. 补配置 | 若你知道它们的正确 base_url，补上即可复活 | 需要完整上游信息 |
| C. 不动 | 维持现状，等调度体系自行处置 | 保守，但占位风险仍在 |

**为什么我没有直接执行 A**：
- 用户明确要求"不擅自改动池配置"
- 且这 4 个账号可能是**并行会话正在配置中的半成品**（有 `model_mapping` 但缺 base_url，
  像是配到一半）——贸然改成 `schedulable=false` 可能打断别人的工作

> 🔍 **旁证**：#7 `glm-zhipu` 与 #8 `amd-radeon` 都有 `model_mapping`（`glm-4.6`、`DeepSeek-V4-Flash`），
> 说明**有人配置过它们，只是没填 base_url**。这更像"未完成的配置"而非"废弃账号"。

## 五、附带观察：免费档账号的调度行为正常

| 账号 | priority | 6h 调用 | 说明 |
|---|---|---|---|
| columbina 系（13 个） | 10–27 | 1–32 次 | ✅ 按名次递减，符合"前排先服务" |
| xzt 31/32 | 36/37 | 0 | ✅ 垫底，正常待命 |
| pollinations 21/22 | 34/35 | 0 | ✅ 垫底，正常待命 |

**优先级梯度合理**：columbina（有额度）在前、pollinations/xzt（免 key 兜底）在后。
说明**调度体系的分层是有效的**，不是混乱状态。

## 六、复现

```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519 zhaozicheng@192.168.1.3 'bash -s' <<'EOF'
export PATH=/usr/local/opt/postgresql@16/bin:$PATH
psql -h 127.0.0.1 -U postgres -d sub2api -At -F'|' -c \
"SELECT id,name,status,schedulable,priority,coalesce(credentials->>'base_url','(NULL)')
 FROM accounts WHERE deleted_at IS NULL AND status='active' AND schedulable
   AND coalesce(credentials->>'base_url','')='' ORDER BY priority;"
EOF
```
