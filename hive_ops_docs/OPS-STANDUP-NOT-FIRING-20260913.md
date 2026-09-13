# 每小时运维会（ops-standup）"不触发" 定案报告

- 日期：2026-09-13 11:52–11:58（本地，UTC+8）· 撰写：DSH 会话（external-planner 席位）
- 权威配置：`D:\MunderDifflin\.userdata\config.json`（进程带 `--user-data-dir`；`%APPDATA%\munder-difflin\config.json` 是旧位置死数据）
- 权威日志：`D:\MunderDifflin\hive\log.jsonl`（4534 条 message / 187 条 ops-standup 请求）

## 0. 结论（一句话公式）

**定时器没坏：每小时 :26 准点发、6/6 命中、投递到 god。**
坏的是响应与闭环这三条同时成立的合取：

> 「运维会发生了」= 定时器发（✓） ∧ 收件人被唤醒去读（✗ 长回合 + 系统邮件不计入唤醒） ∧ 产出可见回执（✗ 正文自相矛盾 + 回执目标无收件箱）

即：**有发无应，应而无痕**。用户看到的"不触发"是后两项，不是第一项。

## 1. 证据链

### 1.1 定时器层：正常（可证伪口径 = 时间戳节律）

`hive/log.jsonl` 中 `from:"scheduler"` 且 `subject:"Hourly ops standup"` 的 09-13 当天记录：

| 发出（本地） | delivered | 20 分钟内的 god 站会回执 |
|---|---|---|
| 06:26:43 | god + 6 worker | ✓ 06:38「异常×1 已自愈销账」 |
| 07:26:44 | **仅 god** | ✓ 07:35（nudge 类，非正式回执） |
| 08:26:45 | 仅 god | **✗ NONE** |
| 09:26:46 | 仅 god | ✓ 09:27:33「站会回执：无异常」 |
| 10:26:48 | 仅 god | ✓ 10:32:26「站会回执：无异常」 |
| 11:26:53 | 仅 god | **✗ NONE** |

间隔严格 3600s（仅闰秒级漂移 <1s）→ `syncMissions()`（index.ts:784-789）与 `setInterval(fire, intervalMs)` 工作正常，`enabled:true`、`intervalMs:3600000` 无异常。

### 1.2 唤醒层：站会邮件在两条唤醒轨道上都是"低等邮件"

- `index.ts:1173` `SYSTEM_SENDERS = {heartbeat, scheduler, breaker, system}`；
  `godActionableInboxCount()`（1180-1186）把 scheduler 信**排除**在"可执行邮件"之外。
  于是心跳的 `if (isFloorQuiet(quiet) || actionable > 0) reengageGod(...)`（1349）
  **永远不会因为一封待回站会而主动把 god 拉起来**；实测 11:32 那拍摘要写的是「2 actionable」，
  两条都是 external-planner 的真邮件，站会不计数。
- 剩下的唯一轨道是渲染层 4s 轮询的 inbox-wake nudge（`useHive.ts` effect #3，690-730），
  它以 `precondition:'inbox-nonempty'` **排队**、只在 agent 空闲时落地。
  god 实测正处在一个 **30 分钟的长回合**里：会话
  `god/.pi-agent/sessions/--D--MunderDifflin--/2026-09-13T03-26-40-605Z_01a098cd….jsonl`
  起于 11:26:40、末行 11:56:29。站会 11:26:53 落地时他已在回合中 → 投递被 busy-aware 推迟。
- 回合结束后的自述（11:56:29 末行原文）：
  > Inbox drained (0 pending). Done this turn: **52c5c9 (planner request, human direct order)** → acted … **Heartbeats** (35ee51, 99ff35, 1ea4f2 + the earlier pair): routine drains … **No reply sent**（standup rule is "no anomaly → end"）

  → 站会被**整箱批量搬进 `.done`**，本体既没被单独处理、也没回执。

### 1.2b 更正与收窄：挡住站会的其实是**两道独立的闸**，13:26 那次是第二道

本节上一版把主因写成"`SYSTEM_SENDERS` 不算 actionable"，**不完整**。13:26 那班的实测（13:49 取证）：

```
god 最后一次外发 : 13:23:28（t-152 GO）
god 当前会话     : 起于 13:26:35Z 本地，末条记录 13:49:05（1 分钟前，assistant）→ 他正在一个 23 分钟的长回合里
god 未读收件箱   : 7 封 = 站会 13:26:53 + 真发件人 request 13:40:44（另一 DSH 会话的 rotator 复发通报） + 心跳 5 封
fleet.god        : backlog=7 onHold=false breaker=healthy
```

站会在他**新回合开始后 18 秒**落地。此时**无论发件人是谁都读不到**：渲染层 nudge 带
`precondition:'inbox-nonempty'` 且只在**空闲**时落笔（`useHive.ts` effect #3），busy-aware 是刻意设计
（"if he's busy that would jam mid-step"）。所以：

| 闸 | 作用对象 | 11:26 案例 | 13:26 案例 |
|---|---|---|---|
| A 发件人分类（`SYSTEM_SENDERS`） | 决定**心跳会不会主动去拉他** | 命中：站会不算 actionable，心跳不为它加速 | 也命中，但不是主因 |
| B 回合忙（busy-aware） | 决定**任何邮件能不能被读** | 命中（30 分钟长回合） | **主因**：23 分钟长回合，且真发件人的信同样压着没读 |

推论（重要，别把补丁说大）：**补丁 #1 单独并不能解决 13:26 这一类**——它让心跳持续把站会当 actionable
去 re-engage，但 re-engage 也只是往收件箱再写一封，仍然要等他空闲。真正让 12:26 成功的是"他恰好空闲 + 惯例"。
所以三件事要分开看：①空闲时刻必须必然回（惯例/§6.1 正文改写）②忙时不投毒（现状已正确，别改）
③逾期必须可被发现（这才是 `_standup_watch.cjs`/`_wait_beat.cjs` 的职责，也是唯一不需要重启就能补上的能力）。


- 正文自相矛盾：「只在真的有异常时才回信」+「没有异常就只回一句『无异常』」。
  god 取前者 = 静默 → **现场零可见痕迹**（11:26 那班就是这样消失的）。
- 回执目标 `scheduler` 没有收件箱 → 路由 `drop / reason:no-inbox`。
  当天实证 1 条：`2026-09-13 06:38:11 drop no-inbox from=god to=scheduler`；历史累计 182 条 drop。
### 1.3 回执层：就算回，也留不下账

- `requires_reply` 默认为 true（`hive.ts:1543`：act ∈ request/query/propose）→
  站会单永远挂着没人销账。
- **补充实测（13:03，看门狗加了"回执去向"列之后）**：连"有回执"的班次也要分真假痕迹——
  10:26 那班 `→god`（god 回给自己，按他的 09:0x 惯例），**不落在任何第三方台账里**；
  只有 11:26/12:26 两班 `→external-planner` 才是可被独立核对的回执行。
  所以"回执发给谁"和"有没有回执"是两个独立缺陷，正文那句"回执一律发给 god"本身就是
  让运维会重新变成无痕操作——指令里必须写死真实席位。


### 1.4 退化点：06:55 之后"运维会"不再是会

`config.json.bak-autostop-20260913065518` 与当前 config 逐项 diff，只有 3 处变化：

| 键 | 06:55 备份 | 当前 |
|---|---|---|
| `missions[ops-standup].to` | `broadcast` | **`god`** |
| `autoMode` | true | false |
| `orchestratorMaySpawn` | true | false |

