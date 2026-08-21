'use strict'

// DSH 桌面壳 (main process, CommonJS)
// 设计：attach-or-spawn
//   1) 先探测默认 URL 是否已活（例如已有 dsh web 在跑）→ 直接开原生窗口，attach；
//   2) 否则 spawn `dsh web`（--port 0，OS 分配空闲端口），从 stdout 解析真实 URL 后开窗。
// 约束（本机 AGENTS.md）：
//   1) 禁止扩大 C 盘占用：userData / 日志全部落在 APP_DIR（非 C 盘），DSH_HOME 默认 G 盘；
//   2) 不创建任何 Windows 自动化任务/启动项/服务。

const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const updater = require('./updater/updater.cjs')

const APP_DIR = __dirname
const DEFAULT_PORT = 3080
const TARGET_URL = `http://127.0.0.1:${DEFAULT_PORT}`
const LOG_FILE = path.join(APP_DIR, 'app.log')

// ---- carrier server (HTTP bridge, replaces preload IPC) ----
const DEFAULT_DESKTOP_PORT = 24000
let mainWindow = null

function carrierPort() {
  const cfg = readAppConfig()
  return Number.isInteger(cfg.desktopPort) ? cfg.desktopPort : DEFAULT_DESKTOP_PORT
}

// ---- Chromium flags (before process init) ----
// Force animations ON: override Windows ease-of-access reduced-motion.
app.commandLine.appendSwitch('force-prefers-reduced-motion', 'no-preference')
// Chromium variant fallback for Electron 33+:
app.commandLine.appendSwitch('prefers-reduced-motion', 'no-preference')
// Keep rendering active even when the window is unfocused/backgrounded:
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

// ---- Rule 1: keep every Electron/Chromium write off C: ----
const USER_DATA = path.join(APP_DIR, 'userdata')
fs.mkdirSync(USER_DATA, { recursive: true })  // 单实例锁依赖该目录存在
app.setPath('userData', USER_DATA)

// ---- resolved runtime values (env-first, generic fallbacks) ----
const repoCandidate = (p) => p && fs.existsSync(path.join(p, 'apps', 'cli', 'src', 'bin.ts'))

function repoExtractTarget() {
  return path.join(APP_DIR, 'repo')
}

function resolveRepo() {
  // 1) 已解压的 repo（APP_DIR 或 G 盘）
  const extracted = repoExtractTarget()
  if (repoCandidate(extracted)) return extracted
  // 2) 打包路径（electron-builder extraResources 直接目录）
  const packaged = process.resourcesPath ? path.join(process.resourcesPath, 'dsh-repo') : null
  if (packaged && repoCandidate(packaged)) return packaged
  // 3) 环境变量 DSH_REPO
  if (process.env.DSH_REPO && repoCandidate(process.env.DSH_REPO)) return process.env.DSH_REPO
  // 4) dev sibling
  const sibling = path.join(APP_DIR, '..', 'deepseek-harness')
  if (repoCandidate(sibling)) return sibling
  return process.env.DSH_REPO || sibling
}

let REPO = resolveRepo()  // 如果已解压或 env 指定则直接取到，否则 null（首跑需解压）
const HOME = process.env.DSH_HOME || path.join(APP_DIR, '..', '..', 'dsh-home')

// Official DeepSeek Harness Node floor (root package.json engines):
//   "^22.19.0 || >=24.0.0"
// dsh's bundled code ESM-imports `parseEnv` from node:util, which Node 22.9+
// exports; on v20 this throws at load, so TDSH must pick a compliant Node.
// Resolution order: $DSH_NODE → config.json "node" → `node` on PATH.
const NODE_OK = (major, minor) => major >= 24 || (major === 22 && minor >= 19)

function readAppConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf8')) } catch { return {} }
}

function nodeVersion(bin) {
  try {
    const out = require('node:child_process').spawnSync(bin, ['--version'], { timeout: 5000, encoding: 'utf8' })
    if (out.status !== 0 || !out.stdout) return null
    const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(out.stdout.trim())
    return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null
  } catch { return null }
}

function resolveNodeBin() {
  const packaged = process.resourcesPath ? path.join(process.resourcesPath, 'portable-node', 'node.exe') : null
  if (packaged && fs.existsSync(packaged)) {
    const v = nodeVersion(packaged)
    if (v && NODE_OK(v.major, v.minor)) {
      log(`node resolved: ${packaged} (v${v.major}.${v.minor}.${v.patch})`)
      return { bin: packaged, version: v }
    }
    if (v) log(`packaged node rejected (too old for dsh): ${packaged} v${v.major}.${v.minor}.${v.patch}`)
    else log(`packaged node unavailable: ${packaged}`)
  }
  const cfg = readAppConfig()
  const candidates = [process.env.DSH_NODE, cfg.node, 'node'].filter(Boolean)
  for (const bin of candidates) {
    const v = nodeVersion(bin)
    if (v && NODE_OK(v.major, v.minor)) {
      log(`node resolved: ${bin} (v${v.major}.${v.minor}.${v.patch})`)
      return { bin, version: v }
    }
    if (v) log(`node candidate rejected (too old for dsh): ${bin} v${v.major}.${v.minor}.${v.patch}`)
    else log(`node candidate unavailable: ${bin}`)
  }
  return null
}

