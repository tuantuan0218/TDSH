// Pollinations 入池前最后确认：/v1/responses 支持性 + 常见模型名 + 匿名限流体感
const BASE = 'https://text.pollinations.ai/openai';
async function responses(model) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + '/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: '回复一个字：好' }),
      signal: AbortSignal.timeout(60000)
    });
    const t = await r.text();
    let out = ''; try { const j = JSON.parse(t); out = (j.output?.[0]?.content?.[0]?.text || j.choices?.[0]?.message?.content || '').slice(0, 30); } catch {}
    console.log(`responses(${model}): HTTP ${r.status} ${Date.now() - t0}ms "${out}"${r.status >= 400 ? ' | ' + t.slice(0, 120) : ''}`);
    return r.status;
  } catch (e) { console.log(`responses(${model}): ERR ${e.message.slice(0, 70)}`); return -1; }
}
async function chatModel(model) {
  const t0 = Date.now();
  try {
    const r = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '1+1=?' }], max_tokens: 10 }),
      signal: AbortSignal.timeout(30000)
    });
    const t = await r.text();
    let c = ''; try { c = JSON.parse(t).choices?.[0]?.message?.content || ''; } catch {}
    console.log(`chat(${model}): HTTP ${r.status} ${Date.now() - t0}ms "${String(c).slice(0, 30)}"${r.status >= 400 ? ' | ' + t.slice(0, 90) : ''}`);
  } catch (e) { console.log(`chat(${model}): ERR ${e.message.slice(0, 60)}`); }
}
(async () => {
  console.log('=== /v1/responses 支持性 ===');
  await responses('openai-fast');
  console.log('\n=== chat 常见模型名（找可映射的免费模型）===');
  for (const m of ['openai-fast', 'openai', 'mistral', 'llama', 'qwen', 'deepseek', 'gpt-4o-mini']) await chatModel(m);
})();