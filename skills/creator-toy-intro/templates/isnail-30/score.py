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
Every effect cue lands on its frame; instruments and effects come from the
synth kit (engine/lib/synth.py), the arrangement and the mix are this story's.

That is the song: film.json "sound": "song", and a film.json without "sound".
The other sounds leave the arrangement out:
- "bed", which new films start with: the effects over one quiet layer of long
  chords, 14 dB under them. G at the start; a part coming in moves away, its
  big moment comes home to G; D into the end card. A creator chose it after
  hearing them all: the song was "好唔順".
- "strings": the same chords on a real string section, a piano touching each
  change (engine/lib/real.py: sampled instruments).
- "fx": the effects alone.
"band" keeps the arrangement and plays it on real instruments, each as loud
as the synthesized one it replaces. The real instruments' credits go to
build/credits.txt.
- "own": the creator's own song (film.json "music", engine/lib/music.py),
  stretched to the film's tempo and set so a beat lands on the first hit,
  giving way under each loud effect.
These three come out at -13 LUFS. `run.mjs listen` lays each one under the
animatic, so the user chooses by ear. SOUND and SCORE_OUT, set in the
environment, write one version without touching the film's own sound.

usage: FILM=<film folder> python3 templates/isnail-30/score.py   (writes assets/audio/score.wav and score-sfx.wav, the effects alone)
"""
import json
import os
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in,
# so a film's own copy of the template (film.json "template": "./template") finds it too
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
import synth  # noqa: E402  the synth kit (engine/lib/synth.py)

ROOT = FILM
# the sound: film.json "sound", or SOUND for one version of a listening test (run.mjs listen)
SOUND = os.environ.get("SOUND") or FILM_JSON.get("sound", "song")
if SOUND not in ("song", "band", "bed", "strings", "fx", "own"):
    raise SystemExit(f'film.json "sound" is "song", "band", "bed", "strings", "fx" or "own", not "{SOUND}"')
if SOUND == "own" and not (FILM_JSON.get("music") or {}).get("file"):
    raise SystemExit('"sound": "own" needs film.json "music": {"file": "assets/<their song>"}')
TL = json.loads((ROOT / "build/timeline.json").read_text())
# the film may be pieces of the story between beats (SEGMENTS): the music below is
# written on the story's own clock, then each piece goes where the film plays it
SEGS = TL.get("SEGMENTS")
EV = TL["STORY"]["EV"] if SEGS else TL["EV"]
DUR = TL["STORY"]["DURATION"] if SEGS else TL["DURATION"]
BEAT = TL["BEAT"]
BAR = TL["BAR"]
synth.setup(DUR, TL["BEAT"])
from synth import *  # noqa: E402,F401,F403
if SOUND == "band":  # the arrangement below on real instruments, each as loud as the synthesized one it replaces
    import real
    globals().update(real.band(synth))


music, drums, bass, keys, sfx, verb = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()


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


if not SEGS:  # with segments the cues are the film's: placed once the film's buses are made
    for cue in TL["cues"]:
        place(cue, sfx, verb)

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

# the loudness reference: bars 2–4, the groove under the profile
L0, L1 = DROP, EV["count"][0]
if SEGS:
    # ── the film: each piece of the story where it plays, each beat on its own bars ──
    story = {"music": music.x, "drums": drums.x, "bass": bass.x, "keys": keys.x}
    DUR = TL["DURATION"]
    synth.setup(DUR, BEAT)
    N = synth.N
    music, drums, bass, keys, sfx, verb = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    kick_times = []
    fade = int(0.012 * SR)  # a joint is a cut on a downbeat: no click
    for k, s in enumerate(SEGS):
        i0, i1 = int(round(s["f0"] * SR)), min(N, int(round(s["f1"] * SR)))
        if s["kind"] == "story":
            j0 = int(round(s["s0"] * SR))
            n = min(i1 - i0, len(story["music"]) - j0)
            ramp = np.ones(n)
            if k > 0:
                ramp[:fade] = np.linspace(0, 1, fade)
            if k < len(SEGS) - 1:
                ramp[-fade:] = np.minimum(ramp[-fade:], np.linspace(1, 0, fade))
            for name, b in (("music", music), ("drums", drums), ("bass", bass), ("keys", keys)):
                b.x[i0:i0 + n] += story[name][j0:j0 + n] * ramp[:, None]
            continue
        # a beat's music (its module's "music"): a groove, a progression, big kicks on its hits
        m = s.get("music") or {}
        f0, f1 = s["f0"], s["f1"]
        if m.get("groove", "light") != "none":
            groove(f0, f1 - 0.06, mode=m.get("groove", "light"))
        harmony(f0, f1, m.get("chords", ["G", "Em", "C", "D"]), bright=m.get("bright", 2200))
        for h in [0.0, *m.get("hits", [])]:
            drums.add(kick(big=True), f0 + h)
            kick_times.append(f0 + h)
            if h > 1.0:  # a riser into each hit after the first bar
                rt = t_axis(1.0)
                riser = sweep_filter(noise(1.0), "highpass", 450, 7000) * (rt / 1.0) ** 2 * 0.35
                music.add(np.stack([riser, np.roll(riser, 31)], axis=1), f0 + h - 1.0)
    duck = np.ones(N)
    for kt in kick_times:
        i = int(kt * SR)
        n_ = int(0.2 * SR)
        seg = 1 - 0.45 * np.exp(-np.arange(n_) / SR / 0.06)
        duck[i:i + n_] = np.minimum(duck[i:i + n_], seg[: max(0, min(n_, N - i))])
    for b in (music, bass, keys):
        b.x *= duck[:, None]
    for cue in TL["cues"]:
        place(cue, sfx, verb)
    tt = np.arange(N) / SR
    inside = [s for s in SEGS if s["kind"] == "story" and s["s0"] <= L0 and L1 <= s["s1"]]
    L0, L1 = (L0 - inside[0]["s0"] + inside[0]["f0"], L1 - inside[0]["s0"] + inside[0]["f0"]) if inside else (min(1.0, DUR / 4), DUR - 1.0)

# ── the bed, the effects alone or their own song: the arrangement above left out ──
if SOUND not in ("song", "band"):
    for b in (music, drums, bass, keys):
        b.x[:] = 0
    # levels are measured over the film but its first and last two seconds, which is also the loudness reference
    B0, B1 = min(2.0, DUR / 4), max(DUR - 2.0, DUR * 3 / 4)
    rms = lambda x: np.sqrt((x[int(B0 * SR):int(B1 * SR)] ** 2).mean())  # noqa: E731
    L0, L1 = B0, B1
if SOUND in ("bed", "strings"):  # long chords, synthesized or on strings and a piano, 14 dB under the effects
    # the story's changes on its own clock: away as a part comes in, home on its big moment, D into the end card
    STORY_BED = [(0.0, "G"), (EV["click"], "C"), (EV["lock"], "G"), (EV["slam"], "Em"), (EV["point7"], "C"),
                 (EV["peak"], "G"), (EV["flat"][0], "D"), (EV["cut"], "G")]
    if SEGS:  # each piece of the story with its changes where it plays; a beat moves away as it comes in, home on its hits
        away = ["C", "Am", "Em"]
        changes, beats_in = [], 0
        for s in SEGS:
            if s["kind"] == "story":
                changes.append((s["f0"], [ch for t, ch in STORY_BED if t <= s["s0"]][-1]))
                changes += [(s["f0"] + t - s["s0"], ch) for t, ch in STORY_BED if s["s0"] < t < s["s1"]]
            else:
                changes.append((s["f0"], "G" if s["f0"] == 0 else away[beats_in % len(away)]))
                changes += [(s["f0"] + h, "G") for h in (s.get("music") or {}).get("hits", []) if h > 0]
                beats_in += 1
        if len(changes) > 1 and changes[-1][1] == "G" and changes[-2][1] != "D" and changes[-1][0] - BAR > changes[-2][0] + BEAT:
            changes.insert(-1, (changes[-1][0] - BAR, "D"))  # a bar of D into the end card's G
    else:
        changes = STORY_BED
    plan = []
    for t, ch in sorted(changes, key=lambda c: c[0]):
        if t >= DUR or (plan and plan[-1][1] == ch):
            continue  # the same chord holds from where it came in
        if plan and t - plan[-1][0] < BEAT:
            plan.pop()  # two changes within a beat: the later one
        if not plan or plan[-1][1] != ch:
            plan.append((t, ch))
    plan[0] = (0.0, plan[0][1])
    if SOUND == "bed":
        bed(music, plan, DUR)
    else:
        import real
        played = real.strings_bed(plan, DUR, BED_CHORDS)
        music.x[:min(N, len(played))] += played[:N]
    print("bed", " ".join(f"{t:.2f}s {ch}" for t, ch in plan))
    music.x *= rms(sfx.x * 0.95) * 10 ** (-14 / 20) / max(rms(music.x * 0.85), 1e-9)
elif SOUND == "own":  # their song on the film's grid (engine/lib/music.py), giving way a little under each loud effect
    from music import prepare as prepare_song
    hits = [c["t"] for c in TL["cues"] if c["kind"] in ("pop", "lock", "slam", "tower") or c.get("big")]
    song, line = prepare_song(FILM_JSON["music"], ROOT, DUR, TL["BPM"], min(hits) if hits else 2.0)
    n = min(N, len(song))
    loud = uniform_filter1d(maximum_filter1d(np.abs(sfx.x).max(axis=1), int(0.06 * SR)), int(0.12 * SR))
    music.x[:n] += song[:n] * (1 - 0.35 * loud[:n] / max(loud.max(), 1e-9))[:, None]
    music.x *= rms(sfx.x * 0.95) * 10 ** (float(FILM_JSON["music"].get("gain", -8)) / 20) / max(rms(music.x * 0.85), 1e-9)
    print(line)

ir_t = t_axis(1.6)
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))], axis=1)
ir *= np.exp(-ir_t / 0.4)[:, None]
ir = signal.sosfilt(sos("lowpass", 6000), ir, axis=0)
ir /= np.sqrt((ir ** 2).sum(axis=0))
send = keys.x * 0.35 + verb.x
if SOUND == "bed":
    send = send + music.x * 0.15
wet = np.stack([signal.fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5

mix = drums.x * 0.85 + bass.x * 0.9 + keys.x * 0.7 + music.x * 0.85 + sfx.x * 0.95 + wet
mix = signal.sosfilt(sos("lowpass", 16000), mix, axis=0)
mix = signal.sosfilt(sos("highpass", 25), mix, axis=0)
mix *= np.clip((DUR - tt) / 0.8, 0, 1)[:, None]


sec = mix[int(L0 * SR):int(L1 * SR)]
level = 10 ** (-9.0 / 20) / max(np.sqrt((sec ** 2).mean()), 1e-9)
mix *= level
mix = limit(compress(mix))

# the same sound effects without the music, at the level they have in the mix:
# the cut for platforms where creators lay their own music under the film
sfx_wet = np.stack([signal.fftconvolve(verb.x[:, c], ir[:, c])[:N] for c in range(2)], axis=1) * 0.5
fx = sfx.x * 0.95 + sfx_wet
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


out = ROOT / os.environ.get("SCORE_OUT", "assets/audio/score.wav")
write(out, mix)
if SOUND != "song":
    print("loudness", loudnorm(out), "-> -13 LUFS")
if "SCORE_OUT" not in os.environ:  # a listening test's version leaves the film's own effects-only cut and credits alone
    write(ROOT / "assets/audio/score-sfx.wav", fx)
    # the real instruments' credits (the Salamander piano and the MuldjordKit drums require them): with the film's post
    credits = ROOT / "build/credits.txt"
    if SOUND in ("strings", "band"):
        credits.parent.mkdir(exist_ok=True)
        credits.write_text(real.credits() + "\n")
        print("credits → build/credits.txt:", real.credits().replace("\n", " | "))
    else:
        credits.unlink(missing_ok=True)
for s0 in np.arange(0, DUR - 1e-6, BAR):
    seg = mix[int(s0 * SR):int((s0 + BAR) * SR)]
    print(f"bar {s0:5.1f}s {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12):6.1f} dB")
print("peak", round(20 * np.log10(np.abs(mix).max()), 2), "dBFS ->", out)
