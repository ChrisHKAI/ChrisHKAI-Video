"""The film's own score (film.json "sound": "score", references/sound.md): music written for this cut by the
agent, never a template's song. <film>/music/score.py defines compose(ctx) and returns the music, stereo,
(ctx.n, 2) at ctx.sr, with the effects left out. The template's score.py lays the effects over it, lets it give
way a little under each loud one, and masters the two to -13 LUFS; the effects alone stay the effects-only cut.

ctx holds what a score is written to:
  sections  each piece of the film in order: f0, f1 (film seconds), kind (story or beat), name (a story piece's
            name: opening, act2, act3, exit, endCard; a beat's file), music (a beat's groove, chords and hits,
            its hits in film seconds)
  hits      the film's big moments (film seconds): the pops, locks, slams and every cue marked big
  cues      every effect cue (t in film seconds, kind)
  dur, bpm, beat, bar, sr, n
  film      film.json
  real      the sampled instruments (lemo-opuscar's sampler: real.note(inst, pitch, dur, vel), real.hit(inst,
            var, vel), real.chord(inst, pitches, dur, vel, strum), real.room(x, size, mix)), or None when the
            libraries are not on this computer (engine/scripts/instruments.mjs fetches them, on the user's yes)
  synth     the synth kit (engine/lib/synth.py: pad, pluck, sub, bell, kick, snare, hat …), always there
  add(buf, x, t, gain, pan)  a mono sound into a stereo buffer at film time t
  midi(name)  "G3" → 55
example(ctx) is a worked score: copy it as music/score.py to start, then write this film's own.
"""
import importlib.util
import sys
from pathlib import Path

import numpy as np

LIB = Path(__file__).resolve().parent
sys.path.insert(0, str(LIB.parent / "vendor" / "lemo"))
from sfx import add  # noqa: E402  a mono sound into a stereo buffer, panned

BIG = ("pop", "lock", "slam", "tower")
NAMES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def midi(name):
    """'G3' → 55, 'F#4' → 66"""
    p = name[:-1]
    return 12 * (int(name[-1]) + 1) + NAMES[p]


class Ctx:
    pass


class Real:
    """The sampled instruments, each one played remembered for the credits (engine/lib/real.py)."""
    def __init__(self, real):
        self.real, self.S, self.USED = real, real.S, real.USED

    def note(self, inst, pitch, dur, vel=0.8, **kw):
        return self.real.note(inst, pitch, dur, vel, **kw)

    def hit(self, inst, var=None, vel=0.8):
        return self.real.hit(inst, var, vel)

    def chord(self, inst, pitches, dur, vel=0.8, strum=0.0, **kw):
        self.USED.add(inst)
        return self.S.chord(inst, pitches, dur, vel=vel, strum=strum, **kw)

    def room(self, x, size=0.5, mix=0.2):
        return self.S.room(x, size=size, mix=mix)


def context(TL, F, synth, sr, n, dur, story_pieces):
    """What a score is written to (see above), from build/timeline.json and film.json."""
    c = Ctx()
    c.dur, c.sr, c.n = dur, sr, n
    c.bpm, c.beat, c.bar = TL["BPM"], TL["BEAT"], TL["BAR"]
    c.film, c.synth = F, synth
    c.cues = TL["cues"]
    c.hits = sorted({round(q["t"], 3) for q in TL["cues"] if q["kind"] in BIG or q.get("big")})
    segs = TL.get("SEGMENTS") or [{"kind": "story", "f0": 0, "f1": dur, "s0": 0, "s1": dur}]
    c.sections = []
    for s in segs:
        if s["kind"] == "beat":
            m = dict(s.get("music") or {})
            m["hits"] = [s["f0"] + h for h in m.get("hits", [])]
            c.sections.append({"f0": s["f0"], "f1": s["f1"], "kind": "beat", "name": s.get("beat"), "music": m})
        else:  # the story piece it plays the most of
            over = lambda a, b: max(0.0, min(s["s1"], b) - max(s["s0"], a))  # noqa: E731
            name = max(story_pieces, key=lambda k: over(story_pieces[k][0], dur + 99 if story_pieces[k][1] == "end" else story_pieces[k][1]))
            c.sections.append({"f0": s["f0"], "f1": s["f1"], "kind": "story", "name": name, "music": {}})
    try:
        import real
        real.need("salamander", "vsco2ce", "freepats")
        c.real = Real(real)
    except (SystemExit, ImportError):
        c.real = None
    c.add, c.midi = add, midi
    return c


