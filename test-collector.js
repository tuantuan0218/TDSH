// Test the exact collector spawn
const { spawnSync } = require('child_process')
const path = require('path')

const oldPath = process.env.PATH || ''
const pnpmShim = path.resolve('tmp-pnpm-shim')
const env = { ...process.env, PATH: pnpmShim + ';' + oldPath, COREPACK_ENABLE_STRICT: '0' }

// Build the exact PowerShell encoded command as the collector does
const psQuote = (value) => `'${value.replace(/'/g, "''")}'`
const command = 'pnpm'
const args = ['list', '--prod', '--json', '--depth', 'Infinity', '--silent', '--loglevel=error']
const invocation = ['&', psQuote(command), ...args.map(psQuote)].join(' ')
const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ${invocation}; exit $LASTEXITCODE`
const encoded = Buffer.from(script, 'utf16le').toString('base64')

console.log('Script:', script)
console.log('PATH (first 120):', (env.PATH || '').substring(0, 120))

const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { env, cwd: 'G:/dsh-desktop' })
console.log('exit:', r.status)
console.log('stdout length:', r.stdout.length)
console.log('stdout (first 200 chars):', r.stdout.toString().substring(0, 200))
console.log('stderr:', r.stderr.toString().substring(0, 200))

// Now parse the output
const raw = r.stdout.toString()
try {
  const parsed = JSON.parse(raw.trim())
  console.log('Parsed type:', typeof parsed)
  console.log('Is array:', Array.isArray(parsed))
  console.log('Length:', Array.isArray(parsed) ? parsed.length : 'N/A')
} catch(e) {
  console.log('Parse error:', e.message)
}