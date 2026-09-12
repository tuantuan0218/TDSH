import sqlite3, shutil
ld = r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Default\Login Data"
tmp = r"D:\tdsh\sub2api\tmp_ld_edge.db"
shutil.copy2(ld, tmp)
con = sqlite3.connect(tmp)
cur = con.cursor()
cur.execute("PRAGMA table_info(logins)")
for r in cur.fetchall():
    print(r[1], end=" | ")
print()
con.close()
