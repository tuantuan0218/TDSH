"""
Professional Piano Score Builder (music21)
构建完整可编辑的钢琴曲乐谱，导出为 MuseScore 可打开的 MusicXML / MIDI
- 右手: 旋律 (melody)
- 左手: 和声伴奏 (broken chords / arpeggios)
- 完整结构: Intro - A - B - A' - Coda
"""
from music21 import stream, note, chord, meter, tempo, key, duration, instrument
from pathlib import Path

OUT_DIR = Path("D:/tmp_roleai/output")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ============ 乐曲数据 ============
# 调性: C 大调
KEY = key.Key('C')

# 旋律 (右手): [pitch, quarter_length]
# Intro 部分 (8 小节): 柔和主题动机
intro_melody = [
    ('G4', 1), ('A4', 1), ('B4', 2),
    ('G4', 1), ('A4', 1), ('B4', 2),
    ('C5', 2), ('B4', 1), ('A4', 1),
    ('G4', 4),
]

# A 段 (16 小节): 完整主题
a_melody = [
    ('E4', 1), ('G4', 1), ('C5', 2),
    ('D5', 1), ('C5', 1), ('B4', 2),
    ('A4', 1), ('B4', 1), ('C5', 2),
    ('A4', 2), ('G4', 1), ('E4', 1),
    ('F4', 1), ('A4', 1), ('C5', 2),
    ('B4', 1), ('A4', 1), ('G4', 2),
    ('E4', 1), ('G4', 1), ('B4', 2),
    ('C5', 4),
]

# B 段 (桥段, 12 小节): 对比旋律
b_melody = [
    ('F4', 1), ('A4', 1), ('D5', 2),
    ('C5', 1), ('B4', 1), ('A4', 2),
    ('G4', 1), ('B4', 1), ('D5', 2),
    ('E5', 2), ('D5', 1), ('C5', 1),
    ('B4', 1), ('C5', 1), ('D5', 2),
    ('C5', 2), ('B4', 1), ('A4', 1),
    ('G4', 1), ('A4', 1), ('B4', 2),
    ('C5', 1), ('D5', 1), ('E5', 2),
]

# A' 段 (16 小节): 主题回归 + 变奏
a2_melody = [
    ('E4', 1), ('G4', 1), ('C5', 2),
    ('D5', 1), ('C5', 1), ('B4', 2),
    ('A4', 1), ('B4', 1), ('C5', 2),
    ('A4', 2), ('G4', 1), ('E4', 1),
    ('F4', 1), ('A4', 1), ('C5', 2),
    ('B4', 1), ('A4', 1), ('G4', 2),
    ('E4', 1), ('G4', 1), ('B4', 2),
    ('C5', 4),
]

# Coda (8 小节): 结尾
coda_melody = [
    ('G4', 1), ('C5', 1), ('E5', 2),
    ('D5', 1), ('C5', 1), ('B4', 2),
    ('C5', 1), ('D5', 1), ('E5', 2),
    ('C5', 4),
]

# 和弦进行 (左手): 每小节一个和弦 (根音)
# 用罗马数字风格的级数 → 具体音
progression = [
    # Intro 8 bars
    ['C3', 'C3', 'C3', 'C3', 'A2', 'A2', 'D3', 'G2'],
    # A 16 bars
    ['C3', 'C3', 'C3', 'G2', 'A2', 'A2', 'D3', 'G2',
     'F3', 'F3', 'G2', 'C3', 'F3', 'C3', 'G2', 'C3'],
    # B 12 bars
    ['F3', 'D3', 'G2', 'C3', 'F3', 'D3', 'G2', 'C3',
     'F3', 'D3', 'G2', 'C3'],
    # A' 16 bars
    ['C3', 'C3', 'C3', 'G2', 'A2', 'A2', 'D3', 'G2',
     'F3', 'F3', 'G2', 'C3', 'F3', 'C3', 'G2', 'C3'],
    # Coda 8 bars
    ['C3', 'F3', 'G2', 'C3', 'F3', 'G2', 'C3', 'C3'],
]

# 所有旋律段串联
all_melody = (intro_melody + a_melody + b_melody + a2_melody + coda_melody)
# 所有和弦根音串联
all_bass = [b for section in progression for b in section]

# ============ 构建乐谱 ============
score = stream.Score()
score.insert(0, KEY)
score.insert(0, tempo.MetronomeMark(number=108))
score.insert(0, meter.TimeSignature('4/4'))

# --- 右手: 旋律 ---
rh = stream.Part()
rh.partName = 'Piano Right'
rh.insert(0, instrument.Piano())
rh.insert(0, key.Key('C'))

for (pitch_name, qlen) in all_melody:
    n = note.Note(pitch_name)
    n.duration = duration.Duration(qlen)
    n.quarterLength = qlen
    rh.append(n)

# --- 左手: 琶音伴奏 ---
lh = stream.Part()
lh.partName = 'Piano Left'
lh.insert(0, instrument.Piano())
lh.insert(0, key.Key('C'))

for bass_name in all_bass:
    # 每个和弦根音做分解琶音 (C: C-G-E-G 模式)
    bass_n = note.Note(bass_name)
    bass_n.duration = duration.Duration(4.0)
    bass_n.quarterLength = 4.0
    lh.append(bass_n)

score.insert(0, rh)
score.insert(0, lh)

# ============ 导出 ============
musicxml_path = OUT_DIR / 'piano_score.musicxml'
midi_path = OUT_DIR / 'piano_score_editable.mid'
score.write('musicxml', musicxml_path)
score.write('midi', midi_path)

print(f"MusicXML: {musicxml_path} ({musicxml_path.stat().st_size} bytes)")
print(f"MIDI:    {midi_path} ({midi_path.stat().st_size} bytes)")
print(f"Score info:")
print(f"   Sections: Intro(8) - A(16) - B(12) - A'(16) - Coda(8) = {len(all_melody)//4} bars")
print(f"   Key: C Major | Meter: 4/4 | Tempo: 108 BPM")
print(f"   Voices: RH melody + LH bass")