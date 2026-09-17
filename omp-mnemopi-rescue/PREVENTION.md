# mnemopi bank 损坏防复发（零升级方案）

## 根因
bank 名 = cwd 基名。所有从 /tmp 启动的 omp 会话共用 bank `tmp-1tpw73408x3e`。
多个并发 omp 进程写同一个 SQLite -> 损坏。

## 防复发（不升级 omp）
新建 herdr 工作区时，用 `--cwd` 指向项目目录：
```bash
herdr workspace create --cwd /mnt/d/tdsh/黄金 --label 黄金
herdr workspace create --cwd /mnt/e/盘库 --label 盘库
```
这样新工作区的 bank 名 = `黄金-<hash>` 或 `盘库-<hash>`，与 /tmp 隔离。

## 不要做的
- 不要从 /tmp 或 ~ 启动 omp（会降级到 /tmp 共享 bank）
- 不要设 `mnemopi.scoping = global`（会让所有会话挤进 default bank，更糟）
- 不要升级 omp（会爆炸）

## 已做的修复
- 损坏库已用逻辑重建修复（integrity ok）
- 恢复库已热替换到原路径（新会话读到干净库）
- 全量 448 行版本保存在 mnemopi-recovered-full448.db
- 损坏原件归档在 _corrupt-backup-20260918040041/
