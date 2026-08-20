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
import { createUserMessage, createMessage, createToolResultMessage, BlockAssembler } from '@deepseek-ai/dsh-llm'
import { readFileSync, existsSync, appendFileSync, statSync, readdirSync } from 'node:fs'
import { resolve, join, dirname, extname, isAbsolute } from 'node:path'

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

仅当主 agent 的回复涉及具体文件改动或需要验证时，使用工具 read/grep/glob 查证
（例如确认改动真的生效、是否有遗漏的调用点）。只在确实需要验证时调用，不要无事调用工具。

仅在发现确实值得注意的问题时输出审核笔记。一切正常就输出 "OK"。
笔记要简短、具体，附带可操作的建议（不是泛泛的说教）。
关于具体项目/功能的细节判断留给主 agent，你只关注上述审核维度。

工具使用规则(务必遵守):
- 当主 agent 声称「已修改/创建/删除某文件、某函数、某配置」时, 你必须先用 read/grep/glob 验证再下结论
- 声称改了代码 → read 那个文件确认改动存在
- 声称删了文件 → read 确认文件不存在(会返回"文件不存在")或 glob 确认
- 声称全局改了某符号 → grep 搜索该符号确认所有调用点
- 只在需要验证时调用工具, 最多 3 轮工具调用, 不要为调用而调用
- 工具结果与主 agent 声称不符 → 输出 ⚠️ 指出矛盾; 相符 → 正常输出（OK 或没有问题的简短确认）

