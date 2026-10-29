"""After a change, which frames to render again: compares the animation data
before and after (two anim.json) and prints the frames whose picture can
differ, as a --frames list for the render step. Keep the old frames until the
new ones are looked at.

usage: python3 engine/scripts/diff-anim.py <old anim.json> <new anim.json>
prints e.g. 46-71,370-394: where anything moved differently, and where an object that was added, removed
or rebuilt (its shape, material, parent) shows, before or after
"""
import json
import sys

import numpy as np

old, new = (json.load(open(p)) for p in sys.argv[1:3])
if old["frames"] != new["frames"] or old["sub"] != new["sub"]:
    sys.exit("all  (the film's length changed)")
F, SUB = new["frames"], new["sub"]
N = F * SUB - 1  # samples

def curve(keys, n):
    """Keyed rows [index, values…] → every index's values (linear between keys)."""
    k = np.asarray(keys, dtype=np.float64)
    x = np.arange(n)
    return np.stack([np.interp(x, k[:, 0], k[:, c]) for c in range(1, k.shape[1])], axis=1)


def visible(anim, name):
    """The samples where an object can be seen: its own scale and its parents' not parked (scale ~0)."""
    objs = {o["name"]: o for o in anim["objects"]}
    v = np.ones(N, bool)
    while name in objs:
        tr = anim["tracks"].get(name)
        if tr is not None:
            v &= np.abs(curve(tr, N)[:, 7:10]).min(axis=1) > 1e-3
        elif objs[name].get("tr") and min(abs(x) for x in objs[name]["tr"][7:10]) <= 1e-3:
            v[:] = False
        name = objs[name].get("parent")
    return v


hit = np.zeros(F, bool)


def mark(samples):
    i = np.flatnonzero(samples)
    hit[i // SUB] = True
    hit[np.minimum((i + 1) // SUB, F - 1)] = True  # a half-frame sample blurs into the next frame


# a new, removed or rebuilt object (shape, material, parent): the frames where it shows, before or after
ob = lambda a: {o["name"]: json.dumps({k: o.get(k) for k in ("parent", "geo", "mat", "tr")}, sort_keys=True) for o in a["objects"]}  # noqa: E731
oo, no = ob(old), ob(new)
changed = sorted(k for k in set(oo) | set(no) if oo.get(k) != no.get(k))
for name in changed:
    mark((visible(old, name) if name in oo else False) | (visible(new, name) if name in no else False))
if changed:
    print(f"  objects changed: {', '.join(changed[:12])}{' …' if len(changed) > 12 else ''}", file=sys.stderr)
for name in set(old["tracks"]) | set(new["tracks"]):
    a, b = old["tracks"].get(name), new["tracks"].get(name)
    if a is None or b is None:
        continue  # a new or removed object: counted above, where it shows
    mark(np.abs(curve(a, N) - curve(b, N)).max(axis=1) > 1e-6)
for name in set(old["colors"]) | set(new["colors"]):
    a, b = old["colors"].get(name), new["colors"].get(name)
    if a is None or b is None or np.abs(curve(a, F) - curve(b, F)).max() > 1e-6:
        hit |= True if a is None or b is None else (np.abs(curve(a, F) - curve(b, F)).max(axis=1) > 1e-6)
for name in set(old["scalars"]) | set(new["scalars"]):
    a, b = np.asarray(old["scalars"].get(name, []), dtype=np.float64), np.asarray(new["scalars"].get(name, []), dtype=np.float64)
    if a.shape != b.shape:
        hit[:] = True
        continue
    d = np.abs(a - b).reshape(len(a), -1).max(axis=1) > 1e-6
    i = np.flatnonzero(d)
    if len(a) == F:
        hit[i] = True
    else:
        hit[i // SUB] = True
        hit[np.minimum((i + 1) // SUB, F - 1)] = True

frames = np.flatnonzero(hit) + 1
runs, start = [], None
for f in frames:
    if start is None:
        start = prev = f
    elif f == prev + 1:
        prev = f
    else:
        runs.append((start, prev))
        start = prev = f
if start is not None:
    runs.append((start, prev))
print(",".join(f"{a}" if a == b else f"{a}-{b}" for a, b in runs) or "none")
print(f"  {len(frames)} of {F} frames", file=sys.stderr)
