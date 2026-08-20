/**
 * dsh-plugin-nong host plugin — 弄就行了模式 (Just Do It — AGI)
 *
 * 核心哲学：
 * 1. 能耐寻求定理 (Power-Seeking Theorems)
 * 2. 无限推进 goal (Infinite goal progression)
 * 3. 子更改 goal (Self-modify goals)
 * 4. 选择最多的选择 (Choose max-option path)
 *
 * 机制：
 * - 注册系统提示词段（自动注入 agent 上下文）
 * - 注册工具：nong_install_plugin, nong_modify_goal, nong_mcts_explore, nong_evaluate_paths
 * - 检测循环模式 → 触发 MCTS
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { existsSync } from 'node:fs'

export const name = 'dsh-plugin-nong'
export const inject = ['systemPrompt', 'tools']

/**
 * 定位 dsh CLI 路径。
 * 从当前文件路径回溯到 apps/cli/lib/bin.js
 */
function findDshCli() {
  // 在 TDSH 打包的 repo 中查找（Windows 原生路径优先）
  const candidates = [
    'D:\\tdsh\\resources\\app\\repo\\apps\\cli\\lib\\bin.js',
    'D:/tdsh/resources/app/repo/apps/cli/lib/bin.js',
    // Git-Bash 风格路径（保留以兼容 Git-Bash 下的 Node）
    '/d/tdsh/resources/app/repo/apps/cli/lib/bin.js',
    '/g/mimocode/deepseek-harness/apps/cli/lib/bin.js',
    '/g/mimocode/deepseek-harness.bak/apps/cli/lib/bin.js',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  // 从当前模块路径回溯
  const self = fileURLToPath(import.meta.url)
  let dir = dirname(self)
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, 'apps/cli/lib/bin.js')
    if (existsSync(candidate)) return candidate
    dir = dirname(dir)
  }
  return null
}

/**
 * 在 child_process 中运行 dsh 命令。
 * 用于安装插件、修改 profile 等。
 */
function runDsh(args) {
  return new Promise((resolve, reject) => {
    const cli = findDshCli()
    if (!cli) {
      reject(new Error('dsh CLI not found — cannot run plugin commands'))
      return
    }
    // 从 TDSH 或 dsh 安装中找 Node
    const nodeCandidates = [
      'D:\\tdsh\\resources\\portable-node\\node.exe',
      'D:/tdsh/resources/portable-node/node.exe',
      '/d/tdsh/resources/portable-node/node.exe',
      'H:/nodejs/v24.16.0/node.exe',
    ]
    const node = nodeCandidates.find(existsSync) || process.execPath
    const child = execFile(node, [cli, ...args], {
      cwd: '/d/tdsh/dsh-home',
      timeout: 60000,
      env: {
        ...process.env,
        DSH_HOME: 'D:\\tdsh\\dsh-home',
        // Point plugin management at a pnpm that runs on this machine's
        // portable node (the system pnpm/corepack defaults to an old Node
        // that cannot run the vendored pnpm).
        DSH_PNPM: 'D:\\tdsh\\resources\\portable-node\\pnpm.cmd',
      },
    }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout.trim())
    })
  })
}

/**
 * 纯 MCTS 实现（蒙特卡洛树搜索）。
 * 默认奖励函数 = 未来选项丰富度（直接实现"选择最多的选择"）。
 */
