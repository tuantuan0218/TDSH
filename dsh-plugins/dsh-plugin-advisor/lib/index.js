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
 *
 * 防循环: 若最近一条 user/message 来自本插件 (注入的笔记)，
 * 则该回合由笔记触发 → 跳过审核。否则 笔记→回复→审核→再笔记 无界循环。
 */
import { createUserMessage, BlockAssembler } from '@deepseek-ai/dsh-llm'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const name = 'dsh-plugin-advisor'
export const inject = ['llm', 'sessions', 'systemPrompt', 'agents']

const PROBE = resolve(process.env.DSH_HOME || 'D:/tdsh/dsh-home', 'advisor-probe.log')
function tel(line) {
  try { appendFileSync(PROBE, new Date().toISOString() + '  ' + line + '\n') } catch {}
}

/** 已审核的回合 (sessionId/turn) */
const reviewed = new Set()

/** 审核指令模板 */
const ADVISOR_INSTRUCTION = `你是一名严谨的审阅者(advisor)，被动旁听主 agent 的每一轮对话与工具调用。

在每轮结束时审核以下内容：
1. 是否有明显错误、遗漏或安全隐患
2. 是否有更好的实现路径
3. 全局规则遵守（C盘落盘检查、禁止Windows计划任务等）
4. 逻辑是否完整、边界是否处理
5. 冗余与效率：是否重复回答同一内容多次、是否调用了多余的工具、是否答非所问

仅在发现确实值得注意的问题时输出审核笔记。一切正常就输出 "OK"。
笔记要简短、具体，附带可操作的建议（不是泛泛的说教）。
关于具体项目/功能的细节判断留给主 agent，你只关注上述审核维度。

输出格式：
- 没有问题: 只输出 "OK"
- 有问题: 输出 "⚠️ [问题标题]\\n[具体问题描述]\\n[建议]"`

/** 从 session events 中提取对话上下文。 */
function extractTurnContext(events, turn) {
  if (!Array.isArray(events)) return ''
  const parts = []
  for (const e of events) {
    if (e?.type === 'user/message') {
      const src = e.data?.message?.source
      // 跳过本插件注入的笔记: 它本身就是审核产物, 不喂回上下文
      if (src?.kind === 'plugin' && src?.plugin === 'dsh-plugin-advisor') continue
      for (const block of e.data?.message?.content || []) {
        if (block?.type === 'text') parts.push(`[用户] ${block.text}`)
      }
    } else if (e?.type === 'assistant/message') {
      for (const block of e.data?.message?.content || []) {
        if (block?.type === 'text') parts.push(`[助手] ${block.text}`)
      }
    } else if (e?.type === 'tool/call') {
      parts.push(`[工具调用] ${e.data?.name}(${JSON.stringify(e.data?.arguments)})`)
    } else if (e?.type === 'tool/result') {
      const resultText = e.data?.message?.content?.[0]?.text
      if (resultText) {
        parts.push(`[工具结果] ${resultText.slice(0, 500)}${resultText.length > 500 ? '...' : ''}`)
      }
    }
  }
  return parts.join('\n')
}

/** 触发审核的回合是否为「本插件笔记触发」— 若是则跳过 (防循环). */
function isSelfTriggered(events) {
  if (!Array.isArray(events)) return false
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e?.type === 'user/message') {
      const src = e.data?.message?.source
      if (src?.kind === 'plugin' && src?.plugin === 'dsh-plugin-advisor') return true
      return false // 最近一条用户消息不是我们的 → 不是自触发
    }
  }
  return false
}

/** 加载 JSON 配置 */
function loadAdvisorConfig() {
  const path = resolve(process.env.DSH_HOME || 'D:/tdsh/dsh-home', '.advisor-config.json')
  try {
    if (existsSync(path)) {
      const config = JSON.parse(readFileSync(path, 'utf-8'))
      return {
        enabled: config.enabled !== false,
        model: config.model || null,
        provider: config.provider || null,
      }
    }
  } catch (err) {
    tel('config load failed: ' + (err && err.message))
  }
  return { enabled: true, model: null, provider: null }
}

