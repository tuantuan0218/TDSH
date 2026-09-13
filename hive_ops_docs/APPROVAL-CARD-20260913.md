# 运维会修复 · 一次批准操作卡（2026-09-13）

> 用途：把今天诊断出的三批待批改动压缩成**照着敲就行**的序列。每步都写了"预期输出"，敲完当场核对（写后复读纪律，AGENTS §8 rule 12-bis）。
> 详情与证据：`OPS-STANDUP-NOT-FIRING-20260913.md`（同目录）、`FLEET-INSTRUMENT-DEAD-20260913.md`。

---

## 决策 A —— 免重启，30 秒（建议立刻做）

在应用里打开 **Schedules 面板**，编辑 **Hourly ops standup** 这一条，把「正文」整段替换为：

```
每小时运维站会（每班必须留痕，无异常也要回执）。只核三件事：
①席位——谁停滞：以 hive/log.jsonl 里该席位最后一次外发时间戳 + fleet.json 的 inboxBacklog/onHold/breaker 三列为准；
  ⚠️ 不要信 tokens/lastTool/lastActiveSecAgo——这三个字段恒为 0/null（见报告 §11），拿它们判"没事"是自欺。
②任务——tasks.json 里 blocked / 无人认领 / 长期不动的行；
③看板——board.md 头部与磁盘实际是否一致。
回执只写一行：「站会 HH:MM 无异常」或「站会 HH:MM 异常×N：要点」。
收件人写 hive-ops（真实席位、可第三方核对）；不要写 god 自己（等于无痕），也不要写 scheduler。
禁止：为站会 compact 终端上下文（压缩归 Context trigger）；复述各席位任务。
```

然后**点保存**。

| 校验 | 预期 |
|---|---|
| 面板上该条的正文 | 已是新文本（面板回显=磁盘值） |
| `node D:\tdsh\炉石传说\_hive_probe.cjs --since <下一班+2min> --seats` | `席位 hive-ops 未读 ≥1`（回执进新台账） |

⚠️ **别只改 `config.json`**：运行中的 mission 是武装时的内存快照，磁盘改了不重武装不生效；
而面板保存会用它自己那份快照整体写回（`index.ts` 只对 `lastFiredAt` 做 max 合并）→ 磁盘侧新值会被覆盖。

（可选，同样免重启）若你打算上决策 B 的补丁 #3，顺手把 **Floor heartbeat** 的正文换成不含状态断言的版本：

```
请按本简报处置：有可执行邮件就先 drain 收件箱并逐条落地；无异常时保持安静，不必为心跳回执。
只有在发现停滞席位、无人认领或长期不动的任务、过期看板行时才开口（一行即可），收件人写 hive-ops。
不要为心跳 compact 终端上下文，也不要在长回合里被本简报打断——空闲时再读。
```

---

## 决策 B —— 三批补丁一起上（需要一个重启窗口，约 3 分钟）

**前提**：等 god 一轮落地之后再做。dev 模式下改 `src/main` 会让 electron 自动重启并**杀掉全部 worker PTY**。

```powershell
cd D:\MunderDifflin
# 0) 现场基线（万一要回滚，这里就是回滚点）
git rev-parse HEAD ; git status --porcelain | Measure-Object -Line

# 1) 先复核三批补丁仍能干净落下（只校验，不落盘）
git apply --check hive\docs\ops-standup-wake.patch        ; "1a=$LASTEXITCODE"   # 预期 0
git apply --check hive\docs\heartbeat-body-honored.patch   ; "1b=$LASTEXITCODE"   # 预期 0
git apply --check hive\docs\fleet-telemetry-pi.patch       ; "1c=$LASTEXITCODE"   # 预期 0

# 2) 依序应用（#1 与 #3 互不重叠；#2 的 hunk 与 #1 同文件不同位置，顺序无依赖）
git apply hive\docs\ops-standup-wake.patch
git apply hive\docs\heartbeat-body-honored.patch
git apply hive\docs\fleet-telemetry-pi.patch

# 3) 写后复读：三处关键新符号必须在盘上
Select-String -Path src\main\index.ts -Pattern 'markWakeBeat' | Measure-Object -Line   # 预期 ≥2
Select-String -Path src\main\transcript.ts -Pattern 'piProjectKey' | Measure-Object -Line # 预期 ≥3
Select-String -Path src\main\telemetry.ts -Pattern 'resolveAgentHome' | Measure-Object -Line # 预期 ≥3
git diff --stat                                                                        # 预期 4 文件、约 +260 行
```

