# fleet.json 仪表空转：四个独立拦截点（设计与取证笔记，供下一批补丁用）

- 日期 2026-09-13 · 取证会话：DSH（运维会 goal）· 现场报告见同目录 `OPS-STANDUP-NOT-FIRING-20260913.md` §11
- 现象：七个在册席位 `tokens=0`、`lastTool=null`、`lastActiveSecAgo=null`；`hive/cost-ledger.jsonl` **文件不存在**。
- 定性：**不是**"没人干活"。同一时刻 god 的转录里有 190 条记录、其中 **86 条自带 usage**，
  数据一直在盘上，只是四道闸把它挡在读不到的地方。

## 1. 四道闸（任一未开即零遥测，实测全部未开）

| # | 位置 | 为什么拦住 | 实测证据 |
|---|---|---|---|
| ① | `telemetry.ts:436` `if (!sessionId) return null;` | sessionId 来自 `hive.lastSession()`，而它就是 `registry().agents[id]?.sessionId`（hive.ts:1137）；pi 席位靠 hooks 不报 sessionId，registry 里**只有 `sessionName`** → **在读任何东西之前就 return null** | `registry.json` 逐键枚举：god + 6 worker 均无 `sessionId` 键 |
| ② | `transcript.ts` `projectDir()` = `~/.claude/projects/<key>` | 只认 Claude Code 的转录根；pi 写在 `<agentDir>/.pi-agent/sessions/<piKey>` | `C:\Users\Administrator\.claude\projects` **不存在**；pi 转录存在（god 当天 63 个文件） |
| ③ | `transcript.ts` `parseUsageLines()` | 只收 `rec.type==='assistant'` 且字段名为 `input_tokens/output_tokens/cache_creation_input_tokens/cache_read_input_tokens`。pi 记录是 `type:"message"`+`message.role:"assistant"`，字段是 **`input/output/cacheRead/cacheWrite/totalTokens`** → 即便读到也全 `num()` 得 0 | pi 记录实例：`{"input":1679,"output":119,"cacheRead":0,"cacheWrite":0,"reasoning":13,"totalTokens":1798,"cost":{…total:0}}` |
| ④ | `index.ts:1235` `if (sample?.sessionId) appendCostLedger(sample)` 配 `telemetry.ts:441` 强制 `sessionId:''` | 回退样本**故意**不带 sessionId（防 #56 重复计账），所以①②③全通也**永不写台账** → 这就是文件不存在的直接原因 | `cost-ledger.jsonl` `existsSync=false` |

> ①与②之间还有一层"设计原因"：`transcriptFallback` 的 D11 注释记过一次真实事故——共享 cwd 下不过滤，
> 会把整个项目目录的历史算到一个零调用 worker 头上（实测 143,369,766 tokens）。
> 所以"让 pi 也能读"的补丁**必须按会话作用域读**，否则是把仪表从"全 0"修成"全虚高"，更坏。

## 2. pi 转录根键名规则（已实测标定，别猜）

`piKey(cwd) === '--' + projectKey(cwd) + '--'`，其中 `projectKey = cwd.replace(/[^a-zA-Z0-9]/g,'-')`。
7/7 席位、5 个不同 cwd 全部吻合：

| cwd | Claude 键 | pi 实测目录名 |
|---|---|---|
| `D:\MunderDifflin` | `D--MunderDifflin` | `--D--MunderDifflin--` |
| `D:\MunderDifflin\worktrees\ryan-mtvy0jjp` | `D--MunderDifflin-worktrees-ryan-mtvy0jjp` | `--D--MunderDifflin-worktrees-ryan-mtvy0jjp--` |
| （god 名下旧 cwd）`D:\tdsh\munder` | — | `--D--tdsh-munder--`（同目录树里并存，说明**必须按当前 cwd 选键**） |

🔴 **虚高陷阱在 pi 侧同样成立，但机制与我最初的判断不同——这里做自我更正**：
每席有**自己的** `PI_CODING_AGENT_DIR`（`agents/<id>/.pi-agent/sessions/<piKey>/`），
所以同 cwd 的 god / kevin / pam 用的是**同一个键名、但各自独立的物理目录**（我第一版写"三席落在同一目录"是错的）。
真正会把数字撑爆的是**同一席位自己的历史场次**被目录级求和，实测（13:19，只读逐文件加总）：

