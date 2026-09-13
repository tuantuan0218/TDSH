# -*- coding: utf-8 -*-
"""败局复盘：从 statistics.db 提取 HERO_05/07/03 全部对局记录"""
import sqlite3, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
con = sqlite3.connect(r'D:\tdsh\炉石传说\hs-script\data\statistics.db')
cur = con.cursor()
rows = cur.execute("""
select id, strategy_id, strategy_name, run_mode, result, experience, start_time, end_time
from records order by id
""").fetchall()
print(f'总记录 {len(rows)}')
print('=' * 80)
for r in rows:
    rid, sid, sname, mode, result, exp, st, en = r
    # experience 字段可能很长，先看长度
    print(f'--- id={rid} sid={sid} name={sname} mode={mode} result={result}')
    print(f'    start={st} end={en} exp_len={len(exp) if exp else 0}')
    if exp:
        print(exp[:500])
        print('    ...(截断)' if len(exp) > 500 else '')
