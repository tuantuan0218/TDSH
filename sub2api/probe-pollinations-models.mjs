// Pollinations 更多模型名探测（文档称聚合 56 模型，找可匿名扩展的）
const U = 'https://text.pollinations.ai/openai/chat/completions';
const models = [
  'openai', 'openai-fast', 'openai-large', 'openai-reasoning',
  'gpt-5.2', 'gpt-5.1', 'gpt-5-mini', 'gpt-5.1-mini',
  'claude', 'claude-sonnet-4.6', 'gemini', 'gemini-3-flash',
  'llama', 'llama-4', 'mistral-large', 'qwen3', 'deepseek'
];
async function chat(m) {
  const t0 = Date.now();
  try {
    const r = await fetch(U, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m, messages: [{ role: 'user', content: '1+1=?' }], max_tokens: 12 }),
      signal: AbortSignal.timeout(20000)
    });
    const t = await r.text();
    let c = ''; try { c = JSON.parse(t).choices?.[0]?.message?.content || ''; } catch {}
    if (r.status === 200) console.log(`OK  ${m}: "${String(c).slice(0, 30)}" (${Date.now() - t0}ms)`);
    else console.log(`ERR ${m}: HTTP ${r.status} ${t.slice(0, 70)}`);
  } catch (e) { console.log(`ERR ${m}: ${e.message.slice(0, 50)}`); }
}
(async () => { for (const m of models) await chat(m); })();