| 席位 | 目录内会话文件 | 目录求和 in | 仅最新一场 in | 虚高 |
|---|---|---|---|---|
| god | 63 | 83,010,259 | 2,838,055 | **29.2×** |
| kevin | 31 | 13,571,642 | 814,902 | **16.7×** |
| pam | 31 | 10,822,714 | 127,467 | **84.9×** |
| stanley | 32 | 5,793,749 | 176,355 | **32.9×** |
| dwight | 32 | 10,994,996 | 86,964 | **126.4×** |
| **ryan** | 35 | 23,659,886 | **0** | **≈∞（2.4 亿%）** |
| **creed** | 32 | 4,080,224 | **0** | **≈∞** |

- ryan / creed 最新一场 in=0/out=0 是**真信号**：ryan 正是 t-151 因 key 预算耗尽 3 连败的那席（3 连败＝没有成功调用），
  与遥测无关地交叉验证了本探针的正确性。**这类席位若按目录求和，会被报成"烧了 2366 万 token"——比现在的"全 0"危险得多**
  （全 0 只是瞎，虚高会驱动断路器与 token 帽做错误裁决）。
- 跨席污染只在**串线事故**下发生（09-13 07:3x 实证过一次双 spawn 串线：god 的会话 jsonl 落进 kevin 目录、反之亦然）。
  所以按文件名里的 `<uuid>` 作用域读，同时防住"自己历史"和"串线他人"两种污染。
- 复跑取数：`D:\tdsh\炉石传说\_probe_pi_usage_scoping.cjs`（只读，也是补丁 #2 回放用例的基线来源）。



## 3. 补丁设计（3 文件 + 1 处接线；只喂数据，不碰唤醒/断路器策略）

1. `transcript.ts`
   - `ReadUsageOptions` 增 `{ agentHomeDir?: string; newestOnly?: boolean }`。
   - 新增 `piSessionDir(agentHomeDir, cwd)`（用 §2 规则）；命中失败时 `console.warn` 一条带 cwd/键名的诊断。
   - `parseUsageLines` 加 pi 分支：接受 `rec.type==='message' && rec.message?.role==='assistant'`，
     字段 `u.input ?? u.input_tokens` / `u.output ?? u.output_tokens` / `u.cacheRead ?? u.cache_read_input_tokens` /
     `u.cacheWrite ?? u.cache_creation_input_tokens`；**同一行只命中一个分支**（先 Claude 后 pi，避免双计）。
   - 作用域：pi 记录无 `sessionId` 字段，会话身份在**文件名** `<isoTs>_<uuid>.jsonl` →
     由文件名推 sessionId 灌进 `perSession`；`newestOnly` 时只取该键目录下 mtime 最新的**一个**文件。
2. `telemetry.ts`
   - `transcriptFallback`：sessionId 缺失时不再直接 `return null`，改问 `resolveAgentHome?.(agentId)`；
     拿到 home 就走 `readAgentUsage(cwd, { agentHomeDir: home, newestOnly: true })`
     （newestOnly 比 D11 的过滤更严：只算这一席当前这一场会话）。
   - 成本：pi 的 `cost.total` 恒 0（自定价），沿用 `estimateCostUsd(model,…)` 估价，别把 0 当真值。
3. `hive.ts`
   - `lastSession()`：registry 无 `sessionId` 时回退"该席 `<home>/sessions/<piKey(cwd)>` 下最新文件名里的 uuid"。
     单这一步就能解 ①，也是 `defaultWorkerTokenCap` / `agentTokenCaps` 从纸面变生效的前提。
4. `index.ts`
   - 构造 `TelemetryCollector` 处（已有 `resolveCwd`/`resolveSessionId`）加 `resolveAgentHome`。
   - ⚠️ `agentDir(id)` 是 **private**（hive.ts:428）→ 需给 HiveManager 加一个公开访问器，别绕过去手拼路径。

## 3bis. 实施结果（补丁 #2 已写出并四重验证，13:53–14:17）

**落点**：`hive/docs/fleet-telemetry-pi.patch`（**v2 = 14,702 B / 16 hunk**；`transcript.ts`/`telemetry.ts`/`hive.ts`/`index.ts`。v1 是 14 hunk/13,248 B，不够，见 §3bis.0）。
生成器 `D:\tdsh\炉石传说\_make_telemetry_patch.cjs`（只读源文件，副本上做锚点替换）。

与原设计的三处**有意偏差**（都是往保守方向改）：