def load(path):
    """The film's music/score.py, as a module."""
    spec = importlib.util.spec_from_file_location("film_score", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "compose"):
        raise SystemExit(f"{path}: define compose(ctx) → the music, (ctx.n, 2) at ctx.sr")
    return mod


# ── a worked score ──────────────────────────────────────────────────────────
# To start from, never to keep: its key, chords, motif and instruments are placeholders for this film's own.
CHORDS = {"G": ["G2", "B2", "D3", "G3"], "Em": ["E2", "G2", "B2", "E3"], "C": ["C3", "E3", "G3", "C4"], "D": ["D3", "F#3", "A3", "D4"], "Am": ["A2", "C3", "E3", "A3"]}
STORY = {"opening": ["G", "C"], "act2": ["G", "Em", "C", "D"], "act3": ["Em", "C", "G", "D"], "exit": ["C", "D"], "endCard": ["C", "D", "G", "G"]}


def example(ctx):
    """A bright small band: a bass on the roots, a piano on each bar's chord, a four-note motif on a kalimba
    in eighths, light drums by each part's groove; a held chord and a cymbal on every big hit; home to G at
    the end. Sampled instruments when the computer has them, the synth kit otherwise."""
    out = np.zeros((ctx.n, 2))
    R, S = ctx.real, ctx.synth
    hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # noqa: E731

    def chord_at(sec, k):
        prog = sec["music"].get("chords") or STORY.get(sec["name"], ["G", "C", "D", "G"])
        return prog[k % len(prog)]

    for sec in ctx.sections:
        groove = sec["music"].get("groove", "light" if sec["kind"] == "beat" else "normal")
        t, k = sec["f0"], 0
        while t < sec["f1"] - 1e-6:
            ch = chord_at(sec, k)
            notes = [midi(x) for x in CHORDS[ch]]
            span = min(ctx.bar, sec["f1"] - t)
            if R:
                ctx.add(out, R.note("jazz_bass", notes[0] - 12, ctx.beat * 1.8, 0.7), t, 0.9, -0.1)
                ctx.add(out, R.note("jazz_bass", notes[0] - 12 + 7, ctx.beat * 1.6, 0.55), t + 2 * ctx.beat, 0.7, -0.1)
                ctx.add(out, R.chord("piano", [m + 12 for m in notes[1:]], span, vel=0.42, strum=0.02), t, 0.6, 0.15)
            else:
                ctx.add(out, S.sub(hz(notes[0] - 12), span * 0.95), t, 0.8, 0.0)
                ctx.add(out, S.pad([hz(m + 12) for m in notes[1:]], span, bright=1600, a=0.05), t, 0.5, 0.0)
            # the motif: root, third, fifth, third an octave up, in eighths
            motif = [notes[0] + 24, notes[1] + 24, notes[2] + 24, notes[1] + 36]
            for s8 in range(8):
                ts = t + s8 * ctx.beat / 2
                if ts >= sec["f1"] - 1e-6:
                    break
                m = motif[s8 % 4]
                x = R.note("kalimba", m, ctx.beat * 0.9, 0.5 if s8 % 2 == 0 else 0.35) if R else S.pluck(hz(m), 0.3)
                ctx.add(out, x, ts, 0.5, -0.35 + 0.1 * (s8 % 4))
            # the drums by the part's groove
            for s8 in range(8):
                ts = t + s8 * ctx.beat / 2
                if ts >= sec["f1"] - 1e-6:
                    break
                kick = {"normal": (0, 3, 4), "light": (0, 4), "half": (0,), "double": (0, 3, 4, 6)}.get(groove, (0, 4))
                if groove == "none":
                    continue
                if s8 in kick:
                    ctx.add(out, R.hit("drum_kit", "kick", 0.7) if R else S.kick(), ts, 0.6, 0.0)
                if s8 in (2, 6) and groove != "half":
                    ctx.add(out, R.hit("claps", "group", 0.5) if R else S.snare(), ts, 0.35, 0.05)
                ctx.add(out, R.hit("hihat", "closed", 0.4 if s8 % 2 else 0.6) if R else S.hat(), ts, 0.25, 0.3)
            t += ctx.bar
            k += 1
    # every big hit: a held chord and a cymbal
    for h in ctx.hits:
        if R:
            ctx.add(out, R.chord("piano", [midi(x) + 12 for x in CHORDS["G"][1:]], 1.6, vel=0.6), h, 0.5, 0.0)
            ctx.add(out, R.hit("sus_cymbal", "hit", 0.45), h, 0.3, 0.2)
        else:
            ctx.add(out, S.bell(hz(midi("G5")), 1.2), h, 0.4, 0.0)
    return R.room(out, size=0.4, mix=0.14) if R else out
