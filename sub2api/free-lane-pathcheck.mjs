/**
 * free-lane-pathcheck：路径漂移检查器（只读）
 *
 * 动机（2026-09-14 实证）：olomc-free(48) 被 free-lane-audit 连续误判 BAD/建议停池，
 * 根因不是号坏，而是 **audit 用 store 的 base 拼 '/v1/chat/completions'**，
 * 而网关库 accounts.credentials->>'base_url' 的真实值带前缀 '/gw/v1' → 探针打到 404 → 3 次重试全 BAD。
 * columbina 之所以没事纯属**巧合**：它的 DB base_url 恰好是 '.../v1'，与 audit 默认拼法一致。
 *
 * 这个脚本把"巧合"变成"检查"：逐条对比 store 与 DB，任一处不一致就报出来。
 * 另报覆盖缺口：DB 有号但 store 没条目 → audit 根本探不到它（健康率分母被低估）。
 *
 * 用法：node free-lane-pathcheck.mjs         （只读，不打印任何 key）
 *       node free-lane-pathcheck.mjs --selftest
 */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const CWD = realpathSync(process.cwd());
function resolveLeads() {
  if (process.env.DSH_LEADS_DIR) return process.env.DSH_LEADS_DIR;
  const sep = CWD.includes('\\') ? '\\' : '/';
  const guess = CWD.replace(/[\\/]tdsh[\\/]sub2api$/, 'tdsh' + sep + 'forum_leads_20260913');
  if (existsSync(join(guess, 'site-accounts.json'))) return guess;
  const fb = CWD.includes('\\') ? 'D:\\tdsh\\forum_leads_20260913' : '/mnt/d/tdsh/forum_leads_20260913';
  return fb;
}
const LEADS = resolveLeads();
const STORE = join(LEADS, 'site-accounts.json');

// audit 的默认拼法（与 free-lane-audit.mjs 保持一致，否则这个检查器没有意义）
const AUDIT_DEFAULT_PATH = '/v1/chat/completions';

/** 从 URL 取出路径（去掉末尾 /），失败返回 null */
export function pathOf(u) {
  try { return (new URL(u).pathname || '/').replace(/\/$/, '') || ''; }
  catch { return null; }
}

/** 计算 audit 会对该 store 条目请求的完整 URL（含 chatPath 覆盖逻辑） */
export function auditUrlFor(entry) {
  if (!entry || !entry.base) return null;
  return entry.chatPath ? entry.base + entry.chatPath : entry.base + AUDIT_DEFAULT_PATH;
}

/**
 * 纯函数：比对 store 与 DB，产出漂移报告（可 selftest）
 * @param storeEntries [{tag, base, chatPath, poolName}]
 * @param dbRows [{name, baseUrl}]
 */
export function checkDrift(storeEntries, dbRows) {
  const issues = [];
  const dbByName = new Map(dbRows.map(r => [r.name, r.baseUrl]));
  const dbByHost = new Map();
  for (const r of dbRows) {
    const h = (() => { try { return new URL(r.baseUrl).host; } catch { return null; } })();
    if (h) (dbByHost.get(h) || dbByHost.set(h, []).get(h)).push(r);
  }
  // 1) store 条目若已入池（有 poolName），其 audit URL 必须与 DB base_url + '/chat/completions' 一致
  for (const e of storeEntries) {
    const url = auditUrlFor(e);
    if (!url || !e.poolName) continue;
    const db = dbByName.get(e.poolName);
    if (!db) continue;                       // 尚未入池 / 名字不同：跳过（覆盖缺口另报）
    const expect = db.replace(/\/$/, '') + '/chat/completions';
    if (url !== expect) {
      issues.push({
        kind: 'path-drift', tag: e.tag, poolName: e.poolName,
        auditUrl: url, dbUrl: expect,
        fix: `在 store 的 '${e.tag}' 条目加 chatPath=${JSON.stringify(pathOf(db) + '/chat/completions')}`,
      });
    }
  }
  // 2) 覆盖缺口：DB 有免费味名字但 store 无条目 → audit 探不到
  const storePoolNames = new Set(storeEntries.map(e => e.poolName).filter(Boolean));
  for (const r of dbRows) {
    const freeish = /free|columbina|pollination|xzt|aitools|xuanwu|freemodel|olomc|tokenrouter|hub-linuxdo|wb2api|tele-/i.test(r.name);
    if (!freeish) continue;
    if (!storePoolNames.has(r.name)) {
      issues.push({ kind: 'coverage-gap', poolName: r.name, dbUrl: r.baseUrl, note: 'free-lane-audit 探不到（store 无条目）' });
    }
  }
  return issues;
}

