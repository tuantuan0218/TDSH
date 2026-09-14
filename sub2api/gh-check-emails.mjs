// 检查邮箱是否已被 GitHub 占用（signup_check 端点）
const emails = process.argv.slice(2);
for (const e of emails) {
  try {
    const r = await fetch('https://github.com/signup_check/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' },
      body: JSON.stringify({ value: e }),
    });
    const t = await r.text();
    console.log(e, '->', r.status, t.slice(0, 200));
  } catch (err) {
    console.log(e, 'ERR', err.message);
  }
}
