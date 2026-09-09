// TDSH mini-carrier for web-only mode.
// Serves /__tdsh/agent (global AGENTS.md read/write) on the desktop-carrier
// port so the dsh-global-agent settings panel works without the desktop shell.
// If the port is already taken (desktop shell providing the real carrier),
// this process exits silently. CORS-open, same contract as main.js carrier.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 24000;
const HOME = 'D:\\tdsh\\dsh-home';
const AGENTS = path.join(HOME, 'AGENTS.md');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function json(res, status, obj) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders()); res.end(); return; }
  let pathname;
  try { pathname = new URL(req.url, 'http://127.0.0.1:' + PORT).pathname; }
  catch { return json(res, 400, { ok: false, error: 'bad url' }); }

  if (req.method === 'GET' && pathname === '/__tdsh/agent') {
    try {
      const content = fs.existsSync(AGENTS) ? fs.readFileSync(AGENTS, 'utf8') : '';
      return json(res, 200, { content });
    } catch (e) { return json(res, 500, { ok: false, error: e.message }); }
  }
  if (req.method === 'POST' && pathname === '/__tdsh/agent') {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const body = JSON.parse(data || '{}');
        if (typeof body.content !== 'string') return json(res, 400, { ok: false, error: 'content must be a string' });
        // safety net: keep a timestamped backup of the previous file
        if (fs.existsSync(AGENTS)) {
          try { fs.copyFileSync(AGENTS, AGENTS + '.bak-' + Date.now()); } catch (e) {}
        }
        fs.mkdirSync(HOME, { recursive: true });
        fs.writeFileSync(AGENTS, body.content, 'utf8');
        return json(res, 200, { ok: true });
      } catch (e) { return json(res, 500, { ok: false, error: e.message }); }
    });
    return;
  }
  // also answer the update-status probe so the update button degrades cleanly
  if (req.method === 'GET' && pathname === '/__tdsh/update') {
    return json(res, 200, { status: 'up-to-date', version: 'web-only', downloaded: false });
  }
  json(res, 404, { ok: false, error: 'not found' });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') process.exit(0); // desktop shell owns the port
  console.error('[carrier-mini] ' + e.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.error('[carrier-mini] listening on http://127.0.0.1:' + PORT);
});