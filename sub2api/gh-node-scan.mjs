// 扫描订阅各节点：经 7898 出口测 ipinfo + github signup 状态码
// 用法: node gh-node-scan.mjs [limit]
const API = 'http://127.0.0.1:9098';
const H = { Authorization: 'Bearer ghscan' };
const GROUP = '三毛机场';
const PX = 'http://127.0.0.1:7898';
const limit = parseInt(process.argv[2] || '999', 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const st = await (await fetch(`${API}/proxies/${encodeURIComponent(GROUP)}`, { headers: H })).json();
const candidates = (st.all || []).filter(n => n !== '♻️ 自动选择');
console.log(`group=${GROUP} total=${st.all?.length} candidates=${candidates.length}`);

const results = [];
for (const node of candidates.slice(0, limit)) {
  try {
    await fetch(`${API}/proxies/${encodeURIComponent(GROUP)}`, { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ name: node }) });
    await sleep(700);
    // egress geo
    let geo = '', code = '', title = '';
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
      const r = await fetch('https://ipinfo.io/json', { proxy: PX, signal: ac.signal });
      const j = await r.json(); clearTimeout(t);
      geo = `${j.ip} ${j.country}/${j.city} org=${(j.org || '').split(' ').slice(0, 2).join(' ')}`;
    } catch (e) { geo = 'GEO_FAIL:' + e.message.slice(0, 40); }
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
      const r = await fetch('https://github.com/signup', { proxy: PX, signal: ac.signal, headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0' } });
      code = String(r.status);
      const html = await r.text();
      const m = html.match(/<title>([^<]*)<\/title>/i); title = m ? m[1].slice(0, 40) : '';
      clearTimeout(t);
    } catch (e) { code = 'ERR:' + e.message.slice(0, 40); }
    const line = `${code.padEnd(14)} | ${geo.padEnd(52)} | ${title} | ${node}`;
    console.log(line);
    results.push({ node, code, geo, title });
  } catch (e) {
    console.log(`NODE_FAIL ${node}: ${e.message}`);
  }
}
const good = results.filter(r => r.code === '200');
console.log('\n===== SUMMARY =====');
console.log('signup 200 nodes:', good.length);
for (const g of good) console.log('  ✅', g.node, '=>', g.geo);
import('node:fs').then(fs => fs.writeFileSync('D:/tdsh/sub2api/ghproxy/scan.json', JSON.stringify(results, null, 1)));
