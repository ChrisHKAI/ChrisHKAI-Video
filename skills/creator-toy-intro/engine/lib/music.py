"""The user's own song under the film (film.json "sound": "own", "music": {…}).

A song whose beat drifts against the picture sounds wrong even when no one can
say where. A synthesized score with three cuts off the bar was called "好唔順"
twice, and nobody could point at the spot. So the song is put on the film's
grid:
- its tempo is measured (onset envelope, autocorrelation);
- it is stretched to the film's BPM without changing its pitch (ffmpeg atempo,
  when the two are within a quarter of each other);
- it starts where one of its beats lands on the film's first hit.

film.json "music": {"file": "assets/music.mp3", "start": 12.3 (seconds into the
song; otherwise found), "skip": 8 (seconds of intro to leave out when finding
it), "match": false (keep its own tempo), "gain": -8 (dB under the effects)}.
Use a song the creator has the rights to: the platforms check.
"""
import subprocess

import numpy as np
from scipy import signal

SR = 48000


def load(path, atempo=None):
    """A song as float stereo at SR, optionally stretched by ffmpeg's atempo (pitch kept)."""
    af = ["-af", f"atempo={atempo:.6f}"] if atempo else []
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), *af, "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def onsets(x, hop=512, win=2048, band=None):
    """Where the song hits: positive spectral flux, a value per hop (SR / hop a second), the first at t0 s
    (each value sits at the middle of the frame where the energy rose). band (Hz): only those frequencies;
    the kick and the bass are on the beat, where the hats sit between beats."""
    mono = x.mean(axis=1)
    fr, _, Z = signal.stft(mono, SR, nperseg=win, noverlap=win - hop, boundary=None)
    if band:
        Z = Z[(fr >= band[0]) & (fr <= band[1])]
    mag = np.log1p(np.abs(Z) * 100)
    flux = np.maximum(np.diff(mag, axis=1), 0).sum(axis=0)
    flux -= signal.medfilt(flux, 31)
    return np.maximum(flux, 0), SR / hop, (hop + win / 2) / SR


def tempo(env, rate, lo=60, hi=200):
    """Beats a minute: the strongest periodicity of the onsets, folded into 85–170."""
    e = env - env.mean()
    ac = np.correlate(e, e, "full")[len(e) - 1:]
    lags = np.arange(int(rate * 60 / hi), int(rate * 60 / lo) + 1)
    k = lags[np.argmax(ac[lags])]
    bpm = 60 * rate / k
    while bpm < 85:
        bpm *= 2
    while bpm > 170:
        bpm /= 2
    return bpm


def grid(env, rate, t0, bpm):
    """The beat, fitted: (beats a minute, where one falls in seconds). A rough tempo a few tenths off drifts
    a beat apart over a film, so a straight line goes through the song's strongest onsets near the grid."""
    period = 60 / bpm
    f = rate * period
    comb = [env[np.round(np.arange(o, len(env) - 1, f)).astype(int)].sum() for o in range(int(f))]
    ph = t0 + int(np.argmax(comb)) / rate  # the offset that gathers the most onset energy
    pk, _ = signal.find_peaks(env, height=np.percentile(env, 90), distance=max(1, int(f * 0.4)))
    times = t0 + pk / rate
    for _ in range(3):
        k = np.round((times - ph) / period)
        near = np.abs(times - ph - k * period) < 0.2 * period
        if near.sum() < 8:
            break
        period, ph = np.polyfit(k[near], times[near], 1)
    return 60 / period, ph % period


def prepare(spec, film_dir, duration, bpm, first_hit):
    """The song for the film: (stereo samples, duration long; a line saying what was done)."""
    path = film_dir / spec["file"]
    raw = load(path)
    env, rate, t0 = onsets(raw)
    own, _ = grid(env, rate, t0, tempo(env, rate))
    stretch = None
    if spec.get("match", True) and abs(bpm / own - 1) > 0.002 and 0.8 <= bpm / own <= 1.25:
        stretch = bpm / own
    x = load(path, stretch) if stretch else raw
    beat = 60 / (bpm if stretch else own)
    if "start" in spec:
        start = float(spec["start"])
    else:
        # where its beats fall: from the low end (kick, bass) when it has one, else from everything
        low = onsets(x, band=(30, 180))
        _, ph = grid(*(low if low[0].sum() > 0.05 * onsets(x)[0].sum() else onsets(x)), 60 / beat)
        # the first start at or after the skipped intro that puts a beat on the first hit
        start = ph - first_hit + beat * np.ceil((float(spec.get("skip", 0)) - ph + first_hit) / beat)
    i0 = int(round(start * SR))
    n = int(round(duration * SR))
    out = np.zeros((n, 2))
    seg = x[max(0, i0):max(0, i0) + n]
    out[:len(seg)] = seg
    t = np.arange(n) / SR
    out *= np.clip(t / 0.4, 0, 1)[:, None] * np.clip((duration - t) / 1.5, 0, 1)[:, None]
    short = len(seg) < n
    line = (f"music: {path.name}, {own:.1f} BPM" + (f" → {bpm:g} (×{stretch:.3f}, pitch kept)" if stretch else " (its own tempo)")
            + f", from {start:.2f} s of it" + ("" if "start" in spec else f", a beat on {first_hit:g} s") + (" — it ends before the film does" if short else ""))
    return out, line
