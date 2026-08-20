// dsh-plugin-nong client plugin: fire red theme + logo burn animation when
// "弄就行了" mode is active. Detects the mode by polling for the preset label
// text in the DOM. Reverts to default theme when switched away.
window.__ModuleLoader__.load({ id: "dsh-plugin-nong", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "dsh-plugin-nong";
		const inject = [];

		// ---- State ----
		var nongActive = false;
		var timer = null;

		// ---- CSS ----
		// Fire red theme overrides + logo burn animation.
		// Applied when body[data-dsh-nong="1"] is present.
		const CSS = [
			// --- Fire red accent overrides ---
			'body[data-dsh-nong="1"] {',
			'  --dsw-alias-brand-primary: #e04a00 !important;',
			'  --dsw-alias-brand-primary-new-colorprimary-new-color: #ff4500 !important;',
			'  --dsw-alias-brand-text: #e04a00 !important;',
			'  --dsw-alias-brand-primary-invert: #fff5eb !important;',
			'  --dsw-alias-button-primary-fill: #e04a00 !important;',
			'  --dsw-alias-button-primary-hover: #c23a00 !important;',
			'  --dsw-alias-button-info-fill: #d62828 !important;',
			'  --dsw-alias-button-info-hover: #b01c1c !important;',
			'  --dsw-alias-state-business-primary: #e04a00 !important;',
			'  --dsw-alias-state-business-tertiary: rgba(224, 74, 0, 0.15) !important;',
			'  --dsw-alias-interactive-bg-hover-accent: rgba(224, 74, 0, 0.14) !important;',
			'  --dsw-alias-interactive-bg-active: rgba(255, 69, 0, 0.12) !important;',
			'  --dsw-specific-sidebar-nav-item-active-accent: rgba(255, 69, 0, 0.18) !important;',
			'  --dsw-specific-bubble-highlight: rgba(255, 69, 0, 0.15) !important;',
			'  --dsw-specific-bubble: rgba(255, 69, 0, 0.08) !important;',
			'}',
			// --- Logo burn animation keyframes ---
			'@keyframes nong-fire-glow {',
			'  0%, 100% {',
			'    filter: drop-shadow(0 0 3px rgba(255, 69, 0, 0.9)) drop-shadow(0 0 8px rgba(255, 100, 0, 0.6)) drop-shadow(0 0 16px rgba(255, 50, 0, 0.3));',
			'  }',
			'  25% {',
			'    filter: drop-shadow(0 0 4px rgba(255, 100, 0, 1)) drop-shadow(0 0 10px rgba(255, 150, 0, 0.7)) drop-shadow(0 0 20px rgba(255, 69, 0, 0.4));',
			'  }',
			'  50% {',
			'    filter: drop-shadow(0 0 2px rgba(255, 50, 0, 0.8)) drop-shadow(0 0 6px rgba(255, 80, 0, 0.5)) drop-shadow(0 0 14px rgba(255, 30, 0, 0.3));',
			'  }',
			'  75% {',
			'    filter: drop-shadow(0 0 5px rgba(255, 80, 0, 1)) drop-shadow(0 0 12px rgba(255, 120, 0, 0.7)) drop-shadow(0 0 22px rgba(255, 60, 0, 0.5));',
			'  }',
			'}',
			// --- Apply fire glow to whale/fish logo SVGs ---
			'body[data-dsh-nong="1"] svg[viewBox="0 0 23.16 17.04"],',
			'body[data-dsh-nong="1"] svg[viewBox="0 0 182 24"] {',
			'  animation: nong-fire-glow 2s ease-in-out infinite;',
			'  color: #ff4500;',
			'}',
			// --- Speed up flicker on hover ---
			'body[data-dsh-nong="1"] [class*="brand"]:hover svg,',
			'body[data-dsh-nong="1"] [class*="toggle"]:hover svg {',
			'  animation-duration: 0.5s;',
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
		// This matches the AgentPresetLabel in the session header,
		// the settings row default value, and the new-session chip.
		// Returns true if found.
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
				// Silently ignore — DOM not ready or tick called during SPA navigation.
			}
		}

		// ---- Apply ----
		function apply(ctx) {
			// Inject CSS immediately so it's ready when the first tick fires.
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
				// Remove the attribute so theme reverts immediately.
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