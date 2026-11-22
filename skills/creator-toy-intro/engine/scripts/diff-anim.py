"""After a change, which frames to render again: compares the animation data
before and after (two anim.json), and/or finds visible frames for modified
texture/video assets, printing a --frames list for the render step. Keep the
old frames until the new ones are looked at.

usage:
  python3 engine/scripts/diff-anim.py <old anim.json> <new anim.json> [--images a.jpg,b.jpg] [--since <file|dir>]
  python3 engine/scripts/diff-anim.py [<anim.json>] --images a.jpg,b.jpg
  python3 engine/scripts/diff-anim.py [<anim.json>] --since <file|dir>
prints e.g. 46-71,370-394: where anything moved differently, where an object that was added, removed
or rebuilt shows, and where any changed texture/video asset is visible
"""
import json
import os
import sys
from pathlib import Path

import numpy as np


def curve(keys, n):
    """Keyed rows [index, values…] → every index's values (linear between keys)."""
    k = np.asarray(keys, dtype=np.float64)
    x = np.arange(n)
    return np.stack([np.interp(x, k[:, 0], k[:, c]) for c in range(1, k.shape[1])], axis=1)


def _world_pos(anim, name, n):
    """Approximate world position [n, 3] for stage-clip filtering (handles static and top-level/parented tracks)."""
    objs = {o["name"]: o for o in anim["objects"]}
    pos = np.zeros((n, 3), dtype=np.float64)
    while name in objs:
        tr = anim["tracks"].get(name)
        if tr is not None:
            pos = pos + curve(tr, n)[:, :3]
        elif objs[name].get("tr"):
            pos = pos + np.asarray(objs[name]["tr"][:3], dtype=np.float64)
        name = objs[name].get("parent")
    return pos


def visible(anim, name, n, cam_pos=None, clip_dist=45.0):
    """The samples where an object can be seen: non-parked scale (>1e-3) and inside the camera's stage clip."""
    objs = {o["name"]: o for o in anim["objects"]}
    v = np.ones(n, bool)
    cur = name
    while cur in objs:
        tr = anim["tracks"].get(cur)
        if tr is not None:
            v &= np.abs(curve(tr, n)[:, 7:10]).min(axis=1) > 1e-3
        elif objs[cur].get("tr") and min(abs(x) for x in objs[cur]["tr"][7:10]) <= 1e-3:
            v[:] = False
        cur = objs[cur].get("parent")
    if cam_pos is not None and name != "camera" and v.any():
        dist = np.linalg.norm(_world_pos(anim, name, n) - cam_pos, axis=1)
        v &= dist <= clip_dist
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
    cam_old = _world_pos(old, "camera", N) if "camera" in old.get("tracks", {}) else None
    cam_new = _world_pos(new, "camera", N) if "camera" in new.get("tracks", {}) else None
    vis_old_cache, vis_new_cache = {}, {}
    vis_old = lambda nm: vis_old_cache.setdefault(nm, visible(old, nm, N, cam_old) if nm in oo else np.zeros(N, bool))  # noqa: E731
    vis_new = lambda nm: vis_new_cache.setdefault(nm, visible(new, nm, N, cam_new) if nm in no else np.zeros(N, bool))  # noqa: E731

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


def _object_media(obj):
    """Media file paths referenced by an anim.json object (textures or movie clips)."""
    paths = []
    mat = obj.get("mat") or {}
    geo = obj.get("geo") or {}
    for p in (mat.get("image"), mat.get("movie"), (geo.get("img") or {}).get("image")):
        if isinstance(p, str) and p:
            paths.append(p.replace("\\", "/"))
    return paths


def _media_matches(ref, targets):
    """Match an anim object's film-relative media path against target relative paths or basenames."""
    ref_n = ref.replace("\\", "/").lstrip("./")
    ref_base = Path(ref_n).name
    for t in targets:
        tn = str(t).replace("\\", "/").lstrip("./")
        if not tn:
            continue
        if "/" in tn:
            if ref_n == tn or ref_n.endswith("/" + tn) or tn.endswith("/" + ref_n):
                return True
        elif ref_base == tn:
            return True
    return False


