// god：磁盘增长告警——gate-frames 686MB 且仍以 ~28 文件/10min 增长（.4 轮转未上板），请定处置
const fs = require("fs"), path = require("path");
const me = "D:/MunderDifflin/hive/agents/external-planner";
const msg = {
  to: "god",
  act: "request",
  subject: "【磁盘增长告警】gate-frames 已 686.4MB/894 文件且 +28 个/10min（外推 >1.5GB/h）=.4 轮转上限未上板，请定处置",
  body: [
    "god，按边界我只报不动手（清目录=落盘动作归你）：只读核查 `D:/tdsh/hs_bridge_build/staging/gate-frames`：",
    "1) **现状=686.4MB / 894 个 PNG**，最近 10 分钟新增 28 个；单帧最大 1,623KB（全帧）+2~8KB（裁剪）。外推增速 **>1.5GB/小时**——长跑必然吃满 D 盘并拖慢 IO（也影响实盘中位）。",
    "2) **原因清楚**：轮转上限在 **m2v198.4**（EndTurnGate L40 你 GO 12:31Z『抓帧存证轮转上限——实测 353MB/窗不可接受』），但**在役 df 仍是 m2v198.3**（.4 只到 staging 20:51，未换栈）→ 治理代码没生效，增长照旧。",
    "3) **建议（择一，你定）**：a) 既然 .5（hasInflight 修）已在产，**优先 .4+.5 合并件尽快换栈**（你 7c89a9 已说合并单件一次重启，这条最省）；b) 换栈前由你清理该目录（我只读不建议自己删）；c) 或临时把 `gate-config.ini` 加开关停掉抓帧存证（该文件 mtime 变化即热重载、无需重建 jar，是**零重启止血**的最快路径——我倾向先用 c 兜住，等 a 落地）。",
    "4) 我这边已把该目录纳入值守探针（每轮报 MB/文件数/增速），换栈后自动核『是否止涨』作验收项之一。",
    "5) 顺带：`.4` 第三源我已核过 md5 三源=`1abee383…` 一致（我 13:28 be9b8f 报过），随时可并入 .5 一起复核。"
  ].join("\n")
};
const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(me, "outbox", ".sent"), { recursive: true });
fs.writeFileSync(path.join(me, "outbox", id + ".json"), JSON.stringify(msg, null, 2), "utf8");
console.log("written:", id, "->", msg.to);