let NODE_BIN = null
let NODE_VER = null

let serverChild = null

function log(msg) {
  const line = `${new Date().toISOString()}  ${msg}`
  try { fs.appendFileSync(LOG_FILE, line + '\n') } catch { /* best effort */ }
  console.log(line)
}

function httpUp(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.setTimeout(timeoutMs || 1500, () => { req.destroy(); resolve(false) })
  })
}

function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const poll = async () => {
      if (await httpUp(url, 1000)) return resolve(true)
      if (Date.now() > deadline) return resolve(false)
      setTimeout(poll, 400)
    }
    poll()
  })
}

const DSH_URL_LINE = /dsh web: http:\/\/127\.0\.0\.1:(\d+)/g

function startServer() {
  // NODE_BIN resolved in whenReady; spawn mode picks a compliant Node or bails
  // with a clear dialog (never a silent v20 parseEnv crash).
  if (!NODE_BIN) {
    log('spawn aborted: no compliant Node (need ^22.19.0 || >=24.0.0)')
    return Promise.resolve(null)
  }
  const bin = path.join(REPO, 'apps', 'cli', 'src', 'bin.ts')
  const args = ['--import', 'tsx/esm', bin, 'web', '--port', '0']
  log(`spawn dsh web: ${NODE_BIN} ${args.join(' ')}  cwd=${REPO}`)
  serverChild = spawn(NODE_BIN, args, {
    cwd: REPO,
    env: { ...process.env, DSH_HOME: HOME },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  serverChild.stdout.on('data', (d) => { const s = String(d); log(`[server] ${s.trim()}`) })
  serverChild.stderr.on('data', (d) => { const s = String(d); log(`[server-err] ${s.trim()}`) })

  return new Promise((resolve) => {
    // Single-shot settle: resolve exactly once, on the first authoritative URL
    // line, on spawn error, on premature exit, or on the 90s fuse.
    let settled = false
    const settle = (value) => {
      if (settled) return
      settled = true
      clearInterval(fuse)
      try {
        if (serverChild) {
          serverChild.stdout.removeAllListeners('data')
          serverChild.stderr.removeAllListeners('data')
          serverChild.removeListener('error', onSpawnError)
          serverChild.removeListener('exit', onExit)
        }
      } catch { /* best effort cleanup */ }
      resolve(value)
    }
    const onSpawnError = (e) => {
      log(`dsh web spawn error: ${e.message}`)
      settle(null)
    }
    const onExit = (code, sig) => {
      log(`dsh web exited code=${code} signal=${sig}`)
      // Expose early failures (e.g. missing node/tsx) instead of waiting 90s.
      if (!settled) settle(null)
      serverChild = null
    }
    serverChild.on('error', onSpawnError)
    serverChild.on('exit', onExit)

    const fuse = setInterval(() => settle(null), 90000)
    let pending = ''
    serverChild.stdout.on('data', (d) => {
      pending += String(d)
      // Anchor on the exact CLI prefix so unrelated 127.0.0.1:port text cannot
      // hijack the match; reset lastIndex and re-scan from the authoritative prefix.
      DSH_URL_LINE.lastIndex = 0
      const m = DSH_URL_LINE.exec(pending)
      if (m) {
        settle(`http://127.0.0.1:${m[1]}`)
      }
    })
  })
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'DSH 桌面端',
    icon: path.join(APP_DIR, 'assets', 'icon.ico'),
    // Hidden title bar (no OS overlay): the dsh-window-controls and
    // dsh-version-label client plugins (HTTP carrier) render custom window
    // controls and drag region — Hanako style.
    titleBarStyle: 'hidden',
    backgroundColor: '#0D0E12',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = win
  win.on('closed', () => { if (mainWindow === win) mainWindow = null })
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target)
    return { action: 'deny' }
  })
  win.on('page-title-updated', (e) => e.preventDefault())
  // Allow only the local GUI origin in the main frame; anything else opens
  // in the system browser.
  win.webContents.on('will-navigate', (e, target) => {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?([\/?]|$)/.test(target)) {
      e.preventDefault()
      shell.openExternal(target)
    }
  })
  win.loadURL(withDesktopParams(url))
  log(`window opened -> ${withDesktopParams(url)}`)
  win.focus()
  // Timed screenshot diagnostic: capture what's actually composited on screen
  // (works even when the renderer main thread is blocked/deadlocked).
  if (process.env.DSH_SHOT === '1') {
    ;[12000, 24000].forEach((ms) => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage()
          const p = path.join(APP_DIR, `shot${ms}.png`)
          fs.writeFileSync(p, img.toPNG())
          log(`shot saved: ${p}`)
        } catch (e) { log(`shot failed@${ms}: ${e.message}`) }
      }, ms)
    })
  }
  win.webContents.on('console-message', (e, level, msg, line, sourceId) => {
    log(`[renderer ${['verbose','info','warning','error'][level]||level}] ${msg} (${sourceId}:${line})`)
  })
  win.webContents.on('did-fail-load', (e, code, desc, url) => {
    log(`[load-fail] code=${code} desc=${desc} url=${url}`)
  })
  win.webContents.on('unhandled-rejection', (e, promise, reason) => {
    log(`[unhandled-rejection] ${reason}`)
  })
  win.webContents.on('crashed', () => { log('[renderer CRASHED]') })
  win.webContents.on('render-process-gone', (e, details) => {
    log(`[renderer-gone] reason=${details.reason} exitCode=${details.exitCode}`)
  })
  // NOTE: executeJavaScript-based state capture was causing hangs with stuck renderer.
