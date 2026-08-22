# Harness Patches: agent-loop auto-continue

## 修改原因
dsh 的 `ReactLoopAgent` 在模型产出无工具调用的消息时会 yield（停止等待用户）。
GPT/Claude 的 agentic harness 不会 yield——它们永远 re-invoke 模型直到显式停止。

## 修改文件
- `packages/core/agent-loop/src/agent.ts` — 源 TypeScript
- `packages/core/agent-loop/lib/index.js` — 编译入口（运行时实际加载）
- `packages/core/agent-loop/lib/types/agent.js` — 类型声明（备份）

## 修改内容
在 `turn()` 方法中，当 `stepEnd` 为 `{ kind: 'completed' }`（模型无工具调用）且 inbox 为空时：
1. 注入 `[自动续跑]` 消息到 `inbox.nextStep`
2. 重置 `turnEnds = null`，继续循环
3. 只注入一次（`autoContinued` 标志）；若模型仍不调用工具，放行 yield

## 安装位置
`D:/tdsh/resources/app/repo/packages/core/agent-loop/lib/index.js`
（bundle/base 的 node_modules 是同一文件的硬链接）

## 恢复
替换回原始文件即可。原始文件可从 tuantuan0218/TDSH 仓库的 `@deepseek-ai/dsh-agent-loop` 包获取。