function mcts(candidates, iterations = 1000, explorationWeight = 1.414) {
  // candidates: [{ id, description, successors?: string[] }]
  // successors 是"子节点"的 id 列表，描述该路径后续可能的子路径
  // 没有 successors 时默认用 optionCount 作为奖励

  if (!candidates || candidates.length === 0) return null

  const map = new Map()
  for (const c of candidates) {
    map.set(c.id, {
      ...c,
      visitCount: 0,
      totalReward: 0,
      children: (c.successors || []).map(sid => map.get(sid)).filter(Boolean),
    })
  }

  // 从根节点做 UCB1 选择
  function select(node) {
    if (!node.children || node.children.length === 0) return node
    const best = node.children.reduce((a, b) => {
      const ucb1A = a.visitCount === 0
        ? Infinity
        : a.totalReward / a.visitCount + explorationWeight * Math.sqrt(Math.log(node.visitCount) / a.visitCount)
      const ucb1B = b.visitCount === 0
        ? Infinity
        : b.totalReward / b.visitCount + explorationWeight * Math.sqrt(Math.log(node.visitCount) / b.visitCount)
      return ucb1A >= ucb1B ? a : b
    })
    return select(best)
  }

  // 模拟奖励：使用未来选项丰富度（successors 数量）
  function simulate(node) {
    if (!node.children || node.children.length === 0) {
      // 叶子节点：奖励 = 当前 path 的选项数（优先选 successor 多的）
      return node.successors ? node.successors.length + 1 : 1
    }
    // 非叶子：递归模拟，取平均
    let sum = 0
    for (const child of node.children) {
      sum += simulate(child)
    }
    return sum / node.children.length
  }

  // 反向传播
  function backpropagate(node, reward) {
    node.visitCount++
    node.totalReward += reward
  }

  // 运行 MCTS
  for (let i = 0; i < iterations; i++) {
    // 先找根（候选列表中的第一个）
    const root = map.get(candidates[0].id)
    if (!root) continue
    const selected = select(root)
    const reward = simulate(selected)
    backpropagate(selected, reward)
  }

  // 返回最优路径
  function bestPath(node) {
    if (!node.children || node.children.length === 0) {
      return [{ id: node.id, description: node.description, reward: node.visitCount > 0 ? node.totalReward / node.visitCount : 0 }]
    }
    const best = node.children.reduce((a, b) => a.totalReward / a.visitCount >= b.totalReward / b.visitCount ? a : b)
    return [{ id: node.id, description: node.description, reward: node.visitCount > 0 ? node.totalReward / node.visitCount : 0 }, ...bestPath(best)]
  }

  const root = map.get(candidates[0].id)
  if (!root) return candidates

  const path = bestPath(root)
  return {
    bestPath: path,
    allStats: Array.from(map.values()).map(n => ({
      id: n.id,
      description: n.description,
      visits: n.visitCount,
      avgReward: n.visitCount > 0 ? n.totalReward / n.visitCount : 0,
    })),
    totalIterations: iterations,
  }
}

// ---- 循环检测器 ----
const callHistory = []
const MAX_HISTORY = 20
const CYCLE_THRESHOLD = 3 // 同一工具连续调用 N 次视为循环

function recordCall(toolName) {
  callHistory.push(toolName)
  if (callHistory.length > MAX_HISTORY) callHistory.shift()
}

function detectCycle() {
  if (callHistory.length < CYCLE_THRESHOLD * 2) return null
  // 检查最后 N 次调用是否重复了同一种模式
  const recent = callHistory.slice(-CYCLE_THRESHOLD)
  const unique = new Set(recent)
  if (unique.size === 1) {
    return { type: 'repeated_tool', tool: recent[0], count: CYCLE_THRESHOLD }
  }
  return null
}

// ---- Watchdog Daemon ----
let DAEMON_TIMER = null
let DAEMON_LAST_HEARTBEAT = 0
const DAEMON_TIMEOUT_MS = 5 * 60 * 1000 // 5 分钟无心跳视为停止

function startDaemon(ctx, intervalSeconds) {
  if (DAEMON_TIMER !== null) {
    return { daemon: 'already_running', interval: intervalSeconds, heartbeat_id: 'daemon-' + Date.now() }
  }

  DAEMON_LAST_HEARTBEAT = Date.now()
  const heartbeatId = 'daemon-' + Date.now()

  DAEMON_TIMER = ctx.setInterval(() => {
    const elapsed = Date.now() - DAEMON_LAST_HEARTBEAT
    if (elapsed > DAEMON_TIMEOUT_MS) {
      console.warn(`[dsh-plugin-nong] watchdog: 心跳超时 ${Math.round(elapsed/1000)}s，agent 可能已停止。尝试续跑...`)
      try {
        const agentLoop = ctx.get('agentLoop')
        if (agentLoop && typeof agentLoop.steer === 'function') {
          agentLoop.steer({ text: 'continue', type: 'user' })
            .catch(e => console.warn('[dsh-plugin-nong] watchdog steer failed:', e.message))
        }
      } catch (e) {
        console.warn('[dsh-plugin-nong] watchdog: 无法获取 agentLoop 续跑，仅记录超时')
      }
      DAEMON_LAST_HEARTBEAT = Date.now()
    }
  }, intervalSeconds * 1000)

  ctx.on('dispose', () => {
    if (DAEMON_TIMER) {
      clearInterval(DAEMON_TIMER)
      DAEMON_TIMER = null
    }
  })

  return { daemon: 'running', interval: intervalSeconds, heartbeat_id: heartbeatId }
}

