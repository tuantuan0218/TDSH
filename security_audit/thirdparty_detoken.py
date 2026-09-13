#!/usr/bin/env python3
"""
第三方仓 origin 去 token（AGENTS.md §7 立即止血 + §5 禁止把个人 token 写进第三方仓）
安全性前置：只处理"公开可拉"的仓（裸 URL ls-remote exit 0），私有仓一律跳过不动。
全程不打印任何凭据；改完立即用裸 URL 复验可拉，保证 pull 不中断。

用法：
  python3 thirdparty_detoken.py --check     # 只看状态，不改
  python3 thirdparty_detoken.py --apply     # 执行止血（仅对已验证公开可拉的仓）
"""
import subprocess, sys, re, os
from urllib.parse import urlsplit, urlunsplit

REPOS = ["/mnt/d/tdsh/hs_card_sdk", "/mnt/d/tdsh/hs_plugin_src",
         "/mnt/d/tdsh/hs_strategy_sdk", "/mnt/d/tdsh/炉石传说/_gh_strategy_plugin"]
ENV = {"PATH": "/usr/bin:/bin", "GIT_TERMINAL_PROMPT": "0",
       "GCM_INTERACTIVE": "never", "GIT_ASKPASS": "echo", "HOME": "/root"}

def origin(d):
    return subprocess.run(["git", "-C", d, "remote", "get-url", "origin"],
                          capture_output=True, text=True, errors="ignore").stdout.strip()

def bare(u):
    p = urlsplit(u)
    nl = p.hostname or ""
    if p.port: nl += f":{p.port}"
    return urlunsplit((p.scheme, nl, p.path, "", ""))

def has_cred(u):
    p = urlsplit(u)
    return bool(p.username or p.password) or "x-access-token" in u

def can_pull(u):
    """不带凭据测能否列引用（GIT_TERMINAL_PROMPT=0 保证不弹窗、不交互）"""
    r = subprocess.run(["git", "ls-remote", "--heads", u], capture_output=True, text=True,
                       errors="ignore", env=ENV, timeout=90)
    return r.returncode == 0, (r.stderr or "").strip().split("\n")[0][:60]

mode = "--apply" if "--apply" in sys.argv else "--check"
print(f"模式 = {mode}   （只处理公开可拉的第三方仓；私有/不可判定一律不动）\n")
print(f"{'仓':<26}{'含凭据':<8}{'裸URL可拉':<11}动作")
print("-" * 78)
done = skipped = 0
for d in REPOS:
    name = d.rstrip("/").split("/")[-1]
    if not os.path.exists(os.path.join(d, ".git")):
        print(f"{name:<26}{'-':<8}{'-':<11}SKIP 非 git 仓（跳过≠安全，需人工看）"); skipped += 1; continue
    u = origin(d)
    if not u:
        print(f"{name:<26}{'-':<8}{'-':<11}SKIP 无 origin"); skipped += 1; continue
    if not has_cred(u):
        print(f"{name:<26}{'否':<8}{'-':<11}无需处理（本来就没塞 token）"); skipped += 1; continue
    ok, err = can_pull(bare(u))
    if not ok:
        print(f"{name:<26}{'是':<8}{'否':<11}不动！去 token 会断 pull（{err}）"); skipped += 1; continue
    if mode == "--apply":
        subprocess.run(["git", "-C", d, "remote", "set-url", "origin", bare(u)],
                       capture_output=True, text=True, errors="ignore")
        after = origin(d)
        still_ok, _ = can_pull(after)
        clean = not has_cred(after)
        status = "✅ 已去 token，且裸 URL 仍可拉" if (clean and still_ok) else "⚠️ 已改但复验异常，需人工看"
        print(f"{name:<26}{'是':<8}{'是':<11}APPLY {status}")
        done += 1 if (clean and still_ok) else 0
    else:
        print(f"{name:<26}{'是':<8}{'是':<11}可安全去 token（--apply 执行）"); done += 0

print(f"\n可处理/已处理 = {done}   跳过或无需处理 = {skipped}")
print("注：本脚本从不输出凭据；token 仍在 AGENTS.md 所在的 dsh-home（那是 §5 认可的位置）。")