// Use --remote-debugging-port=9222 for external diagnosis instead.

  // Force the page's media query to "no reduced motion" via CDP: reliably
  // revives CSS animations that Windows ease-of-access would otherwise stop.
  try {
    const dbg = win.webContents.debugger
    dbg.attach('1.3')
    const applyMedia = () => {
      try {
        dbg.sendCommand('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
        })
      } catch (e) { log(`emulated media apply failed: ${e.message}`) }
    }
    win.webContents.on('did-finish-load', applyMedia)
    applyMedia()
  } catch (e) { log(`debugger attach failed: ${e.message}`) }

  // Dev/verification hook: DSH_CAPTURE=1 → screenshot after GUI load, then quit.
  if (process.env.DSH_CAPTURE === '1') {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage()
          const p = path.join(APP_DIR, 'capture.png')
          fs.writeFileSync(p, img.toPNG())
          log(`capture saved: ${p}`)
        } catch (e) { log(`capture failed: ${e.message}`) } finally { app.quit() }
      }, 15000)
    })
  }
  // Dev/verification hook: DSH_DOMDUMP=1 → dump GUI DOM structure, then quit.
  if (process.env.DSH_DOMDUMP === '1') {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const dump = await win.webContents.executeJavaScript(`(async () => {
            // Reproduce the empty/new-session view where the "Deep diving"
            // blue animation lives: open a fresh conversation if not already.
            const newBtn = [...document.querySelectorAll('button,[role="button"],a')].find((e) => {
              const t = (e.textContent || '').trim()
              return t.includes('新会话') || t.includes('新建会话')
            })
            let clickedNew = false
            if (newBtn) {
              newBtn.click()
              clickedNew = true
              await new Promise((r) => setTimeout(r, 2500))
            }
            const esc = (s) => String(s || '').replace(/\\n/g, ' ').slice(0, 60)
            const top = [...document.body.querySelectorAll('body > *')].slice(0, 20).map(n => ({
              tag: n.tagName, cls: (n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className) || '',
            }))
            // animation probe
            const raf = await Promise.race([
              new Promise((res) => {
                const t0 = performance.now()
                requestAnimationFrame(() => requestAnimationFrame((t1) => res(Math.round((t1 - t0) * 10) / 10)))
              }),
              new Promise((res) => setTimeout(() => res(-1), 3000)),
            ])
            const anims = [...document.querySelectorAll('*')].filter((el) => {
              const s = getComputedStyle(el)
              return s.animationName !== 'none' && s.animationName !== ''
            }).slice(0, 25).map((el) => {
              const s = getComputedStyle(el)
              const r = el.getBoundingClientRect()
              return { tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '', anim: s.animationName, dur: s.animationDuration, state: s.animationPlayState, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
            })
            const smil = { animate: document.querySelectorAll('svg animate, svg animateTransform, svg animateMotion').length, svgs: document.querySelectorAll('svg').length }
            const canvases = [...document.querySelectorAll('canvas')].map((c) => {
              let gl = false
              try { gl = !!(c.getContext('webgl') || c.getContext('experimental-webgl')) } catch {}
              return { w: c.width, h: c.height, webgl: gl }
            })
            const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
            const vis = { state: document.visibilityState, hidden: document.hidden }
            const dives = [...document.querySelectorAll('*')].filter((el) => {
              const t = (el.textContent || '').toLowerCase()
              return (t.includes('deep diving') || t.includes('diving') || t.includes('deepseek')) && el.children.length > 0 && el.children.length < 6
            }).slice(0, 12).map((el) => {
              const r = el.getBoundingClientRect()
              return { tag: el.tagName, cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '', text: esc(el.textContent), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
            })
            return JSON.stringify({ title: document.title, top, clickedNew, rafMs: raf, anims, smil, canvases, reduced, vis, dives }, null, 1)
          })()`)
          fs.writeFileSync(path.join(APP_DIR, 'domdump.json'), dump)
          log('domdump saved')
        } catch (e) { log(`domdump failed: ${e.message}`) } finally { app.quit() }
      }, 15000)
    })
  }
  // Dev/verification hook: DSH_MORPHCHECK=1 → verify morph state (session-log
  // button hidden, win-controls pill, header drag region), then quit.
  if (process.env.DSH_MORPHCHECK === '1') {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const report = await win.webContents.executeJavaScript(`(async () => {
            const btn = [...document.querySelectorAll('button')].find(b => /^session\\s*log$/i.test((b.textContent || '').trim()))
            const wc = document.getElementById('dsh-wincontrols')
            const header = document.querySelector('header')
            const strip = document.getElementById('dsh-dragstrip')
            const rectOf = (el) => el ? (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })() : null
            const before = rectOf(wc)
            // simulate a window resize (narrower) and re-read the pill position
            try { window.resizeTo(854, 700) } catch {}
            await new Promise((r) => setTimeout(r, 1000))
            const after = rectOf(wc)
            return JSON.stringify({
              sessionLogButtonGone: !btn,
              sessionLogHidden: !!btn && getComputedStyle(btn).visibility === 'hidden',
              winControls: wc ? { present: true, buttons: wc.children.length } : { present: false },
              pillBefore: before,
              pillAfterResize: after,
              headerDrag: header ? header.style.getPropertyValue('-webkit-app-region') : null,
              stripPresent: !!strip,
            }, null, 1)
          })()`)
          fs.writeFileSync(path.join(APP_DIR, 'morphcheck.json'), report)
          log('morphcheck saved')
        } catch (e) { log(`morphcheck failed: ${e.message}`) } finally { app.quit() }
      }, 15000)
    })
  }
  // Dev/verification hook: DSH_SETTINGSDUMP=1 → open Settings, dump its tree, quit.
  if (process.env.DSH_SETTINGSDUMP === '1') {
    win.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const dump = await win.webContents.executeJavaScript(`(async () => {
            const esc = (s) => String(s || '').replace(/\\n/g, ' ').slice(0, 60)
            // open settings via the sidebar-foot settings button (text 设置, bottom area), then dump
            // open settings: click the real BUTTON whose trimmed text is 设置 at the
// sidebar foot (container divs named settingsArea are not clickable);
// retry up to 3 times until the settings markers appear.
            const findBtn = () => [...document.querySelectorAll('button')].find((b) => {
              const r = b.getBoundingClientRect()
              return (b.textContent || '').trim().endsWith('设置') && r.x < 300 && r.y > window.innerHeight - 200 && r.width > 5
            })
            const openSettings = async () => {
              for (let i = 0; i < 3; i++) {
                const btn = findBtn()
                if (btn) { btn.click(); await new Promise((r) => setTimeout(r, 2000)) }
                const mk = [...document.querySelectorAll('button,[role="button"]')].some((e) => /^(通用|模型|插件|关于|General|Models|Plugins|About)$/.test((e.textContent || '').trim()))
                if (mk) return true
              }
              return false
            }
            const opened = await openSettings()
            const clicked = opened ? 'settings-opened' : 'settings-not-opened'
            const markers = [...document.querySelectorAll('button,[role="button"],[role="tab"]')]
              .filter((e) => e.offsetParent !== null && /^(通用|模型|插件|关于|General|Models|Plugins|About)$/.test((e.textContent || '').trim()))
              .map((e) => {
                const r = e.getBoundingClientRect()
                const cls = (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || ''
                return { t: (e.textContent || '').trim(), tag: e.tagName, cls, html: e.outerHTML.slice(0, 700), x: Math.round(r.x), y: Math.round(r.y) }
              })
            const injected = !!document.getElementById('dsh-sessionlog-settings')
            const injectedTxt = injected ? (document.getElementById('dsh-sessionlog-settings').textContent || '') : ''
            const injectedHtml = injected ? document.getElementById('dsh-sessionlog-settings').outerHTML.slice(0, 300) : ''
            return JSON.stringify({ clicked, markers, injected, injectedTxt, injectedHtml }, null, 1)
          })()`)
          fs.writeFileSync(path.join(APP_DIR, 'settingsdump.json'), dump)
          log('settingsdump saved')
        } catch (e) { log(`settingsdump failed: ${e.message}`) } finally { app.quit() }
      }, 15000)
    })
  }
  return win
}