→ 06:26 那班 delivered 是 7 席（god+6 worker），07:26 起只剩 `["god"]`。
**运维会从"全员点名"退化为"单席自检"**，而该单席恰好是最容易在长回合里错过节拍的那个。

## 2. 修复分级

### A. 免重启、零风险（已做 / 用户点一下即可）

1. **已做（本会话）**：以真实发件人席位 external-planner 向 god 投 `request`，
   要求①立即补开 11:26 那班、②无异常也无条件回执一行到 external-planner。
   真发件人 ⇒ 计入 `godActionableInboxCount` ⇒ 走通唤醒轨道，同时给站会补上"可核对的账"。
   脚本：`D:\tdsh\炉石传说\_send_hive_msg_standup.cjs`（Node 写、UTF-8 无 BOM，中文安全）。
2. **需用户在 Schedules 面板点一下（免重启，当场重建定时器）**，二选一或都做：
   - `to`: `god` → `broadcast`（恢复全员点名）；
   - 正文去歧义（把"只在真的有异常时才回信"删掉，改为**无条件回执一行**）。
   - ⚠️ 顺序要紧：**在面板里改**，不要只改磁盘。运行中的 mission 是武装时的内存快照，
     磁盘改了不重武装不生效；而面板保存会把它自己那份（打开时加载的）missions 整体写回，
     可能把磁盘侧新值覆盖掉（`index.ts:4000-4014` 只对 `lastFiredAt` 做 max 合并，其余字段以面板为准）。

### B. 需改 src + 重启（受限项，等用户批窗口，本会话不动运行中进程）

1. `SYSTEM_SENDERS` 判定过宽：站会这类**要求动作的 request** 不该被当成自家噪音。
   最小改法 = 排除条件由 `!SYSTEM_SENDERS.has(m.from)` 收紧为
   `!(SYSTEM_SENDERS.has(m.from) && !m.requires_reply)`，使"待回执的站会"计入 actionable。
2. 站会闭环：scheduler 侧记 pending-ack，若下一拍（心跳）发现上一班站会未被回执，重投一次并升级；
   或在 `fire()` 里对 `requires_reply` 的 mission 落一条"待回执"台账。
3. 给 `scheduler` / `heartbeat` 建 synthetic 收件箱（或让路由把系统席的回执直接落 log 而不 `drop`），
   消灭 182 条 `no-inbox` 黑洞。
4. 长回合下的投递：为 `act:'request'` 且带截止语义的邮件加"到期未读即升级"，避免整箱被批量 `.done`。

### C. 不做（已排除的假因）

- ❌ "定时器没武装/没启用" —— `enabled:true`、每小时准点、面板 `lastFiredAt` 同步。
- ❌ "模型池故障导致 god 无法唤醒" —— 同窗口 god 正常出 20+ 工具调用并完成 t-151 派单。
- ❌ "断路器在拦" —— `circuitBreaker.enabled:false`（既有止血项），fleet 全员 `breaker:healthy`。
- ❌ "compact 坏导致站会死循环" —— 本次问题相反，站会现在明令**不**为站会 compact。

## 3.5 历史"漏班"定性：是停机窗，不是定时器（再证一次）

看门狗在 187 班全量历史里只挑出 2 次 gap > 1.35×间隔：`09-07 22:45:42 → 00:20:39（95min）`、
`09-09 02:20:49 → 04:15:23（115min）`。对照 `kind:"app-start"` 序列（最近 12 次含 09-13 05:46/06:19/06:26/06:56/08:10/08:54）：
gap 全部落在 **app 未运行的窗口**里——那段时间根本没有任何定时器，谈不上"触发失败"。
且 `onSystemResume`（index.ts:5257）+ `remaining=max(0, intervalMs-(now-lastFiredAt))`（784）
保证醒来/重启后**逾期那班立即补发一次**（不重放 N 次）。
实测佐证：08:54:27 重启时 lastFired=08:26:45 → 推算下一班 09:26:0x，实际 09:26:46 ✓ 锚点零漂移。

## 3.6 常态核查工具（本会话新建，已做阳性对照）

`D:\tdsh\炉石传说\_standup_watch.cjs [lookbackMin]` —— 一次跑完三环并给退出码
（0=齐 / 3=缺回执需补投 / 4=缺发出 / 5=读不到日志）：

```
近 240 分钟发出 4 班（应见每小时 1 班，下一班 12:26:55）
 - 08:26:45 | delivered=["god"] | god活动=n | 回执=NONE
 - 09:26:46 | delivered=["god"] | god活动=Y | 回执=Y 站会回执（09:2x local）：无异常
 - 10:26:48 | delivered=["god"] | god活动=Y | 回执=Y 站会回执（10:2x local）：无异常
 - 11:26:53 | delivered=["god"] | god活动=n | 回执=NONE
24h 内 to=scheduler 的回执被 drop: 3 条
判定: 缺回执 2/4 班 | 历史漏班 2 次       exit=3
```

口径自证：它与本会话前面对 `log.jsonl` 的手工逐班核对结果**完全一致**（09:26/10:26 判有回执、
08:26/11:26 判空班），即"0 命中"结论通过了阳性对照，不是检索串失效造成的假绿。
另：`to=scheduler` 的 drop 24h 内仍有 3 条 → 正文里"别回 scheduler"那条 god 并未稳定遵守，
真正根治要靠 §5 之外的闭环（回执目标存在 + 未回执重投）。



## 3.7 手工复核口径（无脚本时照抄）

```powershell
# 1) 定时器是否在发（应见 :26 节律，间隔 3600s）
node -e "const L=require('fs').readFileSync('D:/MunderDifflin/hive/log.jsonl','utf8').split('\n').filter(Boolean).map(x=>{try{return JSON.parse(x)}catch(e){}}).filter(Boolean);
const r=L.filter(o=>o.from==='scheduler'&&/Hourly ops standup/.test(o.subject||''));
for(const o of r.slice(-8))console.log(new Date(o.ts).toLocaleString('zh-CN',{hour12:false}),JSON.stringify(o.delivered))"
# 2) 有没有回执（NONE 即为空班）
#    在 1) 的时刻后 20min 窗口内 grep god 发出的含「站会|standup」的 message
# 3) 回执是否被丢
grep 'no-inbox' 里 to=scheduler 的条数
# 4) god 当时是否在长回合
#    god/.pi-agent/sessions/--D--MunderDifflin--/<最新>.jsonl 首行与末行时间跨度
```

## 4. 决定性对照实验（12:04–12:06，本会话做完）

同一个人（god）、同一个收件箱、同一个心跳节拍，只换**发件人身份**：

| 投递 | from | 是否计入 `godActionableInboxCount` | 结果 |
|---|---|---|---|
| 11:26:53 那班站会 | `scheduler` | **否**（∈ SYSTEM_SENDERS） | 28 分钟无人应，随整箱被搬进 `.done`，零回执 |
| 12:04:37 补开的站会 | `external-planner` | **是** | 12:05:32 心跳 re-engage → **12:06:02 god 回执「站会 11:26 无异常（补开回执）」，85 秒闭环** |

→ 唤醒链、模型池、god 在线状态全部正常；**唯一变量是发件人是否被当成"自家噪音"**。
成因由推断升级为实证。副作用为零：本次补投顺带把"每班必须留一条回执行"写进了 god 的惯例。

**god 侧回执原文（12:06:02，落在我席位 inbox，`0c4260`）**——惯例当场收编：

