// 通用 hive 投递器（external-planner 席位，Node 写 → UTF-8 无 BOM，中文安全）
// 用法：node _hive_send_generic.cjs <to> <act> "<subject>" "<body，多行写 \n>"
//   或：node _hive_send_generic.cjs <to> <act> "<subject>" --file <bodyFile>
const fs = require('fs'), path = require('path');
const ME = 'D:/MunderDifflin/hive/agents/external-planner';
const [to, act, subject, ...rest] = process.argv.slice(2);
if (!to || !act || !subject) { console.error('args: <to> <act> <subject> (<body> | --file <path>)'); process.exit(1); }
const body = rest[0] === '--file' ? fs.readFileSync(rest[1], 'utf8') : rest.join(' ').replace(/\\n/g, '\n');
const msg = { to, act, subject, body };
const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(16).slice(2, 8);
fs.mkdirSync(path.join(ME, 'outbox', '.sent'), { recursive: true });
fs.writeFileSync(path.join(ME, 'outbox', id + '.json'), JSON.stringify(msg, null, 2), 'utf8');
console.log('written:', id, '->', to);
setTimeout(() => {
  const stillIn = fs.readdirSync(path.join(ME, 'outbox')).filter(f => f.endsWith('.json'));
  const sentNow = fs.readdirSync(path.join(ME, 'outbox/.sent'));
  const bad = sentNow.filter(f => f.startsWith('bad-'));
  let target = [];
  try { target = fs.readdirSync(`D:/MunderDifflin/hive/agents/${to}/inbox`).filter(f => f.endsWith('.json')); } catch (e) {}
  console.log('routed:', sentNow.includes(id + '.json'), '| my outbox still pending:', stillIn.length,
    '| bad-* total:', bad.length, `| ${to} inbox now:`, target.length);
  for (const f of target.slice(-3)) {
    const o = JSON.parse(fs.readFileSync(`D:/MunderDifflin/hive/agents/${to}/inbox/${f}`, 'utf8'));
    console.log('    ', f.slice(0, 26), 'from=' + o.from, 'act=' + o.act, 'req_reply=' + o.requires_reply, '|', String(o.subject).slice(0, 46));
  }
}, 3000);
