"""The outro's sound: the music ("Funky Groove Stomp", from SONG_AT) and the
effects, synthesized and laid on their cues (scripts/timeline.py); no samples.
The synth kit follows videos/merge-conflict/scripts/sound.py.

- the 4S sinking: a soft low whoosh in the quiet left by the Tim film
- the iPhone 18 Pro springing up (a swish into the song's first brass hit),
  its screen waking (a glassy blip), the tap on X, the app opening (a swish)
- the avatar swelling (rubbery wobbles, a riser) and popping into the toy
- the page blowing up behind him (a riser), the app going (a soft whoosh), the
  letters pushing out of it (a low thunk each), his three hops on the C (a
  creak on the second, a crack as it goes), a letter a beat after: each turns
  white under him on the next note of a scale (CLAWD's trick: the ear hears
  the name spelled), drops as he leaves it and lands far below (a distant thud)
- the I going: a beat of quiet, the wind of the fall, the landing on the
  stinger, the glint

usage: python3 scripts/sound.py   (writes assets/audio/score.wav)
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import timeline as T  # noqa: E402

SR = 48000
N = int(SR * T.DURATION)
E = T.EV
rng = np.random.default_rng(23)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def sos(kind, freq, order=2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def plus(*sigs):
    out = np.zeros(max(len(x) for x in sigs))
    for x in sigs:
        out[:len(x)] += x
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


# ── effects ────────────────────────────────────────────────────────────────
def whoosh(dur, lo=400, hi=3000):
    dur = max(0.2, dur)
    t = t_axis(dur)
    x = noise(dur)
    out = np.zeros_like(x)
    for k in range(0, len(x), 960):
        c = lo + (hi - lo) * np.sin(np.pi * k / len(x)) ** 1.5
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.6, c * 1.6]), x[k:k + 960])
    return out * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6 * 0.5


def rise(dur, lo=300, hi=4000):
    """A whoosh that keeps rising to the end (wind of a fall, a riser)."""
    t = t_axis(dur)
    x = noise(dur)
    out = np.zeros_like(x)
    for k in range(0, len(x), 960):
        c = lo * (hi / lo) ** (k / len(x))
        out[k:k + 960] = signal.sosfilt(sos("bandpass", [c * 0.5, c * 1.5]), x[k:k + 960])
    return out * (t / dur) ** 1.4 * 0.5


def pop():
    t = t_axis(0.18)
    body = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t / 0.03) + 180) / SR) * np.exp(-t / 0.05)
    click = signal.sosfilt(sos("highpass", 2000), noise(0.18)) * np.exp(-t / 0.004) * 0.5
    return (body * 0.7 + click) * 0.8


def bell(freq, dur=1.0, amp=0.25):
    t = t_axis(dur)
    s = sum(np.sin(2 * np.pi * freq * m * t) * np.exp(-t * (3 + 4 * m)) / m for m in (1, 2.76, 5.4))
    return s * amp


def sparkle(dur=0.8, n=14):
    out = np.zeros(int((dur + 0.3) * SR))
    for _ in range(n):
        i = int(rng.random() * dur * SR)
        s = bell(4000 + rng.random() * 5000, 0.25, 0.06)
        out[i:i + len(s)] += s[: len(out) - i]
    return out


def click():
    t = t_axis(0.12)
    return signal.sosfilt(sos("bandpass", [1500, 4500]), noise(0.12)) * np.exp(-t / 0.006) * 0.9 + np.sin(2 * np.pi * 2200 * t) * np.exp(-t / 0.02) * 0.35


def wobble(dur=0.45):
    t = t_axis(dur)
    f = 140 + 60 * np.sin(2 * np.pi * 11 * t) * np.exp(-t / 0.3)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 2.02) / SR)
    return signal.sosfilt(sos("lowpass", 1200), s) * np.sin(np.pi * t / dur) * 0.35


def paper(dur=0.4):
    """Paper peeling and tearing: a crackling hiss."""
    t = t_axis(dur)
    grit = (rng.random(len(t)) < 0.06) * rng.standard_normal(len(t))
    hiss = signal.sosfilt(sos("bandpass", [1200, 7000]), noise(dur) * 0.5 + grit * 2.0)
    return hiss * np.clip(t / 0.02, 0, 1) * np.clip((dur - t) / 0.06, 0, 1) * 0.5


def rubble(dur, n, amp=0.25):
    out = np.zeros(int(dur * SR) + SR // 4)
    for _ in range(n):
        at = rng.random() ** 1.6 * dur
        f = 500 + rng.random() * 2500
        tt = t_axis(0.04 + rng.random() * 0.1)
        s = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.02) + signal.sosfilt(sos("bandpass", [400, 4000]), rng.standard_normal(len(tt))) * np.exp(-tt / 0.01) * 0.7
        i = int(at * SR)
        out[i:i + len(s)] += s * (0.3 + 0.7 * rng.random()) * amp
    return out


def slam():
    """A huge stone letter hitting the floor: a boom, a crack, rubble, a rumble."""
    t = t_axis(1.6)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 80 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.55)
    crack = signal.sosfilt(sos("bandpass", [300, 5000]), noise(1.6)) * np.exp(-t / 0.05)
    thud = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.08)
    rumble = signal.sosfilt(sos("lowpass", 140), noise(1.6)) * 2.5 * np.exp(-t / 0.5)
    return plus(np.tanh(1.6 * (boom * 1.2 + crack * 0.7 + thud * 0.7 + rumble * 0.5)) * 0.8, rubble(0.7, 40, 0.18))


def land():
    t = t_axis(0.4)
    thud = np.sin(2 * np.pi * (70 + 90 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.08)
    puff = signal.sosfilt(sos("lowpass", 1200), noise(0.4)) * np.exp(-t / 0.06) * 0.4
    return (thud * 0.8 + puff) * 0.8


def boing():
    t = t_axis(0.22)
    f = (240 + 420 * (t / 0.22) ** 0.7) * (1 + 0.05 * np.sin(2 * np.pi * 28 * t))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * 0.3


def tap():
    t = t_axis(0.12)
    return np.sin(2 * np.pi * (160 + 80 * np.exp(-t / 0.015)) * t) * np.exp(-t / 0.04) * 0.4


def ting():
    return plus(bell(2637, 1.4, 0.32), np.concatenate([np.zeros(int(0.07 * SR)), bell(3951, 1.2, 0.22)]), sparkle(0.5, 8))


# ── the music ──────────────────────────────────────────────────────────────
def load_music():
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / "assets/audio/candidates/3-FunkA-Funky-Groove-Stomp.m4a"),
                          "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
    # re-cut to the picture (scripts/timeline.py EDL): its song beats in film order, each join a 15 ms crossfade
    at = lambda n: int(round((T.FIRST + n * T.BEAT) * SR))
    f = int(0.015 * SR)
    ramp = np.linspace(0, 1, f)[:, None]
    out = None
    for k, (a, b) in enumerate(T.EDL):
        part = x[0 if k == 0 else at(a):len(x) if k == len(T.EDL) - 1 else at(b)]
        if out is None:
            out = part
        else:
            out = np.concatenate([out[:-f], out[-f:] * (1 - ramp) + part[:f] * ramp, part[f:]])
    return out


def main():
    music, sfx = Bus(), Bus()
    music.add(load_music(), T.SONG_AT, 0.62)
    sfx.add(whoosh(1.0, 120, 700), 0.1, 0.25)  # the 4S sinks
    sfx.add(whoosh(0.32, 300, 2600), E["pop"] - 0.3, 0.6)
    sfx.add(pop(), E["pop"], 0.5)
    sfx.add(bell(1760, 0.5, 0.12), E["groove"], 1.0)  # the screen wakes
    sfx.add(click(), E["tap"], 0.7)
    sfx.add(whoosh(0.4, 600, 4000), E["launch"], 0.5)
    for k, t in enumerate((E["bulge"] + 0.3, E["glint"], E["toy"] - 0.3)):
        sfx.add(wobble(), t - 0.1, 0.8, pan=-0.3)
    sfx.add(rise(1.0, 400, 3000), E["toy"] - 1.0, 0.35)
    sfx.add(pop(), E["toy"], 0.9)
    sfx.add(sparkle(0.6, 12), E["toy"], 1.0)
    sfx.add(rise(E["zoomed"] - E["zoom"], 250, 2200), E["zoom"], 0.4)  # the page blows up
    sfx.add(whoosh(0.5, 200, 1200), E["stomp"] - 0.3, 0.35)  # the app goes
    for i, push in enumerate(T.PUSH):  # each letter pushes out of the page
        sfx.add(land() * 0.6, push + 0.05, 0.7 if i == 0 else 0.45, pan=-0.4 + 0.1 * i)
    sfx.add(land(), E["stomp"], 0.8)  # he lands on the C
    scale = [523.3, 587.3, 659.3, 698.5, 784.0, 880.0, 987.8, 1046.5, 1174.7]  # C D E F G A B C D
    steps = [T.beat(n) for n in T.C_HOPS] + [T.beat(n) for n in T.STEP_BEATS]
    for n, land_t in enumerate(steps):
        sfx.add(boing(), land_t - 0.34, 0.5)
        sfx.add(tap(), land_t, 0.8)
    sfx.add(click(), T.beat(T.C_HOPS[1]) + 0.02, 0.6)  # the C creaks
    sfx.add(rubble(0.35, 8, 0.2), T.beat(T.C_HOPS[2]), 0.6)  # and goes
    whites = [T.beat(T.C_HOPS[0])] + [T.beat(n) for n in T.STEP_BEATS]
    for i, t0 in enumerate(whites):  # white under his feet: the next note
        sfx.add(bell(scale[i], 0.6, 0.2), t0 + 0.02, 0.8, pan=-0.4 + 0.1 * i)
    for i, (fall, ld) in enumerate(zip(T.FALL, T.LAND)):
        sfx.add(whoosh(0.35, 300, 1400), fall, 0.3, pan=-0.4 + 0.1 * i)
        sfx.add(land() * 0.35, ld, 0.6, pan=-0.4 + 0.1 * i)  # far below
    sfx.add(rise(E["sting"] - E["fall"], 200, 2500), E["fall"] + 0.05, 0.55)  # the wind of the fall
    sfx.add(land(), E["sting"], 1.0)
    sfx.add(ting(), E["sting"] + 0.04, 0.8, pan=-0.2)

    mix = music.x + sfx.x
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    peak = np.abs(mix).max()
    mix *= 0.89 / peak
    out = ROOT / "assets/audio/score.wav"
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", out, f"{T.DURATION:.2f}s")


if __name__ == "__main__":
    main()