/** 审核一轮对话：收集上下文 → LLM 审核 → 有问题注入笔记 */
async function reviewTurn(ctx, session, turn) {
  const context = extractTurnContext(session?.events, turn)
  if (!context.trim()) {
    tel(`turn=${turn} skip: empty context`)
    return
  }

  const config = loadAdvisorConfig()
  if (!config.enabled) {
    tel(`turn=${turn} skip: disabled`)
    return
  }

  if (isSelfTriggered(session?.events)) {
    tel(`turn=${turn} skip: self-triggered (loop guard)`)
    return
  }

  // 获取 model (agentDefaultModel 可能不存在 → 回退配置/常量)
  let provider = config.provider
  let model = config.model
  const defaultModel = ctx.get('agentDefaultModel')
  const selection = defaultModel && typeof defaultModel.currentSelection === 'function'
    ? defaultModel.currentSelection()
    : undefined
  if (!provider) provider = selection?.provider || 'yunshu'
  if (!model) model = selection?.model || 'deepseek-v4-flash'

  tel(`turn=${turn} review start provider=${provider} model=${model} ctxLen=${context.length}`)

  const messages = [
    createUserMessage({
      content: [{ type: 'text', text: `请审核以下对话轮次：\n\n${context}` }],
      source: { kind: 'plugin', plugin: 'dsh-plugin-advisor' },
    }),
  ]

  const assembler = new BlockAssembler()
  let reviewText = ''
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
    tel(`turn=${turn} review LLM error: ${err && err.message}`)
    return
  }

  reviewText = assembler.blocks()
    .filter(b => b?.type === 'text' || b?.type === 'reasoning')
    .map(b => b.text)
    .join('')
    .trim()
  tel(`turn=${turn} review result len=${reviewText.length} head=${reviewText.slice(0, 60).replace(/\n/g, ' ')}`)

  if (!reviewText || reviewText === 'OK') return

  // 注入笔记 (推迟到下一 tick 避免重入)
  setTimeout(() => {
    try {
      // 摘要: 取审核结果前 80 字符 (UI 折叠行显示)
      const summary = reviewText.slice(0, 80).replace(/\n/g, ' ')
      session.append('user/message',
        createUserMessage({
          content: [{ type: 'text', text: `[Advisor 审核]\n${reviewText}` }],
          source: {
            kind: 'plugin',
            plugin: 'dsh-plugin-advisor',
            form: 'notice',    // ← notice 形式: 折叠行显示摘要, 展开全文
            summary,
          },
        }),
        { surfaceOp: 'append' },
      )
      tel(`turn=${turn} note INJECTED (summary=${summary.slice(0, 40)})`)
    } catch (err) {
      tel(`turn=${turn} inject failed: ${err && err.message}`)
    }
  }, 0)
}

export function apply(ctx) {
  tel('apply mounted (v9: notice form + summary)')
  // nong 循环模式下, turn/end 可能永不触发, 用 assistant/message 做辅助触发
  const cooldowns = new Map() // sessionId -> lastReviewMs

  ctx.on('session/event', (session, event) => {
    // 精确记录: 只记回合生命周期与审核触发点, 避免 probe 爆炸
    if (event?.type === 'turn/start' || event?.type === 'turn/end' || event?.type === 'assistant/message') {
      const reason = event?.data?.reason?.kind
      const turn = event?.data?.turn
      let wrote = false
      if (event?.type === 'assistant/message') {
        const text = (event?.data?.message?.content || [])
          .filter(b => b?.type === 'text').map(b => b.text).join('')
        if (text.trim()) {
          tel(`turn=${turn} assistant msg ${text.length}ch: ${text.slice(0, 80).replace(/\n/g, ' ')}`)
          wrote = true
        }
      }
      if (event?.type === 'turn/start') { tel(`turn/start turn=${turn}`); wrote = true }
      if (event?.type === 'turn/end') { tel(`turn/END turn=${turn} reason=${reason}`); wrote = true }
      if (!wrote) return
    }

    // ── 第一触发: turn/end (标准回合结束) ────────────────────────────
    if (event?.type === 'turn/end') {
      if (event.data?.reason?.kind !== 'completed') return
      const turn = event.data.turn
      // 60s 冷却: 若 assistant/message 已审核过本轮, 跳过 (防重复注入)
      const sessionId = session?.id
      const now = Date.now()
      const last = cooldowns.get(sessionId) || 0
      if (sessionId && now - last < 60000) {
        tel(`turn/end skip: cooldown ${now - last}ms for ${sessionId}`)
        return
      }
      if (sessionId) cooldowns.set(sessionId, now)
      const key = `${sessionId}/${turn}`
      if (reviewed.has(key)) return
      reviewed.add(key)
      if (reviewed.size > 10000) reviewed.clear()
      tel(`turn/end seen: ${key}`)
      setTimeout(() => {
        reviewTurn(ctx, session, turn).catch(err => {
          tel(`reviewTurn threw: ${err && err.message}`)
        })
      }, 0)
    }

    // ── 第二触发: assistant/message (nong 循环模式, turn 永不结束) ──
    if (event?.type === 'assistant/message') {
      const sessionId = session?.id
      if (!sessionId) return
      const now = Date.now()
      const last = cooldowns.get(sessionId) || 0
      if (now - last < 60000) return // 60s 冷却
      cooldowns.set(sessionId, now)
      if (cooldowns.size > 1000) cooldowns.clear()

      // 去重 key: 每分钟一次
      const minuteKey = Math.floor(now / 60000)
      const key = `${sessionId}/assistant/${minuteKey}`
      if (reviewed.has(key)) return
      reviewed.add(key)

      tel(`assistant msg trigger review: ${sessionId} (cooldown=${now - last}ms)`)
      setTimeout(() => {
        reviewTurn(ctx, session, 0).catch(err => {
          tel(`reviewTurn threw: ${err && err.message}`)
        })
      }, 0)
    }
  })
}