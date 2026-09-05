// dsh-session-log client plugin: inject a "会话日志" entry into the Settings
// sidebar that opens the hidden session-log panel. Pure DOM.
window.__ModuleLoader__.load({ id: "dsh-session-log", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "session-log";
		const inject = [];

		// ---- State ----
		var settingsInjected = false;

		// ---- Helpers ----
		function findSessionLogBtn() {
			// Try cached first, then DOM query
			var btn = document.querySelector("button[style*='visibility: hidden']");
			if (btn && /^session\s*log$/i.test((btn.textContent || "").trim())) return btn;
			return Array.from(document.querySelectorAll("button")).find(function(b) {
				return /^session\s*log$/i.test((b.textContent || "").trim());
			});
		}

		function stripActive(el) {
			var next = Array.from(el.classList).filter(function(c) { return !/active/i.test(c); }).join(" ");
			if (next !== el.className) el.className = next;
			if (el.getAttribute("aria-current")) el.removeAttribute("aria-current");
		}

		// ---- Settings entry injection ----
		function injectSettingsEntry() {
			// React may unmount the panel: reset lock if entry gone
			if (settingsInjected && !document.getElementById("dsh-sessionlog-settings")) {
				settingsInjected = false;
			}
			if (settingsInjected) return;

			var navList = document.querySelector("[class*=\"_navList\"]");
			if (!navList) return;
			if (!navList.closest("[class*=\"settings\" i]")) return;
			var cells = Array.from(navList.querySelectorAll("button[class*=\"_navCell\"]"));
			var template = cells[cells.length - 1];
			if (!template) return;
			if (navList.querySelector("#dsh-sessionlog-settings")) { settingsInjected = true; return; }

			var item = template.cloneNode(true);
			item.id = "dsh-sessionlog-settings";
			stripActive(item);

			// Rebuild content: svg icon + label
			var sessionBtn = findSessionLogBtn();
			var logSvg = sessionBtn && sessionBtn.querySelector("svg");
			var tplSvg = item.querySelector("svg");
			var label = item.querySelector("[class*=\"_navLabel\"]");
			Array.from(item.children).forEach(function(el) { el.remove(); });

			if (logSvg || tplSvg) {
				var svg = (logSvg || tplSvg).cloneNode(true);
				svg.setAttribute("width", "16");
				svg.setAttribute("height", "16");
				if (tplSvg && tplSvg.getAttribute("class")) svg.setAttribute("class", tplSvg.getAttribute("class"));
				item.appendChild(svg);
			}
			if (label) {
				label.textContent = "会话日志";
				item.appendChild(label);
			} else {
				item.appendChild(document.createTextNode("会话日志"));
			}

			// Click handler: trigger the hidden session-log button
			item.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				var btn = findSessionLogBtn();
				if (btn && btn.isConnected) btn.click();
			});

			navList.appendChild(item);
			settingsInjected = true;
		}

		// ---- Sanitize (never show as selected) ----
		function sanitizeLogEntry() {
			var el = document.getElementById("dsh-sessionlog-settings");
			if (!el) return;
			stripActive(el);
			if (el.getAttribute("aria-selected") === "true") el.setAttribute("aria-selected", "false");
		}

		// ---- Tick ----
		function tick() {
			try {
				injectSettingsEntry();
				sanitizeLogEntry();
			} catch {}
		}

		// ---- Apply ----
		function apply(ctx) {
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", function() { setTimeout(tick, 1500); });
			} else {
				setTimeout(tick, 1500);
			}
			// Poll every 3s (survives React re-renders; injects the settings
			// entry whenever the settings panel is open). No MutationObserver —
			// observers that write DOM during the module-loader bootstrap hung
			// the renderer at "Loading plugins...".
			var timer = setInterval(tick, 3000);

			ctx.on("dispose", function() {
				clearInterval(timer);
			});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});