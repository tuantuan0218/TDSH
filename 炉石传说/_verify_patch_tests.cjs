// 在「pristine / patched」两份临时副本上分别跑唤醒轨单测，证明补丁不回归唤醒/投递语义。
// 全程不触碰 D:\MunderDifflin\src（只读）；产物落 D:\tmp_ts（非 C 盘）。
// 用法：node _verify_patch_tests.cjs [patch路径] [工作子目录名]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const REPO = 'D:/MunderDifflin';
const ROOT = 'D:/tmp_ts/' + (process.argv[3] || 'standup');
const PATCH = process.argv[2] || 'D:/tdsh/炉石传说/_standup_patch/ops-standup-wake.patch';
// 如实报错：PowerShell 会把空串参数 "" 直接丢掉，导致 argv 错位（实测 "" standup → PATCH="standup"），
// 于是 git apply 抛一个看不懂的错。宁可在这里显式失败。
if (!fs.existsSync(PATCH)) { console.error(`PATCH 路径不存在: "${PATCH}"（注意 PS 会丢弃空串参数，请传完整路径）`); process.exit(2); }
// 必须含 src/renderer：queue-delivery.test.cjs 走 load-ts 读 src/renderer/src/hooks/queueDelivery.ts，
// 漏拷会让该套件在两副本同时报 MODULE MISSING——那是工具缺陷，不是代码回归（本会话实测踩过）。
const INC = ['src/main', 'src/preload', 'src/shared', 'src/renderer'];
const FILES = ['tsconfig.node.json', 'electron.vite.config.ts', 'package.json'];
// 唤醒 / 投递 / 排程 四条轨——正是本补丁可能影响的面
const SUITES = ['worker-wake.test.cjs', 'hive-nudge.test.cjs', 'queue-delivery.test.cjs', 'weekly-schedule.test.cjs', 'breaker.test.cjs'];

function mk(variant, apply) {
  const dir = path.join(ROOT, variant);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const d of INC) fs.cpSync(path.join(REPO, d), path.join(dir, d), { recursive: true });
  for (const f of FILES) { const s = path.join(REPO, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dir, f)); }
  fs.cpSync(path.join(REPO, 'test'), path.join(dir, 'test'), { recursive: true });
  const lm = path.join(dir, 'node_modules');
  try { fs.unlinkSync(lm); } catch (e) {}
  cp.execSync(`mklink /J "${lm}" "${REPO}/node_modules"`, { shell: 'cmd.exe', stdio: 'ignore' });
  if (apply) { cp.execSync(`git init -q . && git apply "${PATCH}"`, { cwd: dir, stdio: 'pipe' }); }
  // 补丁真的进副本了吗：通用判据是"字节数变了"；标识符检查只有在传了 argv[4] 时才做
  // （硬编码某个补丁的标识符去验另一个补丁，会得到误导性的 false——本会话实测踩过）。
  const MARK = process.argv[4];
  // 标识符要在全 src 里找，只 grep index.ts 会把"补丁改在 transcript.ts"误报成 MISS（本会话实测踩过）。
  let markHit = false, idxBytes = 0;
  try { idxBytes = fs.readFileSync(path.join(dir, 'src/main/index.ts'), 'utf8').length; } catch (e) {}
  if (MARK) {
    const rx = new RegExp(MARK);
    const walk = (d2) => { for (const e of fs.readdirSync(d2, { withFileTypes: true })) { const p = path.join(d2, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name) && rx.test(fs.readFileSync(p, 'utf8'))) markHit = true; } };
    walk(path.join(dir, 'src'));
  }
  console.log(variant.padEnd(9), 'index.ts bytes:', idxBytes, MARK ? `| marker /${MARK}/ 全 src 检索: ${markHit ? 'HIT' : 'MISS'}` : '');
  return { dir, bytes: idxBytes, markHit };
}

function run(dir) {
  const res = {};
  for (const t of SUITES) {
    let out = '';
    try { out = cp.execSync(`node --test test/${t}`, { cwd: dir, maxBuffer: 32e6, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
    catch (e) { out = ((e.stdout || '') + '' + (e.stderr || '')).toString(); }
    const pass = +(out.match(/# pass (\d+)/) || [0, 0])[1];
    const fail = +(out.match(/# fail (\d+)/) || [0, 0])[1];
    const missing = /Cannot find module|ENOENT/.test(out);
    res[t] = { pass, fail, missing };
  }
  return res;
}

const a = mk('pristine', false), b = mk('patched', true);
console.log('\nrunning suites on pristine ...'); const ra = run(a.dir);
console.log('running suites on patched ...'); const rb = run(b.dir);
console.log('\n=== 唤醒/投递/排程轨：pristine vs patched ===');
let diff = 0;
for (const t of SUITES) {
  const x = ra[t], y = rb[t];
  const same = x.pass === y.pass && x.fail === y.fail;
  if (!same) diff++;
  console.log(`${t.padEnd(26)} pristine pass=${x.pass} fail=${x.fail}${x.missing ? ' [MODULE MISSING]' : ''}   patched pass=${y.pass} fail=${y.fail}${y.missing ? ' [MODULE MISSING]' : ''}   ${same ? 'IDENTICAL' : '*** DIFF ***'}`);
}
const totalFail = Object.values(ra).reduce((s, v) => s + v.fail, 0) + Object.values(rb).reduce((s, v) => s + v.fail, 0);
const totalPass = Object.values(rb).reduce((s, v) => s + v.pass, 0);
// 两条自检（防"假绿"）：① patched 副本必须真的与 pristine 不同（字节数），否则测的是同一份代码；
// ② patched 必须至少跑过 1 个用例，否则"0 失败"只是没跑。
const applied = b.bytes !== a.bytes;
console.log(`\n差异套件数: ${diff} | 两副本合计失败用例: ${totalFail} | patched 通过用例: ${totalPass} | 补丁确实进副本: ${applied ? 'YES (' + a.bytes + '→' + b.bytes + ')' : 'NO — 两副本字节相同，本次对照无效！'}`);
fs.writeFileSync(path.join(ROOT, 'test_compare.txt'),
  JSON.stringify({ pristine: ra, patched: rb, diffSuites: diff, totalFail, totalPass, bytesPristine: a.bytes, bytesPatched: b.bytes }, null, 1), 'utf8');
console.log('report:', path.join(ROOT, 'test_compare.txt'));
process.exit(diff === 0 && totalFail === 0 && applied && totalPass > 0 ? 0 : 1);