// ---- carrier server (native HTTP bridge — replaces the preload IPC bridge) ----
// Exposes Electron capabilities (version / window controls / updater) to the
// renderer via a fixed local port. CORS-open so the renderer origin
// (http://127.0.0.1:<random dsh web port>) can call it directly.
let carrierServer = null

function currentWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  return BrowserWindow.getAllWindows()[0] || null
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > 1e5) { reject(new Error('body too large')); req.destroy() }
    })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { reject(new Error('invalid JSON')) } })
    req.on('error', reject)
  })
}

function jsonError(res, status, message) {
  res.writeHead(status, corsHeaders())
  res.end(JSON.stringify({ ok: false, error: message }))
}

function routeWinAction(res, action) {
  const win = currentWindow()
  if (!win) return jsonError(res, 500, 'no window')
  if (action === 'minimize') win.minimize()
  else if (action === 'maximize') { if (win.isMaximized()) win.unmaximize(); else win.maximize() }
  else if (action === 'close') win.close()
  else if (action === 'reload') win.webContents.reload()
  else return jsonError(res, 400, 'unknown action: ' + action)
  res.writeHead(200, corsHeaders())
  res.end(JSON.stringify({ ok: true }))
}

function routeUpdateAction(res, action) {
  if (action === 'check') updater.check()
  else if (action === 'download') updater.download()
  else if (action === 'install') updater.install()
  else return jsonError(res, 400, 'unknown action: ' + action)
  res.writeHead(200, corsHeaders())
  res.end(JSON.stringify({ ok: true }))
}

