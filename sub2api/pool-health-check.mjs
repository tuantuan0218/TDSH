/**
 * 池只读巡检（pool-health-check.mjs）
 *
 * 目的：把本会话反复手写 SQL 才得出的"池健康度"结论沉淀成一键巡检。
 *
 * 来源：2026-09-13 为验证「xzt 端点的 10次/分钟限流会不会打爆池」时，
 *   手工连写了 5 个临时 SQL 脚本，才依次查清：
 *     accounts.rate_limited_at（账号级限流字段）
 *     ops_error_logs（富错误表，含 upstream_status_code / retry_after_seconds）
 *     usage_logs（只记成功调用，无 status 列）
 *   这套方法此后每次都要重来 —— 故固化为脚本。
 *
 * 【安全边界】全程**只读**：仅执行 SELECT，绝不做 INSERT/UPDATE/DELETE。
 *   （用户明确要求不擅自改动池；本脚本刻意不提供任何写操作。）
 *
 * 用法：
 *   node pool-health-check.mjs              # 全量体检
 *   node pool-health-check.mjs --hours 24   # 指定时间窗（默认 12）
 *   node pool-health-check.mjs --account xzt  # 只看名字含该串的账号
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const hoursIdx = args.indexOf('--hours');
const HOURS = hoursIdx >= 0 ? Number(args[hoursIdx + 1]) || 12 : 12;
const acctIdx = args.indexOf('--account');
const ACCT_FILTER = acctIdx >= 0 ? args[acctIdx + 1] : null;

const SSH_HOST = 'zhaozicheng@192.168.1.3';
const PG_PATH = '/usr/local/opt/postgresql@16/bin';
const DB = 'sub2api';

/** 跑一段 SQL（只读），返回行的数组（每行是字段数组） */
function psql(sql) {
  const script = [
    `export PATH=${PG_PATH}:$PATH`,
    `psql -h 127.0.0.1 -U postgres -d ${DB} -At -F'	' <<'PSQL'`,
    sql,
    'PSQL',
  ].join('\n');

  // 通过 stdin 喂脚本，避免引号嵌套问题（本会话踩过）
  try {
    const out = execFileSync('bash', ['-c', `ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$HOME/.ssh/id_ed25519" ${SSH_HOST} 'bash -s'`], {
      input: script,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return out.split('\n').filter((l) => l.trim()).map((l) => l.split('\t'));
  } catch (e) {
    return { error: String(e.message || e).slice(0, 300) };
  }
}

/** 安全检查：确保 SQL 里没有写操作（防止未来误改脚本） */
function assertReadOnly(sql, label) {
  const bad = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;
  if (bad.test(sql)) {
    console.error(`⛔ 拒绝执行：${label} 含写操作关键字（本脚本只读）`);
    process.exit(2);
  }
}

const sections = [];
const log = (s) => { console.log(s); sections.push(s); };

log(`池只读巡检 · 时间窗 ${HOURS}h · ${new Date().toISOString()}`);
log('='.repeat(72));

/* ---------- 1. 总览 ---------- */
{
  const sql = `SELECT
    count(*) AS total,
    count(*) FILTER (WHERE status='active' AND schedulable) AS active_sched,
    count(*) FILTER (WHERE status='error') AS errored,
    count(*) FILTER (WHERE rate_limited_at IS NOT NULL) AS ever_rate_limited
  FROM accounts WHERE deleted_at IS NULL;`;
  assertReadOnly(sql, '总览');
  const r = psql(sql);
  if (r.error) { log(`⚠️ 连接失败：${r.error}`); }
  else {
    const [total, active, errored, rl] = r[0] || [];
    log(`\n## 1. 总览`);
    log(`账号总数 ${total} · active+schedulable ${active} · error 状态 ${errored} · 曾限流 ${rl}`);
  }
}

/* ---------- 2. 账号健康表 ---------- */
{
  const filter = ACCT_FILTER ? ` AND a.name ILIKE '%${ACCT_FILTER.replace(/'/g, "''")}%'` : '';
  const sql = `SELECT a.id, a.name, a.status, a.schedulable, a.priority, a.concurrency,
      coalesce(a.rate_limited_at::text,'-') AS rl_at,
      coalesce(substr(a.error_message,1,40),'-') AS err_msg,
      coalesce(count(u.id) FILTER (WHERE u.created_at > now() - interval '${HOURS} hours'),0) AS reqs
    FROM accounts a
    LEFT JOIN usage_logs u ON u.account_id = a.id
    WHERE a.deleted_at IS NULL${filter}
    GROUP BY a.id, a.name, a.status, a.schedulable, a.priority, a.concurrency, a.rate_limited_at, a.error_message
    ORDER BY reqs DESC, a.id;`;
  assertReadOnly(sql, '账号健康表');
  const r = psql(sql);
  if (r.error) log(`⚠️ 账号表查询失败：${r.error}`);
  else {
    log(`\n## 2. 账号健康（按 ${HOURS}h 调用量降序）`);
    log(' id | name                 | status | sched | prio | conc | reqs | rate_limited');
    log('----+----------------------+--------+-------+------+------+------+-------------');
    for (const row of r) {
      const [id, name, status, sched, prio, conc, rl, err, reqs] = row;
      log(`${String(id).padStart(3)} | ${String(name).padEnd(20).slice(0, 20)} | ${String(status).padEnd(6)} | ${String(sched).padEnd(5)} | ${String(prio).padStart(4)} | ${String(conc).padStart(4)} | ${String(reqs).padStart(4)} | ${rl === '-' ? '-' : rl.slice(0, 19)}`);
    }
  }
}

/* ---------- 3. 上游错误分布（谁在撞限流/5xx） ---------- */
{
  const sql = `SELECT o.account_id, a.name, o.upstream_status_code, count(*) AS n
    FROM ops_error_logs o JOIN accounts a ON a.id = o.account_id
    WHERE o.created_at > now() - interval '${HOURS} hours'
      AND o.upstream_status_code IS NOT NULL
    GROUP BY o.account_id, a.name, o.upstream_status_code
    ORDER BY n DESC LIMIT 15;`;
  assertReadOnly(sql, '错误分布');
  const r = psql(sql);
  if (r.error) log(`⚠️ 错误分布查询失败：${r.error}`);
  else if (!r.length) log(`\n## 3. 上游错误分布：${HOURS}h 内无记录`);
  else {
    log(`\n## 3. 上游错误分布（${HOURS}h）`);
    for (const [aid, name, code, n] of r) {
      const flag = code === '429' ? '⛔限流' : Number(code) >= 500 ? '🔴5xx' : '';
      log(`  #${String(aid).padStart(3)} ${String(name).padEnd(20)} HTTP ${String(code).padEnd(4)} ×${String(n).padStart(4)} ${flag}`);
    }
  }
}

/* ---------- 4. 死因核查：error 状态账号 ---------- */
{
  const sql = `SELECT a.id, a.name, a.status, a.schedulable,
      coalesce(substr(a.error_message,1,90),'(无错误信息)') AS err,
      coalesce(a.rate_limited_at::text,'-') AS rl_at,
      coalesce((SELECT count(*) FROM ops_error_logs o WHERE o.account_id=a.id
                AND o.created_at > now() - interval '24 hours'),0) AS errs_24h,
      coalesce((SELECT max(o.upstream_status_code)::text FROM ops_error_logs o WHERE o.account_id=a.id
                AND o.created_at > now() - interval '24 hours'),'-') AS last_up_code
    FROM accounts a
    WHERE a.deleted_at IS NULL AND (a.status='error' OR NOT a.schedulable)
    ORDER BY a.id;`;
  assertReadOnly(sql, '死因核查');
  const r = psql(sql);
  if (r.error) log(`⚠️ 死因查询失败：${r.error}`);
  else if (!r.length) log(`\n## 4. 死因核查：无 error/不可调度账号`);
  else {
    log(`\n## 4. 死因核查（error 或不可调度）`);
    for (const [id, name, status, sched, err, rl, errs24, upcode] of r) {
      log(`  #${id} ${name}  status=${status} schedulable=${sched}`);
      log(`      错误信息: ${err}`);
      log(`      24h 错误数: ${errs24} · 最近上游码: ${upcode} · 限流时刻: ${rl}`);
    }
  }
}

/* ---------- 5. 结论 ---------- */
log('\n' + '='.repeat(72));
log('【如何读这份报告】');
log('  · rate_limited_at 非空 = 该账号曾撞上游限流（池会自动临时停用，属可自愈）');
log('  · reqs=0 且 status=active = 兜底位正常待命（前排健康时不会接单，非故障）');
log('  · status=error 且 24h 有错误 = 真故障，需人工介入');
log('');

writeFileSync('D:/tdsh/sub2api/POOL-HEALTH-REPORT.md', sections.join('\n') + '\n');
console.log('报告 → D:/tdsh/sub2api/POOL-HEALTH-REPORT.md');
