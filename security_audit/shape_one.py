#!/usr/bin/env python3
"""按仓分批的形状判定：先 git grep -l 拿含字段名的文件（1 次），再 git show 只读这些文件（少量）。
上一版对 9 个仓各做一次全树 grep → 600s 超时。本版把开销降为「字段名命中的文件数」级别。
绝不输出值，只输出长度/字符类别/是否占位词。"""
import subprocess, re, os, sys

def wp(p):
    m = re.match(r"^([A-Za-z]):[/\\](.*)$", p)
    return f"/mnt/{m.group(1).lower()}/{m.group(2).replace(chr(92),'/')}" if m else p

GET = re.compile(r"""(?i)([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PWD|TOKEN|SECRET|KEY|CREDENTIAL)[A-Za-z0-9_]{0,8})"""
                r"""\s*[:=]\s*['"]([A-Za-z0-9_\-]{6,40})['"]""")
PLACE = re.compile(r"(?i)^(redacted|replaced|removed|masked|deleted|erased|your|my|example|xxx|placeholder|dummy|test|sk-|fake)")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|invalid|os\.get|import os")
FLD = 'SENDER' + '_AUTH'

def cls(v):
    c = []
    if re.search(r"[a-z]", v): c.append("小写")
    if re.search(r"[A-Z]", v): c.append("大写")
    if re.search(r"[0-9]", v): c.append("数字")
    if "_" in v: c.append("下划线")
    if "-" in v: c.append("连字符")
    return "+".join(c) or "其他"

def run(repo, *a, t=180):
    try:
        return subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True,
                              errors="ignore", timeout=t).stdout
    except Exception:
        return ""

repo = wp(sys.argv[1])
print(f"### {repo}")
if not os.path.exists(os.path.join(repo, ".git")):
    print("  SKIP 非仓（跳过 ≠ 干净）"); sys.exit(0)
files = [f for f in run(repo, "grep", "-l", "-I", "-i", FLD, "HEAD").splitlines() if f.strip()]
# 输出形如 "HEAD:path"（-l 只有两段），中文路径可能被转义成八进制 → 用 -z 取原始字节更稳，这里做兜底
paths = sorted({(f.split(":", 1)[1] if ":" in f else f) for f in files})
paths = [p for p in paths if p and not p.startswith("fatal")]
print(f"  含字段名的 HEAD 文件数 = {len(paths)}")
real = ph = amb = 0
for p in paths[:40]:
    txt = run(repo, "show", f"HEAD:{p}")
    for ln in txt.splitlines():
        if ENVISH.search(ln):
            continue
        for m in GET.finditer(ln):
            v = m.group(2)
            if PLACE.match(v):
                ph += 1; kind = "占位符"
            elif len(v) <= 20 and not re.search(r"[A-Z_]", v):
                real += 1; kind = "●真值形态"
            else:
                amb += 1; kind = "○需判读"
            if kind != "占位符":
                print(f"    {kind:<10} 字段={m.group(1):<18} 值长={len(v):<3} {cls(v):<16} …{p[-46:]}")
print(f"  === 汇总：真值形态={real} 占位符={ph} 需判读={amb} ===")
if not paths:
    print("  （无字段名命中 → 该仓此项干净）")
