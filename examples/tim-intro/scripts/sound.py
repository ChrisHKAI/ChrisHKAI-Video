"""The film's sound, cued from build/cues.json (src/timeline.js, src/anim.js):

- the big screen: its edited feed (build/tv/tv.wav) through the hall's speakers
- the folds: a counter tick per fold (they blur into a whirr as the years run),
  a hinge snap each time the phone shuts; louder through the news of his
  death, then nothing from 491 until the last nine
- 《See You Again》 (reference/tim/see-you-again.mp3, the user's file) from the
  black-and-white portrait, as the folds stop: the quiet piano chorus, the
  drums back for the last nine folds, the full band from 500; it plays to its
  own end
- the screen's end, under the piano: crackle as the picture jumps, the
  power-off zip and thump in the hall
- the stage: a soft swell as the big screen comes up in the dark, the clunk
  of the follow spot striking
- a bell when the count reaches 500
- the last word, on the iPhone 4S: the message whooshes off; his reply's chime
  as the band stops; the click of the lock in the quiet

usage: python3 scripts/sound.py   → assets/audio/score.wav (48 kHz stereo)
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
CUE = json.loads((ROOT / "build/cues.json").read_text())
EV = CUE["EV"]
SR = 48000
DUR = CUE["DURATION"]
N = int(SR * DUR)
rng = np.random.default_rng(500)


def load(path, start=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-i", str(path)]
    if dur:
        cmd += ["-t", str(dur)]
    raw = subprocess.run(cmd + ["-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def sos(kind, f, order=2):
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def place(mix, x, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(mix):
        return
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    j = min(len(mix), i + len(x))
    mix[max(0, i):j] += x[max(0, -i):j - i] * gain


def tt(d):
    return np.arange(int(d * SR)) / SR


def room(x, size=0.22, wet=0.18):
    """A small room: an exponentially fading noise impulse response."""
    n = int(size * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 5))
    ir = signal.sosfilt(sos("lowpass", 5000), ir)
    ir /= np.abs(ir).sum() / 6
    out = x.copy()
    for c in range(2):
        out[:, c] = x[:, c] * (1 - wet) + signal.fftconvolve(x[:, c], ir)[: len(x)] * wet
    return out


mix = np.zeros((N, 2), dtype=np.float64)

# ── the big screen ──────────────────────────────────────────────────────────
tv = load(ROOT / "build/tv/tv.wav")[:N].astype(np.float64)
# the keynote, D8 and the news come at different levels: bring each to the same loudness
for a, b in ((EV["keynote"], EV["d8"]), (EV["d8"], EV["news"]), (EV["news"], EV["portrait"])):
    i, j = int(a * SR), int(b * SR)
    rms = np.sqrt((tv[i:j] ** 2).mean()) + 1e-9
    tv[i:j] *= 10 ** (-20 / 20) / rms
tv = signal.sosfilt(sos("bandpass", [90, 9000]), tv, axis=0)
tv = room(tv, 0.5, 0.2)
place(mix, tv, 0.0, 1.6)

# ── the folds ───────────────────────────────────────────────────────────────
def tick():
    d = tt(0.012)
    x = rng.standard_normal(len(d)) * np.exp(-d / 0.0018)
    return signal.sosfilt(sos("bandpass", [2600, 7000]), x)


def snap(bright=1.0):
    d = tt(0.09)
    body = np.sin(2 * np.pi * 820 * d) * np.exp(-d / 0.012) * 0.6
    click = rng.standard_normal(len(d)) * np.exp(-d / 0.004)
    click = signal.sosfilt(sos("bandpass", [1500, 5200 * bright]), click)
    thud = np.sin(2 * np.pi * 160 * d) * np.exp(-d / 0.03) * 0.5
    return body + click + thud


folds = np.zeros_like(mix)
for i, t in enumerate(CUE["ticks"]):
    # quieter as they crowd together, and under the keynote's speech, so they
    # do not swamp the screen; up 8 dB through the news, so that they are
    # heard to stop at 491
    gap = CUE["ticks"][i] - CUE["ticks"][i - 1] if i else 1
    under = 0.55 if t < EV["d8"] else 10 ** (np.interp(t, [EV["news"], EV["portrait"]], [0, 8]) / 20)
    place(folds, tick() * (rng.random() * 0.3 + 0.85), t, (0.16 * min(1, (gap / 0.05) ** 0.5) + 0.03) * under)
mix += folds
for t in CUE["snaps"]:
    last = t > EV["fold9"] - 0.1
    place(mix, snap(1.2 if last else 1.0), t, 0.35 if last else 0.22)

# ── the screen's end ────────────────────────────────────────────────────────
d = tt(EV["off"] - EV["flicker"])
buzz = sum(np.sin(2 * np.pi * 50 * h * d) / h for h in (1, 2, 3, 5, 7))
crack = rng.standard_normal(len(d)) * (rng.random(len(d)) < 0.004)
crack = signal.sosfilt(sos("bandpass", [1200, 9000]), np.convolve(crack, np.exp(-np.arange(200) / 30), "same"))
place(mix, (buzz * 0.08 + crack * 0.6) * np.minimum(1, d / 0.05), EV["flicker"], 0.4)
d = tt(1.2)
f = 1800 * np.exp(-d * 9) + 60
zip_ = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-d / 0.18)
thump = np.sin(2 * np.pi * 45 * d) * np.exp(-d / 0.12)
off = zip_ * 0.25 + thump * 0.6
place(mix, room(np.stack([off, off], 1), 0.7, 0.35), EV["off"], 0.5)

# ── room tone; the stage in the dark ────────────────────────────────────────
tone = signal.sosfilt(sos("lowpass", 500), rng.standard_normal((N, 2)), axis=0)
level = np.interp(np.arange(N) / SR, [0, EV["portrait"], EV["gone"], EV["open"], DUR], [0.012, 0.012, 0.02, 0.02, 0.0])
mix += tone * level[:, None]
# the big screen comes up: a low swell of air and hum
d = tt(1.8)
env = np.sin(np.pi * np.minimum(1, d / 1.8)) ** 2
swell = signal.sosfilt(sos("bandpass", [120, 1400]), rng.standard_normal(len(d))) * env + np.sin(2 * np.pi * 62 * d) * env * 0.5
place(mix, swell, EV["light0"] - 0.2, 0.06)
# the follow spot strikes: the lamp's shutter, a clunk in the hall
d = tt(0.5)
clunk = np.sin(2 * np.pi * 95 * d) * np.exp(-d / 0.05) + signal.sosfilt(sos("bandpass", [900, 4500]), rng.standard_normal(len(d))) * np.exp(-d / 0.008) * 0.7
place(mix, room(np.stack([clunk, clunk], 1), 0.4, 0.35), EV["line"] - 0.02, 0.22)

# ── See You Again, from the portrait to its own end ─────────────────────────
SONG = CUE["SONG"]
song = load(ROOT.parent.parent / "reference/tim/see-you-again.mp3", SONG["start"], DUR - EV["portrait"] + 0.1).astype(np.float64)
k = np.arange(len(song)) / SR
fade = np.minimum(1, k / 0.25) ** 2  # in under the end of the bridge
fade *= np.clip((DUR - EV["portrait"] - k) / 0.6, 0, 1)  # the song ends on its own; only the tail is trimmed
place(mix, song * fade[:, None], EV["portrait"], 0.82)

# ── 500 ─────────────────────────────────────────────────────────────────────
d = tt(2.2)
bell = sum(a * np.sin(2 * np.pi * 1318.5 * r * d) * np.exp(-d / dec) for a, r, dec in ((1, 1, 0.9), (0.5, 2.76, 0.4), (0.25, 5.4, 0.2)))
place(mix, bell, EV["done"], 0.16)

# ── the last word: the iPhone 4S ────────────────────────────────────────────
# sent: air rising through a soft whoosh
d = tt(0.45)
k = d / 0.45
noise = rng.standard_normal(len(d))
whoosh = signal.sosfilt(sos("bandpass", [600, 1800]), noise) * (1 - k) + signal.sosfilt(sos("bandpass", [2500, 7000]), noise) * k
place(mix, whoosh * np.sin(np.pi * k) ** 2, EV["send"], 0.22)
# his reply: two soft bell notes in the song's key (F, then the B-flat above)
def bell_note(f):
    d = tt(1.8)
    tone = sum(a * np.sin(2 * np.pi * f * r * d) * np.exp(-d / dec) for a, r, dec in ((1, 1, 0.55), (0.35, 2.0, 0.25), (0.12, 3.0, 0.12)))
    return tone * (1 - np.exp(-d / 0.002))


place(mix, bell_note(1396.9), EV["reply"], 0.1)
place(mix, bell_note(1864.7), EV["reply"] + 0.11, 0.1)
# the lock: the sleep button's click
d = tt(0.12)
click = signal.sosfilt(sos("bandpass", [1800, 7000]), rng.standard_normal(len(d))) * np.exp(-d / 0.004) + np.sin(2 * np.pi * 240 * d) * np.exp(-d / 0.015) * 0.4
place(mix, click, EV["lock"], 0.35)

peak = np.abs(mix).max()
mix *= 0.89 / peak
out = ROOT / "assets/audio/score.wav"
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print(f"{out}: {DUR:.1f} s, peak normalised from {peak:.2f}")