1. **不改 `hive.lastSession()`**。它是 `claude --resume <id>` 的取参来源，给 pi 席位返回一个"从文件名编造"的
   uuid 会让 claude 路径拿到无意义 id。改为遥测自己按 `newestOnly` 作用域读 → 同样解 ①，零副作用。
2. **不碰成本台账（④保持原样）**。`appendCostLedger` 那道 `if (sample?.sessionId)` 是为了修 #56
   "每 30s 重写同一行、实测 2,417 条重复"而加的；绕过它 = 重开旧伤口。本次只让 **fleet.json 的用量列**活起来，
   台账另案（正确修法是按 sessionKey 去重，不是放开闸门）。**如实缩小承诺范围**。
3. **目录不存在时 `console.warn` 一次**（`piMissingWarned` 去重），因为"没有目录"和"没有活动"是两件事——
   本次误诊的根源正是静默返回 0。

### 3bis.0 🔴 第一版补丁不够（自查发现，已修）：`snapshot()` 根本不走转录兜底

写完 v1（14 hunk）后按第一性原理追了一遍数据流，发现**修的不是出问题的那条路**：

```
writeFleetSnapshot()  →  telemetry.snapshot()  →  for (agentId of this.agentSessions.keys()) aggregateLive(agentId)
                                                   ↑ 只有 OTel 活体会话；transcriptFallback 只在 getAgentUsage() 里
```

pi 席位没有 OTel 活体 → `agentSessions` 里没它 → `snapshot().usage` 永远不含它 →
**fleet.json 依然全 0**。v1 只补强了 `getAgentUsage()` 的调用方（断路器那一拍），
也就是说：v1 若上线，我会对着仍然全 0 的 fleet 宣布"补丁无效"。

v2 因此加两个 hunk（同一洞的两处视图）：

- `writeFleetSnapshot()`：`const u = usageById.get(id) ?? usageProvider.getAgentUsage(id) ?? undefined;`
- `ipcMain.handle('hive:agentDirectory')`（渲染层读数）：同一处理。

并**明确划出本补丁不修的两件事**（免得下次有人拿它们当验收）：

1. `lastTool` 仍为 null —— 它来自 `snap.spans`，而 spans 只有 OTLP `tool_result` 才填；
   pi 的 `PostToolUse` 走的是 hook 通道（进 roster，不进 spans）。要修得再动 telemetry，另案。
2. `cost-ledger.jsonl` 仍不创建 —— 见 §3 偏差 ②，那是 #56 去重闸门，刻意不碰。

→ 并为此写了上线验收门 `_verify_telemetry_live.cjs`（能自动分辨"上线前/上线后"两种预期，
且**独立复算**盘上真实用量做对照：14:52 实测 god 最新一场 in+out=401,568 而 fleet 报 0，
证明"全 0 是读取路径坏了，不是没干活"）。

**四重验证**（全在 `D:\tmp_ts\tel*\{pristine,patched}` 副本上，`src/` 零改动）：

| 门 | 结果 |
|---|---|
| `git apply --check`（仓根） | exit 0 ✓ |
| `git apply --reverse --check` | exit 1 ✓（阳性对照：补丁是真改动） |
| `tsc --noEmit -p tsconfig.node.json` | pristine 0 error / patched 0 error，新增 0 ✓ |
| 唤醒/投递/排程/断路器 五套单测 | 44 例 IDENTICAL、0 失败 ✓（`piProjectKey` 全 src 检索：pristine MISS / patched HIT） |
| **真实盘上回放**（`_verify_pi_usage_replay.cjs`） | **PASS=12 FAIL=0**：`newestOnly` 与独立同口径复算**精确相等**（god 283,240 / kevin 814,902 / ryan 0 / creed 0）；目录级不设 newestOnly 分别是 296.5× / 16.7× / — / — 的虚高；负路径 pristine 返回 0 |

### 3bis.1 回放里踩到的一次"假失败"（口径教训）

第一版回放拿 13:19 `_probe_pi_usage_scoping.cjs` 的"记录时间戳最大那场"当基线，而补丁按 **mtime 最新那场**取。
god 在 13:26:35 开了新会话 → 两个定义指向不同文件 → 报出 `283,240 vs 2,838,055` 的"10× 失败"。
**被测代码没错，是对照的口径没对齐。** 改法：基线换成"与被测同定义"的独立复算（同一份盘、另一段代码），
断言精确相等；历史数字只作量级参照。教训：**口径不一致的对照比没有对照更坏**——它会让人去"修"一个不存在的问题。


## 4. 验证计划（沿用运维会补丁那套；实际结果记在 §3bis）

