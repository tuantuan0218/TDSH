#!/usr/bin/env python3
# 全历史「赋值型明文密钥」扫描（只读；不含凭据原值，只报计数/字段名/长度指纹）
import subprocess, sys, re, os

FIELD = re.compile(r"""(?ix)
  (?<![A-Za-z0-9_])
  ([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PASSWORD|PWD|TOKEN|SECRET|APIKEY|API_KEY|KEY))
  (?![A-Za-z0-9_])
  \s*[:=]\s*(['"])([A-Za-z0-9_\-]{8,32})\2
""")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|example|your_|placeholder|xxx|<.*>|\{\{|%s")
PLACE = re.compile(r"(?i)^(your|xxx|todo|changeme|none|null|example|dummy|test)")
SKIP_EXT = re.compile(r"\.(png|jpg|jpeg|gif|webp|zip|gz|ttf|so|dll|pyc|wav|mid|midi|mp3|bin|lock|safetensors|gguf)$", re.I)

def git(repo, *a):
    return subprocess.run(["git", "-C", repo] + list(a), capture_output=True, text=True, errors="ignore").stdout

def scan_blob(repo, rev, path):
    t = git(repo, "show", f"{rev}:{path}")
    n = 0
    for ln in t.splitlines():
        if ENVISH.search(ln):
            continue
        for m in FIELD.finditer(ln):
            if PLACE.match(m.group(3)):
                continue
            n += 1
    return n

def main():
    repo = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    commits = [c for c in git(repo, "log", "--all", "--format=%H").split() if c][:limit]
    print(f"repo={repo}  提交数={len(commits)}")
    grand = 0
    for c in commits:
        short = c[:7]
        files = [f for f in git(repo, "ls-tree", "-r", "--name-only", "-z", c).split("\0") if f and not SKIP_EXT.search(f)]
        h = 0
        for p in files:
            h += scan_blob(repo, c, p)
        grand += h
        subj = git(repo, "log", "-1", "--format=%s", c).strip()[:52]
        flag = "  <== 有明文形态" if h else ""
        print(f"  {short}  hits={h:<3} files={len(files):<5} {subj}{flag}")
    print(f"=== 全历史合计 = {grand} ===")
    print("判读：0 = 历史中无'赋值型明文密钥'形态（公开仓 clone 拿不到此类串）；")
    print("      >0 时须逐条判读真假阳性（历史里可能有示例/占位）。")

main()
