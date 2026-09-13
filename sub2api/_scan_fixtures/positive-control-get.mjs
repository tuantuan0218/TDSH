// 阳性对照：复刻 get() 真实缺陷形态（内联 return，应被抓到）
export async function get(key, useFixtures) {
  if (useFixtures && existsSync(key)) return 'plain-string';
  try {
    return { err: null, html: 'a' };
  } catch (e) { return { err: String(e), html: '' }; }
}

// 阴性对照 1：形态一致，不应报警
export async function goodFn(x) {
  if (x) return { err: null, html: 'a' };
  return { err: 'no', html: '' };
}

// 阴性对照 2：三元返回（形态一致），不应被误报
function ternaryFn(body) {
  try { const c = JSON.parse(body); return typeof c === 'string' ? c.trim() : (c ? String(c) : ''); } catch { return ''; }
}

// 阴性对照 3：单行箭头函数不应污染上一个具名函数
export function realFn(html, key) {
  if (!html) return null;
  return JSON.parse(html);
}
const hostOf = u => { try { return u ? new URL(u).hostname : null; } catch { return null; } };
