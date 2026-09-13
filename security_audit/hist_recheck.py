#!/usr/bin/env python3
# 历史维度重查：区分"真凭据形态"与"REDACTED 占位符形态"（只报计数，绝不输出值）
import subprocess, re, sys
RE = re.compile(r"""(?i)([A-Za-z0-9_]*(?:AUTH|PASS|TOKEN|SECRET|KEY)[A-Za-z0-9_]*)\s*[:=]\s*['"]([A-Za-z0-9_\-]{8,40})['"]""")
PH = re.compile(r"(?i)^(redacted|replaced|removed|masked|deleted|erased|your|example|xxx|placeholder|dummy|test)")
repo = "/mnt/i/Obsidian/vaults/第二大脑"
paths = ["automation/stock/config.py",
         "99_archive/obsidian-vault-old_J盘/automation/stock/config.py",
         "OH-Works/Tomoko-activity/script-audit-report-20260811.md"]
cm = subprocess.run(["git","-C",repo,"log","--all","--format=%H","--","*"],capture_output=True,text=True).stdout.split()
cm = [c for c in cm if c]
print("全历史提交数 =", len(cm))
real=set(); ph=set(); both=[]
for c in cm:
    for p in paths:
        r = subprocess.run(["git","-C",repo,"show",f"{c}:{p}"],capture_output=True,text=True,errors="ignore")
        if r.returncode != 0: continue
        for ln in r.stdout.splitlines():
            for m in RE.finditer(ln):
                (ph if PH.match(m.group(2)) else real).add(c[:7])
                both.append((c[:7], p.split("/")[-1], "占位" if PH.match(m.group(2)) else "真形态"))
print(f"含【真凭据形态】的提交数 = {len(real)}")
print(f"含【占位符形态】的提交数 = {len(ph)}")
rs = sorted({x[0] for x in both if x[2]=='真形态'})
print("真形态涉及的提交:", rs[:12], "..." if len(rs)>12 else "")
# 逐提交计数
from collections import Counter
c1 = Counter(x[0] for x in both if x[2]=='真形态')
print("每提交真形态命中数(前10):", c1.most_common(10))
