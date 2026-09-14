// 从用户现有 clash-verge.yaml 生成一份独立测试配置（端口 7898 + TCP 控制器 9098，不动用户的 Clash）
// 输出: D:\tdsh\sub2api\ghproxy\config.yaml
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const SRC = 'C:/Users/Administrator/AppData/Roaming/io.github.clash-verge-rev.clash-verge-rev/clash-verge.yaml';
const OUT_DIR = 'D:/tdsh/sub2api/ghproxy';
mkdirSync(OUT_DIR, { recursive: true });
const text = readFileSync(SRC, 'utf8');

// 按顶层 key 切块
const topKeys = [...text.matchAll(/^([a-zA-Z_][\w-]*):/gm)].map(m => ({ key: m[1], idx: m.index }));
function block(key) {
  const i = topKeys.findIndex(t => t.key === key);
  if (i < 0) return '';
  const start = topKeys[i].idx;
  const end = i + 1 < topKeys.length ? topKeys[i + 1].idx : text.length;
  return text.slice(start, end);
}
const groups = block('proxy-groups');
const proxies = block('proxies');
if (!groups || !proxies) { console.error('MISSING BLOCKS', { groups: !!groups, proxies: !!proxies }); process.exit(1); }

const cfg = `# auto-generated for GitHub-signup egress test (isolated instance)
mode: rule
mixed-port: 7898
allow-lan: false
log-level: warning
ipv6: false
external-controller: 127.0.0.1:9098
secret: ghscan
unified-delay: true
find-process-mode: off
profile:
  store-select: false
  store-path: ${OUT_DIR}/cache.db
dns:
  enable: false
proxies: ${proxies.split('\n').slice(1).join('\n').trimStart().startsWith('-') ? '' : '\n' + proxies.split('\n').slice(1).join('\n')}
${groups}
rules:
  - MATCH,三毛机场
`;
// 更稳妥：直接原样保留 proxies: 开头的整块
const cfg2 = `# auto-generated for GitHub-signup egress test (isolated instance)
mode: rule
mixed-port: 7898
allow-lan: false
log-level: warning
ipv6: false
external-controller: 127.0.0.1:9098
secret: ghscan
unified-delay: true
find-process-mode: off
profile:
  store-select: false
  store-path: ${OUT_DIR}/cache.db
dns:
  enable: false
` + proxies + groups + `rules:
  - MATCH,三毛机场
`;
writeFileSync(`${OUT_DIR}/config.yaml`, cfg2, 'utf8');
console.log('WROTE', `${OUT_DIR}/config.yaml`, 'bytes', cfg2.length, '| proxies block', proxies.length, '| groups block', groups.length);
