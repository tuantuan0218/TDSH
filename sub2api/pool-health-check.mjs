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
const REDIS_CLI = '/usr/local/bin/redis-cli';   // 不在非登录 PATH，需绝对路径

/**
 * 跑一段**只读** shell（通过 SSH），返回 stdout 文本。
 * 用途：读 Redis 调度 zset（PostgreSQL 查不到调度器的真实序列）。
 */
function shell(script) {
  try {
    return execFileSync('bash', ['-c', `ssh -o BatchMode=yes -o ConnectTimeout=10 -i "$HOME/.ssh/id_ed25519" ${SSH_HOST} 'bash -s'`], {
      input: script, encoding: 'utf8', timeout: 120000, maxBuffer: 20 * 1024 * 1024,
    });
  } catch (e) {
    return { error: String(e.message || e).slice(0, 300) };
  }
}

/** 读 Redis 调度序列：返回 [{ key, members: [{id, score}] }]（只读 ZRANGE） */
export function readSchedulerZsets() {
  const script = [
    `RC=${REDIS_CLI}`,
    // 找出所有 sched:*:v* 形态的 zset 键
    `for k in $($RC -h 127.0.0.1 -p 6379 --scan --pattern 'sched:*:v*' 2>/dev/null); do`,
    `  t=$($RC -h 127.0.0.1 -p 6379 type "$k" 2>/dev/null)`,
    `  [ "$t" = "zset" ] || continue`,
    `  n=$($RC -h 127.0.0.1 -p 6379 zcard "$k" 2>/dev/null)`,
    `  [ "$n" -gt 0 ] 2>/dev/null || continue`,
    `  echo "KEY|$k|$n"`,
    `  $RC -h 127.0.0.1 -p 6379 zrange "$k" 0 -1 WITHSCORES 2>/dev/null | paste - - | sed 's/^/M|/'`,
    `done`,
  ].join('\n');
  const out = shell(script);
  if (typeof out !== 'string') return { error: out.error };
  const sets = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('KEY|')) {
      const [, key, n] = line.split('|');
      cur = { key, size: Number(n), members: [] };
      sets.push(cur);
    } else if (line.startsWith('M|') && cur) {
      const parts = line.slice(2).split('\t');
      if (parts.length >= 2) cur.members.push({ id: parts[0].trim(), score: Number(parts[1]) });
    }
  }
  return { sets };
}

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

/* ---------- 5. 400 错误根因分析（客户端 vs 上游）----------
 * 动机：2026-09-13 发现全池 400 量很大，深挖后确认**压倒性主因是客户端请求不当**
 *   （超上下文 70 万 token / 非法 tool_call），但池的 error_owner 全标成 provider。
 *   此处把归类固化，避免每次重新手工分析，并暴露"归属可能误标"这一风险。
 */
{
  const sql = `WITH e AS (
      SELECT error_owner, error_message, api_key_id,
        CASE
          WHEN error_message ILIKE '%tool_call function, function/name cannot be empty%' THEN 'A. 工具调用 name 为空'
          WHEN error_message ILIKE '%is a required property%' THEN 'A2. 工具调用缺 name'
          WHEN error_message ILIKE '%ContextWindowExceeded%' OR error_message ILIKE '%token count exceeds%'
               OR error_message ILIKE '%maximum prompt length%' THEN 'B. 超上下文窗口'
          WHEN error_message ILIKE '%missing required%' THEN 'C. 请求体缺字段'
          ELSE 'D. 其它'
        END AS cat
      FROM ops_error_logs
      WHERE created_at > now() - interval '${HOURS} hours' AND upstream_status_code = 400
    )
    SELECT cat, count(*) AS n, count(DISTINCT api_key_id) AS keys FROM e
    GROUP BY cat ORDER BY n DESC;`;
  assertReadOnly(sql, '400 分类');
  const r = psql(sql);
  if (r.error) log(`⚠️ 400 分类查询失败：${r.error}`);
  else if (!r.length) log(`\n## 5. 400 错误根因：${HOURS}h 内无 400`);
  else {
    const total = r.reduce((s, row) => s + Number(row[1]), 0);
    log(`\n## 5. 400 错误根因（共 ${total} 条 · 客户端请求问题，非池故障）`);
    for (const [cat, n, keys] of r) {
      log(`  ${cat.padEnd(24)} ${String(n).padStart(4)} 条 (${(100 * n / total).toFixed(1)}%) · 涉及 ${keys} 个 key`);
    }
    log('  ⚠️ 注意：D 类（其它）常含未归类的同因错误 —— 分类后**务必抽查 D 桶**，否则易把主因误判为杂项');
    // 归属字段风险提示
    const ownerSql = `SELECT coalesce(error_owner,'-'), count(*) FROM ops_error_logs
      WHERE created_at > now() - interval '${HOURS} hours' AND upstream_status_code = 400
      GROUP BY 1 ORDER BY 2 DESC;`;
    assertReadOnly(ownerSql, '400 归属');
    const ro = psql(ownerSql);
    if (!ro.error && ro.length) {
      log(`  error_owner 归属：${ro.map((x) => `${x[0]}=${x[1]}`).join(' · ')}`);
      if (ro.every((x) => x[0] === 'provider')) {
        log('  🔴 风险：上述 400 的成因多为**客户端**（超上下文/非法 tool_call），却全归为 provider ——');
        log('     若据 error_owner 做账号降权，会错误惩罚无辜上游账号。建议改为识别 400 语义后归 client。');
      }
    }
  }
}

