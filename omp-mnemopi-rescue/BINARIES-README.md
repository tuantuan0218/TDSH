# mnemopi 恢复库（不入 git）

这些二进制是 SQLite 记忆库，**含历史密钥明文**（GitHub secret scanning 会拦截推送），
因此留在本地、不进版本库。

| 文件 | 大小 | 说明 |
|---|---|---|
| `mnemopi-recovered.db` | 10.6 MB | 已热替换到活库路径的恢复版本（integrity ok） |
| `mnemopi-recovered-full448.db` | 10.6 MB | 全量 448 行版本（含 24h TTL 被 trim 前的行） |
| `tmp-bank-snapshot.db` | 16.2 MB | 损坏发生时的原始快照 |

## 活库位置（WSL）
```
/root/.omp/agent/memories/mnemopi/banks/tmp-1tpw73408x3e/mnemopi.db
```
损坏原件归档于同目录 `_corrupt-backup-20260918040041/`。

## 需要回灌时
```bash
cp /mnt/d/tdsh/omp-mnemopi-rescue/mnemopi-recovered-full448.db \
   /root/.omp/agent/memories/mnemopi/banks/tmp-1tpw73408x3e/mnemopi.db
```
回灌前确认无 omp 进程持有该库（`fuser <db>`）。
