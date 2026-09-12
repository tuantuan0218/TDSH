import sqlite3, os, shutil
paths = {
  "edge": r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Default\Login Data",
  "chromeH": r"H:\Chrome\UserData\Default\Login Data",
}
for name, p in paths.items():
    print(f"=== {name}: exists={os.path.exists(p)} ===")
    if not os.path.exists(p): continue
    try:
        tmp = r"D:\tdsh\sub2api\tmp_ld_" + name + ".db"
        try:
            shutil.copy2(p, tmp)
            src = tmp
        except Exception as e:
            src = p
        con = sqlite3.connect(src)
        cur = con.cursor()
        cur.execute("SELECT signon_realm, username_value FROM logins WHERE signon_realm LIKE '%google%' OR signon_realm LIKE '%openrouter%' OR username_value LIKE '%gmail%' LIMIT 10")
        rows = cur.fetchall()
        for r in rows: print("  ", r[0], "|", r[1])
        if not rows: print("   (无 google/openrouter 条目)")
        con.close()
    except Exception as e:
        print("  ERR:", str(e)[:120])