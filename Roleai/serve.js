// RoleAI Studio 站点镜像的本地静态服务器 + API 反向代理
// 零依赖：仅用 Node 内置模块。
//   /            -> site/ 静态文件
//   /api/*       -> 反向代理到 api.roleai.studio（对齐 runtime-config.js 的 ROLEAI_API_BASE=/api 设计）
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'site');
const PORT = Number(process.env.PORT || 8088);
const HOST = '127.0.0.1';
const API_ORIGIN = process.env.API_ORIGIN || 'https://api.roleai.studio';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx</center>
</body>
</html>
`;

function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache',
  });
  res.end(buf);
}

// 反向代理 /api/* -> API_ORIGIN/*
function proxyApi(req, res, urlPath) {
  const target = new URL(API_ORIGIN);
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || 443,
    method: req.method,
    path: urlPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
    headers: { ...req.headers, host: target.hostname },
  };
  delete options.headers['accept-encoding']; // 避免 gzip 透传后内容不可读

  const upstream = https.request(options, (upRes) => {
    const headers = { ...upRes.headers };
    // 本地是同源访问，剔除会误伤的上游 CORS/安全头
    delete headers['content-security-policy'];
    delete headers['strict-transport-security'];
    delete headers['transfer-encoding'];
    delete headers['connection'];
    res.writeHead(upRes.statusCode, headers);
    upRes.pipe(res);
  });

  upstream.on('error', (err) => {
    console.log(`${req.method} ${urlPath} -> 502 (${err.message})`);
    send(res, 502, JSON.stringify({ error: { message: 'upstream unreachable: ' + err.message } }), 'application/json; charset=utf-8');
  });

  console.log(`${req.method} ${urlPath} -> proxy ${API_ORIGIN}`);
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  // API 走反向代理
  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    return proxyApi(req, res, urlPath.replace(/^\/api/, '') || '/');
  }

  // 防目录穿越
  const rel = urlPath.replace(/^\/+/, '');
  let target = path.resolve(ROOT, rel);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(target, (err, st) => {
    if (!err && st.isDirectory()) target = path.join(target, 'index.html');

    fs.readFile(target, (err2, data) => {
      if (err2) {
        const code = err2.code === 'ENOENT' ? 404 : 500;
        console.log(`${req.method} ${urlPath} -> ${code}`);
        // 与源站 nginx 的 404 响应形态保持一致
        return send(res, code, code === 404 ? NOT_FOUND_HTML : '500 Internal Error',
          code === 404 ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
      }
      const ext = path.extname(target).toLowerCase();
      console.log(`${req.method} ${urlPath} -> 200 (${data.length}B)`);
      send(res, 200, data, MIME[ext] || 'application/octet-stream');
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[RoleAI] 站点根目录: ${ROOT}`);
  console.log(`[RoleAI] API 反向代理: /api/* -> ${API_ORIGIN}`);
  console.log(`[RoleAI] 服务已启动: http://${HOST}:${PORT}/`);
});
