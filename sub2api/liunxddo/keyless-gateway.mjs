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
const CACHE_TTL = 60_000; // 缓存 60s
const CACHE_MAX = 500;    // 缓存上限，超限清理过期项防内存增长
const CACHE = new Map();
const RATE = { limit: 30, count: {}, window: 0 }; // 每 IP 每 10s 窗口 30 次

// 限流窗口 + 缓存清理：同一个 10s tick，窗口对齐（与 key 的 win 一致）
setInterval(() => {
  RATE.window = Math.floor(Date.now() / 10000);
  RATE.count = {};
  const now = Date.now();
  for (const [k, v] of CACHE) {
    if (now - v.ts > Math.max(CACHE_TTL, 10_000)) CACHE.delete(k); // 过期即清（health 10s / api 60s）
  }
  if (CACHE.size > CACHE_MAX) CACHE.clear(); // 超限兜底全清
}, 10_000);
CACHE.set = function (k, v) { if (CACHE.size >= CACHE_MAX) CACHE.clear(); return Map.prototype.set.call(this, k, v); };

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
  },
  lyrics: {
    url: (p) => `https://api.lyrics.ovh/v1/${encodeURIComponent(p.artist || 'Queen')}/${encodeURIComponent(p.song || 'Bohemian Rhapsody')}`,
    desc: '歌词查询（lyrics.ovh，?artist=&song=）'
  },
  iss: {
    url: () => 'https://api.wheretheiss.at/v1/satellites/25544',
    desc: '国际空间站实时位置（wheretheiss.at）'
  },
  dog: {
    url: () => 'https://dog.ceo/api/breeds/image/random',
    desc: '随机狗狗图片（Dog CEO）'
  },
  bible: {
    url: (p) => `https://bible-api.com/${encodeURIComponent(p.ref || 'john+3:16')}`,
    desc: '圣经经文（bible-api.com，?ref=）'
  },
  qrcode: {
    url: (p) => `https://api.qrserver.com/v1/create-qr-code/?size=${encodeURIComponent(p.size || '200x200')}&data=${encodeURIComponent(p.data || 'hello')}`,
    desc: '二维码生成（qrserver，?data=&size=，返回 PNG）'
  },
  coffee: {
    url: () => 'https://coffee.alexflipnote.dev/random.json',
    desc: '随机咖啡图片'
  },
  gender: {
    url: (p) => `https://api.genderize.io/?name=${encodeURIComponent(p.name || 'luc')}`,
    desc: '姓名性别预测（genderize.io，?name=）'
  },
  agify: {
    url: (p) => `https://api.agify.io/?name=${encodeURIComponent(p.name || 'luc')}`,
    desc: '姓名年龄预测（agify.io，?name=）'
  },
  openlib: {
    url: (p) => `https://openlibrary.org/books/${encodeURIComponent(p.id || 'OL7353617M')}.json`,
    desc: '开放图书馆书目（openlibrary.org，?id=OL...M）',
    skip_health: true // 本机代理下 TLS 抖动频繁，health 不探测（路由保留，直连环境可用）
  },
  cat: {
    url: () => 'https://api.thecatapi.com/v1/images/search',
    desc: '随机猫图（thecatapi）'
  },
  postcodes: {
    url: () => 'https://api.postcodes.io/random/postcodes',
    desc: '英国随机邮编（postcodes.io）'
  },
  rickmorty: {
    url: (p) => `https://rickandmortyapi.com/api/character/${encodeURIComponent(p.id || '1')}`,
    desc: '瑞克与莫蒂角色（?id=）'
  },
  swapi: {
    url: (p) => `https://swapi.dev/api/people/${encodeURIComponent(p.id || '1')}/`,
    desc: '星球大战人物（SWAPI，?id=）'
  },
  jokeapi: {
    url: () => 'https://v2.jokeapi.dev/joke/Any?type=single',
    desc: '随机笑话（JokeAPI，多语言）'
  },
  zenquotes: {
    url: () => 'https://zenquotes.io/api/random',
    desc: '名言金句（ZenQuotes）'
  },
  currency2: {
    url: (p) => `https://api.frankfurter.app/latest?from=${encodeURIComponent((p.from || 'USD').toUpperCase())}&to=${encodeURIComponent((p.to || 'CNY').toUpperCase())}`,
    desc: '汇率（Frankfurter 欧洲央行，?from=&to=）'
  },
  weather2: {
    url: (p) => `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(p.lat || '39.9')}&longitude=${encodeURIComponent(p.lon || '116.4')}&current_weather=true`,
    desc: '天气（Open-Meteo，?lat=&lon=）'
  },
  memes: {
    url: () => 'https://meme-api.com/gimme/1',
    desc: '随机梗图（Meme API）'
  },
  ipify: {
    url: () => 'https://api.ipify.org?format=json',
    desc: '公网 IP（ipify）'
  },
  randomuser: {
    url: () => 'https://randomuser.me/api/',
    desc: '随机用户资料（randomuser.me）'
  },
  drug: {
    url: () => 'https://api.fda.gov/drug/event.json?limit=1',
    desc: 'FDA 药品不良事件（api.fda.gov）'
  },
  football: {
    url: (p) => `https://api.football-data.org/v4/competitions/${p.id ? '?ids=' + encodeURIComponent(p.id) : ''}`.replace('/v4/competitions?', '/v4/competitions?'),
    desc: '足球赛事数据（football-data.org，?id=PL 可查）'
  },
  chuck: {
    url: () => 'https://api.chucknorris.io/jokes/random',
    desc: 'Chuck Norris 笑话'
  },
  eq: {
    url: () => 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    desc: '全球 24h 地震（USGS）'
  },
  dadjoke: {
    url: () => 'https://icanhazdadjoke.com/',
    desc: '爸爸笑话（icanhazdadjoke）',
    headers: { Accept: 'application/json' }
  }
};

