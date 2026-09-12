// GitHub Models 免费推理探测（用现有 GH PAT，运行时传值不落盘）
const GH = process.env.GH_READ_TOKEN || process.env.GITHUB_TOKEN || '';
if (!GH) { console.log('NO_GH_TOKEN'); process.exit(0); }
const cands = [
  { u: 'https://models.github.ai/api/chat/completions', model: 'gpt-4.1-mini' },
  { u: 'https://models.githubusercontent.com/api/chat/completions', model: 'gpt-4.1-mini' },
  { u: 'https://api.githubcopilot.com/chat/completions', model: 'gpt-4.1-mini' },
];
async function call(c) {
  const t0 = Date.now();
  try {
    const r = await fetch(c.u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GH}` },
      body: JSON.stringify({ model: c.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(25000)
    });
    const t = await r.text();
    let out = ''; try { out = (JSON.parse(t).choices?.[0]?.message?.content || '').slice(0, 40); } catch {}
    console.log(`${c.u} (${c.model}): HTTP ${r.status} ${Date.now() - t0}ms "${out}"${r.status >= 400 ? ' | ' + t.slice(0, 120) : ''}`);
  } catch (e) { console.log(`${c.u}: ERR ${e.message.slice(0, 60)}`); }
}
(async () => { for (const c of cands) await call(c); })();