/* ---------------- selftest ---------------- */
if (process.argv.includes('--selftest')) {
  const cases = [];
  const storeEntries = [
    { tag: 'h1#0', base: 'https://h1.example', poolName: 'p1' },                       // DB 是 /v1 → 一致
    { tag: 'h2', base: 'https://h2.example', poolName: 'p2' },                          // DB 是 /gw/v1 → 漂移
    { tag: 'h3', base: 'https://h3.example', chatPath: '/gw/v1/chat/completions', poolName: 'p3' }, // 已修 → 一致
    { tag: 'h4', base: 'https://h4.example', poolName: 'p4-not-in-db' },                // DB 无此名 → 跳过
  ];
  const dbRows = [
    { name: 'p1', baseUrl: 'https://h1.example/v1' },
    { name: 'p2', baseUrl: 'https://h2.example/gw/v1' },
    { name: 'p3', baseUrl: 'https://h3.example/gw/v1' },
    { name: 'orphan-free', baseUrl: 'https://o.example/v1' },
  ];
  const r = checkDrift(storeEntries, dbRows);
  cases.push(['DB /v1 与 audit 默认一致 → 不报', !r.some(x => x.tag === 'h1#0')]);
  cases.push(['DB /gw/v1 与 audit 默认不一致 → 报 path-drift', r.some(x => x.kind === 'path-drift' && x.tag === 'h2')]);
  cases.push(['已有 chatPath 且与 DB 一致 → 不报', !r.some(x => x.tag === 'h3')]);
  cases.push(['store 有但 DB 无此名 → 跳过不报', !r.some(x => x.tag === 'h4')]);
  cases.push(['DB 有号但 store 无条目 → 报 coverage-gap', r.some(x => x.kind === 'coverage-gap' && x.poolName === 'orphan-free')]);
  cases.push(['path-drift 修复建议含正确 chatPath', (r.find(x => x.tag === 'h2')?.fix || '').includes('/gw/v1/chat/completions')]);
  cases.push(['pathOf 解析 host-only URL 得空串', pathOf('https://x.example') === '']);
  cases.push(['auditUrlFor 支持 chatPath 覆盖', auditUrlFor({ base: 'https://x', chatPath: '/a/b' }) === 'https://x/a/b']);
  cases.push(['auditUrlFor 无 chatPath 用默认', auditUrlFor({ base: 'https://x' }) === 'https://x/v1/chat/completions']);
  const failed = cases.filter(c => !c[1]);
  for (const [n, ok] of cases) console.log((ok ? '  ok   ' : '  FAIL ') + n);
  const bad = failed.length;
  console.log(bad ? `PATHCHECK SELFTEST FAILED: ${bad} 项` : 'PATHCHECK SELFTEST ALL PASS');
  process.exit(bad ? 1 : 0);
}

/* ---------------- 实跑（只读） ---------------- */
const store = JSON.parse(readFileSync(STORE, 'utf8'));
const storeEntries = Object.entries(store)
  .filter(([, a]) => a.apiKey && a.base)
  .map(([tag, a]) => ({ tag, base: a.base, chatPath: a.chatPath || null, poolName: a.poolName || null }));

// SQL 含单引号 → 必须走 heredoc 喂远端 shell（-c "..." 会被本地 shell 吃掉引号，已实测踩坑）。
// heredoc 定界符带单引号 'REMOTE'：本地与远端 bash 都不展开内部引号。
const q = "SELECT name, coalesce(credentials->>'base_url','') FROM accounts WHERE deleted_at IS NULL AND coalesce(credentials->>'base_url','') <> '' ORDER BY name";
const sh = `ssh -o BatchMode=yes -o ConnectTimeout=8 -i "$HOME/.ssh/id_ed25519" zhaozicheng@192.168.1.3 'bash -s' <<'REMOTE'\nexport PATH=/usr/local/opt/postgresql@16/bin:$PATH\npsql -h 127.0.0.1 -U postgres -d sub2api -At -F'|' -c "${q}"\nREMOTE\n`;
const tmp = join(CWD, '_tmp_pathcheck.sh');
import { writeFileSync, rmSync } from 'node:fs';
writeFileSync(tmp, '#!/bin/bash\n' + sh);
let out = '';
try {
  const wslRoot = process.env.DS_WSL_SUB2API_ROOT || '/mnt/d/tdsh/sub2api';
  out = execFileSync('wsl.exe', ['-e', 'bash', join(wslRoot, '_tmp_pathcheck.sh').replace(/\\/g, '/')], { encoding: 'utf8', timeout: 90000 });
} catch (e) { console.error('DB 查询失败（需要 Mac ssh 可达）：' + String(e).slice(0, 80)); process.exit(1); }
finally { try { rmSync(tmp); } catch { } }

const dbRows = out.split('\n').map(l => l.trim()).filter(l => l.includes('|'))
  .map(l => { const i = l.indexOf('|'); return { name: l.slice(0, i), baseUrl: l.slice(i + 1) }; });

const issues = checkDrift(storeEntries, dbRows);
console.log(`store 条目(有key+base)=${storeEntries.length} · DB 有 base_url 的号=${dbRows.length}`);
if (!issues.length) { console.log('✅ 无路径漂移、无覆盖缺口'); process.exit(0); }
const drift = issues.filter(x => x.kind === 'path-drift');
const gap = issues.filter(x => x.kind === 'coverage-gap');
if (drift.length) {
  console.log(`\n🔴 路径漂移 ${drift.length} 条（audit 会对这些号打出假 BAD → 误荐停池）：`);
  for (const d of drift) console.log(`  ${d.tag} (pool=${d.poolName})\n    audit 会请求: ${d.auditUrl}\n    DB 真实应为: ${d.dbUrl}\n    修法: ${d.fix}`);
}
if (gap.length) {
  console.log(`\n🟠 覆盖缺口 ${gap.length} 条（DB 有此号但 store 无条目 → free-lane-audit 探不到，健康率分母被低估）：`);
  for (const g of gap) console.log(`  ${g.poolName}  ${g.dbUrl}`);
}
process.exit(drift.length ? 1 : 0);