def image_frames(anim, images):
    """Return (frames_1based, matched_objects) where any object using `images` is visible (with 1-step shutter pad)."""
    targets = [str(x).strip() for x in images if str(x).strip()]
    if not targets:
        return [], []
    F, SUB = anim["frames"], anim["sub"]
    N = F * SUB - 1
    cam_pos = _world_pos(anim, "camera", N) if "camera" in anim.get("tracks", {}) else None
    hit = np.zeros(F, bool)
    matched = []
    for obj in anim.get("objects", []):
        if any(_media_matches(p, targets) for p in _object_media(obj)):
            name = obj["name"]
            matched.append(name)
            vis = _pad(visible(anim, name, N, cam_pos))
            i = np.flatnonzero(vis)
            if len(i):
                hit[i // SUB] = True
                hit[np.minimum((i + 1) // SUB, F - 1)] = True
    return (np.flatnonzero(hit) + 1).tolist(), sorted(matched)


def newer_images(anim, film_dir, ref_path):
    """Return film-relative media paths referenced in `anim` whose file on disk is newer than `ref_path`."""
    ref = Path(ref_path)
    if not ref.is_absolute():
        ref = Path(film_dir) / ref
    if not ref.exists():
        return []
    if ref.is_dir():
        pngs = sorted(ref.glob("*.png"))
        if not pngs:
            return []
        cutoff = min(p.stat().st_mtime for p in pngs)
    else:
        cutoff = ref.stat().st_mtime
    found = []
    seen = set()
    for obj in anim.get("objects", []):
        for rel in _object_media(obj):
            if rel in seen:
                continue
            seen.add(rel)
            fp = Path(film_dir) / rel
            if fp.exists() and fp.stat().st_mtime > cutoff:
                found.append(rel)
    return sorted(found)


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
    args = sys.argv[1:]
    pos, images, since = [], [], None
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("--images", "--image"):
            i += 1
            while i < len(args) and not args[i].startswith("--"):
                images.extend(x for x in args[i].split(",") if x.strip())
                i += 1
            continue
        if a == "--since" and i + 1 < len(args):
            since = args[i + 1]
            i += 2
            continue
        pos.append(a)
        i += 1

    film_dir = Path(os.environ["FILM"]) if os.environ.get("FILM") else Path.cwd()
    frames_set, changed = set(), []
    if len(pos) >= 2:
        old, new = (json.load(open(p)) for p in pos[:2])
        frames, changed = diff_frames(old, new)
        if frames is None:
            sys.exit("all  (the film's length changed)")
        frames_set.update(frames)
        anim_cur = new
    elif len(pos) == 1 and (images or since):
        anim_cur = json.load(open(pos[0]))
    elif len(pos) == 0 and (images or since) and (film_dir / "build/anim.json").exists():
        anim_cur = json.load(open(film_dir / "build/anim.json"))
    else:
        sys.exit("usage: diff-anim.py <old anim.json> <new anim.json> [--images a.jpg,b.jpg] [--since <file|dir>]\n       diff-anim.py [<anim.json>] --images a.jpg,b.jpg | --since <file|dir>")

    if since:
        auto = newer_images(anim_cur, film_dir, since)
        if auto:
            print(f"  textures newer than {since}: {', '.join(auto)}", file=sys.stderr)
            images.extend(auto)
    if images:
        img_f, img_objs = image_frames(anim_cur, images)
        if img_objs:
            print(f"  textured objects: {', '.join(img_objs[:12])}{' …' if len(img_objs) > 12 else ''}", file=sys.stderr)
        frames_set.update(img_f)

    frames_out = sorted(frames_set)
    if changed:
        print(f"  objects changed: {', '.join(changed[:12])}{' …' if len(changed) > 12 else ''}", file=sys.stderr)
    print(format_ranges(frames_out))
    print(f"  {len(frames_out)} of {anim_cur['frames']} frames", file=sys.stderr)


if __name__ == "__main__":
    main()
