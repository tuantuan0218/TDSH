'use strict'

// DSH 桌面壳 preload v4 — runs in the GUI page's isolated world (shared DOM).
// 1) Fully HIDE the "Session log" header button (keeps its DOM + export
//    behavior), so it can never flash or clutter while the header re-renders.
// 2) Draw a standalone rounded-pill window-control cluster where that button
//    sat (Hanako-style pill look the user chose).
// 3) Inject a "会话日志" entry into the opened Settings panel that re-triggers
//    the (hidden) session-log action — "move it into Settings".
// Idempotent + defensive; MutationObserver makes morphing instant (no flicker).

const { ipcRenderer } = require('electron')

const morphCss = `
#dsh-css{display:none !important;}
.dsh-pill{position:absolute !important;display:flex !important;align-items:center !important;
  justify-content:space-evenly !important;gap:2px !important;padding:2px 3px !important;
  cursor:default !important;-webkit-app-region:no-drag !important;app-region:no-drag !important;
  z-index:9999 !important;border-radius:16px !important;}
.dsh-pill span{width:26px;height:26px;display:flex;items-align:center;align-items:center;justify-content:center;
  color:#9A9DA6;font-size:12px;line-height:1;cursor:default;border-radius:6px;
  font-family:"Segoe MDL2 Assets","Segoe UI",sans-serif;user-select:none;-webkit-app-region:no-drag;}
.dsh-pill span:hover{background:#1E1F24;color:#FFFFFF;}
.dsh-pill span.dsh-close:hover{background:#C42B1C;color:#fff;}
#dsh-dragstrip{position:fixed;top:0;left:0;right:0;height:8px;z-index:99999;-webkit-app-region:drag;}
#dsh-sessionlog-settings{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;
  color:#9A9DA6;background:transparent;border:none;border-radius:8px;text-align:left;cursor:pointer;font:inherit;}
#dsh-sessionlog-settings:hover{background:#1E1F24;color:#fff;}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-play-state: running !important; animation-duration: 0.3s !important;
    animation-delay: 0s !important; transition-duration: 0.2s !important; transition-delay: 0s !important; }
}
`
const injectCss = () => {
  if (document.getElementById('dsh-css')) return
  const st = document.createElement('style')
  st.id = 'dsh-css'
  st.textContent = morphCss
  ;(document.head || document.documentElement).appendChild(st)
}

const glyph = (code) => { const s = document.createElement('span'); s.innerHTML = '&#' + code + ';'; return s }

const wireButtons = (min, max, cls) => {
  min.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ipcRenderer.send('dsh:minimize') })
  max.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ipcRenderer.send('dsh:maximize') })
  cls.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); ipcRenderer.send('dsh:close') })
  ipcRenderer.on('dsh:maximized', (_e, v) => { max.innerHTML = v ? '&#xE923;' : '&#xE922;' })
}

// 1) Hide the "Session log" header button (keep it alive for the Settings entry).
let sessionLogBtn = null
let winRect = null
function hideSessionLogButton() {
  let btn = sessionLogBtn && sessionLogBtn.isConnected && /^session\s*log$/i.test((sessionLogBtn.textContent || '').trim())
    ? sessionLogBtn
    : [...document.querySelectorAll('button')].find((b) => /^session\s*log$/i.test((b.textContent || '').trim()))
  if (!btn) { sessionLogBtn = null; return null }
  sessionLogBtn = btn
  if (btn.style.display !== 'none') {
    // capture the rect BEFORE hiding (a display:none element returns zeros)
    try {
      const r = btn.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) winRect = r
    } catch {}
    btn.style.display = 'none'
  }
  return btn
}