1. `git apply --check` 干净 + `--reverse --check` 失败（阳性对照，证非空补丁）。
2. `tsc --noEmit -p tsconfig.node.json` 在 pristine/patched 两份副本上对比，**新增错误必须为 0**
   （上一批实测两边各 0 error，基线本身干净）。
3. `node --test` 跑 usage/telemetry/fleet 相关套件；并**新增一条回放用例**：拿 god 真实转录
   （含 86 条 usage 的那场会话）喂 `readAgentUsage`，断言 ① tokens ≈ 该场 `totalTokens` 之和、
   ② **不包含**同目录里 kevin/pam 的会话。这一条专门钉死 D11 虚高回归。
4. 上线判据（看节律不看代码）：`cost-ledger.jsonl` 被创建且行数随回合增长；`fleet.json` 的
   `tokens>0`、`lastActiveSecAgo` 是数字、`lastTool` 非 null；`roster`（hooks 口径）与
   `fleet`（遥测口径）**不再互相矛盾**——过去两次误诊（"roster 报 171× 同形调用而 fleet 报 0 token"）
   的根源就是这两个口径不同源。

## 5. 上线结果（18:06 重启后实测，验收门全绿）

**前提补上的一课（重要）**：`package.json` 的 `main` 指向 **`out/main/index.js`（编译产物）**，不是 `src/main`。
17:01 那次"重启"只重启了旧产物 → 三批补丁全程没进运行时，fleet 依旧全 0。**改 `src` 后必须 `npm run build` 再重启**
（dev 模式才热编译；本机是直接 `electron.exe D:\MunderDifflin` 跑产物）。

```powershell
npm run build          # electron-vite build（~35s）
# 产物复读：out/main/index.js 必须出现 markWakeBeat / piProjectKey / resolveAgentHome
```

18:02:57 新产物（695.26 kB）→ 18:04 重启（PID 11108）→ 18:06:49 fleet 首拍：

```
fleet.ts: 18:06:49
god  tokens=7,591,687  lastActiveSecAgo=0  lastTool=null
```

`_verify_telemetry_live.cjs` 验收门 **PASS=3 FAIL=0**：

| 断言 | 结果 |
|---|---|
| G5 反虚高：fleet.tokens / 单场独立复算 | **1.00x 精确相等**（7,591,687 = 7,591,687） |
| G1 活跃席位 lastActiveSecAgo 是数字 | ✓（0 = 刚刚活动） |
| G2 lastTool=null | 符合预期（spans 只来自 OTLP，pi 不产；另一批） |
| G3 cost-ledger 不存在 | 符合预期（刻意不碰 #56 闸门） |
| G4 roster/fleet 口径 | ✓ 不再互相打脸 |

> G5 第一版报 10.43x 是我验收门自己的口径错：fleet.tokens 含 cache（input+output+cacheRead+cacheCreation），
> 复算却只比 in+out。已改成同口径后精确一致 —— 口径不一致的对照比没有对照更坏（规则 14）。

**副作用登记**：本次重启按应用设计把 6 个 worker（ryan/kevin/stanley/dwight/pam/creed）归档
（`setArchived`：关终端=归档，hive.ts:1015）。恢复路径 = **UI 对每个 worker 重开终端**（respawn 时
`archived:false`，hive.ts:770）。手改 registry 会被 hive 回写，勿做。worker 恢复后 fleet 每席也会
因转录兜底立即有 tokens。


## 6. 边界（写给接手的会话）

- 三批补丁已于 **18:02 编译进产物并重启生效**（用户 17:0x 批准）。改 `src` 后必须 `npm run build` 再重启
  （`main` 指向 `out/main/index.js`，直接重启不换代码——17:01 那次就白重启了）。
- 断路器仍**不要**急于打开：fleet 仪表 18:06 才恢复首拍，先观察几小时确认 `tokens/lastActiveSecAgo`
  稳定非 0 再考虑；tokenVelocity 与成本两路数据刚有，09-10 批量误伤的前置条件刚被拆掉。
- 同期人类待办：t-151 因 Ryan 席模型 key 预算耗尽 blocked、god 已开 ASK ME（提预算 / UI 重启该席）。
  与本笔记无关，但会让"运维会是否有效"显得模糊，别混为一谈。
- 取证脚本（可复跑）：`D:\tdsh\炉石传说\_probe_pi_session_keys.cjs`、`_verify_telemetry_live.cjs`。
