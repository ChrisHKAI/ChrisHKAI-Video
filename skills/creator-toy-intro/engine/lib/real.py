"""Real instruments in place of the synthesized ones: the sounds "strings" (the bed's chords on a string
section and a piano) and "band" (the template's whole arrangement, each instrument swapped for a sampled
one). The samples are the libraries engine/lib/instruments.json pins (engine/scripts/instruments.mjs
fetches them), played by lemo-opuscar's sampler (engine/vendor/lemo).

In the band, every sampled sound is set as loud as the synthesized one it replaces, so the arrangement
keeps the balance it was mixed with. What is played is remembered, for the credits the Salamander piano
(CC BY 3.0) and the MuldjordKit drums (CC BY 4.0) require: credits() → build/credits.txt.
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vendor" / "lemo"))
import sampler as S  # noqa: E402
from sfx import add  # noqa: E402

SR = S.SR
S.seed(2026)  # the same film sounds the same every time
USED = set()


def need(*libs):
    missing = [lib for lib in libs if not (Path(S.ROOT) / lib).is_dir()]
    if missing:
        raise SystemExit(f"the real instruments need the sample libraries {', '.join(missing)}: node <skill>/engine/scripts/instruments.mjs {' '.join(missing)} (ask first: references/storyboard.md)")


def midi(f):
    return 69 + 12 * math.log2(f / 440)


def note(inst, pitch, dur, vel, **kw):
    USED.add(inst)
    return S.note(inst, pitch, dur, vel=vel, **kw)


def hit(inst, var, vel):
    USED.add(inst)
    return S.hit(inst, var, vel)


def section(m):
    """The string section for a pitch (midi): the cellos under C3, the violas to G3, the violins above."""
    return "cellos" if m < 48 else "violas" if m < 55 else "violins"


def strings(pitches, dur, vel=0.45, attack=0.35, release=0.9):
    """A chord on the string section, each note on the section whose register it is in (mono)."""
    notes = [note(section(m), m, dur, vel, attack=attack, release=release) for m in pitches]
    out = np.zeros(max(len(n) for n in notes))
    for n in notes:
        out[:len(n)] += n
    return out


def strings_bed(plan, dur, chords):
    """The bed's chords (time, chord name) on strings, a piano touching each change, in a small room (stereo)."""
    need("vsco2ce", "salamander")
    out = np.zeros((int(dur * SR), 2))
    for i, (t0, ch) in enumerate(plan):
        t1 = plan[i + 1][0] if i + 1 < len(plan) else dur
        ms = [midi(S.hz(n)) for n in chords[ch]]
        for m in ms:  # each note on its own section, spread a little across the stereo field
            add(out, note(section(m), m, t1 - t0 + 0.4, 0.42, attack=0.6 if t0 == 0 else 0.35, release=1.2), max(0.0, t0 - 0.2), 1.0, {"cellos": -0.25, "violas": 0.1, "violins": 0.3}[section(m)])
        USED.add("piano")
        add(out, S.chord("piano", [m + 12 for m in ms], 2.4, vel=0.3, strum=0.03), t0, 0.8, 0.0)
    return S.room(out, size=0.45, mix=0.16)


def matched(fake, real):
    """A sampled sound at the loudness of the synthesized one it replaces (RMS), so the arrangement's balance holds."""
    r, f = np.sqrt((real ** 2).mean()), np.sqrt((fake ** 2).mean())
    return real * (f / r if r > 1e-9 else 0.0)


def band(synth):
    """The synth's instruments as the arrangement calls them, on samples: drums, a double bass, strings for the pads,
    a piano for the plucks, horns for the brass. Hand them to the score's globals."""
    need("vsco2ce", "salamander", "freepats", "karoryfer")

    def kick(big=False):
        return matched(synth.kick(big), hit("drum_kit", "kick_drum_left", 0.95 if big else 0.75))

    def snare():
        return matched(synth.snare(), hit("drum_kit", "snare_1", 0.8))

    def hat(open_=False):
        return matched(synth.hat(open_), hit("drum_kit", "hi_hat_open" if open_ else "hi_hat_closed", 0.6))

    def sub(freq, dur):
        return matched(synth.sub(freq, dur), note("jazz_bass", midi(freq), dur, 0.75))

    def growl(freq, dur):
        return matched(synth.growl(freq, dur), note("jazz_bass", midi(freq), dur, 0.9))

    def pad(freqs, dur, bright=1400, a=0.4):
        return matched(synth.pad(freqs, dur, bright, a), strings([midi(f) for f in freqs], dur, attack=max(a, 0.05)))

    def pluck(freq, dur=0.35):
        return matched(synth.pluck(freq, dur), note("piano", midi(freq), max(dur, 0.5), 0.55))

    def brass(freqs, dur):
        USED.add("horn")
        return matched(synth.brass(freqs, dur), S.chord("horn", [midi(f) for f in freqs], dur, vel=0.6))

    return {"kick": kick, "snare": snare, "hat": hat, "sub": sub, "growl": growl, "pad": pad, "pluck": pluck, "brass": brass}


def credits():
    """The lines the film's credits need for what was played (the CC BY ones required, the CC0 ones as thanks)."""
    return "\n".join(S.credits(sorted(USED)))
