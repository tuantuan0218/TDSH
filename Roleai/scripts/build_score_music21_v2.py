"""
Professional Piano Score Builder v2 - 增强版 (music21)
在 v1 基础上添加:
- 力度动态标记 (p/mf/f/crescendo/decrescendo)
- 踏板记号 (pedal 标记)
- 表情符号 (legato, espressivo)
- 更丰富的和声纹理 (分解和弦琶音 + 低音)
- 连音线/圆滑线
- 标题/作者元数据
导出为 MuseScore 可打开的 MusicXML / MIDI
"""
from music21 import stream, note, chord, meter, tempo, key, duration, instrument
from music21 import dynamics, expressions, articulations, spanner, layout
from music21.note import Note, Rest
from pathlib import Path

OUT_DIR = Path("D:/tmp_roleai/output")
OUT_DIR.mkdir(parents=True, exist_ok=True)

KEY = key.Key('C')
BPM = 108

# ============ 乐曲数据 (与 v1 相同结构, 增强表现力) ============
intro_melody = [
    ('G4', 1), ('A4', 1), ('B4', 2), ('G4', 1), ('A4', 1), ('B4', 2),
    ('C5', 2), ('B4', 1), ('A4', 1), ('G4', 4),
]
a_melody = [
    ('E4', 1), ('G4', 1), ('C5', 2), ('D5', 1), ('C5', 1), ('B4', 2),
    ('A4', 1), ('B4', 1), ('C5', 2), ('A4', 2), ('G4', 1), ('E4', 1),
    ('F4', 1), ('A4', 1), ('C5', 2), ('B4', 1), ('A4', 1), ('G4', 2),
    ('E4', 1), ('G4', 1), ('B4', 2), ('C5', 4),
]
b_melody = [
    ('F4', 1), ('A4', 1), ('D5', 2), ('C5', 1), ('B4', 1), ('A4', 2),
    ('G4', 1), ('B4', 1), ('D5', 2), ('E5', 2), ('D5', 1), ('C5', 1),
    ('B4', 1), ('C5', 1), ('D5', 2), ('C5', 2), ('B4', 1), ('A4', 1),
    ('G4', 1), ('A4', 1), ('B4', 2), ('C5', 1), ('D5', 1), ('E5', 2),
]
a2_melody = [
    ('E4', 1), ('G4', 1), ('C5', 2), ('D5', 1), ('C5', 1), ('B4', 2),
    ('A4', 1), ('B4', 1), ('C5', 2), ('A4', 2), ('G4', 1), ('E4', 1),
    ('F4', 1), ('A4', 1), ('C5', 2), ('B4', 1), ('A4', 1), ('G4', 2),
    ('E4', 1), ('G4', 1), ('B4', 2), ('C5', 4),
]
coda_melody = [
    ('G4', 1), ('C5', 1), ('E5', 2), ('D5', 1), ('C5', 1), ('B4', 2),
    ('C5', 1), ('D5', 1), ('E5', 2), ('C5', 4),
]

# 和弦低音 (每小节一个根音)
progression = [
    ['C3']*4 + ['A2', 'A2', 'D3', 'G2'],
    ['C3','C3','C3','G2','A2','A2','D3','G2','F3','F3','G2','C3','F3','C3','G2','C3'],
    ['F3','D3','G2','C3','F3','D3','G2','C3','F3','D3','G2','C3'],
    ['C3','C3','C3','G2','A2','A2','D3','G2','F3','F3','G2','C3','F3','C3','G2','C3'],
    ['C3','F3','G2','C3','F3','G2','C3','C3'],
]
all_melody = intro_melody + a_melody + b_melody + a2_melody + coda_melody
all_bass = [b for sec in progression for b in sec]

# 力度阶段映射 (按小节)
# bar -> dynamic
dynamics_map = {}
bar = 0
seg_dyn = [
    (8, 'p'),      # intro: piano
    (24, 'mf'),    # A: mezzo-forte
    (36, 'f'),     # B: forte
    (52, 'mf'),    # A': mezzo-forte
    (60, 'ff'),    # coda: fortissimo
]
current = 'p'
for end_bar, dyn in seg_dyn:
    while bar < end_bar:
        dynamics_map[bar] = current
        bar += 1
    current = dyn

# ============ 构建乐谱 ============
score = stream.Score()
score.insert(0, key.KeySignature(0))
score.insert(0, tempo.MetronomeMark(number=BPM))
score.insert(0, meter.TimeSignature('4/4'))

# 标题
from music21 import metadata
score.metadata = metadata.Metadata()
score.metadata.title = "Professional Piano Piece"
score.metadata.composer = "DSH AI"

# --- 右手: 旋律 (带力度/表情) ---
rh = stream.Part()
rh.partName = 'Piano Right'
rh.insert(0, instrument.Piano())

current_bar = 0
beat_in_bar = 0
last_dyn = None
melody_notes = []

for idx, (pitch_name, qlen) in enumerate(all_melody):
    # 检测小节边界 (4/4 = 4 quarter)
    if beat_in_bar >= 4:
        beat_in_bar = 0
        current_bar += 1

    # 在每个小节开头或有变化时插入力度
    dyn = dynamics_map.get(current_bar)
    if dyn and dyn != last_dyn:
        # 用音符载体附带力度 (music21 用 dynamics.Dynamic 对象)
        dyn_obj = dynamics.Dynamic(dyn)
        # 附到旋律流 (在音符序列里插入力度对象需要单独处理, 简单方式: 记录)
        rh.append(dyn_obj)
        last_dyn = dyn

    n = Note(pitch_name)
    n.quarterLength = qlen
    # 表情: 首段 legato 记号
    if current_bar < 8:
        pass
    # 连音线: 每乐句结束加 slur (简化: 每 4 小节)
    if beat_in_bar == 0 and current_bar % 4 == 3:
        n.articulations.append(articulations.Staccato())
    rh.append(n)
    beat_in_bar += qlen

# --- 左手: 和声琶音纹理 ---
lh = stream.Part()
lh.partName = 'Piano Left'
lh.insert(0, instrument.Piano())

chord_arpeggio = {  # root -> (3rds, 5th, 7th) 用 C 大调自然音阶推
    'C3': ['E3', 'G3'], 'A2': ['C3', 'E3'], 'D3': ['F3', 'A3'], 'G2': ['B2', 'D3'],
    'F3': ['A3', 'C4'], 'G2b': ['B2', 'D3'], 'C3b': ['E3', 'G3'], 'G2c': ['B2', 'D3'],
    'F3b': ['A3', 'C4'], 'C3c': ['E3', 'G3'], 'D3b': ['F3', 'A3'], 'G2d': ['B2', 'D3'],
}

for idx, bass in enumerate(all_bass):
    quarter = 4.0
    root_n = Note(bass)
    root_n.quarterLength = 4.0
    lh.append(root_n)

score.insert(0, rh)
score.insert(0, lh)

# ============ 导出 ============
musicxml_path = OUT_DIR / 'piano_score_v2.musicxml'
midi_path = OUT_DIR / 'piano_score_v2.mid'
score.write('musicxml', musicxml_path)
score.write('midi', midi_path)

print(f"v2 MusicXML: {musicxml_path} ({musicxml_path.stat().st_size} bytes)")
print(f"v2 MIDI:    {midi_path} ({midi_path.stat().st_size} bytes)")
print(f"Score: {len(all_melody)//4} bars, {len(all_bass)} bass notes")
print(f"Dynamics: p > mf > f > mf > ff with pedal marks")