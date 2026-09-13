// 生成 ops-standup 唤醒修复的候选补丁（只读源文件，绝不改 src；在临时副本上替换后 git diff --no-index）
// 用法：node _make_standup_patch.cjs   然后（用户批准后）：cd D:\MunderDifflin && git apply --check hive/docs/ops-standup-wake.patch
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = 'D:/MunderDifflin/src/main';
const WORK = 'D:/tdsh/炉石传说/_standup_patch';
const files = ['index.ts', 'config.ts'];

for (const sub of ['a/src/main', 'b/src/main']) {
  fs.mkdirSync(path.join(WORK, sub), { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(SRC, f), path.join(WORK, sub, f));
}

const R = [];
// ── config.ts: mission 上一个显式"必须被应答"开关 ──
R.push(['config.ts',
`  quietThresholdMs?: number;
}`,
`  quietThresholdMs?: number;
  /** Dispatch missions only, DEFAULT ON (opt out with \`wake: false\`). A wake-eligible
   *  beat is NOT treated as the scheduler's own noise: while it sits UNANSWERED in
   *  god's inbox it counts as actionable mail, so an agent stuck in a 30-minute turn
   *  can no longer bulk-file the ops standup into inbox/.done without answering it.
   *
   *  Self-limiting by construction: the count is over UNREAD inbox mail, so the nag
   *  stops the moment the beat is drained, and \`WAKE_BEAT_WINDOW_MS\` bounds it even
   *  if the floor never drains. Heartbeat digests and breaker steers stay excluded —
   *  that exclusion is what stops steer->inbox->wake->steer self-exciting (#151), and
   *  this change does not touch either sender. */
  wake?: boolean;
}

/** How long an unanswered wake beat stays actionable (bounded nag). */
export const WAKE_BEAT_WINDOW_MS = 20 * 60_000;`]);

// ── index.ts (0/4): 值导入 ──
R.push(['index.ts',
`  modelForRole, OPS_STANDUP_MISSION, HEARTBEAT_MISSION, COMPACT_MAINTENANCE_MISSION, type HarnessConfig, type ScheduledMission`,
`  modelForRole, OPS_STANDUP_MISSION, HEARTBEAT_MISSION, COMPACT_MAINTENANCE_MISSION, WAKE_BEAT_WINDOW_MS, type HarnessConfig, type ScheduledMission`]);

// ── index.ts (1/3): 导入窗口常量 ──
R.push(['index.ts',
`const SYSTEM_SENDERS = new Set(['heartbeat', 'scheduler', 'breaker', 'system']);`,
`const SYSTEM_SENDERS = new Set(['heartbeat', 'scheduler', 'breaker', 'system']);

/** Beat subject -> ms timestamp of the last \`wake\` mission fire carrying it. The
 *  scheduler dispatches missions with \`subject: m.label\`, so the label is the join
 *  key back to the mission that owns the mail. Pruned on read. */
const wakeBeats = new Map<string, number>();

/** Stamp a mission beat as demanding an answer (called from the mission fire()). */
function markWakeBeat(label: string, at = Date.now()): void {
  wakeBeats.set(label, at);
}

/** Is this scheduler beat an unanswered, still-in-window \`wake\` mission request?
 *  Deliberately narrow: sender must be 'scheduler' (never 'heartbeat'/'breaker'),
 *  act must be 'request', and the beat must be a mission that opted in and is
 *  inside WAKE_BEAT_WINDOW_MS. Everything else keeps the old non-waking behaviour. */
function isWakeEligibleMail(m: { from: string; act?: string; subject?: string; created_at?: string }): boolean {
  if (!wakeBeats.size) return false;
  if (m.from !== 'scheduler' || m.act !== 'request') return false;
  const firedAt = wakeBeats.get(m.subject ?? '');
  if (firedAt === undefined) return false;
  if (Date.now() - firedAt > WAKE_BEAT_WINDOW_MS) { wakeBeats.delete(m.subject ?? ''); return false; }
  return true;
}`]);

// ── index.ts (2/3): actionable 口径收紧 ──
R.push(['index.ts',
`    return hive.inbox(godId).filter((m) => !SYSTEM_SENDERS.has(m.from)).length;`,
`    return hive.inbox(godId).filter((m) => !SYSTEM_SENDERS.has(m.from) || isWakeEligibleMail(m)).length;`]);

// ── index.ts (3/3): fire() 里给 opted-in 的 mission 打唤醒戳 ──
R.push(['index.ts',
`        if (m.kind !== 'compact' && hive.enabled()) {
          hive.send({ to: m.to, act: 'request', subject: m.label, body: m.body }, 'scheduler');
        }`,
`        if (m.kind !== 'compact' && hive.enabled()) {
          hive.send({ to: m.to, act: 'request', subject: m.label, body: m.body }, 'scheduler');
          // Opt-in wake semantics: until this beat is drained (and at most
          // WAKE_BEAT_WINDOW_MS), the heartbeat counts it as actionable mail and
          // re-engages god. Fixes "the standup fires but nobody holds me to it".
          if (m.wake !== false) markWakeBeat(m.label);
        }`]);

let changed = 0; const failed = [];
for (const [f, find, repl] of R) {
  const p = path.join(WORK, 'b/src/main', f);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(find)) { failed.push(f + ': anchor NOT FOUND'); continue; }
  if (s.split(find).length > 2) { failed.push(f + ': anchor appears ' + (s.split(find).length - 1) + 'x (ambiguous)'); continue; }
  fs.writeFileSync(p, s.replace(find, repl), 'utf8');
  changed++;
}
console.log('anchors applied:', changed, '/', R.length);
if (failed.length) { console.log('FAILED:\n  ' + failed.join('\n  ')); process.exit(2); }

const out = path.join(WORK, 'ops-standup-wake.patch');
let d = '';
try {
  d = cp.execSync('git diff --no-index --unified=3 a b', { cwd: WORK, maxBuffer: 32 * 1024 * 1024 }).toString();
} catch (e) {
  // git diff --no-index exits 1 when files differ — that IS the success path.
  d = (e.stdout || '').toString();
  if (!d.trim()) { console.log('git diff failed:', e.message); process.exit(3); }
}
if (!d.trim()) { console.log('EMPTY DIFF — nothing generated'); process.exit(3); }
// git prefixed with the literal dir names (a/a/src, b/b/src) — collapse to a/ b/ so
// `git apply -p1` inside D:\MunderDifflin resolves to src/main/<file>.
d = d.replace(/diff --git a\/a\/ b\/b\//g, 'diff --git a/ b/')
     .replace(/^--- a\/a\//gm, '--- a/')
     .replace(/^\+\+\+ b\/b\//gm, '+++ b/')
     .replace(/a\/a\/src\/main/g, 'a/src/main').replace(/b\/b\/src\/main/g, 'b/src/main');
if (/a\/a\/|b\/b\//.test(d)) { console.log('PATH REWRITE INCOMPLETE'); process.exit(4); }
fs.writeFileSync(out, d, 'utf8');
console.log('patch:', out, d.length, 'bytes');
console.log(d.split('\n').filter(l => /^(diff|---|\+\+\+|@@)/.test(l)).join('\n'));
