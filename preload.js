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
.dsh-pill span{width:26px;height:26px;display:flex;align-items:center;justify-content:center;
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
// Use visibility:hidden (NOT display:none) so the element keeps its layout box
// and getBoundingClientRect() stays live — the pill can track it through resizes.
let sessionLogBtn = null
let winRect = null
function hideSessionLogButton() {
  let btn = sessionLogBtn && sessionLogBtn.isConnected && /^session\s*log$/i.test((sessionLogBtn.textContent || '').trim())
    ? sessionLogBtn
    : [...document.querySelectorAll('button')].find((b) => /^session\s*log$/i.test((b.textContent || '').trim()))
  if (!btn) { sessionLogBtn = null; return null }
  sessionLogBtn = btn
  if (btn.style.visibility !== 'hidden') {
    // visibility:hidden keeps the layout box → live rect for the pill to track.
    btn.style.visibility = 'hidden'
  }
  return btn
}

// Capture the CURRENT live rect of the hidden button (visibility:hidden keeps box).
function captureRect() {
  try {
    if (sessionLogBtn && sessionLogBtn.isConnected) {
      const r = sessionLogBtn.getBoundingClientRect()
      if (r.width > 2 && r.height > 2) winRect = r
    }
  } catch {}
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
  const left = Math.max(4, Math.round(r.left))
  const top = Math.max(2, Math.round(r.top))
  // only write when geometry actually changes (avoid observer self-feedback)
  if (cluster.style.left !== left + 'px') cluster.style.left = left + 'px'
  if (cluster.style.top !== top + 'px') cluster.style.top = top + 'px'
  if (cluster.style.width !== Math.round(r.width) + 'px') cluster.style.width = Math.round(r.width) + 'px'
  if (cluster.style.height !== Math.round(r.height) + 'px') cluster.style.height = Math.round(r.height) + 'px'
  if (cluster.style.background !== '#0D0E12') cluster.style.background = '#0D0E12'
  if (cluster.style.border !== '1px solid #1E1F24') cluster.style.border = '1px solid #1E1F24'
  return cluster
}

// 3) Inject a "会话日志" entry into the Settings panel the first time it opens.
// Re-injects if React later removes it (no permanent one-shot lock).
let settingsInjected = false

// CSS Modules hashes class names (e.g. _55Y5wW_active), so never match a
// literal "_active": drop ANY class token mentioning 'active'.
// IMPORTANT: only write the class attribute when it actually changes, or the
// MutationObserver (attributes:true) would fire on itself → sync loop → hang.
function stripActive(el) {
  const next = [...el.classList].filter((c) => !/active/i.test(c)).join(' ')
  if (next !== el.className) el.className = next
  if (el.getAttribute('aria-current')) el.removeAttribute('aria-current')
}

function injectSettingsEntry() {
  // React may unmount the panel (and our entry) when it closes: a removed node
  // makes getElementById return null, so reset the lock to re-inject next time.
  if (settingsInjected && !document.getElementById('dsh-sessionlog-settings')) {
    settingsInjected = false
  }
  if (settingsInjected) return
  // Native settings nav: button.navCell (icon svg + label) inside a navList.
  // Clone an existing cell so the injected item looks/behaves identically.
  const navList = document.querySelector('[class*="_navList"]')
  if (!navList) return
  // keep the settings-domain guard: only inject inside a settings-ish surface
  if (!navList.closest('[class*="settings" i]')) return
  const cells = [...navList.querySelectorAll('button[class*="_navCell"]')]
  // template = the LAST cell (About/last) — least likely to be the active one
  const template = cells[cells.length - 1]
  if (!template) return
  if (navList.querySelector('#dsh-sessionlog-settings')) { settingsInjected = true; return }
  const item = template.cloneNode(true)
  item.id = 'dsh-sessionlog-settings'
  stripActive(item)
  // Rebuild content: chosen icon (session-log download svg if available, else
  // keep the template's icon) + our label — clear ALL template text first.
  const logSvg = sessionLogBtn && sessionLogBtn.querySelector('svg')
  const tplSvg = item.querySelector('svg')
  const finalSvg = logSvg ? logSvg.cloneNode(true) : (tplSvg || null)
  item.textContent = '' // removes every child incl. template label
  if (finalSvg) item.appendChild(finalSvg)
  item.appendChild(document.createTextNode('会话日志'))
  item.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (sessionLogBtn && sessionLogBtn.isConnected) sessionLogBtn.click()
  })
  navList.appendChild(item)
  settingsInjected = true
}

// The injected Settings entry must never look selected. React re-renders of the
// nav list can re-mark a cloned cell as active — scrub it on every tick.
function sanitizeLogEntry() {
  const el = document.getElementById('dsh-sessionlog-settings')
  if (!el) return
  stripActive(el)
  if (el.getAttribute('aria-selected') === 'true') el.setAttribute('aria-selected', 'false')
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
    captureRect()
    sanitizeLogEntry()
    ensureWinControls(header)
    setupDrag(header)
  } catch { /* retry */ }
}

// Re-anchor the pill on window resize (visibility:hidden keeps the live box).
const onResize = () => {
  try {
    const header = document.querySelector('header')
    if (!header) return
    captureRect()
    ensureWinControls(header)
  } catch { /* keep alive */ }
}

// Instant reactions on React re-renders (kills the resize flicker).
const startObserver = () => {
  const root = document.body || document.documentElement
  if (!root || root.__dshObserved) return
  root.__dshObserved = true
  new MutationObserver(() => {
    try {
      hideSessionLogButton()
      captureRect()
      sanitizeLogEntry()
      const header = document.querySelector('header')
      if (header) { ensureWinControls(header); setupDrag(header) }
      injectSettingsEntry()
    } catch { /* keep alive */ }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true })
  try { window.addEventListener('resize', onResize) } catch {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { try { startObserver() } catch {}; setTimeout(morph, 1500) })
} else {
  try { startObserver() } catch {}
  setTimeout(morph, 1500)
}
setInterval(morph, 3000)