'use strict'

// DSH 妗岄潰澹?preload v3 鈥?keeps the GUI's own rounded "Session log" pill,
// replaces its content with the three window-control buttons (min/max/close),
// and makes the conversation <header> the window drag region (Hanako style).
// Idempotent + defensive; no DSH source is modified.

const { ipcRenderer } = require('electron')

const morphCss = `
.dsh-pill{display:flex !important;align-items:center !important;justify-content:space-evenly !important;
  gap:2px !important;padding:2px 3px !important;cursor:default !important;
  -webkit-app-region:no-drag !important;app-region:no-drag !important;}
.dsh-pill:active{outline:none !important;}
.dsh-pill span{width:24px;height:24px;display:flex;align-items:center;justify-content:center;
  color:#9A9DA6;font-size:12px;line-height:1;cursor:default;border-radius:5px;
  font-family:"Segoe MDL2 Assets","Segoe UI",sans-serif;user-select:none;-webkit-app-region:no-drag;}
.dsh-pill span:hover{background:#1E1F24;color:#FFFFFF;}
.dsh-pill span.dsh-close:hover{background:#C42B1C;color:#fff;}
#dsh-wincontrols{position:absolute;display:flex;align-items:center;gap:2px;height:32px;
  -webkit-app-region:no-drag;z-index:9999;}
#dsh-wincontrols span{width:26px;height:26px;display:flex;align-items:center;justify-content:center;
  color:#9A9DA6;font-size:12px;cursor:default;border-radius:5px;font-family:"Segoe MDL2 Assets","Segoe UI",sans-serif;}
#dsh-wincontrols span:hover{background:#1E1F24;color:#fff;}
#dsh-wincontrols span.dsh-close:hover{background:#C42B1C;color:#fff;}
#dsh-dragstrip{position:fixed;top:0;left:0;right:0;height:8px;z-index:99999;-webkit-app-region:drag;}
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
  return { min, max, cls }
}

// Transform the existing "Session log" pill into the window-control cluster.
const morphPill = () => {
  const already = document.querySelector('button.dsh-pill')
  if (already) {
    if (already.children.length === 0) { // React re-created it; rebuild
      const min = glyph(0xE921), max = glyph(0xE922), cls = glyph(0xE8BB)
      cls.classList.add('dsh-close')
      wireButtons(min, max, cls)
      already.append(min, max, cls)
    }
    return true
  }
  const btn = [...document.querySelectorAll('button')].find(b => /^session\s*log$/i.test((b.textContent || '').trim()))
  if (!btn) return false
  if (btn.getAttribute('dsh-morph') === '1') return true
  btn.classList.add('dsh-pill')
  btn.textContent = ''
  const min = glyph(0xE921), max = glyph(0xE922), cls = glyph(0xE8BB)
  cls.classList.add('dsh-close')
  wireButtons(min, max, cls)
  btn.append(min, max, cls)
  btn.setAttribute('dsh-morph', '1')
  return true
}

// Fallback: floating cluster at the window's top-right corner.
const fallbackCluster = (host) => {
  let cluster = document.getElementById('dsh-wincontrols')
  if (!cluster) {
    cluster = document.createElement('div')
    cluster.id = 'dsh-wincontrols'
    const min = glyph(0xE921), max = glyph(0xE922), cls = glyph(0xE8BB)
    cls.classList.add('dsh-close')
    wireButtons(min, max, cls)
    cluster.append(min, max, cls)
    host.appendChild(cluster)
  }
  cluster.style.left = 'auto'
  cluster.style.top = '8px'
  cluster.style.right = '10px'
  return cluster
}

const setupDrag = (header) => {
  if (header.style.getPropertyValue('-webkit-app-region') !== 'drag') {
    header.style.setProperty('-webkit-app-region', 'drag')
  }
  for (const el of header.querySelectorAll('button,a,input,[role="button"],[role="tab"]')) {
    if (el.getAttribute('app-region') !== 'no-drag') {
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
    const hasPill = morphPill()
    if (hasPill) {
      const fc = document.getElementById('dsh-wincontrols')
      if (fc) fc.remove()
    } else {
      fallbackCluster(header)
    }
    setupDrag(header)
  } catch (e) { /* retry next tick */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { setTimeout(morph, 1500) })
} else {
  setTimeout(morph, 1500)
}
setInterval(morph, 1800)