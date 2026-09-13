# 个人模型分身（团团数字分身）— 项目指针

> 本目录（`D:\tdsh\个人模型`）为**占位入口**，不存放资产。所有真实产物与权威文档在别处，避免下次会话/agent 在此空转。

## 权威状态文件（先读这个）

- **`J:\minicpm5-clone\交接文档.md`** ← 唯一权威（§一~§九 为 v0.2 已交付事实，§十 为 v0.2b/v4 增量，§11 为当前权威目录树）
- **`J:\minicpm5-clone\corpus\v0.2b\重训_runbook_v0.2b.md`** ← 单一决策档案（重训一键命令 + 两条数据路线 + L1-L4 受限项 + 验收对照）

## 资产位置

| 内容 | 路径 |
|---|---|
| 权重（10.4GB） | `J:\minicpm5-clone\models\`（v0.1/v0.2 各 f16+Q4_K_M） |
| 语料（永久资产） | `J:\minicpm5-clone\corpus\`（train.jsonl 3558 / v0.2b 2481 / v4 3018） |
| 脚本与管道 | `J:\minicpm5-clone\scripts\`（build_corpus_v3/v4、lora_sft、merge、export_gguf、e2e_verify） |
| 启动 | 双击 `J:\minicpm5-clone\启动团团分身.cmd`（v0.2，起 llama-server:8087） |
| WSL 训练环境 | `/opt/minicpm5-env` + `/opt/LLaMA-Factory` + `/opt/llama.cpp` + `/root/corpus/*` |

## 当前一句话状态（2026-09-13）

**数据 + 脚本 + 验收 + 备份 + runbook 全齐，重训无技术障碍，卡在"等团团点头"。**
服务 8087 停止中（用户要求释放电脑，产物保留盘上）。

## 受限项（需用户拍板，agent 不擅动）

- **L1 重训 v0.2b/v4**（25min GPU）
- **L2 产物策略**（覆盖 v0.2 / 并列保留 / 先验收再定）
- **L3 v0.3 真扩量**（需用户重新导出第二大脑 / hanako / 新会话；现源池长表达天花板 ~21%，cap 翻倍仅 +16.9%）
- **L4 Ollama 接入**（默认装 C 盘触红线；零安装替代已可用）

## GitHub 备份

私有仓 `tuantuan0218/personal-model`（本地仓 `J:\minicpm5-clone`，token 内嵌 remote 免弹窗）。
