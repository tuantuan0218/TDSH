#!/usr/bin/env python3
"""脱敏"是否真到位"检查器（可复用）
判据不是"值被涂掉"，而是三件事同时成立：
  ① 该字段不再是字面量（改成环境变量注入）
  ② 文件里确实有 os.environ / getenv 引用
  ③ HEAD 中不再存在真值形态（占位符除外）
只有一处凭据被涂成占位符字面量 = 假清 + 功能损坏，本工具会判 NOT_FIXED。
"""
import re, sys, subprocess

FIELDISH = re.compile(r"(?i)([A-Za-z0-9_]*(?:AUTH|PASS|TOKEN|SECRET|KEY|CREDENTIAL)[A-Za-z0-9_]*)\s*[:=]\s*(['\"])([A-Za-z0-9_\-]{8,40})\2")
ENV = re.compile(r"(?i)environ|getenv")
PLACE = re.compile(r"(?i)^(redacted|replaced|removed|masked|deleted|erased|your|example|xxx|placeholder|dummy|test)")

def check(path):
    try:
        txt = open(path, encoding="utf-8", errors="ignore").read()
    except Exception as e:
        return f"ERR {e}", []
    has_env = bool(ENV.search(txt))
    lit = []
    for m in FIELDISH.finditer(txt):
        v = m.group(3)
        lit.append((m.group(1), "占位符" if PLACE.match(v) else "真值形态", len(v)))
    real = [x for x in lit if x[1] == "真值形态"]
    ph = [x for x in lit if x[1] == "占位符"]
    if real:
        verdict = "LEAKED(仍有真值字面量)"
    elif ph and not has_env:
        verdict = "NOT_FIXED(涂成占位符但无 env 注入 => 假清+功能坏)"
    elif ph and has_env:
        verdict = "PARTIAL(有占位符残留但也有 env，需人工看是否死代码)"
    elif not ph and not real and has_env:
        verdict = "FIXED(无字面量 + 走 env 注入)"
    else:
        verdict = "NO_CRED_FIELD(未见凭据字段)"
    return verdict, lit

targets = sys.argv[1:] or [
    "/mnt/i/Obsidian/vaults/第二大脑/automation/stock/config.py",
    "/mnt/i/Obsidian/vaults/第二大脑/99_archive/obsidian-vault-old_J盘/automation/stock/config.py",
    "/mnt/i/Obsidian/vaults/第二大脑/OH-Works/Tomoko-activity/script-audit-report-20260811.md",
]
for t in targets:
    v, lit = check(t)
    short = "/".join(t.split("/")[-3:])
    print(f"  {v:<58} {short}")
    for f, kind, n in lit[:4]:
        print(f"        字段={f:<16} {kind} 值长={n}")
print("\n判读：FIXED 才是真到位；NOT_FIXED = 只涂值未改注入（功能会坏且历史真值仍在）。")
