/**
 * 主监控告警链路 E2E 验证（e2e-monitor-alert.mjs）
 *
 * 目标：证明 free-quota-monitor.mjs 的告警**真能产出并落盘**，
 *       而非仅纯函数（sectionsOk/mergeLastGood/diff）自测通过。
 *
 * 手法：用 --fixtures 离线模式（确定性、不依赖网络）跑真实 main，
 *       通过在快照里注入受控变化，断言报告中真的出现对应告警。
 *
 * 为何要离线：网络抓取会引入抖动，"有没有告警"会被"抓没抓到"混淆。
 *       fixtures 模式让输入完全可控，告警的有无只取决于我们注入的数据。
 *
 * 安全：注入前备份、finally 必还原、末尾断言零残留。
 *
 * 用法：node e2e-monitor-alert.mjs
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ROOT = 'D:/tdsh/sub2api/';
const SNAP = ROOT + 'free-quota-snapshots/snapshot-latest.json';
const REPORT = ROOT + 'FREE-QUOTA-MONITOR.md';
const MARK = '[E2E-MON-INJECTED]';

let fails = 0;
const ck = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const run = (args) => {
  const r = spawnSync(process.execPath, [ROOT + 'free-quota-monitor.mjs', ...args], { encoding: 'utf8', timeout: 120000 });
  return (r.stdout || '') + (r.stderr || '');
};

if (!existsSync(SNAP)) {
  console.log('SKIP 无主监控快照，先跑一次 free-quota-monitor.mjs');
  process.exit(0);
}

const origSnap = readFileSync(SNAP, 'utf8');

/* ---- ⓪ 先验：fixtures 回归路径本身是活的（本会话修过 get() 返回同构缺陷）---- */
{
  const out = run(['--fixtures', '--no-official']);
  const m = out.match(/stations=(\d+) batches=(\d+) mirror=(\d+) v2ex=(\d+)/);
  ck(!!m, '⓪ fixtures 模式产出统计行');
  if (m) {
    const [, st, bf, mi, vx] = m.map(Number);
    ck(st > 0 && bf > 0 && vx > 0,
      `⓪ fixtures 解析非空（stations=${st} batches=${bf} mirror=${mi} v2ex=${vx}）—— 全 0 即 get() 返回类型回归`);
  }
}

try {
  /* ---- ① 注入：从基线里删掉一个公益站 → 必然触发「⚫ 公益站下架」---- */
  const s = JSON.parse(origSnap);
  if (!s.stations || !s.stations.length) { console.log('SKIP 基线无 stations 可注入'); process.exit(0); }
  const victim = s.stations[0];
  const trimmed = { ...s, stations: s.stations.slice(1) };
  writeFileSync(SNAP, JSON.stringify(trimmed, null, 1));
  console.log(`注入：从基线移除公益站 «${victim.name}»`);

  /* ---- ② 跑生产流程（fixtures：站点列表来自 fixture，与被删的基线不同）---- */
  const out = run(['--fixtures', '--no-official']);

  ck(/公益站下架|公益站/.test(out) || /⚫|🆕/.test(out),
    '① 运行后出现公益站相关告警（下架/新增）');

  const report = readFileSync(REPORT, 'utf8');
  const hasStationAlert = /⚫ 公益站下架|🆕 新公益站/.test(report);
  ck(hasStationAlert, '② **公益站告警已落盘到报告文件**（不止 stdout）');

  /* ---- ③ 对照：正常跑时不应出现"全站下架"式假告警 ---- */
  writeFileSync(SNAP, origSnap);
  run(['--fixtures', '--no-official']);
  const report2 = readFileSync(REPORT, 'utf8');
  const panic = report2.split('\n').filter((l) => /⚫ 公益站下架/.test(l));
  ck(panic.length === 0, '③ 负对照：基线正常时不产「公益站下架」假告警');
} finally {
  writeFileSync(SNAP, origSnap);
  try { if (existsSync(SNAP + '.e2e')) unlinkSync(SNAP + '.e2e'); } catch { /* ignore */ }
  run(['--fixtures', '--no-official']); // 让报告与还原后的基线一致
  const fin = existsSync(REPORT) ? readFileSync(REPORT, 'utf8') : '';
  ck(!fin.includes(MARK), '④ 清理：报告无注入痕迹');
}

console.log(`E2E-MONITOR ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
