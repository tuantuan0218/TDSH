// dsh-plugin-nong client plugin (minimal — no UI badge, tools only).
// The "弄就行了" mode is selected via the agent preset dropdown, not via a badge.
window.__ModuleLoader__.load({ id: "dsh-plugin-nong", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;

		const name = "dsh-plugin-nong";
		const inject = [];

		function apply(ctx) {
			// No UI — the mode is in the agent preset dropdown.
			// Tools (nong_install_plugin, nong_modify_goal, nong_mcts_explore,
			// nong_evaluate_paths) are registered by the host plugin.
			ctx.on("dispose", function() {});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});