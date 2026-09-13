// 蜂群日志探针（只读）。PowerShell 会把 node -e 里的引号吃掉，所以一律走文件。
// 用法：node _hive_probe.cjs [--since 12:50] [--grep 站会] [--tail 40] [--seats] [--fleet]
const fs = require('fs');
const LOG = 'D:/MunderDifflin/hive/log.jsonl';
const CFG = 'D:/MunderDifflin/.userdata/config.json';
const REG = 'D:/MunderDifflin/hive/registry.json';
const FLEET = 'D:/MunderDifflin/hive/fleet.json';
const SEATS = ['scheduler', 'heartbeat', 'external-planner'];

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : dflt; };
const has = (name) => process.argv.includes('--' + name);
const now = Date.now();
let cut = now - 6 * 3600_000;
const s = arg('since');
if (s) {
  const d = /^\d{1,2}:\d{2}$/.test(s) ? new Date(new Date().toISOString().slice(0, 10) + 'T' + s + ':00+08:00') : new Date(s);
  if (!isNaN(d)) cut = d.getTime();
}
const re = arg('grep') ? new RegExp(arg('grep'), 'i') : null;
const tail = Number(arg('tail', 60));

const L = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
// 窗口起点在未来 = 一定会"0 命中"，那是等待不是干净。显式警告，别让人把"还没到"读成"没发生"。
if (cut > now) console.log('!! --since 指向未来（', new Date(cut).toLocaleString('zh-CN', { hour12: false }), '），0 命中只代表"还没发生"');
let ev = L.filter((o) => o.ts > cut);
if (re) ev = ev.filter((o) => re.test(`${o.subject || ''} ${o.from || ''} ${o.to || ''} ${o.kind || ''} ${o.reason || ''}`));
console.log('now', new Date(now).toLocaleString('zh-CN', { hour12: false }), '| 命中', ev.length, '条（窗口起点', new Date(cut).toLocaleString('zh-CN', { hour12: false }), '）');
for (const o of ev.slice(-tail)) {
  console.log(new Date(o.ts).toLocaleString('zh-CN', { hour12: false }), String(o.kind).padEnd(12),
    ((o.from || '') + '->' + (o.to || '')).padEnd(34), (o.act || o.reason || '').padEnd(7),
    '|', String(o.subject || o.detail || o.file || '').slice(0, arg('width', 58)));
}
if (has('seats')) {
  for (const id of SEATS) {
    const inbox = `D:/MunderDifflin/hive/agents/${id}/inbox`;
    const pending = fs.existsSync(inbox) ? fs.readdirSync(inbox).filter((x) => x.endsWith('.json')) : [];
    const archived = fs.existsSync(inbox + '/.done') ? fs.readdirSync(inbox + '/.done').length : 0;
    console.log(`席位 ${id.padEnd(16)} pending=${pending.length} archived=${archived}`,
      pending.length ? '| ' + pending.slice(-2).map((f) => { try { const o = JSON.parse(fs.readFileSync(inbox + '/' + f, 'utf8')); return `${o.from}/${o.act}:${String(o.subject).slice(0, 28)}`; } catch (e) { return f; } }).join('  ') : '');
  }
}
if (has('fleet')) {
  const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  for (const m of cfg.missions || []) {
    console.log(`mission ${m.id.padEnd(13)} enabled=${m.enabled} interval=${m.intervalMs / 1000}s to=${m.to} fired=${new Date(m.lastFiredAt || 0).toLocaleString('zh-CN', { hour12: false })} next=${new Date((m.lastFiredAt || 0) + m.intervalMs).toLocaleString('zh-CN', { hour12: false })}`);
  }
  const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const fl = JSON.parse(fs.readFileSync(FLEET, 'utf8'));
  console.log('fleet.ts', new Date(fl.ts).toLocaleString('zh-CN', { hour12: false }), '| 无 sessionId 的在册席位：',
    Object.entries(reg.agents).filter(([, a]) => !a.archived && !a.sessionId).map(([k]) => k).join(', ') || '(无)');
  for (const a of fl.agents) console.log('  ', String(a.id).padEnd(18), 'tokens=' + a.tokens, 'lastTool=' + a.lastTool, 'lastActiveSecAgo=' + a.lastActiveSecAgo, 'backlog=' + a.inboxBacklog);
}