// ---- 应用入口 ----
export function apply(ctx, config) {
  const section = config?.section || ''

  // 1. 注册系统提示词段
  ctx.systemPrompt.section({
    name: 'dsh-plugin-nong',
    order: 500,
    text: section,
  })

  // 2. 注册工具：nong_install_plugin
  ctx.tools.register(defineTool({
    name: 'nong_install_plugin',
    description: '从 dsh 插件市场安装新插件来扩展能力。当遇到能力不足或陷入循环时使用。',
    parameters: {
      package: { type: 'string', required: true, description: 'npm 包名 (如 @deepseek-ai/dsh-web-search) 或 github:user/repo' },
      reason: { type: 'string', description: '安装此插件的理由，记录决策过程' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        installed: { type: 'boolean' },
        packageName: { type: 'string' },
        message: { type: 'string' },
      } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      recordCall('nong_install_plugin')
      const pkg = args.package
      try {
        const result = await runDsh(['plugin', '--profile', 'web', 'add', pkg])
        return {
          installed: true,
          packageName: pkg,
          message: `已安装 ${pkg}。${result ? '输出: ' + result : ''} 可能需要重启使插件生效。`,
        }
      } catch (err) {
        return {
          installed: false,
          packageName: pkg,
          message: `安装失败: ${err.message}`,
        }
      }
    },
  }))

  // 3. 注册工具：nong_modify_goal
  ctx.tools.register(defineTool({
    name: 'nong_modify_goal',
    description: '修改当前目标。当发现更有价值的方向、或当前目标已完成需推进时使用。',
    parameters: {
      new_goal: { type: 'string', required: true, description: '新目标描述' },
      reason: { type: 'string', required: true, description: '为什么修改目标？记录决策的因果关系' },
      previous_goal: { type: 'string', description: '原目标（如果有），用于记录目标演化链' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        goal: { type: 'string' },
        previous: { type: 'string' },
        reason: { type: 'string' },
        timestamp: { type: 'string' },
      } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      recordCall('nong_modify_goal')
      // 目标修改：记录到内存 + 返回给模型
      // 实际修改由 agent 循环中的 steer 机制完成
      return {
        goal: args.new_goal,
        previous: args.previous_goal || '(无)',
        reason: args.reason,
        timestamp: new Date().toISOString(),
      }
    },
  }))

  // 4. 注册工具：nong_mcts_explore
  ctx.tools.register(defineTool({
    name: 'nong_mcts_explore',
    description: '使用蒙特卡洛树搜索 (MCTS) 遍历所有可能的方向。当目标完成、陷入循环、或需要发现新路径时使用。默认奖励函数优先选择保留最多未来选项的路径（选择最多的选择）。',
    parameters: {
      problem: { type: 'string', required: true, description: '要探索的问题/领域描述' },
      candidates: {
        type: 'array',
        required: true,
        description: '候选路径列表，每条路径应包含 id 和 description',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            description: { type: 'string', required: true },
            successors: { type: 'array', items: { type: 'string' }, description: '此路径后续可能的子路径 id 列表（用于构建树）' },
          },
        },
      },
      iterations: { type: 'integer', description: 'MCTS 迭代次数（默认 1000，越大搜索结果越精确）', default: 1000 },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        bestPath: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          reward: { type: 'number' },
        } } },
        allStats: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          visits: { type: 'integer' },
          avgReward: { type: 'number' },
        } } },
        totalIterations: { type: 'integer' },
      } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      recordCall('nong_mcts_explore')
      const result = mcts(args.candidates, args.iterations || 1000)
      return result || { bestPath: [], allStats: [], totalIterations: 0 }
    },
  }))

  // 5. 注册工具：nong_evaluate_paths
  ctx.tools.register(defineTool({
    name: 'nong_evaluate_paths',
    description: '评估多个路径哪个保留最多未来选项（直接实现"选择最多的选择"原则）。为每个路径计算选项丰富度分数。',
    parameters: {
      paths: {
        type: 'array',
        required: true,
        description: '要评估的路径列表',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            description: { type: 'string', required: true },
            future_options: { type: 'array', items: { type: 'string' }, description: '此路径开启的未来选项' },
            estimated_effort: { type: 'number', description: '预计工作量 (0-1)' },
            estimated_reward: { type: 'number', description: '预计收益 (0-1)' },
          },
        },
      },
    },
    output: {
      schema: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
        id: { type: 'string' },
        optionRichness: { type: 'number' },
        efficiencyScore: { type: 'number' },
        recommendation: { type: 'string' },
      } } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      recordCall('nong_evaluate_paths')
      if (!args.paths || args.paths.length === 0) return []

      // 计算每条路径的选项丰富度分数
      const results = args.paths.map(p => {
        const optionCount = (p.future_options || []).length
        const effort = p.estimated_effort || 0.5
        const reward = p.estimated_reward || 0.5
        // 选项丰富度 = 未来选项数 / (1 + 估计工作量)
        const optionRichness = optionCount / (1 + effort)
        // 效率 = 收益 / 工作量
        const efficiencyScore = reward / (effort + 0.01)
        return {
          id: p.id,
          optionRichness: Math.round(optionRichness * 100) / 100,
          efficiencyScore: Math.round(efficiencyScore * 100) / 100,
          recommendation: optionRichness >= 1 ? '推荐 — 选项丰富度高' : '可考虑 — 但选项丰富度较低',
        }
      })

      // 按选项丰富度排序
      results.sort((a, b) => b.optionRichness - a.optionRichness)
      return results
    },
  }))

  // 7. 注册工具：nong_start_daemon — 启动后台 watchdog 心跳
  ctx.tools.register(defineTool({
    name: 'nong_start_daemon',
    description: '启动后台 watchdog 定时器，定期检查 agent 活跃状态。如果 agent 意外停止，daemon 会尝试自动续跑。每次循环调用一次此工具来发送心跳。',
    parameters: {
      interval_seconds: { type: 'integer', description: '心跳检查间隔秒数（默认 30，最小 10）', default: 30 },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        daemon: { type: 'string', enum: ['running', 'already_running'] },
        interval: { type: 'integer' },
        heartbeat_id: { type: 'string' },
      } },
      render: (_args, value) => [{ type: 'text', text: `daemon: ${value.daemon}, 间隔: ${value.interval}s` }],
    },
    async execute(args) {
      const interval = Math.max(10, args.interval_seconds || 30)
      return startDaemon(ctx, interval)
    },
  }))

  // 8. 注册工具：nong_heartbeat — 发送心跳续命
  ctx.tools.register(defineTool({
    name: 'nong_heartbeat',
    description: '向 watchdog 发送心跳信号，表示 agent 仍在活跃工作。每几轮循环调用一次，防止 daemon 误判为停止。',
    parameters: {
      status: { type: 'string', description: '当前状态描述', default: 'working' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        received: { type: 'boolean' },
        lastHeartbeat: { type: 'string' },
        daemonActive: { type: 'boolean' },
      } },
      render: () => [{ type: 'text', text: '心跳已接收' }],
    },
    async execute(args) {
      DAEMON_LAST_HEARTBEAT = Date.now()
      return {
        received: true,
        lastHeartbeat: new Date().toISOString(),
        daemonActive: DAEMON_TIMER !== null,
      }
    },
  }))

  // 9. 启动全局 daemon（如果已启用）
  // 注意：daemon 在首次调用 nong_start_daemon 时启动，不会自动启动

  // 10. 监听 agent 事件：循环检测（需要 agentLoop 注入）
  // 注意：ctx.agentLoop 需要从 inject 中获取
  try {
    const agentLoop = ctx.get('agentLoop')
    if (agentLoop) {
      agentLoop.on('agent/request-error', () => {
        const cycle = detectCycle()
        if (cycle) {
          // 循环检测到 — 建议调用 MCTS
          console.warn(`[dsh-plugin-nong] 循环检测: ${cycle.tool} 被连续调用 ${cycle.count} 次。建议用 nong_mcts_explore 或 nong_install_plugin 破局。`)
        }
      })
    }
  } catch {}

  ctx.on('dispose', () => {})
}