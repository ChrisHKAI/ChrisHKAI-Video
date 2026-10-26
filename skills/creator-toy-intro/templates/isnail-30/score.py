"""Synthesize the film's sound from build/timeline.json: no samples, no words.

120 BPM in G major. Bar 1 a filtered intro and a riser under the sticker peel;
the groove drops when the toy pops (2.0 s): kick, clap, hats, bass and plucks
on G Em C. In act 2 the pinned cover's title pushes out as a rising line of
plucks, the 0 and 1 towers land as booms, and the count ticks up into the lock
(10.0 s). Act 3 breaks down as the cover stands up, the title slams (13.0 s);
the three steps climb in half time, normal time and double time, resolving on
G major at the peak (20.0 s) and ringing out as he flattens back into the
cover. The call to action pops in on 24.0 s with a bouncy groove; the eight
letters play a tune up to the last chord (28.0 s).
Every effect cue lands on its frame. The synth kit is the one from
videos/merge-conflict/scripts/sound.py.

usage: python3 scripts/sound.py   (writes assets/audio/score.wav)
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "engine" / "lib"))
from film import FILM  # noqa: E402  the film workspace (FILM env var)

ROOT = FILM
TL = json.loads((ROOT / "build/timeline.json").read_text())
EV = TL["EV"]
SR = 48000
DUR = TL["DURATION"]
N = int(SR * DUR)
BEAT = TL["BEAT"]
BAR = TL["BAR"]
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



CHORDS = {"G": ["G2", "B2", "D3", "G3"], "Em": ["E2", "G2", "B2", "E3"], "C": ["C3", "E3", "G3", "C4"], "D": ["D3", "F#3", "A3", "D4"], "Am": ["A2", "C3", "E3", "A3"]}
ROOT_OF = {"G": "G1", "Em": "E1", "C": "C1", "D": "D1", "Am": "A1"}
DROP = EV["pop"]
kick_times = []


def groove(t0, t1, mode="normal", gain=1.0):
    """8th-note steps; normal = pop groove, half = heavy, double = 16th hats"""
    b, k = t0, 0
    step = BEAT / 2
    while b < t1 - 1e-6:
        pos = k % 8
        kicks = {"normal": (0, 3, 4), "half": (0,), "double": (0, 3, 4, 6), "light": (0, 4)}[mode]
        if pos in kicks:
            drums.add(kick(big=(pos == 0)), b, gain=gain)
            kick_times.append(b)
        if (mode in ("normal", "double", "light") and pos in (2, 6)) or (mode == "half" and pos == 4):
            drums.add(snare(), b, gain=0.75 * gain, pan=-0.05)
        if mode == "double":
            drums.add(hat(), b, gain=0.8 * gain, pan=0.3)
            drums.add(hat(), b + step / 2, gain=0.5 * gain, pan=0.3)
        else:
            drums.add(hat(open_=(pos == 7 and mode != "half")), b + (0.01 if k % 2 else 0), gain=(0.85 if k % 2 == 0 else 0.55) * gain, pan=0.3)
        b += step
        k += 1


def harmony(t0, t1, prog, plucks=True, growl_on=False, bright=2000, gain=1.0):
    t, bar_ = t0, 0
    while t < t1 - 1e-6:
        ch = prog[bar_ % len(prog)]
        dur = min(BAR, t1 - t)
        r = note(ROOT_OF[ch])
        bass.add(sub(r * 2, dur - 0.02), t, gain=0.85 * gain)
        if growl_on:
            for s in range(4):
                if t + s * BEAT < t1:
                    bass.add(growl(r * 2, BEAT * 0.9), t + s * BEAT, gain=0.7 * gain)
        music.add(pad([note(n) for n in CHORDS[ch]], dur, bright=bright, a=0.05), t, gain=0.75 * gain)
        if plucks:
            ns = CHORDS[ch][1:] + [CHORDS[ch][1][:-1] + str(int(CHORDS[ch][1][-1]) + 1)]
            for s in range(8):
                if t + s * BEAT / 2 < t1:
                    n_ = ns[s % 4]
                    keys.add(pluck(note(n_[:-1] + str(int(n_[-1]) + 2))), t + s * BEAT / 2, gain=0.55 * gain, pan=-0.4 + 0.1 * s)
        t += BAR
        bar_ += 1


# ── Bar 1: intro under the peel ─────────────────────────────────────────────
music.add(pad([note(n) for n in ("G2", "D3", "F#3", "B3")], DROP, bright=700, a=0.8), 0.0, gain=1.0)
for i in range(8):
    drums.add(hat(), i * BEAT / 2 + BEAT / 2, gain=0.15 + 0.35 * i / 8, pan=0.25)
drums.add(kick() * 0.6, 1.0)
drums.add(kick() * 0.7, 1.5)
rt = t_axis(1.2)
riser = sweep_filter(noise(1.2), "highpass", 300, 6000) * (rt / 1.2) ** 2 * 0.45
music.add(np.stack([riser, np.roll(riser, 41)], axis=1), DROP - 1.2)

# ── Bars 2–6: the profile, the counter ──────────────────────────────────────
groove(DROP, EV["count"][0])
harmony(DROP, EV["count"][0], ["G", "Em", "C"])
groove(EV["count"][0], EV["lock"] - 0.12, mode="light")
harmony(EV["count"][0], EV["lock"], ["D"], bright=2600)
roll = EV["count"][0] + BAR / 2
while roll < EV["lock"] - 0.06:  # snare roll that tightens into the lock
    drums.add(snare(), roll, gain=0.25 + 0.55 * (roll - EV["count"][0]) / BAR, pan=0.05)
    roll += BEAT / 4 if roll < EV["lock"] - BEAT else BEAT / 8
rt = t_axis(1.0)
riser = sweep_filter(noise(1.0), "highpass", 500, 7000) * (rt / 1.0) ** 2 * 0.4
music.add(np.stack([riser, np.roll(riser, 37)], axis=1), EV["lock"] - 1.0)
drums.add(kick(big=True), EV["lock"])
kick_times.append(EV["lock"])
groove(EV["lock"], EV["stand"][0])
harmony(EV["lock"], EV["stand"][0], ["G"], bright=2800)

# ── Bar 7: the wall stands, the title slams ─────────────────────────────────
harmony(EV["stand"][0], 14.0, ["Em"], plucks=False, bright=900)
drums.add(kick(big=True), EV["slam"])
kick_times.append(EV["slam"])
# ── Bars 8–10: half time, normal, double ───────────────────────────────────
groove(14.0, 16.0, mode="half")
harmony(14.0, 16.0, ["Em"], plucks=False, growl_on=True, bright=1200)
groove(16.0, 18.0)
harmony(16.0, 18.0, ["C"])
groove(18.0, EV["peak"] - 0.06, mode="double")
harmony(18.0, EV["peak"], ["D"], bright=3000)
rt = t_axis(1.5)
riser = sweep_filter(noise(1.5), "highpass", 400, 8000) * (rt / 1.5) ** 2 * 0.45
music.add(np.stack([riser, np.roll(riser, 29)], axis=1), EV["peak"] - 1.5)
# ── Bars 11–12: G major at the peak, ringing out into the cover ─────────────
gmaj = [note(n) for n in ("G2", "D3", "G3", "B3", "D4", "G4")]
music.add(brass(gmaj, 2.4), EV["peak"], gain=0.6)
groove(EV["peak"], EV["flat"][0], mode="light")
harmony(EV["peak"], EV["flat"][0], ["G", "D"], bright=2600)
RING = EV["repop"] - EV["flat"][1]
music.add(pad([note(n) for n in ("G2", "D3", "B3", "D4", "G4")], RING, bright=2400, a=0.02), EV["flat"][1], gain=1.0)
music.add(brass([note(n) for n in ("G3", "B3", "D4", "G4")], RING), EV["flat"][1], gain=0.4)
bass.add(sub(note("G1") * 2, RING - 0.05), EV["flat"][1])
drums.add(kick(big=True), EV["flat"][1])
kick_times.append(EV["flat"][1])
# ── Bars 13–14: the call to action, a bouncy groove up to the last chord ────
CTA0, FIN = EV["repop"], EV["final"]
drums.add(kick(big=True), CTA0)
kick_times.append(CTA0)
groove(EV["logo"][1], FIN - 0.06, mode="light")
harmony(CTA0, CTA0 + BAR, ["G"], bright=2400)
harmony(CTA0 + BAR, CTA0 + BAR + BEAT * 2, ["C"], bright=2600)
harmony(CTA0 + BAR + BEAT * 2, FIN, ["D"], bright=2800)
rt = t_axis(1.0)
riser = sweep_filter(noise(1.0), "highpass", 500, 8000) * (rt / 1.0) ** 2 * 0.35
music.add(np.stack([riser, np.roll(riser, 31)], axis=1), FIN - 1.0)
END = DUR - FIN
music.add(brass([note(n) for n in ("G2", "D3", "G3", "B3", "D4", "G4")], END), FIN, gain=0.65)
music.add(pad([note(n) for n in ("G2", "D3", "B3", "D4", "G4", "B4")], END, bright=3000, a=0.02), FIN, gain=1.0)
bass.add(sub(note("G1") * 2, END - 0.05), FIN)
drums.add(kick(big=True), FIN)
kick_times.append(FIN)


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



def crash(dur=1.6):
    t = t_axis(dur)
    s = signal.sosfilt(sos("highpass", 4000), noise(dur)) * np.exp(-t / 0.5)
    metal = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) for f in (3870, 5210, 6630, 8120)) * 0.15 * np.exp(-t / 0.3)
    return (s * 0.35 + metal) * 0.6


def peel(dur):
    t = t_axis(dur)
    hiss = signal.sosfilt(sos("bandpass", [900, 7000]), noise(dur)) * (0.3 + 0.7 * t / dur)
    clicks = (rng.random(len(t)) < 0.01 + 0.03 * t / dur) * rng.standard_normal(len(t))
    clicks = signal.sosfilt(sos("highpass", 1500), clicks) * 1.4
    return (hiss * 0.18 + clicks * 0.25) * np.clip((dur - t) / 0.05, 0, 1)


def pop_():
    t = t_axis(0.25)
    blip = np.sin(2 * np.pi * np.cumsum(300 + 1400 * (t / 0.25) ** 0.5) / SR) * np.exp(-t / 0.05) * 0.6
    return plus(blip, click() * 0.6, boing(True) * 0.6, impact() * 0.25)


def tinkles(dur, n=24, amp=0.08):
    out = np.zeros(int((dur + 0.3) * SR))
    for _ in range(n):
        i = int(rng.random() ** 1.6 * dur * SR)
        s = bell(2500 + rng.random() * 5000, 0.2, amp)
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def sink(dur):
    t = t_axis(dur)
    x = noise(dur)
    out = np.zeros_like(x)
    for k in range(0, len(x), 960):
        c = 1600 - 1300 * (k / len(x))
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.5, c * 1.4]), x[k:k + 960])
    drop = np.sin(2 * np.pi * np.cumsum(90 - 50 * t / dur) / SR) * 0.4
    return (out * 0.4 + drop * 0.6) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.2


def lock(big=False):
    return plus(impact(big) * 0.8, crash(1.8 if big else 1.2) * (1.0 if big else 0.7), chime() * 0.6)


def coins(dur, n=26):
    out = np.zeros(int((dur + 0.4) * SR))
    for _ in range(n):
        i = int(rng.random() ** 1.3 * dur * SR)
        f = 3000 + rng.random() * 3500
        t = t_axis(0.18)
        s = (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.47 * t)) * np.exp(-t / 0.05) * 0.09
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def whoosh_up(dur, fast=False):
    dur = max(0.2, dur)
    t = t_axis(dur)
    x = noise(dur)
    out = np.zeros_like(x)
    for k in range(0, len(x), 960):
        c = 300 + (5000 if fast else 2600) * (k / len(x)) ** 1.5
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.6, c * 1.6]), x[k:k + 960])
    return out * np.clip(t / dur, 0, 1) ** 1.2 * np.clip((dur - t) / 0.04, 0, 1) * 0.5


def cardboard(dur, rough=1.0):
    t = t_axis(dur)
    grit = signal.sosfilt(sos("bandpass", [250, 2500]), noise(dur)) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 23 * t)))
    return grit * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8 * 0.22 * rough


def stand(dur):
    t = t_axis(0.5)
    thud = np.sin(2 * np.pi * (60 + 50 * np.exp(-t / 0.04)) * t) * np.exp(-t / 0.15)
    return plus(cardboard(dur, 0.8), np.concatenate([np.zeros(int((dur - 0.1) * SR)), thud * 0.7]))


def slam(soft=False):
    t = t_axis(1.4)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 80 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.45)
    slap = signal.sosfilt(sos("bandpass", [400, 5000]), noise(1.4)) * np.exp(-t / 0.035)
    s = np.tanh(1.6 * (boom * 1.2 + slap * 0.9)) * 0.95
    return s * (0.5 if soft else 1.0)


def debris(dur, n=40):
    out = np.zeros(int((dur + 0.2) * SR))
    for _ in range(n):
        i = int(rng.random() ** 1.4 * dur * SR)
        d = 0.03 + rng.random() * 0.06
        t = t_axis(d)
        s = signal.sosfilt(sos("bandpass", [1000, 6000]), rng.standard_normal(len(t))) * np.sin(np.pi * t / d) * 0.12
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def wood(i):
    t = t_axis(0.3)
    knock = np.sin(2 * np.pi * (95 + 6 * i) * t) * np.exp(-t / 0.07) + 0.5 * np.sin(2 * np.pi * (240 + 12 * i) * t) * np.exp(-t / 0.03)
    clack = signal.sosfilt(sos("bandpass", [600, 3000]), noise(0.3)) * np.exp(-t / 0.012)
    return np.tanh(1.4 * (knock + clack * 0.7)) * 0.75


def suck(dur):
    t = t_axis(dur)
    s = sweep_filter(noise(dur), "lowpass", 400, 7000) * (t / dur) ** 3
    return s * 0.5


def tap():
    t = t_axis(0.15)
    return signal.sosfilt(sos("bandpass", [300, 3000]), noise(0.15)) * np.exp(-t / 0.015) * 0.5 + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.04) * 0.4


def glint(soft=False):
    return plus(bell(note("E7"), 0.7, 0.12 if soft else 0.18), np.concatenate([np.zeros(int(0.05 * SR)), bell(note("B7"), 0.6, 0.08 if soft else 0.12)]))


def push(note_=None, soft=False):
    """a printed piece pushing out of the cover: a card thock (and a pluck)"""
    t = t_axis(0.25)
    thock = np.sin(2 * np.pi * (170 + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.045)
    paper = signal.sosfilt(sos("bandpass", [700, 4000]), noise(0.25)) * np.exp(-t / 0.012)
    s_ = (thock * 0.6 + paper * 0.45) * (0.5 if soft else 0.8)
    if note_:
        s_ = plus(s_, pluck(note(note_), 0.5) * 2.2, bell(note(note_) * 2, 0.4, 0.05))
    return s_


def tower(big=False):
    t = t_axis(0.9)
    boom = np.sin(2 * np.pi * np.cumsum(45 + 70 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.35)
    rise = sweep_filter(noise(0.9), "lowpass", 300, 2500) * np.exp(-t / 0.15) * 0.4
    return np.tanh(1.4 * (boom + rise)) * (0.95 if big else 0.75)


def ticker(dur):
    out = np.zeros(int((dur + 0.1) * SR))
    tt = 0.0
    while tt < dur:
        p = tt / dur
        t = t_axis(0.03)
        f = 2600 + 900 * p
        s_ = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006) * 0.18 + signal.sosfilt(sos("highpass", 4000), rng.standard_normal(len(t))) * np.exp(-t / 0.002) * 0.08
        i = int(tt * SR)
        out[i:i + len(s_)] += s_
        tt += 0.022 + 0.13 * p ** 2.4
    return out


def whoosh_down(dur):
    dur = max(0.2, dur)
    t = t_axis(dur)
    x = noise(dur)
    out = np.zeros_like(x)
    for k in range(0, len(x), 960):
        c = 3200 - 2600 * (k / len(x))
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.6, c * 1.5]), x[k:k + 960])
    flutter = 0.6 + 0.4 * np.sin(2 * np.pi * 14 * t)
    return out * flutter * np.clip(t / dur, 0, 1) ** 0.8 * 0.45


def land():
    return plus(impact() * 0.5, wood(0) * 0.5)


def squelch(dur):
    t = t_axis(dur)
    wob = np.sin(2 * np.pi * np.cumsum(140 + 90 * np.sin(2 * np.pi * 11 * t)) / SR) * 0.35
    goo = signal.sosfilt(sos("lowpass", 900), noise(dur)) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t))
    return (wob + goo * 0.6) * np.sin(np.pi * np.clip(t / dur, 0, 1)) * 0.5


def glide(dur):
    t = t_axis(dur)
    s_ = signal.sosfilt(sos("bandpass", [200, 1200]), noise(dur)) * (0.5 + 0.5 * np.sin(2 * np.pi * 6 * t))
    return s_ * np.clip(t / 0.2, 0, 1) * np.clip((dur - t) / 0.3, 0, 1) * 0.12


def letter(note_, red=False):
    return plus(pluck(note(note_), 0.6) * 2.4, bell(note(note_), 0.8, 0.14 if red else 0.1), click() * 0.15)


def slap(i=0):
    """a sheet of paper slapped onto a board"""
    t = t_axis(0.3)
    smack = signal.sosfilt(sos("bandpass", [500, 6000]), noise(0.3)) * np.exp(-t / 0.018)
    body = np.sin(2 * np.pi * (110 + 15 * i) * t) * np.exp(-t / 0.05)
    rustle = signal.sosfilt(sos("highpass", 2500), noise(0.3)) * np.exp(-t / 0.08) * 0.15
    return (smack * 0.8 + body * 0.5 + rustle) * 0.8


def name_pop(i, handle=False):
    scale = ("G5", "B5", "D6", "G6", "B6", "D7", "G7")
    return plus(bell(note(scale[i % len(scale)]), 0.5, 0.08 if handle else 0.1), click() * 0.12)


def crown_land():
    return plus(bell(note("G6"), 1.0, 0.16), bell(note("D7"), 0.9, 0.1), wood(3) * 0.35)


def place(cue):
    k, t0 = cue["kind"], cue["t"]
    pan = float(np.clip(rng.normal(0, 0.2), -0.5, 0.5))
    send, g = 0.0, 0.9
    if k == "glint":
        sig = glint(cue.get("soft", False)); send = 0.5; pan = 0.2
    elif k == "peel":
        sig = peel(cue["dur"]); pan = -0.1
    elif k == "pop":
        sig = pop_(); pan = 0; send = 0.3; g = 1.0
    elif k == "tinkles":
        sig = tinkles(cue["dur"]); pan = 0; send = 0.3
    elif k == "pomf":
        sig = pomf() * (0.6 if cue.get("soft") else 1.0)
    elif k == "boing":
        sig = boing(cue.get("long", False)) * (0.6 if cue.get("soft") else 1.0)
    elif k == "click":
        sig = plus(click() * 1.3, impact() * 0.35); pan = 0; send = 0.2
    elif k == "sink":
        sig = sink(cue["dur"]); pan = 0; send = 0.2
    elif k == "ding":
        sig = bell(note(cue["note"]), 0.9, 0.22); send = 0.4
    elif k == "lock":
        sig = lock(cue.get("big", False)); pan = 0; send = 0.4; g = 1.0
    elif k == "sparkle":
        sig = sparkle(); pan = 0; send = 0.5
    elif k == "whooshUp":
        sig = whoosh_up(cue["dur"], cue.get("fast", False)); pan = 0
    elif k == "whoosh":
        sig = whoosh(cue["dur"])
    elif k == "stand":
        sig = stand(cue["dur"]); pan = 0; send = 0.2
    elif k == "slide":
        sig = cardboard(cue["dur"], 1.2 if cue.get("long") else 1.0); pan = -0.1
    elif k == "slam":
        sig = slam(cue.get("soft", False)); pan = 0; send = 0.35; g = 1.0
    elif k == "debris":
        sig = debris(cue["dur"]); pan = 0; send = 0.2
    elif k == "wood":
        sig = wood(cue["i"]); pan = -0.3; send = 0.1
    elif k == "coins":
        sig = coins(cue["dur"]); pan = 0.2; send = 0.4
    elif k == "suck":
        sig = suck(cue["dur"]); pan = 0
    elif k == "tap":
        sig = tap(); pan = 0; send = 0.3
    elif k == "push":
        sig = push(cue.get("note"), cue.get("soft", False)); send = 0.25 if cue.get("note") else 0.1
    elif k == "tower":
        sig = tower(cue.get("big", False)); pan = 0; send = 0.3; g = 1.0
    elif k == "ticker":
        sig = ticker(cue["dur"]); pan = 0.2; g = 0.8
    elif k == "whooshDown":
        sig = whoosh_down(cue["dur"]); pan = -0.2
    elif k == "land":
        sig = land(); pan = -0.2; send = 0.2
    elif k == "squelch":
        sig = squelch(cue["dur"]); pan = -0.1
    elif k == "glide":
        sig = glide(cue["dur"]); pan = 0
    elif k == "slap":
        sig = slap(cue["i"]); pan = -0.2 + 0.15 * cue["i"]; send = 0.15
    elif k == "namePop":
        sig = name_pop(cue["i"], cue.get("handle", False)); pan = -0.3 + 0.08 * cue["i"]; send = 0.35
    elif k == "crown":
        sig = crown_land(); pan = 0.1; send = 0.5
    elif k == "letter":
        sig = letter(cue["note"], cue.get("red", False)); pan = -0.4 + 0.1 * (TUNE_I.setdefault(cue["t"], len(TUNE_I))); send = 0.45
    else:
        return
    sfx.add(sig, t0, g, pan)
    if send:
        verb.add(sig, t0, send, pan)


TUNE_I = {}
for cue in TL["cues"]:
    place(cue)

# ── Mix ─────────────────────────────────────────────────────────────────────
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n_ = int(0.2 * SR)
    seg = 1 - 0.45 * np.exp(-np.arange(n_) / SR / 0.06)
    duck[i:i + n_] = np.minimum(duck[i:i + n_], seg[: max(0, min(n_, N - i))])
for b in (music, bass, keys):
    b.x *= duck[:, None]

tt = np.arange(N) / SR
# the slam: a breath before, music hushed for a beat after
for b, k in ((music, 0.35), (bass, 0.3), (keys, 0.0), (drums, 0.0)):
    w = (tt >= EV["slam"] - 0.1) & (tt < EV["slam"])
    b.x[w] *= 0.25
    w = (tt >= EV["slam"] + 0.05) & (tt < 14.0)
    b.x[w] = signal.sosfilt(sos("lowpass", 600), b.x[w], axis=0) * k
# the flatten: everything pulls back into the suck, then the final chord
w = (tt >= EV["flat"][0]) & (tt < EV["flat"][1])
for b in (music, drums, bass, keys):
    b.x[w] *= np.linspace(1, 0.2, w.sum())[:, None]

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
mix *= np.clip((DUR - tt) / 0.8, 0, 1)[:, None]


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


sec = mix[int(DROP * SR):int(EV["count"][0] * SR)]
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
