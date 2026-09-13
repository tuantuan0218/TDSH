// 量化 pi 遥测"目录求和 vs 会话作用域"的虚高幅度 —— 为补丁 #2 的回放用例提供基线。
// 只读。用法：node _probe_pi_usage_scoping.cjs
const fs = require('fs'), path = require('path');
const ROOT = 'D:/MunderDifflin/hive/agents';
const piKey = (cwd) => '--' + cwd.replace(/[^a-zA-Z0-9]/g, '-') + '--';
const reg = JSON.parse(fs.readFileSync('D:/MunderDifflin/hive/registry.json', 'utf8'));

function sumFile(p) {
  const t = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  let input = 0, output = 0, cacheRead = 0, cacheWrite = 0, recs = 0, lastTs = 0;
  for (const l of t) {
    let o; try { o = JSON.parse(l); } catch (e) { continue; }
    const msg = o.message || o;
    const u = msg && msg.usage;
    if (!u || (o.type !== 'message' && o.type !== 'assistant') || msg.role !== 'assistant') continue;
    input += Number(u.input ?? u.input_tokens ?? 0) || 0;
    output += Number(u.output ?? u.output_tokens ?? 0) || 0;
    cacheRead += Number(u.cacheRead ?? u.cache_read_input_tokens ?? 0) || 0;
    cacheWrite += Number(u.cacheWrite ?? u.cache_creation_input_tokens ?? 0) || 0;
    recs++;
    const ts = Date.parse(o.timestamp || 0); if (ts > lastTs) lastTs = ts;
  }
  return { input, output, cacheRead, cacheWrite, recs, lastTs };
}

// 按 cwd 归组（同 cwd 的席位共用一个 pi 转录目录 = 虚高根源）
const byKey = new Map();
for (const [id, a] of Object.entries(reg.agents)) {
  if (a.archived) continue;
  const k = piKey(a.cwd);
  const dir = path.join(ROOT, id, '.pi-agent', 'sessions', k);
  if (!byKey.has(k)) byKey.set(k, { dir, dirExists: fs.existsSync(dir), members: [] });
  byKey.get(k).members.push({ id, dir });
}

console.log('piKey 规则: "--" + cwd.replace(/[^a-zA-Z0-9]/g,"-") + "--"');
for (const [k, v] of byKey) {
  console.log('\n键', k, '| 成员', v.members.map((x) => x.id).join(','));
  for (const mem of v.members) {
    if (!fs.existsSync(mem.dir)) { console.log('  ', mem.id, '目录不存在 →', mem.dir); continue; }
    const files = fs.readdirSync(mem.dir).filter((f) => f.endsWith('.jsonl'));
    const stats = files.map((f) => ({ f, s: sumFile(path.join(mem.dir, f)) })).sort((a, b) => b.s.lastTs - a.s.lastTs);
    const total = stats.reduce((acc, x) => ({ input: acc.input + x.s.input, output: acc.output + x.s.output, recs: acc.recs + x.s.recs }), { input: 0, output: 0, recs: 0 });
    const newest = stats[0];
    console.log(`   ${mem.id.padEnd(18)} 会话文件 ${files.length} 个 | 目录求和 in=${total.input.toLocaleString()} out=${total.output.toLocaleString()} (记录 ${total.recs})`);
    if (newest) console.log(`      仅最新一场 ${newest.f.slice(0, 30)}… in=${newest.s.input.toLocaleString()} out=${newest.s.output.toLocaleString()} 最后活动 ${newest.s.lastTs ? new Date(newest.s.lastTs).toLocaleTimeString('zh-CN', { hour12: false }) : '?'}`,
      `| 虚高倍数 = ${(total.input / Math.max(1, newest.s.input)).toFixed(1)}×`);
  }
}
console.log('\n结论口径：补丁 #2 必须按"文件内 uuid（文件名）"作用域读，否则一个零调用席位会替全目录的历史买单（D11 事故同类）。');
