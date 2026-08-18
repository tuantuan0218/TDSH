// dsh-update-btn client plugin: GPT-style blue arrow update button.
// Polls GET /__tdsh/update and wires click to POST /__tdsh/update via HTTP
// carrier (no IPC bridge). Reads dshDesktopPort from URL param.
window.__ModuleLoader__.load({ id: "dsh-update-btn", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "update-btn";
		const inject = [];

		// ---- CSS ----
		const CSS = `
#dsh-update-css{display:none !important;}
#dsh-update-btn{position:fixed;bottom:12px;right:12px;z-index:99998;display:flex;align-items:center;justify-content:center;
  width:24px;height:24px;border-radius:8px;cursor:pointer;color:#9A9DA6;transition:all .15s;
  -webkit-app-region:no-drag;background:transparent;border:1px solid transparent;}
#dsh-update-btn:hover{color:#FFFFFF;background:#1E1F24;}
#dsh-update-btn svg{display:block;width:14px;height:14px;}
#dsh-update-btn.dsh-ua-spin svg{animation:dsh-spin .8s linear infinite;}
@keyframes dsh-spin{to{transform:rotate(360deg)}}
#dsh-update-btn.dsh-ua-available{background:rgba(79,195,247,0.1);border-color:rgba(79,195,247,0.3);color:#4FC3F7;}
#dsh-update-btn.dsh-ua-available:hover{background:rgba(79,195,247,0.2);border-color:#4FC3F7;}
#dsh-update-btn.dsh-ua-downloaded{background:rgba(79,195,247,0.1);border-color:rgba(79,195,247,0.3);color:#4FC3F7;}
#dsh-update-btn.dsh-ua-downloaded:hover{background:rgba(79,195,247,0.2);border-color:#4FC3F7;}
`;
		var cssInjected = false;
		function injectCss() {
			if (cssInjected || document.getElementById("dsh-update-css")) return;
			var st = document.createElement("style");
			st.id = "dsh-update-css";
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

		// ---- HTTP ----
		function postUpdate(base, action) {
			try {
				fetch(base + "/__tdsh/update", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ action: action }),
				}).catch(function() {});
			} catch {}
		}

		// ---- SVG ----
		function updateBtnSvg(state) {
			var blueArrow = "<path d=\"M8 3v10M4 7l4-4 4 4\" stroke=\"#4FC3F7\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/>";
			var svgs = {
				idle: "",
				checking: "<path d=\"M13.5 8A5.5 5.5 0 1 1 8 2.5\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M10.5 5.5h2.5V3\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"none\"/>",
				available: blueArrow,
				downloading: blueArrow,
				downloaded: blueArrow,
				error: "<path d=\"M8 5v3.5M8 10v.5\" stroke=\"#F44336\" stroke-width=\"1.5\" stroke-linecap=\"round\" fill=\"none\"/>",
			};
			return "<svg width=\"14\" height=\"14\" viewBox=\"0 0 16 16\" xmlns=\"http://www.w3.org/2000/svg\">" + (svgs[state] || "") + "</svg>";
		}

		// ---- Button ----
		var updateBtn = null;
		var lastState = "idle";
		var lastVersion = null;
		var baseUrl = null;

		function renderStatus(status) {
			var state = (status && status.state) || "idle";
			lastState = state;
			if (status && status.version) lastVersion = status.version;
			// Visibility
			var visible = state !== "idle";
			var newDisplay = visible ? "flex" : "none";
			if (updateBtn.style.display !== newDisplay) updateBtn.style.display = newDisplay;
			if (!visible) {
				// 移除进度条
				var pb = document.getElementById("dsh-update-progress");
				if (pb) pb.remove();
				return;
			}
			// Content
			var newHtml = updateBtnSvg(state);
			if (updateBtn.innerHTML !== newHtml) updateBtn.innerHTML = newHtml;
			var newCls = "dsh-ua-" + state + (state === "checking" ? " dsh-ua-spin" : "") + (state === "available" ? " dsh-ua-available" : "") + (state === "downloaded" ? " dsh-ua-downloaded" : "");
			if (updateBtn.className !== newCls) updateBtn.className = newCls;
			var tips = { idle: "", checking: "检查中…", available: "新版本可用，点击下载", downloading: "下载中…", downloaded: "安装并重启", error: "检查更新失败" };
			var tip = tips[state] || "";
			if (updateBtn.title !== tip) updateBtn.title = tip;
			// 进度条（下载中）
			if (state === "downloading") {
				var pct = (status && status.progress !== undefined) ? Math.round(status.progress * 100) : 0;
				var pb = document.getElementById("dsh-update-progress");
				if (!pb) {
					pb = document.createElement("div");
					pb.id = "dsh-update-progress";
					pb.style.cssText = "position:fixed;bottom:42px;right:12px;width:24px;height:4px;background:#333;border-radius:2px;overflow:hidden;z-index:99999;";
					pb.innerHTML = '<div id="dsh-update-progress-fill" style="height:100%;width:0%;background:#4FC3F7;border-radius:2px;transition:width 0.3s;"></div>';
					document.body.appendChild(pb);
				}
				document.getElementById("dsh-update-progress-fill").style.width = pct + "%";
			} else {
				var pb = document.getElementById("dsh-update-progress");
				if (pb) pb.remove();
			}
		}

		function refresh() {
			if (!baseUrl) return;
			try {
				fetch(baseUrl + "/__tdsh/update")
					.then(function(r) { return r.json(); })
					.then(renderStatus)
					.catch(function() {});
			} catch {}
		}

		// ---- Tick ----
		function tick() {
			try {
				injectCss();
				if (!updateBtn || !updateBtn.isConnected) {
					updateBtn = document.createElement("div");
					updateBtn.id = "dsh-update-btn";
					updateBtn.addEventListener("click", function(e) {
					e.preventDefault();
					e.stopPropagation();
					if (!baseUrl) return;
					var action = "check";
					switch (lastState) {
						case "available":
							action = "download";
							if (!confirm("检测到新版本 " + (lastVersion || "") + "，是否下载？")) {
								return;
							}
							break;
						case "downloaded": action = "install"; break;
					}
					postUpdate(baseUrl, action);
					// 一键升级：触发 download 后自动轮询，下载完成自动 install
					if (action === "download") {
						var pollTimer = setInterval(function() {
							fetch(baseUrl + "/__tdsh/update")
								.then(function(r) { return r.json(); })
								.then(function(s) {
									if (s.state === "downloaded") {
										clearInterval(pollTimer);
										postUpdate(baseUrl, "install");
									} else if (s.state === "error") {
										clearInterval(pollTimer);
									}
								})
								.catch(function() { clearInterval(pollTimer); });
						}, 1000);
						// 30 秒超时保护，防止无限轮询
						setTimeout(function() { clearInterval(pollTimer); }, 30000);
					}
				});
					document.body.appendChild(updateBtn);
				}
				refresh();
			} catch {}
		}

		// ---- Apply ----
		function apply(ctx) {
			baseUrl = getBase();
			if (!baseUrl) return; // plain browser → no button
			injectCss();
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", function() { setTimeout(tick, 1500); });
			} else {
				setTimeout(tick, 1500);
			}
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