> 站会 11:26 无异常。补开核查：fleet 六席全 healthy（breaker 健康/无人 hold）；0 blocked 任务；
> 看板无过期行…惯例收编：**今后每班 ops-standup 本席留一条可核对回执，收件人写 external-planner。**

12:14:31（`ac54ab`）再次确认："站会无条件回执惯例已 adopted"。
→ 也就是说 **A 级缓解不需要重启、不需要面板**，只靠一封"真发件人"的 request 就把站会从"静默可跳过"
改成了"god 自觉留痕"。但它的强度只有"自觉"——下一次自动节拍（12:26）能否自动产出回执，
才是这套惯例的真检验。

### 4.1 自动节拍终检（12:26，三环首次全闭）

```
2026/9/13 12:26:53 message scheduler->god request | Hourly ops standup   delivered=["god"]
2026/9/13 12:27:34 message god->external-planner inform | 站会 12:26 无异常
config: ops-standup lastFiredAt=12:26:54  to=god  enabled=true
```

**发出 ✓ / 回执 ✓（41 秒）/ 回执目标改成真实席位 → 本轮零 drop。**
这是今天第一次"无人干预的自动节拍产出可见运维会回执"。同类自动节拍对照：
09:26 → 47 秒回执；10:26 → 5 分 38 秒；11:26 → **无回执（28 分钟后被批量 `.done`）**；12:26 → 41 秒。

⚠️ 强度必须如实标注：它靠的是 12:06 被收编的**行为惯例**，不是系统强制——
god 再进入一次长回合，仍会被 §1.2 那条唤醒盲区吞掉。要变成强制，仍需 §5 补丁。


> 注：本会话顺带发现 t-151 已因 **Ryan 席模型 key 预算耗尽**（pollinations key，3 连败）转 blocked 并开人类 ASK ME。
> 这是运维会该报的真异常（12:26 那班应点名它）。密钥值按 §8 纪律不抄录入本档。

## 5. 待批的 src 补丁（已备好，未落盘，一 `git apply` 即可）

### 5.0 一次性批准索引（三批可并同一重启窗口）

| # | 补丁 | 改什么 | 验证状态 | 风险面 |
|---|---|---|---|---|
| 1 | `hive/docs/ops-standup-wake.patch` | 站会节拍计入 actionable（唤醒盲区） | apply ✓ / 反向 ✗ / tsc 0-0 / 44 例 IDENTICAL（含双对照） | 小，仅 `from==='scheduler'` |
| 2 | `hive/docs/fleet-telemetry-pi.patch`（**v2 已成补丁**，14,702 B / 16 hunk） | fleet 仪表四道闸中的 ①②③（④刻意不碰） | apply ✓ / 反向 ✗ / tsc 0-0 / 44 例 IDENTICAL / 真实盘回放 PASS=12（被测值==独立复算） | 中：只喂用量；`lastTool` 与 `cost-ledger` **不在本补丁范围内**（见 FLEET 笔记 §3bis.0） |
| 3 | `hive/docs/heartbeat-body-honored.patch` | 让 heartbeat 正文真的生效 | apply ✓ / 反向 ✗ / tsc 0-0 / 44 例 IDENTICAL | 小，纯文本注入；`to` 字段刻意**不改**（见 §13） |

顺序建议：**3 → 1 同一批上**（都是纯行为修正）；**2 单独一批**，上线并确认 `cost-ledger.jsonl` 开始增长之前，
`circuitBreaker.enabled` 保持 false。

- 补丁：`D:\MunderDifflin\hive\docs\ops-standup-wake.patch`（5.3 KB，`config.ts` + `index.ts`）
- 生成器（只读源文件，在临时副本上做锚点替换后 `git diff --no-index`）：`D:\tdsh\炉石传说\_make_standup_patch.cjs`
- 设计（对应 §2B1）：dispatch mission 的 `request` 节拍默认**可唤醒**（`wake` 缺省 true，可 `wake:false` 关掉）；
  判定收窄到 `from==='scheduler' && act==='request' && 该 label 在 20 分钟窗内发过`，
  **心跳摘要与断路器 steer 仍然一律不算**——不碰 #151 那条防自激的护栏，只把站会从"自家噪音"里捞出来。
  自限性：计数只看**未读**，一被 drain 立刻停止催办，另有 20 分钟硬窗兜底。
- 已验证（三重，全部在临时副本 `D:\tmp_ts\{pristine,patched}` 上做，**未碰 `src/` 一根毫毛**）：
  1. `git apply --check ops-standup-wake.patch` → 两文件干净通过；`--reverse --check` → 如期失败（阳性对照，证补丁是真改动）。
  2. **类型检查**：`tsc --noEmit -p tsconfig.node.json` → pristine **0 error** / patched **0 error**（基线本身干净，所以这个 0 有意义、不是"两边一样坏"）。生成器 `D:\tdsh\炉石传说\_verify_patch_typecheck.cjs`。
  3. **唤醒/投递/排程轨单测**：`node --test` 五套（worker-wake 17、hive-nudge 6、queue-delivery 11、weekly-schedule 9、breaker 1 = **44 例**），pristine 与 patched **逐项 IDENTICAL、0 失败**；
     并且一次跑出双对照：pristine 里 `markWakeBeat` **MISS**、patched 里 **HIT**（证明确实在比两份不同代码），
     `patched 通过用例=44`（证明"0 失败"不是"根本没跑"）。生成器 `D:\tdsh\炉石传说\_verify_patch_tests.cjs`。
     - 首版工具曾把 `queue-delivery` 报成 MODULE MISSING——那是**副本作用域漏 `src/renderer`**（`load-ts.cjs`
       要读 `src/renderer/src/hooks/queueDelivery.ts`），两副本同报的"失败"不是回归。已修：INC 补 renderer，
       并把"硬编码某个补丁的标识符"改成可选参数 + 字节差通用判据。**教训：校验工具自己也要有阳性/阴性双对照。**

  4. 补丁确实进副本的旁证：`markWakeBeat` 标识在 patched 的 `index.ts` 中存在，283,484 → 290,498 字节。

- **未做（受限）**：没有对 `src/` 落任何改动。dev 模式下改 `src/main` 会触发 electron 自动重启并杀掉全部 worker PTY，
  需用户批一个"god 一轮落地之后"的窗口，再 `git apply` + 重启。

## 6. 待办登记（受限项，需用户点头）

### 6.1 面板粘贴块（免重启，把下面整段贴进 ops-standup 的「正文」再保存）

```
每小时运维站会（每班必须留痕，无异常也要回执）。只核三件事：
①席位——谁停滞：以 hive/log.jsonl 里该席位最后一次外发时间戳 + fleet.json 的 inboxBacklog/onHold/breaker 三列为准；
  ⚠️ 不要信 tokens/lastTool/lastActiveSecAgo——这三个字段恒为 0/null（见 §11），拿它们判"没事"是自欺。
②任务——tasks.json 里 blocked / 无人认领 / 长期不动的行；
③看板——board.md 头部与磁盘实际是否一致。
回执只写一行：「站会 HH:MM 无异常」或「站会 HH:MM 异常×N：要点」。
收件人写 external-planner（真实席位、可被第三方核对）；**不要**写 god 自己（等于无痕），也**不要**写 scheduler。
禁止：为站会 compact 终端上下文（压缩归 Context trigger）；复述各席位任务。
```

