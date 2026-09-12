// GitHub Models REST /inference/{model} 实测（鉴权：现有 PAT 是否含 models:read）
const GH = process.env.GH_READ_TOKEN || '';
async function tryREST(model) {
  const t0 = Date.now();
  try {
    const r = await fetch(`https://models.github.ai/inference/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH}`, 'Accept': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(25000)
    });
    const t = await r.text();
    let out = ''; try { out = (JSON.parse(t).choices?.[0]?.message?.content || '').slice(0, 40); } catch {}
    console.log(`/inference/${model}: HTTP ${r.status} ${Date.now() - t0}ms "${out}"${r.status >= 400 ? ' | ' + t.slice(0, 150) : ''}`);
  } catch (e) { console.log(`/inference/${model}: ERR ${e.message.slice(0, 60)}`); }
}
(async () => {
  await tryREST('gpt-4.1-mini');
  await tryREST('meta-llama-3.1-8b-instruct');
  // 也试 openai 兼容新路径
  try {
    const r = await fetch('https://models.github.ai/api/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH}` },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(25000)
    });
    const t = await r.text();
    console.log(`/api/v1/chat/completions: HTTP ${r.status} | ${t.slice(0, 120)}`);
  } catch (e) { console.log(`/api/v1/chat/completions: ERR ${e.message.slice(0, 60)}`); }
})();