/* ---------- 5b. 僵尸账号：active+schedulable 但缺 base_url ----------
 * 2026-09-13 发现：4 个账号（2/5/7/8）status=active 且 schedulable=true，
 *   但 credentials.base_url 为 NULL → 永远无法服务，却可能占用调度名次。
 *   其 priority 数值比部分可用账号更小（19/20 < 23/24/26/27），存在"排在可用账号之前被选中"的风险。
 * ⚠️ 仅报告，不自动改配置（用户要求不擅自改池；且这些可能是并行会话的半成品）。
 */
{
  const sql = `SELECT id, name, priority, concurrency,
      coalesce(extra->>'model_mapping','(none)') AS mapping,
      coalesce((SELECT count(*) FROM usage_logs u WHERE u.account_id=a.id),0) AS ever_used
    FROM accounts a
    WHERE deleted_at IS NULL AND status='active' AND schedulable
      AND coalesce(credentials->>'base_url','')=''
    ORDER BY priority;`;
  assertReadOnly(sql, '僵尸账号');
  const r = psql(sql);
  if (r.error) log(`⚠️ 僵尸账号查询失败：${r.error}`);
  else if (!r.length) log('\n## 5b. 僵尸账号（active 但无 base_url）：无 ✅');
  else {
    log(`\n## 5b. ⚠️ 僵尸账号：active + schedulable 但 **无 base_url**（${r.length} 个）`);
    log('  id | name                 | prio | conc | 历史调用 | model_mapping');
    for (const [id, name, prio, conc, mapping, used] of r) {
      log(`  ${String(id).padStart(2)} | ${String(name).padEnd(20).slice(0, 20)} | ${String(prio).padStart(4)} | ${String(conc).padStart(4)} | ${String(used).padStart(8)} | ${mapping.slice(0, 30)}`);
    }
    log('  🔴 这些账号**永远无法服务**（无上游地址），却 schedulable=true ——');
    log('     若其 priority 数值小于可用账号，可能在调度中抢先被选中 → 必然失败并消耗重试。');
    log('     有 model_mapping 说明"配置到一半"，可能是并行会话的半成品。');
    log('     ▶ 建议（需人工确认）：置 schedulable=false，或补全 base_url。**本脚本不自动改**。');

    // 影响量化：排序视角 —— 有多少可用账号排在僵尸之后
    const q2 = `WITH live AS (
        SELECT a.id, a.priority,
          CASE WHEN coalesce(a.credentials->>'base_url','')='' THEN false ELSE true END AS has_base
        FROM accounts a
        WHERE a.deleted_at IS NULL AND a.status='active' AND a.schedulable
      )
      SELECT
        (SELECT min(priority) FROM live WHERE NOT has_base) AS first_zombie_prio,
        (SELECT count(*) FROM live WHERE has_base
           AND priority > (SELECT min(priority) FROM live WHERE NOT has_base)) AS working_after;`;
    assertReadOnly(q2, '排序影响');
    const r2 = psql(q2);
    if (!r2.error && r2.length && r2[0][0] !== null) {
      log(`  📊 排序影响：首个僵尸 priority=${r2[0][0]}，其名次之后仍有 **${r2[0][1]} 个可用账号**`);
    }
    // 保护态核查：僵尸是否被系统自动屏蔽
    const q3 = `SELECT count(*) FROM accounts
      WHERE deleted_at IS NULL AND status='active' AND schedulable
        AND coalesce(credentials->>'base_url','')=''
        AND (temp_unschedulable_until IS NOT NULL OR overload_until IS NOT NULL);`;
    assertReadOnly(q3, '僵尸保护态');
    const r3 = psql(q3);
    if (!r3.error && r3.length) {
      log(`  🛡 其中被系统自动屏蔽（temp_unschedulable/overload）的：${r3[0][0]} 个` +
          (r3[0][0] === '0' ? ' → **系统未自动屏蔽，需人工处置**' : ''));
    }
  }
}

