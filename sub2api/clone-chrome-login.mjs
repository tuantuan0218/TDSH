// 从影副本直接流式复制文件（FileStream 读写，绕开 Copy-Item 的 \\?\ 路径限制）
const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
const fs = await import('node:fs');
const S3 = '\\\\?\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy3\\Chrome\\UserData';
const DST = 'H:\\ChromeLoginClone';
mkdirSync(DST + '\\Default\\Network', { recursive: true });
const files = [
  ['Local State', DST + '\\Local State'],
  ['Default\\Network\\Cookies', DST + '\\Default\\Network\\Cookies'],
  ['Default\\Preferences', DST + '\\Default\\Preferences'],
  ['Default\\Login Data', DST + '\\Default\\Login Data'],
];
for (const [rel, dst] of files) {
  const src = S3 + '\\' + rel;
  try {
    const buf = readFileSync(src);
    writeFileSync(dst, buf);
    console.log('OK:', rel, buf.length, 'bytes ->', dst);
  } catch (e) { console.log('FAIL:', rel, e.message.slice(0, 80)); }
}
// 验证
for (const [rel] of files) {
  const dst = DST + (rel === 'Local State' ? '\\Local State' : '\\' + rel);
  try { const st = fs.statSync(dst); console.log('  verify:', rel, st.size); } catch { console.log('  MISSING:', rel); }
}