#!/usr/bin/env python3
"""
全仓明文普查 v3 —— 高信噪比版
v2 的问题：把 JS/JSX 里无处不在的 key="..." / policyKey 当密钥字段，2076 处命中里 ~99% 假阳，
出不了可用的暴露地图。v3 三重收紧：
  1) 字段名必须是"密钥语义名"（含 api/secret/access/auth/token/pass/pwd/credential/private），
     且不能是裸 key/keys/policyKey 这类通用词。
  2) 值必须"像凭据"：长度>=12 且 (含数字且含字母) 或 (含大小写混合) 或 (含 _ - 且长度>=14)；
     排除纯小写英文词（include / same-origin / application/json 等）。
  3) 排除明显代码上下文（JSX 属性 key=、i18n 资源键、测试 fixture）。
自检：A 阳性对照必须命中"已知真凭据形态"，并必须放过"已知假阳形态"。
输出仅 计数/字段名/值长度/字符类别指纹，绝不含值。
"""
import subprocess, sys, re, os, json

SECRETISH = re.compile(r"(?i)(api[_-]?key|secret|access[_-]?key|auth|token|passw|pwd|credential|private[_-]?key|client[_-]?(id|secret)|smtp)")
GENERIC = re.compile(r"(?i)^(key|keys|keyid|policykey|cachekey|sortkey|primarykey|foreignkey|apikeyname)$")
VALUE_OK = re.compile(r"""(?x)
   (?=.{12,})                      # 至少 12 位
   (?=[\s\S]*[A-Za-z])             # 含字母
   (?: (?=[\s\S]*[0-9])(?=[\s\S]*[A-Za-z])      # 有数字且有字母（不限先后）
       | (?=[\s\S]*[a-z][\s\S]*[A-Z])           # 大小写混合
       | (?=[\s\S]*[_\-][\s\S]{6,}) )           # 含分隔符且足够长
""")
# 占位符判定：只在"纯字母前缀 + 不含数字"时排除，避免把含数字的真凭据误杀成假阴
PLACE_WORDS = r"(?:your|my|xxx|todo|changeme|none|null|example|dummy|test|redacted|sample|placeholder|password|passwd|abcdef|123456)"
PLACE = re.compile(r"(?i)^(?:" + PLACE_WORDS + r")[a-z0-9_\-]*$")

def is_placeholder(v):
    """占位符 = 命中常见示例词 且（不含数字 或 明显是顺序串）。"""
    if not PLACE.match(v):
        return False
    if re.search(r"[0-9]", v) and not re.search(r"(?i)(password|passwd|123456|abcdef|xxxx)", v):
        return False     # 含数字且不像示例词 → 倾向真凭据，不排除
    return True
WORDY = re.compile(r"(?i)^(true|false|null|undefined|include|same-origin|cors|navigate|deny|application|text/|multipart|auto|manual|inherit|optional|required|string|number|boolean|object|array|function)$")
ENVISH = re.compile(r"(?i)environ|getenv|configparser|example|placeholder|<.*>|\{\{|%s|redact|process\.env|import\.meta")

FIELD = re.compile(r"""(?ix)
  (?<![A-Za-z0-9_])
  (['"]?
   [A-Za-z0-9_\-]{0,28}(?:AUTH|AUTH_CODE|PASS|PASSWORD|PWD|TOKEN|SECRET|APIKEY|API_KEY|ACCESS_KEY|CREDENTIAL|CLIENT_SECRET|SMTP)[A-Za-z0-9_\-]{0,8}
   ['"]?)
  \s*[:=]\s*(['"])([A-Za-z0-9_\-]{8,40})\2
""")
CODECTX = re.compile(r"(?i)\bkey\s*[:=]\s*[\"'][a-z0-9_\-]{1,20}[\"']\s*[,)}]|data-i18n|className|<\w+\s|assert|expect\(")

def run(a, t=600):
    try:
        return subprocess.run(a, capture_output=True, text=True, errors="ignore", timeout=t).stdout
    except Exception:
        return ""

def judge(repo, line, field, val):
    f = field.strip().strip("'\"")
    if GENERIC.match(f): return False
    if not SECRETISH.search(f): return False
    if WORDY.match(val): return False
    if is_placeholder(val): return False        # 占位符/示例值不算真凭据
    # 仅排除"指针式配对"：字段名以 env/ref/name/var/prefix/header 结尾 且 值是 SCREAMING_SNAKE。
    # 这是 harness 噪音 apiKeyEnv = "DEEPSEEK_API_KEY" 的形态。
    # ⚠️ 切勿按"值是全大写"单独排除 —— 实测那样会误杀 SENDER_AUTH 那处真凭据（假阴）。
    if re.search(r"(?i)(env|ref|name|var|prefix|header|ident|alias)$", f) and re.fullmatch(r"[A-Z][A-Z0-9_]{5,}", val):
        return False
    if re.fullmatch(r"[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+", val): return False   # 点分标识符（如 a.b.c）
    if not VALUE_OK.match(val): return False
    if ENVISH.search(line): return False
    if CODECTX.search(line) and not SECRETISH.search(line.split("=")[0][:60]): return False
    return True

