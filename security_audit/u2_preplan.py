#!/usr/bin/env python3
"""U2 预研（只读）：展示 config.py 与全部引用点，值一律掩码；并给出补丁落点判断。"""
import subprocess, re, os

VAULT = "/mnt/i/Obsidian/vaults/第二大脑"
F = os.path.join(VAULT, "automation/stock/config.py")
MASK = re.compile(r"""(["'])([A-Za-z0-9_+./\-]{8,})\1""")
Q = chr(34) + chr(39)

def mask(s):
    return MASK.sub(lambda m: "«掩码:" + str(len(m.group(2))) + "位»", s)

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, errors="ignore").stdout

txt = open(F, encoding="utf-8", errors="ignore").read()
print("=== config.py（值掩码）===")
for i, ln in enumerate(txt.splitlines(), 1):
    print(f"  {i:>3} {mask(ln)}")

print("\n=== 所有 SENDER_AUTH 引用（文件:行 : 掩码上下文）===")
out = sh("git", "-C", VAULT, "grep", "-n", "-i", "SENDER" + "_AUTH", "HEAD", "--", "*.py")
for line in out.splitlines():
    p = line.split(":", 3)
    if len(p) < 4:
        continue
    print(f"  {p[1]}:{p[2]}  {mask(p[3]).strip()[:120]}")

print("\n=== 补丁落点判断 ===")
imports = [l.strip() for l in txt.splitlines() if re.match(r"^\s*(import|from)\s", l)]
print("  现有 import 行：", imports if imports else "（无）")
print("  是否已有 os 引用：", any("os" == i.split()[1].split(".")[0] for i in imports if len(i.split()) > 1))
print("  需补 import os：", not re.search(r"(?m)^\s*import\s+os\b", txt))
