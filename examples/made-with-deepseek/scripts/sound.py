"""Synthesize the film's sound from build/timeline.json: no samples, no words.

A cute lo-fi beat at 120 BPM (soft pad and ticking hats until the pop, then
kick, snare, swung hats, a rubbery bass on F G Am C, glassy FM keys on the
off-beats, kick pump on the bed; a C major brass stab on Play that rings out
to a 0.5 s fade) plus every effect cue landing on its frame.

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
SR = 48000
DUR = TL["DURATION"]
N = int(SR * DUR)
BEAT = 60 / TL["BPM"]
DROP = TL["EV"]["pop"]
PLAY = TL["EV"]["play"]
rng = np.random.default_rng(2026)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + 12 * (octave + 1) - 69) / 12)


def sos(kind, freq, order=2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.05, hold=None):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    dec = np.exp(-(t - a) / max(d, 1e-6)) * (1 - s) + s
    e = np.where(t >= a, dec, e)
    if hold is not None:
        rel = np.clip(1 - (t - hold) / r, 0, 1)
        e = np.where(t > hold, e * rel, e)
    return e


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


music, drums, bass, keys, sfx, verb_send = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()


# ── Instruments ─────────────────────────────────────────────────────────────
def kick():
    t = t_axis(0.42)
    f = 48 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16)
    click = signal.sosfilt(sos("highpass", 2500), rng.standard_normal(len(t))) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.6 * (body + click)) * 0.9


def snare():
    t = t_axis(0.3)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    nz = signal.sosfilt(sos("bandpass", [1200, 7000]), rng.standard_normal(len(t))) * np.exp(-t / 0.09)
    clap = np.zeros(len(t))
    for d in (0.0, 0.009, 0.019):
        i = int(d * SR)
        seg = signal.sosfilt(sos("bandpass", [900, 3000]), rng.standard_normal(len(t) - i)) * np.exp(-np.arange(len(t) - i) / SR / 0.03)
        clap[i:] += seg * 0.5
    s = tone + nz * 0.55 + clap * 0.5
    return signal.sosfilt(sos("lowpass", 9000), s) * 0.7


def hat(open_=False):
    t = t_axis(0.25 if open_ else 0.06)
    nz = rng.standard_normal(len(t))
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3180, 4730, 5810, 7270)) * 0.25
    s = signal.sosfilt(sos("highpass", 7000), nz * 0.6 + metal * 0.4)
    return s * np.exp(-t / (0.08 if open_ else 0.012)) * 0.35


def fm_key(freq, dur=0.6, idx=2.4):
    t = t_axis(dur)
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * idx * np.exp(-t / 0.06)
    car = np.sin(2 * np.pi * freq * t + mod) * np.exp(-t / 0.35)
    car += 0.3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / 0.15)
    return car * env_adsr(len(t), a=0.002, d=10, s=1.0) * 0.22


def bass_note(freq, dur, glide_from=None):
    t = t_axis(dur)
    f = np.full(len(t), freq)
    if glide_from:
        f = freq + (glide_from - freq) * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * signal.sawtooth(ph)
    # rubbery: filter wah on the attack
    s = np.tanh(1.4 * s)
    e = env_adsr(len(t), a=0.006, d=0.18, s=0.55, r=0.06, hold=dur - 0.06)
    return signal.sosfilt(sos("lowpass", 900), s * e) * 0.5


def pad_chord(freqs, dur, bright=1200):
    t = t_axis(dur)
    s = np.zeros(len(t))
    for i, f in enumerate(freqs):
        for det in (-0.004, 0.0, 0.005):
            s += signal.sawtooth(2 * np.pi * f * (1 + det) * t + i) * 0.2
    s = signal.sosfilt(sos("lowpass", bright), s)
    e = np.clip(t / 0.4, 0, 1) * np.clip((dur - t) / 0.3, 0, 1)
    return s * e * 0.18


def brass(freqs, dur):
    t = t_axis(dur)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            s += signal.sawtooth(2 * np.pi * f * (1 + det) * t) * 0.22
    # filter envelope: bright bite then mellow
    out = np.zeros_like(s)
    chunk = 480
    for k in range(0, len(s), chunk):
        cut = 700 + 3800 * np.exp(-(k / SR) / 0.12)
        out[k:k + chunk] = signal.sosfilt(sos("lowpass", cut), s[max(0, k - 2000):k + chunk])[-len(s[k:k + chunk]):]
    e = env_adsr(len(t), a=0.012, d=0.25, s=0.45, r=0.5, hold=dur - 0.5)
    return np.tanh(out * e * 1.2) * 0.5


CHORDS = {
    "F": ["F3", "A3", "C4", "E4"],
    "G": ["G3", "B3", "D4", "F#4"],
    "Am": ["A3", "C4", "E4", "G4"],
    "C": ["C4", "E4", "G4", "B4"],
}
ROOTS = {"F": "F1", "G": "G1", "Am": "A1", "C": "C2"}
PROG = [("F", 2.0), ("G", 4.0), ("Am", 6.0), ("C", 8.0), ("F", 10.0)]

# ── Music ───────────────────────────────────────────────────────────────────
# intro: soft pad on F, ticking hats that grow
music.add(pad_chord([note(n) for n in CHORDS["F"]], DROP + 0.4, bright=900), 0.0, gain=1.0)
for i in range(int(DROP / (BEAT / 2))):
    tt = i * BEAT / 2
    g = 0.25 + 0.5 * tt / DROP
    drums.add(hat(), tt, gain=g * (1.0 if i % 2 else 0.6), pan=0.25)

# riser into the drop
rt = t_axis(0.5)
riser = signal.sosfilt(sos("highpass", 600), rng.standard_normal(len(rt)))
riser *= (rt / 0.5) ** 2.2 * 0.6
music.add(np.stack([riser, np.roll(riser, 37)], axis=1), DROP - 0.5)

# drop → end
end_beat = 11.5
kick_times = []
b = DROP
while b < end_beat - 1e-6:
    k_in_bar = round((b - DROP) / BEAT) % 4
    if k_in_bar in (0, 2):
        kick_times.append(b)
    if k_in_bar == 2 and int((b - DROP) / (4 * BEAT)) % 2 == 1:
        kick_times.append(b + BEAT * 0.75)
    if k_in_bar in (1, 3) and b < PLAY + 1.0:
        drums.add(snare(), b, gain=0.8, pan=-0.05)
    b += BEAT
for kt in kick_times:
    if kt < end_beat:
        drums.add(kick(), kt, gain=1.0)
# swung 8th hats
h = DROP
step = 0
while h < end_beat:
    swing = 0.03 if step % 2 else 0.0
    vel = 0.55 + 0.35 * rng.random() if step % 2 else 0.9
    drums.add(hat(open_=(step % 8 == 7)), h + swing, gain=vel * 0.9, pan=0.3)
    h += BEAT / 2
    step += 1

# bass and keys on F G Am C
for chord, start in PROG:
    if start >= PLAY:
        break
    root = note(ROOTS[chord])
    pattern = [(0.0, 1.5 * BEAT, 1.0), (1.5 * BEAT, 0.5 * BEAT, 2.0), (2.5 * BEAT, 0.5 * BEAT, 1.0), (3.0 * BEAT, 0.9 * BEAT, 1.5)]
    prev = None
    for off, dur, mult in pattern:
        f = root * mult
        bass.add(bass_note(f, dur, glide_from=prev), start + off, gain=0.95)
        prev = f
    for beat in range(4):
        tt = start + beat * BEAT + BEAT / 2
        for n_ in CHORDS[chord][1:]:
            keys.add(fm_key(note(n_[:-1] + str(int(n_[-1]) + 1)), 0.5), tt, gain=0.55, pan=-0.3 + 0.2 * beat)

# Play: C major brass stab, the chord rings out
cmaj = [note(n) for n in ("C3", "G3", "C4", "E4", "G4", "C5")]
music.add(brass(cmaj, DUR - PLAY), PLAY, gain=0.75)
music.add(pad_chord([note(n) for n in CHORDS["C"]], DUR - PLAY, bright=2000), PLAY, gain=1.0)
bass.add(bass_note(note("C2"), DUR - PLAY - 0.1), PLAY, gain=0.9)

# ── Effects ─────────────────────────────────────────────────────────────────
def noise(dur):
    return rng.standard_normal(int(dur * SR))


def knock():
    t = t_axis(0.25)
    tone = (np.sin(2 * np.pi * 1850 * t) * 0.5 + np.sin(2 * np.pi * 3120 * t) * 0.3) * np.exp(-t / 0.035)
    thump = np.sin(2 * np.pi * 130 * t) * np.exp(-t / 0.05)
    click = signal.sosfilt(sos("highpass", 3000), noise(0.25)) * np.exp(-t / 0.003)
    return tone * 0.5 + thump * 0.8 + click * 0.3


def peel(dur):
    t = t_axis(dur)
    nz = noise(dur)
    out = np.zeros_like(nz)
    for k in range(0, len(nz), 960):
        c = 900 + 4500 * (k / len(nz))
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.7, c * 1.4]), nz[k:k + 960])
    crackle = (rng.random(len(t)) < 0.004) * rng.standard_normal(len(t)) * 2
    e = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.08, 0, 1)
    return (out * 0.6 + crackle * 0.3) * e * 0.7


def pop():
    t = t_axis(1.2)
    f = 90 + 380 * np.exp(-t / 0.02)
    p = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06)
    boom_f = 38 + 34 * np.exp(-t / 0.15)
    boom = np.sin(2 * np.pi * np.cumsum(boom_f) / SR) * np.exp(-t / 0.45)
    glass = np.zeros(len(t))
    for _ in range(36):
        at = rng.random() ** 2 * 0.45
        fr = 2500 + rng.random() * 6500
        i = int(at * SR)
        tt = t[: len(t) - i]
        glass[i:] += np.sin(2 * np.pi * fr * tt) * np.exp(-tt / (0.03 + rng.random() * 0.12)) * (0.2 + rng.random() * 0.3)
    burst = signal.sosfilt(sos("highpass", 2500), noise(1.2)) * np.exp(-t / 0.08) * 0.6
    return p * 0.9 + boom * 1.1 + glass * 0.5 + burst


def boing(long=False):
    d = 0.26 if long else 0.16
    t = t_axis(d)
    f = 260 + (420 if long else 360) * (t / d) ** 0.7
    f *= 1 + 0.06 * np.sin(2 * np.pi * 28 * t)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return s * env_adsr(len(t), a=0.004, d=d * 0.6, s=0.0) * 0.45


def pomf():
    t = t_axis(0.12)
    thump = np.sin(2 * np.pi * (70 + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.04)
    soft = signal.sosfilt(sos("lowpass", 900), noise(0.12)) * np.exp(-t / 0.025)
    return thump * 0.7 + soft * 0.5


def whoosh(dur, soft=False):
    dur = max(0.2, dur)
    t = t_axis(dur)
    nz = noise(dur)
    out = np.zeros_like(nz)
    for k in range(0, len(nz), 960):
        x = k / len(nz)
        c = 400 + 2600 * np.sin(np.pi * x) ** 1.5
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.6, c * 1.6]), nz[k:k + 960])
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    return out * e * (0.25 if soft else 0.5)


def tool_click():
    t = t_axis(0.15)
    click = signal.sosfilt(sos("bandpass", [1800, 4200]), noise(0.15)) * np.exp(-t / 0.006)
    res = np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.02) * 0.4
    out = click * 0.8 + res
    bt = t_axis(0.07)
    blip_ = np.sin(2 * np.pi * np.cumsum(1200 + 700 * bt / 0.07) / SR) * np.exp(-bt / 0.03) * 0.35
    i = int(0.03 * SR)
    out[i:i + len(blip_)] += blip_
    return out


def key_tap():
    t = t_axis(0.05)
    f = 3600 + rng.random() * 1400
    return (signal.sosfilt(sos("highpass", 2500), noise(0.05)) * np.exp(-t / 0.004) * 0.5
            + np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) * 0.25)


def bloop():
    t = t_axis(0.18)
    f = 280 + 900 * (t / 0.18) ** 0.6
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.18) * 0.5


def scribble(dur):
    t = t_axis(dur)
    nz = signal.sosfilt(sos("bandpass", [1800, 5500]), noise(dur))
    am = 0.5 + 0.5 * np.sin(2 * np.pi * (14 + 6 * np.sin(2 * np.pi * 2.3 * t)) * t)
    return nz * am * np.clip(t / 0.03, 0, 1) * np.clip((dur - t) / 0.05, 0, 1) * 0.35


def blip():
    out = np.zeros(int(0.16 * SR))
    for k, f in enumerate((1400, 2100)):
        t = t_axis(0.06)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.025) * 0.35
        i = int(k * 0.06 * SR)
        out[i:i + len(s)] += s
    return out


def thwack():
    t = t_axis(0.3)
    body = np.sin(2 * np.pi * (180 + 200 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05)
    slap = signal.sosfilt(sos("bandpass", [800, 5000]), noise(0.3)) * np.exp(-t / 0.02)
    return np.tanh(2 * (body * 0.8 + slap * 0.9)) * 0.7


def bell(freq, dur=1.2, amp=0.25):
    t = t_axis(dur)
    s = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / (dur * d))
            for r, a, d in ((1, 1, 0.5), (2.76, 0.45, 0.2), (5.4, 0.25, 0.1), (8.93, 0.12, 0.05)))
    return s * env_adsr(len(t), a=0.001, d=99, s=1) * amp


def shimmer():
    out = np.zeros(int(1.6 * SR))
    for k, n_ in enumerate(("C6", "E6", "G6", "B6", "D7", "G7")):
        s = bell(note(n_), 1.0, 0.18)
        i = int(k * 0.045 * SR)
        out[i:i + len(s)] += s
    t = t_axis(1.6)
    nz = signal.sosfilt(sos("highpass", 6000), noise(1.6)) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * t)) * np.exp(-t / 0.5) * 0.12
    return out + nz


def ding(n_):
    return bell(note(n_), 1.3, 0.32)


def rewind(dur):
    out = np.zeros(int((dur + 0.05) * SR))
    k = 0
    tt = 0.0
    while tt < dur:
        prog = tt / dur
        t = t_axis(0.03)
        f0 = 1800 + 2600 * prog
        s = np.sin(2 * np.pi * np.cumsum(f0 + 2000 * t / 0.03) / SR) * np.sin(np.pi * t / 0.03) * 0.25
        i = int(tt * SR)
        out[i:i + len(s)] += s
        tt += 0.04 - 0.015 * prog
        k += 1
    return out


def skate(dur):
    t = t_axis(dur)
    rumble = signal.sosfilt(sos("lowpass", 320), noise(dur)) * (0.8 + 0.2 * np.sin(2 * np.pi * 9 * t))
    e = np.clip(t / 0.1, 0, 1) * np.clip((dur - t) / 0.15, 0, 1)
    return rumble * e * 0.9


def tick():
    t = t_axis(0.03)
    return np.sin(2 * np.pi * 3000 * t) * np.exp(-t / 0.006) * 0.35


def power_down():
    t = t_axis(0.32)
    f = 80 + 1100 * np.exp(-t / 0.08)
    s = signal.square(2 * np.pi * np.cumsum(f) / SR) * 0.3 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    s = signal.sosfilt(sos("lowpass", 3000), s)
    return s * np.exp(-t / 0.12) * 0.5


def yay():
    out = np.zeros(int(0.5 * SR))
    for k, (f0, f1) in enumerate(((620, 1240), (820, 1640), (700, 1500))):
        t = t_axis(0.12)
        f = f0 + (f1 - f0) * (t / 0.12) ** 0.5
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.12) * 0.3
        i = int(k * 0.11 * SR)
        out[i:i + len(s)] += s
    return out


def sparkle():
    out = np.zeros(int(0.9 * SR))
    for _ in range(14):
        i = int(rng.random() * 0.6 * SR)
        s = bell(4000 + rng.random() * 5000, 0.25, 0.07)
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def place(cue):
    k, t0 = cue["kind"], cue["t"]
    pan = float(np.clip(rng.normal(0, 0.25), -0.6, 0.6))
    send = 0.0
    if k == "knock":
        sig = knock(); sfx.add(sig, t0, 1.0, 0.0); send = 0.3
    elif k == "peel":
        sig = peel(cue["dur"]); sfx.add(sig, t0, 1.6, 0.0)
    elif k == "pop":
        sig = pop(); sfx.add(sig, t0, 1.0, 0.0); send = 0.35
    elif k == "boing":
        sig = boing(cue.get("long", False)); sfx.add(sig, t0, 0.8, pan)
    elif k == "pomf":
        sig = pomf(); sfx.add(sig, t0, 0.8, pan)
    elif k == "whoosh":
        sig = whoosh(cue["dur"], cue.get("soft", False)); sfx.add(sig, t0, 0.9, pan)
    elif k == "toolClick":
        sig = tool_click(); sfx.add(sig, t0, 0.9, pan)
    elif k == "keyTap":
        sig = key_tap(); sfx.add(sig, t0, 0.6, pan * 0.5)
    elif k == "bloop":
        sig = bloop(); sfx.add(sig, t0, 0.8, 0.0); send = 0.25
    elif k == "scribble":
        sig = scribble(cue["dur"]); sfx.add(sig, t0, 0.8, 0.0)
    elif k == "blip":
        sig = blip(); sfx.add(sig, t0, 0.8, pan)
    elif k == "thwack":
        sig = thwack(); sfx.add(sig, t0, 1.0, pan); send = 0.2
    elif k == "shimmer":
        sig = shimmer(); sfx.add(sig, t0, 0.8, 0.0); send = 0.5
    elif k == "ding":
        sig = ding(cue["note"]); sfx.add(sig, t0, 0.8, 0.0); send = 0.45
    elif k == "rewind":
        sig = rewind(cue["dur"]); sfx.add(sig, t0, 0.8, 0.0)
    elif k == "skate":
        sig = skate(cue["dur"]); sfx.add(sig, t0, 0.7, 0.0)
    elif k == "tick":
        sig = tick(); sfx.add(sig, t0, 0.7, 0.2)
    elif k == "playClick":
        sig = tool_click(); sfx.add(sig, t0, 1.0, 0.0)
    elif k == "brass":
        return  # part of the music bus
    elif k == "powerDown":
        sig = power_down(); sfx.add(sig, t0, 0.7, pan); send = 0.2
    elif k == "yay":
        sig = yay(); sfx.add(sig, t0, 0.8, 0.0); send = 0.3
    elif k == "sparkle":
        sig = sparkle(); sfx.add(sig, t0, 0.8, 0.0); send = 0.5
    else:
        return
    if send:
        verb_send.add(sig, t0, send, pan)


for cue in TL["cues"]:
    place(cue)

# ── Mix ─────────────────────────────────────────────────────────────────────
# kick pump: duck the bed under every kick
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n_ = int(0.22 * SR)
    seg = 1 - 0.55 * np.exp(-np.arange(n_) / SR / 0.07)
    duck[i:i + n_] = np.minimum(duck[i:i + n_], seg[: max(0, min(n_, N - i))])
for bus in (music, bass, keys):
    bus.x *= duck[:, None]

# a small room: decaying noise impulse response
ir_t = t_axis(1.4)
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))], axis=1)
ir *= np.exp(-ir_t / 0.35)[:, None]
ir = signal.sosfilt(sos("lowpass", 6000), ir, axis=0)
ir /= np.sqrt((ir ** 2).sum(axis=0))
keys_verb = keys.x * 0.35 + verb_send.x
wet = np.stack([signal.fftconvolve(keys_verb[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5

mix = drums.x * 0.9 + bass.x * 0.95 + keys.x * 0.8 + music.x * 0.9 + sfx.x * 0.85 + wet
# lo-fi warmth: gentle tilt and saturation on the music side only
mix = signal.sosfilt(sos("lowpass", 15000), mix, axis=0)

# final fade (chord rings out)
fade_t = np.arange(N) / SR
mix *= np.clip((DUR - fade_t) / 0.5, 0, 1)[:, None]


# master: compressor then limiter at -1 dBFS
def compress(x, thresh_db=-18, ratio=3.0, attack=0.01, release=0.12):
    level = np.sqrt(signal.lfilter([1 - np.exp(-1 / (0.01 * SR))], [1, -np.exp(-1 / (0.01 * SR))], (x ** 2).mean(axis=1)) + 1e-12)
    db = 20 * np.log10(level)
    over = np.maximum(db - thresh_db, 0)
    gr = over * (1 - 1 / ratio)
    # attack/release smoothing of gain reduction
    out = np.zeros_like(gr)
    a, r = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR))
    g = 0.0
    for i in range(len(gr)):
        c = a if gr[i] > g else r
        g = c * g + (1 - c) * gr[i]
        out[i] = g
    return x * (10 ** (-out / 20))[:, None]


def limit(x, ceiling_db=-1.0, look=0.004, release=0.06):
    ceil = 10 ** (ceiling_db / 20)
    peak = np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    w = int(look * SR)
    g = minimum_filter1d(need, size=2 * w + 1)  # centred window = lookahead
    r = np.exp(-1 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else r * cur + (1 - r) * g[i]
        out[i] = cur
    y = x * out[:, None]
    return np.clip(y, -ceil, ceil)


# loudness: drop section RMS to about -12 dBFS before the master chain
sec = mix[int(2.2 * SR):int(10 * SR)]
rms = np.sqrt((sec ** 2).mean())
mix *= 10 ** (-8.0 / 20) / max(rms, 1e-9)
mix = compress(mix, thresh_db=-15, ratio=2.5, attack=0.005)
mix = limit(mix)

out = ROOT / "assets/audio/score.wav"
out.parent.mkdir(parents=True, exist_ok=True)
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

# report loudness per half second
for s0 in np.arange(0, DUR, 0.5):
    seg = mix[int(s0 * SR):int((s0 + 0.5) * SR)]
    print(f"{s0:5.1f}s {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12):6.1f} dB")
print("peak", 20 * np.log10(np.abs(mix).max()), "dBFS ->", out)
