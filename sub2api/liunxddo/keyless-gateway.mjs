// 本地 keyless 公益 API 网关 — 聚合实测可用的免费公共 API 为本地单入口
// 零依赖（仅 node 内置 http/https），无任何账号/key。
// 启动: node keyless-gateway.mjs [port=8787]
// 用法:
//   GET /health                 → 各上游健康状态
//   GET /api/hitokoto           → 一言
//   GET /api/60s                → 60 秒读懂世界
//   GET /api/weather            → 天气（wttr.in JSON，参数 ?city=北京 可选）
//   GET /api/rate?base=USD      → 汇率（exchangerate-api，默认 USD）
//   GET /api/joke               → 英文笑话
//   GET /api/catfact            → 猫事实
//   GET /api/<name>?raw=1       → 原样透传上游 JSON
// 2026-09-13 实测：上述 6 源均 200；ipapi.co TLS 失败已剔除。
import http from 'node:http';
import https from 'node:https';

const PORT = Number(process.argv[2] || process.env.PORT || 8787);
const TIMEOUT = 12000;

// 上游源定义（name -> 请求配置；headers 可选，transform 可选）
const SOURCES = {
  hitokoto: {
    url: (p) => `https://v1.hitokoto.cn/?c=d${p.cat ? '&c=' + p.cat : ''}`,
    desc: '一言（中文句子）'
  },
  '60s': {
    url: () => 'https://60s.viki.moe/v2/60s',
    desc: '60 秒读懂世界（新闻/资讯）'
  },
  weather: {
    url: (p) => `https://wttr.in/${encodeURIComponent(p.city || '')}?format=j1`,
    desc: '天气（wttr.in，JSON）'
  },
  rate: {
    url: (p) => `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent((p.base || 'USD').toUpperCase())}`,
    desc: '汇率（exchangerate-api，免费匿名）'
  },
  joke: {
    url: () => 'https://official-joke-api.appspot.com/random_joke',
    desc: '英文随机笑话'
  },
  catfact: {
    url: () => 'https://catfact.ninja/fact',
    desc: '随机猫事实'
  },
  zip: {
    url: (p) => `https://api.zippopotam.us/${encodeURIComponent(p.country || 'us')}/${encodeURIComponent(p.code || '90210')}`,
    desc: '邮编地理查询（zippopotam.us）'
  },
  advice: {
    url: () => 'https://api.adviceslip.com/advice',
    desc: '随机人生建议（Advice Slip）'
  }
};

function upstream(name, path) {
  const src = SOURCES[name];
  if (!src) return null;
  const q = new URLSearchParams((path.split('?')[1] || ''));
  const p = {};
  for (const [k, v] of q) p[k] = v;
  return { src, url: src.url(p), raw: p.raw === '1' };
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'keyless-gateway/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT, () => { req.destroy(new Error('upstream timeout')); });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };

  try {
    // 健康检查：并发探所有源
    if (path === '/health') {
      const results = await Promise.all(Object.entries(SOURCES).map(async ([name, src]) => {
        try {
          const r = await fetchUrl(src.url({}));
          return { name, desc: src.desc, status: r.status, ok: r.status >= 200 && r.status < 400 };
        } catch (e) { return { name, desc: src.desc, status: 'ERR', ok: false, error: e.message }; }
      }));
      res.writeHead(200, cors);
      res.end(JSON.stringify({ ok: results.every((r) => r.ok), sources: results }, null, 2));
      return;
    }

    // /api/<name>
    const m = path.match(/^\/api\/([a-zA-Z0-9_-]+)\/?$/);
    if (m) {
      const hit = upstream(m[1], path);
      if (!hit) {
        res.writeHead(404, cors);
        res.end(JSON.stringify({ error: 'unknown source', available: Object.keys(SOURCES) }));
        return;
      }
      try {
        const r = await fetchUrl(hit.url);
        if (hit.raw) { res.writeHead(r.status, { 'Content-Type': r.headers['content-type'] || 'application/json' }); res.end(r.data); return; }
        res.writeHead(r.status, cors);
        res.end(r.data);
      } catch (e) {
        res.writeHead(502, cors);
        res.end(JSON.stringify({ error: 'upstream error', message: e.message }));
      }
      return;
    }

    res.writeHead(200, cors);
    res.end(JSON.stringify({
      name: 'keyless-public-api-gateway',
      version: '1.0.0',
      health: '/health',
      sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.desc])),
      note: '全部 keyless 匿名可用，2026-09-13 实测'
    }));
  } catch (e) {
    res.writeHead(500, cors);
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`keyless gateway listening on http://127.0.0.1:${PORT}`);
  console.log(`sources: ${Object.keys(SOURCES).join(', ')}`);
});
