#!/usr/bin/env python3
"""
判定第三方仓的 origin 是否指向公开仓库（决定"去掉 token 会不会拉不动"）。
方法：把 URL 规范化为【无凭据】形式，取其 api 端点看 HTTP 状态码。
  200 => 公开仓，去 token 后仍可正常 pull（U3 可安全执行）
  404 => 私有或不存在，去 token 会拉不动（U3 需保留或改走 SSH）
绝不发送任何凭据，也不打印 URL 的凭据段。
"""
import re, ssl, sys, urllib.request, urllib.error
from urllib.parse import urlsplit

def owner_repo(u):
    p = urlsplit(u)
    path = p.path.strip("/")
    if path.endswith(".git"):
        path = path[:-4]
    seg = [s for s in path.split("/") if s]
    return (seg[0], seg[1]) if len(seg) >= 2 else (None, None)

def probe(u):
    o, r = owner_repo(u)
    if not o:
        return "?", "无法解析 owner/repo"
    api = f"https://api.github.com/repos/{o}/{r}"
    req = urllib.request.Request(api, headers={"User-Agent": "audit-noauth"})
    try:
        with urllib.request.urlopen(req, timeout=20, context=ssl.create_default_context()) as resp:
            return resp.status, "公开可达"
    except urllib.error.HTTPError as e:
        return e.code, {404: "私有或不存在", 403: "限流或需授权", 401: "需授权"}.get(e.code, str(e.code))
    except Exception as e:
        return -1, f"网络异常 {type(e).__name__}"

print(f"{'仓目录':<28}{'owner/repo':<38}{'状态':<7}判读")
print("-" * 95)
for d in [l.strip().replace("\ufeff", "") for l in open(sys.argv[1], encoding="utf-8-sig") if l.strip()]:
    import subprocess
    u = subprocess.run(["git", "-C", d, "remote", "get-url", "origin"],
                       capture_output=True, text=True, errors="ignore").stdout.strip()
    if not u:
        print(f"{d.split('/')[-1]:<28}{'(无 origin)':<38}{'-':<7}跳过≠判定"); continue
    o, r = owner_repo(u)
    st, msg = probe(u)
    verdict = "✅ 去 token 安全（公开仓，裸 URL 仍可 pull）" if st == 200 else \
              ("❌ 去 token 会拉不动（私有）" if st == 404 else f"⚠ 待人工判读（{msg}）")
    print(f"{d.split('/')[-1]:<28}{(o+'/'+r):<38}{st:<7}{verdict}")
print("\n注：探测不带任何凭据，只取仓库可见性；不打印含凭据的 URL。")
