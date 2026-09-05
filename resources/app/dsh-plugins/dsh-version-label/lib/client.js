// dsh-version-label client bundle: renders the TDSH app version in the
// bottom-right corner. Reads version from URL param ?dshDesktopVersion=<ver>
// (injected by main.js when loading the window URL) — no IPC bridge, pure HTTP.
// Hand-written __ModuleLoader__ factory (no build step).
window.__ModuleLoader__.load({ id: "dsh-version-label", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "version-label";
		const inject = [];

		const VERSION_LABEL_ID = "dsh-version-label";

		// Minimal fixed CSS (mirrors the preload's old version label style).
		const CSS = `
#dsh-version-label{position:fixed;bottom:1px;right:10px;z-index:99997;font-size:10px;
  line-height:1;color:rgba(255,255,255,0.35);font-family:"Segoe UI",sans-serif;
  user-select:none;pointer-events:none;-webkit-app-region:no-drag;}
`;

		let cssInjected = false;
		function injectCss() {
			if (cssInjected || document.getElementById("dsh-version-label-css")) return;
			const st = document.createElement("style");
			st.id = "dsh-version-label-css";
			st.textContent = CSS;
			document.head.appendChild(st);
			cssInjected = true;
		}

		function getVersion() {
			try {
				const v = new URLSearchParams(location.search).get("dshDesktopVersion");
				if (typeof v === "string" && v) return v;
			} catch {}
			return null;
		}

		function render() {
			const v = getVersion();
			const el = document.getElementById(VERSION_LABEL_ID);
			if (!v) {
				if (el) el.remove();
				return;
			}
			injectCss();
			if (!el) {
				const el2 = document.createElement("div");
				el2.id = VERSION_LABEL_ID;
				(document.body || document.documentElement).appendChild(el2);
			}
			const text = "v" + v;
			const targetEl = document.getElementById(VERSION_LABEL_ID);
			if (targetEl && targetEl.textContent !== text) targetEl.textContent = text;
		}

		function apply(ctx) {
			// Render after DOM ready; poll cheaply every 2s to survive React
			// re-renders that might drop the element.
			const tick = () => { try { render() } catch {} };
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", () => { setTimeout(tick, 1500) });
			} else {
				setTimeout(tick, 1500);
			}
			const timer = setInterval(tick, 2000);
			ctx.on("dispose", () => clearInterval(timer));
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});