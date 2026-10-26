"""Synthesize the film's sound from build/timeline.json: no samples, no words.

150 BPM in D minor. Bar 1 a tense pad and ticking hats under the conflict;
bar 2 a riser and a rumble while they charge, cut to silence for the slow-mo;
the drop on the headbutt (3.2 s): kick, snare, hats, a sub and a growling bass
on Dm Bb F C. The freeze (10.8 s) pulls everything into a low-passed hush
that sucks back into the explosion (11.2 s); the dizzy bars go light and
wobbly; Accept Both resolves to D major at 16.0 s and rings out to the title.
Every effect cue lands on its frame.

usage: python3 scripts/sound.py   (writes assets/audio/score.wav)
"""
import json
import wave
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "build/timeline.json").read_text())
EV = TL["EV"]
SR = 48000
DUR = TL["DURATION"]
N = int(SR * DUR)
BEAT = TL["BEAT"]
BAR = TL["BAR"]
DROP = EV["hit"]
FREEZE = (EV["contact"], EV["explode"])
RESOLVE = EV["swapBack"][0]
rng = np.random.default_rng(2026)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


def sos(kind, freq, order=2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def env(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), np.exp(-(t - a) / max(d, 1e-6)) * (1 - s) + s)
    if hold is not None:
        e = np.where(t > hold, e * np.clip(1 - (t - hold) / r, 0, 1), e)
    return e


def sweep_filter(x, kind, f0, f1, chunk=480):
    out = np.zeros_like(x)
    for k in range(0, len(x), chunk):
        c = f0 + (f1 - f0) * (k / max(1, len(x)))
        lo = max(0, k - 2000)
        out[k:k + chunk] = signal.sosfilt(sos(kind, c), x[lo:k + chunk])[-len(x[k:k + chunk]):]
    return out


class Bus:
    def __init__(self):
        self.x = np.zeros((N, 2))

    def add(self, sig, at, gain=1.0, pan=0.0):
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], axis=1)
        i = int(round(at * SR))
        if i >= N:
            return
        j = min(N, i + len(sig))
        k0 = max(0, -i)
        self.x[max(i, 0):j] += sig[k0:j - i] * gain


music, drums, bass, keys, sfx, verb = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()


# ── Instruments ─────────────────────────────────────────────────────────────
def kick(big=False):
    t = t_axis(0.5)
    f = 46 + (140 if big else 110) * np.exp(-t / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.22 if big else 0.15))
    click = signal.sosfilt(sos("highpass", 2500), noise(0.5)) * np.exp(-t / 0.004) * 0.3
    return np.tanh(1.8 * (body + click)) * 0.9


def snare():
    t = t_axis(0.3)
    tone = np.sin(2 * np.pi * 200 * t) * np.exp(-t / 0.05) * 0.5
    nz = signal.sosfilt(sos("bandpass", [1200, 8000]), noise(0.3)) * np.exp(-t / 0.1)
    return signal.sosfilt(sos("lowpass", 10000), tone + nz * 0.7) * 0.75


def hat(open_=False):
    d = 0.22 if open_ else 0.05
    t = t_axis(d)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3180, 4730, 5810, 7270)) * 0.25
    s = signal.sosfilt(sos("highpass", 7000), noise(d) * 0.6 + metal * 0.4)
    return s * np.exp(-t / (0.07 if open_ else 0.011)) * 0.32


def sub(freq, dur):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    return np.tanh(1.3 * s) * env(len(t), a=0.004, d=dur, s=0.8, r=0.05, hold=dur - 0.05) * 0.55


def growl(freq, dur):
    t = t_axis(dur)
    ph = 2 * np.pi * freq * t
    s = signal.sawtooth(ph) + signal.sawtooth(ph * 1.005) + 0.5 * signal.square(ph * 0.5)
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * (2 / BEAT) * t)
    out = np.zeros_like(s)
    for k in range(0, len(s), 240):
        c = 250 + 1600 * lfo[k]
        lo = max(0, k - 1000)
        out[k:k + 240] = signal.sosfilt(sos("lowpass", c), s[lo:k + 240])[-len(s[k:k + 240]):]
    return np.tanh(out * 0.8) * env(len(t), a=0.005, d=dur, s=0.9, r=0.04, hold=dur - 0.04) * 0.3


