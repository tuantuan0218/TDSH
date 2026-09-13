// 等某一班站会拿到回执（补投之后的闭环确认）。用法：node _wait_ack.cjs 14:26 [maxWaitMin=45]
const fs = require('fs');
const hhmm = process.argv[2] || '14:26';
const MAX = (Number(process.argv[3]) || 45) * 60_000;
const LOG = 'D:/MunderDifflin/hive/log.jsonl';
const RE = /站会|standup/i;
const t0 = Date.now();
const beatAt = (() => {
  const L = JSONL();
  const b = L.filter((o) => o.from === 'scheduler' && /Hourly ops standup/i.test(o.subject || ''))
    .filter((o) => new Date(o.ts).toTimeString().slice(0, 5) === hhmm).pop();
  return b;
})();
function JSONL() {
  return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
(async () => {
  if (!beatAt) { console.log(`没找到 ${hhmm} 那班（今天）`); process.exit(4); }
  console.log(`盯班 ${hhmm} (${new Date(beatAt.ts).toLocaleString('zh-CN', { hour12: false })}) 等 god 回执…  现在 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  for (;;) {
    const L = JSONL();
    const ack = L.find((o) => o.kind === 'message' && o.from === 'god' && o.ts > beatAt.ts && RE.test(o.subject || '') && String(o.subject).includes(hhmm));
    if (ack) {
      console.log(`✓ 回执 +${Math.round((ack.ts - beatAt.ts) / 1000)}s → ${ack.to} 「${ack.subject}」`);
      console.log(`  正文摘要：${String(ack.body).slice(0, 260).replace(/\n/g, ' ')}`);
      const heal = (() => { try { return JSON.parse(fs.readFileSync('D:/tdsh/炉石传说/_heal_log.json', 'utf8'))[beatAt.id]; } catch (e) { return null; } })();
      console.log(`  补投记录：${heal ? '有（' + new Date(heal).toLocaleTimeString('zh-CN', { hour12: false }) + '，自愈轨触发）' : '无（这一班本就自己回了）'}`);
      process.exit(0);
    }
    if (Date.now() - t0 > MAX) { console.log(`超时 ${MAX / 60000}min 仍无 ${hhmm} 班回执 → 自愈轨补投也未换来回执，需上报`); process.exit(3); }
    await new Promise((r) => setTimeout(r, 30_000));
  }
})();