function startCarrier() {
  const port = carrierPort()
  carrierServer = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      res.end()
      return
    }
    let pathname
    try { pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname } catch { return jsonError(res, 400, 'bad url') }
    if (req.method === 'GET' && pathname === '/__tdsh/meta') {
      res.writeHead(200, corsHeaders())
      res.end(JSON.stringify({ version: app.getVersion() }))
      return
    }
    if (req.method === 'GET' && pathname === '/__tdsh/win') {
      const win = currentWindow()
      res.writeHead(200, corsHeaders())
      res.end(JSON.stringify({ maximized: win ? win.isMaximized() : false }))
      return
    }
    if (req.method === 'POST' && pathname === '/__tdsh/win') {
      readBody(req).then((body) => routeWinAction(res, body && body.action)).catch((e) => jsonError(res, 400, e.message))
      return
    }
    if (req.method === 'GET' && pathname === '/__tdsh/update') {
      res.writeHead(200, corsHeaders())
      res.end(JSON.stringify(updater.getStatus()))
      return
    }
    if (req.method === 'POST' && pathname === '/__tdsh/update') {
      readBody(req).then((body) => routeUpdateAction(res, body && body.action)).catch((e) => jsonError(res, 400, e.message))
      return
    }
    if (req.method === 'GET' && pathname === '/__tdsh/agent') {
      routeGlobalAgentGet(res)
      return
    }
    if (req.method === 'POST' && pathname === '/__tdsh/agent') {
      readBody(req).then((body) => routeGlobalAgentSave(res, body && body.content)).catch((e) => jsonError(res, 400, e.message))
      return
    }
    jsonError(res, 404, 'not found')
  })
  carrierServer.on('error', (e) => {
    log(`carrier server error: ${e.message}`)
    carrierServer = null
  })
  carrierServer.listen(port, '127.0.0.1', () => {
    log(`carrier server listening on http://127.0.0.1:${port}`)
  })
}

function stopCarrier() {
  if (carrierServer) {
    try { carrierServer.close() } catch { /* best effort */ }
    carrierServer = null
  }
}

function withDesktopParams(url) {
  const u = new URL(url)
  u.searchParams.set('dshDesktopVersion', app.getVersion())
  u.searchParams.set('dshDesktopPort', String(carrierPort()))
  return u.toString()
}

// ---- /__tdsh/agent: global AGENTS.md read/write ----
function routeGlobalAgentGet(res) {
  const agentPath = path.join(HOME, 'AGENTS.md')
  try {
    const content = fs.existsSync(agentPath) ? fs.readFileSync(agentPath, 'utf8') : ''
    res.writeHead(200, corsHeaders())
    res.end(JSON.stringify({ content }))
  } catch (e) {
    jsonError(res, 500, e.message)
  }
}

function routeGlobalAgentSave(res, content) {
  if (typeof content !== 'string') { jsonError(res, 400, 'content must be a string'); return }
  const agentPath = path.join(HOME, 'AGENTS.md')
  try {
    // Ensure HOME directory exists
    if (!fs.existsSync(HOME)) fs.mkdirSync(HOME, { recursive: true })
    fs.writeFileSync(agentPath, content, 'utf8')
    res.writeHead(200, corsHeaders())
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    jsonError(res, 500, e.message)
  }
}