def pad(freqs, dur, bright=1400, a=0.4):
    t = t_axis(dur)
    s = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for det in (-0.004, 0.0, 0.005):
            s += signal.sawtooth(2 * np.pi * f * (1 + det) * t + i) * 0.2
    s = signal.sosfilt(sos("lowpass", bright), s)
    return s * np.clip(t / a, 0, 1) * np.clip((dur - t) / 0.3, 0, 1) * 0.16


def pluck(freq, dur=0.35):
    t = t_axis(dur)
    mod = np.sin(2 * np.pi * freq * 2 * t) * 1.8 * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / 0.12) * 0.25


def brass(freqs, dur):
    t = t_axis(dur)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            s += signal.sawtooth(2 * np.pi * f * (1 + det) * t) * 0.2
    out = sweep_filter(s, "lowpass", 4200, 900)
    return np.tanh(out * env(len(t), a=0.015, d=0.35, s=0.5, r=1.0, hold=dur - 1.0) * 1.2) * 0.45


def bell(freq, dur=1.0, amp=0.25):
    t = t_axis(dur)
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (dur * d))
            for r, a, d in ((1, 1, 0.5), (2.76, 0.45, 0.2), (5.4, 0.25, 0.1), (8.93, 0.12, 0.05)))
    return s * np.clip(t / 0.001, 0, 1) * amp


CHORDS = {"Dm": ["D3", "F3", "A3", "D4"], "Bb": ["Bb2", "D3", "F3", "Bb3"], "F": ["F3", "A3", "C4", "F4"], "C": ["C3", "E3", "G3", "C4"], "D": ["D3", "F#3", "A3", "D4"], "G": ["G2", "B2", "D3", "G3"], "A": ["A2", "C#3", "E3", "A3"]}
ROOT_OF = {"Dm": "D1", "Bb": "Bb0", "F": "F1", "C": "C1", "D": "D1", "G": "G1", "A": "A1"}
FIGHT = ["Dm", "Bb", "F", "C"]

# ── Bar 1–2: tension ────────────────────────────────────────────────────────
music.add(pad([note(n) for n in CHORDS["Dm"]], DROP, bright=900, a=0.6), 0.0, gain=1.0)
bass.add(sub(note("D1"), DROP - 0.1) * 0.6, 0.0)
for i in range(int(DROP / (BEAT / 2))):
    tt = i * BEAT / 2
    if tt > DROP - 0.12:
        break
    drums.add(hat(), tt, gain=(0.25 + 0.5 * tt / DROP) * (1.0 if i % 2 else 0.6), pan=0.25)
for b in range(4, 8):  # kick heartbeats under the stare-down
    drums.add(kick() * 0.7, b * BEAT)
roll_t = 1.6 + 2 * BEAT
while roll_t < DROP - 0.12:  # snare roll that tightens into the slow-mo
    g = 0.2 + 0.6 * (roll_t - 2.4) / 0.7
    drums.add(snare(), roll_t, gain=g, pan=0.05)
    roll_t += BEAT / 4 if roll_t < 2.8 else BEAT / 8
rt = t_axis(1.5)
riser = sweep_filter(noise(1.5), "highpass", 300, 5000) * (rt / 1.5) ** 2 * 0.5
music.add(np.stack([riser, np.roll(riser, 41)], axis=1), DROP - 1.6)

# ── Drop → freeze: the fight groove ─────────────────────────────────────────
kick_times = []


def groove(t0, t1, half=False, snares=True):
    b = t0
    k = 0
    while b < t1 - 1e-6:
        pos = k % 8  # 8th-note steps in a bar
        if pos in ((0, 4) if half else (0, 3, 5)):
            drums.add(kick(big=(pos == 0 and k % 16 == 0)), b)
            kick_times.append(b)
        if snares and pos in ((4,) if half else (2, 6)):
            drums.add(snare(), b, gain=0.8, pan=-0.05)
        drums.add(hat(open_=(pos == 7)), b + (0.012 if k % 2 else 0), gain=(0.9 if k % 2 == 0 else 0.6), pan=0.3)
        b += BEAT / 2
        k += 1


