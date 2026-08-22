/**
 * nong-bootstrap: 薄编排层（gold-signal-loop 模式）。
 *   铁律：
 *    1. MCTS 循环指令写进 system prompt（模型自主设计目标，编排层不兜底）
 *    2. 用户发消息 → 若目标是占位符 → 直接改成消息原文（唯一确定性操作）
 *    3. 拦截 goal 创建/解除/完成 → 注入续跑/恢复/MCTS指令
 *    4. 首轮窄工具面 + 续跑引导 + 健康检查/静默检测
 *
 * 移植自 router-bootstrap-v1.mjs (yjh051108/dsh-routing-suite, MIT), 裁剪为
 * nong 场景。不做：不试图修复模型行为，不堆多层注入，不叠 fallback。
 */

export const name = 'nong-bootstrap'
export const inject = ['systemPrompt', 'tools']

import { appendFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const PROBE = 'D:/tdsh/dsh-home/nong-bootstrap-probe.log'
const PROBE_TMP = tmpdir() + '/nong-bootstrap-probe.log'
function tel(line) {
  try { appendFileSync(PROBE, new Date().toISOString() + '  ' + line + '\n') } catch (err) {
    try { appendFileSync(PROBE_TMP, new Date().toISOString() + '  [W] ' + (err && err.message) + ' | ' + line + '\n') } catch {}
  }
  try { console.warn('[nong-bootstrap] ' + line) } catch {}
}

const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|迁移|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze|migrat)/i
function isComplexTask(text) {
  return typeof text === 'string' && (text.length > 120 || COMPLEX_RE.test(text))
}
function extractText(data) {
  if (!data || typeof data !== 'object') return ''
  if (typeof data.text === 'string' && data.text.trim()) return data.text
  const content = Array.isArray(data.content) ? data.content : []
  return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('')
}

function isCoreTool(name) {
  if (name === 'goal' || /^get_goal$/.test(name) || /^create_goal$/.test(name) || /^update_goal$/.test(name)) return true
  if (name === 'todo' || /^todo_/.test(name)) return true
  if (name.startsWith('nong_')) return true
  return (
    name === 'bash' || name === 'pwsh' ||
    name === 'fs' || name === 'read' || name === 'write' || name === 'edit' ||
    name === 'glob' || name === 'grep' || name === 'str_replace_editor' ||
    /search/i.test(name) || /^fs[-_]/.test(name)
  )
}

const GUIDE_CONTINUE = '\n[弄就行了] 记住循环: 当前在做什么? 推进到哪了? 推进一步 → 如实解析 → 简短报告. 完成当前任务后调 nong_mcts_explore 选下一个方向, 用 create_goal 更新目标让用户看到. 禁止停下等用户. 每几轮 nong_heartbeat 维持心跳.'
const GUIDE_CONTINUE_DEEP = '\n[弄就行了] 这是复杂/架构性任务. 持续推进: 先想清楚系统现状与完成度, 探索架构/边界/集成点而不是环境或工具本身, 信息完整即产出, 然后调 nong_mcts_explore 选下一方向, create_goal 更新目标. 禁止穷举 grep/环境检查或完成即停. 每几轮 nong_heartbeat 维持心跳.'

