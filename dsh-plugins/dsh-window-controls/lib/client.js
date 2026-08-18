// dsh-window-controls client plugin: drag strip + window minimize/maximize/close pill.
// Uses HTTP carrier (POST/GET http://127.0.0.1:<port>/__tdsh/win) instead of
// Electron IPC bridge. Reads dshDesktopPort from URL param.
// Hand-written __ModuleLoader__ factory (no build step).
window.__ModuleLoader__.load({ id: "dsh-window-controls", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "window-controls";
		const inject = [];

		// ---- CSS ----
		const CSS = `
#dsh-win-css{display:none !important;}
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
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-play-state: running !important; animation-duration: 0.3s !important;
    animation-delay: 0s !important; transition-duration: 0.2s !important; transition-delay: 0s !important; }
}
`;
		var cssInjected = false;
		function injectCss() {
			if (cssInjected || document.getElementById("dsh-win-css")) return;
			var st = document.createElement("style");
			st.id = "dsh-win-css";
			st.textContent = CSS;
			(document.head || document.documentElement).appendChild(st);
			cssInjected = true;
		}

		// ---- Helpers ----
		function glyph(code) {
			var s = document.createElement("span");
			s.innerHTML = "&#" + code + ";";
			return s;
		}

		function getBase() {
			try {
				var port = new URLSearchParams(location.search).get("dshDesktopPort");
				if (!port) return null;
				return "http://127.0.0.1:" + port;
			} catch { return null }
		}

		// ---- HTTP actions ----
		function postWin(base, action) {
			try {
				fetch(base + "/__tdsh/win", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ action: action }),
				}).catch(function() {});
			} catch {}
		}

		function pollMaximized(base) {
			if (!base) return;
			try {
				fetch(base + "/__tdsh/win")
					.then(function(r) { return r.json(); })
					.then(function(data) {
						if (data && typeof data.maximized === "boolean") {
							var cluster = document.getElementById("dsh-wincontrols");
							var maxSpan = cluster && cluster.querySelector("span:nth-child(2)");
							if (maxSpan) {
								var expected = data.maximized ? "&#xE923;" : "&#xE922;";
								if (maxSpan.innerHTML !== expected) maxSpan.innerHTML = expected;
							}
						}
					})
					.catch(function() {});
			} catch {}
		}

		// ---- Session-log button hiding (needed for pill positioning) ----
		var sessionLogBtn = null;
		var winRect = null;

		function hideSessionLogButton() {
			var btn = sessionLogBtn && sessionLogBtn.isConnected && /^session\s*log$/i.test((sessionLogBtn.textContent || "").trim())
				? sessionLogBtn
				: Array.from(document.querySelectorAll("button")).find(function(b) { return /^session\s*log$/i.test((b.textContent || "").trim()) });
			if (!btn) { sessionLogBtn = null; return null; }
			sessionLogBtn = btn;
			if (btn.style.visibility !== "hidden") {
				btn.style.visibility = "hidden";
			}
			return btn;
		}

		function captureRect() {
			try {
				if (sessionLogBtn && sessionLogBtn.isConnected) {
					var r = sessionLogBtn.getBoundingClientRect();
					if (r.width > 2 && r.height > 2) winRect = r;
				}
			} catch {}
		}

		// ---- Drag strip ----
		function ensureDragStrip() {
			if (document.getElementById("dsh-dragstrip")) return;
			var strip = document.createElement("div");
			strip.id = "dsh-dragstrip";
			document.body.appendChild(strip);
		}

		// ---- Window controls pill ----
		var winControlsPill = null;

		function ensureWinControls(header) {
			var base = getBase();
			var cluster = document.getElementById("dsh-wincontrols");
			if (!cluster) {
				cluster = document.createElement("div");
				cluster.id = "dsh-wincontrols";
				cluster.className = "dsh-pill";
				var min = glyph(0xE921);
				var max = glyph(0xE922);
				var cls = glyph(0xE8BB);
				cls.classList.add("dsh-close");
				if (base) {
					min.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); postWin(base, "minimize"); });
					max.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); postWin(base, "maximize"); });
					cls.addEventListener("click", function(e) { e.preventDefault(); e.stopPropagation(); postWin(base, "close"); });
				}
				cluster.append(min, max, cls);
				(header || document.body).appendChild(cluster);
				winControlsPill = cluster;
			}
			// Position
			var h = (header || document.body).getBoundingClientRect();
			var r = winRect
				? { left: winRect.left - h.left, top: winRect.top - h.top, width: winRect.width, height: winRect.height }
				: { left: h.width - 145, top: 10, width: 118, height: 32 };
			var left = Math.max(4, Math.round(r.left));
			var top = Math.max(2, Math.round(r.top));
			if (cluster.style.left !== left + "px") cluster.style.left = left + "px";
			if (cluster.style.top !== top + "px") cluster.style.top = top + "px";
			if (cluster.style.width !== Math.round(r.width) + "px") cluster.style.width = Math.round(r.width) + "px";
			if (cluster.style.height !== Math.round(r.height) + "px") cluster.style.height = Math.round(r.height) + "px";
			if (cluster.style.background !== "#0D0E12") cluster.style.background = "#0D0E12";
			if (cluster.style.border !== "1px solid #1E1F24") cluster.style.border = "1px solid #1E1F24";
		}

		// ---- Header drag region ----
		function setupDrag(header) {
			if (header.style.getPropertyValue("-webkit-app-region") !== "drag") {
				header.style.setProperty("-webkit-app-region", "drag");
			}
			Array.from(header.querySelectorAll("button,a,input,[role=\"button\"],[role=\"tab\"]")).forEach(function(el) {
				if (el.getAttribute("app-region") !== "no-drag" && el.id !== "dsh-wincontrols") {
					try { el.style.setProperty("-webkit-app-region", "no-drag"); el.setAttribute("app-region", "no-drag"); } catch {}
				}
			});
		}

		// ---- Poll tick ----
		var tickCounter = 0;

		function tick() {
			try {
				injectCss();
				var base = getBase();
				var header = document.querySelector("header");
				if (!header) {
					ensureDragStrip();
					return;
				}
				hideSessionLogButton();
				captureRect();
				ensureWinControls(header);
				setupDrag(header);
				if (base) pollMaximized(base);
			} catch {}
		}

		// ---- Resize handler ----
		function onResize() {
			try {
				var header = document.querySelector("header");
				if (!header) return;
				captureRect();
				ensureWinControls(header);
			} catch {}
		}

		// ---- Apply ----
		function apply(ctx) {
			injectCss();
			var base = getBase();
			// No port param → running in plain browser; skip window controls injection.
			if (!base) return;
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", function() { setTimeout(tick, 1500); });
			} else {
				setTimeout(tick, 1500);
			}
			// Poll every 3s for React re-render resilience. NOTE: no
			// MutationObserver here — an observer combined with DOM writes and
			// sendSync caused the module-loader to hang at "Loading plugins..."
			// (frozen renderer). Pure interval polling matches the proven
			// dsh-version-label architecture and survives re-renders.
			var timer = setInterval(tick, 3000);
			try { window.addEventListener("resize", onResize); } catch {}

			ctx.on("dispose", function() {
				clearInterval(timer);
				try { window.removeEventListener("resize", onResize); } catch {}
			});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});