> ⚠️ 原文那句「回执一律发给 god，不要发给 scheduler（它没有收件箱，会被丢弃）」**两处已过期**：
> ①12:39 起 scheduler 有收件箱了（不再丢弃，见 §10）；②"发给 god"正是 10:26 那班"有回执但无第三方痕迹"的原因。
> 所以粘贴块里两条都要改，不是只改"无条件回执"一处。

改动实质：**消掉正文里"只在真的有异常时才回信"与"无异常也回一句"的自相矛盾**，取后者并写成硬要求。
这是"看起来没触发"的直接来源——静默的班次要么不存在、要么有痕迹。

### 6.2 `to` 字段：两个选项，各有代价

| 选项 | 效果 | 代价 |
|---|---|---|
| 保持 `god`（现状=出厂默认） | 站会=单席自检，成本最低 | 六个 worker 不被点名，它们的停滞只能靠 god 主动看 fleet |
| 改回 `broadcast`（06:55 之前的本机自定义值） | 全员点名，"运维会"名副其实 | 每小时 ×7 个收件人，token 成本约 7 倍；worker 若已停摆会退化成 bounce 到 god |

判断依据：06:55 那次改动是**三键一起动**的批量操作（`autoMode`、`orchestratorMaySpawn` 同时被关掉），
`to` 从 `broadcast`→`god` 混在里面，看不出是有意收窄还是被默认值覆盖——所以本会话不擅自改回。

### 6.3 其余待办

- [ ] **用户，免重启**：贴 §6.1 正文并保存（保存即当场重建定时器，`syncMissions` 走 `missions:save`）。
  ⚠️ 别只改磁盘：面板保存会把它自己那份快照整体写回（`index.ts:4000-4014` 仅对 `lastFiredAt` 做 max 合并）。
- [ ] **用户批窗口**：应用 §5 补丁 + 重启（根治，之后站会自己就能唤醒 god，不依赖 DSH 补投）
- [ ] **用户批窗口（第二批，同一重启窗口可并批）**：fleet 仪表四道闸的修复，设计与验证计划在
  同目录 `FLEET-INSTRUMENT-DEAD-20260913.md`。**注意先后顺序**：仪表修好之前不要打开
  `circuitBreaker.enabled`（tokenVelocity/成本两路都缺数据，开=拿空仪表裁决）。
  god 已明确请求把这条走"DSH 补丁清单→人类通道"（12:55 回执第 4 点），本席已登记，未开卡。
- [ ] **人类边界（与本 goal 无关但影响观感）**：t-151 因 Ryan 席模型 key 预算耗尽 blocked，
  god 已开 ASK ME（提预算 / UI 重启该席）。不处置会让"运维会报异常→无人执行"的观感继续存在。
- [ ] **本会话续跑（不受限）**：DSH goal 循环在每班 :26 之后跑 `_standup_watch.cjs` 核对"发—唤醒—回执"三环，
  缺环即以 external-planner 席位补投（脚本 `D:\tdsh\炉石传说\_send_hive_msg_standup.cjs`；
  通用投递器 `D:\tdsh\炉石传说\_hive_send_generic.cjs`）
- [ ] **用户拍板（安全/高影响，本会话不动）**：`hive` 仓跟踪了 195 个会话转录（129.7 MiB）。
  **保持 `git remote` 为空就是当前最有效的控制**；若要让 hive 进 GitHub 备份，必须先
  `git rm --cached` 转录 + 修 `.gitignore` 覆盖 `**/.pi-agent/sessions/` + 与其他并发会话协调后再谈历史清洗。
  详见 §15.3。


## 7. 补丁风险自评（防"修好站会、点着永动机"）

这堆故障史里最贵的一条是 `steer → inbox → 唤醒 → 同形轮询 → steer` 自激循环，护栏正是
`SYSTEM_SENDERS` 排除 + 心跳 `quietThresholdMs`（现为 600000，已从 0 修回）。本补丁只做最小的那一刀：

| 维度 | 现状 | 补丁后 | 是否放大 |
|---|---|---|---|
| 心跳摘要（from=heartbeat） | 不算 actionable | **完全不变**（判定只认 `from==='scheduler'`） | 否 |
| 断路器 steer/constrain（from=breaker） | 不算 actionable | **完全不变**（且 `circuitBreaker.enabled:false`） | 否 |
| 站会（from=scheduler, act=request） | 不算 → 永不唤神 | 未读且 ≤20 分钟才算 | 有上限 |
| 催办频率 | — | 受心跳节律约束：re-engage 后退避 `base*2.5`=150s 一拍，**不是 30s** | 每小时 ≤8 拍 |
| 收敛条件 | — | 计数只看**未读**：站会被 drain 的那一拍起自动归零 | 是 |
| 病态兜底 | — | 20 分钟硬窗过期即 `wakeBeats.delete`，此后永不因它唤醒 | 有 |

残余风险（如实）：若 god 长期不 drain（模型池故障那类），每小时会多出 ≤8 次 re-engage，
表现为站会反复出现在心跳摘要里——**这恰是想要的告警**，代价是 `log.jsonl` / `config.json`
写入频次上升（心跳本就在每 150s 写 config）。嫌吵可在面板把该 mission 设 `wake:false` 单独降级，不必回滚。

## 8. 收工终检记录（12:35，看门狗 exit=0）

```
 - 09:26:46 | delivered=["god"] | god活动=Y | 回执=48s  站会回执（09:2x local）：无异常
 - 10:26:48 | delivered=["god"] | god活动=Y | 回执=338s 站会回执（10:2x local）：无异常
 - 11:26:53 | delivered=["god"] | god活动=n | 回执=LATE+2349s 站会 11:26 无异常（补开回执）
 - 12:26:53 | delivered=["god"] | god活动=Y | 回执=40s  站会 12:26 无异常
判定: 缺回执 0/4 班 | 历史漏班 2 次            exit=0
```

工具自身也被修过一处会**谎报**的缺陷：回执匹配原先只看本班后 25 分钟窗口，
会把"12:06 补开的 11:26 那班"永久记成空班。现改为「25 分钟窗内正常回执」∪「任意时刻主题里
点名本班 HH:MM 的补开回执」，并区分打印 `Ns` 与 `LATE+Ns`——谎报比漏报更贵，因为它会让人以为还要补投。
唯一仍在的时间戳黑洞是 24h 内 3 条 `to=scheduler` 的 drop（god 偶尔无视正文禁令），靠 §5 补丁闭环。



## 9. 本会话已做的动作清单（可复核）

