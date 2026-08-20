/**
 * dsh-plugin-everything — 双通道快速文件索引搜索工具
 *
 * 通道1 (优先): es.exe — Everything 服务实时 NTFS 全盘索引 (更快、更全、支持正则/排序/filter)
 * 通道2 (兜底): dsearch.exe — 自包含索引 (零外部依赖, Everything 服务不可用时离线可用)
 *
 * 编码处理: es.exe 输出为系统 ANSI 代码页 (GBK), 显式 TextDecoder('gbk') 解码;
 *           dsearch 输出为 UTF-8。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dsearchPath = join(__dirname, 'dsearch.exe')
const execFileAsync = promisify(execFile)

// es.exe 候选路径 (Everything 官方 CLI); 全部不存在则只用 dsearch 通道
const ES_CANDIDATES = [
  'G:\\dsh-desktop\\es-tool\\es.exe',
  'G:\\dsh-desktop\\es-tool\\es64.exe',
  join(__dirname, 'es.exe'),
]

// 默认索引根目录（按优先级尝试）
const DEFAULT_ROOTS = ['G:\\', 'D:\\', 'H:\\', 'E:\\', 'F:\\']

const gbkDecoder = new TextDecoder('gbk')

function getIndexDir() {
  const idxDir = join(__dirname, '.index')
  if (!existsSync(idxDir)) mkdirSync(idxDir, { recursive: true })
  return idxDir
}

function indexFileForRoot(root) {
  const hash = createHash('md5').update(root).digest('hex').slice(0, 12)
  return join(getIndexDir(), hash + '.idx')
}

async function ensureIndex(root, idxFile) {
  if (existsSync(idxFile)) {
    const stat = await import('node:fs').then(fs => fs.promises.stat(idxFile))
    if (Date.now() - stat.mtimeMs < 3600_000) {
      return false
    }
  }
  await execFileAsync(dsearchPath, ['index', root, idxFile], { timeout: 600_000, windowsHide: true })
  return true
}

// ---- 通道1: es.exe (Everything 实时索引) ----
async function esSearch(query, limit) {
  const esPath = ES_CANDIDATES.find(p => existsSync(p))
  if (!esPath) return null // 无 es.exe → 走兜底通道
  try {
    const { stdout } = await execFileAsync(esPath, ['-n', String(limit), query], {
      timeout: 15_000, windowsHide: true, encoding: 'buffer',
    })
    const decoded = gbkDecoder.decode(stdout)
    const results = decoded.split('\n').map(l => l.trim()).filter(Boolean)
    return { results, count: results.length, engine: 'es' }
  } catch {
    return null // Everything 服务未运行 / 超时 / 其他失败 → 兜底
  }
}

// ---- 通道2: dsearch (自包含索引) ----
async function dsearchSearch(args, root, limit) {
  const idxFile = indexFileForRoot(root)
  try {
    const built = await ensureIndex(root, idxFile)
    const { stdout } = await execFileAsync(dsearchPath, ['query', idxFile, args.query, String(limit)], {
      timeout: 30_000, windowsHide: true,
    })
    const results = stdout.trim().split('\n').filter(Boolean)
    return { results, count: results.length, engine: 'dsearch', indexed: built }
  } catch (err) {
    return { results: [], count: 0, error: err.stderr?.trim() || String(err.message), engine: 'dsearch' }
  }
}

export const name = 'dsh-plugin-everything'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'everything_search',
    description: `超快速搜索文件名，双通道引擎：优先 es.exe（Everything NTFS 实时全盘索引，毫秒级，支持全盘），
兜底 dsearch（内嵌自包含索引，零外部依赖）。首次使用自动建索引（约几十秒），之后秒级查询。`,
    parameters: {
      query: { type: 'string', required: true, description: '搜索关键字（子串匹配，大小写不敏感；es 通道支持 Everything 语法）' },
      root: { type: 'string', description: '限定搜索根目录（仅 dsearch 兜底通道生效），如 G:\\dsh-desktop，默认自动探测数据盘' },
      limit: { type: 'integer', description: '最大返回数量，默认 50' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        results: { type: 'array', items: { type: 'string' } },
        count: { type: 'integer' },
        engine: { type: 'string', description: 'es=Everything实时 / dsearch=自建索引' },
        indexed: { type: 'boolean', description: '本次调用是否首次建索引（dsearch通道）' },
        error: { type: 'string' },
      } },
      render: (_args, value) => {
        if (value.error) return [{ type: 'text', text: `错误: ${value.error}` }]
        if (value.results.length === 0) return [{ type: 'text', text: `(no results)${value.indexed ? ' [索引已建]' : ''}` }]
        return [{ type: 'text', text: `找到 ${value.count} 个结果 [${value.engine}]${value.indexed ? ' [索引已建]' : ''}:\n` + value.results.join('\n') }]
      },
    },
    async execute(args) {
      const limit = args.limit ?? 50
      const root = args.root || DEFAULT_ROOTS.find(r => {
        try { return existsSync(r) } catch { return false }
      }) || 'G:\\'

      // 通道1: es.exe 优先; 若用户指定 root 或需要索引构建则跳过 es 直达 dsearch
      if (!args.root) {
        const esResult = await esSearch(args.query, limit)
        if (esResult) return esResult
      }
      // 通道2: dsearch 兜底
      return dsearchSearch(args, root, limit)
    },
  }))
}