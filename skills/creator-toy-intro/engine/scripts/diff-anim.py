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


def curve(keys, n):
    """Keyed rows [index, values…] → every index's values (linear between keys)."""
    k = np.asarray(keys, dtype=np.float64)
    x = np.arange(n)
    return np.stack([np.interp(x, k[:, 0], k[:, c]) for c in range(1, k.shape[1])], axis=1)


def visible(anim, name, n):
    """The samples where an object can be seen: its own scale and its parents' not parked (scale ~0)."""
    objs = {o["name"]: o for o in anim["objects"]}
    v = np.ones(n, bool)
    while name in objs:
        tr = anim["tracks"].get(name)
        if tr is not None:
            v &= np.abs(curve(tr, n)[:, 7:10]).min(axis=1) > 1e-3
        elif objs[name].get("tr") and min(abs(x) for x in objs[name]["tr"][7:10]) <= 1e-3:
            v[:] = False
        name = objs[name].get("parent")
    return v


def _pad(mask):
    """Pad a boolean mask by one step on each side so motion-blur shutters crossing a show/hide boundary are kept."""
    if len(mask) <= 1:
        return mask
    return mask | np.r_[False, mask[:-1]] | np.r_[mask[1:], False]


def diff_frames(old, new):
    """Return (frames_1based, changed_objects) for two anim.json dicts, or (None, []) if length/sub changed."""
    if old["frames"] != new["frames"] or old["sub"] != new["sub"]:
        return None, []
    F, SUB = new["frames"], new["sub"]
    N = F * SUB - 1  # samples
    hit = np.zeros(F, bool)

    def mark(samples):
        i = np.flatnonzero(samples)
        hit[i // SUB] = True
        hit[np.minimum((i + 1) // SUB, F - 1)] = True  # a half-frame sample blurs into the next frame

    # a new, removed or rebuilt object (shape, material, parent): the frames where it shows, before or after
    ob = lambda a: {o["name"]: json.dumps({k: o.get(k) for k in ("parent", "geo", "mat", "tr")}, sort_keys=True) for o in a["objects"]}  # noqa: E731
    oo, no = ob(old), ob(new)
    changed = sorted(k for k in set(oo) | set(no) if oo.get(k) != no.get(k))
    vis_old_cache, vis_new_cache = {}, {}
    vis_old = lambda nm: vis_old_cache.setdefault(nm, visible(old, nm, N) if nm in oo else np.zeros(N, bool))  # noqa: E731
    vis_new = lambda nm: vis_new_cache.setdefault(nm, visible(new, nm, N) if nm in no else np.zeros(N, bool))  # noqa: E731

    for name in changed:
        mark(vis_old(name) | vis_new(name))
    for name in set(old["tracks"]) | set(new["tracks"]):
        a, b = old["tracks"].get(name), new["tracks"].get(name)
        if a is None or b is None:
            continue  # a new or removed object: counted above, where it shows
        # Ignore parked-coordinate edits on samples where the object is hidden (scale <= 1e-3) in both old and new.
        vis = _pad(vis_old(name) | vis_new(name))
        if not vis.any():
            continue
        mark((np.abs(curve(a, N) - curve(b, N)).max(axis=1) > 1e-6) & vis)
    for name in set(old["colors"]) | set(new["colors"]):
        a, b = old["colors"].get(name), new["colors"].get(name)
        vis_s = vis_old(name) | vis_new(name)
        vis_f = _pad(vis_s[np.minimum(np.arange(F) * SUB, N - 1)])
        if not vis_f.any():
            continue
        if a is None or b is None:
            hit |= vis_f
        else:
            hit |= (np.abs(curve(a, F) - curve(b, F)).max(axis=1) > 1e-6) & vis_f
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
    return (np.flatnonzero(hit) + 1).tolist(), changed


def format_ranges(frames):
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
    return ",".join(f"{a}" if a == b else f"{a}-{b}" for a, b in runs) or "none"


def main():
    old, new = (json.load(open(p)) for p in sys.argv[1:3])
    frames, changed = diff_frames(old, new)
    if frames is None:
        sys.exit("all  (the film's length changed)")
    if changed:
        print(f"  objects changed: {', '.join(changed[:12])}{' …' if len(changed) > 12 else ''}", file=sys.stderr)
    print(format_ranges(frames))
    print(f"  {len(frames)} of {new['frames']} frames", file=sys.stderr)


if __name__ == "__main__":
    main()
