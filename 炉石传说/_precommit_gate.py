#!/usr/bin/env python3
"""提交前门禁：把"待提交清单"复制进一个临时 git 仓，用已标定过的扫描器扫一遍。
对照台先行（D:/tmp_ts/ctlrepo：阳性必须非 0），否则扫描器的 0 不可信。只读源文件，写盘只在 D:。"""
import subprocess, shutil, os, sys

MINE = [
    '_standup_watch.cjs', '_hive_probe.cjs', '_wait_beat.cjs', '_why_no_ack.cjs',
    '_hive_send_generic.cjs', '_send_hive_msg_standup.cjs', '_make_standup_patch.cjs',
    '_make_heartbeat_body_patch.cjs', '_make_telemetry_patch.cjs',
    '_verify_patch_typecheck.cjs', '_verify_patch_tests.cjs', '_verify_pi_usage_replay.cjs',
    '_probe_pi_session_keys.cjs', '_probe_pi_usage_scoping.cjs', '_classify_hit.py',
    '_doc_lint.cjs', '_hive_track_scan_audit.py', '_body_ack_52569d.txt', '_precommit_gate.py',
    '_heal_loop.cjs', '_wait_ack.cjs', '_verify_telemetry_live.cjs', '_heal_log.json', '_wait_beat.cjs',
]
SRC = r'D:\tdsh\炉石传说'
# argv[1] = 清单文件（每行 "<相对目录>\t<文件名>"），用于提交非默认目录（如 hive/docs 里的诊断文档）。
if len(sys.argv) > 1:
    MINE, SRC = [], None
    ENTRIES = []
    for line in open(sys.argv[1], encoding='utf-8'):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        parts = line.split('\t')
        base = parts[0] if len(parts) > 1 else SRC
        ENTRIES.append((base, parts[-1]))
        MINE.append(parts[-1])
else:
    ENTRIES = [(SRC, f) for f in MINE]
# 每轮用全新的暂存目录：上一轮 `git add` 生成的对象文件在 Windows 上是只读的，
# rmtree(ignore_errors) 会静默留下 .git → 第二次跑就 FileExistsError。复用旧目录=留着脏状态。
STAGE = r'D:\tmp_ts\stage-' + __import__('time').strftime('%H%M%S')
r = subprocess.run([sys.executable, r'D:\tdsh\炉石传说\_hive_track_scan_audit.py', r'D:\tmp_ts\ctlrepo'],
                   capture_output=True, text=True, encoding='utf-8', errors='ignore')
ctl = r.stdout
if '真值形态 1 处' not in ctl:
    print('对照台未复现预期(真值形态 1) → 停止，不得据此宣布"干净"')
    print(ctl[-800:])
    sys.exit(2)
print('对照台 OK：真值形态 1 / credentials:"include" 未误报')

print('\n=== 第二步：把待提交文件放进临时仓并扫 ===')
print('暂存目录:', STAGE)
os.makedirs(STAGE)
subprocess.run(['git', 'init', '-q', '.'], cwd=STAGE)
copied = []
for (base, f) in ENTRIES:
    s = os.path.join(base, f) if base else f
    if os.path.exists(s):
        shutil.copy2(s, os.path.join(STAGE, f))
        copied.append(f)
    else:
        print('  [缺失]', s)
subprocess.run(['git', 'add', '-A'], cwd=STAGE)
r2 = subprocess.run([sys.executable, r'D:\tdsh\炉石传说\_hive_track_scan_audit.py', STAGE],
                    capture_output=True, text=True, encoding='utf-8', errors='ignore')
print('\n'.join(l for l in r2.stdout.splitlines() if '扫描目标' in l or '真值形态' in l or '占位形态' in l or '字段=' in l))
tail = [l for l in r2.stdout.splitlines() if '真值形态' in l][-1]
print(f'\n提交门禁：待提交 {len(copied)} 个文件 | {tail}')
sys.exit(0 if '真值形态 0 处' in tail else 3)
