// 取证：pi 的 sessions 目录键名规则 + PI_CODING_AGENT_DIR 怎么设的（只读）
const fs = require('fs'), path = require('path');
const ids = ['god', 'kevin-mtvy14qr', 'ryan-mtvy0jjp', 'stanley-mtvy1opy', 'creed-mtvy2us1', 'pam-mtvy2g52', 'dwight-mtvy21wj'];
const reg = JSON.parse(fs.readFileSync('D:/MunderDifflin/hive/registry.json', 'utf8'));
const projectKey = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-');
for (const id of ids) {
  const d = 'D:/MunderDifflin/hive/agents/' + id + '/.pi-agent/sessions';
  let keys = [];
  try { keys = fs.readdirSync(d).filter((x) => { try { return fs.statSync(path.join(d, x)).isDirectory(); } catch (e) { return false; } }); } catch (e) { keys = ['(无目录)']; }
  const cwd = (reg.agents[id] || {}).cwd;
  console.log(id.padEnd(18), 'cwd=' + JSON.stringify(cwd), 'claudeKey=' + (cwd ? projectKey(cwd) : '?'), '=> piDirs=' + keys.join(','));
}
const h = fs.readFileSync('D:/MunderDifflin/src/main/hive.ts', 'utf8');
const i = h.indexOf('PI_CODING_AGENT_DIR');
console.log('\n--- PI_CODING_AGENT_DIR 上下文 ---\n' + h.slice(Math.max(0, i - 800), i + 400));
const j = h.indexOf('lastSession(agentId');
console.log('\n--- lastSession 实现 ---\n' + h.slice(j, j + 900));
