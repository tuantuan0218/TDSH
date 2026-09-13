/**
 * 端到端告警闭环验证（e2e-alert-injection.mjs）
 *
 * 与 free-official-tiers.replay.mjs 的区别：
 *   - replay.mjs  ：**不联网**，直接调纯函数断言告警文案（快、可离线）
 *   - 本脚本       ：**真跑一遍生产 main**，通过在快照里注入受控变化，
 *                    证明"运行 → 检出 → 告警 → 落盘报告"整条链路真的通。
 *
 * 这是"验证产物而非验证函数"的落地：只有真的在报告文件里看到告警行，才算闭环。
 *
 * 安全设计：
 *   1. 注入前备份快照与报告；
 *   2. 无论成功失败，finally 必还原（不留脏数据）；
 *   3. 还原后再跑一次 --quiet 让报告回到干净状态，并**断言零注入痕迹**。
 *
 * 用法：node e2e-alert-injection.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = 'D:/tdsh/sub2api/';
const SNAP = ROOT + 'free-official-snapshots/snapshot-latest.json';
const REPORT = ROOT + 'FREE-OFFICIAL-TIERS.md';
const BAK_SNAP = ROOT + 'free-official-snapshots/_e2e_backup.json';
const MARK = '[E2E-INJECTED]';

let fails = 0;
const ck = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (args) => spawnSync(process.execPath, [ROOT + 'free-official-tiers.mjs', ...args], { encoding: 'utf8' });

if (!existsSync(SNAP)) {
  console.log('SKIP 无快照，先跑一次 free-official-tiers.mjs');
  process.exit(0);
}

const origSnap = readFileSync(SNAP, 'utf8');
const origReport = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : null;

try {
  /* ---- ① 注入受控变化 ---- */
  copyFileSync(SNAP, BAK_SNAP);
  const s = JSON.parse(origSnap);
  const target = s.records.find((r) => r.chinaDirect && r.credits);
  if (!target) { console.log('SKIP 快照里没有可注入的带额度记录'); process.exit(0); }

  const originalCredits = target.credits;
  target.credits = originalCredits + ' ' + MARK;
  writeFileSync(SNAP, JSON.stringify(s, null, 1));
  console.log(`注入：${target.name} 额度 «${originalCredits}» → «${target.credits}»`);

  /* ---- ② 真实跑一遍生产流程 ---- */
  const r = run([]);
  const stdout = (r.stdout || '') + (r.stderr || '');

  ck(/额度变化/.test(stdout), '① 运行 stdout 出现「额度变化」告警');
  ck(stdout.includes(target.name), '② 告警指名到具体厂商');
  ck(stdout.includes(MARK) || stdout.includes(originalCredits), '③ 告警带旧值/新值（可定位是哪一侧变了）');

  /* ---- ③ 关键：报告文件真落盘 ---- */
  const report = readFileSync(REPORT, 'utf8');
  const alertLine = report.split('\n').filter((l) => l.includes('💰 额度变化') && l.includes(target.name));
  ck(alertLine.length >= 1, '④ **告警已落盘到报告文件**（不止 stdout）');
  if (alertLine.length) console.log('   报告实据: ' + alertLine[0].trim());

  /* ---- ④ 负对照：把注入值还原后，告警必须消失 ---- */
  const s2 = JSON.parse(origSnap);
  writeFileSync(SNAP, JSON.stringify(s2, null, 1));
  run(['--quiet']);
  const report2 = readFileSync(REPORT, 'utf8');
  const still = report2.split('\n').filter((l) => l.includes('💰 额度变化') && l.includes(target.name));
  ck(still.length === 0, '⑤ 负对照：还原后该告警消失（证明告警来源真是数据变化，非文案常驻）');
} finally {
  /* ---- 必还原：任何异常都不留脏数据 ---- */
  writeFileSync(SNAP, origSnap);
  if (origReport != null && !existsSync(BAK_SNAP)) writeFileSync(REPORT, origReport);
  try { if (existsSync(BAK_SNAP)) unlinkSync(BAK_SNAP); } catch { /* ignore */ }
  run(['--quiet']); // 让报告回到与还原后快照一致的状态

  const finalSnap = readFileSync(SNAP, 'utf8');
  const finalReport = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : '';
  ck(!finalSnap.includes(MARK), '⑥ 清理：快照无注入痕迹');
  ck(!finalReport.includes(MARK), '⑥ 清理：报告无注入痕迹');
}

console.log(`E2E ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
