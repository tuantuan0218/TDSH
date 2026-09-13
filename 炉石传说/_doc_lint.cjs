// Markdown 结构自检：代码围栏是否成对、是否有"内容紧跟标题但标题被我当锚点吃掉"的孤儿。
// 用法：node _doc_lint.cjs <md 文件路径> [<第二个> ...]
const fs = require('fs');
for (const p of process.argv.slice(2)) {
  const ls = fs.readFileSync(p, 'utf8').split('\n');
  let open = false, opens = 0, bad = [];
  ls.forEach((l, i) => {
    if (/^```/.test(l)) {
      opens++;
      if (open) { open = false; } else { open = true; bad.push(i + 1); }
    }
  });
  console.log('===', p, '===');
  console.log('围栏标记数:', opens, opens % 2 === 0 ? '(偶数=成对)' : '(奇数=有一处没闭合!)', open ? '*** 最终仍处于打开态 ***' : '最终闭合');
  if (open) console.log('  可疑的 OPEN 位置（最后一个未闭合）:', bad[bad.length - 1]);
  // 标题后紧跟标题 / 标题后紧跟正文却缺标题（启发式：连续两个 fence 之间没有标题但行数异常）
  const heads = ls.map((l, i) => [i + 1, l]).filter(([, l]) => /^#{1,4} /.test(l));
  console.log('标题数:', heads.length);
  const nums = heads.filter(([, l]) => /^#{2,3} \d/.test(l)).map(([, l]) => (l.match(/^#{2,3} (\d+(?:\.\d+\w*)?)/) || [])[1]);
  console.log('章节序列:', nums.join(' → '));
  // 孤儿：正文里出现"表格行/代码块"但上一节标题缺失（用 fence 与标题交替粗查）
  let lastHead = 0;
  ls.forEach((l, i) => {
    if (/^#{1,4} /.test(l)) lastHead = i;
    if (i > 5 && /^\s*$/.test(l) === false && /^(##|###)\s*$/.test(l)) console.log('  !! 空标题在行', i + 1);
  });
}
