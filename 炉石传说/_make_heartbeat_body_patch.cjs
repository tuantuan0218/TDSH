// 候选补丁 #3：让 Schedules 面板里 heartbeat 的「正文」真的生效（当前是假可编辑字段）。
// 只读源文件 → 临时副本替换 → git diff --no-index。绝不改 D:\MunderDifflin\src。
// 用法：node _make_heartbeat_body_patch.cjs
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = 'D:/MunderDifflin/src/main';
const WORK = 'D:/tdsh/炉石传说/_standup_patch/hb';
const FILES = ['index.ts'];

for (const sub of ['a/src/main', 'b/src/main']) {
  fs.mkdirSync(path.join(WORK, sub), { recursive: true });
  for (const f of FILES) fs.copyFileSync(path.join(SRC, f), path.join(WORK, sub, f));
}

const R = [];
// 1) 签名：多一个"结尾指令"入参
R.push(['index.ts',
`function buildHeartbeatDigest(quietMs: number, actionable = 0): string {`,
`/** \`closing\` = the operator's own heartbeat prompt, typed in the Schedules panel.
 *  Until now that field was written to config, echoed back by the UI, and NEVER
 *  read by armHeartbeat — editing it changed nothing (2026-09-13: the live digest
 *  god received was the hardcoded English template while the panel showed a
 *  Chinese instruction). Passing it through restores the operator's intent without
 *  touching WHO the beat goes to or the adaptive cadence. Falls back to the shipped
 *  line when the field is blank, so existing configs behave exactly as before. */
function buildHeartbeatDigest(quietMs: number, actionable = 0, closing?: string): string {`]);

// 2) 末行：操作者的话优先
R.push(['index.ts',
`    'Re-engage anyone stalled or blocked and keep the board accurate — or rest if the work is genuinely done.'
  ].join('\\n');`,
`    (closing && closing.trim())
      ? closing.trim()
      : 'Re-engage anyone stalled or blocked and keep the board accurate — or rest if the work is genuinely done.'
  ].join('\\n');`]);

// 3) 调用点：把 mission 正文接上
R.push(['index.ts',
`        reengageGod(buildHeartbeatDigest(quiet, actionable));`,
`        reengageGod(buildHeartbeatDigest(quiet, actionable, m.body));`]);

let changed = 0; const failed = [];
for (const [f, find, repl] of R) {
  const p = path.join(WORK, 'b/src/main', f);
  const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(find)) { failed.push(f + ': anchor NOT FOUND'); continue; }
  if (s.split(find).length > 2) { failed.push(f + ': anchor appears ' + (s.split(find).length - 1) + 'x (ambiguous)'); continue; }
  fs.writeFileSync(p, s.replace(find, repl), 'utf8');
  changed++;
}
console.log('anchors applied:', changed, '/', R.length);
if (failed.length) { console.log('FAILED:\n  ' + failed.join('\n  ')); process.exit(2); }

const out = path.join(WORK, 'heartbeat-body-honored.patch');
let d = '';
try { d = cp.execSync('git diff --no-index --unified=3 a b', { cwd: WORK, maxBuffer: 32e6 }).toString(); }
catch (e) { d = (e.stdout || '').toString(); if (!d.trim()) { console.log('git diff failed', e.message); process.exit(3); } }
if (!d.trim()) { console.log('EMPTY DIFF'); process.exit(3); }
// git 用字面目录名当前缀（a/a/src…、b/b/src…）→ 收成 a/ b/，让 `git apply -p1` 在仓根直接可用
d = d.replace(/diff --git a\/a\/ b\/b\//g, 'diff --git a/ b/')
  .replace(/^--- a\/a\//gm, '--- a/')
  .replace(/^\+\+\+ b\/b\//gm, '+++ b/')
  .replace(/a\/a\/src\/main/g, 'a/src/main').replace(/b\/b\/src\/main/g, 'b/src/main');
if (/a\/a\/|b\/b\//.test(d)) { console.log('PATH REWRITE INCOMPLETE'); process.exit(4); }
fs.writeFileSync(out, d, 'utf8');
console.log('patch:', out, d.length, 'bytes');
console.log(d.split('\n').filter((l) => /^(diff|---|\+\+\+|@@)/.test(l)).join('\n'));
