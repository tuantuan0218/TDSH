#!/usr/bin/env python3
# 定向历史扫描：只看指定路径在各提交中的版本，判定"明文赋值"形态是否存在
# 不接触、不需要凭据原值；只报 提交/路径/字段名/值长度指纹
import subprocess, sys, re

FIELD = re.compile(r"""(?ix)(?<![A-Za-z0-9_])
 ([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PASSWORD|PWD|TOKEN|SECRET|API_KEY|APIKEY|KEY))(?![A-Za-z0-9_])
 \s*[:=]\s*(['"])([A-Za-z0-9_\-]{8,32})\2""")
ENVISH = re.compile(r"(?i)environ|getenv|example|your_|placeholder|xxx|\{\{")
PLACE = re.compile(r"(?i)^(your|xxx|todo|changeme|none|example|dummy|test)")

def git(repo, *a):
    return subprocess.run(["git", "-C", repo] + list(a), capture_output=True, text=True, errors="ignore").stdout

repo = sys.argv[1]
paths = sys.argv[2:]
commits = [c for c in git(repo, "log", "--all", "--format=%H", "--", *paths).split() if c]
print(f"涉及这些路径的提交数 = {len(commits)}")
dirty = set()
for c in commits:
    for p in paths:
        t = git(repo, "show", f"{c}:{p}")
        if not t:
            continue
        for ln in t.splitlines():
            if ENVISH.search(ln):
                continue
            for m in FIELD.finditer(ln):
                if PLACE.match(m.group(3)):
                    continue
                dirty.add((c[:7], p, m.group(1), len(m.group(3))))
print(f"含明文赋值的 (提交,路径) 组合 = {len(dirty)}")
涉及 = {c for c, _, _, _ in dirty}
print(f"涉及提交数 = {len(涉及)}  -> {sorted(涉及)}")
for c, p, f, L in sorted(dirty)[:12]:
    print(f"  {c}  {f}(值长{L})  {p[-58:]}")
