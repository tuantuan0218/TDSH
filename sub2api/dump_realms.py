# 查看 Edge Login Data 所有 realm + 用户名（不打印密码）
import sqlite3, shutil
ld = r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Default\Login Data"
tmp = r"D:\tdsh\sub2api\tmp_ld_edge.db"
shutil.copy2(ld, tmp)
con = sqlite3.connect(tmp)
cur = con.cursor()
cur.execute("SELECT signon_realm, username_value, password_type FROM logins ORDER BY date_password_modified DESC LIMIT 30")
for realm, user, ptype in cur.fetchall():
    print(f"realm={realm} | user={user} | type={ptype}")
con.close()