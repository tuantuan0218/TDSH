// 取证：13:26 那班为什么没回执（god 在忙、在睡、还是信压根没被读？）
const fs = require('fs'), path = require('path');
const L = fs.readFileSync('D:/MunderDifflin/hive/log.jsonl', 'utf8').split('\n').filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
const now = Date.now();
const godOut = L.filter((o) => o.from === 'god' && o.kind === 'message');
console.log('god 最后一次外发 :', new Date(godOut[godOut.length - 1].ts).toLocaleString('zh-CN', { hour12: false }), '（', Math.round((now - godOut[godOut.length - 1].ts) / 60000), '分钟前）', String(godOut[godOut.length - 1].subject).slice(0, 40));
const d = 'D:/MunderDifflin/hive/agents/god/inbox';
const pend = fs.readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => { const o = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); return { f, from: o.from, act: o.act, subj: o.subject, at: Date.parse(o.created_at) }; }).sort((a, b) => a.at - b.at);
console.log('god 收件箱当前未读:', pend.length);
for (const p of pend) console.log('   ', new Date(p.at).toLocaleTimeString('zh-CN', { hour12: false }), p.from.padEnd(16), p.act.padEnd(7), String(p.subj).slice(0, 40));
// 会话转录尾部：他是在长回合里，还是早就停了？
const sd = 'D:/MunderDifflin/hive/agents/god/.pi-agent/sessions/--D--MunderDifflin--';
const files = fs.readdirSync(sd).map((f) => ({ f, st: fs.statSync(path.join(sd, f)) })).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
const p = path.join(sd, files[0].f);
const t = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
const last = t[t.length - 1];
console.log('\ngod 最新会话文件 :', files[0].f.slice(0, 42));
console.log('  文件 mtime     :', files[0].st.mtime.toLocaleString('zh-CN', { hour12: false }), '（', Math.round((now - files[0].st.mtimeMs) / 60000), '分钟前）');
console.log('  末条记录时间   :', last && last.timestamp, '| 类型:', last && ((last.message && last.message.role) || last.type));
console.log('  记录数         :', t.length);
const fleet = JSON.parse(fs.readFileSync('D:/MunderDifflin/hive/fleet.json', 'utf8'));
const g = fleet.agents.find((a) => a.id === 'god');
console.log('  fleet.god      :', JSON.stringify({ backlog: g.inboxBacklog, onHold: g.onHold, breaker: g.breaker }));