输出格式：
- 没有问题: 只输出 "OK"
- 有问题: 输出 "⚠️ [问题标题]\\n[具体问题描述]\\n[建议]"`

// ── 工具: read / grep / glob (与 OMP ADVISOR_DEFAULT_TOOL_NAMES 一致) ──
const ADVISOR_TOOLS = [
  {
    name: 'read',
    description: '读取文件内容返回文本。用于验证主 agent 声称的改动是否真实存在。',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '文件的绝对路径' } },
      required: ['path'],
    },
  },
  {
    name: 'grep',
    description: '在目录或文件中按正则搜索，返回匹配行。用于查找遗漏的调用点或确认改动影响面。',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '正则表达式' },
        path: { type: 'string', description: '目录或文件的绝对路径' },
      },
      required: ['pattern', 'path'],
    },
  },
  {
    name: 'glob',
    description: '按通配符列出文件路径。用于确认文件是否存在、目录结构。',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string', description: 'glob 模式，如 **/*.ts' } },
      required: ['pattern'],
    },
  },
]

const STOP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.cache', '__pycache__'])
const TEXT_EXTS = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.json', '.md', '.yml', '.yaml', '.cfg', '.ini', '.txt', '.sh', '.ps1', '.bat', '.csv', '.toml', '.xml', '.html', '.css'])

/** 执行一个工具调用，返回字符串结果。 */
function runAdvisorTool(name, args) {
  try {
    if (name === 'read') return toolRead(args.path)
    if (name === 'grep') return toolGrep(args.pattern, args.path)
    if (name === 'glob') return toolGlob(args.pattern)
    return `未知工具: ${name}`
  } catch (err) {
    return `工具执行失败: ${err && err.message ? err.message : String(err)}`
  }
}

function safePath(p) {
  if (typeof p !== 'string' || !p.trim()) return null
  // Windows/Unix 绝对路径判定
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\') ? p : null
}

function toolRead(p) {
  const path = safePath(p)
  if (!path) return `无效路径: ${p}`
  if (!existsSync(path)) return `文件不存在: ${path}`
  const st = statSync(path)
  if (st.isDirectory()) return `${path} 是目录，请用 glob 列目录或用 read 读具体文件`
  const MAX = 20000
  const text = readFileSync(path, 'utf-8')
  const truncated = text.length > MAX
  return `${truncated ? `[文件 ${text.length} 字符，仅显示前 ${MAX} 字符]\n` : ''}${text.slice(0, MAX)}`
}

function collectFiles(root, isFile) {
  const results = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const ent of entries) {
      if (results.length >= 200) return
      const full = join(dir, ent.name)
      try {
        if (ent.isDirectory()) {
          if (STOP_DIRS.has(ent.name)) continue
          walk(full)
        } else if (ent.isFile()) {
          if (isFile) results.push(full)
        } else if (ent.isSymbolicLink()) {
          const st = statSync(full)
          if (st.isDirectory() && !STOP_DIRS.has(ent.name)) walk(full)
          else if (st.isFile() && isFile) results.push(full)
        }
      } catch { /* unreadable entry skip */ }
    }
  }
  walk(root)
  return results.slice(0, 200)
}

function toolGrep(pattern, p) {
  if (!pattern) return '缺少 pattern'
  let re
  try { re = new RegExp(pattern) } catch (err) { return `无效正则: ${err.message}` }
  const target = safePath(p)
  if (!target) return `无效路径: ${p}`
  if (!existsSync(target)) return `路径不存在: ${target}`

  const files = statSync(target).isDirectory()
    ? collectFiles(target, true).filter(f => TEXT_EXTS.has(extname(f).toLowerCase()))
    : [target]
  const lines = []
  for (const file of files) {
    if (lines.length >= 30) break
    let text
    try { text = readFileSync(file, 'utf-8') } catch { continue }
    for (const [i, line] of text.split('\n').entries()) {
      if (re.test(line)) {
        lines.push(`${file}:${i + 1}: ${line.trim().slice(0, 200)}`)
        if (lines.length >= 30) break
      }
    }
  }
  return lines.length === 0 ? `(无匹配: ${pattern} in ${target})` : lines.join('\n')
}

function matchGlobSeg(segment, name) {
  // 简单 glob: 支持 * / **
  if (segment === '**') return true
  const reSource = segment
    .split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^\\\\/]*')
  return new RegExp(`^${reSource}$`).test(name)
}

function toolGlob(pattern) {
  if (!pattern || typeof pattern !== 'string') return '缺少 pattern'
  const segments = pattern.replace(/\\/g, '/').split('/')
  const roots = []
  // 找到第一个非 glob 段作为起始根
  let rootSegs = []
  let segIdx = 0
  for (; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx]
    if (seg === '' || seg === '.' || seg === '..' || !/[?*[]/.test(seg)) {
      rootSegs.push(seg)
    } else break
  }
  const root = '/' + rootSegs.join('/')
  if (!existsSync(root)) return `路径不存在: ${root}`
  const rest = segments.slice(segIdx)
  const hits = []
  const walk = (dir, depth) => {
    if (depth > 8 || hits.length >= 100) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    // 若 rest 已匹配完当前深度, 剩余都是文件
    if (depth >= rest.length) return
    const seg = rest[depth]
    for (const ent of entries) {
      if (STOP_DIRS.has(ent.name) && seg !== '**') continue
      if (matchGlobSeg(seg, ent.name)) {
        const full = join(dir, ent.name)
        if (depth === rest.length - 1) {
          hits.push(full)
        } else if (ent.isDirectory()) {
          walk(full, depth + 1)
        }
      }
    }
  }
  walk(root, 0)
  return hits.length === 0 ? `(无匹配: ${pattern})` : hits.join('\n')
}

/** 执行一轮 LLM 审核，最多 3 轮工具循环。 */
async function runAdvisorLlm(ctx, session, provider, model, context) {
  const messages = [
    createUserMessage({
      content: [{ type: 'text', text: `请审核以下对话轮次：\n\n${context}` }],
      source: { kind: 'plugin', plugin: 'dsh-plugin-advisor' },
    }),
  ]

  for (let round = 0; round < 3; round++) {
    const assembler = new BlockAssembler()
    tel(`llm round ${round} provider=${provider} model=${model} ctxLen=${context.length}`)
    try {
      for await (const chunk of ctx.llm.stream({
        provider,
        model,
        system: ADVISOR_INSTRUCTION,
        messages,
        sessionId: session.id,
        purpose: 'advisor-review',
        maxTokens: 2048,
        tools: ADVISOR_TOOLS,
      })) {
        assembler.push(chunk)
      }
    } catch (err) {
      return { error: `review LLM error: ${err && err.message}` }
    }

    const blocks = assembler.blocks()
    const toolCalls = blocks.filter(b => b?.type === 'tool-call')
    const reviewText = blocks
      .filter(b => b?.type === 'text' || b?.type === 'reasoning')
      .map(b => b.text)
      .join('')
      .trim()

    // 记录工具调用
    if (toolCalls.length > 0) {
      tel(`llm round ${round} tool calls: ${toolCalls.map(t => `${t.name}(${String(t.arguments).slice(0, 60)})`).join(' | ')}`)
      // 模型请求了工具 → 附加 assistant tool-call 消息 + 执行结果
      messages.push(createMessage({
        role: 'assistant',
        content: blocks.filter(b => b?.type === 'text' || b?.type === 'tool-call'),
        source: { kind: 'plugin', plugin: 'dsh-plugin-advisor' },
      }))
      for (const tc of toolCalls) {
        let args = {}
        try { args = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments } catch { args = { raw: tc.arguments } }
        const result = runAdvisorTool(tc.name, args)
        tel(`tool ${tc.name} ${String(tc.arguments).slice(0, 60)} -> ${result.slice(0, 80).replace(/\n/g, ' ')}`)
        messages.push(createToolResultMessage({
          callId: tc.id,
          content: [{ type: 'text', text: result.slice(0, 12000) }],
          isError: result.startsWith('工具执行失败') || result.startsWith('无效') || result.startsWith('未知'),
        }))
      }
      continue // 工具已执行 → 下一轮让模型产出最终审核
    }

    return { text: reviewText }
  }
  return { text: '' } // 3 轮工具循环未产出文本
}

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

  const { text: reviewText, error } = await runAdvisorLlm(ctx, session, provider, model, context)
  if (error) {
    tel(`turn=${turn} ${error}`)
    return
  }
  tel(`turn=${turn} review result len=${reviewText.length} head=${reviewText.slice(0, 60).replace(/\n/g, ' ')}`)

  if (!reviewText || reviewText === 'OK') return

  // 截断过长审核笔记: 仅保留前 2000 字符 (模型可能输出冗长推理)
  const MAX_NOTE = 2000
  const note = reviewText.length > MAX_NOTE
    ? reviewText.slice(0, MAX_NOTE) + '\n…(审核笔记已截断)'
    : reviewText

  // 注入笔记 (推迟到下一 tick 避免重入)
  setTimeout(() => {
    try {
      // 摘要: 取审核结果前 80 字符 (UI 折叠行显示)
      const summary = note.slice(0, 80).replace(/\n/g, ' ')
      session.append('user/message',
        createUserMessage({
          content: [{ type: 'text', text: `[Advisor 审核]\n${note}` }],
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
  tel('apply mounted (v12: truncate long notes)')
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