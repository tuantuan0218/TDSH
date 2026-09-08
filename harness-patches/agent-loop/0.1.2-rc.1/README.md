# agent-loop auto-continue 补丁（适配 dsh-v0.1.2-rc.1）

## 背景

dsh 的 `ReactLoopAgent` 在模型产出无工具调用的消息时会 yield（`if (turnEnds && this.inbox.nextStep.length === 0) break`）。
本补丁把该处改为注入 `[自动续跑]` 消息继续循环（GPT 风格永不 yield），是 nong「弄就行了」模式无限推进的核心依赖。

## 交付物

| 文件 | 说明 |
|---|---|
| `lib-index.js` | 补丁后的完整 `packages/core/agent-loop/lib/index.js`（基于官方 0.1.2-rc.1，1398 行） |
| `autocontinue.patch` | unified diff（可用于 git apply / patch -p1） |
| `apply.sh` | 一键应用（自动备份 + 覆盖 3 个候选物理位置） |
| `revert.sh` | 一键回滚（从备份还原） |

## 与旧补丁（rc.5 版）的差异

- 0.1.2-rc.1 在 break 前新增 `agent/turn-stopping` 事件分发（保留不动）；
  循环开头新增 `phase.step === 0` 空消息防御分支（保留不动——补丁只在 step>=1 后注入，不冲突）。
- 注入逻辑与 2026-08-22 生产验证版（133 分钟 / 21 个目标 / 零停止）完全一致：
  `splice 注入 → turnEnds=null → target="next-step" → continue`。

## 使用

```bash
# 先升级内核到 0.1.2-rc.1（见升级清单），然后：
cd /mnt/d/tdsh
bash harness-patches/agent-loop/0.1.2-rc.1/apply.sh
# 重启 TDSH 生效

# 回滚：
bash harness-patches/agent-loop/0.1.2-rc.1/revert.sh
```

## 灾难恢复（误操作时）

若 agent-loop 文件被弄坏（版本混装 / 语法错误），可从 TDSH 自带打包恢复原始 rc.5 文件：

```bash
mkdir -p /tmp/restore
tar -xzf /mnt/d/tdsh/resources/dsh-repo.tar.gz -C /tmp/restore ./packages/core/agent-loop/lib/index.js
cp /tmp/restore/packages/core/agent-loop/lib/index.js /mnt/d/tdsh/resources/app/repo/packages/core/agent-loop/lib/index.js
cp /tmp/restore/packages/core/agent-loop/lib/index.js "/mnt/d/tdsh/resources/app/repo/apps/cli/node_modules/@deepseek-ai/dsh-base/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js"
```

注意：`dsh-home/profiles/node_modules/@deepseek-ai/dsh-agent-loop`（含 C 盘 `.dsh` 的同名路径）是指向
`repo/apps/cli/.../dsh-agent-loop` 的符号链接，只需恢复上面两个物理位置即可。

## 注意事项

- 仅适用于官方 dsh-v0.1.2-rc.1 内核。
- 升级前（当前 rc.5）该补丁**未生效**（运行版是原始 break 逻辑），无需回滚。
- 若升到 alpha 0.1.3+/0.1.5（Session V2/V3），代码又变，需重新适配本补丁。