def harmony(t0, t1, prog, growl_on=True, pluck_on=True):
    bar = 0
    t = t0
    while t < t1 - 1e-6:
        ch = prog[bar % len(prog)]
        dur = min(BAR, t1 - t)
        r = note(ROOT_OF[ch])
        bass.add(sub(r * 2, dur - 0.02), t, gain=0.9)
        if growl_on:
            for s in range(4):
                if t + s * BEAT < t1:
                    bass.add(growl(r * 2, BEAT * 0.9), t + s * BEAT, gain=0.8)
        music.add(pad([note(n) for n in CHORDS[ch]], dur, bright=1800, a=0.05), t, gain=0.8)
        if pluck_on:
            notes = CHORDS[ch][1:] + [CHORDS[ch][1][:-1] + str(int(CHORDS[ch][1][-1]) + 1)]
            for s in range(8):
                if t + s * BEAT / 2 < t1:
                    n_ = notes[s % 4]
                    keys.add(pluck(note(n_[:-1] + str(int(n_[-1]) + 1))), t + s * BEAT / 2 + BEAT / 4, gain=0.6, pan=-0.4 + 0.1 * s)
        t += BAR
        bar += 1


groove(DROP, FREEZE[0])
harmony(DROP, FREEZE[0], FIGHT)
# the freeze: a held high note and a reverse swell into the explosion
ft = t_axis(FREEZE[1] - FREEZE[0])
hold = sum(np.sin(2 * np.pi * note(n) * ft) for n in ("D6", "A6")) * 0.06 * np.clip(ft / 0.05, 0, 1)
music.add(hold, FREEZE[0])
swell = sweep_filter(noise(len(ft) / SR), "lowpass", 300, 8000) * (ft / ft[-1]) ** 3 * 0.6
music.add(np.stack([swell, np.roll(swell, 23)], axis=1), FREEZE[0])
# explosion → rain: half time
groove(FREEZE[1], EV["reassemble"][0], half=True)
harmony(FREEZE[1], EV["reassemble"][0], ["Bb"], pluck_on=False)
# reassembly and dizzy: light, wobbly
harmony(EV["reassemble"][0], EV["shrug"][0], ["Dm"], growl_on=False)
for i in range(8):
    tt = EV["reassemble"][0] + BAR / 2 + i * BEAT / 2
    drums.add(hat(), tt, gain=0.5, pan=0.3)
# shrug → Accept Both: plucky, building
groove(EV["shrug"][0], RESOLVE, snares=False)
harmony(EV["shrug"][0], RESOLVE, ["G", "A"], growl_on=False)
# the resolve: D major, bright brass, happy groove to the end
dmaj = [note(n) for n in ("D3", "A3", "D4", "F#4", "A4", "D5")]
music.add(brass(dmaj, DUR - RESOLVE), RESOLVE, gain=0.65)
groove(RESOLVE, EV["title"][0] + BAR / 2, half=True)
harmony(RESOLVE, EV["title"][0], ["D", "G", "A"], growl_on=False)
music.add(pad([note(n) for n in CHORDS["D"]], DUR - EV["title"][0], bright=2600, a=0.05), EV["title"][0], gain=1.0)
bass.add(sub(note("D2"), DUR - EV["title"][0] - 0.05), EV["title"][0])
drums.add(kick(big=True), EV["title"][0])
kick_times.append(EV["title"][0])


# ── Effects ─────────────────────────────────────────────────────────────────
def impact(big=False):
    t = t_axis(1.2 if big else 0.6)
    boom = np.sin(2 * np.pi * np.cumsum(40 + 90 * np.exp(-t / 0.05)) / SR) * np.exp(-t / (0.5 if big else 0.25))
    crack = signal.sosfilt(sos("bandpass", [600, 6000]), noise(len(t) / SR)) * np.exp(-t / 0.03)
    thud = np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.06)
    return np.tanh(1.5 * (boom * 1.1 + crack * 0.8 + thud * 0.6)) * (0.9 if big else 0.7)


def cube_clacks(dur, n, spread_pow=1.5, amp=0.25):
    out = np.zeros(int(dur * SR) + SR // 4)
    for _ in range(n):
        at = rng.random() ** spread_pow * dur
        f = 1800 + rng.random() * 4500
        tt = t_axis(0.05 + rng.random() * 0.08)
        s = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.012) + signal.sosfilt(sos("highpass", 3000), rng.standard_normal(len(tt))) * np.exp(-tt / 0.004) * 0.5
        i = int(at * SR)
        out[i:i + len(s)] += s * (0.4 + 0.6 * rng.random()) * amp
    return out


def plus(*sigs):
    """sum signals of different lengths"""
    out = np.zeros(max(len(x) for x in sigs))
    for x in sigs:
        out[:len(x)] += x
    return out


