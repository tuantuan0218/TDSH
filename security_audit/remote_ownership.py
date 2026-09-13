#!/usr/bin/env python3
"""
remote 归属判定（取代路径猜测）：从 origin URL 剥离凭据，只取 owner/repo，
据此区分"自有仓（必须内嵌 token）"与"第三方仓（禁止内嵌 token）"。
绝不输出 token 值。
"""
import subprocess, sys, re, os
from urllib.parse import urlsplit

OWN = "tuantuan0218"
repos = [l.strip().replace("\ufeff","") for l in open(sys.argv[1], encoding="utf-8-sig") if l.strip().replace("\ufeff","")]

def origin(repo):
    r = subprocess.run(["git","-C",repo,"remote","get-url","origin"],capture_output=True,text=True,errors="ignore")
    return (r.stdout or "").strip()

print(f"{'仓':<30}{'owner/repo':<40}{'归属':<8}{'内嵌':<6}判定")
print("-"*104)
viol_own_bare=[]; viol_third_tok=[]; nodist=[]
for rp in repos:
    if not os.path.exists(os.path.join(rp,".git")): continue
    u = origin(rp)
    name = os.path.basename(rp)
    if not u:
        print(f"{name:<30}{'(无 origin)':<40}{'?':<8}{'-':<6}无远端，无法判定")
        nodist.append(name); continue
    parts = urlsplit(u)
    host = parts.hostname or "?"
    path = parts.path.strip("/")
    owner = path.split("/")[0] if path else "?"
    embedded = bool(parts.username) or "x-access-token" in u
    own = (owner.lower() == OWN)
    cat = "自有" if own else "第三方"
    verdict = ""
    if own and not embedded:
        verdict = "❌ 违反§5：自有仓未内嵌 → 会弹 GCM"; viol_own_bare.append(rp)
    elif (not own) and embedded:
        verdict = "❌ 违反§5：第三方仓被写入个人 token"; viol_third_tok.append(rp)
    elif own and embedded:
        verdict = "✅ 合规"
    else:
        verdict = "✅ 第三方只拉不推，未带 token，合规"
    print(f"{name:<30}{(host+'/'+path)[:39]:<40}{cat:<8}{('是' if embedded else '否'):<6}{verdict}")

print()
print(f"自有仓未内嵌(需修): {len(viol_own_bare)}")
for v in viol_own_bare: print("   ", v)
print(f"第三方仓含 token(需清除): {len(viol_third_tok)}")
for v in viol_third_tok: print("   ", v)
print(f"无 origin 无法判定: {len(nodist)} {nodist}")
print("注：owner 判定基于 remote URL 的账号段；本脚本不打印任何凭据。")