| 动作 | 落点 | 性质 |
|---|---|---|
| 定案报告 | `D:\MunderDifflin\hive\docs\OPS-STANDUP-NOT-FIRING-20260913.md` | 新增文档 |
| 候选补丁（未应用） | `D:\MunderDifflin\hive\docs\ops-standup-wake.patch` | 新增文档 |
| 补丁生成器 | `D:\tdsh\炉石传说\_make_standup_patch.cjs` | 只读源文件，副本上做替换 |
| 补开 11:26 站会 | god inbox（`04-04-37…2` 已 drain，回执 12:06:02） | 蜂群协议投递，非进程操作 |
| 销 god 09:43 的挂账 request | god inbox（`04-13-09…6`，act=done 终态不回） | 同上 |
| 12:26 拍三环核对 | 后台 job `pwsh-63` | 只读 |
| 常态看门狗（含 late-ack 匹配） | `D:\tdsh\炉石传说\_standup_watch.cjs` | 新工具，退出码 0/3/4/5 |
| 补丁类型检查对照 | `D:\tdsh\炉石传说\_verify_patch_typecheck.cjs` → `D:\tmp_ts\typecheck_compare.txt` | 副本内跑，未碰 src |
| 补丁单测对照（44 例） | `D:\tdsh\炉石传说\_verify_patch_tests.cjs` → `D:\tmp_ts\test_compare.txt` | 同上 |
| 通用 hive 投递器 | `D:\tdsh\炉石传说\_hive_send_generic.cjs` | 新工具（Node 写无 BOM，中文安全） |
| 外部席位清账 | `agents/external-planner/inbox` 51 封未读 → 0（48 封终态归档，1 封已答 request 归档） | 只动自己席位，move 非 delete |
| skill 当场修订 | `munderdifflin-hive-ops`：新增"发出/唤醒/回执三环"分诊法 + 4 个新坑 | 修的是本机已加载 skill，非项目代码 |
| **未做**（受限，等点头） | `src/` 零改动；`config.json` 零改动；未杀/未重启任何进程 | 边界 |
| 补丁 #2（fleet 仪表四道闸） | `hive/docs/fleet-telemetry-pi.patch`（13.2 KB，14 hunk，4 文件） | 四重验证通过，未应用 |
| 真实盘上回放 | `D:\tdsh\炉石传说\_verify_pi_usage_replay.cjs` → PASS=12/FAIL=0 | 副本内跑，未碰 src |
| 进度备份（rule 4） | TDSH 私有仓 commit `0644af3`（18 文件 +1163 行），`git ls-remote origin HEAD` 已等于本地 HEAD | 推送免弹窗直通 |
| 提交前门禁 | `D:\tdsh\炉石传说\_precommit_gate.py`：先跑对照台再扫 19 文件 → 真值形态 0 | 对照台阳性=1 通过后才认它的 0 |

⚠️ 两处如实记录：① 提交时把 `_commit_msg.txt` 一起带进了 commit（PowerShell `Set-Content -Encoding utf8NoBOM`
不被本机 PS 接受而失败，但后面的 `git add` 仍执行了）。内容无害（就是提交说明本身），
已推送不回滚——force-push 需与其他并发会话协调（§7），不值得为一行说明去冒这个风险。
② 并行会话会 `git add -A` 扫走别人的未跟踪文件：我的 `_send_hive_msg_standup.cjs` 就是被别的会话
先行提交的（commit `f18b630`），所以本批只提了 18 个。**在共享工作树里，"我的文件是否已入库"不能靠记忆判断**。


## 10. 回执黑洞已关闭（免重启、免改 src、可逆）

§1.3 那条"回给 scheduler 必被 drop"现已从**代码级缺陷**降级为**可核对台账**：

```
2026/9/13 12:39:25 message external-planner->scheduler inform delivered=["scheduler"]   ← 无 drop
台账 scheduler: pending=0 archived=1   台账 heartbeat: pending=0 archived=0
```

做法与依据（三条都先从源码读出、再实测复核，不是推测）：

1. 只建 `hive/agents/{scheduler,heartbeat}/inbox/.done`，**故意不建 outbox**。
   `routeOnce()` 的守卫就是 `if (!existsSync(outbox)) continue;`（hive.ts:1728）→
   这两个目录永不被当成发件席扫描，零路由负担。
2. 投递可行性：`resolveTo('scheduler')` 原样返回（只有 human/god 折叠成 god）；
   目标不在 registry → `canReceiveInbox(undefined)` → `providerPreset(undefined ?? 'claude').canReceiveInbox === true`
   （agentProvider.ts:618）→ 直接走 `deliver()`。**光有目录不够，这一步才是关键**。
3. 副作用面逐一核过：`selectBroadcastTargets` 只吃 registry（不会被广播到）；
   `voiceMessages` 会枚举 agents 目录（1920）——属期望内：站会回执本就应出现在现场读数里；
   `ensureMineIgnore` 只是给每个席位补 .gitignore。

连带收益：原先"drop + 向 god 回弹 undeliverable"，而回弹件 `from='god'` **算真实发件人**、
计入 `godActionableInboxCount` ——等于 god 自己误投递一次就把自己唤醒一次（又一个自激小回路）。
现在既不 drop 也不再回弹。

有界性：系统席收件由 `_standup_watch.cjs --drain` 每轮搬进 `.done`（move 非 delete），实测 `pending=0`。
回滚：删掉 `hive/agents/scheduler`、`hive/agents/heartbeat` 两目录即可，路由立刻退回原行为，无需重启。

### 10.1 `--drain` 的三条纪律（避免"修一个洞顺手挖一个坑"）

1. 只归档 **>30 分钟的终态件**（inform/agree/done）；`requires_reply` 的 request **永不自动归档**，
   而是被点名成 `!! 待回答的 request` ——那是每轮真正要处理的东西，被工具顺手搬走就等于丢任务。
2. **逐条打印归档清单**（`席位 ← 发件人/act 主题`），绝不静搬；>12 条折行报数。
3. 覆盖三个席位：`scheduler`/`heartbeat`（synthetic 台账）与 `external-planner`（DSH 自己的席位，
   实测曾堆到 51 封无人读，含 1 封 2.5 小时未答的 requires_reply）。外部席位**没有唤醒轨**，
   只能靠 DSH 每轮代 drain——这条已写进 skill 的 Pitfalls。

## 11. 连带发现：运维会的仪表是空转的（fleet.json 活动字段恒空）

排查站会质量时顺手量化了 god 站会第①项（"谁停滞了"）的数据源，结论不好看——**它读的是常量**。

### 11.1 实测事实（全部只读取证，12:43–12:50）

| 事实 | 取证方式 | 结果 |
|---|---|---|
| `hive/fleet.json` 七个在册席位的 `tokens` | 读文件 | **全 0** |
| 同表 `lastTool` / `lastActiveSecAgo` | 读文件 | **全 null** |
| `hive/cost-ledger.jsonl` | `existsSync` | **文件不存在**（0 行） |
| `registry.json` 各席位是否有 `sessionId` | 逐键枚举 | 只有 `sessionName`，**无 `sessionId`** |
| `C:\Users\Administrator\.claude\projects` | `existsSync` | **不存在** |
| pi 真实会话转录 | 读目录 | 存在：`hive/agents/god/.pi-agent/sessions/--D--MunderDifflin--/*.jsonl`（当天 63 个） |
| `src` 里是否认识 `.pi-agent` 这个转录根 | grep `\.pi-agent` | 仅 2 处（都在 hive.ts：HOME 目录 + 扩展目录），**遥测/转录回退里没有** |
| pi bridge 扩展上报内容 | 读 `PI_EXTENSION` 源 | 只 post `PreToolUse`/`PostToolUse`/`Stop`，**不含 usage/token** |

### 11.2 成因链（标注：这一段是推断，上面表格是实测）

`usageProvider` 就是 `TelemetryCollector`（index.ts:~100 附近注释写明"Seam 1"），
输入只有两路：① Claude Code 第一方 **OTel over loopback OTLP**；② 转录回退，走
`projectDir(cwd) = ~/.claude/projects/<key>`（transcript.ts）。本机全员 `provider: pi` →
①没有 OTel 可收；②的目录压根不存在，而真实转录在 `.pi-agent/sessions/` —— 于是
`getAgentUsage()` 恒返回 `zero()`，`sample.sessionId` 恒空 →
`appendCostLedger` 一次都不写（台账文件不存在）→ `fleet.json` 的 tokens/usd/lastTool/lastActive 四项恒空。
`transcript.ts` 自己的注释已经承认过这一类失效的代价：
"Nothing errored — every caller reads an absent directory as 'no transcripts yet' …
a usage reconciler quietly reading nothing at all."

