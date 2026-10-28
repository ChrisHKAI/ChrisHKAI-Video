"""The film's pacing, before anything renders (engine/lib/pacing.py): quiet
stretches of more than two bars, the toy hopping about with nothing else new,
the first hit, and how long each line the viewer reads stays against how long
it takes to read. The storyboard page shows the same in the user's language.

usage: FILM=<film folder> python3 engine/scripts/pace.py   (after run.mjs anim)
"""
import os
import sys
from pathlib import Path

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
from film import FILM  # noqa: E402
import pacing  # noqa: E402

p = pacing.check(FILM)
dur, bar = p["duration"], p["bar"]
print(f"{dur:g} s, a bar {bar:g} s; cuts: {len(p['cuts'])}, things starting to move: {p['starts']}")
print(f"  {'✓' if p['hook'] is not None and p['hook'] <= 3 else '!'} first hit at {p['hook']} s (within 3 s)")
print(f"  {'✓' if p['mid'] is not None else '!'} a hit in the middle (30–45 %): {p['mid']} s")
if not p["dead"]:
    print(f"  ✓ something new at least every two bars ({2 * bar:g} s)")
for a, z in p["dead"]:
    print(f"  ! {a}–{z} s: {z - a:.1f} s with nothing new (two bars: {2 * bar:g} s): add a move, or cut it shorter")
for a, z, n in p["alone"]:
    print(f"  ! {a}–{z} s: only the toy hopping ({n} hops), nothing else new: does it need them?")
if p["reads"] is None:
    print("  ! the template does not say what the viewer reads (build/reads.json): reading time not checked")
else:
    for r in p["reads"]:
        mark = "✓" if r["ok"] else ("·" if r["toEnd"] else "!")
        tail = "" if r["ok"] else (" (to the end: the last frame stays)" if r["toEnd"] else f": {r['need'] - r['shown']:.1f} s more")
        print(f"  {mark} \"{r['text']}\" {r['at'][0]:g}–{r['at'][1]:g} s: shown {r['shown']:g} s, reads in {r['need']:g} s{tail}")
