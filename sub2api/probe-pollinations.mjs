// Pollinations 免费无 key 端点直测（chat 同构 + /models）
const bases = ['https://text.pollinations.ai/openai', 'https://text.pollinations.ai', 'https://api.pollinations.ai/openai'];
async function tryModels(base) {
  try {
    const r = await fetch(base + '/models', { signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    let ids = [];
    try { ids = (JSON.parse(t).data || []).map(m => m.id); } catch {}
    console.log(`${base}/models: HTTP ${r.status} [${ids.length}] ${ids.slice(0, 20).join(', ')}`);
    return ids;
  } catch (e) { console.log(`${base}/models: ERR ${e.message.slice(0, 70)}`); return []; }
}
async function tryChat(endpoint, model) {
  const t0 = Date.now();
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(45000)
    });
    const t = await r.text();
    let c = ''; try { c = JSON.parse(t).choices?.[0]?.message?.content || ''; } catch {}
    console.log(`chat(${model})@${endpoint}: HTTP ${r.status} ${Date.now() - t0}ms "${String(c).slice(0, 40)}"${r.status >= 400 ? ' | ' + t.slice(0, 100) : ''}`);
  } catch (e) { console.log(`chat@${endpoint}: ERR ${e.message.slice(0, 70)}`); }
}
(async () => {
  let ids = [];
  for (const b of bases) { ids = await tryModels(b); if (ids.length) break; }
  const model = ids[0] || 'openai';
  await tryChat(bases[0] + '/v1/chat/completions', model);
  await tryChat(bases[0] + '/chat/completions', model);
})();