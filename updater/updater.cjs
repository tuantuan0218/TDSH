'use strict'
// TDSH 自动更新模块（插件式热载入）
// 逻辑模仿 Hanako（electron-updater + GitHub Releases）
// 运行于主进程，通过 IPC 与渲染进程通信

const { autoUpdater, CancellationToken } = require('electron-updater')
const { app, ipcMain, BrowserWindow } = require('electron')
const path = require('node:path')

// ---- 配置 ----
// 构建时由 electron-builder.yml 的 publish 字段覆盖；
// 开发模式手动设置 feed URL
const UPDATE_CONFIG = {
  provider: 'github',
  owner: 'tuantuan0218',
  repo: 'TDSH',
  updaterCacheDirName: 'tdsh-updater',
}

// ---- 状态 ----
let state = 'idle' // idle | checking | available | downloading | downloaded | error
let downloadProgress = 0
let releaseInfo = null
let errorInfo = null
let checkInterval = null
let cancellationToken = null

// ---- 日志 ----
function log(msg) {
  const line = `[updater] ${msg}`
  try { require('node:fs').appendFileSync(path.join(app.getAppPath(), 'app.log'), line + '\n') } catch {}
  console.log(line)
}

// ---- 事件广播 ----
function broadcast(status) {
  const wins = BrowserWindow.getAllWindows()
  for (const w of wins) {
    if (!w.isDestroyed()) {
      try { w.webContents.send('tdsh:update-status', status) } catch {}
    }
  }
}

// ---- 初始化 ----
function init() {
  log('initializing...')

  // 配置 feed URL（开发模式手动设置，构建时由 app-update.yml 覆盖）
  try { autoUpdater.setFeedURL(UPDATE_CONFIG) } catch (e) { log('setFeedURL: ' + e.message) }

  // 日志输出
  autoUpdater.logger = {
    info: (m) => log('[info] ' + m),
    warn: (m) => log('[warn] ' + m),
    error: (m) => log('[error] ' + m),
  }

  // ---- 事件 ----
  autoUpdater.on('checking-for-update', () => {
    state = 'checking'
    log('checking for updates...')
    broadcast({ state, progress: 0 })
  })

  autoUpdater.on('update-available', (info) => {
    state = 'available'
    releaseInfo = info
    log('update available: v' + info.version)
    broadcast({ state, version: info.version, releaseDate: info.releaseDate, progress: 0 })
  })

  autoUpdater.on('update-not-available', (info) => {
    state = 'idle'
    log('up to date')
    broadcast({ state, progress: 0 })
  })

  autoUpdater.on('download-progress', (p) => {
    state = 'downloading'
    downloadProgress = p.percent
    broadcast({ state, progress: Math.round(p.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    state = 'downloaded'
    releaseInfo = info
    cancellationToken = null
    log('update downloaded: v' + info.version)
    broadcast({ state, version: info.version, progress: 100 })
  })

  autoUpdater.on('error', (err) => {
    state = 'error'
    errorInfo = err
    log('update error: ' + err.message)
    broadcast({ state, error: err.message, progress: 0 })
  })

  // ---- IPC 处理 ----
  ipcMain.on('tdsh:check-update', () => {
    log('manual check requested')
    autoUpdater.checkForUpdates().catch((err) => {
      state = 'error'
      errorInfo = err
      log('check failed: ' + err.message)
      broadcast({ state: 'error', error: err.message, progress: 0 })
    })
  })

  ipcMain.on('tdsh:get-update-status', (event) => {
    event.returnValue = getStatus()
  })

  ipcMain.on('tdsh:download-update', () => {
    if (state === 'available') {
      log('downloading update...')
      cancellationToken = new CancellationToken()
      autoUpdater.downloadUpdate(cancellationToken).catch((err) => {
        state = 'error'
        errorInfo = err
        log('download failed: ' + err.message)
        broadcast({ state: 'error', error: err.message, progress: 0 })
      })
    }
  })

  ipcMain.on('tdsh:install-update', () => {
    if (state === 'downloaded') {
      log('installing update...')
      autoUpdater.quitAndInstall(false, true)
    }
  })

  // ---- 定时检查 ----
  // 启动延迟 30 秒后首次检查，之后每 6 小时
  setTimeout(() => {
    log('scheduled check (initial)')
    autoUpdater.checkForUpdates().catch(() => {})
  }, 30000)

  checkInterval = setInterval(() => {
    log('scheduled check (periodic)')
    autoUpdater.checkForUpdates().catch(() => {})
  }, 6 * 60 * 60 * 1000)

  log('initialized')
}

function getStatus() {
  return {
    state,
    progress: downloadProgress,
    version: releaseInfo?.version || null,
    releaseDate: releaseInfo?.releaseDate || null,
    error: errorInfo?.message || null,
  }
}

// 热重载：重置状态（对外接口，main.js 可调用）
function reset() {
  log('reset requested')
  if (checkInterval) clearInterval(checkInterval)
  if (cancellationToken) { cancellationToken.cancel(); cancellationToken = null }
  state = 'idle'
  downloadProgress = 0
  releaseInfo = null
  errorInfo = null
  init()
}

module.exports = { init, getStatus, reset }