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

## 三、⚠️ 我未能验证的部分（如实说明）

我尝试读取调度桶（Redis zset）来确认这 4 个账号**是否真的在活跃调度序列中**，但：

- `redis-cli` 在该主机上不可用（或端口/认证不同），`--scan` 返回空
- **故我无法直接证明**它们确实在 zset 里、确实造成排队阻塞

**间接证据（支持"可能有害"）**：
1. 它们 `schedulable=true`（调度器**应当**纳入）
2. 其 priority 数值确实排在部分可用账号之前
3. 本仓历史记录明确写过：**"直插 DB 建账号会绕过 `scheduler_outbox`"** →
   调度快照是否收录取决于 outbox 事件，而非单纯 DB 字段

**结论口径**：**"存在占位风险，实际影响未证实"** —— 我不把推测当成事实。

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