**重启应用**（由你在界面上做，或 `npm run dev` 自动热重启）。

### 重启后的验收（两条门，都要跑）

```powershell
node D:\tdsh\炉石传说\_verify_telemetry_live.cjs   # 预期 PASS，且 fleet 至少一席 tokens>0、lastActiveSecAgo 为数字
node D:\tdsh\炉石传说\_standup_watch.cjs 240        # 预期 exit=0（缺回执 0/N 班）
```

- `fleet.json`：`tokens` 不再是 0、`lastActiveSecAgo` 是数字。
  **`lastTool` 允许仍为 null**（本批刻意不修，见 FLEET 笔记 §3bis.0），**`cost-ledger.jsonl` 允许仍不存在**（刻意不碰 #56 去重闸门）。
- 下一班整点（:26）后 30 分钟内出现「站会 HH:MM …」回执，且 `god活动=Y`。
  补丁 #1 的效果只有在 god 处于**长回合**时才看得出差别——今天的 11:26 / 14:26 / 15:26 三班都是被长回合吞掉的。

### 回滚（任一环节不对就退，命令一条）

```powershell
cd D:\MunderDifflin
git checkout -- src\main\index.ts src\main\transcript.ts src\main\telemetry.ts src\main\hive.ts src\main\config.ts
```

回滚后再重启一次即可；期间运维会仍由 **DSH 自愈轨**兜着（逾 25 分钟无回执自动补投一次，台账
`D:\tdsh\炉石传说\_heal_log.json`），不会回到"漏班无人管"的状态。

---

## 顺序与禁令

1. **在 `_verify_telemetry_live.cjs` 通过之前，不要打开 `circuitBreaker.enabled`**。
   断路器的 tokenVelocity / 成本两路输入今天都是空的，开了就是拿空仪表做裁决——
   09-10 那次"8 个不同调用读成同形循环、批量 constrain 健康席位"就是这么来的。
2. 不要给 `D:\MunderDifflin\hive` 配 git remote 并 push：它把 **195 个会话转录（129.7 MiB）** 纳入了版本控制
   （`.gitignore` 的 `agents/*/.pi-agent/sessions/` 管不了已跟踪文件，`archived-*/…` 更是没覆盖）。
   要备份文档就用现成的镜像：`D:\tdsh\hive_ops_docs\`（已在 TDSH 私有仓，无转录）。
3. `hive/agents/{scheduler,heartbeat,hive-ops}` 是本次新建的**只 inbox 无 outbox**席位（router 见无 outbox 即 skip）。
   不想要就整目录删掉，路由立刻退回原行为，无需重启。

---

## 今天已经量到的东西（供你判断值不值得重启）

| 指标 | 数值 |
|---|---|
| 站会发出 | 每小时 :26 准点，今日 12 班全中，漂移 <1s |
| 回执延迟 | 40s / 48s / 338s / 1594s / 2416s / 6016s（后三个都是长回合吞的） |
| 对照实验 | 同内容：`scheduler` 28min 零回执 vs 真实发件人 **85s 闭环** |
| 回执黑洞 | 全量历史 drop 136 条 → 修复后 **0 新增**，13:26 那班真实回执已落 `scheduler` 台账 |
| 仪表 | fleet 七席 `tokens=0/lastActiveSecAgo=null`，而盘上同一时刻 god 单场真实用量 **401,568** tokens；按目录求和会虚高 **16.7×–296.5×** |
| 补丁自证 | 三批全部：`apply --check`=0、`--reverse --check`=1（阳性对照）、`tsc` 新增错误 0、44 例单测逐项 IDENTICAL、真实盘上回放 PASS=12/FAIL=0 |