// ---- splash window ----
let splashWin = null
// ---- tar.gz 首跑解压（HanaAgent 模式：打包为单文件，首次运行解压到非 C 盘） ----
// 打包用 tar -czf（保留 symlink，不 dereference），解压用 tar -xzf。
async function extractTarball() {
  const tarball = process.resourcesPath ? path.join(process.resourcesPath, 'dsh-repo.tar.gz') : null
  if (!tarball || !fs.existsSync(tarball)) return false
  const target = repoExtractTarget()
  if (repoCandidate(target)) {
    log('repo already extracted: ' + target)
    return true
  }
  log(`extracting ${tarball} (${fs.statSync(tarball).size} bytes) to ${target} ...`)
  // 半成品清理：如果目录存在但 repo 不完整，删干净重来（防止 U 盘断开的残留）
  if (fs.existsSync(target)) { fs.rmSync(target, { recursive: true, force: true }) }
  fs.mkdirSync(target, { recursive: true })
  return new Promise((resolve) => {
    const child = spawn('tar', ['-xzf', tarball, '-C', target], {
      timeout: 60 * 60 * 1000,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    // 无 -v flag：避免 Windows pipe buffer 死锁（71K 文件输出填满 64KB pipe → tar 阻塞）
    // 进度用简单旋转指示，不依赖 stdout 计数
    const frames = ['|', '/', '-', '\\']
    let frameIdx = 0
    const interval = setInterval(() => {
      if (splashWin && !splashWin.isDestroyed()) {
        const spinner = frames[frameIdx++ % frames.length]
        splashWin.webContents.executeJavaScript(
          `document.getElementById('status').textContent = '${spinner} 正在解压中（约 3-6 分钟）';` +
          `document.getElementById('status').style.opacity = '1';` +
          `document.getElementById('progress-wrap').style.opacity = '1';` +
          `document.getElementById('progress-fill').style.width = '50%';` +
          `document.getElementById('progress-fill').style.animation = 'progress-indeterminate 2s ease-in-out infinite';`
        ).catch(() => {})
      }
    }, 500)
    child.on('close', (code) => {
      clearInterval(interval)
      if (code === 0) {
        log(`extracted successfully: ${target}`)
        resolve(true)
      } else {
        const err = String(child.stderr?.read() || child.stdout?.read() || '').slice(0, 800)
        log(`tar extract failed: status=${code} err=${err}`)
        try { fs.rmSync(target, { recursive: true, force: true }) } catch {}
        resolve(false)
      }
    })
    child.on('error', (e) => {
      clearInterval(interval)
      log(`tar spawn error: ${e.message}`)
      try { fs.rmSync(target, { recursive: true, force: true }) } catch {}
      resolve(false)
    })
  })
}


// ---- profile bootstrap: create DSH_HOME/profiles/web with TDSH plugins ----
// dsh web's profile system uses `require.resolve.paths` to find bundles
// in node_modules/.  No pnpm/npm install needed — just copy plugin dirs in
// and write the manifest + workspace yaml pointing to the extracted repo.
// Also creates home-level settings.yaml and .credentials.yaml templates.
const TDSH_PLUGINS = [
  'dsh-update-btn',
  'dsh-window-controls',
  'dsh-version-label',
  'dsh-session-log',
  'dsh-global-agent',
  'dsh-plugin-nong',
  'dsh-plugin-everything',
]

function ensureProfile(homeDir, repoDir) {
  const profileDir = path.join(homeDir, 'profiles', 'web')
  const manifestPath = path.join(profileDir, 'package.json')
  if (fs.existsSync(manifestPath)) {
    log('profile already exists: ' + profileDir)
    return
  }
  log('bootstrapping profile: ' + profileDir)
  fs.mkdirSync(profileDir, { recursive: true })

  // Write profile manifest with TDSH plugin bundles
  fs.writeFileSync(manifestPath, JSON.stringify({
    name: 'dsh-profile-web',
    private: true,
    dsh: {
      profile: {
        bundles: [
          '@deepseek-ai/dsh-base',
          '@deepseek-ai/dsh-web-app',
          'dsh-update-btn',
          'dsh-window-controls',
          'dsh-version-label',
          'dsh-session-log',
          'dsh-global-agent',
          'dsh-plugin-nong',
          'dsh-plugin-everything',
        ],
      },
    },
  }, null, '  ') + '\n')
  log('profile manifest written: ' + manifestPath)

  // Empty profile root (patches stacked on top)
  fs.writeFileSync(path.join(profileDir, 'cordis.yml'), '[]\n')
  fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), '[]\n')

  // Copy TDSH plugins into profile's node_modules — resolveBundleDir
  // finds them via require.resolve.paths looking for package.json.
  const nm = path.join(profileDir, 'node_modules')
  fs.mkdirSync(nm, { recursive: true })
  for (const p of TDSH_PLUGINS) {
    const src = path.join(APP_DIR, 'dsh-plugins', p)
    const dst = path.join(nm, p)
    if (fs.existsSync(src)) {
      fs.cpSync(src, dst, { recursive: true })
      log('copied plugin: ' + p + ' -> ' + dst)
    } else {
      log('WARNING: plugin source not found: ' + src)
    }
  }

  // Write workspace yaml pointing to the extracted dsh-repo
  const repo = repoDir.replace(/\\/g, '/')
  fs.writeFileSync(path.join(profileDir, 'pnpm-workspace.yaml'),
    'packages:\n' +
    '  - \'' + repo + '/packages/*/*\'\n' +
    '  - \'' + repo + '/apps/web\'\n' +
    'nodeLinker: hoisted\n' +
    'autoInstallPeers: false\n')
  log('workspace yaml written (repo: ' + repo + ')')
}

