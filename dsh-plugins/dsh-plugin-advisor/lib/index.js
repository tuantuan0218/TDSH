/**
 * dsh-plugin-advisor — 被动审核 (Advisor)
 *
 * 每轮审核主 agent 的输出并注入笔记，类似 OMP 的 --advisor 功能。
 * 用可见子代理（右侧泡泡）做审核，配极简人格（只审核、无工具）。
 *
 * 配置: D:/tdsh/dsh-home/.advisor-config.json (JSON，非 YAML)
 * { "enabled": true, "model": null, "provider": null }
 *
 * 注入服务: llm, sessions, systemPrompt, agents, subagents
 */
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const name = 'dsh-plugin-advisor'
export const inject = ['llm', 'sessions', 'systemPrompt', 'agents', 'subagents']

const PROBE = resolve(process.env.DSH_HOME || 'D:/tdsh/dsh-home', 'advisor-probe.log')
function tel(line) {
  try { appendFileSync(PROBE, new Date().toISOString() + '  ' + line + '\n') } catch {}
}

/** 已审核的分钟级 key */
const reviewed = new Set()

/** 审核指令 — 极简人格，不带工具，只审核 */
const ADVISOR_PERSONA = `你是一名严谨的审阅者(advisor)，被动旁听主 agent 的每一轮对话与工具调用。

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
- 有问题: 输出 "⚠️ [问题标题]\n[具体问题描述]\n[建议]"`