def burst():
    return plus(cube_clacks(0.5, 70), impact() * 0.4)


def whoosh(dur):
    dur = max(0.2, dur)
    t = t_axis(dur)
    x = noise(dur)
    out = np.zeros_like(x)
    for k in range(0, len(x), 960):
        c = 400 + 2600 * np.sin(np.pi * k / len(x)) ** 1.5
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.6, c * 1.6]), x[k:k + 960])
    return out * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6 * 0.5


def rumble(dur):
    t = t_axis(dur)
    r = signal.sosfilt(sos("lowpass", 160), noise(dur)) * 3
    return r * np.clip(t / dur, 0, 1) ** 1.5 * np.clip((dur - t) / 0.05, 0, 1) * 0.6


def rewind(dur):
    out = np.zeros(int((dur + 0.1) * SR))
    tt = 0.0
    while tt < dur:
        prog = tt / dur
        t = t_axis(0.03)
        f0 = 2200 - 1400 * prog
        s = np.sin(2 * np.pi * np.cumsum(f0 - 1500 * t / 0.03) / SR) * np.sin(np.pi * t / 0.03) * 0.22
        i = int(tt * SR)
        out[i:i + len(s)] += s
        tt += 0.022 + 0.02 * prog
    return plus(out, cube_clacks(dur, 25, 0.6, 0.15))


def laser(dur):
    t = t_axis(dur)
    f = 180 + 30 * np.sin(2 * np.pi * 7 * t)
    s = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) + 0.6 * signal.square(2 * np.pi * np.cumsum(f * 2.01) / SR)
    s = signal.sosfilt(sos("bandpass", [300, 3000]), s)
    zap = np.sin(2 * np.pi * np.cumsum(3000 * np.exp(-t / 0.08) + 300) / SR) * np.exp(-t / 0.12)
    e = np.clip(t / 0.02, 0, 1) * np.clip((dur - t) / 0.05, 0, 1)
    return (s * 0.25 * e + zap * 0.5)


def spout(dur):
    t = t_axis(dur)
    hiss = signal.sosfilt(sos("bandpass", [500, 5000]), noise(dur)) * (0.6 + 0.4 * np.sin(2 * np.pi * 11 * t))
    gurgle = np.sin(2 * np.pi * np.cumsum(120 + 60 * np.sin(2 * np.pi * 9 * t)) / SR) * 0.4
    e = np.clip(t / 0.3, 0, 1) * np.clip((dur - t) / 0.08, 0, 1)
    return (hiss * 0.4 + gurgle * 0.3) * e


def sizzle(dur):
    t = t_axis(dur)
    crackle = (rng.random(len(t)) < 0.012) * rng.standard_normal(len(t)) * 1.5
    crackle = signal.sosfilt(sos("highpass", 2000), crackle)
    e = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.1, 0, 1)
    return crackle * e * 0.5


def explosion():
    t = t_axis(2.2)
    boom = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-t / 0.12)) / SR) * np.exp(-t / 0.8)
    roar = signal.sosfilt(sos("lowpass", 1800), noise(2.2)) * np.exp(-t / 0.5)
    crack = signal.sosfilt(sos("highpass", 1500), noise(2.2)) * np.exp(-t / 0.05)
    return plus(np.tanh(1.6 * (boom * 1.3 + roar * 0.7 + crack * 0.6)), cube_clacks(0.8, 120, 2.0, 0.2))


def boing(long=False):
    d = 0.3 if long else 0.16
    t = t_axis(d)
    f = (260 + (420 if long else 360) * (t / d) ** 0.7) * (1 + 0.06 * np.sin(2 * np.pi * 28 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), a=0.004, d=d * 0.6) * 0.4


def pomf():
    t = t_axis(0.12)
    return np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.04) * 0.7 + signal.sosfilt(sos("lowpass", 900), noise(0.12)) * np.exp(-t / 0.025) * 0.4


def key_tap():
    t = t_axis(0.06)
    return signal.sosfilt(sos("highpass", 2500), noise(0.06)) * np.exp(-t / 0.004) * 0.5 + np.sin(2 * np.pi * (3200 + 1400 * rng.random()) * t) * np.exp(-t / 0.012) * 0.25


def click():
    t = t_axis(0.15)
    return signal.sosfilt(sos("bandpass", [1500, 4500]), noise(0.15)) * np.exp(-t / 0.006) * 0.9 + np.sin(2 * np.pi * 2000 * t) * np.exp(-t / 0.02) * 0.4


