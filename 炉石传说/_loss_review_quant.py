# -*- coding: utf-8 -*-
"""败局复盘核心量化：逐局统计 出牌率/攻击利用率/费拒率/回合节奏，找策略短板"""
import io, sys, re, os, glob
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

LOGDIR = r'D:\tdsh\炉石传说\hs-script\log'
files = sorted(glob.glob(os.path.join(LOGDIR, '*.log')))

TARGETS = [
    ('HERO_05', '2026-09-13 13:59:27', '2026-09-13 14:04:05', 'LOSS', '4.6min速败'),
    ('HERO_05', '2026-09-13 15:30:13', '2026-09-13 15:33:54', 'LOSS', '3.7min速败'),
    ('HERO_05', '2026-09-13 17:43:03', '2026-09-13 17:47:51', 'LOSS', '4.8min速败'),
    ('HERO_05', '2026-09-13 18:05:45', '2026-09-13 18:10:17', 'LOSS', '4.5min速败'),
    ('HERO_05', '2026-09-13 19:32:10', '2026-09-13 19:35:50', 'LOSS', '3.7min速败'),
    ('HERO_05', '2026-09-13 09:56:56', '2026-09-13 10:16:15', 'LOSS', '19min中长'),
    ('HERO_05', '2026-09-13 17:06:23', '2026-09-13 17:15:53', 'WIN', '9.5min胜局对照'),
    ('HERO_05', '2026-09-13 20:34:04', '2026-09-13 20:41:32', 'WIN', '7.5min胜局对照'),
    ('HERO_07', '2026-09-13 13:18:27', '2026-09-13 13:58:19', 'LOSS', '40min长败'),
    ('HERO_07', '2026-09-13 14:59:44', '2026-09-13 15:05:46', 'LOSS', '6min速败'),
    ('HERO_07', '2026-09-13 20:18:22', '2026-09-13 20:24:24', 'WIN', '6min胜局对照'),
    ('HERO_03', '2026-09-13 10:59:10', '2026-09-13 11:50:34', 'LOSS', '51min超长败'),
    ('HERO_03', '2026-09-13 19:59:22', '2026-09-13 20:04:55', 'LOSS', '5.5min速败'),
]

def load_window(files, t_start, t_end):
    out = []
    ts, te = t_start.replace(' ', 'T'), t_end.replace(' ', 'T')
    for f in files:
        try:
            with open(f, encoding='utf-8', errors='replace') as fh:
                for l in fh:
                    if not l.startswith('2026-'):
                        continue
                    k = l[:19].replace(' ', 'T')
                    if ts <= k <= te:
                        out.append(l.rstrip('\n'))
        except Exception:
            pass
    out.sort(key=lambda x: x[:19])
    return out

def parse_line(l):
    """提取 [卡名(中文名)] 或 【eid|cardId|中文名】攻击【...】"""
    return l

rows = []
print(f"{'职业':6}{'结果':5}{'局长':9}{'我方回合':9}{'真出牌':8}{'落地销账':9}{'费拒':6}{'半落地挂账':10}{'攻击注册':9}{'攻击未注':9}{'熔断':5}{'留手豁免':9}{'英雄技能':8}")
for hero, s, e, res, tag in TARGETS:
    lines = load_window(files, s, e)
    # 我方回合数：用「我方回合开始/轮到我方」类标记；先用攻击行动+出牌回合分隔近似
    # 更稳的口径：回合结束行「因分类账:」每回合一条 → 回合数
    turns = [l for l in lines if '因分类账:' in l]
    nturns = len(turns)
    # 真实出牌 = 落地销账（真实确认打出）+ 链式跳费达成
    land = len([l for l in lines if '半落地销账' in l or '落地销账' in l])
    chain = len([l for l in lines if '链式跳费达成' in l])
    # 费拒
    manarej = len([l for l in lines if 'REQ_ENOUGH_MANA' in l])
    # 半落地挂账（回合末未销账的 eids）
    pend = len([l for l in lines if '回合结束仍有半落地未销账' in l])
    # 攻击注册（CardAction.kt:86 官方注册行）
    atk = len([l for l in lines if 'CardAction.kt:86' in l or '攻击【' in l])
    # 攻击未注册
    atkfail = len([l for l in lines if '攻击未注册' in l or '交换未注册' in l])
    melt = len([l for l in lines if '超时熔断' in l])
    exempt = len([l for l in lines if '留手豁免' in l])
    # 英雄技能（点技能行）
    hero_pow = len([l for l in lines if re.search(r'点选目标.*HERO_|英雄技能|点技能|useHeroPower|isHeroPower', l)])
    rows.append((hero, res, tag, nturns, land, chain, manarej, pend, atk, atkfail, melt, exempt, hero_pow))
    print(f"{hero:6}{res:5}{tag:9}{nturns:6}  {land:6}  {chain:6}  {manarej:6}  {pend:8}  {atk:6}  {atkfail:8}  {melt:5}  {exempt:8}  {hero_pow:6}")

print()
print('口径说明: 真出牌=半落地销账(官方确认落地)/回合; 费拒=REQ_ENOUGH_MANA; 挂账=回合末仍有半落地未销账的回合数; 攻击注册=CardAction 官方行')
print()
# 每回合均值
print('=== 每回合效率（销账/回合 = 每回合真实打出张数）===')
for r in rows:
    hero, res, tag, nturns, land, chain, manarej, pend, atk, atkfail, melt, exempt, hero_pow = r
    if nturns:
        print(f"{hero} {res} {tag:12} 回合{nturns:3} 出牌/回合={land/nturns:.1f} 攻击/回合={atk/nturns:.1f} 费拒/回合={manarej/nturns:.1f} 挂账回合占比={pend/nturns*100:.0f}%")
