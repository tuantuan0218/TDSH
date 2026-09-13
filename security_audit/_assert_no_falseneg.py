#!/usr/bin/env python3
# 断言：新加的"值像变量名"规则，绝不能把已知真凭据那行判掉（只报 True/False，不印值）
import re, sys
sys.argv=["x"]
src=open("/mnt/d/tdsh/security_audit/sweep_v3.py",encoding="utf-8").read()
ns={}
exec(compile(src.split("def main()")[0],"sweep","exec"),ns)

targets = [
  ("/mnt/i/Obsidian/vaults/第二大脑/automation/stock/config.py", 10, "真凭据·活动代码"),
  ("/mnt/i/Obsidian/vaults/第二大脑/OH-Works/Tomoko-activity/script-audit-report-20260811.md", 17, "真凭据·审计报告"),
  ("/mnt/i/Obsidian/vaults/第二大脑/99_archive/obsidian-vault-old_J盘/automation/stock/config.py", 10, "真凭据·归档"),
]
allok=True
for path,lineno,label in targets:
    try:
        lines=open(path,encoding="utf-8",errors="ignore").read().splitlines()
    except Exception as e:
        print(f"  [ERR] {label}: {e}"); allok=False; continue
    ln=lines[lineno-1] if len(lines)>=lineno else ""
    found=False
    for m in ns["FIELD"].finditer(ln):
        if ns["judge"]("r", ln, m.group(1), m.group(3)): found=True
    # 只报判定结果与该值的"形态摘要"（长度+类别），不报值
    shape=""
    for m in ns["FIELD"].finditer(ln):
        v=m.group(3)
        shape=f"len={len(v)} 类={''.join(sorted({c for c in ('lu','ld','ls') if (c=='lu' and re.search('[A-Z]',v)) or (c=='ld' and re.search('[0-9]',v)) or (c=='ls' and re.search('[_-]',v))}))}"
    print(f"  {'✅保留' if found else '❌误杀'}  {label:<16} {shape}")
    allok = allok and found
print("=== 结论:", "规则安全 ✅" if allok else "存在假阴，必须回退该规则 ❌", "===")
sys.exit(0 if allok else 1)
