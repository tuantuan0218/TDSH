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
// 修复时刻必须用**创建时间**（birthtime）。第一版用 mtime，结果 13:53 那封真实回执把目录 mtime 顶到
// 13:53:27，"修复前/后"的分界就跟着往后漂移——会把 12:39~13:53 之间的 drop 误标成"修复前"。
const ledgerEpoch = (() => {
  try {
    const st = fs.statSync('D:/MunderDifflin/hive/agents/scheduler/inbox');
    const b = st.birthtimeMs || 0;
    return b > 0 ? b : st.mtimeMs;
  } catch (e) { return 0; }
})();
const dropsAll = L.filter((o) => o.kind === 'drop' && o.reason === 'no-inbox' && (o.to === 'scheduler' || o.to === 'heartbeat') && o.ts > now - 24 * 3600_000);
const dropsBefore = dropsAll.filter((o) => o.ts < ledgerEpoch).length;
const dropsAfter = dropsAll.filter((o) => o.ts >= ledgerEpoch);
console.log(`to=系统席 的回执 drop：24h 共 ${dropsAll.length}（修复前 ${dropsBefore}｜修复后 ${dropsAfter.length}）`,
  ledgerEpoch ? `@台账建于 ${new Date(ledgerEpoch).toLocaleTimeString('zh-CN', { hour12: false })}` : '(无台账席位)');
for (const o of dropsAfter) console.log('   !! 修复后仍有 drop:', new Date(o.ts).toLocaleTimeString('zh-CN', { hour12: false }), o.from, '->', o.to);
console.log(`判定: 缺回执 ${missingAck}/${recent.length} 班 | 历史漏班 ${missingFire} 次 | 修复后 drop ${dropsAfter.length}`);
// ─── 自愈轨 --heal ──────────────────────────────────────────────────────────────
// 逾期无回执的班次，用**专属席位 hive-ops**（不共用 external-planner）补投一次。
// 三条硬护栏，避免"自愈"变成新的噪声源/自激回路：
//   1) 同一班次永不再补（_heal_log.json 记 beatId → 补投时刻，幂等）；
//   2) 每小时最多一次（跨班次限流）；
//   3) 只补 healMaxAge 分钟内的班（默认 60），历史久案只报不动手（--dry 全量可见）。
// 先 --heal --dry 看决策，再摘掉 --dry 真投。
const SEAT = 'hive-ops';
const HEAL_LOG = 'D:/tdsh/炉石传说/_heal_log.json';
function overdueBeats(graceMs) {
  return recent.filter((b) => !ackFor(b).ok && now - b.ts > graceMs);
}
const cand = overdueBeats(Number(process.env.HEAL_GRACE_MS || 25 * 60_000));
if (has0('--heal')) {
  const log = (() => { try { return JSON.parse(fs.readFileSync(HEAL_LOG, 'utf8')); } catch (e) { return {}; } })();
  const HEAL_MAX_AGE = Number(process.env.HEAL_MAX_AGE_MIN || 60) * 60_000;
  const HOUR = 3600_000;
  const recentHeals0 = Object.values(log).filter((t) => now - t < HOUR).length;
  let budgetUsed = 0;
  console.log(`\n--heal: 逾期候选 ${cand.length} 班（宽限 ${Math.round(Number(process.env.HEAL_GRACE_MS || 1500000) / 60000)}min）| 历史已补投 ${Object.keys(log).length} 次 | 1h 内已用额度 ${recentHeals0}/1`);
  for (const b of cand) {
    const age = Math.round((now - b.ts) / 60000);
    if (log[b.id]) { console.log(`   跳过 ${new Date(b.ts).toLocaleTimeString('zh-CN', { hour12: false })} 已补投于 ${new Date(log[b.id]).toLocaleTimeString('zh-CN', { hour12: false })}`); continue; }
    if (age * 60_000 > HEAL_MAX_AGE) { console.log(`   不动手 ${new Date(b.ts).toLocaleTimeString('zh-CN', { hour12: false })} 已过时 ${age}min（> ${HEAL_MAX_AGE / 60000}min），只报不补`); continue; }
    if (recentHeals0 + budgetUsed >= 1) { console.log('   限流：1 小时内已补投过一次，本班不再补'); continue; }
    const hhmm = new Date(b.ts).toTimeString().slice(0, 5);
    if (process.argv.includes('--dry')) { console.log(`   [DRY] 将补投：班 ${hhmm}（逾期 ${age}min）→ god，发件人 ${SEAT}`); continue; }
    const body = [
      `运维站会 ${hhmm} 那班逾期 ${age} 分钟无回执（DSH 自愈轨自动补投，同一班只补这一次）。`,
      '请现在按现行判据核查并回一行：席位停滞看 log.jsonl 各席最后外发时间戳 + fleet 的 inboxBacklog/onHold/breaker；任务看 tasks.json 的 blocked/无人认领；看板看 board.md 头部。',
      '无异常也回一句「站会 HH:MM 无异常」，收件人写 hive-ops（别写 god 自己，那等于无痕；也别写 scheduler，历史上有 136 条回执在那里被丢）。',
      '背景与判据出处：D:/MunderDifflin/hive/docs/OPS-STANDUP-NOT-FIRING-20260913.md（§1.2b 两道闸、§11 仪表空转）。'
    ].join('\n');
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
    fs.mkdirSync(`D:/MunderDifflin/hive/agents/${SEAT}/outbox/.sent`, { recursive: true });
    fs.writeFileSync(`D:/MunderDifflin/hive/agents/${SEAT}/outbox/${id}.json`,
      JSON.stringify({ to: 'god', act: 'request', subject: `【自愈补投】站会 ${hhmm} 班逾期 ${age}min 无回执`, body }, null, 2), 'utf8');
    log[b.id] = now;
    fs.writeFileSync(HEAL_LOG, JSON.stringify(log, null, 1), 'utf8');
    console.log(`   ✓ 已补投 班 ${hhmm}（${body.length} 字符，id=${id.slice(-8)}），台账已记`);
    budgetUsed++;
  }
}
function has0(flag) { return process.argv.includes(flag); }

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
