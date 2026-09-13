#!/usr/bin/env node
import { readFileSync } from 'fs';
const lines = readFileSync('D:\\\\tdsh\\\\sub2api\\\\health-log.jsonl', 'utf8').trim().split('\\n');
const entries = lines.map(l => JSON.parse(l));
const hourlyStats = {};
for (const e of entries) {
  const date = new Date(e.ts);
  const bjh = new Date(date.getTime() + 8 * 3600 * 1000);
  const hour = bjh.getUTCHours();
  if (!hourlyStats[hour]) hourlyStats[hour] = { ok: 0, fail: 0, latencies: [] };
  if (e.gateway.ok) { hourlyStats[hour].ok++; hourlyStats[hour].latencies.push(e.gateway.r1.ms, e.gateway.r2.ms); }
  else { hourlyStats[hour].fail++; }
}
console.log('=== 深度健康日志分析 (' + entries.length + ' 轮) ===');
console.log('\\n按小时可用率（北京时间）:');
for (const h of Object.keys(hourlyStats).sort((a, b) => +a - +b)) {
  const s = hourlyStats[h]; const total = s.ok + s.fail;
  const rate = total > 0 ? ((s.ok / total) * 100).toFixed(0) : 'N/A';
  const avgLat = s.latencies.length > 0 ? (s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length / 1000).toFixed(1) + 's' : 'N/A';
  console.log(h.padStart(2,'0') + ':00 | ok:' + s.ok + ' fail:' + s.fail + ' rate:' + rate + '% avgLat:' + avgLat);
}
const errorCodes = {};
for (const e of entries) { for (const req of ['r1','r2']) { const r = e.gateway[req]; if (!r.ok) { errorCodes[r.status] = (errorCodes[r.status]||0)+1; } } }
console.log('\\n错误码分布:'); for (const [code,count] of Object.entries(errorCodes).sort((a,b)=>b[1]-a[1])) console.log('  ' + code + ': ' + count);
const modelDist = {};
for (const e of entries) { for (const req of ['r1','r2']) { const m = e.gateway[req].model; if (m && m !== '?') modelDist[m] = (modelDist[m]||0)+1; } }
console.log('\\n上游模型命中:'); for (const [m,c] of Object.entries(modelDist).sort((a,b)=>b[1]-a[1])) console.log('  ' + m + ': ' + c);
let streak=0, streakStart=null;
console.log('\\n连续故障(>=3):');
for (let i=0;i<entries.length;i++) { if (!entries[i].gateway.ok) { if (streak===0) streakStart=entries[i].ts; streak++; } else { if (streak>=3) console.log('  ' + streakStart + ' ~ ' + entries[i-1].ts + ' (' + streak + '连FAIL)'); streak=0; } }
if (streak>=3) console.log('  ' + streakStart + ' ~ 至今 (' + streak + '连FAIL)');
const allLat = []; for (const e of entries) { if (e.gateway.ok) { allLat.push(e.gateway.r1.ms, e.gateway.r2.ms); } }
allLat.sort((a,b)=>a-b);
if (allLat.length) { console.log('\\n延迟: P50=' + allLat[Math.floor(allLat.length*0.5)] + 'ms P90=' + allLat[Math.floor(allLat.length*0.9)] + 'ms P99=' + allLat[Math.floor(allLat.length*0.99)] + 'ms'); }
