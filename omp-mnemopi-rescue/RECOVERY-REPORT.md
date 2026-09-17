# mnemopi bank 损坏：根因分析与恢复报告

日期: 2026-09-18
处理对象: /root/.omp/agent/memories/mnemopi/banks/tmp-1tpw73408x3e/mnemopi.db
上游仓库: can1357/oh-my-pi (omp v17.3.0)

## 1. 根因（第一性原理）

**bank 按 cwd 基名派生，所有从 /tmp 启动的 omp 会话共用同一个 SQLite 库。**

- 上游源码 `packages/mnemopi/src/core/banks.ts` 的 `BankManager.getBankDbPath()`：
  bank 名 = cwd 基名，路径 = `<dataDir>/banks/<name>/mnemopi.db`
- 实测 8 个 bank 目录名与 8 个 cwd 基名一一对应
- `/tmp` 是 omp 在 home 目录启动时的自动降级目录，因此**所有此类会话都撞进同一个 bank**
- 该 bank 对应 **185 个历史会话文件**；其他 bank 仅 0~2 个

**并发写者实证**：`fuser` 显示损坏库同时被 **2 个 omp 进程**（pid 248241、271312，cwd 均为 /tmp）持有。

**SQLite 配置本身正确但不足以防护**：
- `db.ts` 的 `enablePragmas()`: `journal_mode=WAL`、`busy_timeout=5000`、`foreign_keys=ON`
- WAL 只能抵御短事务竞争，扛不住大量进程在 checkpoint 与并发写之间反复撕扯

**损坏是局部的**：`integrity_check` 报 `Tree 47 page 21`，仅单页损坏，非全文件失效。

## 2. 官方是否有自愈逻辑？——没有

- 二进制 `strings` 检索：无 mnemopi 损坏自愈代码
- 上游 `test/mnemopi-bank-derivation.test.ts` 用例名明确：
  `"tolerates a corrupt bank database without throwing"`
  → 官方策略是**静默跳过损坏 bank**，不修复、不告警
- `CHANGELOG` 中的 quarantine 机制只针对 embedding 模型缓存，不针对 bank 数据库

结论：**上游不会自愈，必须人工恢复。**

## 3. 恢复方法（已验证）

`.recover` 在本机不可用（sqlite 3.45.1 未编译 `sqlite_dbpage`）：
`sql error: no such table: sqlite_dbpage`

改用**逻辑重建**（纯 Python，无需 sqlite_dbpage）：
1. 只读快照（`immutable=1`），绝不触碰活库
2. `text_factory = bytes` 绕过坏字节导致的 UTF-8 解码中断
3. 复制全部 schema（跳过 FTS5 影子表，交由 FTS5 自行管理）
4. 逐表逐行复制数据，单行失败即跳过
5. 对每个 FTS5 虚表执行 `INSERT INTO <v>(<v>) VALUES('rebuild')` 重建索引

## 4. 结果验证

| 项目 | 损坏库 | 恢复库 |
|---|---|---|
| integrity_check | malformed (Tree 47 page 21) | **ok** |
| working_memory | 读取失败 | 448 |
| facts | 可读 | 288 |
| triples | 可读 | 2058 |
| annotations | 可读 | 894 |
| memoria_facts | 可读 | 287 |
| memoria_kg | 可读 | 115 |
| memory_embeddings | **malformed** | 3（1 行不可读丢弃） |
| FTS5 索引 | 部分不可用 | 3 个全部 rebuild OK |
| foreign_key_check | - | ok |

- 总恢复行数: 4197
- FTS 检索实测通过（`fts_working` match 'the' → 29 行）

## 5. 部署步骤（需用户执行，且需先停用该 bank 的写入）

**未执行**——用户明确要求不要动正在工作的盘库 omp。

```bash
# 0) 确认没有 omp 进程持有该库
fuser -v /root/.omp/agent/memories/mnemopi/banks/tmp-1tpw73408x3e/mnemopi.db

# 1) 备份原件
cd /root/.omp/agent/memories/mnemopi/banks/tmp-1tpw73408x3e
cp -a mnemopi.db mnemopi.db.corrupt-$(date +%s)
rm -f mnemopi.db-wal mnemopi.db-shm

# 2) 替换为恢复库
cp /mnt/d/tdsh/omp-mnemopi-rescue/mnemopi-recovered.db ./mnemopi.db

# 3) 校验
sqlite3 mnemopi.db "PRAGMA integrity_check;"
```

## 6. 防复发建议

1. **避免从 /tmp 启动 omp**：用 `omp --cwd <项目目录>`，使 bank 按项目隔离
2. 或固定单 bank：设置 `mnemopi.scoping = global`
3. 关键项目用独立 bank：`mnemopi.bank = <name>`
4. 不要把 `/tmp` 当作长期工作目录（185 个会话共享一个库是结构性风险）

---

# 附：实际部署记录（2026-09-18 04:00）

## 部署方式：热替换（未杀死任何进程）

采用 **inode 替换** 而非 kill + 重启：

1. 归档损坏库：`mv mnemopi.db{,-wal,-shm} _corrupt-backup-<ts>/`
   —— `mv` 保留原 inode，运行中进程的文件句柄继续有效，不受影响
2. 将恢复库 `cp` 到原路径（新 inode 622106）
3. 结果：两个持有者进程（pid 248241、271312）**始终存活**

原理：运行中的进程通过 fd 绑定旧 inode，路径换新文件后它们继续写旧 inode（无害），
新启动的进程则读到干净库。**零打断。**

## 验证结果

| 判据 | 部署前 | 部署后 |
|---|---|---|
| integrity_check | malformed | **ok** |
| malformed 报错次数（新会话） | 持续刷 | **0** |
| 新会话端到端 | - | 返回 `MEMORY-OK`，退出码 0 |
| foreign_key_check | - | ok |
| FTS5 检索 | 部分不可用 | 正常（match 'the' → 29 行） |
| 持有者进程 | 2 个存活 | **2 个仍存活** |

## 关于 working_memory 448 → 88 行（非数据丢失）

这是 OMP 的**设计行为**，源码依据：

- `packages/mnemopi/src/core/beam/store.ts:233` `trimWorkingMemory()`
- `state.ts:649` 注释明确：`remember` 每次写入都会 trim 掉超过
  `workingMemoryTtlHours`（默认 **24h**）的未合并行

实测证实：被 trim 的 361 行**全部**落在 24h 分界之前
（最晚 09-16 19:31 < 分界 09-16 20:08），且全部为 `unconsolidated`。

**全量 448 行的版本已另存为 `mnemopi-recovered-full448.db`**，需要回灌可用。
