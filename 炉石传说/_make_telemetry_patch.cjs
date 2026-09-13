// 补丁 #2：让 pi 席位的 usage 被 fleet 读到（fleet 仪表不再空转）。
// 只读源文件 → 临时副本上锚点替换 → git diff --no-index 产出 .patch。绝不改 D:\MunderDifflin\src。
// 用法：node _make_telemetry_patch.cjs
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = 'D:/MunderDifflin';
const WORK = 'D:/tdsh/炉石传说/_standup_patch/tel';
const FILES = ['src/main/transcript.ts', 'src/main/telemetry.ts', 'src/main/hive.ts', 'src/main/index.ts'];

for (const sub of ['a', 'b']) {
  fs.rmSync(path.join(WORK, sub), { recursive: true, force: true });
  for (const f of FILES) {
    fs.mkdirSync(path.join(WORK, sub, path.dirname(f)), { recursive: true });
    fs.copyFileSync(path.join(SRC, f), path.join(WORK, sub, f));
  }
}

const H = [];
/* ═══════════════ transcript.ts ═══════════════ */
H.push(['src/main/transcript.ts',
`function projectKey(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}`,
`function projectKey(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/** Pi (earendil-works) spells the same key but wraps it in a dash on each side,
 *  and writes under a PER-AGENT home instead of ~/.claude:
 *    <agentHome>/sessions/<piProjectKey(cwd)>/<isoTs>_<uuid>.jsonl
 *  Calibrated on live data (7/7 seats, 5 distinct cwds):
 *    D:/MunderDifflin -> --D--MunderDifflin--
 *  A near-miss here is invisible: callers read an absent directory as "no
 *  transcripts yet" and publish zeros — which is how fleet.json came to show
 *  tokens=0 / lastActiveSecAgo=null for a fleet that was working (2026-09-13).
 *  So piProjectDir WARNS once per missing root instead of returning quietly:
 *  "no such directory" and "no activity" are different facts. */
export function piProjectKey(cwd: string): string {
  return '--' + projectKey(cwd) + '--';
}

const piMissingWarned = new Set<string>();

export function piProjectDir(agentHomeDir: string, cwd: string): string | null {
  const dir = path.join(agentHomeDir, 'sessions', piProjectKey(cwd));
  if (existsSync(dir)) return dir;
  if (!piMissingWarned.has(dir)) {
    piMissingWarned.add(dir);
    console.warn('[transcript] pi 转录根不存在:', dir, '(cwd=', cwd, ')');
  }
  return null;
}

/** Pi carries the session identity in the FILE NAME, not in the records, so
 *  per-session scoping has to come from the name. */
function piSessionIdOf(file: string): string | undefined {
  const m = /_([0-9a-fA-F-]{20,40})[.]jsonl$/.exec(file);
  return m ? m[1] : undefined;
}`]);

H.push(['src/main/transcript.ts',
`  sessionId?: string;
}`,
`  sessionId?: string;
  /** provider 感知（pi）：该席位的 PI_CODING_AGENT_DIR（…/agents/<id>/.pi-agent）。
   *  给了它才额外扫 pi 的转录根；不给则行为与今天完全一致。 */
  agentHomeDir?: string;
  /** 只统计 mtime 最新的那一个会话文件。这是 pi 侧唯一能把"这一席这一场"与
   *  "该席全部历史（或其他席串线进来的场次）"分开的判据。实测按目录求和虚高
   *  16.7x–126.4x（ryan/creed 因真零调用场次虚高到 2.4e6x）。 */
  newestOnly?: boolean;
}`]);

