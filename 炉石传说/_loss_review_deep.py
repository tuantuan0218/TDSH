# -*- coding: utf-8 -*-
"""从 hs_script.log 提取败局复盘所需的关键数据（速败局逐回合行为画像）"""
import io, sys, re, os, glob, datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

LOGDIR = r'D:\tdsh\炉石传说\hs-script\log'
files = sorted(glob.glob(os.path.join(LOGDIR, '*.log')))

# 目标局：HERO_05 全败局 + HERO_07/03 败局（按交接记录的窗口）
TARGETS = [
    # (hero, start_str, end_str, result)  时间均为 2026-09-13 或 09-12
    ('HERO_05', '2026-09-13 13:59:27', '2026-09-13 14:04:05', 'LOSS'),
    ('HERO_05', '2026-09-13 15:30:13', '2026-09-13 15:33:54', 'LOSS'),
    ('HERO_05', '2026-09-13 17:43:03', '2026-09-13 17:47:51', 'LOSS'),
    ('HERO_05', '2026-09-13 18:05:45', '2026-09-13 18:10:17', 'LOSS'),
    ('HERO_05', '2026-09-13 19:32:10', '2026-09-13 19:35:50', 'LOSS'),
    ('HERO_05', '2026-09-13 09:56:56', '2026-09-13 10:16:15', 'LOSS'),
    ('HERO_07', '2026-09-13 13:18:27', '2026-09-13 13:58:19', 'LOSS'),
    ('HERO_07', '2026-09-13 14:59:44', '2026-09-13 15:05:46', 'LOSS'),
    ('HERO_03', '2026-09-13 10:59:10', '2026-09-13 11:50:34', 'LOSS'),
    ('HERO_03', '2026-09-13 19:59:22', '2026-09-13 20:04:55', 'LOSS'),
    # 胜局对照（猎人 2 胜）
    ('HERO_05', '2026-09-13 17:06:23', '2026-09-13 17:15:53', 'WIN'),
    ('HERO_05', '2026-09-13 20:34:04', '2026-09-13 20:41:32', 'WIN'),
    ('HERO_07', '2026-09-13 20:18:22', '2026-09-13 20:24:24', 'WIN'),
]

def load_window(files, t_start, t_end):
    """读取覆盖 [t_start, t_end] 的日志行"""
    out = []
    ts, te = t_start.replace(' ', 'T'), t_end.replace(' ', 'T')
    for f in files:
        base = os.path.basename(f)
        # 日志文件名含日期，粗过滤
        d = t_start[:10]
        if d not in base and 'hs_script.log' != base:
            # 09-12 夜里的局在 09-12.4.log / 09-13.0.log
            pass
        try:
            with open(f, encoding='utf-8', errors='replace') as fh:
                for l in fh:
                    if not l.startswith('2026-'):
                        continue
                    k = l[:19].replace(' ', 'T')
                    if ts <= k <= te:
                        out.append((f, l.rstrip('\n')))
        except Exception as e:
            print('ERR', f, e)
    out.sort(key=lambda x: x[1][:19])
    return out

for hero, s, e, res in TARGETS:
    print('=' * 90)
    print(f'{hero} {s} → {e} {res}')
    lines = load_window(files, s, e)
    print(f'  日志行数: {len(lines)}')
    # 1) 回合结构：我方回合数、每回合耗时、熔断、陈旧、留手豁免
    myturns = [l for _, l in lines if re.search(r'我方回合|轮到我方', l)]
    melta = [l for _, l in lines if '超时熔断' in l]
    stale = [l for _, l in lines if '块陈旧' in l and '直接收回合' in l]
    exempt = [l for _, l in lines if '留手豁免' in l]
    print(f'  我方回合行: {len(myturns)} | 熔断: {len(melta)} | 陈旧收: {len(stale)} | 留手豁免: {len(exempt)}')
    # 2) 出牌行为：打出卡、留手（半落地）、费用浪费
    plays = [l for _, l in lines if re.search(r'打出|点击.*(卡牌|随从|技能|武器|法术)|isPlayCard', l)]
    held = [l for _, l in lines if '留手' in l or '付不起' in l or 'REQ_ENOUGH_MANA' in l]
    half = [l for _, l in lines if '半落地' in l]
    print(f'  出牌行: {len(plays)} | 留手/费拒: {len(held)} | 半落地: {len(half)}')
    # 3) 攻击行为
    atk = [l for _, l in lines if re.search(r'攻击|打脸|打随从', l)]
    print(f'  攻击行: {len(atk)}')
    # 4) 血量轨迹（如果有）
    hp = [l for _, l in lines if re.search(r'(我方|对方).*(血量|生命|HP)|hero.*hp', l, re.I)]
    print(f'  血量行: {len(hp)}')
    # 5) 抽牌
    draws = [l for _, l in lines if re.search(r'抽牌|摸牌|draw', l, re.I)]
    print(f'  抽牌行: {len(draws)}')
    if res == 'LOSS' and hero == 'HERO_05':
        # 猎人速败局打印关键行为样本（前 80 行动作类）
        print('  --- 行为样本（出牌/攻击/熔断/豁免，前 60 条）---')
        key = [l for _, l in lines if re.search(r'打出|点击|攻击|熔断|豁免|留手|半落地|费拒|收回合', l)]
        for l in key[:60]:
            print('   ', l[:180])