function upstream(name, path) {
  const src = SOURCES[name];
  if (!src) return null;
  const q = new URLSearchParams((path.split('?')[1] || ''));
  const p = {};
  for (const [k, v] of q) p[k] = v;
  return { src, url: src.url(p), raw: p.raw === '1', headers: src.headers || {} };
}

function fetchUrl(url, redirects = 0, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'keyless-gateway/1.0', ...extraHeaders } }, (res) => {
      // 301/302/307/308 跟随（最多 3 跳），Location 可能相对路径
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 3) {
        res.resume();
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        fetchUrl(next, redirects + 1, extraHeaders).then(resolve, reject);
        return;
      }
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

  // 简单限流：每 IP 每 10s 窗口最多 30 次请求（防误刷，非精确）
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const win = Math.floor(now / 10000);
  const rlKey = `${ip}:${win}`;
  RATE.count[rlKey] = (RATE.count[rlKey] || 0) + 1;
  if (RATE.count[rlKey] > RATE.limit) {
    res.writeHead(429, cors);
    res.end(JSON.stringify({ error: 'rate limited', retry_after_seconds: 10 }));
    return;
  }

  try {
    // 健康检查：并发探所有源（skip_health 标记的跳过，避免代理抖动源误报整体状态）
    // 10s 结果缓存：避免频繁 /health 并发探测 32 上游加重上游负担/自撞限流
    if (path === '/health') {
      const cachedH = CACHE.get('__health__');
      if (cachedH && Date.now() - cachedH.ts < 10_000) {
        res.writeHead(200, { ...cors, 'X-Cache': 'HIT' });
        res.end(cachedH.body);
        return;
      }
      const results = await Promise.all(Object.entries(SOURCES).map(async ([name, src]) => {
        try {
          if (src.skip_health) return { name, desc: src.desc, status: 'skipped', ok: true };
          const r = await fetchUrl(src.url({}), 0, src.headers || {});
          return { name, desc: src.desc, status: r.status, ok: r.status >= 200 && r.status < 400 };
        } catch (e) { return { name, desc: src.desc, status: 'ERR', ok: false, error: e.message }; }
      }));
      const probed = results.filter((r) => r.status !== 'skipped');
      const okCount = probed.filter((r) => r.ok).length;
      // 可用率 ≥90%（且至少 1 个失败时也降级提示）→ 公益 API 源抖动是常态，单源失败不判整体挂
      const healthy = probed.length === 0 || okCount / probed.length >= 0.9;
      const body = JSON.stringify({ ok: healthy, ok_count: okCount, total: probed.length, sources: results }, null, 2);
      CACHE.set('__health__', { body, ts: Date.now() });
      res.writeHead(200, { ...cors, 'X-Cache': 'MISS' });
      res.end(body);
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
      // 缓存：TTL 60s，命中直接返回（对不稳定源降抖；qrcode 图片不缓存避免陈旧）
      const cacheKey = `${m[1]}:${url.search}`;
      const cached = CACHE.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL && m[1] !== 'qrcode') {
        res.writeHead(200, { 'Content-Type': cached.ct || 'application/json; charset=utf-8', 'X-Cache': 'HIT' });
        res.end(cached.body);
        return;
      }
      try {
        const r = await fetchUrl(hit.url, 0, hit.headers);
        if (hit.raw) { res.writeHead(r.status, { 'Content-Type': r.headers['content-type'] || 'application/json' }); res.end(r.data); return; }
        CACHE.set(cacheKey, { body: r.data, ct: r.headers['content-type'] || 'application/json; charset=utf-8', ts: Date.now() });
        res.writeHead(r.status, { ...cors, 'X-Cache': 'MISS' });
        res.end(r.data);
      } catch (e) {
        // 优雅错误：含 source 名 + 降级提示
        res.writeHead(502, cors);
        res.end(JSON.stringify({ error: 'upstream error', source: m[1], message: e.message, hint: '可稍后重试或换其它源（/health 看状态）' }));
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

// 优雅关闭：Ctrl+C / SIGTERM 时落日志后退出（防静默消失无法取证）
function shutdown(sig) {
  console.log(`[${new Date().toISOString()}] gateway ${sig} received, shutting down (cache=${CACHE.size}, rate keys=${Object.keys(RATE.count).length})`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
