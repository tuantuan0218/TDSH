#!/usr/bin/env python3
"""
跨仓凭据「形状」判定 v2 —— 修掉 v1 的两个自伤缺陷
  缺陷1（假阳）：`credentials: "include"`（7 位纯小写）被判真值形态
  缺陷2（自噪音）：为做阳性对照而写进审计文档/脚本的合成值被扫描命中
本版规则（全部可由 --selftest 证明有效）：
  · 真值形态须 长度>=12、含小写、且（纯字母数字 或 混含数字）→ 排除词典词/纯标识符
  · 命中行若含"对照样本标记"（FAKE/REDACTED/example.invalid/TEST-NET/合成/fixture/ctl_/dummy…）→ 记 control 不计真值
  · 词典词表覆盖 JS/HTTP 常见字面量，避免把语法关键字当密钥
绝不输出任何值，只输出长度/字符类别/判定。
"""
import subprocess, re, os, sys

FLD = 'SENDER' + '_AUTH'
ASSIGN = re.compile(r"""(?i)([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PWD|TOKEN|SECRET|KEY|CREDENTIAL)[A-Za-z0-9_]{0,8})"""
                   r"""\s*[:=]\s*['"]([A-Za-z0-9_\-]{4,40})['"]""")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|os\.get|import os")
# 行/文件级"对照样本"标记（只用于识别我自己的测试夹具）
CONTROL_MARK = re.compile(r"(?i)合成|fixture|ctl_|test_|\btest\b|example\.invalid|TEST-NET|对照|样本|正则|regex|pattern|dummy|placeholder值")
# 值级占位/示例前缀（production 代码里出现即为"假清"信号，须与 control 分开）
CTRL_VAL = re.compile(r"(?i)^(redacted|replaced|removed|masked|deleted|erased|your|my|example|xxx|"
                      r"placeholder|dummy|test|fake|sk-|changeme|none|null|sample)")
DICT = {"include", "same-origin", "cors", "navigate", "deny", "application", "json", "string", "number",
        "boolean", "object", "array", "auto", "manual", "inherit", "optional", "required", "true", "false",
        "null", "undefined", "strict", "basic", "bearer", "private", "public", "open", "close", "default",
        "utf-8", "utf8", "ascii", "linux", "windows", "darwin", "x64", "arm64", "status", "pending",
        "resolve", "reject", "success", "failed", "error", "warning", "debug", "info", "trace", "silent"}

def classify(field, val, line):
    """→ control | placeholder | real | nameref | dictword | ambiguous
    ⚠️ 自测纠出的两条错，别再改回去：
      · 16 位纯小写**就是 QQ SMTP 授权码的真实形态**，不得因"纯小写"降级（那是致命假阴）
      · 全大写无小写的值（`"DEEPSEEK_API_KEY"`）是**环境变量名**不是密钥，单列 nameref
    """
    if CONTROL_MARK.search(line):
        return "control"
    if CTRL_VAL.match(val):
        return "placeholder"
    if re.fullmatch(r"[A-Z][A-Z0-9_]{3,}", val):
        return "nameref"
    # 真值形态：小写+数字混合且够长；或纯小写字母数字 12~20 位（QQ 授权码形态）
    if re.fullmatch(r"(?=.*[a-z])(?=.*[0-9])[A-Za-z0-9]{12,40}", val):
        return "real"
    if re.fullmatch(r"[a-z]{12,20}", val) and val.lower() not in DICT:
        return "real"
    if re.fullmatch(r"(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]{12,40}", val):
        return "real"
    if val.lower() in DICT or re.fullmatch(r"[a-z\-_.]+", val):
        return "dictword"
    return "ambiguous"

def wp(p):
    m = re.match(r"^([A-Za-z]):[/\\](.*)$", p)
    return f"/mnt/{m.group(1).lower()}/{m.group(2).replace(chr(92),'/')}" if m else p

