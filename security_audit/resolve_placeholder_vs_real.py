#!/usr/bin/env python3
"""
决定性判定：那 3 处 SENDER_AUTH 到底是"真凭据"还是"脱敏占位符"？
方法：只看值的【长度 + 字符类别指纹 + 是否占位词开头】，绝不输出值本身。
     若历史里存在"16 位纯小写"形态、HEAD 变成"21 位大写+连字符且以 REDACT 开头"，
     即证明发生过就地脱敏 —— 与"仍是真凭据"互斥。
"""
import subprocess, re, sys

REPOS = ["/mnt/i/Obsidian/vaults/第二大脑", "/mnt/h/second-brain"]
PATHS = ["automation/stock/config.py",
         "99_archive/obsidian-vault-old_J盘/automation/stock/config.py",
         "OH-Works/Tomoko-activity/script-audit-report-20260811.md"]
GET = re.compile(r"""(?i)SENDER_AUTH\s*[:=]\s*['"]([A-Za-z0-9_\-]{6,40})['"]""")
PLACE = re.compile(r"(?i)^(redacted|replaced|removed|masked|deleted|erased|your|example|xxx|placeholder|dummy|test)")

def cls(v):
    c = []
    if re.search(r"[a-z]", v): c.append("小写")
    if re.search(r"[A-Z]", v): c.append("大写")
    if re.search(r"[0-9]", v): c.append("数字")
    if "_" in v: c.append("下划线")
    if "-" in v: c.append("连字符")
    return "+".join(c) or "其他"

for repo in REPOS:
    print(f"\n########## {repo} ##########")
    for p in PATHS:
        cs = subprocess.run(["git", "-C", repo, "log", "--all", "--format=%H", "--", p],
                            capture_output=True, text=True, errors="ignore").stdout.split()
        if not cs:
            print(f"  {p}\n      该仓无此路径历史")
            continue
        seen = []
        for c in cs:
            t = subprocess.run(["git", "-C", repo, "show", f"{c}:{p}"],
                               capture_output=True, text=True, errors="ignore").stdout
            for m in GET.finditer(t):
                v = m.group(1)
                seen.append((c[:7], len(v), cls(v), bool(PLACE.match(v))))
        if not seen:
            print(f"  {p}\n      未见 SENDER_AUTH 赋值")
            continue
        head = seen[0] if cs[0] in [s[0] for s in seen] else None
        uniq = {}
        for s in seen:
            uniq.setdefault((s[1], s[2], s[3]), []).append(s[0])
        print(f"  {p}  （历史 {len(cs)} 提交，检出 {len(seen)} 次赋值）")
        for (ln, kind, ph), commits in sorted(uniq.items()):
            tag = "★占位符形态" if ph else ("●真凭据形态" if (kind == "小写+数字" or "小写" in kind and "大写" not in kind and ln <= 20) else "○需判读")
            print(f"      值长={ln:<3} {kind:<16} {tag}  出现提交数={len(commits)}  最早={commits[-1]} 最新={commits[0]}")
        kinds = {k[2] for k in uniq.keys()}
        has_placeholder = any(k[2] for k in uniq.keys())
        has_realish = any(not k[2] for k in uniq.keys())
        if has_placeholder and has_realish:
            print("      ⇒ 同一路径既有占位符也有真值形态：说明曾发生脱敏（旧提交里仍能取到真值）")
        elif has_placeholder:
            print("      ⇒ 仅占位符形态：该路径未含真值")
        else:
            print("      ⇒ 仅真值形态：仍是活凭据风险")