H.push(['src/main/transcript.ts',
`function parseUsageLines(text: string, entry: FileUsageEntry): void {`,
`/** Claude: type:'assistant' + input_tokens/output_tokens/cache_*.
 *  Pi:     type:'message' + message.role:'assistant' + input/output/cacheRead/cacheWrite.
 *  Both shapes must be accepted, or a pi transcript parses to all-zero — which is
 *  harder to notice than a missing file, because it looks like a quiet agent. */
function isUsageRecord(rec: { type?: unknown; message?: { role?: unknown; usage?: unknown } }): boolean {
  if (rec.type !== 'assistant' && rec.type !== 'message') return false;
  const msg = rec.message;
  if (!msg || !msg.usage) return false;
  if (rec.type === 'message' && msg.role !== 'assistant') return false;
  return true;
}

function parseUsageLines(text: string, entry: FileUsageEntry, fileSessionId?: string): void {`]);

H.push(['src/main/transcript.ts',
`    if (rec.type !== 'assistant') continue;
    const u = rec.message?.usage;
    if (!u) continue;`,
`    if (!isUsageRecord(rec)) continue;
    const u = rec.message?.usage;
    if (!u) continue;`]);

H.push(['src/main/transcript.ts',
`    const rIn = num(u.input_tokens);
    const rOut = num(u.output_tokens);
    const rCacheWrite = num(u.cache_creation_input_tokens);
    const rCacheRead = num(u.cache_read_input_tokens);`,
`    const rIn = num(u.input_tokens ?? u.input);
    const rOut = num(u.output_tokens ?? u.output);
    const rCacheWrite = num(u.cache_creation_input_tokens ?? u.cacheWrite);
    const rCacheRead = num(u.cache_read_input_tokens ?? u.cacheRead);`]);

H.push(['src/main/transcript.ts',
`    if (typeof rec.sessionId === 'string' && rec.sessionId) {
      let bucket = entry.perSession.get(rec.sessionId);
      if (!bucket) {
        bucket = zero();
        entry.perSession.set(rec.sessionId, bucket);
      }`,
`    const sid = typeof rec.sessionId === 'string' && rec.sessionId ? rec.sessionId : fileSessionId;
    if (sid) {
      let bucket = entry.perSession.get(sid);
      if (!bucket) {
        bucket = zero();
        entry.perSession.set(sid, bucket);
      }`]);

H.push(['src/main/transcript.ts',
`          parseUsageLines(complete, entry);`,
`          parseUsageLines(complete, entry, piSessionIdOf(file));`]);

H.push(['src/main/transcript.ts',
`    const dir = projectDir(cwd);
    if (!existsSync(dir)) return usage;
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    let lastModel: string | undefined;
    for (const file of files) {
      const entry = readFileUsage(dir, file);
      if (!entry) continue;
      const totals = opts.sessionId ? entry.perSession.get(opts.sessionId) : entry.all;
      if (!totals) continue;
      usage.inputTokens += totals.inputTokens;
      usage.outputTokens += totals.outputTokens;
      usage.cacheWriteTokens += totals.cacheWriteTokens;
      usage.cacheReadTokens += totals.cacheReadTokens;
      usage.estimatedCostUsd += totals.estimatedCostUsd;
      if (totals.model) lastModel = totals.model;
    }`,
`    // 转录根：Claude 的 ~/.claude/projects/<key>，外加（给了 agentHomeDir 时）pi 的
    // <home>/sessions/--key--。逐根独立累加，绝不跨根混合求和。
    const roots: string[] = [];
    const cdir = projectDir(cwd);
    if (existsSync(cdir)) roots.push(cdir);
    if (opts.agentHomeDir) {
      const pdir = piProjectDir(opts.agentHomeDir, cwd);
      if (pdir) roots.push(pdir);
    }
    if (!roots.length) return usage;
    let lastModel: string | undefined;
    for (const dir of roots) {
      let files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
      // newestOnly：只取该根下 mtime 最新的一场会话。按目录求和会把席位自己的历史
      // 算成当前用量（2026-09-13 实测虚高 16.7x–126.4x，零调用席位达 2.4e6x），
      // 而虚高会驱动断路器与 token 帽做错误裁决 —— 比"全 0"更危险。
      if (opts.newestOnly) {
        files = files
          .map((f) => ({ f, m: (() => { try { return statSync(path.join(dir, f)).mtimeMs; } catch (e) { return 0; } })() }))
          .sort((a, b) => b.m - a.m)
          .slice(0, 1)
          .map((x) => x.f);
      }
      for (const file of files) {
        const entry = readFileUsage(dir, file);
        if (!entry) continue;
        const totals = opts.sessionId ? entry.perSession.get(opts.sessionId) : (opts.newestOnly ? entry.perSession.get(piSessionIdOf(file) ?? '') : entry.all);
        if (!totals) continue;
        usage.inputTokens += totals.inputTokens;
        usage.outputTokens += totals.outputTokens;
        usage.cacheWriteTokens += totals.cacheWriteTokens;
        usage.cacheReadTokens += totals.cacheReadTokens;
        usage.estimatedCostUsd += totals.estimatedCostUsd;
        if (totals.model) lastModel = totals.model;
      }
    }`]);

