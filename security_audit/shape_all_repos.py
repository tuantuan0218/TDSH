#!/usr/bin/env python3
"""跨仓 SENDER_AUTH 赋值形状判定（只读；绝不输出值，只报 长度+字符类别+是否占位词）"""
import subprocess, re, os, sys

REPOS = ["H:/sb-verify", "H:/second-brain", "I:/Obsidian/vaults/第二大脑",
         "D:/tdsh", "D:/tdsh/uumit", "D:/tdsh/黄金", "J:/minicpm5-clone",
         "D:/tdsh/recording_gear", "D:/tdsh/suno迷笛"]
GET = re.compile(r"""(?i)([A-Za-z0-9_]{0,28}(?:AUTH|PASS|PWD|TOKEN|SECRET|KEY)[A-Za-z0-9_]{0,8})"""
                 r"""\s*[:=]\s*['"]([A-Za-z0-9_\-]{6,40})['"]""")
PLACE = re.compile(r"(?i)^(redacted|replaced|removed|masked|deleted|erased|your|my|example|xxx|placeholder|dummy|test|sk-|fake)")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|example\.invalid|os\.get")

def cls(v):
    c = []
    if re.search(r"[a-z]", v): c.append("小写")
    if re.search(r"[A-Z]", v): c.append("大写")
    if re.search(r"[0-9]", v): c.append("数字")
    if "_" in v: c.append("下划线")
    if "-" in v: c.append("连字符")
    return "+".join(c) or "其他"

def wsl_path(p):
    """盘符路径 → WSL 挂载路径（§8-7：写成 H:/... 在 WSL 内不存在 → 静默跳过 → 假绿）"""
    m = re.match(r"^([A-Za-z]):[/\\](.*)$", p)
    if not m: return p
    return f"/mnt/{m.group(1).lower()}/{m.group(2).replace(chr(92),'/')}"

REPOS = [wsl_path(p) for p in REPOS]
# 归一后仍不存在的，显式报告为"未覆盖"，绝不计入"干净"
print("路径归一后：")
for p in REPOS:
    print(f"  {'OK  ' if os.path.exists(p) else 'MISS'} {p}")
print()
print("-" * 112)
print(f"{'仓':<20}{'字段':<16}{'值长':<6}{'形态':<22}{'判定':<12}路径")
print("-" * 112)
tot_real = tot_ph = 0
for r in REPOS:
    if not os.path.exists(r):
        print(f"{os.path.basename(r):<20}  SKIP 路径不存在（跳过≠干净）"); continue
    out = subprocess.run(["git", "-C", r, "grep", "-n", "-I", "-i", "-E",
                          "[A-Za-z_]{0,28}(AUTH|PASS|PWD|TOKEN|SECRET|KEY)[A-Za-z_]{0,8}[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_-]{6,40}[\"']",
                          "HEAD"], capture_output=True, text=True, errors="ignore").stdout
    hits = 0
    for line in out.splitlines():
        p = line.split(":", 3)
        if len(p) < 4: continue
        _, path, ln, content = p
        if ENVISH.search(content): continue
        for m in GET.finditer(content):
            v = m.group(2)
            ph = bool(PLACE.match(v))
            # 真凭据形态：短且纯小写（QQ 授权码典型 16 位小写字母）
            real = (not ph) and len(v) <= 20 and not re.search(r"[A-Z_]", v)
            verdict = "占位符" if ph else ("●真值形态" if real else "○需判读")
            if ph: tot_ph += 1
            elif real: tot_real += 1
            hits += 1
            if hits <= 40:
                print(f"{os.path.basename(r):<20}{m.group(1):<16}{len(v):<6}{cls(v):<22}{verdict:<12}{path[-42:]}:{ln}")
    if hits == 0:
        print(f"{os.path.basename(r):<20}{'-':<16}{'-':<6}{'-':<22}{'无赋值':<12}-")
print(f"\n=== 合计：真值形态 {tot_real} 处，占位符 {tot_ph} 处 ===")
print("说明：只读；仅报字段名/长度/字符类别/判定，未输出任何值。'●真值形态'需人工确认是否为活凭据。")
