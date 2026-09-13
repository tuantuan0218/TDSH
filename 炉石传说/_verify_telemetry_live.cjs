// 补丁 #2 上线后的验收门（也可在上线前跑，用来证明"当前确实还没修"）。
// 用法：node _verify_telemetry_live.cjs            ← 自动判定 pre/post 两种预期
// 退出码：0=全部断言通过（含"未上线时应当 FAIL"的预期） / 1=有断言与预期不符
const fs = require('fs'), path = require('path');
const HIVED = 'D:/MunderDifflin/hive/agents';
const FLEET = 'D:/MunderDifflin/hive/fleet.json';
const LEDGER = 'D:/MunderDifflin/hive/cost-ledger.jsonl';
const LOG = 'D:/MunderDifflin/hive/log.jsonl';
const ROSTER = 'D:/MunderDifflin/roster.json';

let pass = 0, fail = 0;
const chk = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '   ' + detail : '')); ok ? pass++ : fail++; };

const piKey = (cwd) => '--' + cwd.replace(/[^a-zA-Z0-9]/g, '-') + '--';
/** 独立复算（与 fleet 不同源）：某席最新一场会话的 in+out tokens。 */
function newestSessionTokens(id, cwd) {
  const dir = path.join(HIVED, id, '.pi-agent', 'sessions', piKey(cwd));
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter((x) => x.endsWith('.jsonl'))
    .map((x) => ({ x, m: fs.statSync(path.join(dir, x)).mtimeMs })).sort((a, b) => b.m - a.m)[0];
  if (!f) return null;
  let t = 0;
  for (const l of fs.readFileSync(path.join(dir, f.x), 'utf8').split('\n')) {
    let o; try { o = JSON.parse(l); } catch (e) { continue; }
    const m = o.message;
    if (m && m.usage && (o.type === 'assistant' || (o.type === 'message' && m.role === 'assistant'))) {
      t += (Number(m.usage.input ?? m.usage.input_tokens ?? 0) || 0) + (Number(m.usage.output ?? m.usage.output_tokens ?? 0) || 0);
    }
  }
  return { tokens: t, file: f.x };
}

const fleet = JSON.parse(fs.readFileSync(FLEET, 'utf8'));
const reg = JSON.parse(fs.readFileSync('D:/MunderDifflin/hive/registry.json', 'utf8'));
const live = Object.entries(reg.agents).filter(([, a]) => !a.archived).map(([id]) => id);
const withTokens = fleet.agents.filter((a) => a.tokens > 0);
const patched = withTokens.length > 0;

console.log(`fleet 快照时刻 ${new Date(fleet.ts).toLocaleString('zh-CN', { hour12: false })} | 在册 ${live.length} 席 | tokens>0 的席位 ${withTokens.length}`);
console.log(patched ? '=> 判定：补丁 #2 看起来已上线，按"上线后"预期验收' : '=> 判定：补丁 #2 尚未上线，按"上线前"预期验收（此时 fleet 应全 0）');

if (!patched) {
  console.log('\n【上线前】应有事实（这些 FAIL 才是"问题仍然存在"的证据）：');
  chk('fleet 全席 tokens=0（仪表空转仍在）', withTokens.length === 0);
  chk('fleet 全席 lastActiveSecAgo=null', fleet.agents.every((a) => a.lastActiveSecAgo === null));
  chk('cost-ledger.jsonl 仍不存在（补丁刻意不动它，故这项在上线后也应为"不存在或按需另案"）', !fs.existsSync(LEDGER));
  // 反证：盘上明明有数据
  const g = newestSessionTokens('god', reg.agents.god.cwd);
  chk(`盘上确有真实用量可读（god 最新一场 in+out=${g ? g.tokens.toLocaleString() : 'n/a'}）→ 全 0 是读取路径坏了，不是没干活`, !!g && g.tokens > 0);
} else {
  console.log('\n【上线后】验收断言：');
  for (const a of fleet.agents) {
    if (a.tokens <= 0) continue;
    const indep = newestSessionTokens(a.id, (reg.agents[a.id] || {}).cwd);
    if (!indep) { console.log(`   (跳过 ${a.id}：无 pi 转录)`); continue; }
    const ratio = a.tokens / Math.max(1, indep.tokens);
    // G5 反虚高：fleet 的数应当与"单场独立复算"同量级（0.5–2.5x 内，转录在长、且 fleet 含多场累计时允许偏大）
    chk(`G5 ${a.id}: fleet.tokens / 单场复算 ∈ [0.5, 2.5]  (${a.tokens.toLocaleString()} / ${indep.tokens.toLocaleString()} = ${ratio.toFixed(2)}x)`,
      ratio >= 0.5 && ratio <= 2.5);
  }
  chk('G1 至少一个活跃席位 lastActiveSecAgo 是数字', fleet.agents.some((a) => typeof a.lastActiveSecAgo === 'number'));
  // G2/G3 的诚实预期
  const lastToolOk = fleet.agents.some((a) => a.lastTool);
  console.log(`   G2 注记：lastTool ${lastToolOk ? '已有值' : '仍为 null（预期如此——spans 只来自 OTLP，pi 不产 OTel span；要修它得让 hook 的 PostToolUse 进 spans，属另一批）'}`);
  console.log(`   G3 注记：cost-ledger ${fs.existsSync(LEDGER) ? '已存在' : '仍不存在（刻意不碰 #56 去重闸门）'}`);
  // G4 两口径不再矛盾
  try {
    const roster = JSON.parse(fs.readFileSync(ROSTER, 'utf8'));
    const rows = Array.isArray(roster) ? roster : Object.values(roster.agents || {});
    const working = rows.filter((r) => r && (r.status === 'working' || r.status === 'idle')).length;
    const zeroButWorking = fleet.agents.filter((a) => a.tokens === 0).length;
    chk(`G4 roster(${working} 席有状态) 与 fleet(0 token 席 ${zeroButWorking}) 不再互相打脸`, zeroButWorking === 0 || working === 0);
  } catch (e) { console.log('   G4 跳过：roster 读取失败 ' + e.message); }
}

console.log(`\n=== 验收门: PASS=${pass} FAIL=${fail} ===`);
console.log('口径提醒：本门只判"读取路径"，不判策略；上线后请连续两次观察（间隔 >1 个心跳拍）再定成败，单拍 0 可能是刚重启还没采到。');
process.exit(fail ? 1 : 0);