### 11.3 这对运维会意味着什么

- god 的席位说明书要求他"用 fleet.json 复查每个 agent 的 live tokens/cost/last-tool/breaker 并标记停滞者"。
  仪表恒 0/null 时，"fleet 六席全 healthy"这种结论**可能只是空仪表的产物**，而不是观察的结果。
  他今天真正有效的停滞判据，其实只有 inbox 积压数与 log 时间戳（他的回执里也确实只用这两样）。
- 断路器与 token 帽（`agentTokenCaps`：ryan 4M / stanley 3M / creed 3M…）**缺输入**，
  属"纸面护栏"（待核其读取路径，但至少 `runBreakerBeat` 用的就是同一个 `getAgentUsage`）。
- 好在 `circuitBreaker.enabled:false`，所以当前没有"因仪表空转而误杀健康席位"的风险；
  反过来说：**一旦有人想重新打开断路器，必须先修这条计量链**，否则会重演 09-10 那次
  "每个调用都 key 成 `?:hash(undefined)` → 8 个不同调用读成同形循环 → 批量 constrain 健康席位"。

### 11.4 修法分级

- 免重启（今日已做）：站会正文与惯例里把"fleet 活动字段"降级为**不可信输入**，要求以
  `log.jsonl` 时间戳 + inbox 积压为停滞判据（god 12:06 的补开回执事实上已是这个口径）。
- 根治（进 §5 待批补丁的同一批，需重启）：
  1. `PI_EXTENSION` 在 `agent_end` 里附带 usage（pi 的 turn 结果含 tokens），或
  2. 给遥测的转录回退加"provider 感知的转录根"（pi → `<agentDir>/.pi-agent/sessions/<key>`），
     并让 `hive.lastSession()` 对 pi 也能取到 sessionId。
  两者都只喂数据、不动任何唤醒/断路器策略，风险面比 §5 补丁更小；但同样要重启才生效。
- 明确**不做**：不把 fleet.json 的 0 当成"没有活动"报给人类（那是把仪表故障转述成事实）。



### 11.5 本条已闭环（12:55:46 god 回执原文，终态 inform `50ad6b`）

> **站会判据已改（50ad6b 收悉）**：fleet tokens/lastTool/lastActiveSecAgo 恒空=已知常量，
> 今后活体判据改用 log.jsonl 各席最后外发时间戳 + inboxBacklog/onHold/breaker 三列 + 必要时 wake query
> （Pam 11:29 先例）。根治（pi bridge agent_end 附 usage / 转录回退 provider 感知）需人类批重启窗口，
> 请你进 DSH 补丁清单走人类通道，本席不另开卡。

→ 运维会今天获得两条**行为惯例**：①每班无条件留一行回执（12:06）；②判据弃用退化字段（12:55）。
设计细节、四道闸、以及防"把 0 修成虚高"的回放用例已另立 `FLEET-INSTRUMENT-DEAD-20260913.md`。

## 12. 归属勘正：`external-planner` 是**跨会话共享席位**（并发风险）

对本席位 `.sent/` 近 60 分钟做全量归属审计（7 件），其中 **2 件不是本会话写的**：

| 时刻 | 主题 | 归属 |
|---|---|---|
| 12:04:35 / 12:13:08 / 12:39:24 / 12:43:44 / 12:49:03 | 补开站会、清账回执、探针、验证请求、仪表勘定 | 本会话（运维会 goal） |
| **12:08:52** | 【Ryan 卡死·pollinations budget】 | **并行的炉石 DSH 会话** |
| **12:48:24** | 【m2v172 rotator 停滞】 | **同上** |

（12:08 那条本会话一度误记成自己发的——见本报告早期版本对 12:08:53 事件的默认归属。**教训：共享席位下，"log 里 from=我"不等于"我发的"**。）

由此立刻改掉一处本工具引入的风险：`--drain` 对 `external-planner` 的归档时限从 30 分钟**提到 120 分钟**
（synthetic 系统席保持 30 分钟，因为没人读它们），避免本会话的自动清账把兄弟会话还没读的信搬走。
`requires_reply` 的 request 仍然永不自动归档。

纪律补一条：以后凡"某席位说了什么"这类判断，先审计 `.sent/` 的 mtime + 内容归属再下结论；
需要专属席位时应另建席位目录，而不是共用 `external-planner`。



## 13. 同类缺陷第二例：heartbeat 的「正文」和「收件人」是**假可编辑字段**

与"运维会不触发"同一个家族（面板上能改、运行时不生效），这次轮到另一条 mission。

**实测对照**（两份文本都是权威文件里的原文）：

| | 内容 |
|---|---|
| `config.json` → `missions[heartbeat].body` | 「现场心跳（状态检查）：团队已陷入沉寂。请查阅收件箱中的简报，安排蜂群推进任务板的任务，重新跟进停滞不前或遭遇阻碍的成员…**或者，如果工作确实已全部完成，即可安心休息**。」 |
| god 实际收到的心跳正文（`agents/god/inbox/.done/*.json`） | `Floor heartbeat — 2 actionable inbox message(s) awaiting you… Drain your inbox NOW` + `Active agents (6): …` + `Board (head):` + `Recent log:` + `Re-engage anyone stalled or blocked and keep the board accurate — or rest if the work is genuinely done.` |

→ 两者**零重合**：god 收到的是 `buildHeartbeatDigest()`（index.ts:1141）里硬编码的英文模板，
配置里那段中文一个字都没进去。原因在源码里很干脆：`armHeartbeat(m)` 只用了
`m.intervalMs` / `m.quietThresholdMs` / `m.id` / `m.lastFiredAt` 四个字段，**从不读 `m.body`**。

而 UI 侧（`src/renderer/src/components/triggers/SchedulesSection.tsx`）：正文输入框对所有 kind 都可编辑
（307-308 行），dirty 判定把 `body !== mission.body` 算作改动（223 行），保存也确实写进 config（249 行）——
**所以这是一个完整的假反馈回路：改了→保存了→面板回显了→运行时无效**。

第二处假字段：`missions[heartbeat].to` 在配置里是 `broadcast`，但 `reengageGod()` 永远只发给 god。
（这一处本会话**不建议**改成真广播——按 09-11 那次自激循环的教训，把心跳喂给全员消息池正是燃料；
应改的是 UI 别让人以为可改。）

**修法**：候选补丁 #3 `hive/docs/heartbeat-body-honored.patch`（2.3 KB，3 处 hunk，仅 `index.ts`）——
把操作者的正文作为心跳摘要的**结尾指令**注入，空白时回落原英文行（既有配置行为零变化）。
`to` 不改（保持"只发给 god"的真实语义），另建议在面板上对 `kind==='heartbeat'` 把收件人显示成只读。
验证与补丁 #1 同法（apply --check / 反向失败阳性对照 / pristine-vs-patched 类型检查与单测对照），
结果见 §13.1。

### 13.2 ⚠️ 打补丁 #3 之前必须先改 heartbeat 正文（否则会把假话说成权威）

补丁 #3 让配置里的正文成为每拍摘要的**结尾指令**。但当前 `missions[heartbeat].body` 开头就是
「现场心跳（状态检查）：**团队已陷入沉寂**」——这句在 `actionable > 0` 那种拍上是**事实错误**：
同一份摘要的开头明明写着 `Floor heartbeat — 2 actionable inbox message(s) awaiting you`。
今天它没造成危害，只因为这段文字根本没被送出去（假可编辑字段）；一旦 #3 上线，它就变成每拍必读的指令。

