// dsh-plugin-nong client plugin: LNG blue-flame burn animation on the HERO
// "探索未至之境" fish logo when the "弄就行了" (nong) mode is active. LNG/
// methane complete combustion burns BLUE (cobalt inner -> cyan body ->
// blue-white outer). The sidebar wordmark and collapsed fish are untouched;
// default UI theme unchanged.
window.__ModuleLoader__.load({ id: "dsh-plugin-nong", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "dsh-plugin-nong";
		const inject = [];

		// ---- State ----
		var nongActive = false;
		var timer = null;

		// ---- CSS ----
		// LNG blue flame: cobalt inner core -> cyan body -> blue-white outer edge.
		// Only targets the whale/fish logo SVGs; theme variables untouched.
		const CSS = [
			// --- LNG blue flame keyframes (flickering share of burn) ---
			'@keyframes nong-lng-burn {',
			'  0%, 100% {',
			'    filter: drop-shadow(0 0 3px rgba(20, 80, 255, 0.9)) drop-shadow(0 0 9px rgba(0, 130, 255, 0.65)) drop-shadow(0 0 18px rgba(90, 190, 255, 0.35));',
			'  }',
			'  20% {',
			'    filter: drop-shadow(0 0 3px rgba(20, 90, 255, 1)) drop-shadow(0 0 11px rgba(0, 150, 255, 0.7)) drop-shadow(0 0 22px rgba(120, 200, 255, 0.4));',
			'  }',
			'  40% {',
			'    filter: drop-shadow(0 0 2px rgba(10, 70, 255, 0.85)) drop-shadow(0 0 7px rgba(0, 110, 255, 0.6)) drop-shadow(0 0 15px rgba(70, 180, 255, 0.3));',
			'  }',
			'  60% {',
			'    filter: drop-shadow(0 0 4px rgba(0, 60, 255, 1)) drop-shadow(0 0 12px rgba(0, 140, 255, 0.75)) drop-shadow(0 0 24px rgba(140, 210, 255, 0.45));',
			'  }',
			'  80% {',
			'    filter: drop-shadow(0 0 3px rgba(30, 100, 255, 0.9)) drop-shadow(0 0 8px rgba(0, 120, 255, 0.6)) drop-shadow(0 0 16px rgba(100, 190, 255, 0.35));',
			'  }',
			'}',
			// --- Apply LNG blue flame ONLY to the hero's 34px fish logo ---
			// ("探索未至之境" empty-session centre mark). The sidebar
			// wordmark (182 banner) and collapsed fish (24) stay untouched.
			'body[data-dsh-nong="1"] svg[viewBox="0 0 23.16 17.04"][width="34"] {',
			'  animation: nong-lng-burn 2s ease-in-out infinite;',
			// Blue-white flame-edge tint on the logo ink itself.
			'  color: #cfeaff;',
			'}',
		].join("\n");

		var cssInjected = false;

		function injectCss() {
			if (cssInjected || document.getElementById("dsh-plugin-nong-theme")) return;
			var st = document.createElement("style");
			st.id = "dsh-plugin-nong-theme";
			st.textContent = CSS;
			(document.head || document.documentElement).appendChild(st);
			cssInjected = true;
		}

		// ---- Mode detection ----
		// Scan DOM for any element whose exact text is "弄就行了".
		// Matches the AgentPresetLabel in the session header, the settings
		// row default value, and the new-session chip.
		function detectNongMode() {
			var walker = document.createTreeWalker(
				document.body,
				NodeFilter.SHOW_TEXT,
				null,
				false
			);
			var node;
			while ((node = walker.nextNode())) {
				if (node.textContent.trim() === "弄就行了") {
					return true;
				}
			}
			return false;
		}

		// ---- Tick ----
		function tick() {
			try {
				injectCss();
				var wasActive = nongActive;
				nongActive = detectNongMode();
				if (nongActive !== wasActive) {
					if (nongActive) {
						document.body.dataset.dshNong = "1";
					} else {
						delete document.body.dataset.dshNong;
					}
				}
			} catch (e) {
				// Silently ignore — DOM not ready or tick during SPA navigation.
			}
		}

		// ---- Apply ----
		function apply(ctx) {
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", function() { setTimeout(tick, 1500); });
			} else {
				setTimeout(tick, 1500);
			}
			timer = setInterval(tick, 3000);
			ctx.on("dispose", function() {
				if (timer) {
					clearInterval(timer);
					timer = null;
				}
				delete document.body.dataset.dshNong;
				nongActive = false;
			});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});