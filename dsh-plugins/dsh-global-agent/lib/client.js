// dsh-global-agent client plugin: inject a "全局 Agent 指令" entry into the
// Settings sidebar that opens an editor panel for the global AGENTS.md file.
// Saves via the TDSH HTTP carrier (port 24000) — agent-instructions watches
// the file and hot-reloads on change.
window.__ModuleLoader__.load({ id: "dsh-global-agent", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "global-agent";
		const inject = [];

		// ---- State ----
		var settingsInjected = false;
		var panelOpen = false;
		var currentContent = "";

		// ---- CSS ----
		const CSS = [
			"#dsh-global-agent-panel{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);-webkit-app-region:no-drag;}",
			"#dsh-global-agent-panel .dsh-ga-modal{background:#1A1B24;border:1px solid #2E2F3A;border-radius:12px;width:680px;max-width:90vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.4);}",
			"#dsh-global-agent-panel .dsh-ga-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0;border-bottom:1px solid #2E2F3A;margin-bottom:12px;}",
			"#dsh-global-agent-panel .dsh-ga-header h3{margin:0 0 12px 0;font-size:15px;font-weight:600;color:#E0E1E6;}",
			"#dsh-global-agent-panel .dsh-ga-close{background:none;border:none;color:#9A9DA6;cursor:pointer;font-size:18px;padding:0 4px 12px 4px;line-height:1;}",
			"#dsh-global-agent-panel .dsh-ga-close:hover{color:#FFFFFF;}",
			"#dsh-global-agent-panel .dsh-ga-body{padding:0 20px 16px;overflow-y:auto;flex:1;}",
			"#dsh-global-agent-panel .dsh-ga-body textarea{width:100%;min-height:320px;background:#0D0E12;border:1px solid #2E2F3A;border-radius:8px;color:#E0E1E6;font-family:'SF Mono','Cascadia Code','Consolas',monospace;font-size:13px;line-height:1.5;padding:12px;resize:vertical;box-sizing:border-box;outline:none;}",
			"#dsh-global-agent-panel .dsh-ga-body textarea:focus{border-color:#4FC3F7;}",
			"#dsh-global-agent-panel .dsh-ga-desc{font-size:12px;color:#6B6D7A;margin:0 0 12px 0;}",
			"#dsh-global-agent-panel .dsh-ga-footer{display:flex;align-items:center;justify-content:space-between;padding:12px 20px 16px;border-top:1px solid #2E2F3A;}",
			"#dsh-global-agent-panel .dsh-ga-status{font-size:12px;color:#6B6D7A;}",
			"#dsh-global-agent-panel .dsh-ga-status.dsh-ga-ok{color:#4CAF50;}",
			"#dsh-global-agent-panel .dsh-ga-status.dsh-ga-err{color:#F44336;}",
			"#dsh-global-agent-panel .dsh-ga-save{background:#4FC3F7;color:#0D0E12;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s;}",
			"#dsh-global-agent-panel .dsh-ga-save:hover{background:#29B6F6;}",
			"#dsh-global-agent-panel .dsh-ga-save:disabled{opacity:0.5;cursor:default;}",
		].join("");

		var cssInjected = false;
		function injectCss() {
			if (cssInjected || document.getElementById("dsh-global-agent-css")) return;
			var st = document.createElement("style");
			st.id = "dsh-global-agent-css";
			st.textContent = CSS;
			(document.head || document.documentElement).appendChild(st);
			cssInjected = true;
		}

		// ---- Base URL from URL param ----
		function getBase() {
			try {
				var port = new URLSearchParams(location.search).get("dshDesktopPort");
				if (!port) return null;
				return "http://127.0.0.1:" + port;
			} catch { return null }
		}

		// ---- Fetch helpers ----
		function fetchAgentContent(base) {
			return fetch(base + "/__tdsh/agent", { method: "GET" })
				.then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
				.then(function(d) { return d.content || ""; })
				.catch(function() { return null; });
		}

		function saveAgentContent(base, content) {
			return fetch(base + "/__tdsh/agent", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: content }),
			}).then(function(r) {
				if (!r.ok) throw new Error("HTTP " + r.status);
				return r.json();
			}).catch(function(e) { throw e; });
		}

		// ---- Panel ----
		function openPanel() {
			if (panelOpen) return;
			panelOpen = true;

			var base = getBase();
			if (!base) return;

			var overlay = document.createElement("div");
			overlay.id = "dsh-global-agent-panel";
			overlay.innerHTML = [
				'<div class="dsh-ga-modal">',
				'  <div class="dsh-ga-header">',
				'    <h3>全局 Agent 指令（AGENTS.md）</h3>',
				'    <button class="dsh-ga-close" id="dsh-ga-close-btn">&times;</button>',
				'  </div>',
				'  <div class="dsh-ga-body">',
				'    <p class="dsh-ga-desc">编辑此文件可设置全局 agent 行为规则。保存后自动热加载，无需重启。当前作用域：$DSH_HOME/AGENTS.md</p>',
				'    <textarea id="dsh-ga-editor" placeholder="加载中..."></textarea>',
				'  </div>',
				'  <div class="dsh-ga-footer">',
				'    <span class="dsh-ga-status" id="dsh-ga-status"></span>',
				'    <button class="dsh-ga-save" id="dsh-ga-save-btn" disabled>保存</button>',
				'  </div>',
				'</div>',
			].join("");

			document.body.appendChild(overlay);

			var textarea = document.getElementById("dsh-ga-editor");
			var saveBtn = document.getElementById("dsh-ga-save-btn");
			var statusEl = document.getElementById("dsh-ga-status");
			var closeBtn = document.getElementById("dsh-ga-close-btn");

			// Close on overlay click
			overlay.addEventListener("click", function(e) {
				if (e.target === overlay) closePanel();
			});
			closeBtn.addEventListener("click", closePanel);

			// Load content
			statusEl.textContent = "加载中...";
			fetchAgentContent(base).then(function(content) {
				if (content === null) {
					statusEl.textContent = "读取失败";
					statusEl.className = "dsh-ga-status dsh-ga-err";
					return;
				}
				textarea.value = content;
				currentContent = content;
				saveBtn.disabled = false;
				statusEl.textContent = "已加载";
				statusEl.className = "dsh-ga-status dsh-ga-ok";
			});

			// Save
			saveBtn.addEventListener("click", function() {
				saveBtn.disabled = true;
				statusEl.textContent = "保存中...";
				statusEl.className = "dsh-ga-status";
				saveAgentContent(base, textarea.value).then(function() {
					currentContent = textarea.value;
					statusEl.textContent = "已保存，热加载生效";
					statusEl.className = "dsh-ga-status dsh-ga-ok";
					setTimeout(function() { if (panelOpen) { statusEl.textContent = "已保存"; } }, 3000);
					saveBtn.disabled = false;
				}).catch(function(e) {
					statusEl.textContent = "保存失败：" + (e.message || "未知错误");
					statusEl.className = "dsh-ga-status dsh-ga-err";
					saveBtn.disabled = false;
				});
			});
		}

		function closePanel() {
			var overlay = document.getElementById("dsh-global-agent-panel");
			if (overlay) overlay.remove();
			panelOpen = false;
		}

		// ---- Settings entry injection ----
		function stripActive(el) {
			var next = Array.from(el.classList).filter(function(c) { return !/active/i.test(c); }).join(" ");
			if (next !== el.className) el.className = next;
			if (el.getAttribute("aria-current")) el.removeAttribute("aria-current");
		}

		function injectSettingsEntry() {
			if (settingsInjected && !document.getElementById("dsh-global-agent-settings")) {
				settingsInjected = false;
			}
			if (settingsInjected) return;

			var navList = document.querySelector("[class*=\"_navList\"]");
			if (!navList) return;
			if (!navList.closest("[class*=\"settings\" i]")) return;
			var cells = Array.from(navList.querySelectorAll("button[class*=\"_navCell\"]"));
			var template = cells[cells.length - 1];
			if (!template) return;
			if (navList.querySelector("#dsh-global-agent-settings")) { settingsInjected = true; return; }

			var item = template.cloneNode(true);
			item.id = "dsh-global-agent-settings";
			stripActive(item);

			// Rebuild content: svg icon + label
			var tplSvg = item.querySelector("svg");
			var label = item.querySelector("[class*=\"_navLabel\"]");
			Array.from(item.children).forEach(function(el) { el.remove(); });

			// Create a document icon (file outline)
			var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("width", "16");
			svg.setAttribute("height", "16");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("fill", "none");
			svg.setAttribute("stroke", "currentColor");
			svg.setAttribute("stroke-width", "2");
			svg.setAttribute("stroke-linecap", "round");
			svg.setAttribute("stroke-linejoin", "round");
			svg.innerHTML = '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>';
			if (tplSvg && tplSvg.getAttribute("class")) svg.setAttribute("class", tplSvg.getAttribute("class"));
			item.appendChild(svg);

			if (label) {
				label.textContent = "全局 Agent 指令";
				item.appendChild(label);
			} else {
				item.appendChild(document.createTextNode("全局 Agent 指令"));
			}

			// Click handler: open the editor panel
			item.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				openPanel();
			});

			navList.appendChild(item);
			settingsInjected = true;
		}

		// ---- Sanitize (never show as selected) ----
		function sanitizeEntry() {
			var el = document.getElementById("dsh-global-agent-settings");
			if (!el) return;
			stripActive(el);
			if (el.getAttribute("aria-selected") === "true") el.setAttribute("aria-selected", "false");
		}

		// ---- Tick ----
		function tick() {
			try {
				injectCss();
				injectSettingsEntry();
				sanitizeEntry();
			} catch {}
		}

		// ---- Apply ----
		function apply(ctx) {
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", function() { setTimeout(tick, 1500); });
			} else {
				setTimeout(tick, 1500);
			}
			var timer = setInterval(tick, 3000);
			ctx.on("dispose", function() {
				clearInterval(timer);
				closePanel();
			});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});