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
3. **无限次注入**（无 `autoContinued` 守卫），直到模型响应——GPT 风格永不 yield

## 安装位置
`D:/tdsh/resources/app/repo/packages/core/agent-loop/lib/index.js`
（bundle/base 的 node_modules 是同一文件的硬链接）

## 验证结果（2026-08-22）
会话 `49dcf536`（deepseek-v4-flash）连续自主运行 **133+ 分钟，21 个目标全部创建并完成，零停止**。
真实工作包含：修复炉石 JVM idle-halt、GameplayModeStrategy 投降回归、清理 .trash 11GB、创建 UUMit 技能赚 UT 等。

### 演进历史
1. **初版带 `autoContinued` 守卫**：只自动续跑一次，模型不响应仍会停（旧会话 35 分钟停在 123 步）
2. **当前无守卫版**：无限次注入 `[自动续跑]`，模型响应后继续调工具或 `complete_goal` → 触发 `goal-complete-inject` → MCTS → 新目标，循环永不中断

## 恢复
替换回原始文件即可。原始文件可从 tuantuan0218/TDSH 仓库的 `@deepseek-ai/dsh-agent-loop` 包获取。