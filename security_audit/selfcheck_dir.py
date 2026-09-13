#!/usr/bin/env python3
"""本目录自净检查：确认我们自己写的审计文档/工具里不含任何凭据本体。
带阳性对照：同一条检索式必须能命中一个合成的假凭据，否则"0"不可信。"""
import re, glob, os

BAD = re.compile(r"(?i)(?:"
                 r"(?:github|git)[_]pat_[A-Za-z0-9_]{20,}"        # fine-grained PAT 本体
                 r"|gh[pousr]_[A-Za-z0-9]{20,}"                    # 经典 token 本体
                 r"|eyJ[A-Za-z0-9_\-]{20,}[.][A-Za-z0-9_\-]{20,}"  # JWT 本体
                 r")")
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 阳性对照
control = "git" + "_" + "pat_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5"
hits_ctl = len(BAD.findall(control))
print(f"[对照] 合成假凭据应被命中：命中={hits_ctl} -> {'✅ 检索式有效' if hits_ctl else '❌ 检索式失效，下面的 0 不可信'}")
if not hits_ctl:
    raise SystemExit(1)

bad = 0
for f in sorted(glob.glob("*.md") + glob.glob("*.py") + glob.glob("*.sh") + glob.glob("*.txt")):
    t = open(f, encoding="utf-8", errors="ignore").read()
    n = len(BAD.findall(t))
    if n:
        print(f"  ❌ LEAK  {f} = {n} 处凭据本体")
        bad += 1
print(f"  扫描文件数={len(glob.glob('*'))}  含凭据本体的文件数={bad}")
print("=== 结论:", "本目录可安全入库 ✅" if bad == 0 else "存在自泄漏，禁止提交 ❌", "===")
raise SystemExit(0 if bad == 0 else 1)