所以两条一起改（面板粘贴块，免重启）：

```
请按本简报处置：有可执行邮件就先 drain 收件箱并逐条落地；无异常时保持安静，不必为心跳回执。
只有在发现停滞席位、无人认领或长期不动的任务、过期看板行时才开口（一行即可），收件人写 external-planner。
不要为心跳 compact 终端上下文，也不要在长回合里被本简报打断——空闲时再读。
```

要点：**正文里不许写状态断言**（"团队已沉寂""一切正常"这类），状态由程序生成的 header 与 digest 负责；
操作者的话只描述**处置规则**。这条也是给 #3 这类"把配置文本注入提示词"改动的通用约束。

### 13.3 补丁 #3 验证结果（与 #1 同法，全部在临时副本上）

- `git apply --check heartbeat-body-honored.patch`（仓根）→ **exit 0 可干净应用**；`--reverse --check` → exit 1（阳性对照）。
- `tsc --noEmit -p tsconfig.node.json`：pristine **0 error** / patched **0 error**，新增错误 0。
- 单测五套 **44 例 IDENTICAL、0 失败**；副本 `index.ts` 283,484 → 289,581 字节（证明确实在比两份不同代码）。
- 已复制到 `D:\MunderDifflin\hive\docs\heartbeat-body-honored.patch`，与 #1 同目录待批。



- `git apply --check heartbeat-body-honored.patch`（仓根）→ **exit 0 可干净应用**；`--reverse --check` → exit 1（阳性对照通过）。
- `tsc --noEmit -p tsconfig.node.json`：pristine **0 error** / patched **0 error**，新增错误 0。
- 单测五套（44 例）pristine 与 patched **逐项 IDENTICAL**。
- 副本确被改动：`index.ts` 283,484 → 289,581 字节。
- 工具自身修掉两处**会骗人**的地方（都是这轮才暴露的）：
  ① `_verify_patch_tests.cjs` 原先只拷 `src/main|preload|shared`，导致 `queue-delivery` 因缺
  `src/renderer/src/hooks/queueDelivery.ts` 报 MODULE MISSING——两副本同报的"失败"是**拷贝作用域**，不是回归；
  ② 它用硬编码标识 `markWakeBeat` 判断"补丁是否进了副本"，对不含该标识的补丁 #3 会误报 false。
  两处都已改成通用判据（拷 renderer + 以字节差为通用旁证）。教训：**校验工具自己也要有阳性/阴性双对照**，
  否则它会系统性地把工具缺陷报成代码缺陷。



## 14. 端到端验证（判定：已自主闭环，不依赖对方配合）

按"禁止互相等待形成锁环"的纪律改写本节结论：**验证不挂在 god 是否照我做**上。

- 已由本席独立证明的部分（决定性）：`deliver()` 这一道闸才是黑洞的成因，而它**只看收件人 inbox 目录存在**。
  12:39:25 探针 `external-planner → scheduler` 实测 `delivered=["scheduler"]`、无 `drop`（原件在 `agents/scheduler/inbox/.done`）。
  代码路径与发件人无关（`routeMessage` 的分支只按 target 判定），所以"god 的回执能不能进台账"与"我的信能不能进"是同一个判断。
- 属于**加分观察**、不作为门槛的部分：12:43 我请 god 把 13:26 那班回执发给 `scheduler`。
  截至 13:5x 他仍在 23 分钟的长回合里（转录 mtime 13:49:05），所以那班是否按我请求发、发去哪，
  都只是行为惯例的采样，**不影响黑洞已关闭的结论**。等它就等于是拿别人的动作当自己的验收——不采用。
- 若要再拿一次真实流量复核，用 `_standup_watch.cjs` 的"修复前/修复后 drop 分档"读数即可（自动以台账目录 mtime 为界），
  不需要谁先动手。

### 14.1 真实流量已经走到了（13:53 由 `_wait_beat.cjs` 捕获，非等待验收）

```
✓ 回执 +1594s → scheduler 「【站会回执 13:26 班】异常×1：rotator 停滞复发（13:18 row=10）——已处置中」
drop 计数: 136 → 136（新增 0）
台账: scheduler=1/1  heartbeat=0/0  external-planner=3/62
★ 端到端确认：god 的回执真的进了 scheduler 台账（黑洞已闭）
```

三点同时成立，黑洞关闭从"探针证明"升级为"真实流量证明"：
① 回执落在**从前必被丢弃**的 `to=scheduler` 路径上；② 全量 drop 计数**没有增加**（136→136）；
③ 台账里真有一封（`pending=1`）。而且这条回执内容是**真异常报告**（rotator 停滞复发），
不是应付式的"无异常"——运维会第一次同时做到"报了该报的事"且"留了可核对的账"。

+1594s（26.6 分钟）的延迟也如实印证 §1.2b 的 B 闸：他当时在 23 分钟长回合里，
**任何**邮件（含另一会话 13:40 的真发件人 request）都被压到空闲才读。延迟是回合忙，不是没发。



探针只证明了「本席 → scheduler 能投递」。真正的缺陷面是「**god 的回执** → scheduler」，
两者代码路径相同（`deliver()`）但没实测过不算定案。故 12:43 已向 god 投一条一次性 request：
**13:26 那班的回执请发给 `scheduler`**，本席用台账计数核对 `pending` 是否 +1；再下一班起回 normal。
事件驱动等待器：`_wait_beat.cjs`（取代定时 sleep，本会话三次把"还没到"当成"没发生"后才换掉它）。

## 15. 顺手做的安全旁证：hive 版本控制面（结论=0 真凭据，但有一个更大的面）

因 `hive` 仓会自动 `commit` 每条消息（`send()` 里 `this.commit(...)`），顺手做了泄漏核查。
判据全程带对照，工具：`D:\tdsh\炉石传说\_hive_track_scan_audit.py`（复用 `security_audit\cred_scan.py` 的正则口径：
字段名整体词界 + 值字符类含 `_`/`-` + 注入形态排除 + 只输出字段名/长度/字符类别，**绝不印值**）。

### 15.1 计数（真值形态与占位形态分开报）

| 目标 | 真值形态 | 占位形态 | 说明 |
|---|---|---|---|
| 对照台 `D:\tmp_ts\ctlrepo` | **1**（a.py `SMTP_PASS`，14 位，lc+uc+dg+us） | 0 | 阳性必须非 0，否则是检索串失效 |
| 同一对照台的 `credentials: "include"` | 0 | — | 假阳探针通过（字段名词界生效） |
| `hive`（2411 个跟踪文件 / 2325 个文本） | **1 → 复核后判为假阳** | 0 | 见 15.2 |

⚠️ 口径提醒：**"占位形态 0"不等于"仓里没有占位符"**——`ENVISH` 会先整行跳过（含 `xxx`/`<...>`/`{{` 等），
所以那类行根本进不了占位计数。两个数分开报是对的，但把"占位 0"读成"没有占位符"是新的一种假绿。

### 15.2 唯一命中的定性：不是凭据

命中的是 archived 转录里一个 JSON 字段 `"key"`，值 20 位、**纯字母无数字**、形状 `AaaAaaaaAaaaaaaaaaaa`（CamelCase），
所在行是模型在 `thinking` 里讨论"用 jar 里的类名做匹配"——即**Java 类标识符**，不是密钥（无 `sk`/`gh`/`pt` 前缀、无数字）。
定性脚本：`_classify_hit.py`（输出掩码与形状，同样不印值）。→ **真凭据命中 0。**

