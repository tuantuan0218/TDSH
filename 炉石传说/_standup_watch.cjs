// ops-standup 三环看门狗：发(scheduler 准点) → 唤醒(god 是否被拉起) → 回执(god 是否留行)
// 用法：node _standup_watch.cjs [lookbackMin=180] [--drain]
// 退出码：0=三环齐 / 3=缺回执（需要补投） / 4=缺发出（定时器真坏了） / 5=日志读不到
// --drain 额外做席位清账（见文末），归档清单会逐条打印，绝不静搬。
const fs = require('fs');
const LOG = 'D:/MunderDifflin/hive/log.jsonl';
const CFG = 'D:/MunderDifflin/.userdata/config.json';
const LOOKBACK = (Number(process.argv[2]) || 180) * 60_000;
const ACK_RE = /站会|standup/i;
const now = Date.now();

let L;
try {
  L = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
} catch (e) { console.log('READ FAIL', e.message); process.exit(5); }

const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
const m = (cfg.missions || []).find((x) => x.id === 'ops-standup');
if (!m) { console.log('NO ops-standup mission in config'); process.exit(5); }

const beats = L.filter((o) => o.kind === 'message' && o.from === 'scheduler' && /Hourly ops standup/i.test(o.subject || ''));
const recent = beats.filter((o) => o.ts > now - LOOKBACK);
console.log(`mission: enabled=${m.enabled} intervalMs=${m.intervalMs} to=${m.to} lastFiredAt=${new Date(m.lastFiredAt || 0).toLocaleString('zh-CN', { hour12: false })}`);
console.log(`近 ${LOOKBACK / 60000} 分钟发出 ${recent.length} 班（应见每小时 1 班，下一班 ${new Date((m.lastFiredAt || now) + m.intervalMs).toLocaleTimeString('zh-CN', { hour12: false })}）`);

const since = (t, ms = 25 * 60_000) => L.filter((o) => o.kind === 'message' && o.from === 'god' && o.ts > t && o.ts < t + ms);
/** 该班是否留了痕：先看 25 分钟内的正常回执；再看**任意时刻**带本班 HH:MM 字样的补开回执
 *  （11:26 那班是 12:06 补开的，只看 25 分钟窗会把它永久记成空班 → 谎报）。 */
function ackFor(b) {
  const hhmm = new Date(b.ts).toTimeString().slice(0, 5);
  const near = since(b.ts).filter((o) => ACK_RE.test(o.subject || ''));
  if (near.length) return { ok: true, late: false, subj: String(near[0].subject).slice(0, 34), to: near[0].to, lagS: Math.round((near[0].ts - b.ts) / 1000) };
  const later = L.filter((o) => o.kind === 'message' && o.from === 'god' && o.ts > b.ts &&
    ACK_RE.test(o.subject || '') && (o.subject || '').includes(hhmm));
  if (later.length) return { ok: true, late: true, subj: String(later[0].subject).slice(0, 34), to: later[0].to, lagS: Math.round((later[0].ts - b.ts) / 1000) };
  return { ok: false };
}
let missingAck = 0, missingFire = 0;
for (const b of recent) {
  const a = ackFor(b);
  const woke = since(b.ts).length > 0;
  console.log(' -', new Date(b.ts).toLocaleTimeString('zh-CN', { hour12: false }),
    '| delivered=' + JSON.stringify(b.delivered),
    '| god活动=' + (woke ? 'Y' : 'n'),
    '| 回执=' + (a.ok ? (a.late ? 'LATE+' + a.lagS + 's ' : a.lagS + 's ') + '→' + a.to + ' ' + a.subj : 'NONE'));
  if (!a.ok) missingAck++;
}
// 发出是否漏班：相邻间隔 >1.35h 记一次缺发
for (let i = 1; i < beats.length; i++) {
  const gap = beats[i].ts - beats[i - 1].ts;
  if (gap > m.intervalMs * 1.35) { missingFire++; console.log(' ! 漏班 gap', new Date(beats[i - 1].ts).toLocaleString('zh-CN', { hour12: false }), '->', new Date(beats[i].ts).toLocaleString('zh-CN', { hour12: false }), (gap / 60000).toFixed(0) + 'min'); }
}
// 回执黑洞：以"台账席位 inbox 目录的 mtime"为修复时刻，报修复前/修复后两个数——
// 只看 24h 总数会把修复前的旧 drop 一起算进来，看着像"没修好"。
const ledgerEpoch = (() => { try { return fs.statSync('D:/MunderDifflin/hive/agents/scheduler/inbox').mtimeMs; } catch (e) { return 0; } })();
const dropsAll = L.filter((o) => o.kind === 'drop' && o.reason === 'no-inbox' && (o.to === 'scheduler' || o.to === 'heartbeat') && o.ts > now - 24 * 3600_000);
const dropsBefore = dropsAll.filter((o) => o.ts < ledgerEpoch).length;
const dropsAfter = dropsAll.filter((o) => o.ts >= ledgerEpoch);
console.log(`to=系统席 的回执 drop：24h 共 ${dropsAll.length}（修复前 ${dropsBefore}｜修复后 ${dropsAfter.length}）`,
  ledgerEpoch ? `@台账建于 ${new Date(ledgerEpoch).toLocaleTimeString('zh-CN', { hour12: false })}` : '(无台账席位)');
