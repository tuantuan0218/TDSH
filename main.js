'use strict'

// DSH 桌面壳 (main process, CommonJS)
// 设计：attach-or-spawn
//   1) 先探测默认 URL 是否已活（例如已有 dsh web 在跑）→ 直接开原生窗口，attach；
//   2) 否则 spawn `dsh web`（--port 0，OS 分配空闲端口），从 stdout 解析真实 URL 后开窗。
// 约束（本机 AGENTS.md）：
//   1) 禁止扩大 C 盘占用：userData / 日志全部落在 APP_DIR（非 C 盘），DSH_HOME 默认 G 盘；
//   2) 不创建任何 Windows 自动化任务/启动项/服务。

const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron')
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

// ---- Chromium flags (before process init) ----
// Force animations ON: override Windows ease-of-access reduced-motion.
app.commandLine.appendSwitch('force-prefers-reduced-motion', 'no-preference')
// Chromium variant fallback for Electron 33+:
app.commandLine.appendSwitch('prefers-reduced-motion', 'no-preference')
// Keep rendering active even when the window is unfocused/backgrounded:
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

// ---- Rule 1: keep every Electron/Chromium write off C: ----
app.setPath('userData', path.join(APP_DIR, 'userdata'))

// ---- resolved runtime values (env-first, generic fallbacks) ----
const repoCandidate = (p) => p && fs.existsSync(path.join(p, 'apps', 'cli', 'src', 'bin.ts'))
function resolveRepo() {
  if (process.env.DSH_REPO && repoCandidate(process.env.DSH_REPO)) return process.env.DSH_REPO
  const sibling = path.join(APP_DIR, '..', 'deepseek-harness')
  if (repoCandidate(sibling)) return sibling
  const legacy = path.join('G:', 'mimocode', 'deepseek-harness')
  if (repoCandidate(legacy)) return legacy
  return process.env.DSH_REPO || sibling
}
const REPO = resolveRepo()
const HOME = process.env.DSH_HOME || path.join('G:', 'mimocode', 'dsh-home')

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
    // Hidden title bar (no OS overlay): the preload injects custom window
    // controls into the GUI's own layout (top-right, where session log used
    // to be) and marks the header as the drag region — Hanako style.
    titleBarStyle: 'hidden',
    backgroundColor: '#0D0E12',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // preload: path.join(APP_DIR, 'preload.js'),  // DISABLED for test
    },
  })
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target)
    return { action: 'deny' }
  })
  win.on('page-title-updated', (e) => e.preventDefault())
  // Allow only the local GUI origin in the main frame; anything else opens
  // in the system browser.
  win.webContents.on('will-navigate', (e, target) => {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?($|\/)/.test(target)) {
      e.preventDefault()
      shell.openExternal(target)
    }
  })
  win.loadURL(url)
  log(`window opened -> ${url}`)
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
  // Dev/verification hook: DSH_MORPHCHECK=1 → verify preload morph state, then quit.
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

// ---- window controls + config IPC (called from preload) ----
ipcMain.on('dsh:minimize', (e) => { BrowserWindow.fromWebContents(e.sender)?.minimize() })
ipcMain.on('dsh:maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (w) {
    if (w.isMaximized()) w.unmaximize(); else w.maximize()
    if (!w.isDestroyed()) w.webContents.send('dsh:maximized', w.isMaximized())
  }
})
ipcMain.on('dsh:close', (e) => { BrowserWindow.fromWebContents(e.sender)?.close() })
ipcMain.on('dsh:get-config', (e) => {
  try { e.returnValue = fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf8') }
  catch { e.returnValue = '{}' }
})
ipcMain.on('dsh:maximized-state', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (w && !w.isDestroyed()) e.returnValue = w.isMaximized()
})

// ---- single instance ----
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w) { if (w.isMinimized()) w.restore(); w.focus() }
  })

  app.whenReady().then(async () => {
    log(`startup: repo=${REPO} home=${HOME} target=${TARGET_URL}`)
    const node = resolveNodeBin()
    if (node) { NODE_BIN = node.bin; NODE_VER = node.version } else { NODE_BIN = null; NODE_VER = null }
    // 初始化自动更新（后台静默检查，不影响启动）
    try { updater.init() } catch (e) { log('updater init failed: ' + e.message) }
    let url = null
    // DSH_FORCE_SPAWN=1 (dev): always start a fresh server instead of attaching.
    if (process.env.DSH_FORCE_SPAWN === '1' || !(await httpUp(TARGET_URL, 1500))) {
      if (!NODE_BIN) {
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
      dialog.showErrorBox('DSH 桌面端', `GUI 未在预期时间内就绪: ${url}`)
      app.quit()
      return
    }
    createWindow(url)
  })

  app.on('window-all-closed', () => {
    if (serverChild) { try { serverChild.kill() } catch { /* noop */ } }
    app.quit()
  })
  app.on('will-quit', () => {
    if (serverChild) { try { serverChild.kill() } catch { /* noop */ } }
  })
}