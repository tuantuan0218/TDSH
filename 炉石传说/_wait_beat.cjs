// 等到下一班 ops-standup 真的发出并出回执（或超时），期间不刷屏：只在状态变化时打印。
// 用法：node _wait_beat.cjs [maxWaitMin=30]
// 比"睡固定秒数再查"可靠：不依赖我对挂钟的估计（本会话已三次把"还没到"当成"没发生"）。
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = 'D:/MunderDifflin/hive/log.jsonl';
const SEATS = ['scheduler', 'heartbeat', 'external-planner'];
const MAX = (Number(process.argv[2]) || 30) * 60_000;
const t0 = Date.now();

function lines() {
  return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
const beats = (L) => L.filter((o) => o.kind === 'message' && o.from === 'scheduler' && /Hourly ops standup/i.test(o.subject || ''));
const ledger = () => SEATS.map((id) => {
  const d = `D:/MunderDifflin/hive/agents/${id}/inbox`;
  const p = fs.existsSync(d) ? fs.readdirSync(d).filter((x) => x.endsWith('.json')).length : -1;
  const a = fs.existsSync(d + '/.done') ? fs.readdirSync(d + '/.done').length : 0;
  return `${id}=${p}/${a}`;
}).join('  ');

// 基线只算"60 秒之前"的班次：否则若正好在班次落地的瞬间启动，会把本班当成基线而再等一小时。
let startBeatCount = beats(lines()).filter((o) => o.ts <= t0 - 60_000).length;
const startDrops = lines().filter((o) => o.kind === 'drop' && o.reason === 'no-inbox' && (o.to === 'scheduler' || o.to === 'heartbeat')).length;
console.log(`基线: 累计已发 ${startBeatCount} 班 | 全量历史 drop(系统席) ${startDrops} 条【注意：这是自建仓以来的累计数，不是 24h 数】 | 台账 ${ledger()} | 现在 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
async function main() {
let reportedBeat = false;
while (Date.now() - t0 < MAX) {
  const L = lines();
  const bs = beats(L);
  const last = bs[bs.length - 1];
  if (bs.length > startBeatCount) {
    if (!reportedBeat) {
      console.log(`\n[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] 新班已发出 ${new Date(last.ts).toLocaleTimeString('zh-CN', { hour12: false })} delivered=${JSON.stringify(last.delivered)} id=${last.id.slice(-8)}`);
      reportedBeat = true;
    }
    const after = L.filter((o) => o.from === 'god' && o.ts > last.ts && /站会|standup/i.test(o.subject || ''));
    if (after.length) {
      const a = after[0];
      console.log(`✓ 回执 +${Math.round((a.ts - last.ts) / 1000)}s → ${a.to} 「${a.subject}」`);
      const dropsNow = L.filter((o) => o.kind === 'drop' && o.reason === 'no-inbox' && (o.to === 'scheduler' || o.to === 'heartbeat')).length;
      console.log(`drop 计数: ${startDrops} → ${dropsNow}（新增 ${dropsNow - startDrops}）`);
      console.log(`台账: ${ledger()}`);
      const inLedger = fs.existsSync('D:/MunderDifflin/hive/agents/scheduler/inbox')
        ? fs.readdirSync('D:/MunderDifflin/hive/agents/scheduler/inbox').filter((x) => x.endsWith('.json')).length : -1;
      console.log(inLedger > 0 ? '★ 端到端确认：god 的回执真的进了 scheduler 台账（黑洞已闭）'
        : `（本班回执去向不是 scheduler → 黑洞路径仍未被真实流量走通；scheduler inbox=${inLedger}）`);
      process.exit(0);
    }
  }
  await sleep(20_000);
}
console.log(`\n超时 ${MAX / 60000} 分钟：${reportedBeat ? '班已发但窗口内无回执（=唤醒/回执环仍缺，需补投）' : '未看到新班（=发出环坏了，这才是真"不触发"）'}`);
process.exit(reportedBeat ? 3 : 4);
}
main();