def run(repo, *a, t=180):
    try:
        r = subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True,
                           errors="ignore", timeout=t)
        return (r.stdout or "") + (r.stderr if r.returncode else "")
    except Exception:
        return ""

def selftest():
    """每条规则都要有正反例，否则改判据=碰运气。"""
    cases = [
        # (field, val, line, expected)
        ("credentials", "include", 'fetch(u,{credentials: "include"})', "dictword"),
        ("API_KEY", "Abc123_xyz789QWERTYUIO", 'API_KEY = "Abc123_xyz789QWERTYUIO"  # 合成对照', "control"),
        ("SENDER_AUTH", "REDACTED-QQ-SMTP-OLD", 'SENDER_AUTH = "REDACTED-QQ-SMTP-OLD"', "placeholder"),
        ("SENDER_AUTH", "abcdefghijklmnop", 'SENDER_AUTH = "abcdefghijklmnop"', "real"),            # 合成对照样本，非真凭据
        ("SENDER_AUTH", "aB3dEfGhIjKlMn123456", 'SENDER_AUTH = "aB3dEfGhIjKlMn123456"', "real"),   # 合成对照样本，非真凭据
        ("QQ_SMTP_PASS", "YourPasswordHere", 'QQ_SMTP_PASS = "YourPasswordHere"', "placeholder"),
        ("TOKEN_PREFIX", "branch-tails-x", 'TOKEN_PREFIX = "branch-tails-x"', "dictword"),
        ("DEEPSEEK_API_KEY", "DEEPSEEK_API_KEY", 'apiKeyEnv = "DEEPSEEK_API_KEY"', "nameref"),
        ("SMTP_PASS", "QQ_SMTP_PASS", 'SMTP_PASS = os.environ["QQ_SMTP_PASS"]', "nameref"),
    ]
    bad = 0
    for f, v, ln, exp in cases:
        got = classify(f, v, ln)
        ok = got == exp
        bad += not ok
        print(f"  {'✅' if ok else '❌'} {f:<16} 值长{len(v):<3} 期望={exp:<12} 实得={got}")
    print(f"  === 自测 {'全过 ✅' if bad == 0 else f'{bad} 条不符 ❌'} ===")
    return 1 if bad else 0

def scan_repo(repo):
    repo = wp(repo)
    print(f"\n### {repo}")
    if not os.path.exists(os.path.join(repo, ".git")):
        print("  SKIP 非仓（跳过 ≠ 干净）"); return
    out = run(repo, "grep", "-n", "-I", "-i", FLD, "HEAD")
    if "fatal" in out[:40] and not out.strip():
        print("  该仓无字段名命中 → 此项干净"); return
    files = sorted({ln.split(":", 2)[1] for ln in out.splitlines() if ln.count(":") >= 2})
    tally = {}
    shown = 0
    for p in files[:60]:
        txt = run(repo, "show", f"HEAD:{p}")
        for line in txt.splitlines():
            if ENVISH.search(line):
                tally["control"] = tally.get("control", 0) + 1
                continue
            for m in ASSIGN.finditer(line):
                k = classify(m.group(1), m.group(2), line)
                tally[k] = tally.get(k, 0) + 1
                if k == "real" and shown < 12:
                    c = []
                    v = m.group(2)
                    if re.search(r"[a-z]", v): c.append("小写")
                    if re.search(r"[A-Z]", v): c.append("大写")
                    if re.search(r"[0-9]", v): c.append("数字")
                    print(f"  ●真值形态  字段={m.group(1):<18} 值长={len(v):<3} {'+'.join(c):<14} …{p[-44:]}")
                    shown += 1
    print(f"  含字段名文件={len(files)}  判定分布={tally or '无赋值形态'}")
    if tally.get("real"):
        print("  ⚠️ 需人工确认是否活凭据")
    else:
        print("  ✅ 无真值形态命中")

if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    for r in sys.argv[1:] or ["D:/tdsh", "J:/minicpm5-clone"]:
        scan_repo(r)
