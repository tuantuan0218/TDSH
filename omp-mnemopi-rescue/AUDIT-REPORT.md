# mnemopi bank 健康审计报告

日期: 2026-09-18 07:06
脚本: `bank-audit.sh`（只读，可重复运行）
范围: `/root/.omp/agent/memories/mnemopi/banks/` 全部 8 个 bank

---

## 1. 审计结果：全部健康

| bank | 大小 | integrity | working_memory | 持有者 |
|---|---|---|---|---|
| Administrator-24bcfjq7dt76x | 14.4 MB | **ok** | 255 | free |
| OH-WorkSpace-137b7en5e6ntg | 0.4 MB | **ok** | 0 | free |
| agent-1m5hungk0yayc | 0.0 MB | **ok** | 1 | free |
| default-c8rgibd8h0ws | 0.4 MB | **ok** | 0 | free |
| harness-20awborcnmves | 0.4 MB | **ok** | 1 | free |
| nodejs-y2wz1j3sg174 | 0.0 MB | **ok** | 0 | free |
| sub2api-2ruth3lt1cvet | 0.0 MB | **ok** | 0 | free |
| **tmp-1tpw73408x3e** | 15.2 MB | **ok** | 80 | free |

**汇总：8 个库，0 损坏，0 多写者争用。**

修复库 `tmp-1tpw73408x3e` 已确认 `integrity = ok`，且当前**无进程持有**（free）。

---

## 2. 修复安全性：已用 inode 级证据证实

两个仍存活的 `/tmp` 进程（248241、271312）持有的**不是活库**：

| | inode | 说明 |
|---|---|---|
| 活库 `mnemopi.db` | **622106** | 新会话读写此库（干净） |
| 归档库 `_corrupt-backup-.../mnemopi.db` | **55768** | 两进程持有的旧库（已废弃） |

时间线自洽：
- 04:00:41 归档创建
- 05:37:47 活库替换
- 两进程启动于 23:44 / 01:39，**早于归档和替换**

**结论：修复是安全的。** 这两个进程写的是已废弃的旧 inode，活库不受其影响。
（`fuser` 只按路径匹配，因此先前"活库被 2 进程持有"的读数实为归档库，现已澄清。）

---

## 3. 残余复发风险

| 风险项 | 现状 | 影响 |
|---|---|---|
| 两个 `/tmp` 进程仍在运行 | pid 248241、271312 | 退出时会对**归档库**做 WAL checkpoint，不碰活库 |
| 若再开 `/tmp` 新会话 | 会打开**活库** | 与既有 `/tmp` 会话形成双写者 → **可能再次损坏** |
| 4 个 herdr 工作区 cwd=`/tmp` | w9:p1、w9:pA、wE:p1、wG:p1、wP:p1 | 同 cwd 必共享 bank |

**根因未消除**：只要有 ≥2 个 omp 会话的 cwd 同为 `/tmp`，它们就共享 `tmp-1tpw73408x3e`。
修复只清除了损坏后果，未改变"共享"这一结构性条件。

---

## 4. 防复发（零升级，已实测有效）

实测证据：`--cwd` 到项目目录会产生**独立 bank**。
- `cwd=/tmp/_envtest5/proj` → bank `proj-30p907yox161u`（独立）
- `cwd=/tmp` → bank `tmp-1tpw73408x3e`（共享）

### 做法
新建 herdr 工作区时带 `--cwd`：
```bash
herdr workspace create --cwd /mnt/d/tdsh/黄金 --label 黄金
herdr workspace create --cwd /mnt/e/盘库  --label 盘库
```
进去后直接打 `omp` 即可——bank 名变为 `<目录名>-<hash>`，与其他项目隔离。

### 不要做
- ❌ 从 `/tmp` 或 `~` 启动 omp（会降级到 `/tmp` 共享 bank）
- ❌ 设 `mnemopi.scoping = global`（会让所有会话挤进 `default` bank，争用更严重）
- ❌ 升级 omp（用户明确要求不升级）

### 已存在的工作区
cwd=`/tmp` 的旧工作区不必改动，只需**避免在其中同时运行两个 omp**（单写者不会损坏）。

---

## 5. 复现方式

```bash
bash /mnt/d/tdsh/omp-mnemopi-rescue/bank-audit.sh
```
输出：每个 bank 的 integrity / 行数 / 持有者，以及所有 omp 进程的 cwd→bank 映射。
