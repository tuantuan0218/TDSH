#!/usr/bin/env python3
"""
只读诊断：报告某文件里"疑似凭据赋值"的【字段名 + 值的字符长度 + 字符类别指纹】，
绝不输出值本身。用于验证"HEAD 是否仍含明文"的断言，而不制造第二次泄漏。
"""
import re, sys, os

FIELD = re.compile(r"""(?ix)
    \b([A-Z0-9_]{0,28}(?:AUTH|PASS|PASSWORD|PWD|TOKEN|SECRET|KEY|CREDENTIAL))\b
    \s*[:=]\s*
    (['"])([^'"\n]{4,})\2         # 引号包裹的字面量右值
""")
ENVFORM = re.compile(r"(?i)environ|getenv|configparser|\.read\(|input\(")

def fingerprint(v):
    cls = set()
    if re.search(r"[a-z]", v): cls.add("lc")
    if re.search(r"[A-Z]", v): cls.add("uc")
    if re.search(r"[0-9]", v): cls.add("dg")
    if re.search(r"[_\-]", v): cls.add("sy")
    return "+".join(sorted(cls)) or "other"

def scan(path):
    try:
        lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
    except Exception as e:
        print(f"    [ERR] {path}: {e}"); return 0
    n = 0
    for i, ln in enumerate(lines, 1):
        for m in FIELD.finditer(ln):
            name, _q, val = m.group(1), m.group(2), m.group(3)
            if ENVFORM.search(ln):   # 注入形态不算泄漏
                continue
            n += 1
            print(f"    L{i:<5} {name:<22} 值长度={len(val):<3} 指纹={fingerprint(val)}  【值已掩码】")
    return n

if __name__ == "__main__":
    total = 0
    for p in sys.argv[1:]:
        print(f"--- {p} ---")
        if os.path.isdir(p):
            continue
        total += scan(p)
    print(f"=== 合计疑似明文赋值 = {total} 处（0 = 该文件不含赋值型明文）===")
