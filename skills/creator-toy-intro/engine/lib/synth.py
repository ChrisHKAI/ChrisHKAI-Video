"""The synth kit: every sound in the films is made here from oscillators,
noise and filters (no samples, no words). Instruments for the score, effects
for the story's cues (place() puts a cue on the sfx bus), and the master's
compressor and limiter. One seeded generator, so a film always sounds the same.

usage (a template's score):
    import synth; synth.setup(duration, beat); from synth import *
"""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d

SR = 48000
N = 0  # samples in the film (setup)
BEAT = 0.5  # seconds per beat (setup): the growl wobbles twice a beat
rng = np.random.default_rng(2026)
TUNE_I = {}


def setup(duration, beat):
    global N, BEAT
    N = int(SR * duration)
    BEAT = beat


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


def place(cue, sfx, verb):
    """An effect for a timeline cue, on the sfx bus (and the reverb send)."""
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


# ── The bed: the effects over long chords ───────────────────────────────────
# What a real creator's film chose in a listening test (the song / one steady
# groove / the effects alone / the effects over a bed): the effects carry the
# picture and one quiet layer of long chords holds it together. No drums, no
# plucks, no bass line; a chord changes with the picture, under an effect.
BED_CHORDS = {"G": ["G2", "D3", "B3", "F#4"], "C": ["C3", "G3", "B3", "E4"], "Em": ["E2", "B2", "G3", "D4"],
              "Am": ["A2", "E3", "G3", "C4"], "D": ["D3", "A3", "F#4", "A4"]}


def bed(bus, changes, dur, xf=0.8):
    """Long chords on a bus from (time, chord) changes to dur: each change an equal-power
    crossfade of xf s centred on it, the first fading in over 1.2 s, every chord as loud as
    the next (the mix sets the bed's level), two detuned voices left and right."""
    for i, (t0, ch) in enumerate(changes):
        t1 = changes[i + 1][0] if i + 1 < len(changes) else dur
        start = max(0.0, t0 - xf / 2)
        d = min(dur, t1 + xf / 2) - start
        tt = t_axis(d)
        fade = np.sin(np.pi / 2 * np.clip(tt / (1.2 if t0 == 0 else xf), 0, 1))
        if t1 < dur:
            fade *= np.cos(np.pi / 2 * np.clip((tt - (d - xf)) / xf, 0, 1))
        freqs = [note(n) for n in BED_CHORDS[ch]]
        for pan, det in ((-0.35, 1.0), (0.35, 1.003)):
            p = pad([f * det for f in freqs], d + 0.4, bright=1300, a=0.01)[: len(tt)]
            p *= 0.03 / max(np.sqrt((p[len(p) // 4: -len(p) // 4] ** 2).mean()), 1e-9)
            bus.add(p * fade, start, pan=pan)


def loudnorm(path, lufs=-13, tp=-1.5):
    """A WAV to lufs integrated and tp true peak in one linear gain (ffmpeg's loudnorm,
    measured first, then applied). Returns the loudness it measured."""
    import json
    import subprocess
    tmp = path.with_suffix(".raw.wav")
    path.replace(tmp)
    target = f"loudnorm=I={lufs}:TP={tp}:LRA=11"
    err = subprocess.run(["ffmpeg", "-v", "info", "-i", str(tmp), "-af", target + ":print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = json.loads(err[err.rfind("{"):err.find("}", err.rfind("{")) + 1])  # the measurement block ffmpeg prints last
    ln = (f"{target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample={SR}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", ln, "-c:a", "pcm_s16le", str(path)], check=True)
    tmp.unlink()
    return float(m["input_i"])
