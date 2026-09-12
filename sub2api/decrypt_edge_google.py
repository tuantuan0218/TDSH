# 解密 Edge 保存的 Google 账号密码（用户授权：用绑定谷歌账号登录拿 key）
# Chromium v10+ 密码加密：DPAPI(unprotect) → AES-128-GCM，无额外 entropy
import os, sqlite3, shutil, json, base64, ctypes, ctypes.wintypes as wt

def dpapi_unprotect(data: bytes) -> bytes:
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
    blob_in = DATA_BLOB(len(data), ctypes.cast(ctypes.create_string_buffer(data, len(data)), ctypes.POINTER(ctypes.c_char)))
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None, 0x01, ctypes.byref(blob_out)):
        raise OSError("CryptUnprotectData failed")
    out = ctypes.string_at(blob_out.pbData, blob_out.cbData)
    ctypes.windll.kernel32.LocalFree(blob_out.pbData)
    return out

def decrypt_chromium(enc: bytes, key: bytes) -> str:
    if enc[:3] == b"v10" or enc[:3] == b"v11":
        nonce, ct = enc[3:15], enc[15:]
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        aes = AESGCM(key)
        return aes.decrypt(nonce, ct, None).decode("utf-8", "replace")
    raise ValueError("unsupported prefix " + str(enc[:3]))

# Edge Local State
ls_path = r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Local State"
ls = json.load(open(ls_path, encoding="utf-8"))
enc_key_b64 = ls["os_crypt"]["encrypted_key"]
enc_key = base64.b64decode(enc_key_b64)
assert enc_key[:5] == b"DPAPI"
aes_key = dpapi_unprotect(enc_key[5:])
print("AES_KEY_OK", len(aes_key))

# Edge Login Data（复制避免锁）
ld = r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Default\Login Data"
tmp = r"D:\tdsh\sub2api\tmp_ld_edge.db"
shutil.copy2(ld, tmp)
con = sqlite3.connect(tmp)
cur = con.cursor()
cur.execute("SELECT signon_realm, username_value, password_value FROM logins WHERE signon_realm LIKE '%accounts.google.com%' OR signon_realm LIKE '%openrouter%' ORDER BY date_password_modified DESC LIMIT 5")
rows = cur.fetchall()
for realm, user, pwd_enc in rows:
    if pwd_enc and pwd_enc[:3] in (b"v10", b"v11"):
        try:
            pwd = decrypt_chromium(pwd_enc, aes_key)
            print(f"---\nrealm: {realm}\nuser: {user}\npass: {pwd}")
        except Exception as e:
            print(f"---\nrealm: {realm}\nuser: {user}\nDECRYPT_ERR: {e}")
con.close()