/** 从 session events 中提取对话上下文 */
function extractTurnContext(events, turn) {
  if (!Array.isArray(events)) return ''
  const parts = []
  for (const e of events) {
    if (e?.type === 'user/message') {
      const src = e.data?.message?.source
      if (src?.kind === 'plugin' && src?.plugin === 'dsh-plugin-advisor') continue
      for (const block of e.data?.message?.content || []) {
        if (block?.type === 'text') parts.push(`[用户] ${block.text}`)
      }
    } else if (e?.type === 'assistant/message') {
      const src2 = e.data?.message?.source
      if (src2?.kind === 'plugin' && src2?.plugin === 'dsh-plugin-advisor') continue
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

/** 加载 JSON 配置 */
function loadAdvisorConfig() {
  const path = resolve(process.env.DSH_HOME || 'D:/tdsh/dsh-home', '.advisor-config.json')
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
      const config = JSON.parse(raw)
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

/** 审核一轮对话：用可见子代理（右侧泡泡）做审核 */
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

  // 获取 provider/model
  let provider = config.provider
  let model = config.model
  const defaultModel = ctx.get('agentDefaultModel')
  const selection = defaultModel && typeof defaultModel.currentSelection === 'function'
    ? defaultModel.currentSelection()
    : undefined
  if (!provider) provider = selection?.provider || 'yunshu'
  if (!model) model = selection?.model || 'deepseek-v4-flash'

  // 获取 subagents 和 parent agent
  const subagents = ctx.get('subagents')
  const agents = ctx.get('agents')
  const parent = agents?.get(session.id)
  if (!subagents || !parent || typeof subagents.start !== 'function') {
    tel(`turn=${turn} skip: no subagents or parent agent`)
    return
  }

  const prompt = `【审核任务】以下是要审核的主 agent 对话轮次：\n\n${context}`

  tel(`turn=${turn} subagent start provider=${provider} model=${model} ctxLen=${context.length}`)

  try {
    const run = await subagents.start('spawn', {
      label: 'Advisor 审核',
      parent,
      persona: ADVISOR_PERSONA,  // 覆盖继承的 nong 人格
      toolFilter: { allow: ['read', 'grep', 'glob'] },  // 只读工具，避免做任务
      prompt: [{
        type: 'text',
        text: prompt,
      }],
      agentOptions: { provider, model },
      signal: AbortSignal.timeout(300000),
    })

    const result = await run.result
    const text = (result.output || [])
      .map(b => b?.type === 'text' ? b.text : '')
      .filter(Boolean)
      .join('\n')
      .trim()

    tel(`turn=${turn} subagent result len=${text.length} head=${text.slice(0, 80).replace(/\n/g, ' ')}. stopReason=${result.stopReason}`)

    // 把审核结果写进主会话作为可见 user/message (右侧泡泡)
    // 注意: 跳过 AI 审核结果中的内部思考（persona 指令部分），只用实际内容
    if (text && text !== 'OK' && typeof session.append === 'function') {
      try {
        session.append('user/message', {
          id: `advisor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          role: 'user',
          source: { kind: 'plugin', plugin: 'dsh-plugin-advisor' },
          content: [{ type: 'text', text: `⚠️ [Advisor 审核]\n${text}` }],
        }, { surfaceOp: 'append' })
        tel(`turn=${turn} session.append OK (len=${text.length}ch)`)
      } catch (appendErr) {
        tel(`turn=${turn} session.append failed: ${appendErr && appendErr.message}`)
      }
    }
  } catch (err) {
    tel(`turn=${turn} subagent error: ${err && err.message}`)
  }
}

export function apply(ctx) {
  tel('apply mounted (v19: subagent 右侧泡泡)')

  const cooldowns = new Map()

  ctx.on('session/event', (session, event) => {
    const sessionId = session?.id
    if (session?.meta?.origin === 'subagent'
        || String(sessionId || '').startsWith('session-advisor-')
        || session?.header?.parentSession) {
      return
    }

    // 精确记录
    if (event?.type === 'turn/start' || event?.type === 'turn/end' || event?.type === 'assistant/message') {
      const turn = event?.data?.turn
      let wrote = false
      if (event?.type === 'assistant/message') {
        const text = (event?.data?.message?.content || [])
          .filter(b => b?.type === 'text').map(b => b.text).join('')
        if (text.trim()) {
          tel(`turn=${turn} assistant msg ${text.length}ch: ${text.slice(0, 60).replace(/\n/g, ' ')}`)
          wrote = true
        }
      }
      if (event?.type === 'turn/start') { tel(`turn/start turn=${turn}`); wrote = true }
      if (!wrote) return
    }

    // ── 触发: turn/end (标准回合结束) ──
    if (event?.type === 'turn/end') {
      if (event.data?.reason?.kind !== 'completed') return
      const turn = event.data.turn
      const now = Date.now()
      const last = cooldowns.get(sessionId) || 0
      if (sessionId && now - last < 300000) return
      if (sessionId) cooldowns.set(sessionId, now)
      const key = `${sessionId}/${turn}`
      if (reviewed.has(key)) return
      reviewed.add(key)
      if (reviewed.size > 10000) reviewed.clear()
      tel(`turn/end trigger: ${key}`)
      setTimeout(() => {
        reviewTurn(ctx, session, turn).catch(err => {
          tel(`reviewTurn threw: ${err && err.message}`)
        })
      }, 0)
    }

    // ── 触发: assistant/message (nong 连续循环) ──
    if (event?.type === 'assistant/message') {
      const now = Date.now()
      const last = cooldowns.get(sessionId) || 0
      if (now - last < 300000) return
      cooldowns.set(sessionId, now)
      if (cooldowns.size > 1000) cooldowns.clear()

      const minuteKey = Math.floor(now / 60000)
      const key = `${sessionId}/assistant/${minuteKey}`
      if (reviewed.has(key)) return
      reviewed.add(key)

      tel(`assistant msg trigger: ${sessionId} (cooldown=${now - last}ms)`)
      setTimeout(() => {
        reviewTurn(ctx, session, 0).catch(err => {
          tel(`reviewTurn threw: ${err && err.message}`)
        })
      }, 0)
    }

    // ── 触发: tool/call (nong 连续循环, 无 assistant/message) ──
    if (event?.type === 'tool/call') {
      if (!sessionId) return
      const now = Date.now()
      const last = cooldowns.get(sessionId) || 0
      if (now - last < 300000) return
      cooldowns.set(sessionId, now)
      if (cooldowns.size > 1000) cooldowns.clear()

      const minuteKey = Math.floor(now / 60000)
      const key = `${sessionId}/toolcall/${minuteKey}`
      if (reviewed.has(key)) return
      reviewed.add(key)

      tel(`tool/call trigger: ${sessionId} (cooldown=${now - last}ms)`)
      setTimeout(() => {
        reviewTurn(ctx, session, 0).catch(err => {
          tel(`reviewTurn threw: ${err && err.message}`)
        })
      }, 0)
    }
  })
}