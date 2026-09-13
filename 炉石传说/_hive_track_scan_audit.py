#!/usr/bin/env python3
"""审计 hive 仓的版本控制面：哪些"会话转录"被 git 跟踪？命中行只做掩码显示，绝不印值。
只读。用法：python _hive_track_scan_audit.py"""
import subprocess, re, os, collections, sys

REPO = sys.argv[1] if len(sys.argv) > 1 else r'D:\MunderDifflin\hive'
os.chdir(REPO)
print('扫描目标:', REPO)
files = [p for p in subprocess.run(['git', 'ls-files', '-z'], capture_output=True).stdout.decode('utf-8', errors='ignore').split('\0') if p]
tr = [f for f in files if '/.pi-agent/sessions/' in f.replace(os.sep, '/')]
print('git 跟踪文件总数 :', len(files))
print('其中会话转录 jsonl :', len(tr))
c = collections.Counter(f.split('/.pi-agent/')[0] for f in tr)
print('按顶层目录分布    :', ', '.join(f'{k}={v}' for k, v in c.most_common()))
size = sum(os.path.getsize(os.path.join(REPO, f)) for f in tr if os.path.exists(os.path.join(REPO, f)))
print(f'转录合计体积      : {size/1048576:.1f} MiB')

FIELD = re.compile(r"""(?ix)(?<![A-Za-z0-9_])([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PWD|TOKEN|SECRET|APIKEY|API_KEY|KEY))(?![A-Za-z0-9_])\s*[:=]\s*(['"])([A-Za-z0-9_\-]{8,32})\2""")
PLACEHOLDER = re.compile(r'(?i)^(your|xxx|todo|changeme|none|null|example|dummy|test|redacted|replaced|masked)')
ENVISH = re.compile(r'(?i)environ|getenv|configparser|os\.get|example|your_|placeholder|xxx|<.*>|\{\{|%s')

print('\n--- 转录与文档里的"赋值型"疑似凭据（掩码，只给字段名/长度/字符类别）---')
# 扩展名白名单是错的判据（对照台第一次就抓到：a.py/c.py 是 .py，被白名单漏掉→恒 0 的假绿）。
# 改成"排除二进制"，与 cred_scan.py 同口径。
BIN = re.compile(r'\.(png|jpg|jpeg|gif|webp|zip|gz|ttf|so|dll|pyc|wav|mid|midi|mp3|bin|lock|exe|ico|pdf)$', re.I)
targets = []
for f in files:
    if BIN.search(f):
        continue
    if '/.pi-agent/sessions/' in f.replace(os.sep, '/') or f.endswith(('.md', '.json', '.ts', '.js', '.cjs', '.ps1', '.py', '.yaml', '.yml', '.txt', '.cjs')):
        targets.append(f)
print(f'扫描文本文件 {len(targets)} 个（含转录 {len(tr)} 个），二进制按扩展名排除')
n_real = n_ph = 0
for f in targets:
    try:
        text = open(f, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    for i, ln in enumerate(text.splitlines(), 1):
        if ENVISH.search(ln):
            continue
        for m in FIELD.finditer(ln):
            v = m.group(3)
            cats = [c for ok, c in ((re.search(r'[a-z]', v), 'lc'), (re.search(r'[A-Z]', v), 'uc'),
                                    (re.search(r'[0-9]', v), 'dg'), ('_' in v, 'us'), ('-' in v, 'hy')) if ok]
            ph = bool(PLACEHOLDER.match(v))
            n_ph += 1 if ph else 0
            n_real += 0 if ph else 1
            print(f'   [{"占位形态" if ph else "真值形态"}] {f[:70]}:{i} 字段={m.group(1)} 值长={len(v)} 指纹={"+".join(cats)} 掩码={"*" * len(v)}')
print(f'\n口径分开报（AGENTS.md §8 第 9 条）：真值形态 {n_real} 处 | 占位形态 {n_ph} 处')
print('阳性对照：见 D:\\tmp_ts\\ctlrepo（a.py 应命中 1、b.py credentials:"include" 应 0、c.py REDACTED 应计入占位形态）')
