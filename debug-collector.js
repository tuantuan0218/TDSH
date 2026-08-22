// Debug script to trace the collector behavior
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = 'G:/dsh-desktop'
const oldPath = process.env.PATH || ''
const pnpmShim = path.resolve(rootDir, 'tmp-pnpm-shim')
const env = { ...process.env, PATH: pnpmShim + ';' + oldPath, COREPACK_ENABLE_STRICT: '0' }

// Test 1: pnpm --version through collector's exact spawn mechanism
const psQuote = (value) => `'${value.replace(/'/g, "''")}'`
const command = 'pnpm'
const args = ['--version']
const invocation = ['&', psQuote(command), ...args.map(psQuote)].join(' ')
const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ${invocation}; exit $LASTEXITCODE`
const encoded = Buffer.from(script, 'utf16le').toString('base64')

console.log('=== Test 1: pnpm --version ===')
console.log('Script:', script)
const r1 = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { env, cwd: rootDir })
console.log('EXIT:', r1.status)
console.log('STDOUT:', JSON.stringify(r1.stdout.toString()))
console.log('STDERR:', r1.stderr.toString().substring(0, 200))
const rawVersion = r1.stdout.toString().trim()
const major = parseInt(rawVersion.split('.')[0], 10)
console.log('Parsed major:', major, '(from:', rawVersion, ')')

// Test 2: pnpm list --json
const args2 = ['list', '--prod', '--json', '--depth', 'Infinity', '--silent', '--loglevel=error']
const invocation2 = ['&', psQuote(command), ...args2.map(psQuote)].join(' ')
const script2 = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ${invocation2}; exit $LASTEXITCODE`
const encoded2 = Buffer.from(script2, 'utf16le').toString('base64')

console.log('\n=== Test 2: pnpm list --json ===')
const r2 = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded2], { env, cwd: rootDir })
console.log('EXIT:', r2.status)
console.log('STDOUT length:', r2.stdout.length)
console.log('STDOUT first 200:', r2.stdout.toString().substring(0, 200))

// Parse like extractJsonFromPollutedOutput
const raw = r2.stdout.toString().trim()
let dependencyTree
try {
  dependencyTree = JSON.parse(raw)
} catch {
  const bracketOpen = Math.max(raw.indexOf('{'), 0)
  const bracketOpenSquare = Math.max(raw.indexOf('['), 0)
  const start = Math.min(bracketOpen, bracketOpenSquare)
  for (let i = start; i < raw.length; i++) {
    const slice = raw.slice(start, i + 1)
    try {
      dependencyTree = JSON.parse(slice)
      break
    } catch { /* ignore */ }
  }
}
console.log('\nParsed type:', typeof dependencyTree)
console.log('Is array:', Array.isArray(dependencyTree))
console.log('Length:', Array.isArray(dependencyTree) ? dependencyTree.length : 'N/A')
if (Array.isArray(dependencyTree)) {
  console.log('First item type:', typeof dependencyTree[0])
  console.log('First item keys:', Object.keys(dependencyTree[0] || {}))
}