/* ═══════════════ telemetry.ts ═══════════════ */
H.push(['src/main/telemetry.ts',
`  resolveSessionId?: (agentId: string) => string | undefined;
}`,
`  resolveSessionId?: (agentId: string) => string | undefined;
  /** Resolve an agent's PI_CODING_AGENT_DIR (…/agents/<id>/.pi-agent) so the
   *  fallback can read pi transcripts, which do not live under ~/.claude at all.
   *  Optional: absent ⇒ pi seats keep reporting "no data" exactly as today. */
  resolveAgentHome?: (agentId: string) => string | null;
}`]);

H.push(['src/main/telemetry.ts',
`  private readonly resolveSessionId?: (agentId: string) => string | undefined;`,
`  private readonly resolveSessionId?: (agentId: string) => string | undefined;
  private readonly resolveAgentHome?: (agentId: string) => string | null;`]);

H.push(['src/main/telemetry.ts',
`    this.resolveSessionId = opts.resolveSessionId;`,
`    this.resolveSessionId = opts.resolveSessionId;
    this.resolveAgentHome = opts.resolveAgentHome;`]);

H.push(['src/main/telemetry.ts',
`    const sessionId = this.resolveSessionId?.(agentId);
    if (!sessionId) return null;
    const u = readAgentUsage(cwd, { sessionId });`,
`    const sessionId = this.resolveSessionId?.(agentId);
    const agentHomeDir = this.resolveAgentHome?.(agentId) ?? undefined;
    // Claude 路径维持 D11 的严格语义：没有会话身份就报"无数据"，绝不退化成求和。
    // pi 路径不一样：会话身份在文件名里，所以按"最新一场"作用域读是安全的，
    // 也是今天唯一能让 fleet 不再全 0 的读法。
    if (!sessionId && !agentHomeDir) return null;
    const u = readAgentUsage(cwd, sessionId ? { sessionId } : { agentHomeDir, newestOnly: true });`]);

/* ═══════════════ index.ts ═══════════════ */
H.push(['src/main/index.ts',
`  resolveSessionId: (agentId) => hive.lastSession(agentId)
});`,
`  resolveSessionId: (agentId) => hive.lastSession(agentId),
  // pi 席位的转录在 agents/<id>/.pi-agent/sessions/<key>/ 下，不在 ~/.claude。
  // 不接这一根，fleet.json 的 tokens/lastTool/lastActiveSecAgo 就永远是常量。
  resolveAgentHome: (agentId) => hive.piAgentHome(agentId)
});`]);

/* ═══════════════ index.ts (2/2) ═══════════════
 * ⚠️ 这一 hunk 是自查后补的：`snapshot()` 只遍历 `agentSessions`（OTel-live 会话），
 * 从不走 transcriptFallback；而 writeFleetSnapshot 读的正是 snapshot()。所以只补转录根
 * 与 newestOnly 是不够的——fleet.json 依然全 0。必须让快照也问一次 usage provider
 * （它内部才有"OTel 优先、转录兜底"的完整语义）。 */