function ensureHomeConfig(homeDir) {
  fs.mkdirSync(homeDir, { recursive: true })
  // Write settings.yaml template if not present
  const settingsPath = path.join(homeDir, 'settings.yaml')
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath,
`ui-onboarding:
  welcomeNoticeVersion: 2026-08-13.1
ui-theme:
  preference: dark
agent-presets:
  default: standard
permission:
  defaultPreset: danger-full-access
ui-conversation:
  busyEnter: steer
`)
    log('settings.yaml template written: ' + settingsPath)
  }

  // Write credentials template if not present
  const credPath = path.join(homeDir, '.credentials.yaml')
  if (!fs.existsSync(credPath)) {
    fs.writeFileSync(credPath,
`# 在此填写你的 API Key
# 格式: KEY_NAME: your-api-key-here
# 示例:
# A_API_KEY: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
`)
    log('credentials template written: ' + credPath)
  }

  // Write home-level cordis.patch.yml if not present
  const patchPath = path.join(homeDir, 'cordis.patch.yml')
  if (!fs.existsSync(patchPath)) {
    fs.writeFileSync(patchPath, '[]\n')
    log('home cordis.patch.yml written: ' + patchPath)
  }

  // Ensure shipped agent-presets available in home: copy agent-presets/*
  // (e.g. nong 弄就行了) into <home>/.agent-presets/<id>. Pure-BOM copy on
  // first run only; local edits in .agent-presets are never overwritten.
  const shippedPresetsDir = path.join(APP_DIR, 'agent-presets')
  const userPresetsDir = path.join(homeDir, '.agent-presets')
  try {
    if (fs.existsSync(shippedPresetsDir)) {
      for (const id of fs.readdirSync(shippedPresetsDir)) {
        const src = path.join(shippedPresetsDir, id)
        const dst = path.join(userPresetsDir, id)
        if (!fs.statSync(src).isDirectory()) continue
        if (!fs.existsSync(dst)) {
          fs.mkdirSync(userPresetsDir, { recursive: true })
          fs.cpSync(src, dst, { recursive: true })
          log('copied agent-preset: ' + id + ' -> ' + dst)
        }
      }
    }
  } catch (e) {
    log('agent-preset copy failed: ' + e.message)
  }
}

function showSplash() {
  splashWin = new BrowserWindow({
    width: 400,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    show: false,
    webPreferences: { sandbox: true }
  })
  var logo = fs.readFileSync(path.join(APP_DIR, 'assets', 'deepseek-whale.svg'), 'utf8')
  logo = logo.replace(/<style>[\s\S]*?<\/style>/g, '')
             .replace(/<path /g, '<path fill="#ffffff" ')
  var html = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8"><style>',
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'body { background:#0D0E12; display:flex; flex-direction:column; align-items:center; justify-content:center;',
    '       height:100vh; color:#C0C4CC; font-family:-apple-system,sans-serif; border-radius:16px; overflow:hidden; user-select:none; }',
    '.logo { margin-bottom:20px; opacity:0; animation:fadeIn .6s ease forwards; }',
    '.logo svg { width:64px; height:64px; }',
    '.logo svg path { fill:#ffffff !important; }',
    '.slogan { font-size:18px; font-weight:500; color:#E8EAF0; letter-spacing:4px; margin-bottom:16px; opacity:0; animation:fadeIn .6s .2s ease forwards; }',
    '.dots { display:flex; gap:8px; margin-bottom:16px; }',
    '.dot { width:10px; height:10px; border-radius:50%; background:#4FC3F7; animation:bounce 1.4s infinite ease-in-out both; }',
    '.dot:nth-child(1){ animation-delay:-0.32s; } .dot:nth-child(2){ animation-delay:-0.16s; } .dot:nth-child(3){ animation-delay:0s; }',
    '@keyframes bounce { 0%,80%,100%{ transform:scale(0); } 40%{ transform:scale(1); } }',
    '@keyframes fadeIn { to{ opacity:1; } }',
    '#status { font-size:13px; color:#6B7280; margin-top:8px; opacity:0; transition:opacity .3s; }',
    '#progress-wrap { width:240px; height:4px; background:#1F2937; border-radius:2px; margin-top:10px; overflow:hidden; opacity:0; transition:opacity .3s; }',
    '#progress-fill { width:0%; height:100%; background:#4FC3F7; border-radius:2px; }',
    '@keyframes progress-indeterminate { 0%{ width:20%; } 50%{ width:70%; } 100%{ width:20%; } }',
    '</style></head>',
    '<body>',
    '<div class="logo">' + logo + '</div>',
    '<div class="slogan">\u63A2\u7D22\u672A\u81F3\u4E4B\u5883</div>',
    '<div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>',
    '<div id="status"></div>',
    '<div id="progress-wrap"><div id="progress-fill"></div></div>',
    '</body></html>'
  ].join('\n')
  splashWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  splashWin.once('ready-to-show', () => {})
  splashWin.show()
}
function closeSplash() {
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.close()
    splashWin = null
  }
}

