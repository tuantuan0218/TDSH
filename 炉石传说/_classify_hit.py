#!/usr/bin/env python3
"""对唯一命中做定性：只输出掩码与形状，绝不印值。"""
import re, os
P = r'D:\MunderDifflin\hive\archived-20260911-supervisor\worker-hs-engine\.pi-agent\sessions\--D--MunderDifflin--\2026-09-09T20-19-57-734Z_01a087d3-c4a5-769d-a8e3-3fe4ee56a1ed.jsonl'
lines = open(P, encoding='utf-8', errors='ignore').read().splitlines()
ln = lines[125]  # 1-based 126
FIELD = re.compile(r"""(?ix)(?<![A-Za-z0-9_])([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PWD|TOKEN|SECRET|APIKEY|API_KEY|KEY))(?![A-Za-z0-9_])\s*[:=]\s*(['"])([A-Za-z0-9_\-]{8,32})\2""")
for m in FIELD.finditer(ln):
    v = m.group(3)
    shape = ''.join('A' if ch.isupper() else ('a' if ch.islower() else ('9' if ch.isdigit() else ch) ) for ch in v)
    print('字段名      :', m.group(1))
    print('值长度      :', len(v))
    print('值形状      :', shape)          # 只给大小写形状，不给字符
    print('是否含数字  :', any(c.isdigit() for c in v))
    print('值前后各 2 字符是否等于常见前后缀:', v[:2].lower() in ('sk', 'gh', 'pt', 'pk'), v[-2:].lower() in ('==', ''), )
s = ln
for m in FIELD.finditer(ln):
    s = s.replace(m.group(3), '*' * len(m.group(3)))
print('\n所在行（值已掩码，截 700 字符）:\n', s[:700])
print('\n该行长度:', len(ln))
