// 在两份临时副本上对同一 tsc 配置做「打补丁前 / 打补丁后」错误数对照，验证补丁不引入类型错误。
// 全程不触碰 D:\MunderDifflin\src（只读），产物落 D:\tmp_ts（非 C 盘）。
// 用法：node _verify_patch_typecheck.cjs [patch路径] [工作子目录名]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const REPO = 'D:/MunderDifflin';
const ROOT = 'D:/tmp_ts/' + (process.argv[3] || 'standup');
const PATCH = process.argv[2] || 'D:/tdsh/炉石传说/_standup_patch/ops-standup-wake.patch';
const INC = ['src/main', 'src/preload', 'src/shared'];
const FILES = ['tsconfig.node.json', 'electron.vite.config.ts', 'package.json'];

function mk(variant, apply) {
  const dir = path.join(ROOT, variant);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const d of INC) fs.cpSync(path.join(REPO, d), path.join(dir, d), { recursive: true });
  for (const f of FILES) { const s = path.join(REPO, f); if (fs.existsSync(s)) fs.copyFileSync(s, path.join(dir, f)); }
  // node_modules 用 junction 指回原仓，零拷贝、不写 C 盘
  const lm = path.join(dir, 'node_modules');
  try { fs.unlinkSync(lm); } catch (e) {}
  cp.execSync(`mklink /J "${lm}" "${REPO}/node_modules"`, { shell: 'cmd.exe', stdio: 'ignore' });
  if (apply) {
    cp.execSync(`git init -q . && git apply "${PATCH}"`, { cwd: dir, stdio: 'pipe' });
    console.log(variant, ': patch applied OK');
  } else console.log(variant, ': pristine');
  return dir;
}

function typecheck(dir) {
  let out = '';
  try {
    out = cp.execSync('node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json', { cwd: dir, maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (e) { out = (e.stdout || '').toString() + (e.stderr || '').toString(); }
  const errs = out.split('\n').filter(l => /error TS\d+/.test(l));
  return { errs, raw: out };
}

const A = mk('pristine', false);
const B = mk('patched', true);
console.log('typechecking pristine ...'); const a = typecheck(A);
console.log('typechecking patched  ...'); const b = typecheck(B);
console.log('\n=== 对照 ===');
console.log('pristine errors:', a.errs.length);
console.log('patched  errors:', b.errs.length);
const sa = new Set(a.errs), sb = new Set(b.errs);
const onlyPatched = b.errs.filter(e => !sa.has(e));
const onlyPristine = a.errs.filter(e => !sb.has(e));
console.log('补丁新增的错误 (must be 0):', onlyPatched.length);
for (const e of onlyPatched.slice(0, 25)) console.log('   +', e);
console.log('补丁消失的错误:', onlyPristine.length);
for (const e of onlyPristine.slice(0, 5)) console.log('   -', e);
if (a.errs.length) { console.log('\n既有错误基线（与补丁无关，按既有状态绕行）前 5 条:'); console.log(a.errs.slice(0, 5).join('\n')); }
fs.writeFileSync(path.join(ROOT, 'typecheck_compare.txt'),
  `pristine=${a.errs.length} patched=${b.errs.length} newly_introduced=${onlyPatched.length}\n\n-- patched-only --\n${onlyPatched.join('\n')}\n\n-- pristine baseline --\n${a.errs.join('\n')}\n`, 'utf8');
console.log('\nreport:', path.join(ROOT, 'typecheck_compare.txt'));
process.exit(onlyPatched.length ? 1 : 0);
