/**
 * dsh-plugin-advisor — 被动审核 (Advisor)
 *
 * 每轮审核主 agent 的输出并注入笔记，类似 OMP 的 --advisor 功能。
 * 监听 turn/end 事件，收集最近回合上下文，调用 LLM 做审核，
 * 发现问题时以 user/message 注入笔记。
 *
 * 配置: D:/tdsh/dsh-home/.advisor-config.json (JSON，非 YAML)
 * { "enabled": true, "model": null, "provider": null }
 *
 * 注入服务: llm, sessions, systemPrompt, agents
 */
import { createUserMessage, BlockAssembler } from '@deepseek-ai/dsh-llm'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const name = 'dsh-plugin-advisor'
export const inject = ['llm', 'sessions', 'systemPrompt', 'agents']

/** 已审核的回合 (sessionId/turn) */
const reviewed = new Set()

/** 审核指令模板 */
const ADVISOR_INSTRUCTION = `你是一名严谨的审阅者(advisor)，被动旁听主 agent 的每一轮对话与工具调用。

在每轮结束时审核以下内容：
1. 是否有明显错误、遗漏或安全隐患
2. 是否有更好的实现路径
3. 全局规则遵守（C盘落盘检查、禁止Windows计划任务等）
4. 逻辑是否完整、边界是否处理

仅在发现确实值得注意的问题时输出审核笔记。一切正常就输出 "OK"。
笔记要简短、具体，附带可操作的建议（不是泛泛的说教）。
关于具体项目/功能的细节判断留给主 agent，你只关注上述审核维度。

输出格式：
- 没有问题: 只输出 "OK"
- 有问题: 输出 "⚠️ [问题标题]\\n[具体问题描述]\\n[建议]"`

/**
 * 从 session events 中提取最近一轮的对话上下文。
 */
function extractTurnContext(events, turn) {
  const parts = []
  for (const e of events) {
    if (e.type === 'user/message') {
      for (const block of e.data.message?.content || []) {
        if (block.type === 'text') parts.push(`[用户] ${block.text}`)
      }
    } else if (e.type === 'assistant/message') {
      for (const block of e.data.message?.content || []) {
        if (block.type === 'text') parts.push(`[助手] ${block.text}`)
      }
    } else if (e.type === 'tool/call') {
      parts.push(`[工具调用] ${e.data.name}(${JSON.stringify(e.data.arguments)})`)
    } else if (e.type === 'tool/result') {
      const resultText = e.data.message?.content?.[0]?.text
      if (resultText) {
        parts.push(`[工具结果] ${resultText.slice(0, 500)}${resultText.length > 500 ? '...' : ''}`)
      }
    }
  }
  return parts.join('\n')
}

/**
 * 加载 JSON 配置
 */
function loadAdvisorConfig() {
  const paths = [
    resolve(process.env.DSH_HOME || 'D:/tdsh/dsh-home', '.advisor-config.json'),
  ]
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8')
        const config = JSON.parse(raw)
        return {
          enabled: config.enabled !== false,
          model: config.model || null,
          provider: config.provider || null,
        }
      } catch { /* 跳过不可读文件 */ }
    }
  }
  return { enabled: true, model: null, provider: null }
}

/**
 * 审核一轮对话。
 */
async function reviewTurn(ctx, session, turn) {
  const context = extractTurnContext(session.events, turn)
  if (!context.trim()) return

  const config = loadAdvisorConfig()
  if (!config.enabled) return

  // 获取 model
  const defaultModel = ctx.get('agentDefaultModel')
  const selection = defaultModel?.currentSelection()
  const provider = config.provider || selection?.provider || 'yunshu'
  const model = config.model || selection?.model || 'deepseek-v4-flash'

  const messages = [
    createUserMessage({
      content: [{ type: 'text', text: `请审核以下对话轮次：\n\n${context}` }],
      source: { kind: 'plugin', plugin: 'dsh-plugin-advisor' },
    }),
  ]

  // 调用 LLM 审核
  const assembler = new BlockAssembler()
  try {
    for await (const chunk of ctx.llm.stream({
      provider,
      model,
      system: ADVISOR_INSTRUCTION,
      messages,
      sessionId: session.id,
      purpose: 'advisor-review',
      maxTokens: 1024,
    })) {
      assembler.push(chunk)
    }
  } catch (err) {
    return // 静默跳过
  }

  const reviewText = assembler.blocks()
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  if (!reviewText || reviewText === 'OK') return

  // 注入笔记 (推迟到下一 tick 避免重入)
  setTimeout(() => {
    try {
      session.append('user/message',
        createUserMessage({
          content: [{ type: 'text', text: `[Advisor 审核]\n${reviewText}` }],
          source: { kind: 'plugin', plugin: 'dsh-plugin-advisor' },
        }),
        { surfaceOp: 'append' },
      )
    } catch { /* 静默跳过 */ }
  }, 0)
}

export function apply(ctx) {
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    if (event.data.reason?.kind !== 'completed') return
    const turn = event.data.turn
    const key = `${session.id}/${turn}`
    if (reviewed.has(key)) return
    reviewed.add(key)
    if (reviewed.size > 10000) reviewed.clear()

    setTimeout(() => {
      reviewTurn(ctx, session, turn).catch(() => {})
    }, 0)
  })
}