/* ---------- 5c. 调度序列实况（直读 Redis zset）----------
 * 这是 PostgreSQL 看不到的一层：调度器真正的选序在 Redis zset 里（score = 位次）。
 * 5b 只能看到"DB 里谁是僵尸"，5c 才能回答"僵尸是否真的占着调度位"。
 */
{
  const zr = readSchedulerZsets();
  if (zr.error) log(`\n## 5c. 调度序列：读取失败（${zr.error}）`);
  else if (!zr.sets.length) log('\n## 5c. 调度序列：未找到非空 zset');
  else {
    // 取最大的那个桶（通常是主分组）
    const main = zr.sets.slice().sort((a, b) => b.size - a.size)[0];
    log(`\n## 5c. 调度序列实况（key=${main.key}，${main.size} 个成员）`);
    log('  > score 即位次（0..N-1）；名字取自 DB');
    // 拉账号名映射
    const nm = {};
    const names = psql(`SELECT id, name, CASE WHEN coalesce(credentials->>'base_url','')='' THEN 'zombie' ELSE 'ok' END FROM accounts WHERE deleted_at IS NULL;`);
    if (Array.isArray(names)) for (const [id, name, kind] of names) nm[id] = { name, kind };
    let firstZombieRank = null;
    const afterZombie = [];
    main.members.forEach((m, i) => {
      const info = nm[m.id] || { name: '?', kind: '?' };
      const isZ = info.kind === 'zombie';
      if (isZ && firstZombieRank === null) firstZombieRank = i + 1;
      if (!isZ && firstZombieRank !== null) afterZombie.push(m.id);
      if (isZ) log(`  位次 ${String(i + 1).padStart(2)} | #${String(m.id).padStart(3)} ${String(info.name).padEnd(20)} ⚠️ **僵尸（无 base_url）**`);
    });
    if (firstZombieRank === null) log('  ✅ 序列中无僵尸账号');
    else {
      log(`  📊 首个僵尸出现在第 **${firstZombieRank}** 位；其之后仍有 ${afterZombie.length} 个可用账号被挡（${afterZombie.slice(0, 8).join(',')}${afterZombie.length > 8 ? '…' : ''}）`);
      log('  🔴 结论：僵尸**确实被纳入调度序列**且名次靠前 —— 选中后必然失败（无上游地址），');
      log('     代价是无效尝试与重试消耗（会 failover 到下一名次，故不降低最终成功率）。');
      log('     ▶ 处置需人工决定：补全 base_url（变可用产能）或置 schedulable=false（移除）。');
    }
  }
}

