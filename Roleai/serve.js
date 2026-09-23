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
  // 注意：Node 的 new URL() 已解析 %2e%2e 等编码，path.resolve 会归一化 ..，
  // 因此这里的前缀校验是可靠的最后一道闸；实测 9 种穿越变体均被拦（403/404）
  const rel = urlPath.replace(/^\/+/, '');
  let target = path.resolve(ROOT, rel);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    console.log(`${req.method} ${urlPath} -> 403 (traversal blocked)`);
    return send(res, 403, 'Forbidden');
  }

  fs.stat(target, (err, st) => {
    if (!err && st.isDirectory()) {
      target = path.join(target, 'index.html');
      st = fs.statSync(target, { throwIfNoEntry: false });
    }
    if (!st || !st.isFile()) {
      console.log(`${req.method} ${urlPath} -> 404`);
      return send(res, 404, NOT_FOUND_HTML, 'text/html; charset=utf-8');
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const size = st.size;

    // ---- HTTP Range 支持（单区间）----
    // 用于大文件断点续传、图片/音视频拖动。不支持 Range 或语法非法时回退整文件 200。
    const rangeHeader = req.headers.range;
    let start = 0;
    let end = size - 1;
    let partial = false;

    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (m && (m[1] !== '' || m[2] !== '')) {
        if (m[1] === '') {
          // bytes=-N 表示最后 N 字节
          const suffix = parseInt(m[2], 10);
          if (suffix > 0) { start = Math.max(0, size - suffix); end = size - 1; partial = true; }
        } else {
          start = parseInt(m[1], 10);
          end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
          if (end > size - 1) end = size - 1;
          partial = true;
        }
      }
      // Range 不可满足 -> 416
      if (partial && (start > end || start >= size)) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        console.log(`${req.method} ${urlPath} -> 416 (unsatisfiable range)`);
        return res.end();
      }
    }

    if (partial) {
      const len = end - start + 1;
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': len,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      console.log(`${req.method} ${urlPath} -> 206 (${start}-${end}/${size})`);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(target, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
      console.log(`${req.method} ${urlPath} -> 200 (${size}B)`);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(target).pipe(res);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[RoleAI] 站点根目录: ${ROOT}`);
  console.log(`[RoleAI] API 反向代理: /api/* -> ${API_ORIGIN}`);
  console.log(`[RoleAI] 服务已启动: http://${HOST}:${PORT}/`);
});
