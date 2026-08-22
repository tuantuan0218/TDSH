// Full reproduction of collector's behavior
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = 'G:/dsh-desktop'
const oldPath = process.env.PATH || ''
const pnpmShim = path.resolve(rootDir, 'tmp-pnpm-shim')
const env = { ...process.env, PATH: pnpmShim + ';' + oldPath, COREPACK_ENABLE_STRICT: '0' }

const psQuote = (value) => `'${value.replace(/'/g, "''")}'`
const command = 'pnpm'
const args = ['list', '--prod', '--json', '--depth', 'Infinity', '--silent', '--loglevel=error']
const invocation = ['&', psQuote(command), ...args.map(psQuote)].join(' ')
const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); ${invocation}; exit $LASTEXITCODE`
const encoded = Buffer.from(script, 'utf16le').toString('base64')

// Use the EXACT spawn options as the collector
const child = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
  cwd: rootDir,
  env: { COREPACK_ENABLE_STRICT: '0', ...env },
  shell: false,
})

console.log('EXIT CODE:', child.status)
console.log('STDOUT LENGTH:', child.stdout.length)
console.log('STDERR:', child.stderr.toString().substring(0, 500))
console.log('---')

const raw = child.stdout.toString()
console.log('RAW OUTPUT (first 300):', raw.substring(0, 300))
console.log('---')

// Try extractJsonFromPollutedOutput logic
function extractJsonFromPollutedOutput(shellOutput) {
  const consoleOutput = shellOutput.trim()
  try {
    return JSON.parse(consoleOutput)
  } catch { /* ignore */ }
  const bracketOpen = Math.max(consoleOutput.indexOf('{'), 0)
  const bracketOpenSquare = Math.max(consoleOutput.indexOf('['), 0)
  const start = Math.min(bracketOpen, bracketOpenSquare)
  for (let i = start; i < consoleOutput.length; i++) {
    const slice = consoleOutput.slice(start, i + 1)
    try {
      return JSON.parse(slice)
    } catch { /* ignore */ }
  }
  throw new Error('No JSON content found in output')
}

try {
  const parsed = extractJsonFromPollutedOutput(raw)
  console.log('PARSED type:', typeof parsed)
  console.log('Is array:', Array.isArray(parsed))
  console.log('Length:', Array.isArray(parsed) ? parsed.length : 'N/A')
  console.log('First name:', Array.isArray(parsed) ? parsed[0].name : parsed.name)
} catch(e) {
  console.log('PARSE ERROR:', e.message)
}