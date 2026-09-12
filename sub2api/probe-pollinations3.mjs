// Pollinations openai 模型稳定连测（5 连，匿名）
const BASE = 'https://text.pollinations.ai/openai/chat/completions';
(async () => {
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: 'ping' }], max_tokens: 10 }),
        signal: AbortSignal.timeout(30000)
      });
      const t = await r.text();
      let c = ''; try { c = JSON.parse(t).choices?.[0]?.message?.content || ''; } catch {}
      console.log(`#${i}: HTTP ${r.status} ${Date.now() - t0}ms "${String(c).slice(0, 30)}"${r.status >= 400 ? ' | ' + t.slice(0, 100) : ''}`);
    } catch (e) { console.log(`#${i}: ERR ${e.message.slice(0, 60)}`); }
    await new Promise(r => setTimeout(r, 800));
  }
})();