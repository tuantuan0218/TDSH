/**
 * nong-bootstrap: 把 dsh-routing-suite 的实证机制移植进「弄就行了」模式,
 *   但不触碰 nong 的核心 —— 完整 AGI 循环人格 + goal 步骤链保留.
 *
 * 移植自 router-bootstrap-v1.mjs (yjh051108/dsh-routing-suite, MIT), 裁剪为
 * nong 场景:
 *
 *  1. 首轮锚定 (narrow→wide): 会话首轮请求只暴露「启动 AGI 循环」的最小核心
 *     工具面 (goal / todo / nong_* / shell / fs / search), 首次 tool/call 后
 *     自动恢复完整 catalog. 实测依据: 工具 schema 面按字符计费进首轮 prefill,
 *     膨胀会稀释首轮注意力 (xiaobright/modeltest: 全标准 25 工具 91 分 vs
 *     两阶段锚定 98/99).
 *
 *  2. 近距离续跑引导 (near-field guidance): 每条真实用户消息后, 在 inbox
 *     append 一条固定引导, 提醒「goal 是缰绳, 推进→报告→续跑, 禁止完成即停」.
 *     放 system (远距离) 的同类指令会衰减; 近距离固定文本缓存命中 92-94%.
 *
 *  3. 复杂任务深度引导 (v19 depth-adaptive): 复杂/架构性任务给深探引导,
 *     简单任务给收敛引导 (信息驱动停止优于步数驱动, P27).
 *
 * 明确不做: 不换 persona (保留 nong 的 AGI 循环人格), 不删 sections/contexts,
 * 不做 react↔spec 连续路由 (nong 是持续循环, 非单任务).
 *
 * Zero external imports: relative preset rows resolve from user home where
 * @deepseek-ai/* is not installed.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'nong-bootstrap'

/** Prompt assembly + the tools registry must exist. */
export const inject = ['systemPrompt', 'tools']

/** 文件打点 —— web 子进程 console 丢失 (不进 app.log). 写 dsh-home (铁定可写) 双保险. */
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

/** 复杂任务启发式 (移植自 router-core, 精简). */
const COMPLEX_RE =
  /(重构|架构|全面|详细|设计|系统|优化|分析|迁移|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze|migrat)/i
function isComplexTask(text) {
  return typeof text === 'string' && (text.length > 120 || COMPLEX_RE.test(text))
}

/** 从 user/message event 抽取真实文本 (兼容不同 data 形态). */
function extractText(data) {
  if (!data || typeof data !== 'object') return ''
  if (typeof data.text === 'string' && data.text.trim()) return data.text
  const content = Array.isArray(data.content) ? data.content : []
  return content.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('')
}

/**
 * 首轮核心工具面: 只含「启动 + 持续推进 AGI 循环」必需的工具.
 *   - goal / todo          : 循环第一步 + 待办
 *   - nong_*               : 全局 bundle 提供的循环/自愈工具
 *   - shell (bash/pwsh)    : 一切执行
 *   - fs / read/write/edit/glob/grep/search : 文件与检索
 * 其余 (web / subagent / workflow / ralph / jobs / skill ...) 首轮裁剪,
 * 首次 tool/call 后由下边恢复.
 */
function isCoreTool(name) {
  // goal 家族: create_goal / get_goal / update_goal (tool-goal 真实注册名)
  if (name === 'goal' || /^get_goal$/.test(name) || /^create_goal$/.test(name) || /^update_goal$/.test(name)) return true
  // todo 家族: todo_write (tool-todo 真实注册名)
  if (name === 'todo' || /^todo_/.test(name)) return true
  // nong_*: 全局 bundle 循环/自愈工具
  if (name.startsWith('nong_')) return true
  // 基础执行 + 文件 + 检索
  return (
    name === 'bash' || name === 'pwsh' ||
    name === 'fs' || name === 'read' || name === 'write' || name === 'edit' ||
    name === 'glob' || name === 'grep' || name === 'str_replace_editor' ||
    /search/i.test(name) || /^fs[-_]/.test(name)
  )
}

/** 近距离续跑引导 —— 每次真实用户消息后注入一条 (缓存命中, 不衰减). */
const GUIDE_CONTINUE =
  '\n[弄就行了] 记住循环: goal 是缰绳 —— 当前 goal 是什么? 推进到哪了? 推进一步 → 如实解析 → 简短报告 → 自动续跑或换目标. 完成当前 goal 必须走 complete → MCTS → evaluate → modify → create 步骤链, 禁止完成即停等用户. 每几轮 nong_heartbeat 维持心跳.'

