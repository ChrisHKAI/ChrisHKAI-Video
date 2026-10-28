"""铁柱AGI's score, written for this film's own picture (the user: "你忘記之前所有為呢條片配過音樂，
根據影片動作重新配過"): one song from the first frame to the last, no samples, no words.

120 BPM in G major, a bar every 2 s. One four-chord loop, G D Em C, a chord a bar from the toy's pop (2.0 s)
to the end card, so every big moment lands on G: the 万粉 lock (10.0), the 1,500 peak (18.0), the 官方认证
seal (26.0), the kick that sends 不 flying (34.0) and the name (40.0, G again after a C–D turn). The bass and
the pad never stop; the sections only add and take away: drums, plucks, growl, brass. Every change of section
falls on a bar line, with a half-bar fill or a riser leading into it; the picture's cuts (4.5, 12.3, 20.383,
36.383) fall mid-bar and are carried by their whooshes, the music runs straight through them.

  0–2     the page turns: a filtered G pad, hats gathering, a riser into the pop
  2–10    O and the calendar: the groove; from 8 a snare roll tightens into the 万粉 lock
  10–12   万粉: brass, full groove; a fill into act 3
  12–14   act 3 cuts in: half time, the 5 slams on beat 3 (13.0)
  14–16   the wall holds: the groove back, growl bass under it
  16–18   he points, 380 turns gold and counts: double time and a riser into 1,500
  18–20   1,500: brass, the groove; 5天 knocked off, the stars land
  20–26   the envelope and the invitation: a light groove, plucks thinned, a roll into the seal
  26–32   官方认证 and Ben's post: brass, the full groove
  32–34   the line rises a letter a 16th: the groove, a fill into the kick
  34–36   the kick and the line closing (34.5): double time
  36–40   the end card: a light groove, the letters' tune on top, C–D into the name
  40–42   G rings out

Every effect cue lands on its frame (place() from engine/lib/synth.py); the cues the picture does not show
any more (act 3's walk and hops, left in the story after the user cut them) are left out.

usage: FILM=<film folder> python3 template/score.py   (writes assets/audio/score.wav and score-sfx.wav, the effects alone)
"""
import json
import os
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

sys.path.insert(0, "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib")
from film import FILM  # noqa: E402  the film workspace (FILM env var)
import synth  # noqa: E402  the synth kit (engine/lib/synth.py)

ROOT = FILM
TL = json.loads((ROOT / "build/timeline.json").read_text())
EV = TL["EV"]
DUR = TL["DURATION"]
BEAT = TL["BEAT"]
BAR = TL["BAR"]
synth.setup(DUR, TL["BEAT"])
from synth import *  # noqa: E402,F401,F403

music, drums, bass, keys, sfx, verb = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
# SCORE_VARIANT: "bed" (the default, what the user chose after a listening test: "用 D（聲效加輕底音）做正式版") =
# the effects over a quiet bed of long chords; "" = the full song; listening tests: "music" = no effects,
# "steady" = one groove, one density, no fills
VARIANT = os.environ.get("SCORE_VARIANT", "bed")
STEADY = VARIANT == "steady"
kick_times = []

CHORDS = {"G": ["G2", "B2", "D3", "G3"], "Em": ["E2", "G2", "B2", "E3"], "C": ["C3", "E3", "G3", "C4"], "D": ["D3", "F#3", "A3", "D4"]}
ROOT_OF = {"G": "G1", "Em": "E1", "C": "C1", "D": "D1"}
LOOP = ["G", "D", "Em", "C"]
POP, LOCK, SLAM, PEAK, SEAL, KICK, CLOSE, FIN = (EV[k] for k in ("pop", "lock", "slam", "peak", "seal", "kick", "close", "final"))


