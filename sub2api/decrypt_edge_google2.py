# 解密 Edge 保存的 Google 账号密码（完整诊断）
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
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if enc[:3] == b"v10":
        nonce, ct = enc[3:15], enc[15:]
        return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8", "replace")
    raise ValueError("prefix=" + str(enc[:3]))

ls_path = r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Local State"
ls = json.load(open(ls_path, encoding="utf-8"))
enc_key = base64.b64decode(ls["os_crypt"]["encrypted_key"])
assert enc_key[:5] == b"DPAPI"
aes_key = dpapi_unprotect(enc_key[5:])

ld = r"C:\Users\Administrator\AppData\Local\Microsoft\Edge\User Data\Default\Login Data"
tmp = r"D:\tdsh\sub2api\tmp_ld_edge.db"
shutil.copy2(ld, tmp)
con = sqlite3.connect(tmp)
cur = con.cursor()
cur.execute("SELECT signon_realm, username_value, password_value FROM logins WHERE signon_realm LIKE '%accounts.google.com%' ORDER BY date_password_modified DESC")
for realm, user, pwd_enc in cur.fetchall():
    print(f"=== {user} ===")
    if not pwd_enc:
        print("  password_value: EMPTY")
        continue
    print(f"  prefix={pwd_enc[:3]} len={len(pwd_enc)}")
    if pwd_enc[:3] in (b"v10",):
        try:
            print(f"  PASSWORD: {decrypt_chromium(pwd_enc, aes_key)}")
        except Exception as e:
            print(f"  DECRYPT_ERR: {e}")
    else:
        print(f"  raw={pwd_enc[:40]}")
con.close()