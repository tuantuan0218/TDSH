# 池脚本 WSL 依赖清除 + 新增账号核查 — 2026-09-13

## 一、修复：`add-free-api-pool.mjs` 去除 `wsl.exe` 依赖

### 问题

该脚本（本会话实际用过的入池工具）用 `wsl.exe -e bash <脚本>` 执行 SSH。
**副作用**：`wsl.exe` 会拉起**整个 WSL 实例**，实测常驻 **2016 MB / 6 个进程**。

而本机 **SSH 直连已验证可用**，完全不需要借道 WSL。

### 修复

```js
// 优先 bash 直跑，避免拉起 WSL；仅在无 bash 时回退 wsl.exe
const out = execFileSync('bash', ['-c', `bash "${sh}"`], { encoding: 'utf8', timeout: 120000 });
// catch 内回退 wsl.exe（保可用性）
```

**同批修正**：`liunxddo/add-nvidia-nim-pool.mjs`（上一轮已完成同样修改）。

### 验证

| 检查项 | 结果 |
|---|---|
| bash 优先于 wsl | ✅（位置 4239 < 4454） |
| wsl 仅在 catch 回退内 | ✅ |
| 端到端幂等测试 | ✅ `INSERT 0 0`，池账号数 36→36 不变 |
| WSL 内存变化 | 测试前 2016 MB → 测试后 **69 MB**（未再拉起） |
| 临时脚本清理 | ✅ `finally { rmSync(sh) }` 正常，`_tmp_add_free.sh` 已删 |

> 注：我一度误报"临时文件残留"，实为**检查时脚本仍在运行**（竞态），复检确认已清理。

## 二、新增账号核查（33 → 37）

并行会话入池了 4 个新号（`columbina-free-10..13`）。我核查其配置是否合规：

| 项 | 结果 |
|---|---|
| `base_url` | ✅ `https://newapi.columbina.eu.org/v1` |
| `model_mapping.Tuan` | ✅ `grok-4.5` |
| `status` | ✅ `active` |
| `schedulable` | ✅ `true` |
| `concurrency` | ✅ **1**（符合免费档兜底铁律） |
| `group` | ✅ 全部在 **group 5** |

**关于 priority=50 的说明**：新号 34-37 的 priority 都是 50，与 xzt（32/33）不同，也与老 columbina（10-23）不同。
**这不是缺陷**——50 是 **DB 默认值**，且：
- 免费档一律低优先级，彼此同值属正常；
- **真正的选序读的是 Redis zset score（名次），不是 `accounts.priority`**（本仓历史已记录该结论）；
- 入池 SQL **刻意不写 priority**（走默认），避免与调度体系冲突。

## 三、调度链路健康确认

| 检查 | 结果 |
|---|---|
| `scheduler_outbox` 表存在 | ✅ |
| outbox 事件数 | **17301**（活跃，非空表） |
| 最近事件 | `account_last_used`（含账号 1/10/15 的时间戳）→ **调度器在正常工作** |
| 新号是否在 `account_groups` | ✅（31-37 全部 group 5） |

## 四、全池当前状态（37 账号）

```
总数 37 · active+schedulable 32 · error 5 · 曾限流 9
12h 成功率约 95%（详见 POOL-400-ROOTCAUSE.md）
```

**5 个 error 账号死因（全部为额度耗尽，非 bug）**：
#4 geeky-hello4am(403 余额) / #6 stepfun-jieyue(402 配额) / #14 xiaoen(403 配额) /
#17 siliconflow-free(402+429) / #18 pollinations-free(当日预算耗尽，次日自愈)

## 五、复现

```bash
node pool-health-check.mjs          # 全池只读体检
node add-free-api-pool.mjs          # 入池（现已不拉起 WSL）
```