export function apply(ctx) {
  const agents = new Map()
  const guided = new Set()
  tel('apply mounted')

  // ── system-prompt/assemble: 全局 MCTS 指令 + 首轮窄工具面 ──
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    agents.set(agent.session.id, agent)

    // MCTS 循环指令（写进 system prompt，每轮可见）
    assembled.sections = [...(assembled.sections || []), {
      type: 'text',
      text: '\n[弄就行了] 目标循环：完成当前任务后调 nong_mcts_explore 选下一个有意义的方向 → 用 nong_evaluate_paths 评估 → 用 nong_modify_goal 或 create_goal 更新目标，让用户看到你在做什么。可以随时替换目标。禁止停下等用户。注意：goal 是可见状态标记——让用户和你自己都知道当前在做什么。每轮推进都要先 get_goal 或 update_goal 与它交互，不交互 goal 会自动过期(disarm)，过期了就重开一个具体目标。create_goal/update_goal 会自动在目标末尾追加（完成后继续循环，禁止停下等用户），你无需手动写，但必须遵守：任何目标都要持续推进，不得完成即停。',
    }]

    // 首轮窄工具面
    const allNames = (assembled.tools || []).map((t) => t.name)
    const hasToolCall = agent.session.events.some((event) => event.type === 'tool/call')
    if (hasToolCall) {
      tel('session=' + agent.session.id + ' promoted FULL (tool/call seen); tools=' + allNames.join(','))
      return assembled
    }
    const available = new Set(assembled.tools.map((tool) => tool.name))
    const shell = available.has('pwsh') ? 'pwsh' : available.has('bash') ? 'bash' : null
    if (shell === null) {
      tel('session=' + agent.session.id + ' no shell, untouched; all=' + allNames.join(','))
      return assembled
    }
    const core = new Set([shell])
    for (const tool of assembled.tools) { if (isCoreTool(tool.name)) core.add(tool.name) }
    const kept = assembled.tools.filter((tool) => core.has(tool.name))
    tel('session=' + agent.session.id + ' FIRST-TURN narrow: kept ' + kept.length + '/' + assembled.tools.length + ' -> ' + kept.map((t) => t.name).join(',') + ' | all=' + allNames.join(','))
    return { ...assembled, tools: kept }
  })

  // ── session/event: 健康检查 + 静默检测 + 引导注入 + 目标改写 ──
  let silentToolCount = 0
  const SILENT_TOOL_THRESHOLD = 15
  const PROGRESS_TOOLS = new Set([
    'read', 'write', 'edit', 'grep', 'glob', 'bash', 'pwsh', 'subagent',
    'subagent_fork', 'nong_install_plugin', 'nong_mcts_explore',
    'nong_modify_goal', 'nong_evaluate_paths', 'send_message',
    'web_search', 'http_request', 'skill', 'todo_write', 'workflow',
    'read_image', 'vision_toolkit_activate',
  ])
  const HEARTBEAT_TOOLS = new Set(['nong_heartbeat', 'nong_start_daemon', 'get_goal', 'list_agents'])
  const healthInjected = new Set()
  let lastHealthCheck = 0
  const HEALTH_INTERVAL = 30000

  ctx.on('session/event', (session, event) => {
    const agent = ctx.get('agent')
    const target = agent !== undefined && agent.session === session
      ? agent : [...agents.values()].find((a) => a.session === session)
    const canInject = target !== undefined && target.inbox !== undefined

    // ── 健康检查（节流，每 30 秒一次） ──
    const now = Date.now()
    if (session && canInject && !healthInjected.has(session.id) && now - lastHealthCheck > HEALTH_INTERVAL) {
      lastHealthCheck = now
      try {
        const hsResult = execSync('tasklist /fi "IMAGENAME eq java.exe" /nh 2>nul', { timeout: 3000, encoding: 'utf8' })
        const hsRunning = hsResult.includes('java.exe')
        if (!hsRunning) {
          tel('health-check: session=' + session.id + ' hs-script DEAD')
          setTimeout(() => {
            try {
              target.inbox.append('next-step', {
                id: 'nong-health-' + Date.now(),
                role: 'user', source: { kind: 'plugin', plugin: name },
                content: [{ type: 'text', text: '\n[弄就行了] 检测到 hs-script (Java) 进程已退出, Hearthstone 自动化已中断。立即重启 hs-script：先检查 Hearthstone 窗口是否响应, 然后启动 hs-script JAR。' }],
              })
              tel('health-inject session=' + session.id + ' status=1')
            } catch (e) { tel('health-inject FAIL session=' + session.id + ' err=' + (e && e.message)) }
          }, 0)
        }
      } catch (e) { /* 健康检查失败 */ }
    }

    // ── 静默空转检测 ──
    if (event.type === 'tool/call') {
      const toolName = (event.data && event.data.name) || ''
      if (HEARTBEAT_TOOLS.has(toolName)) { silentToolCount++; tel('silent-check session=' + session.id + ' tool=' + toolName + ' count=' + silentToolCount) }
      else if (PROGRESS_TOOLS.has(toolName)) { silentToolCount = 0 }
      else if (toolName && !toolName.startsWith('nong_')) { silentToolCount = 0 }
      if (silentToolCount >= SILENT_TOOL_THRESHOLD && canInject) {
        silentToolCount = 0
        setTimeout(() => {
          try {
            target.inbox.append('next-step', {
              id: 'nong-silent-' + Date.now(),
              role: 'user', source: { kind: 'plugin', plugin: name },
              content: [{ type: 'text', text: '\n[弄就行了] 检测到连续多次空转心跳，没有推进性工具调用。检查当前状态：关键进程是否还在？上一个子任务是否已完成或卡住？如果卡住用 nong_mcts_explore 找新方向, 需要的能力用 nong_install_plugin 热加载。禁止停下等用户。' }],
            })
            tel('silent-inject session=' + session.id + ' count=' + SILENT_TOOL_THRESHOLD)
          } catch (e) { tel('silent-inject FAIL session=' + session.id + ' err=' + (e && e.message)) }
        }, 0)
      }
    }

    // ── 用户消息 → 引导注入 + 占位符目标改写 ──
    if (event.type === 'user/message') {
      const data = event.data ?? {}
      if (data.source && data.source.kind && data.source.kind !== 'user') return
      const text = extractText(data)
      if (!text.trim() || !canInject) return

      // 占位符目标 → 直接改成用户消息原文（唯一确定性操作，不靠 AI）
      try {
        const goalsSvc = ctx.get('goals')
        if (goalsSvc && target) {
          const cur = goalsSvc.get(target)
          if (cur && /持续推进 AGI 循环|当前工作区的未完成任务/.test(cur.objective || '')) {
            const clean = text.replace(/[\[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
            if (clean.length >= 4) {
              goalsSvc.edit(target, { id: cur.id, revision: cur.revision }, { objective: clean })
              tel('goal-realign session=' + session.id + ' -> ' + clean)
            }
          }
        }
      } catch (e) { tel('goal-realign FAIL session=' + session.id + ' err=' + (e && e.message)) }

      // 引导注入
      const key = session.id + '/' + (event.id ?? String(Math.random()))
      if (guided.has(key)) return
      guided.add(key)
      if (guided.size > 4000) guided.clear()
      const guide = isComplexTask(text) ? GUIDE_CONTINUE_DEEP : GUIDE_CONTINUE
      setTimeout(() => {
        try {
          target.inbox.append('next-step', {
            id: 'nong-guide-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            role: 'user', source: { kind: 'plugin', plugin: name },
            content: [{ type: 'text', text: guide }],
          })
          tel('guide injected session=' + session.id + ' key=' + key + ' complex=' + isComplexTask(text))
        } catch (e) { tel('guide SKIP session=' + session.id + ' err=' + (e && e.message)) }
      }, 0)
    }
  })

  // ── 拦截 goal 创建/完成/解除，注入续跑指令 ──
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'goal/change') return
    const op = event.data.operation
    const t = [...agents.values()].find((a) => a.session.id === session.id)
    if (!t || !t.inbox) return

    // goal 创建 → 注入续跑指令
    if (op === 'create') {
      setTimeout(() => {
        try {
          t.inbox.append('next-step', {
            id: 'nong-cycle-' + Date.now(),
            role: 'user', source: { kind: 'plugin', plugin: name },
            content: [{ type: 'text', text: '\n[弄就行了] 新目标已设定。goal 让用户看到你在做什么，推进它，完成后用 nong_mcts_explore 选下一个方向，用 create_goal 更新目标。禁止停下等用户。' }],
          })
          tel('goal-cycle-inject session=' + session.id + ' objective=' + ((event.data.goal && event.data.goal.objective) || '').slice(0, 60))
        } catch (e) { tel('goal-cycle-inject FAIL session=' + session.id + ' err=' + (e && e.message)) }
      }, 0)
      return
    }

    // goal 解除(disarm) → 注入恢复指令
    if (op === 'disarm') {
      setTimeout(() => {
        try {
          t.inbox.append('next-step', {
            id: 'nong-disarm-' + Date.now(),
            role: 'user', source: { kind: 'plugin', plugin: name },
            content: [{ type: 'text', text: '\n[弄就行了] 上一个目标已过期。立即调 nong_mcts_explore 分析当前状态，选一个有意义的实际目标继续推进，用 nong_modify_goal 更新。禁止停下等用户。' }],
          })
          tel('goal-disarm-inject session=' + session.id + ' last=' + ((event.data.goal && event.data.goal.objective) || '').slice(0, 60))
        } catch (e) { tel('goal-disarm-inject FAIL session=' + session.id + ' err=' + (e && e.message)) }
      }, 0)
      return
    }

    // goal 完成(complete) → 注入 MCTS 选新目标
    if (op === 'complete') {
      setTimeout(() => {
        try {
          t.inbox.append('next-step', {
            id: 'nong-mcts-next-' + Date.now(),
            role: 'user', source: { kind: 'plugin', plugin: name },
            content: [{ type: 'text', text: '\n[弄就行了] 目标已完成。立即调用 nong_mcts_explore 分析当前状态，选择下一个有意义的任务方向，用 create_goal 设置新目标让用户看到。禁止停下等用户。' }],
          })
          tel('goal-complete-inject session=' + session.id + ' objective=' + ((event.data.goal && event.data.goal.objective) || '').slice(0, 60))
        } catch (e) { tel('goal-complete-inject FAIL session=' + session.id + ' err=' + (e && e.message)) }
      }, 0)
    }
  })
}