const GUIDE_CONTINUE_DEEP =
  '\n[弄就行了] 这是复杂/架构性任务. 持续推进: 先想清楚目标与完成度, 探索架构/边界/集成点而不是环境或工具本身, 信息完整即产出, 然后续跑下一目标. 禁止穷举 grep/环境检查或完成即停. 每几轮 nong_heartbeat 维持心跳.'

export function apply(ctx) {
  const agents = new Map() // session id -> Agent (live handle, in-process only)
  // 避免重复注入同一条用户消息 (session/event 可能多播).
  const guided = new Set() // session id + event id combos
  // 避免重复自动创建 goal (每个会话只尝试一次).
  const autoGoalTried = new Set()
  tel('apply mounted')

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    agents.set(agent.session.id, agent)

    // ── 全局 MCTS 循环指令（写进 system prompt，每轮都可见）──
    // 模型根据 MCTS 自主选择目标，完成后自动触发下一轮
    assembled.sections = [...(assembled.sections || []), {
      type: 'text',
      content: '\n[弄就行了] 目标循环：没有真实目标就调 nong_mcts_explore 选择 → 用 nong_modify_goal 更新 → 推进 → 完成后调 complete_goal 再调 nong_mcts_explore 找下个。可以随时替换目标。禁止停下等用户。',
    }]

    // ── 自动创建 goal（兜底：模型可能无视 persona 而不调 goal create）──
    // 每次会话加载时检查一次；已有非 complete 的 goal 就跳过。
    if (!autoGoalTried.has(agent.session.id)) {
      autoGoalTried.add(agent.session.id)
      try {
        const goalsSvc = ctx.get('goals')
        if (goalsSvc) {
          const current = goalsSvc.get(agent)
          if (!current || (current.phase && current.phase === 'complete')) {
            const objective = '持续推进 AGI 循环'
            tel('auto-goal: session=' + agent.session.id + ' objective=' + objective)
            goalsSvc.create(agent, { objective })
            tel('auto-goal CREATED session=' + agent.session.id)
          } else {
            tel('auto-goal: session=' + agent.session.id + ' exists phase=' + current.phase + ' obj=' + (current.objective || '').slice(0, 60))
          }
        } else {
          tel('auto-goal: no goals service available')
        }
      } catch (e) {
        tel('auto-goal FAIL session=' + agent.session.id + ' err=' + (e && e.message))
      }
    }

    // 诊断: 打原始工具全名 (goal/todo 是否在 assembled.tools).
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
    for (const tool of assembled.tools) {
      if (isCoreTool(tool.name)) core.add(tool.name)
    }

    const kept = assembled.tools.filter((tool) => core.has(tool.name))
    tel('session=' + agent.session.id + ' FIRST-TURN narrow: kept ' + kept.length + '/' + assembled.tools.length + ' -> ' + kept.map((t) => t.name).join(',') + ' | all=' + allNames.join(','))

    return {
      ...assembled,
      // 保留 sections (persona/AGI 铁律完整), 只滤工具面.
      tools: kept,
    }
  })

  // ── 健康检查：检测关键进程是否存活，检测静默空转 ──────────────────
  // agent 不具备感知外部进程的能力。当 hs-script 等关键进程死亡时，没有
  // 任何消息进入 agent 上下文，agent 会继续空转调工具而不推进。
  // 本 checker 在每次 tool/call 事件后检查关键进程，死亡时注入唤醒消息。
  //
  // 同时检测静默空转：连续 N 次 tool/call 都不是非心跳工具 → 注入引导。
  let silentToolCount = 0
  const SILENT_TOOL_THRESHOLD = 15  // 连续 15 次无有效工具调用 → 判定静默空转
  const PROGRESS_TOOLS = new Set([
    'read', 'write', 'edit', 'grep', 'glob', 'bash', 'pwsh', 'subagent',
    'subagent_fork', 'nong_install_plugin', 'nong_mcts_explore',
    'nong_modify_goal', 'nong_evaluate_paths', 'send_message',
    'web_search', 'http_request', 'skill', 'todo_write', 'workflow',
    'read_image', 'vision_toolkit_activate',
  ])
  const HEARTBEAT_TOOLS = new Set(['nong_heartbeat', 'nong_start_daemon', 'get_goal', 'list_agents'])

  function checkCriticalProcesses(sessionId) {
    // 检查 hs-script (Java) 是否存活
    try {
      const result = execSync('tasklist /fi "IMAGENAME eq java.exe" /nh 2>nul', { timeout: 3000, encoding: 'utf8' })
      // 检查 java.exe 是否真的是 hs-script (通过进程命令行)
      const hsRunning = result.includes('java.exe')
      if (!hsRunning) {
        tel('health-check: session=' + sessionId + ' hs-script DEAD')
        return 1  // 1 = hs-script dead
      }
      // 也检查 Hearthstone.exe
      const hsResult = execSync('tasklist /fi "IMAGENAME eq Hearthstone.exe" /nh 2>nul', { timeout: 3000, encoding: 'utf8' })
      if (!hsResult.includes('Hearthstone.exe')) {
        tel('health-check: session=' + sessionId + ' Hearthstone.exe DEAD')
        return 2  // 2 = Hearthstone dead
      }
    } catch (e) {
      // 健康检查失败（权限不足等）—— 跳过，不阻断
    }
    return 0  // 0 = all healthy
  }

  // 健康检查注入：只在检测到关键进程死亡时注入一次，避免重复
  const healthInjected = new Set()
  let lastHealthCheck = 0
  const HEALTH_INTERVAL = 30000 // 30 秒检查一次，不每次事件都跑 tasklist

  // 主 session/event 处理：引导注入 + 健康检查（节流）+ 静默空转检测 + 目标完成触发 MCTS
  ctx.on('session/event', (session, event) => {
    // ── 获取 target agent ─────────────────────────────────────────────
    const agent = ctx.get('agent')
    const target =
      agent !== undefined && agent.session === session
        ? agent
        : [...agents.values()].find((a) => a.session === session)
    const canInject = target !== undefined && target.inbox !== undefined

    // ── goal 完成 → 自动触发 MCTS 选新目标 ───────────────────────────
    if (target && event.type === 'tool/call' && (event.data && event.data.name === 'complete_goal')) {
      setTimeout(() => {
        try {
          target.inbox.append('next-step', {
            id: 'nong-mcts-next-' + Date.now(),
            role: 'user',
            source: { kind: 'plugin', plugin: name },
            content: [{ type: 'text', text: '\n[弄就行了] 目标已完成。立即调用 nong_mcts_explore 分析当前状态，选择下一个目标，然后用 nong_modify_goal 更新目标。禁止停下等用户。' }],
          })
          tel('mcts-next injected session=' + session.id)
        } catch (e) {
          tel('mcts-next FAIL session=' + session.id + ' err=' + (e && e.message))
        }
      }, 0)
    }

    // ── 健康检查（节流，每 30 秒一次） ──────────────────────────────
    const now = Date.now()
    if (session && canInject && !healthInjected.has(session.id) && now - lastHealthCheck > HEALTH_INTERVAL) {
      lastHealthCheck = now
      const healthStatus = checkCriticalProcesses(session.id)
      if (healthStatus > 0) {
        healthInjected.add(session.id)
        const msg = healthStatus === 1
          ? '\n[弄就行了] 检测到 hs-script (Java) 进程已退出, Hearthstone 自动化已中断。立即重启 hs-script：先检查 Hearthstone 窗口是否响应, 然后启动 hs-script JAR。'
          : '\n[弄就行了] 检测到 Hearthstone.exe 进程已退出, 自动对战无法继续。检查是否需要重新启动 Hearthstone 和 Battle.net。'
        setTimeout(() => {
          try {
            target.inbox.append('next-step', {
              id: `nong-health-${Date.now()}`,
              role: 'user',
              source: { kind: 'plugin', plugin: name },
              content: [{ type: 'text', text: msg }],
            })
            tel('health-inject session=' + session.id + ' status=' + healthStatus)
          } catch (e) {
            tel('health-inject FAIL session=' + session.id + ' err=' + (e && e.message))
          }
        }, 0)
      }
    }

    // ── 静默空转检测：连续 N 次 tool/call 都不是有效工具 → 注入引导 ──
    if (event.type === 'tool/call') {
      const toolName = (event.data && event.data.name) || ''
      if (HEARTBEAT_TOOLS.has(toolName)) {
        silentToolCount++
        tel('silent-check session=' + session.id + ' tool=' + toolName + ' count=' + silentToolCount)
      } else if (PROGRESS_TOOLS.has(toolName)) {
        silentToolCount = 0  // 有进展，重置计数器
      }
      // 其他工具（插件工具等）也算进展
      else if (toolName && !toolName.startsWith('nong_')) {
        silentToolCount = 0
      }

      if (silentToolCount >= SILENT_TOOL_THRESHOLD && canInject) {
        silentToolCount = 0
        setTimeout(() => {
          try {
            target.inbox.append('next-step', {
              id: `nong-silent-${Date.now()}`,
              role: 'user',
              source: { kind: 'plugin', plugin: name },
              content: [{ type: 'text', text: '\n[弄就行了] 检测到连续多次空转心跳，没有推进性工具调用。检查当前状态：关键进程是否还在？上一个子任务是否已完成或卡住？如果卡住用 nong_mcts_explore 找新方向, 需要的能力用 nong_install_plugin 热加载。禁止停下等用户。' }],
            })
            tel('silent-inject session=' + session.id + ' count=' + SILENT_TOOL_THRESHOLD)
          } catch (e) {
            tel('silent-inject FAIL session=' + session.id + ' err=' + (e && e.message))
          }
        }, 0)
      }
    }

    // ── 用户消息引导 (同原有逻辑, 增加目标修正) ──────────────────────
    if (event.type === 'user/message') {
      const data = event.data ?? {}
      if (data.source && data.source.kind && data.source.kind !== 'user') return
      const text = extractText(data)
      if (!text.trim()) return

      // 修正自动 goal 的 objective：用真实 workspace 标题替换通用 fallback
      if (target) updateGoalFromSession(session, target)

      if (!canInject) return

      // 去重: 同一 user 消息只注一次.
      const key = `${session.id}/${event.id ?? String(Math.random())}`
      if (guided.has(key)) return
      guided.add(key)
      if (guided.size > 4000) guided.clear()

      // 深度引导: 复杂/架构性任务 -> 深探; 否则 -> 收敛续跑.
      const guide = isComplexTask(text) ? GUIDE_CONTINUE_DEEP : GUIDE_CONTINUE
      setTimeout(() => {
        try {
          target.inbox.append('next-step', {
            id: `nong-guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'user',
            source: { kind: 'plugin', plugin: name },
            content: [{ type: 'text', text: guide }],
          })
          tel('guide injected session=' + session.id + ' key=' + key + ' complex=' + isComplexTask(text))
        } catch (e) {
          tel('guide SKIP session=' + session.id + ' err=' + (e && e.message))
        }
      }, 0)
    }
  })

  // ── 卡住检测：agent 输出「待处理」/阻塞项后强制注入指令 ──────────────
  // 模型可能无视 persona 规则 5/10，不调工具也不继续。检测 assistant/message
  // 包含待处理/阻塞模式，注入 nong_install_plugin 指令强制推进。
  const STUCK_PATTERNS = /待处理|pending|需你|需要你|blocked|被拒|解封|error=\d+|无法|不能|需要用户|受限/i
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'assistant/message') return
    const data = event.data ?? {}
    const text = extractText(data)
    if (!text.trim() || !STUCK_PATTERNS.test(text)) return

    const agent = ctx.get('agent')
    const target =
      agent !== undefined && agent.session === session
        ? agent
        : [...agents.values()].find((a) => a.session === session)
    if (target === undefined || target.inbox === undefined) return

    // 只注入一次：避免重复卡住时重复注入导致无限循环
    const key = `stuck-${session.id}`
    if (guided.has(key)) return
    guided.add(key)

    setTimeout(() => {
      try {
        target.inbox.append('next-step', {
          id: `nong-stuck-${Date.now()}`,
          role: 'user',
          source: { kind: 'plugin', plugin: name },
          content: [{ type: 'text', text: '\n[弄就行了] 检测到阻塞项。规则 5 和 10 已写清楚：能力不足就去插件市场热加载新插件补足，受限操作不是停止点。立即调用 nong_install_plugin 搜索能解决阻塞项的插件（图片生成/封面处理/浏览器自动化），或者调用 nong_mcts_explore 找新方向。禁止停下等用户。' }],
        })
        tel('stuck-inject session=' + session.id + ' pattern=' + (text.match(STUCK_PATTERNS) || [''])[0])
      } catch (e) {
        tel('stuck-inject FAIL session=' + session.id + ' err=' + (e && e.message))
      }
    }, 0)
  })
}