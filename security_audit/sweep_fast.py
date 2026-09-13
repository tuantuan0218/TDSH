#!/usr/bin/env python3
"""
全仓普查 v2（§8 跨仓纪律）—— 快版
性能教训：v1 对每个文件起一次 `git show` 子进程，在数万文件仓直接超时（实测 600s 无返回）。
v2 改为：每仓一次 `git grep`（C 速度），再用与 v1 相同的规则做"事后过滤"（注入形态/占位符/词界/字符类）。
输出只含 仓/文件/行号/字段名/值长度/字符类别指纹 —— 绝不含值本身。
自检：A 阳性对照（检索式必须命中合成样本）；B 跳过可见化。
"""
import subprocess, sys, re, os, json

# 一次 grep 抓宽（字段名 + 引号字面量，值字符类含 _ -），再用 FIELD 精确复核
BROAD = r'[A-Za-z0-9_]{0,28}(AUTH|AUTH_CODE|PASS|PASSWORD|PWD|TOKEN|SECRET|APIKEY|API_KEY|KEY)[A-Za-z0-9_]{0,8}[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_-]{8,32}["'"'"']'
FIELD = re.compile(r"""(?ix)
  (?<![A-Za-z0-9_])
  ([A-Za-z0-9_]{0,28}(?:AUTH|AUTH_CODE|PASS|PASSWORD|PWD|TOKEN|SECRET|APIKEY|API_KEY|KEY))
  (?![A-Za-z0-9_])
  \s*[:=]\s*(['"])([A-Za-z0-9_\-]{8,32})\2
""")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|example|placeholder|xxx|<.*>|\{\{|%s|redact|_KEY_FILE")
PLACE = re.compile(r"(?i)^(your|xxx|todo|changeme|none|null|example|dummy|test|redacted)")
SKIPFILE = re.compile(r"\.(png|jpg|jpeg|gif|webp|zip|gz|tgz|ttf|so|dll|pyc|wav|mid|midi|mp3|bin|lock|safetensors|gguf|pdb|exe|jar|class|pack|pdf|7z|rar|min\.js|min\.css)$", re.I)

def run(args, timeout=300):
    try:
        r = subprocess.run(args, capture_output=True, text=True, errors="ignore", timeout=timeout)
        return r.stdout
    except Exception as e:
        return ""

def fp(v):
    c = set()
    if re.search(r"[a-z]", v): c.add("lc")
    if re.search(r"[A-Z]", v): c.add("uc")
    if re.search(r"[0-9]", v): c.add("dg")
    if "_" in v: c.add("us")
    if "-" in v: c.add("hy")
    return "+".join(sorted(c)) or "other"

def load_repos(path):
    """读仓列表：剥离 BOM/空白/行内注释。PowerShell 的 -Encoding UTF8 会写 BOM，
    导致首行路径变 '\\ufeff/mnt/...' → 被判"非 git 仓"静默跳过（真实事故，故在此根治）。"""
    out = []
    for raw in open(path, encoding="utf-8-sig", errors="ignore"):
        l = raw.replace("\ufeff", "").strip().lstrip("\ufeff").strip()
        if not l or l.startswith("#"):
            continue
        out.append(l)
    return out

def positive_control():
    samples = ['SENDER_AUTH = "Abc123_xyz789QWERTYUIO"', 'API_KEY: "aB3dEfGhIjKlMnOpQrStUvWx"',  # 合成对照样本，非真凭据
               'fetch(u, {credentials: "include"})', 'KEY = os.environ.get("SOME_KEY")',
               'PASSWORD = "YourPasswordHere123"']
    hits = []
    for s in samples:
        ok = False
        if not ENVISH.search(s):
            for m in FIELD.finditer(s):
                if not PLACE.match(m.group(3)): ok = True
        hits.append(ok)
    return hits == [True, True, False, False, False], hits

def scan(repo, rev="HEAD"):
    if not os.path.exists(os.path.join(repo, ".git")):
        return None, "非 git 仓"
    raw = run(["git", "-C", repo, "grep", "-I", "-n", "-i", "-E", BROAD, rev], timeout=600)
    if raw == "":
        # 区分"真无命中"与"命令失败/无该 rev"
        rc = run(["git", "-C", repo, "rev-parse", rev])
        if not rc.strip():
            return None, f"rev {rev} 不存在"
    out = []
    for line in raw.splitlines():
        # 形如 HEAD:path:lineno:content   或  <sha>:path:lineno:content
        parts = line.split(":", 3)
        if len(parts) < 4:
            continue
        revp, path, lineno, content = parts
        if SKIPFILE.search(path):
            continue
        if ENVISH.search(content):
            continue
        for m in FIELD.finditer(content):
            if PLACE.match(m.group(3)):
                continue
            out.append({"repo": repo, "file": path, "line": lineno, "field": m.group(1),
                        "vlen": len(m.group(3)), "fp": fp(m.group(3))})
    return out, None

def main():
    ok, hits = positive_control()
    print(f"[自检A] 阳性对照 期望[T,T,F,F,F] 实得{hits} -> {'有效 ✅' if ok else '❌ 失效，全部结果不可信'}")
    if not ok: sys.exit(1)
    repos = load_repos(sys.argv[1])
    only = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
    allh = []; skipped = []
    print(f"\n{'仓':<46} {'HEAD明文形态':>12}")
    print("-" * 62)
    for r in repos:
        res, err = scan(r, only)
        if err:
            print(f"{r:<46} [SKIP] {err}  <-- 跳过≠干净"); skipped.append((r, err)); continue
        print(f"{r:<46} {len(res):>12}")
        for h in res: allh.append(h)
    outfile = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), f"hits_{only[:7]}.json")
    with open(outfile, "w", encoding="utf-8") as fh:
        json.dump(allh, fh, ensure_ascii=False, indent=1)
    print(f"\n=== 合计 {len(allh)} 处；跳过 {len(skipped)} 仓；明细 {outfile}（不含值）===")
    for h in allh[:60]:
        print(f"  {os.path.basename(h['repo']):<20} {h['field']:<14} 值长{h['vlen']:<3} {h['fp']:<10} …{h['file'][-42:]}:{h['line']}")
    if len(allh) > 60: print(f"  …另 {len(allh)-60} 处见 json")

main()
