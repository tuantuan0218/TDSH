'use strict'
// TDSH 自动更新模块（插件式热载入）
// 逻辑模仿 Hanako（electron-updater + GitHub Releases）
// 运行于主进程，动作通过 HTTP carrier（main.js 的本地端口服务）暴露给渲染进程

const { autoUpdater, CancellationToken } = require('electron-updater')
const { app } = require('electron')
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

// ---- 初始化 ----
function init() {
  log('initializing...')

  // 配置 feed URL（开发模式手动设置，构建时由 app-update.yml 覆盖）
  try { autoUpdater.setFeedURL(UPDATE_CONFIG) } catch (e) { log('setFeedURL: ' + e.message) }

  // 开发模式（electron .）下强制允许检查更新，否则 isUpdaterActive() 恒为 false 直接跳过
  autoUpdater.forceDevUpdateConfig = true
  // 检测到更新后不自动下载；保持按钮停留在蓝色 available 状态，
  // 由用户点击下发 POST /__tdsh/update {action:'download'}（避免 autoDownload 直接进入 404 错误态）
  autoUpdater.autoDownload = false

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
  })

  autoUpdater.on('update-available', (info) => {
    state = 'available'
    releaseInfo = info
    log('update available: v' + info.version)
  })

  autoUpdater.on('update-not-available', () => {
    state = 'idle'
    log('up to date')
  })

  autoUpdater.on('download-progress', (p) => {
    state = 'downloading'
    downloadProgress = p.percent
  })

  autoUpdater.on('update-downloaded', (info) => {
    state = 'downloaded'
    releaseInfo = info
    cancellationToken = null
    log('update downloaded: v' + info.version)
  })

  autoUpdater.on('error', (err) => {
    state = 'error'
    errorInfo = err
    log('update error: ' + err.message)
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

// ---- 动作（由 HTTP carrier 调用：POST /__tdsh/update） ----
function check() {
  log('manual check requested')
  autoUpdater.checkForUpdates().catch((err) => {
    state = 'error'
    errorInfo = err
    log('check failed: ' + err.message)
  })
}

function download() {
  if (state === 'available') {
    log('downloading update...')
    cancellationToken = new CancellationToken()
    autoUpdater.downloadUpdate(cancellationToken).catch((err) => {
      state = 'error'
      errorInfo = err
      log('download failed: ' + err.message)
    })
  }
}

function install() {
  if (state === 'downloaded') {
    log('installing update...')
    autoUpdater.quitAndInstall(false, true)
  }
}

module.exports = { init, getStatus, reset, check, download, install }