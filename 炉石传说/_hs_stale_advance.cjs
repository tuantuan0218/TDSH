// 陈旧块推进分母研究（只读）：每次「options 块陈旧」后，块多久才推进（下一不同块行出现）
// 用法: node _hs_stale_advance.cjs ['2026-09-13 19:25']
const fs = require("fs"), path = require("path");
const LOGDIR = "D:/tdsh/炉石传说/hs-script/log";
const START = process.argv[2] || "2026-09-13 19:25";
const lines = fs.readdirSync(LOGDIR).filter(f => f.endsWith(".log")).flatMap(f => fs.readFileSync(path.join(LOGDIR, f), "utf8").split("\n"));
const seg = lines.filter(l => /^2026-09-13 /.test(l) && l.slice(0, 19) >= START);
const T = l => new Date("2026-09-13T" + l.slice(11, 23)).getTime();

// 事件流：块行号（OptionsGate 末块的 块行=N）+ 陈旧事件
const blockSeq = [];   // {t, n}
const stale = [];      // {t, nAtStale, type}
for (const l of seg) {
  let m;
  if ((m = l.match(/options 末块: 可执行 POWER=\d+（块行=(\d+)）/))) blockSeq.push({ t: T(l), n: +m[1] });
  if (/options 块陈旧/.test(l)) stale.push({ t: T(l), type: /继续扫/.test(l) ? "继续扫(有豁免态)" : "直接收回合", txt: l.slice(11, 19) });
}
if (!stale.length) { console.log("无陈旧事件（窗=" + START + "）"); process.exit(0); }
const advances = stale.map(s => {
  const after = blockSeq.filter(b => b.t > s.t);
  const nxt = after.find(b => b.n !== (blockSeq.filter(b => b.t <= s.t).slice(-1)[0] || { n: -1 }).n);
  return { t: s.txt, type: s.type, waitMs: nxt ? nxt.t - s.t : null };
});
const got = advances.filter(a => a.waitMs !== null).map(a => a.waitMs).sort((x, y) => x - y);
const p = q => got.length ? got[Math.min(got.length - 1, Math.floor(got.length * q))] : null;
console.log("窗起=" + START + "  陈旧事件=" + stale.length + "  后续观测到块推进=" + got.length + "  未推进(窗内无新块)=" + (advances.length - got.length));
if (got.length) console.log("块推进等待 ms: p50=" + p(0.5) + " p90=" + p(0.9) + " max=" + got[got.length - 1]);
console.log("≥10000ms 才推进(=会撞熔断窗)的例数:", got.filter(x => x >= 10000).length);
console.log("分型:", JSON.stringify(advances.reduce((a, x) => (a[x.type] = (a[x.type] || 0) + 1, a), {})));
console.log("--- 明细（前 14）---");
advances.slice(0, 14).forEach(a => console.log(" ", a.t, a.type.padEnd(18), a.waitMs === null ? "窗内未推进" : (a.waitMs + "ms")));