/* ---------- 5d. 上下文超限：谁接得住长请求、谁接不住 ----------
 * 2026-09-13 取证：agenes(3) 上游上限约 500K，但持续收到 551K~1M 的请求 →
 *   7 天 460 条必然 400。修法应"按上下文上限路由"，而非修账号本身。
 * 此处用**成功请求的 token 天花板**判断各号能力：成功率高的号若 max(input_tokens)
 *   明显低于失败请求的规模，即为"能力边界"而非偶发。
 */
{
  const sql = `SELECT a.id, a.name,
      coalesce(count(u.id),0) AS ok_n,
      coalesce(max(u.input_tokens),0) AS max_ok_tokens,
      coalesce(count(*) FILTER (WHERE u.input_tokens > 500000),0) AS ok_over_500k
    FROM accounts a
    LEFT JOIN usage_logs u ON u.account_id = a.id
      AND u.created_at > now() - interval '7 days'
    WHERE a.deleted_at IS NULL
    GROUP BY a.id, a.name
    HAVING coalesce(count(u.id),0) > 0
    ORDER BY max_ok_tokens DESC;`;
  assertReadOnly(sql, '上下文能力');
  const r = psql(sql);
  if (r.error) log(`⚠️ 上下文能力查询失败：${r.error}`);
  else if (r.length) {
    const over = r.filter((x) => Number(x[4]) > 0);
    const under = r.filter((x) => Number(x[4]) === 0 && Number(x[2]) > 100);
    log(`\n## 5d. 上下文能力画像（7 天 · 按成功请求的 token 天花板排序）`);
    log(`  能吃 >500K 的号：**${over.length} 个** —— ${over.slice(0, 6).map((x) => `#${x[0]}(max ${x[3]})`).join(' · ')}`);
    if (under.length) {
      log(`  ⚠️ 从未成功接过 >500K、但有显著流量的号：${under.map((x) => `#${x[0]} ${x[1]}(max ${x[3]})`).join(' · ')}`);
      log('  🔴 这些号若被派到超长请求 → 必然 400。建议按上下文上限路由（不改账号本身）。');
    }
    log('  > 判据说明：用**成功请求**的 max(input_tokens) 作能力天花板（usage_logs 只记成功请求）');
  }
}

/* ---------- 6. 总体成功率 ---------- */{
  const sql = `SELECT
      (SELECT count(*) FROM usage_logs WHERE created_at > now() - interval '${HOURS} hours') AS ok,
      (SELECT count(*) FROM ops_error_logs WHERE created_at > now() - interval '${HOURS} hours'
         AND upstream_status_code = 400) AS err400;`;
  assertReadOnly(sql, '成功率');
  const r = psql(sql);
  if (!r.error && r.length) {
    const [ok, err] = r[0].map(Number);
    const tot = ok + err;
    log(`\n## 6. 请求质量（${HOURS}h）`);
    log(`  成功 ${ok} · 400 ${err} · **成功率 ${tot ? (100 * ok / tot).toFixed(2) : 'n/a'}%**`);
  }
}

/* ---------- 7. 结论 ---------- */
log('\n' + '='.repeat(72));
log('【如何读这份报告】');
log('  · rate_limited_at 非空 = 该账号曾撞上游限流（池会自动临时停用，属可自愈）');
log('  · reqs=0 且 status=active = 兜底位正常待命（前排健康时不会接单，非故障）');
log('  · status=error 且 24h 有错误 = 真故障，需人工介入');
log('  · status=error 但 24h 无错误 = 多为额度耗尽后的静止态（非持续报错）');
log('  · 400 错误多为客户端请求问题，不等于池故障；注意 error_owner 可能存在误标');
log('');

writeFileSync('D:/tdsh/sub2api/POOL-HEALTH-REPORT.md', sections.join('\n') + '\n');
console.log('报告 → D:/tdsh/sub2api/POOL-HEALTH-REPORT.md');