H.push(['src/main/index.ts',
`        const u = usageById.get(id);
        const spans = snap.spans[id] ?? [];`,
`        // OTel 没有这一席的活体 → snapshot() 给不出 usage；这里补问一次 usageProvider，
        // 它内部才有"OTel 优先 → 转录兜底"的完整语义。fleet.json 的全部病灶就在这一行。
        const u = usageById.get(id) ?? usageProvider.getAgentUsage(id) ?? undefined;
        const spans = snap.spans[id] ?? [];`]);

/* ═══════════════ index.ts (3/3) — 同一个洞的第二处（IPC 视图） ═══════════════ */
H.push(['src/main/index.ts',
`    const u = usageById.get(id);
    const spans = snap.spans[id] ?? [];`,
`    // 与 writeFleetSnapshot 同源的问题：agentDirectory 也只读 snapshot()。
    // 兜底读的是带缓存的增量转录（usageCache），与 breaker beat 每拍同价，不新增量级。
    const u = usageById.get(id) ?? usageProvider.getAgentUsage(id) ?? undefined;
    const spans = snap.spans[id] ?? [];`]);

/* ═══════════════ hive.ts ═══════════════ */
H.push(['src/main/hive.ts',
`  private agentDir(id: string): string {
    return join(this.root()!, 'agents', id);
  }`,
`  private agentDir(id: string): string {
    return join(this.root()!, 'agents', id);
  }
  /** Public per-agent PI_CODING_AGENT_DIR (…/agents/<id>/.pi-agent) for the usage
   *  fallback. Deliberately a separate accessor: agentDir() stays private so no
   *  caller can write through it by accident. */
  piAgentHome(id: string): string | null {
    if (!this.root()) return null;
    const dir = join(this.agentDir(id), '.pi-agent');
    return existsSync(dir) ? dir : null;
  }`]);

let applied = 0; const failed = [];
for (const [f, find, repl] of H) {
  const p = path.join(WORK, 'b', f);
  const s = fs.readFileSync(p, 'utf8');
  if (!s.includes(find)) { failed.push(f + ' :: NOT FOUND :: ' + find.split('\n')[0].slice(0, 70)); continue; }
  const n = s.split(find).length - 2;
  if (n > 1) { failed.push(f + ' :: ambiguous (' + n + 'x) :: ' + find.split('\n')[0].slice(0, 70)); continue; }
  fs.writeFileSync(p, s.replace(find, repl), 'utf8');
  applied++;
}
console.log('hunks applied:', applied, '/', H.length);
if (failed.length) { console.log('FAILED anchors:\n  ' + failed.join('\n  ')); process.exit(2); }

const out = path.join(WORK, 'fleet-telemetry-pi.patch');
let d = '';
try { d = cp.execSync('git diff --no-index --unified=3 a b', { cwd: WORK, maxBuffer: 64e6 }).toString(); }
catch (e) { d = (e.stdout || '').toString(); if (!d.trim()) { console.log('git diff failed:', e.message); process.exit(3); } }
if (!d.trim()) { console.log('EMPTY DIFF'); process.exit(3); }
// git 用字面目录名当缀（a/a/src…、b/b/src…）→ 收成 a/ b/，让 `git apply -p1` 在仓根直接可用
d = d.replace(/diff --git a\/a\/ b\/b\//g, 'diff --git a/ b/')
  .replace(/^--- a\/a\//gm, '--- a/')
  .replace(/^\+\+\+ b\/b\//gm, '+++ b/')
  .replace(/a\/a\/src\/main/g, 'a/src/main').replace(/b\/b\/src\/main/g, 'b/src/main');
if (/a\/a\/|b\/b\//.test(d)) { console.log('PATH REWRITE INCOMPLETE'); process.exit(4); }
fs.writeFileSync(out, d, 'utf8');
console.log('patch:', out, d.length, 'bytes');
console.log(d.split('\n').filter((l) => /^(diff|@@)/.test(l)).join('\n'));
