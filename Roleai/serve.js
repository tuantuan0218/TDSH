// RoleAI Studio 站点镜像的本地静态服务器 + API 反向代理
// 零依赖：仅用 Node 内置模块。
//   /            -> site/ 静态文件
//   /api/*       -> 反向代理到 api.roleai.studio（对齐 runtime-config.js 的 ROLEAI_API_BASE=/api 设计）
//
// 运行模式：
//   默认          代理模式：/api/* 实时转发到上游
//   --snapshot   快照模式：优先用 snapshots/ 下的本地 JSON 回答只读接口，未覆盖的再回退代理
//                用途：离线演示只读页面（如定价页）；详见 OFFLINE-REPORT.md §4
//   环境变量等价：SNAPSHOT=1 node serve.js
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'site');
const SNAP_DIR = path.join(__dirname, 'snapshots');
const PORT = Number(process.env.PORT || 8088);
const HOST = '127.0.0.1';
const API_ORIGIN = process.env.API_ORIGIN || 'https://api.roleai.studio';
const SNAPSHOT_MODE = process.argv.includes('--snapshot') || process.env.SNAPSHOT === '1';

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

// 快照查找：把 API 路径映射为 snapshots/ 下的文件名
//   /v1/product                    -> v1_product.json
//   /v1/auth/compliance/documents  -> v1_auth_compliance_documents.json
function lookupSnapshot(apiPath) {
  const clean = apiPath.split('?')[0].replace(/^\/+|\/+$/g, '');
  if (!clean) return null;
  const candidates = [
    clean.replace(/\//g, '_') + '.json',
    clean.replace(/[/-]/g, '_') + '.json',
  ];
  for (const name of candidates) {
    if (name.includes('..') || name.includes('/') || name.includes('\\')) continue;
    const full = path.join(SNAP_DIR, name);
    if (!full.startsWith(SNAP_DIR + path.sep)) continue;
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  // API：快照模式下优先读本地快照，未命中则回退反向代理
  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    const apiPath = urlPath.replace(/^\/api/, '') || '/';
    if (SNAPSHOT_MODE) {
      // 只对只读方法提供快照；写操作必须走真实上游（离线时自然失败，符合预期）
      const readonly = req.method === 'GET' || req.method === 'HEAD';
      if (readonly) {
        const snap = lookupSnapshot(apiPath);
        if (snap) {
          try {
            const body = fs.readFileSync(snap);
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': body.length,
              'X-Roleai-Snapshot': 'hit',
              'Cache-Control': 'no-cache',
            });
            console.log(`${req.method} ${urlPath} -> 200 (snapshot: ${path.basename(snap)})`);
            if (req.method === 'HEAD') return res.end();
            return res.end(body);
          } catch (e) {
            console.log(`${req.method} ${urlPath} -> snapshot read failed: ${e.message}`);
          }
        }
      }
    }
    return proxyApi(req, res, apiPath);
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
  if (SNAPSHOT_MODE) {
    const n = fs.existsSync(SNAP_DIR) ? fs.readdirSync(SNAP_DIR).filter(f => f.endsWith('.json')).length : 0;
    console.log(`[RoleAI] 运行模式: 快照优先（snapshots/ 有 ${n} 个文件，未命中回退代理）`);
  } else {
    console.log('[RoleAI] 运行模式: 纯代理（加 --snapshot 启用快照优先）');
  }
  console.log(`[RoleAI] 服务已启动: http://${HOST}:${PORT}/`);
});