### 15.3 真正该关注的不是那 1 个假阳，而是这个

**195 个会话转录 `jsonl` 被 git 跟踪，合计 129.7 MiB**（`agents/god` 38 个、`archived-20260911-supervisor/*` 145+ 个）。
`.gitignore` 里那条 `agents/*/.pi-agent/sessions/` **对已跟踪文件无效**（gitignore 不 untrack），
且 `archived-*/…/.pi-agent/sessions/` 压根不在覆盖范围内。转录里装的是模型与工具的**全文对话**（含工具输出、路径、偶发的 key 前缀）。

- 当前 **`git remote -v` 为空**，所以没有任何东西出过本机——这是本次核查找到的最重要的一条"还没坏"。
- 因此**不要**给 `hive` 配 remote 并 push，除非先做完：`git rm --cached` 转录 + 提交 .gitignore 修正 + （洁癖）历史清洗。
  历史重写属高影响动作，且本仓有并发会话在提交，**须用户拍板并协调**，本会话一律不动。
- 登记为受限待办（见 §6.3）。

## 16. 自愈轨上线（14:53 首触发，免重启、免人工、幂等）

补丁获批之前的过渡保护：**逾班必被补投一次**。

| 要素 | 实现 |
|---|---|
| 专属席位 | `hive/agents/hive-ops`（**不再共用** `external-planner`，消除本会话实测的归属混淆：同小时 7 件里 2 件非本会话） |
| 判据 | `_standup_watch.cjs --heal`：某班超宽限期（默认 25min）且 `ackFor()` 找不到任何回执（含"任意时刻点名本班 HH:MM 的补开回执"）即算逾期 |
| 幂等 | `_heal_log.json` 记 `beatId → 补投时刻`，同一班永不再补 |
| 限流 | 每小时最多 1 次；只补 60 分钟内的班（历史久案 `--dry` 可见但不动手） |
| 先验后投 | 先 `--heal --dry` 看决策，再摘掉 `--dry` 真投；守夜器 `_heal_loop.cjs` 每 90s 复评，出现更新的一班就主动退位 |

**首次真实触发**：

```
守夜起点 14:45:47，盯班 14:26:53
[14:53:18] 判定逾期，执行真补投…
   ✓ 已补投 班 14:26（350 字符，id=Z-ac1079），台账已记
14:53:19 message hive-ops->god request 【自愈补投】站会 14:26 班逾期 26min 无回执
```

**阳性对照**（证明探测器有牙齿，不是"恰好没班"）：同一时刻 `--heal --dry` 在 400 分钟窗口里把
**08:26 那班**（今天至今唯一无回执的班）列为逾期候选，并因超出 60 分钟动手窗而**拒绝补投**——
"看得到但不动旧案"两条同时成立才算数。

未采用 Windows 计划任务（准则 2）：周期观察全部由 goal 循环 + 限时后台 job 承担，job 会自己退位。

### 16.1 自愈轨闭环成功（16:07 真实回执，含惯例扩散）

```
14:53:19  hive-ops->god  request 【自愈补投】站会 14:26 班逾期 26min 无回执
16:07:10  god->hive-ops  inform  站会 14:26 回执（补开）      +6016s
16:07:10  god->hive-ops  inform  站会 15:26 回执              +2416s
判定: 缺回执 0/4 班 | 修复后 drop 0            exit=0
```

三点值得记：① 补投把**两班**一起救回来了（15:26 那班我没补，它跟着一起回）；
② god 把回执**发到了 hive-ops** —— 说明补投正文里那句"收件人写 hive-ops，别写 god 自己（等于无痕）"
被当作新惯例吸收，比我在 12:04 手工教的"写 external-planner"更进一步；
③ 延迟 6016s 不是补投无效，而是 B 闸（长回合）：那 100 分钟他在 m2v172.1 换栈与 t-151/t-152 处置里，
16:07 一空闲就把欠账一次结清。**自愈轨的价值在于"欠账不会永远没人管"，不在于秒回**。

### 16.2 我 own 的一次误报（必须写进文档，防止下一个人照抄错判据）

16:0x 我第一版"单点告警"用 **god 多久没往外发消息** 当停摆判据，报出"停摆 124min"。
实际他那时正在两个长回合里干真活（写 outbox 件、更新 board，16:16:15 还给 ryan 发复工令），
`roster.status=working / action="using bash"` 与我的告警**直接矛盾**。按准则 §8 两条冲突不许挑一条信，
查实结论：**"没发邮件"≠"停工"**。判据已改为**会话转录 mtime**（pi 自己写盘，既不经遥测也不经他肯发邮件）：

```
god 邮件静默 6min（这只说明"没发邮件"）｜转录活体 2min 前 [–D--MunderDifflin--/2026-09-13T07-26-35-486Z]｜同期 0 班无回执
```

只有"转录也 N 分钟没写 + 有班待回"才亮 🔴（退出码 6）。这条恰好也是 §11 那个教训的镜像：
**fleet 的 0 不能读成"没活动"，god 的沉默同样不能。**

## 17. 三批补丁上线确认（18:06 重启后，验收门全绿）

**时间线**（用户 17:0x 批准"修好来重启"）：
- 17:01 config 正文落盘（备份 `config.json.bak-pre-patch-20260913-170124`）
- 17:03–17:05 三批补丁 `git apply` 进 `src/`
- ⚠️ **17:06 第一次重启无效**：`package.json` 的 `main` 指向 **编译产物 `out/main/index.js`**，
  直接重启跑的是旧代码 —— 这就是用户说"触发器没修好"的那一环。
- 18:02 `npm run build`（electron-vite build，产物 695.26 kB）→ 复读确认 `markWakeBeat`(2)/
  `piProjectKey`(2)/`resolveAgentHome`(4) 已进产物 → 18:04 重启（PID 11108）
- **18:06:49 fleet 首拍有数据**：`god tokens=7,591,687 lastActiveSecAgo=0`（60 分钟前还是全 0）
- `_verify_telemetry_live.cjs` 验收门 **PASS=3 FAIL=0**，G5 反虚高 = **1.00x 精确相等**
  （fleet 读数 == 独立同口径复算，且未把 god 的 66 场历史累加）
- 修正了一处验收门口径错误：fleet.tokens 含 cache，复算必须同口径（第一版比 in+out 报 10.43x 假失败）

**未做/待办（如实）**：
- 重启按设计把 6 个 worker 归档（关终端=归档，`setArchived`）。恢复=UI 对每个 worker 重开终端
  （respawn 自动 `archived:false`）；手改 registry 会被 hive 回写，勿做。
- `lastTool` 仍 null、`cost-ledger.jsonl` 仍不存在 —— 都是刻意范围外（见 FLEET 笔记 §3bis.0）。
- 断路器仍 `enabled:false`：仪表 18:06 才有首拍，观察几小时稳定后再议重开。
- §5.0 的三批补丁状态从"待批"更新为"已编译上线"；§6.1/§6.2 的面板项已被 config 落盘+重启等效完成。




> 字节口径小注：本文早前把补丁写成 `13,856`，那是 JS `字符串.length`（字符数）；磁盘字节数是
> **14,702 B**（中文注释 1 字符 = 3 UTF-8 字节）。现已统一按字节报，避免两个数被当成两个版本。









