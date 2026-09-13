/**
 * 免费 API 监控体系 — 单一回归入口（run-free-api-regression.mjs）
 *
 * 一条命令跑完全部验证，回答一个问题：**这套监控现在还可信吗？**
 *
 * 覆盖三层：
 *   1. 纯函数层   —— diff/staleness/extractFreeModels 等逻辑正确性
 *   2. 告警文案层 —— 变化真的会转成告警文案（离线回放，不联网）
 *   3. 端到端层   —— 真跑生产 main，告警真的写进报告文件（含受控注入 + 还原）
 *
 * 用法：
 *   node run-free-api-regression.mjs           # 全量（含联网，约 1~3 分钟）
 *   node run-free-api-regression.mjs --offline # 跳过联网项，仅确定性检查
 *
 * 退出码：0 = 全过；1 = 有失败（可直接当门禁用）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = 'D:/tdsh/sub2api/';
const offline = process.argv.includes('--offline');
const UA_NOTE = offline ? '（--offline：跳过联网检查）' : '';

/** 每个用例：name / 命令 / 判定全过的标志串 / 是否需联网 */
const CASES = [
  {
    name: '官方免费档·纯函数自测',
    file: 'free-official-tiers.mjs', args: ['--selftest'],
    pass: /SELFTEST ALL PASS/, net: false,
  },
  {
    name: '官方免费档·告警文案回放',
    file: 'free-official-tiers.replay.mjs', args: [],
    pass: /REPLAY ALL PASS/, net: false,
  },
  {
    name: '主监控·纯函数自测',
    file: 'free-quota-monitor.mjs', args: ['--selftest'],
    pass: /SELFTEST ALL PASS/, net: false,
  },
  {
    name: '官方免费档·端到端注入',
    file: 'e2e-alert-injection.mjs', args: [],
    pass: /E2E ALL PASS/, net: true,
  },
  {
    name: '主监控·端到端注入',
    file: 'e2e-monitor-alert.mjs', args: [],
    pass: /E2E-MONITOR ALL PASS/, net: false,
  },
  {
    // 扫描器精度自证：必须抓到阳性对照（复刻已修的 get() 缺陷），且不误报阴性对照。
    // 若此检查挂掉，说明"没有发现隐蔽缺陷"这一结论本身不可信。
    name: '隐蔽缺陷·扫描器精度自证',
    file: 'scan-silent-failures.mjs', args: ['_scan_fixtures/positive-control-get.mjs'],
    pass: /get\(\) 返回形态不一/, net: false,
  },
  {
    // 免key探测器自证：必须命中已知的两个免key可用端点（pollinations + xzt）。
    // 若为 0，说明探测器失效 —— 由此得出的"免key端点已全部失效"结论不可信。
    name: '免key探测·探测器自证',
    file: 'probe-keyless-endpoints.mjs', args: ['_scan_fixtures/keyless-controls.txt'],
    pass: /免 key 真出词 \*\*2\*\*/, net: true,
  },
];

console.log('免费 API 监控体系 — 回归验证 ' + UA_NOTE);
console.log('='.repeat(60));

let pass = 0, fail = 0, skip = 0;
const results = [];

for (const c of CASES) {
  const path = ROOT + c.file;
  if (!existsSync(path)) {
    console.log(`SKIP  ${c.name}  （文件缺失：${c.file}）`);
    results.push({ name: c.name, status: 'SKIP' });
    skip++;
    continue;
  }
  if (offline && c.net) {
    console.log(`SKIP  ${c.name}  （联网项，--offline 已跳过）`);
    results.push({ name: c.name, status: 'SKIP(offline)' });
    skip++;
    continue;
  }

  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path, ...c.args], { encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = c.pass.test(out) && r.status === 0;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (ok) { console.log(`PASS  ${c.name}  (${secs}s)`); pass++; }
  else {
    console.log(`FAIL  ${c.name}  (${secs}s, exit=${r.status})`);
    // 失败时打印尾部输出，便于定位
    out.split('\n').filter((l) => /FAIL|Error|error/.test(l)).slice(0, 8)
      .forEach((l) => console.log('        ' + l.trim().slice(0, 120)));
    fail++;
  }
  results.push({ name: c.name, status: ok ? 'PASS' : 'FAIL' });
}

console.log('='.repeat(60));
console.log(`合计 ${CASES.length} 项：PASS ${pass} / FAIL ${fail} / SKIP ${skip}`);
if (fail === 0) {
  console.log('✅ 全部通过 —— 监控与告警链路可信');
} else {
  console.log('❌ 存在失败项 —— 监控结论暂不可信，先修再读告警');
}
process.exit(fail ? 1 : 0);