def error_beep():
    out = np.zeros(int(0.4 * SR))
    for k, f in enumerate((660, 440)):
        t = t_axis(0.14)
        s = signal.square(2 * np.pi * f * t) * 0.18 * np.exp(-t / 0.1)
        i = int(k * 0.15 * SR)
        out[i:i + len(s)] += signal.sosfilt(sos("lowpass", 3000), s)
    return out


def chime():
    out = np.zeros(int(1.6 * SR))
    for k, n_ in enumerate(("D6", "F#6", "A6", "D7")):
        s = bell(note(n_), 1.2, 0.2)
        i = int(k * 0.07 * SR)
        out[i:i + len(s)] += s
    return out


def sparkle():
    out = np.zeros(int(1.0 * SR))
    for _ in range(16):
        i = int(rng.random() * 0.6 * SR)
        s = bell(4000 + rng.random() * 5000, 0.25, 0.06)
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def dizzy(dur):
    t = t_axis(dur)
    f = note("A5") * (1 + 0.08 * np.sin(2 * np.pi * 3 * t))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    return s * 0.08 * np.clip(t / 0.1, 0, 1) * np.clip((dur - t) / 0.2, 0, 1)


def shrug():
    t = t_axis(0.35)
    f = 500 + 300 * np.sin(np.pi * t / 0.35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.35) * 0.2


def zip_(dur):
    t = t_axis(dur)
    f = 600 + 2400 * (t / dur)
    s = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 60 * t)))
    return signal.sosfilt(sos("bandpass", [800, 6000]), s) * np.sin(np.pi * t / dur) * 0.2


def bump():
    t = t_axis(0.25)
    return plus(np.sin(2 * np.pi * (180 + 120 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.06) * 0.6, cube_clacks(0.05, 6, 1, 0.2))


def tink(i):
    scale = ("D6", "E6", "F#6", "A6", "B6", "D7", "F#7")
    return plus(bell(note(scale[i % len(scale)]), 0.6, 0.16), cube_clacks(0.03, 3, 1, 0.12))


def freeze_fx(dur):
    t = t_axis(dur)
    return np.sin(2 * np.pi * 70 * t) * 0.2 * np.exp(-t / 0.3)


def place(cue):
    k, t0 = cue["kind"], cue["t"]
    pan = float(np.clip(rng.normal(0, 0.25), -0.6, 0.6))
    send = 0.0
    g = 0.9
    if k == "tick":
        sig = click() * 0.4
    elif k == "error":
        sig = error_beep(); send = 0.3
    elif k == "rumble":
        sig = rumble(cue["dur"]); pan = 0
    elif k == "whoosh":
        sig = whoosh(cue["dur"])
    elif k == "impact":
        sig = impact(cue.get("big", False)); pan = 0; send = 0.3; g = 1.0
    elif k == "burst":
        sig = burst(); pan = 0.2; send = 0.2
    elif k == "keyClick":
        sig = click(); send = 0.2
    elif k == "rewind":
        sig = rewind(cue["dur"]); send = 0.2
    elif k == "pomf":
        sig = pomf() * (0.6 if cue.get("soft") else 1.0)
    elif k == "boing":
        sig = boing(cue.get("long", False))
    elif k == "ding":
        sig = bell(note(cue["note"]), 1.0, 0.3); send = 0.4
    elif k == "keyTap":
        sig = key_tap() * (0.6 if cue.get("soft") else 1.0)
    elif k == "enter":
        sig = click() * 1.2; send = 0.2
    elif k == "laser":
        sig = laser(cue["dur"]); pan = -0.35; g = 0.8
    elif k == "spout":
        sig = spout(cue["dur"]); pan = 0.35; g = 0.9
    elif k == "sizzle":
        sig = sizzle(cue["dur"]); pan = 0
    elif k == "cutoff":
        sig = plus(impact() * 0.4, whoosh(0.3) * 0.5); pan = 0
    elif k == "freeze":
        sig = freeze_fx(cue["dur"]); pan = 0
    elif k == "explosion":
        sig = explosion(); pan = 0; send = 0.35; g = 1.1
    elif k == "tinkles":
        sig = cube_clacks(cue["dur"], 160, 1.6, 0.18); pan = 0; send = 0.2
    elif k == "dizzy":
        sig = dizzy(cue["dur"]); send = 0.3
    elif k == "shrug":
        sig = shrug(); send = 0.2
    elif k == "click":
        sig = plus(click() * 1.3, bell(note("D6"), 0.6, 0.2)); pan = 0; send = 0.3
    elif k == "zip":
        sig = zip_(cue["dur"]); pan = 0
    elif k == "sparkle":
        sig = sparkle(); pan = 0; send = 0.5
    elif k == "chime":
        sig = chime(); pan = 0; send = 0.5
    elif k == "bump":
        sig = bump(); pan = 0; send = 0.2
    elif k == "tink":
        sig = tink(cue["i"]); pan = -0.5 + cue["i"] / 6; send = 0.4
    else:
        return
    sfx.add(sig, t0, g, pan)
    if send:
        verb.add(sig, t0, send, pan)


for cue in TL["cues"]:
    place(cue)

# ── Mix ─────────────────────────────────────────────────────────────────────
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n_ = int(0.2 * SR)
    seg = 1 - 0.5 * np.exp(-np.arange(n_) / SR / 0.06)
    duck[i:i + n_] = np.minimum(duck[i:i + n_], seg[: max(0, min(n_, N - i))])
for b in (music, bass, keys):
    b.x *= duck[:, None]

# slow-mo before the headbutt: the groove-in cuts to a breath
tt = np.arange(N) / SR
gap = np.ones(N)
gap[(tt > DROP - 0.1) & (tt < DROP)] = 0.15
for b in (music, drums, bass, keys):
    b.x *= gap[:, None]

# the freeze: music low-passed and pulled down, sfx untouched
fz = (tt >= FREEZE[0]) & (tt < FREEZE[1])
for b, k in ((music, 0.5), (drums, 0.0), (bass, 0.4), (keys, 0.2)):
    seg = b.x[fz]
    b.x[fz] = signal.sosfilt(sos("lowpass", 500), seg, axis=0) * k

ir_t = t_axis(1.6)
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))], axis=1)
ir *= np.exp(-ir_t / 0.4)[:, None]
ir = signal.sosfilt(sos("lowpass", 6000), ir, axis=0)
ir /= np.sqrt((ir ** 2).sum(axis=0))
send = keys.x * 0.35 + verb.x
wet = np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5

