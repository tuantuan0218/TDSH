#!/usr/bin/env python3
"""
跨仓「赋值型明文密钥」扫描（只读；不接触也不需要凭据原值）
修正了两类互相抵消的错误：
  假阳性：字段名须整体词界（credentials: "include" 不算）
  假阴性：值字符类须含 _ - 等（真实授权码常含下划线，纯 [A-Za-z0-9] 会漏）
排除注入形态（os.environ.get / getenv / config）。
输出只含：字段名、行号、值的长度与字符类别指纹 —— 永不含值本身。
"""
import re, sys, subprocess, os

FIELD = re.compile(r"""(?ix)
  (?<![A-Za-z0-9_])
  ([A-Za-z0-9_]{0,28}(?:AUTH|AUTH_CODE|PASS|PASSWORD|PWD|TOKEN|SECRET|APIKEY|API_KEY|KEY))
  (?![A-Za-z0-9_])            # 词尾边界：credentials / keys[] 之类不算
  \s*[:=]\s*
  (['"])
  ([A-Za-z0-9_\-]{8,32})      # 放宽：含下划线/连字符，>=8 位才算实体
  \2
""")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|os\.get|example|your_|placeholder|xxx|<.*>|\{\{|%s")
PLACEHOLDER = re.compile(r"(?i)^(your|xxx|todo|changeme|none|null|example|dummy|test)")

def fingerprint(v):
    c = set()
    if re.search(r"[a-z]", v): c.add("lc")
    if re.search(r"[A-Z]", v): c.add("uc")
    if re.search(r"[0-9]", v): c.add("dg")
    if "_" in v: c.add("us")
    if "-" in v: c.add("hy")
    return "+".join(sorted(c)) or "other"

def ls_files(repo, rev=None):
    if rev:
        out = subprocess.run(["git", "-C", repo, "ls-tree", "-r", "--name-only", "-z", rev],
                             capture_output=True, text=True)
    else:
        out = subprocess.run(["git", "-C", repo, "ls-files", "-z"], capture_output=True, text=True)
    return [p for p in out.stdout.split("\0") if p]

def blob(repo, rev, path):
    r = subprocess.run(["git", "-C", repo, "show", f"{rev}:{path}"], capture_output=True, text=True, errors="ignore")
    return r.stdout if r.returncode == 0 else ""

def scan_text(text):
    hits = []
    for i, ln in enumerate(text.splitlines(), 1):
        if ENVISH.search(ln):
            continue
        for m in FIELD.finditer(ln):
            val = m.group(3)
            if PLACEHOLDER.match(val):
                continue
            hits.append((i, m.group(1), len(val), fingerprint(val)))
    return hits

def main():
    for spec in sys.argv[1:]:
        repo, _, rev = spec.partition("@")
        rev = rev or None
        label = f"{repo}" + (f"@{rev}" if rev else "@worktree")
        print(f"=== {label} ===")
        if not os.path.exists(os.path.join(repo, ".git")):
            print("   [SKIP] 非 git 仓（跳过≠干净）"); continue
        files = ls_files(repo, rev)
        tot = 0; nf = 0
        for p in files:
            if re.search(r"\.(png|jpg|jpeg|gif|webp|zip|gz|ttf|so|dll|pyc|wav|mid|midi|mp3|bin|lock)$", p, re.I):
                continue
            txt = blob(repo, rev, p) if rev else open_safe(repo, p)
            for (ln, name, vlen, fp) in scan_text(txt):
                tot += 1
                if nf < 25:
                    print(f"   {p}:{ln}  字段={name}  值长={vlen}  指纹={fp}")
                    nf += 1
        print(f"   ---- 合计 {tot} 处疑似赋值型明文（上列至多 25 处）----")

def open_safe(repo, p):
    try:
        return open(os.path.join(repo, p.replace("/", os.sep)), encoding="utf-8", errors="ignore").read()
    except Exception:
        return ""

main()
