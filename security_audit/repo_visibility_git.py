#!/usr/bin/env python3
"""
判定"去掉 origin 里的 token 后还能不能拉" —— 直接测裸 URL（不经 GitHub API，避开未授权限流）。
上一版用 api.github.com 全部返回 403（含明显公开的仓库），那是限流不是可见性，结论无效。

方法：从 origin 剥掉凭据段得到裸 URL，用 GIT_TERMINAL_PROMPT=0 跑 ls-remote（绝不弹窗、绝不送凭据）。
  exit 0            => 公开仓，裸 URL 可拉 => 去 token 安全
  exit !=0 且含 403/404/authentication => 需授权 => 去 token 会拉不动
只报判定，不打印任何 URL 的凭据段。
"""
import subprocess, sys, re
from urllib.parse import urlsplit, urlunsplit

def bare(u):
    p = urlsplit(u)
    netloc = p.hostname or ""
    if p.port:
        netloc += f":{p.port}"
    return urlunsplit((p.scheme, netloc, p.path, "", ""))

def test(u):
    env = {"GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "never", "PATH": "/usr/bin:/bin",
           "GIT_ASKPASS": "echo", "HOME": "/root"}
    r = subprocess.run(["git", "ls-remote", "--heads", u], capture_output=True, text=True,
                       errors="ignore", env=env, timeout=90)
    msg = (r.stderr or "") + (r.stdout or "")
    if r.returncode == 0:
        return True, "公开可达（裸 URL 成功列出引用）"
    if re.search(r"(?i)403|401|permission|authentication|could not read Username|private", msg):
        return False, "需授权（私有）"
    if re.search(r"(?i)dial tcp|could not resolve|timed out|network", msg):
        return None, "网络不可达，无法判定（跳过≠结论）"
    return False, msg.strip().split("\n")[0][:70] if msg.strip() else "未知失败"

print(f"{'仓':<30}{'裸URL可拉':<12}判读")
print("-" * 84)
for d in [l.strip().replace("\ufeff", "") for l in open(sys.argv[1], encoding="utf-8-sig") if l.strip()]:
    o = subprocess.run(["git", "-C", d, "remote", "get-url", "origin"],
                       capture_output=True, text=True, errors="ignore").stdout.strip()
    name = d.rstrip("/").split("/")[-1]
    if not o:
        print(f"{name:<30}{'?':<12}无 origin，跳过≠判定"); continue
    ok, msg = test(bare(o))
    mark = {True: "是", False: "否", None: "无法判定"}[ok]
    hint = {True: "=> 去 token 安全", False: "=> 去 token 会拉不动，需保留或改 SSH", None: "=> 不下结论"}[ok]
    print(f"{name:<30}{mark:<12}{hint}  ({msg})")
print("\n注：全程不发送凭据；含 token 的 URL 一律先剥凭据再测；也不会弹 GCM 窗。")
