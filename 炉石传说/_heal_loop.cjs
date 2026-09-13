// 自愈轨的守夜器：每 90s 问一次 _standup_watch.cjs --heal --dry；
// 一旦"最近一班"被判为逾期（需要补投），就真的跑一次 --heal；若它先被回执了就安静退出。
// 为什么不用固定 sleep：本会话已三次把"还没到"当成"没发生"。也不用 Windows 计划任务（准则 2）。
const cp = require('child_process');
const fs = require('fs');
const LOG = 'D:/MunderDifflin/hive/log.jsonl';
const MAX_MIN = Number(process.argv[2] || 60);
const t0 = Date.now();

function probe(flags) {
  try { return cp.execSync(`node _standup_watch.cjs 70 --heal ${flags}`, { cwd: __dirname, maxBuffer: 16e6 }).toString(); }
  catch (e) { return ((e.stdout || '') + (e.stderr || '')).toString(); }
}
function lastBeat() {
  const L = fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  const bs = L.filter((o) => o.from === 'scheduler' && /Hourly ops standup/i.test(o.subject || ''));
  return bs[bs.length - 1];
}

(async () => {
  const b0 = lastBeat();
  console.log(`守夜起点 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}，盯班 ${new Date(b0.ts).toLocaleTimeString('zh-CN', { hour12: false })}（现有 ${b0 ? 'id=' + b0.id.slice(-8) : '?'}）`);
  for (;;) {
    if (Date.now() - t0 > MAX_MIN * 60_000) { console.log(`超时 ${MAX_MIN}min，未触发补投（说明那班已自行回执，或窗口外）。`); process.exit(0); }
    const cur = lastBeat();
    if (cur.id !== b0.id) { console.log(`出现更新的一班 ${new Date(cur.ts).toLocaleTimeString('zh-CN', { hour12: false })}，本守夜只盯 ${new Date(b0.ts).toLocaleTimeString('zh-CN', { hour12: false })}，退出交接给下一轮。`); process.exit(0); }
    const dry = probe('--dry');
    const need = /将补投/.test(dry);
    const acked = new RegExp(`回执=\\d+s|回执=LATE`).test(dry.split('\n').filter((l) => l.includes(new Date(b0.ts).toTimeString().slice(0, 5))).join(''));
    if (acked && !need) {
      console.log(`✓ ${new Date(b0.ts).toLocaleTimeString('zh-CN', { hour12: false })} 班已回执，无需补投。 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
      console.log(dry.split('\n').filter((l) => /班 \d|判定:|--heal/.test(l)).join('\n'));
      process.exit(0);
    }
    if (need) {
      console.log(`[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] 判定逾期，执行真补投…`);
      const real = probe('');
      console.log(real.split('\n').filter((l) => /--heal|✓ 已补投|不动手|限流|跳过|判定:/.test(l)).join('\n'));
      process.exit(/✓ 已补投/.test(real) ? 0 : 3);
    }
    await new Promise((r) => setTimeout(r, 90_000));
  }
})();