def chord_at(t):
    """the loop from the pop, a chord a bar; the last bar before the name turns C–D"""
    if t >= FIN:
        return "G"
    if t >= FIN - BAR:
        return "C" if t < FIN - BAR / 2 else "D"
    return LOOP[int((t - POP) // BAR) % 4]


# ── the bed: bass and pad from the pop to the end, never stopping ───────────
# section brightness and density (start, end, pad cutoff, plucks: 0 none / 1 quarters / 2 eighths, growl)
PLAN = [
    (POP, LOCK - 2 * BAR, 1800, 2, False),
    (LOCK - 2 * BAR, LOCK, 2400, 2, False),
    (LOCK, 12.0, 2800, 2, False),
    (12.0, 14.0, 1100, 0, False),
    (14.0, 16.0, 1500, 1, True),
    (16.0, PEAK, 2800, 2, False),
    (PEAK, 20.0, 2800, 2, False),
    (20.0, SEAL, 1600, 1, False),
    (SEAL, 32.0, 2800, 2, False),
    (32.0, KICK, 2200, 1, False),
    (KICK, 36.0, 3000, 2, True),
    (36.0, FIN, 2400, 1, False),
]
for t0, t1, bright, plucks, growl_on in PLAN:
    if STEADY:
        bright, plucks, growl_on = 2200, 2, False
    t = t0
    while t < t1 - 1e-6:
        ch = chord_at(t)
        dur = min(BAR / 2 if FIN - BAR <= t < FIN else BAR, t1 - t)
        r = note(ROOT_OF[ch])
        bass.add(sub(r * 2, dur - 0.01), t, gain=0.85)
        if growl_on:
            for s in range(int(round(dur / BEAT))):
                bass.add(growl(r * 2, BEAT * 0.9), t + s * BEAT, gain=0.55)
        music.add(pad([note(n) for n in CHORDS[ch]], dur + 0.25, bright=bright, a=0.08), t, gain=0.7)
        if plucks:
            ns = CHORDS[ch][1:] + [CHORDS[ch][1][:-1] + str(int(CHORDS[ch][1][-1]) + 1)]
            step = BEAT / 2 if plucks == 2 else BEAT
            for s in range(int(round(dur / step))):
                n_ = ns[s % 4]
                keys.add(pluck(note(n_[:-1] + str(int(n_[-1]) + 2))), t + s * step, gain=0.5, pan=-0.35 + 0.1 * (s % 8))
        t += dur

# ── the drums ───────────────────────────────────────────────────────────────
def groove(t0, t1, mode="normal", gain=1.0):
    """8th-note steps; light = kick on 1 and 3, normal = pop groove, half = heavy, double = 16th hats"""
    if STEADY:
        mode, gain = "normal", 1.0
    b, k = t0, 0
    step = BEAT / 2
    while b < t1 - 1e-6:
        pos = k % 8
        kicks = {"normal": (0, 3, 4), "half": (0,), "double": (0, 3, 4, 6), "light": (0, 4)}[mode]
        if pos in kicks:
            drums.add(kick(big=(pos == 0)), b, gain=gain)
            kick_times.append(b)
        if (mode in ("normal", "double", "light") and pos in (2, 6)) or (mode == "half" and pos == 4):
            drums.add(snare(), b, gain=(0.55 if mode == "light" else 0.75) * gain, pan=-0.05)
        if mode == "double":
            drums.add(hat(), b, gain=0.8 * gain, pan=0.3)
            drums.add(hat(), b + step / 2, gain=0.5 * gain, pan=0.3)
        else:
            drums.add(hat(open_=(pos == 7 and mode != "half")), b + (0.01 if k % 2 else 0), gain=(0.85 if k % 2 == 0 else 0.55) * gain, pan=0.3)
        b += step
        k += 1


def fill(t1, gain=0.7, length=BAR / 4):
    """16th snares rising into t1"""
    if STEADY:
        return
    f = t1 - length
    while f < t1 - 1e-6:
        drums.add(snare(), f, gain=gain * (0.3 + 0.7 * (f - (t1 - length)) / length), pan=0.05)
        f += BEAT / 4


def roll(t0, t1, gain=0.8):
    """a snare roll that tightens into t1: 8ths, then 16ths, then 32nds"""
    if STEADY:
        return
    f = t0
    while f < t1 - 0.04:
        drums.add(snare(), f, gain=gain * (0.25 + 0.75 * (f - t0) / (t1 - t0)), pan=0.05)
        f += BEAT / 2 if f < t1 - BAR / 2 else BEAT / 4 if f < t1 - BEAT else BEAT / 8


def rise(t1, dur, gain=0.4):
    rt = t_axis(dur)
    r = sweep_filter(noise(dur), "highpass", 400, 8000) * (rt / dur) ** 2 * gain
    music.add(np.stack([r, np.roll(r, 37)], axis=1), t1 - dur)


def hit(t, brass_dur=1.4, crash_=True, gain=1.0):
    """a big moment: the big kick, a crash, a brass G"""
    drums.add(kick(big=True), t, gain=gain)
    kick_times.append(t)
    if crash_:
        drums.add(crash(1.8), t, gain=0.55, pan=0.15)
    if brass_dur:
        music.add(brass([note(n) for n in ("G3", "B3", "D4", "G4")], brass_dur), t, gain=0.45)


# 0–2: the page turns
music.add(pad([note(n) for n in ("G2", "D3", "A3", "B3")], POP + 0.3, bright=700, a=1.2), 0.0, gain=0.9)
for i in range(8):
    drums.add(hat(), 1.0 + i * BEAT / 4, gain=0.12 + 0.4 * i / 8, pan=0.25)
drums.add(kick() * 0.6, 1.0)
drums.add(kick() * 0.7, 1.5)
rise(POP, 1.2, 0.45)
hit(POP, brass_dur=0)

# 2–10: O, the drop into the calendar, the count
groove(POP, LOCK - 0.06)
roll(LOCK - BAR, LOCK, gain=0.75)  # from 8: the flips speed up, the roll tightens
rise(LOCK, 1.0)
hit(LOCK)
# 10–12: 万粉
groove(LOCK, 12.0 - 0.06)
fill(12.0, gain=0.6)
# 12–14: act 3 cuts in at 12.3; the 5 slams on beat 3
groove(12.0, 14.0, mode="half", gain=0.9)
drums.add(crash(1.4), SLAM, gain=0.45, pan=-0.1)
kick_times.append(SLAM)
drums.add(kick(big=True), SLAM)
# 14–16: the wall holds
groove(14.0, 16.0)
fill(16.0, gain=0.5)
# 16–18: he points, 380 turns gold, counts up
groove(16.0, PEAK - 0.06, mode="double")
rise(PEAK, 1.5, 0.45)
hit(PEAK, brass_dur=2.0)
# 18–20: 1,500; 5天 knocked off; the stars; he leaps out
groove(PEAK, 20.0 - 0.06)
fill(20.0, gain=0.45)
# 20–26: beat D, the envelope and the invitation
groove(20.0, SEAL - BAR / 2 - 0.06, mode="light", gain=0.9)
roll(SEAL - BAR / 2, SEAL, gain=0.7)
rise(SEAL, 1.0, 0.35)
hit(SEAL, brass_dur=1.6)
# 26–32: 官方认证, Ben's post
groove(SEAL, 32.0 - BAR / 4 - 0.06)
fill(32.0, gain=0.6)
# 32–34: E, the line rises
groove(32.0, KICK - BAR / 4 - 0.06)
fill(KICK, gain=0.75)
rise(KICK, 1.0, 0.35)
hit(KICK, brass_dur=1.2)
# 34–36: the kick, the line closes up (its lock gets a kick over the clap's later burst)
groove(KICK, 36.0 - BAR / 4 - 0.06, mode="double")
drums.add(kick(big=True), CLOSE, gain=1.25)
kick_times.append(CLOSE)
fill(36.0, gain=0.7)
# 36–40: the end card
drums.add(crash(1.6), 36.0, gain=0.4, pan=0.15)
groove(36.0, FIN - BAR / 4 - 0.06, mode="light")
drums.add(kick(), EV["logo"][1], gain=0.8)  # the blob lands (36.7), between the groove's 8ths
kick_times.append(EV["logo"][1])
fill(FIN, gain=0.6)
rise(FIN, 1.0, 0.35)
# 40–42: the name, G rings out
END = DUR - FIN
hit(FIN, brass_dur=END)
music.add(pad([note(n) for n in ("G2", "D3", "B3", "D4", "G4", "B4")], END, bright=3000, a=0.02), FIN, gain=0.9)
bass.add(sub(note("G1") * 2, END - 0.05), FIN)

# ── the effects: every cue the picture still shows ─────────────────────────
A3, POINT = EV["a3"], EV["point7"]


def heard(c):
    # act 3 is a still wall until he points: only the 5 flying in and its slam are on screen
    if A3 <= c["t"] < POINT:
        return c["kind"] in ("slam", "debris", "whoosh")
    # one drop into the end card (the cut's and the story's both fired)
    if c["kind"] == "whooshDown" and EV["gapEnd"] + 0.05 < c["t"] < EV["gapEnd"] + 0.3:
        return False
    return True


for cue in TL["cues"]:
    if heard(cue) and VARIANT != "music":
        place(cue, sfx, verb)

# ── the "bed" variant: the effects over one quiet layer of long chords (14 dB under them) — no drums, no plucks, no bass line
# (the user, after a listening test: the effects alone were the smoothest) — the chord changes with the
# picture (its cuts and big moments, where an effect covers the change), each one crossfading over 0.6 s
if VARIANT == "bed":
    for b_ in (music, drums, bass, keys):
        b_.x[:] = 0
    kick_times.clear()
    BED_CHORDS = {"G": ["G2", "D3", "B3", "F#4"], "C": ["C3", "G3", "B3", "E4"], "Em": ["E2", "B2", "G3", "D4"],
                  "Am": ["A2", "E3", "G3", "C4"], "D": ["D3", "A3", "F#4", "A4"]}
    BED = [(0.0, "G"), (EV["wIn"], "C"), (LOCK, "G"), (EV["a3"], "Em"), (16.75, "C"), (PEAK, "G"),  # C as 380 turns gold
           (EV["dIn"], "C"), (SEAL, "G"), (EV["eIn"], "Am"), (KICK, "D"), (EV["gapEnd"], "G")]
    XF = 0.8  # an equal-power crossfade between chords, centred on the change
    for i, (t0, ch) in enumerate(BED):
        t1 = BED[i + 1][0] if i + 1 < len(BED) else DUR
        start = max(0.0, t0 - XF / 2)
        d = min(DUR, t1 + XF / 2) - start
        freqs = [note(n) for n in BED_CHORDS[ch]]
        tt_ = t_axis(d)
        fade = np.ones(len(tt_))
        fin = 1.2 if t0 == 0 else XF
        fade *= np.sin(np.pi / 2 * np.clip(tt_ / fin, 0, 1))
        if t1 < DUR:
            fade *= np.cos(np.pi / 2 * np.clip((tt_ - (d - XF)) / XF, 0, 1))
        for pan_, det in ((-0.35, 1.0), (0.35, 1.003)):
            p_ = pad([f * det for f in freqs], d + 0.4, bright=1300, a=0.01)[: len(tt_)]
            p_ *= 0.03 / max(np.sqrt((p_[len(p_) // 4: -len(p_) // 4] ** 2).mean()), 1e-9)  # every chord as loud as the next
            music.add(p_ * fade, start, gain=1.0, pan=pan_)

# ── Mix ─────────────────────────────────────────────────────────────────────
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n_ = int(0.2 * SR)
    seg = 1 - 0.4 * np.exp(-np.arange(n_) / SR / 0.06)
    duck[i:i + n_] = np.minimum(duck[i:i + n_], seg[: max(0, min(n_, N - i))])
for b in (music, bass, keys):
    b.x *= duck[:, None]

tt = np.arange(N) / SR
ir_t = t_axis(1.6)
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))], axis=1)
ir *= np.exp(-ir_t / 0.4)[:, None]
ir = signal.sosfilt(sos("lowpass", 6000), ir, axis=0)
ir /= np.sqrt((ir ** 2).sum(axis=0))
send = keys.x * 0.35 + music.x * 0.15 + verb.x
wet = np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5

if VARIANT == "bed":  # the bed sits 14 dB under the effects (measured over 2–40 s), whatever the effects' level
    _r = lambda a_: np.sqrt((a_[int(2 * SR):int(40 * SR)] ** 2).mean())  # noqa: E731
    music.x *= _r(sfx.x) * 10 ** (-14 / 20) / max(_r(music.x), 1e-9)
    wet = np.stack([signal.fftconvolve((music.x * 0.15 + verb.x)[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5
mix = drums.x * 0.85 + bass.x * 0.9 + keys.x * 0.7 + music.x * 0.85 + sfx.x * 0.85 + wet
mix = signal.sosfilt(sos("lowpass", 16000), mix, axis=0)
mix = signal.sosfilt(sos("highpass", 25), mix, axis=0)
mix *= np.clip((DUR - tt) / 0.8, 0, 1)[:, None]

sec = mix[int(2 * SR):int(40 * SR)] if VARIANT == "bed" else mix[int(POP * SR):int(LOCK * SR)]  # the bed: by the whole film
level = 10 ** (-9.0 / 20) / max(np.sqrt((sec ** 2).mean()), 1e-9)
mix *= level
mix = limit(compress(mix), ceiling_db=-1.4)  # a -1.0 sample-peak ceiling came out -0.9 dBTP after AAC

# the same sound effects without the music, at the level they have in the mix
sfx_wet = np.stack([signal.fftconvolve(verb.x[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5
fx = sfx.x * 0.85 + sfx_wet
fx = signal.sosfilt(sos("lowpass", 16000), fx, axis=0)
fx = signal.sosfilt(sos("highpass", 25), fx, axis=0)
fx *= np.clip((DUR - tt) / 0.8, 0, 1)[:, None]
fx = limit(compress(fx * level))


def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


out = ROOT / "assets/audio/score.wav"
write(out, mix)
if VARIANT == "bed":  # to -13 LUFS, true peak -1.5, in one linear gain (ffmpeg loudnorm, measured first)
    import subprocess
    tmp = out.with_suffix(".raw.wav")
    out.replace(tmp)
    err = subprocess.run(["ffmpeg", "-v", "info", "-i", str(tmp), "-af", "loudnorm=I=-13:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = json.loads(err[err.rfind("{"):err.find("}", err.rfind("{")) + 1])  # the measurement block ffmpeg prints last
    ln = (f"loudnorm=I=-13:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", ln, "-c:a", "pcm_s16le", str(out)], check=True)
    tmp.unlink()
    print("loudness", m["input_i"], "-> -13 LUFS")
write(ROOT / "assets/audio/score-sfx.wav", fx)
for s0 in np.arange(0, DUR - 1e-6, BAR):
    seg = mix[int(s0 * SR):int((s0 + BAR) * SR)]
    print(f"bar {s0:5.1f}s {chord_at(s0) if s0 >= POP else '-':2s} {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12):6.1f} dB")
print("peak", round(20 * np.log10(np.abs(mix).max()), 2), "dBFS ->", out)