def positive_control():
    # (行, 期望) —— 必须抓到真形态、放过常见假阳形态
    cases = [
      ('SENDER_AUTH = "Abc123_xyz789QWERTYUIO"', True),
      ('const QQ_SMTP_PASS = "Qz7Km2pLx9Rt4Wne"', True),
      ("api_key: \"aB3dEfGhIjKlMnOpQrStUvWx\"", True),
      ('<div key="item-list-01" />', False),
      ('const policyKey = "branch-tails-x"', False),
      ('fetch(u, {credentials: "include"})', False),
      ('KEY = os.environ.get("SMTP_PASS")', False),
      ("headers: { 'Content-Type': 'application/json' }", False),
      ('PASSWORD = "YourPasswordHere"', False),
    ]
    got = []
    for line, _ in cases:
        ok = False
        for m in FIELD.finditer(line):
            if judge("x", line, m.group(1), m.group(3)): ok = True
        got.append(ok)
    exp = [c[1] for c in cases]
    return got == exp, got, exp

def scan(repo):
    if not os.path.exists(os.path.join(repo, ".git")):
        return None, "非 git 仓"
    Q = '["' + chr(39) + ']'          # 引号字符类（避免嵌套引号破坏 r 前缀）
    D = '[A-Za-z0-9_' + chr(45) + ']'  # 含连字符的字符类
    broad = (D + '{0,28}(AUTH|PASS|TOKEN|SECRET|CREDENTIAL|SMTP|APIKEY|API_KEY|ACCESS_KEY)'
             + D + '{0,8}[[:space:]]*[:=][[:space:]]*' + Q + D + '{8,40}' + Q)
    raw = run(["git","-C",repo,"grep","-I","-n","-i","-E",broad,"HEAD"])
    if raw == "":
        if not run(["git","-C",repo,"rev-parse","HEAD"]).strip():
            return None, "HEAD 不存在"
    out=[]
    for line in raw.splitlines():
        p=line.split(":",3)
        if len(p)<4: continue
        _,path,lineno,content=p
        if re.search(r"\.(min\.js|bundle\.js|snap|lock)$",path,re.I): continue
        for m in FIELD.finditer(content):
            if judge(repo, content, m.group(1), m.group(3)):
                out.append({"repo":repo,"file":path,"line":lineno,"field":m.group(1).strip().strip("'\""),
                            "vlen":len(m.group(3)),
                            "fp":"+".join(sorted((set("lc" if re.search(r"[a-z]",m.group(3)) else [])|
                                                  set("uc" if re.search(r"[A-Z]",m.group(3)) else [])|
                                                  set("dg" if re.search(r"[0-9]",m.group(3)) else [])|
                                                  set("sy" if re.search(r"[_\-]",m.group(3)) else [])))) or "other"})
    return out, None

def main():
    ok,got,exp = positive_control()
    print(f"[自检A] 阳性/阴性对照 期望{exp} 实得{got} -> {'✅ 工具判别有效' if ok else '❌ 失效，结果不可信'}")
    if not ok: sys.exit(1)
    repos=[l.strip().replace("\ufeff","") for l in open(sys.argv[1],encoding="utf-8-sig") if l.strip().replace("\ufeff","")]
    allh=[];sk=[]
    print(f"\n{'仓':<52}{'高危候选':>8}")
    print("-"*62)
    for r in repos:
        res,err=scan(r)
        if err: print(f"{r:<52}  [SKIP] {err} <-- 跳过≠干净"); sk.append(r); continue
        print(f"{r:<52}{len(res):>8}")
        allh+=res
    with open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])),"hits_v3.json"),"w",encoding="utf-8") as fh:
        json.dump(allh,fh,ensure_ascii=False,indent=1)
    print(f"\n=== 高危候选合计 {len(allh)} 处（跳过 {len(sk)} 仓）；明细 hits_v3.json ===")
    for h in allh[:40]:
        print(f"  {os.path.basename(h['repo']):<18} {h['field']:<18} 值长{h['vlen']:<3} {h['fp']:<9} …{h['file'][-40:]}:{h['line']}")
main()