for (const o of dropsAfter) console.log('   !! 修复后仍有 drop:', new Date(o.ts).toLocaleTimeString('zh-CN', { hour12: false }), o.from, '->', o.to);
console.log(`判定: 缺回执 ${missingAck}/${recent.length} 班 | 历史漏班 ${missingFire} 次 | 修复后 drop ${dropsAfter.length}`);
// 回执台账 + 席位清账。scheduler/heartbeat 是 2026-09-13 由 DSH 建的 synthetic 席位（只有 inbox，
// 无 outbox → router 见无 outbox 即 skip）。external-planner 是本机 DSH 自建席位（无唤醒轨，
// 邮件只进不出，实测曾堆到 51 封），所以每轮由本脚本代它 drain。
// --drain：把三席里 >30min 的**终态件**（inform/agree/done）搬进各自 inbox/.done（move 非 delete）；
//          requires_reply 的 request 一律**留着不归档**并显式点名——那是本轮真正要回答的东西。
const SYS_SEATS = ['scheduler', 'heartbeat', 'external-planner'];
// 归档时限分档：synthetic 系统席没人读，30 分钟即可收；external-planner 是**跨会话共享席位**
// （实测 12:48 出现过本会话没写过的消息=并行的炉石 DSH 会话在用同一席位），所以给它 2 小时，
// 免得本工具的自动清账把兄弟会话还没读的信搬走。
const CUT_BY_SEAT = { scheduler: 30 * 60_000, heartbeat: 30 * 60_000, 'external-planner': 120 * 60_000 };
if (process.argv.includes('--drain')) {
  const nowMs = Date.now();
  let n = 0; const pendingReq = [], moved = [];
  for (const id of SYS_SEATS) {
    const CUT = CUT_BY_SEAT[id] ?? 30 * 60_000;
    const inbox = `D:/MunderDifflin/hive/agents/${id}/inbox`;
    if (!fs.existsSync(inbox)) continue;
    fs.mkdirSync(inbox + '/.done', { recursive: true });
    for (const f of fs.readdirSync(inbox).filter((x) => x.endsWith('.json'))) {
      const full = `${inbox}/${f}`;
      let o = {}; try { o = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) {}
      const fresh = nowMs - fs.statSync(full).mtimeMs < CUT;
      if (o.act === 'request' && o.requires_reply) { if (!fresh) pendingReq.push(`${id}: ${f.slice(0, 20)} from=${o.from} ${String(o.subject).slice(0, 46)}`); continue; }
      if (fresh) continue;
      fs.renameSync(full, `${inbox}/.done/${f}`); n++;
      moved.push(`${id} ← ${o.from}/${o.act} ${String(o.subject).slice(0, 44)}`);
    }
  }
  console.log(`drained ${n} 封终态件 → .done（逐条清单，绝不静搬）:`);
  for (const x of moved.slice(0, 12)) console.log('    ', x);
  if (moved.length > 12) console.log('     …另有', moved.length - 12, '条');
  if (pendingReq.length) { console.log('!! 待回答的 request（本轮必须处理，不自动归档）:'); for (const p of pendingReq) console.log('   ', p); }
  else console.log('待回答 request: 0');
}
for (const id of SYS_SEATS) {
  const inbox = `D:/MunderDifflin/hive/agents/${id}/inbox`;
  const pending = fs.existsSync(inbox) ? fs.readdirSync(inbox).filter((x) => x.endsWith('.json')).length : -1;
  const archived = fs.existsSync(inbox + '/.done') ? fs.readdirSync(inbox + '/.done').filter((x) => x.endsWith('.json')).length : 0;
  console.log(`台账 ${id.padEnd(16)} pending=${pending < 0 ? '席位不存在' : pending} archived=${archived}`);
}
if (process.argv.includes('--drain')) process.exit(0);

if (missingFire && !recent.length) process.exit(4);
process.exit(missingAck ? 3 : 0);
