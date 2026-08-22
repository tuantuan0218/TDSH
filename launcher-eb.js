// Launcher for electron-builder with portable node + pnpm wrapper first in PATH
// Usage: H:\nodejs\v24.16.0\node.exe launcher-eb.js [args...]
const { spawnSync } = require('child_process')
const path = require('path')

const projectDir = path.resolve(__dirname)
const pnpmShim = path.join(projectDir, 'tmp-pnpm-shim')

// Build a proper Windows PATH (semicolon-separated): our pnpm shim first.
const oldPath = process.env.PATH || process.env.Path || ''
const env = { ...process.env, PATH: pnpmShim + ';' + oldPath }

const cli = path.join(projectDir, 'node_modules', 'electron-builder', 'cli.js')
console.log('[launcher] pnpm shim dir:', pnpmShim)
console.log('[launcher] electron-builder cli:', cli)
console.log('[launcher] PATH (head):', env.PATH.substring(0, 120))

const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: projectDir,
  env,
  stdio: 'inherit',
  encoding: 'utf8',
})
process.exit(r.status == null ? 1 : r.status)