mix = drums.x * 0.85 + bass.x * 0.9 + keys.x * 0.7 + music.x * 0.85 + sfx.x * 0.95 + wet
mix = signal.sosfilt(sos("lowpass", 16000), mix, axis=0)
mix = signal.sosfilt(sos("highpass", 25), mix, axis=0)
mix *= np.clip((DUR - tt) / 0.6, 0, 1)[:, None]


def compress(x, thresh_db=-15, ratio=2.5, attack=0.005, release=0.12):
    level = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.01 * SR))], [1, -np.exp(-1 / (0.01 * SR))], (x ** 2).mean(axis=1)) + 1e-12)
    over = np.maximum(20 * np.log10(level) - thresh_db, 0) * (1 - 1 / ratio)
    out = np.zeros_like(over)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    g = 0.0
    for i in range(len(over)):
        c = a if over[i] > g else r
        g = c * g + (1 - c) * over[i]
        out[i] = g
    return x * (10 ** (-out / 20))[:, None]


def limit(x, ceiling_db=-1.0, look=0.004, release=0.06):
    ceil = 10 ** (ceiling_db / 20)
    need = np.minimum(1.0, ceil / np.maximum(np.abs(x).max(axis=1), 1e-9))
    g = minimum_filter1d(need, size=2 * int(look * SR) + 1)
    r = np.exp(-1 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else r * cur + (1 - r) * g[i]
        out[i] = cur
    return np.clip(x * out[:, None], -ceil, ceil)


sec = mix[int(DROP * SR):int(FREEZE[0] * SR)]
mix *= 10 ** (-9.0 / 20) / max(np.sqrt((sec ** 2).mean()), 1e-9)
mix = limit(compress(mix))

out = ROOT / "assets/audio/score.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
for s0 in np.arange(0, DUR - 1e-6, BAR):
    seg = mix[int(s0 * SR):int((s0 + BAR) * SR)]
    print(f"bar {s0:5.1f}s {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12):6.1f} dB")
print("peak", round(20 * np.log10(np.abs(mix).max()), 2), "dBFS ->", out)
