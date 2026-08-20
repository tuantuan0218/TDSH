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
  tel('apply mounted')

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    agents.set(agent.session.id, agent)

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

  // ── 近距离续跑引导 ────────────────────────────────────────────────────
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'user/message') return
    const data = event.data ?? {}
    if (data.source && data.source.kind && data.source.kind !== 'user') return
    const text = extractText(data)
    if (!text.trim()) return

    const agent = ctx.get('agent')
    const target =
      agent !== undefined && agent.session === session
        ? agent
        : [...agents.values()].find((a) => a.session === session)
    if (target === undefined || target.inbox === undefined) return

    // 去重: 同一 user 消息只注一次.
    const key = `${session.id}/${event.id ?? String(Math.random())}`
    if (guided.has(key)) return
    guided.add(key)
    if (guided.size > 4000) guided.clear() // 防无限增长

    // 深度引导: 复杂/架构性任务 -> 深探; 否则 -> 收敛续跑.
    const guide = isComplexTask(text) ? GUIDE_CONTINUE_DEEP : GUIDE_CONTINUE
    // 推迟到下一 tick: session/event 发布期间禁止重入 inbox.append.
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
        /* duplicate/ordering races: skip */
        tel('guide SKIP session=' + session.id + ' err=' + (e && e.message))
      }
    }, 0)
  })
}