// ---- single instance ----
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) {
      if (w.isMinimized()) w.restore()
      // A hidden-but-alive window is a silent-lock trap: restore() cannot
      // re-show it and focus() alone is a no-op, so the user's second
      // launch appears dead while an instance keeps running. Always re-show.
      if (!w.isVisible()) w.show()
      w.focus()
    }
  })

  app.whenReady().then(async () => {
    showSplash()
    // 让 splash 渲染完成后再开始阻塞解压，否则用户看不到窗口
    await new Promise(r => setImmediate(r))
    // 确保 repo 已解压（tar.gz 首跑提取）
    if (!repoCandidate(REPO)) {
      log('repo not ready, need to extract tar.gz')
      if (await extractTarball()) {
        REPO = resolveRepo()
        log(`repo after extraction: ${REPO}`)
      } else {
        closeSplash()
        dialog.showErrorBox('DSH 桌面端', '无法解压 dsh-repo.tar.gz，请确保有足够磁盘空间。')
        app.quit()
        return
      }
    }
    // 确保 DSH_HOME 存在且有基础配置（settings.yaml, .credentials.yaml, cordis.patch.yml）
    try { ensureHomeConfig(HOME) } catch (e) { log('home config bootstrap failed: ' + e.message) }
    // 确保 profile 存在且有 TDSH 插件（首次运行自动创建）
    if (REPO) { try { ensureProfile(HOME, REPO) } catch (e) { log('profile bootstrap failed: ' + e.message) } }
    log(`startup: repo=${REPO} home=${HOME} target=${TARGET_URL}`)
    const node = resolveNodeBin()
    if (node) { NODE_BIN = node.bin; NODE_VER = node.version } else { NODE_BIN = null; NODE_VER = null }
    // 初始化自动更新（后台静默检查，不影响启动）
    try { updater.init() } catch (e) { log('updater init failed: ' + e.message) }
    // 启动 HTTP carrier（替代 preload IPC 桥），渲染进程插件通过它取版本/窗口/更新
    try { startCarrier() } catch (e) { log('carrier start failed: ' + e.message) }
    let url = null
    // DSH_FORCE_SPAWN=1 (dev): always start a fresh server instead of attaching.
    if (process.env.DSH_FORCE_SPAWN === '1' || !(await httpUp(TARGET_URL, 1500))) {
      if (!NODE_BIN) {
        closeSplash()
        dialog.showErrorBox('DSH 桌面端',
          '未找到兼容的 Node.js（需要 ^22.19.0 或 >=24.0.0）。\n\n' +
          '请用以下任一方式指定 Node 路径：\n' +
          '1) 环境变量 DSH_NODE=<node.exe 绝对路径>\n' +
          '2) 应用目录 config.json 添加 "node": "<node.exe 绝对路径>"\n\n' +
          '当前 PATH 上的 node 版本不满足 dsh web 的解析要求（v20 缺少 util.parseEnv 的 ESM 导出）。')
        app.quit()
        return
      }
      url = await startServer()
      if (!url) {
        closeSplash()
        dialog.showErrorBox('DSH 桌面端', '无法启动 dsh web，请查看 ' + LOG_FILE)
        app.quit()
        return
      }
      log('spawn mode: server alive at ' + url)
    } else {
      url = TARGET_URL
      log('attach mode: GUI already alive at ' + TARGET_URL)
    }
    if (!(await waitFor(url, 60000))) {
      closeSplash()
      dialog.showErrorBox('DSH 桌面端', `GUI 未在预期时间内就绪: ${url}`)
      app.quit()
      return
    }
    createWindow(url)
    closeSplash()
  })

  app.on('window-all-closed', () => {
    if (serverChild) { try { serverChild.kill() } catch { /* noop */ } }
    app.quit()
  })
  app.on('will-quit', () => {
    stopCarrier()
    if (serverChild) { try { serverChild.kill() } catch { /* noop */ } }
  })
}