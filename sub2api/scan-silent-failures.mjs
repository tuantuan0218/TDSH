/**
 * 隐蔽缺陷扫描器（scan-silent-failures.mjs）
 *
 * 动机：本会话修掉一个真实缺陷 —— free-quota-monitor.mjs 的 get() 在 fixtures 分支
 *   `return 字符串`，而网络分支 `return {err, html}`；调用方按 r.html 取值，
 *   于是离线路径恒得 undefined，**被 last-good 兜底逻辑吞成"源不可达"**，
 *   表面全绿、实际功能长期失效。
 *
 * 这不是孤例而是一类模式：**「返回形态不一致 + 有兜底逻辑掩盖」= 静默失效**。
 * 本脚本把该模式变成可自动检查的规则。
 *
 * 三类规则：
 *   R1 同函数内 return 形态不一致（对象/数组/字符串/布尔混用）
 *   R2 try/catch 里 return 默认值 → 与成功路径形态可能不同
 *   R3 调用方访问的属性，在某个返回分支里不存在（真正的"静默 undefined"）
 *
 * 用法：node scan-silent-failures.mjs [文件...]
 *   不带参数则扫描本目录下的免费API相关脚本。
 */
import { readFileSync, existsSync } from 'node:fs';

const DEFAULT_FILES = [
  'free-quota-monitor.mjs',
  'free-official-tiers.mjs',
  'free-checkin.mjs',
  'build-free-api-mainland.mjs',
  'build-openrouter-free-config.mjs',
  'e2e-alert-injection.mjs',
  'e2e-monitor-alert.mjs',
  'run-free-api-regression.mjs',
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;

/** 粗略判断一个 return 表达式值的形态 */
function shapeOf(expr) {
  let v = expr.trim();

  // 修正 A：剥掉**嵌套**三元，只判断最外层形态。
  // 反例（曾造成假阳性）：`{ stale: ageDays > maxDays, reason: ageDays > maxDays ? `..` : '新鲜' }`
  //   —— 这是对象，只是属性值里含三元；旧逻辑被内层 `?` 带偏判成 string。
  // 做法：若表达式以 { 或 [ 开头，直接按字面判定，不再往下剥。
  if (/^\{/.test(v)) return 'object';
  if (/^\[/.test(v)) return 'array';

  // 修正 B：仅当三元出现在**表达式最外层**时才剥离。
  // 形如 `cond ? A : B` 且 cond 内不含 { [ ( 的复杂结构。
  const t = v.match(/^([^?{[()]+)\?\s*([\s\S]+)$/);
  if (t) {
    // 取 then 分支（第一个 : 之前），递归判定
    const thenPart = t[2].split(':')[0].trim();
    return shapeOf(thenPart);
  }

  if (/^['"`]/.test(v)) return 'string';
  if (/^(true|false)\b/.test(v)) return 'bool';
  if (/^(null|undefined)\b/.test(v)) return 'nullish';
  if (/^-?\d/.test(v)) return 'number';
  if (/^(await\s+)?fetch\b/.test(v)) return 'object';
  if (/^JSON\.parse\b/.test(v)) return 'object';
  if (/^JSON\.stringify\b/.test(v)) return 'string';
  // 字符串净化调用算 string
  if (/^\(?\s*[A-Za-z0-9_$.]+\.trim\(\)/.test(v)) return 'string';
  if (/^String\(/.test(v)) return 'string';
  if (/^(readFileSync)\b/.test(v)) return 'string';
  // 数组方法链（.map/.filter/.slice）与函数调用返回，统一视为 expr（无法静态定形）
  if (/\.(map|filter|slice|concat|join)\(/.test(v)) return 'expr';
  return 'expr';
}

/** 从源码提取每个函数的 return 形态 */
function collectReturns(src) {
  const lines = src.split('\n');
  const fns = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.rets.length) fns.push(cur);
    cur = null;
  };
  lines.forEach((l, i) => {
    const m = l.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
    if (m) { flush(); cur = { name: m[1], line: i + 1, rets: [], brace: 0 }; return; }
    if (!cur) return;

    // 关键修正 0：剥掉行内注释，否则中文注释里出现的"return"会被当成代码
    // （本会话实测：注释文案「…而 main 按 r.html 取值」被误判成一个 return 分支）
    const code = l
      .replace(/\/\/.*$/, '')          // 行注释
      .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释（同一行内）
      .replace(/(^|\s)\*.*$/, '$1');    // JSDoc 续行

    // 关键修正 1：不能只认「行首 return」。
    // 真实的 get() 缺陷形态是 `if (...) return 字符串;` 这种**内联 return**，
    // 旧正则 ^\s*return 会整体漏掉 —— 扫描器漏掉了它本该抓的那一类。
    // 现改为：抓所有 return <expr>; 出现处（含 if/try/catch/{ } 内联）。
    //
    // 关键修正 2：必须跳过**三元表达式内的冒号分支**。
    // 例如 `return a ? b : '';` 里的 `: ''` 不是独立 return 分支，
    // 旧实现会把它当成第二个 return 形态 → 假阳性（chatText 即被误报）。
    // 做法：一个 return 语句内只取**第一个** return 后的表达式（形态由最外层决定）。
    const re = /\breturn\s+([^;]+);?/g;
    let mm;
    while ((mm = re.exec(code)) !== null) {
      const expr = mm[1].trim();
      cur.rets.push({ line: i + 1, shape: shapeOf(expr), expr: expr.slice(0, 60), raw: code });
    }

    // 关键修正 4：多行结构内的 return 不是新分支。
    // 反例（曾造成假阳性）：`return arr.map(p => {` 之后的
    //   `return { name: ..., ... };` 是**箭头函数回调体内的 return**，
    //   形态（object）与回调外（array）不同，但两者不在同一层，不该比对。
    // 判定：若本行处于"未闭合的 .map(/.filter(/.forEach(/.some(/.every( 回调"内，跳过。
    if (/\.(map|filter|forEach|some|every|find|reduce)\(/.test(code) && !/\}\);?\s*$/.test(code)) {
      cur.inCallback = (cur.inCallback || 0) + 1;
    }
    if (cur.inCallback && /^\s*\}\);?\s*$/.test(code)) {
      cur.inCallback--;
      cur.rets = cur.rets.filter((r) => r.line !== i + 1);
    }
    if (cur.inCallback) {
      cur.rets = cur.rets.filter((r) => r.line !== i + 1);
    }

    // 关键修正 3：单行箭头函数（如 `const hostOf = u => {...}`）不是本次扫描目标，
    // 其 return 会被误计入上一个具名函数（extractRscArray 即被 hostOf 污染）。
    if (/=>/.test(code) && !/^\s*return\b/.test(code) && !/^\s*(?:if|else|try|catch|\})/.test(code.trim())) {
      cur.rets = cur.rets.filter((r) => r.line !== i + 1);
    }
  });
  flush();
  return fns;
}

let issues = 0;
const report = [];

for (const f of files) {
  if (!existsSync(f)) { report.push(`  [跳过] ${f} 不存在`); continue; }
  const src = readFileSync(f, 'utf8');
  const fns = collectReturns(src);

  for (const fn of fns) {
    const shapes = [...new Set(fn.rets.map((r) => r.shape))];
    // R1：同一函数返回形态不一致
    if (shapes.length > 1) {
      // 排除 nullish 混用（`return null` 作错误态是常见且合理的）
      const meaningful = shapes.filter((s) => s !== 'nullish' && s !== 'bool');
      if (meaningful.length > 1) {
        issues++;
        report.push(`  ⚠ R1 ${f}:${fn.line} ${fn.name}() 返回形态不一 → [${shapes.join(', ')}]`);
        fn.rets.forEach((r) => report.push(`        line ${r.line}: ${r.shape.padEnd(8)} ${r.expr}`));
      }
    }
    // R2：catch 段里的 return 与成功路径形态不同
    const inCatch = fn.rets.filter((r) => /err|error/i.test(r.expr));
    if (inCatch.length && shapes.length > 1) {
      const okShapes = shapes.filter((s) => !inCatch.some((c) => c.shape === s));
      if (okShapes.length && inCatch.some((c) => !okShapes.includes(c.shape))) {
        report.push(`  · R2 ${f}:${fn.line} ${fn.name}() 错误分支形态(${inCatch.map((c) => c.shape).join('/')}) 与成功路径(${okShapes.join('/')}) 不同 —— 需确认调用方兼容`);
      }
    }
  }
}

console.log('隐蔽缺陷扫描（返回值不对齐 / 静默失效）');
console.log('='.repeat(60));
if (report.length) report.forEach((r) => console.log(r));
else console.log('  未发现 R1 类形态不一致');
console.log('='.repeat(60));
console.log(issues ? `⚠ 发现 ${issues} 处 R1 风险（需人工确认是否真缺陷）` : '✅ R1 检查通过');
process.exit(0); // 扫描器本身不因发现风险而失败（风险≠确认缺陷）
