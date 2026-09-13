// 回放验证：把补丁 #2 的 transcript.ts（从 patched 副本加载，绝不碰 src）对着**真实盘上数据**跑，
// 断言两件事：① pi 席位能读到用量（不再全 0）；② 按 newestOnly 作用域读，绝不相加席位自己的历史。
// 用法：node _verify_pi_usage_replay.cjs   （需先跑过 _verify_patch_typecheck.cjs 以生成 D:/tmp_ts/tel/{pristine,patched}）
const fs = require('fs'), path = require('path'), cp = require('child_process');
const COPIES = { patched: 'D:/tmp_ts/tel/patched', pristine: 'D:/tmp_ts/tel/pristine' };
const HIVED = 'D:/MunderDifflin/hive/agents';
const REG = JSON.parse(fs.readFileSync('D:/MunderDifflin/hive/registry.json', 'utf8'));

// 基线（13:19 由 _probe_pi_usage_scoping.cjs 独立测得，与本脚本用不同实现，故可作对照）
const BASELINE = {
  'god': { dirIn: 83010259, newestIn: 2838055 },
  'ryan-mtvy0jjp': { dirIn: 23659886, newestIn: 0 },
  'creed-mtvy2us1': { dirIn: 4080224, newestIn: 0 },
  'kevin-mtvy14qr': { dirIn: 13571642, newestIn: 814902 }
};

function loadTs(copyRoot, rel) {
  // 复用仓内自带的 TS 加载器（单测同源），它相对 copyRoot 解析 'src/...'
  const loader = path.join(copyRoot, 'test', 'load-ts.cjs');
  if (!fs.existsSync(loader)) throw new Error('缺 load-ts.cjs: ' + loader);
  delete require.cache[require.resolve(loader)];
  const l = require(loader);
  return { mod: l(rel, copyRoot), loader };
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '   ' + detail : ''));
  ok ? pass++ : fail++;
}

console.log('=== 负路径：pristine 副本（未打补丁）应当读不到 pi 用量 ===');
try {
  const { mod: T0 } = loadTs(COPIES.pristine, 'src/main/transcript.ts');
  const home = path.join(HIVED, 'god', '.pi-agent');
  const r = T0.readAgentUsage(REG.agents.god.cwd, { agentHomeDir: home, newestOnly: true });
  check('pristine 忽略 agentHomeDir（结果应为 0，因为它不认识 pi 根）',
    r.inputTokens === 0, 'inputTokens=' + r.inputTokens);
} catch (e) { console.log('  (pristine 加载失败：' + e.message + ')'); }

console.log('\n=== 正路径：patched 副本 ===');
const { mod: T } = loadTs(COPIES.patched, 'src/main/transcript.ts');
check('导出 piProjectKey', typeof T.piProjectKey === 'function');
check('键规则实测标定：--D--MunderDifflin--',
  T.piProjectKey('D:\\MunderDifflin') === '--D--MunderDifflin--', 'got=' + T.piProjectKey('D:\\MunderDifflin'));
check('键规则对 worktree cwd 也成立',
  T.piProjectKey('D:\\MunderDifflin\\worktrees\\ryan-mtvy0jjp') === '--D--MunderDifflin-worktrees-ryan-mtvy0jjp--');

/** 独立实现（不走被测代码）：按 mtime 取该根最新一场会话文件，逐条累加 pi 用量。
 *  ⚠️ 基线必须与"被测口径"同定义：第一版拿 13:19 的"记录时间戳最大那场"当基线，
 *  而 newestOnly 按 **mtime 最新那场** 取——god 在 13:26:35 开了新会话，两个定义
 *  指向不同文件，于是报出一个 10x 的假失败。口径不一致的对照比没有对照更坏。 */
function sumNewestByMtime(home, cwd) {
  const dir = path.join(home, 'sessions', '--' + cwd.replace(/[^a-zA-Z0-9]/g, '-') + '--');
  if (!fs.existsSync(dir)) return { file: null, input: 0 };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  const top = files[0];
  if (!top) return { file: null, input: 0 };
  let input = 0;
  for (const l of fs.readFileSync(path.join(dir, top.f), 'utf8').split('\n')) {
    let o; try { o = JSON.parse(l); } catch (e) { continue; }
    const m = o.message;
    if ((o.type === 'assistant' || (o.type === 'message' && m && m.role === 'assistant')) && m && m.usage) {
      input += Number(m.usage.input ?? m.usage.input_tokens ?? 0) || 0;
    }
  }
  return { file: top.f, input, dirSumApprox: files.length };
}

for (const id of ['god', 'ryan-mtvy0jjp', 'creed-mtvy2us1', 'kevin-mtvy14qr']) {
  const base = BASELINE[id];
  const cwd = REG.agents[id].cwd;
  const home = path.join(HIVED, id, '.pi-agent');
  const scoped = T.readAgentUsage(cwd, { agentHomeDir: home, newestOnly: true });
  const unscoped = T.readAgentUsage(cwd, { agentHomeDir: home });
  const indep = sumNewestByMtime(home, cwd);
  console.log(`\n席位 ${id}  被测 newestOnly in=${scoped.inputTokens.toLocaleString()} | 独立复算(同口径) in=${indep.input.toLocaleString()} [${indep.file ? indep.file.slice(0, 30) : 'n/a'}]`);
  console.log(`  目录级(不设 newestOnly) in=${unscoped.inputTokens.toLocaleString()}  ← 13:19 历史基线 ${base.dirIn.toLocaleString()}（会话在长，只作量级参照）`);
  check('被测值 == 独立复算值（口径一致，精确相等）', scoped.inputTokens === indep.input,
    `${scoped.inputTokens.toLocaleString()} vs ${indep.input.toLocaleString()}`);
  if (indep.input === 0) {
    check('零调用席位不得被虚高：newestOnly=0 而目录级有几百万', scoped.inputTokens === 0 && unscoped.inputTokens > 1e6,
      `若不隔离即 ${(unscoped.inputTokens || 1).toLocaleString()} 虚高`);
  } else {
    check('目录级明显大于单场（证明 newestOnly 真在收窄，不是碰巧相等）',
      unscoped.inputTokens > scoped.inputTokens * 1.5,
      `${unscoped.inputTokens.toLocaleString()} / ${scoped.inputTokens.toLocaleString()} = ${(unscoped.inputTokens / scoped.inputTokens).toFixed(1)}x`);
  }
}


console.log(`\n=== 回放结论: PASS=${pass} FAIL=${fail} ===`);
process.exit(fail ? 1 : 0);
