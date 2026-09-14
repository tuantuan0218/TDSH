/**
 * free-lane-trend: 把免费道每轮状态压成一行 JSONL（供后续会话一眼看趋势，不必重读长文）
 * 字段来源全部是实测：screen 快照 / site-accounts store / usage_logs / 体检可选
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// ROOT 必须可移植：Windows 侧 node 拿 D:/tdsh/...，WSL 侧 node（/mnt/d/...）拿 WSL 路径。
// 若硬写 D:/tdsh，WSL 侧写 D:/tdsh/... 会落到 WSL 文件系统里（或 ENOENT），Windows 侧才是真路径。
// 用 realpath 解出"当前 CWD 的绝对路径"，Windows/WSL 各自正确；CWD 由调用方保证 = sub2api 根。
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = join(process.cwd(), '');
if (!existsSync(join(ROOT, 'free-lane-audit.mjs'))) { console.error('CWD 必须=sub2api 根（找不到 free-lane-audit.mjs）：' + ROOT); process.exit(2); }
mkdirSync(ROOT + 'free-quota-snapshots', { recursive: true });   // 目录不存在自动建（防 ENOENT）
const SNAP = ROOT + 'free-quota-snapshots/screen-latest.json';
const AUD = ROOT + 'free-lane-audit.mjs';
const TREND = ROOT + 'free-quota-snapshots/free-lane-trend.jsonl';

const scr = existsSync(SNAP) ? JSON.parse(readFileSync(SNAP, 'utf8')) : null;
const live = scr?.live || [];
const verdict = k => live.filter(x => x.verdict === k).map(x => x.h);
let balance = null, healthy = null, total = null;
try {
  const out = execFileSync(process.execPath, [AUD], { encoding: 'utf8', timeout: 900000 });
  const m1 = out.match(/合计站内免费额度 ≈ \$([\d.]+)；健康 (\d+)\/(\d+)/);
  if (m1) { balance = +m1[1]; healthy = +m1[2]; total = +m1[3]; }
} catch { }
let organic15 = null;
try {
  const sh = `#!/bin/bash\nssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'R'\nexport PATH=/usr/local/opt/postgresql@16/bin:$PATH\npsql -h 127.0.0.1 -U postgres -d sub2api -At -c "SELECT count(*) FROM usage_logs WHERE account_id IN (SELECT id FROM accounts WHERE name LIKE '%free%') AND created_at > now() - interval '15 minutes'"\nR\n`;
  writeFileSync(join(ROOT, '_tr.sh'), sh);
  // WSL 路径：Windows 侧 node 里 wsl.exe 看到的 D: 盘在 /mnt/d/...；CWD 是 Windows 的 D:/tdsh/sub2api 时 WSL 等价 /mnt/d/tdsh/sub2api
  const wslRoot = process.env.DS_WSL_SUB2API_ROOT || '/mnt/d/tdsh/sub2api';
  organic15 = +execFileSync('wsl.exe', ['-e', 'bash', join(wslRoot, '_tr.sh').replace(/\\/g, '/')], { encoding: 'utf8', timeout: 120000 }).trim();
} catch { }
try { rmSync(join(ROOT, '_tr.sh')); } catch { }   // 用完即删：不在 git 工作树里堆临时脚本（TDSH 远端是公开仓）

// 用户可见失败口径：必须排除 Recovered 前缀（那是"上游报错但重试成功"，不是故障）
// 本会话教训：判"有没有伤到用户"要看 recovered/非 recovered 分桶，光看错误条数会误判
let vis = null, visErr = '';
try {
  // 用"逐条 echo 标签 + 简单 -c"形状（长 SQL 拼 -F"|" 在 node→node→wsl 嵌套下会失败，已实测）
  const sh = `#!/bin/bash\nssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'R'\nexport PATH=/usr/local/opt/postgresql@16/bin:$PATH\nQ(){ psql -h 127.0.0.1 -U postgres -d sub2api -At -c "$1"; }\necho "free_vis=$(Q "SELECT count(*) FROM ops_error_logs e JOIN accounts a ON a.id=e.account_id WHERE a.name LIKE '%free%' AND e.created_at > now() - interval '6 hours' AND e.error_message NOT LIKE 'Recovered%'")"\necho "free_recovered=$(Q "SELECT count(*) FROM ops_error_logs e JOIN accounts a ON a.id=e.account_id WHERE a.name LIKE '%free%' AND e.created_at > now() - interval '6 hours' AND e.error_message LIKE 'Recovered%'")"\necho "pool_vis=$(Q "SELECT count(*) FROM ops_error_logs e WHERE e.created_at > now() - interval '6 hours' AND e.error_message NOT LIKE 'Recovered%'")"\necho "free_id20_6h=$(Q "SELECT count(*) FROM usage_logs WHERE account_id=20 AND created_at > now() - interval '6 hours'")"\necho "free_tail_max_s=$(Q "SELECT coalesce(max(duration_ms)/1000,0)::text FROM usage_logs l JOIN accounts a ON a.id=l.account_id WHERE a.name LIKE '%free%' AND l.created_at > now() - interval '6 hours'")"\necho "lane_vis=$(Q "SELECT count(*) FROM ops_error_logs e JOIN accounts a ON a.id=e.account_id WHERE (a.name LIKE 'columbina-free%' OR a.id=7) AND e.created_at > now() - interval '6 hours' AND e.error_message NOT LIKE 'Recovered%'")"\necho "lane_recovered=$(Q "SELECT count(*) FROM ops_error_logs e JOIN accounts a ON a.id=e.account_id WHERE (a.name LIKE 'columbina-free%' OR a.id=7) AND e.created_at > now() - interval '6 hours' AND e.error_message LIKE 'Recovered%'")"\necho "lane_served_6h=$(Q "SELECT count(*) FROM usage_logs l JOIN accounts a ON a.id=l.account_id WHERE (a.name LIKE 'columbina-free%' OR a.id=7) AND l.created_at > now() - interval '6 hours'")"\necho "top_acct=$(Q "SELECT coalesce((SELECT a.id::text FROM usage_logs l JOIN accounts a ON a.id=l.account_id WHERE (a.name LIKE 'columbina-free%' OR a.id=7) AND l.created_at > now() - interval '6 hours' GROUP BY a.id ORDER BY count(*) DESC LIMIT 1),'-')")"\necho "top_served_6h=$(Q "SELECT coalesce((SELECT count(*) FROM usage_logs l JOIN accounts a ON a.id=l.account_id WHERE (a.name LIKE 'columbina-free%' OR a.id=7) AND l.created_at > now() - interval '6 hours' GROUP BY a.id ORDER BY count(*) DESC LIMIT 1),0)")"\nR\n`;
  const sh2root = process.env.DS_WSL_SUB2API_ROOT || '/mnt/d/tdsh/sub2api';
  writeFileSync(join(ROOT, '_tr2.sh'), sh);
  const o = execFileSync('wsl.exe', ['-e', 'bash', join(sh2root, '_tr2.sh').replace(/\\/g, '/')], { encoding: 'utf8', timeout: 180000 });
  const g = {};
  for (const line of o.split('\n')) {
    const m = line.trim().match(/^(\w+)=([\d.]+)$/);
    if (m) g[m[1]] = +m[2];
  }
  if (g.free_vis !== undefined) vis = g; else visErr = '解析空:' + o.slice(0, 40).replace(/\s+/g, ' ');
} catch (e) { visErr = String(e).slice(0, 40); }
finally { try { rmSync(join(ROOT, '_tr2.sh')); } catch { } }   // 失败也要删：不在工作树漏临时文件（上轮就漏了一个）

// 静默失效（200+错误正文）**不会进 ops_error_logs** → visible_fail 系列对它是全盲的。
// 唯一数据源是 free-lane-integrity.sh 的 #SUMMARY#（由 monitor --integrity 落成本地快照），这里只读不算。
let integ = null;
try {
  const f = ROOT + 'free-quota-snapshots/integrity-latest.json';
  if (existsSync(f)) integ = JSON.parse(readFileSync(f, 'utf8'));
} catch { }

const rec = {
  ts: new Date().toISOString(),
  hosts_monitored: existsSync('D:/tdsh/forum_leads_20260913/mined-hosts.json') ? JSON.parse(readFileSync('D:/tdsh/forum_leads_20260913/mined-hosts.json', 'utf8')).length : 0,
  live_na: live.length,
  gold_ck: verdict('GOLD_CK'),
  email_code_ck: verdict('email_code_ck').length,
  free_accounts_healthy: total ? `${healthy}/${total}` : null,
  balance_usd: balance,
  organic_picks_15m: organic15,
  // 用户可见失败（已排除 Recovered）· 6h：免费道 vs 全站；以及" recovered=上游报错但重试救回"计数
  // —— 两个总体必须分开命名，否则跨轮会拿苹果比橘子（本会话真实缺陷）——
  // lane_* = 我自己这条免费道（columbina-free%，19 号）；free_* = 池内所有名字含 free 的号（含别的会话加的）
  lane_visible_fail_6h: vis ? vis.lane_vis : null,
  lane_recovered_6h: vis ? vis.lane_recovered : null,
  lane_served_6h: vis ? vis.lane_served_6h : null,
  free_visible_fail_6h: vis ? vis.free_vis : null,
  free_recovered_6h: vis ? vis.free_recovered : null,
  pool_visible_fail_6h: vis ? vis.pool_vis : null,
  free_slowest_req_s: vis ? Math.round((vis.free_tail_max_s || 0) * 10) / 10 : null,   // >20s 说明真流量落到慢道（多为大上下文）
  organic_picks_6h_id20: vis ? vis.free_id20_6h : null,   // 旧字段（id 写死，保留只为历史可比）
  top_free_acct: vis ? vis.top_acct : null,               // 6h 接单最多的免费号 id（不再写死：别人重排号也不会量错）
  top_free_served_6h: vis ? vis.top_served_6h : null,     // 该号 6h 接单数 = 单号承载实测
  // 静默失效（200+错误正文）只有这里能看到；visible_fail_* 对它不可见。缺快照=没跑过 --integrity
  silent_fail_count: integ ? integ.silent : null,
  silent_fail_sched_ids: integ ? integ.silent_schedulable : null,
  integrity_ts: integ ? integ.ts : null,
  // null 与 0 必须可区分：查询挂了不能伪装成"零失败"
  metric_errors: [
    vis ? null : ('visible_fail_query: ' + (visErr || '空')),
    balance == null ? 'audit_parse_failed' : null,
    integ ? null : 'integrity_snapshot_missing(静默失效指标不可用，跑 --integrity 生成)',
  ].filter(Boolean).join(' ; ') || null,
  scope: 'lane_* = name LIKE columbina-free% OR id=7 (本会话开的 19 号 + 救活的智谱号) · free_* = name LIKE %free% (含他人会话加的号) · pool_* = 全池 · healthy/balance = free-lane-audit 的 store 覆盖范围',
  note: 'balance/health 来自 free-lane-audit（含重试）；organic 为 usage_logs 中 *free* 号 15 分钟请求数；可见失败一律排除 Recovered 前缀',
};
appendFileSync(TREND, JSON.stringify(rec) + '\n');
console.log('写入 ' + TREND + '（现共 ' + readFileSync(TREND, 'utf8').trim().split('\n').length + ' 行）');
console.log(JSON.stringify(rec, null, 1));