// 2) Window-controls pill, positioned where the hidden button was.
function ensureWinControls(header) {
  let cluster = document.getElementById('dsh-wincontrols')
  if (!cluster) {
    cluster = document.createElement('div')
    cluster.id = 'dsh-wincontrols'
    cluster.className = 'dsh-pill'
    const min = glyph(0xE921), max = glyph(0xE922), cls = glyph(0xE8BB)
    cls.classList.add('dsh-close')
    wireButtons(min, max, cls)
    cluster.append(min, max, cls)
    ;(header || document.body).appendChild(cluster)
  }
  const h = (header || document.body).getBoundingClientRect()
  const r = winRect
    ? { left: winRect.left - h.left, top: winRect.top - h.top, width: winRect.width, height: winRect.height }
    : { left: h.width - 145, top: 10, width: 118, height: 32 }
  cluster.style.left = Math.max(4, Math.round(r.left)) + 'px'
  cluster.style.top = Math.max(2, Math.round(r.top)) + 'px'
  cluster.style.width = Math.round(r.width) + 'px'
  cluster.style.height = Math.round(r.height) + 'px'
  cluster.style.background = '#0D0E12'
  cluster.style.border = '1px solid #1E1F24'
  return cluster
}

// 3) Inject a "会话日志" entry into the Settings panel the first time it opens.
let settingsInjected = false
function injectSettingsEntry() {
  if (settingsInjected) return
  // The settings section list (left-nav of the panel) contains items like 通用/模型/插件.
  // Find a stable container: the element listing a section labelled 通用 or Models.
  let anchor = null
  for (const probe of ['通用', '模型', '插件', 'General', 'Models', 'Plugins']) {
    const el = [...document.querySelectorAll('button,[role="button"],[role="tab"]')].find((e) => {
      const t = (e.textContent || '').trim()
      return (t === probe || t.startsWith(probe)) && e.offsetParent !== null
    })
    if (el) { anchor = el.parentElement || el; break }
  }
  if (!anchor) return
  // Prefer the sibling list container (same parent) for appending.
  const container = anchor.parentElement || anchor
  if (container.querySelector('#dsh-sessionlog-settings')) { settingsInjected = true; return }
  const item = document.createElement('button')
  item.id = 'dsh-sessionlog-settings'
  item.type = 'button'
  item.textContent = '会话日志'
  item.addEventListener('click', () => {
    if (sessionLogBtn && sessionLogBtn.isConnected) sessionLogBtn.click()
  })
  container.appendChild(item)
  settingsInjected = true
}

const setupDrag = (header) => {
  if (header.style.getPropertyValue('-webkit-app-region') !== 'drag') {
    header.style.setProperty('-webkit-app-region', 'drag')
  }
  for (const el of header.querySelectorAll('button,a,input,[role="button"],[role="tab"]')) {
    if (el.getAttribute('app-region') !== 'no-drag' && el.id !== 'dsh-wincontrols') {
      try { el.style.setProperty('-webkit-app-region', 'no-drag'); el.setAttribute('app-region', 'no-drag') } catch {}
    }
  }
}

const morph = () => {
  try {
    injectCss()
    const header = document.querySelector('header')
    if (!header) {
      if (!document.getElementById('dsh-dragstrip')) {
        const strip = document.createElement('div')
        strip.id = 'dsh-dragstrip'
        document.body.appendChild(strip)
      }
      return
    }
    hideSessionLogButton()
    ensureWinControls(header)
    setupDrag(header)
  } catch { /* retry */ }
}

// Instant reactions on React re-renders (kills the resize flicker).
const startObserver = () => {
  const root = document.body || document.documentElement
  if (!root || root.__dshObserved) return
  root.__dshObserved = true
  new MutationObserver(() => {
    try {
      const header = document.querySelector('header')
      hideSessionLogButton()
      if (header) { ensureWinControls(header); setupDrag(header) }
      injectSettingsEntry()
    } catch { /* keep alive */ }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { try { startObserver() } catch {}; setTimeout(morph, 1500) })
} else {
  try { startObserver() } catch {}
  setTimeout(morph, 1500)
}
setInterval(morph, 3000)