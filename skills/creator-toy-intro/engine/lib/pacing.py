"""Pacing, from the film's own numbers before anything renders (build/anim.json,
timeline.json, reads.json): where nothing new happens for more than two bars,
where the toy hops about with nothing else going on, whether a hit comes in the
first 3 s, and whether every line the viewer reads stays long enough to read.

Something new is a sound cue, a cut, or a thing other than the toy that starts
to move or comes into view after resting. The toy moving is not news on its own
(a user, of a cut: "公仔跳左幾下，其實唔使"), nor is what drifts all the time.
A line still being read excuses a quiet stretch.

The rules are other people's measurements: huashu-motion's rhythm notes (a hook
in the first 3 s; never two bars without something new) and lemo-opuscar's read
check (Chinese at 4.5 characters a second, plus 1.5 s to find the line); a Latin
word or a number reads at three a second.
"""
import json
import re
from pathlib import Path

import numpy as np

TOY = "hero"  # the toy's objects: hero and hero_<part>
HOP = {"boing", "pomf"}  # a hop's sounds
HITS = {"pop", "lock", "slam", "tower"}  # the cues that are hits
REST = 0.4  # s still before a start counts as new
DRIFT = 0.7  # moving in more of the film than this: background


def need(text):
    """Seconds to read a line: 4.5 Chinese characters a second, three Latin words or numbers a second, and 1.5 s to find it."""
    cjk = len(re.findall(r"[぀-ヿ㐀-鿿豈-﫿가-힯]", text))
    words = len(re.findall(r"[A-Za-z0-9@#]+(?:[,.'%+][A-Za-z0-9]+)*%?", text))
    return cjk / 4.5 + words / 3 + 1.5


def motion(anim):
    """When things other than the toy start to move or come into view: [(t, name)], and the cuts' times.
    A track keeps only the samples where something changes (linear keys between them); a key a hair
    before a whole sample marks a cut."""
    S, rate = anim["samples"], anim["fps"] * anim["sub"]
    idx = np.arange(S)
    starts, cuts = [], set()
    for name, keys in anim["tracks"].items():
        k = np.array(sorted(keys, key=lambda x: x[0]), dtype=float)
        whole = np.abs(k[:, 0] - np.round(k[:, 0])) < 1e-6
        if name == "camera":
            cuts.update(round((i + 0.02) / rate, 3) for i in k[~whole, 0])
        if name == "camera" or name == TOY or name.startswith(TOY + "_") or len(k) < 2:
            continue
        v = np.stack([np.interp(idx, k[:, 0], k[:, j]) for j in range(1, k.shape[1])], axis=1)
        moving = np.abs(np.diff(v, axis=0)).max(axis=1) > 2e-4  # sample s → s+1
        if moving.mean() > DRIFT:
            continue
        r = int(REST * rate)
        for s in np.flatnonzero(moving & ~np.r_[False, moving[:-1]]):
            if not moving[max(0, s - r):s].any():
                starts.append((round(s / rate, 3), name))
    return sorted(starts), sorted(cuts)


def track(anim, name):
    """An object's transform at every sample: (S, 10) position, quaternion (x, y, z, w), scale."""
    S = anim["samples"]
    k = np.array(sorted(anim["tracks"][name], key=lambda x: x[0]), dtype=float)
    return np.stack([np.interp(np.arange(S), k[:, 0], k[:, j]) for j in range(1, k.shape[1])], axis=1)


def rotate_inv(q, v):
    """v (S, 3) by the inverse of the quaternions q (S, 4: x, y, z, w)."""
    u, w = -q[:, :3], q[:, 3:4]
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


SMALL = 0.08  # the toy under this share of the frame's height reads as a speck
LONG = 1.5  # s: a stretch that long counts


def toy_on_screen(film, anim):
    """How big the toy stands in the frame at every sample: (share of the frame's height, on screen), from the
    camera's and the toy's tracks (Three.js space: the camera looks down its -z, fov is vertical degrees)."""
    F = json.loads((Path(film) / "film.json").read_text())
    toy = json.loads((Path(film) / F.get("toy", "toy.json")).read_text())
    if "camera" not in anim["tracks"] or TOY not in anim["tracks"]:
        return None
    cam, hero = track(anim, "camera"), track(anim, TOY)
    fov = np.array(anim["scalars"].get("fov") or [35.0], dtype=float)
    fov = np.interp(np.arange(len(cam)), np.linspace(0, len(cam) - 1, len(fov)), fov) if len(fov) > 1 else np.full(len(cam), fov[0])
    w, h = F["format"]["size"]
    c = np.array(toy.get("center", [0, toy.get("height", 0.1) / 2, 0]), dtype=float)
    centre = hero[:, :3] + c * hero[:, 7:10]
    v = rotate_inv(cam[:, 3:7], centre - cam[:, :3])
    depth = -v[:, 2]
    half = np.tan(np.radians(fov) / 2)
    share = np.where(depth > 1e-3, toy.get("height", 0.1) * hero[:, 8] / np.maximum(depth, 1e-3) / (2 * half), 0)
    x, y = v[:, 0] / np.maximum(depth, 1e-3) / (half * w / h), v[:, 1] / np.maximum(depth, 1e-3) / half
    shown = (hero[:, 8] > 1e-2) & (depth > 1e-3)
    return share, shown & (np.abs(x) < 1) & (np.abs(y) < 1), shown


def seen(anim, names, aspect):
    """Those of `names` that come into the camera's frame at their size on some sample: not shrunk away, not parked
    under the floor or behind the camera (a template's digits that sink with its page). A part goes where its parent
    takes it; without a camera, what is at its size is seen."""
    tr, S = anim.get("tracks") or {}, anim["samples"]
    objs = {o["name"]: o for o in anim["objects"]}
    memo = {}

    def world(n):  # (S, 10) as track(), its parents' transforms put on it (the root only turns the world z-up)
        if n not in memo:
            o = objs.get(n) or {}
            own = track(anim, n) if n in tr else np.tile(np.array(o.get("tr") or [0, 0, 0, 0, 0, 0, 1, 1, 1, 1], float), (S, 1))
            if o.get("parent") in objs:
                P = world(o["parent"])
                own = np.concatenate([P[:, :3] + rotate(P[:, 3:7], own[:, :3] * P[:, 7:10]), qmul(P[:, 3:7], own[:, 3:7]), own[:, 7:10] * P[:, 7:10]], axis=1)
            memo[n] = own
        return memo[n]

    if "camera" not in tr:
        return {n for n in names if (np.abs(world(n)[:, 7:10]).max(axis=1) > 1e-3).any()}
    cam = track(anim, "camera")
    fov = np.array(anim["scalars"].get("fov") or [35.0], dtype=float)
    fov = np.interp(np.arange(len(cam)), np.linspace(0, len(cam) - 1, len(fov)), fov) if len(fov) > 1 else np.full(len(cam), fov[0])
    half = np.tan(np.radians(fov) / 2)
    out = set()
    for n in names:
        o = world(n)
        v = rotate_inv(cam[:, 3:7], o[:, :3] - cam[:, :3])
        depth = np.maximum(-v[:, 2], 1e-3)
        x, y = v[:, 0] / depth / (half * aspect), v[:, 1] / depth / half
        if ((np.abs(o[:, 7:10]).max(axis=1) > 1e-3) & (-v[:, 2] > 1e-3) & (np.abs(x) < 1.1) & (np.abs(y) < 1.1)).any():
            out.add(n)
    return out


def stretches(mask, rate, at_least=LONG):
    """[(t0, t1)] where mask holds for at least `at_least` seconds."""
    out, i, n = [], 0, len(mask)
    while i < n:
        if not mask[i]:
            i += 1
            continue
        j = i
        while j < n and mask[j]:
            j += 1
        if (j - i) / rate >= at_least:
            out.append((round(i / rate, 2), round(j / rate, 2)))
        i = j
    return out


def letters(anim, prefix=""):
    """The objects that are lettering, under a prefix: those that say so ("letter": the character, lettering.js and
    the beats), else (a beat of its own that does not) glyph curves in a type material that are not an edge."""
    objs = [o for o in anim["objects"] if o["name"].startswith(prefix)]
    said = [o for o in objs if o.get("letter")]
    if said:
        return said
    return [o for o in objs if (o.get("geo") or {}).get("type") == "curve" and (o.get("mat") or {}).get("type") == "type" and not (o.get("mat") or {}).get("outline")]


def lettering_shown(anim, segments):
    """Each beat's lettering as the viewer sees it: [(beat k, t0, t1, names)] where its letters are at their size
    (letters(): what says it is lettering, under the beat's prefix), from anim.json in film time."""
    rate = anim["fps"] * anim["sub"]
    beats = [s for s in segments or [] if s["kind"] == "beat"]
    out = []
    for k, seg in enumerate(beats):
        names = [o["name"] for o in letters(anim, f"beat{k}_") if o["name"] in anim["tracks"]]
        if not names:
            continue
        size = np.max([np.min(np.abs(track(anim, n)[:, 7:10]), axis=1) for n in names], axis=0)
        lo, hi = int(seg["f0"] * rate), int(seg["f1"] * rate)
        on = np.zeros(len(size), bool)
        on[lo:hi] = size[lo:hi] > 0.5 * max(float(size[lo:hi].max(initial=0)), 1e-6)
        for a, z in stretches(on, rate, 0.5):
            out.append((k, a, z, names))
    return out


SLANT = 15  # degrees: a line read turned further than this from the camera shows the tops or sides of its letters


def qmul(a, b):
    """The quaternions a then b, row by row (S, 4: x, y, z, w)."""
    ax, ay, az, aw = a.T
    bx, by, bz, bw = b.T
    return np.stack([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz], axis=1)


def rotate(q, v):
    """v (S, 3) by the quaternions q (S, 4: x, y, z, w)."""
    u, w = q[:, :3], q[:, 3:4]
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def slanted(anim, segments):
    """Where a beat's lettering stands turned from the camera while it is on: [{beat, at, deg, names}], the letters'
    median angle between the way they face (+z) and the way to the camera, over a stretch of half a second or more."""
    if "camera" not in anim["tracks"]:
        return []
    rate = anim["fps"] * anim["sub"]
    cam = track(anim, "camera")
    out = []
    for k, a, z, names in lettering_shown(anim, segments):
        lo, hi = int(a * rate), min(int(z * rate), len(cam))
        if hi - lo < 2:
            continue
        degs = []
        for n in names:
            tr = track(anim, n)[lo:hi]
            face = rotate(tr[:, 3:7], np.tile([0.0, 0.0, 1.0], (len(tr), 1)))
            to = cam[lo:hi, :3] - tr[:, :3]
            to /= np.maximum(np.linalg.norm(to, axis=1, keepdims=True), 1e-9)
            degs.append(np.degrees(np.arccos(np.clip(np.sum(face * to, axis=1), -1, 1))))
        deg = float(np.median(np.median(np.array(degs), axis=0)))
        if deg > SLANT:
            out.append({"beat": k, "at": [a, z], "deg": round(deg), "names": names[:3]})
    return out


def check(film):
    """Everything the page and the review report, for one film folder."""
    b = Path(film) / "build"
    tl = json.loads((b / "timeline.json").read_text())
    anim = json.loads((b / "anim.json").read_text())
    reads = json.loads((b / "reads.json").read_text()) if (b / "reads.json").exists() else None
    dur, bar = tl["DURATION"], tl["BAR"]
    starts, cuts = motion(anim)
    # everything new, in order: (t, what) with what = a cue's kind, "cut" or "start"
    news = sorted([(c["t"], c["kind"]) for c in tl["cues"]] + [(t, "cut") for t in cuts] + [(t, "start") for t, _ in starts])

    # quiet stretches: more than two bars between one new thing and the next (the film's start and end count)
    dead = []
    ts = [0.0] + [t for t, _ in news] + [dur]
    for a, z in zip(ts, ts[1:]):
        if z - a <= 2 * bar + 1e-6:
            continue
        held = [r for r in reads or [] if r["at"][0] <= a + 1e-6 and r["at"][1] >= z - 1e-6 and z - a <= need(r["text"]) + bar]
        if not held:
            dead.append((round(a, 2), round(z, 2)))

    # the toy alone: a bar or more where the only news is its hops (two or more)
    alone, i = [], 0
    while i < len(news):
        if news[i][1] not in HOP:
            i += 1
            continue
        j = i
        while j < len(news) and news[j][1] in HOP:
            j += 1
        a, z = news[i][0], news[j][0] if j < len(news) else dur
        hops = sum(1 for _, k in news[i:j] if k == "boing")
        if z - a >= bar - 1e-6 and hops >= 2:
            alone.append((round(a, 2), round(z, 2), hops))
        i = j

    hits = [c["t"] for c in tl["cues"] if c["kind"] in HITS or c.get("big")]
    # a beat's own hits (its module's music.hits, from its start): the score puts a big kick on each
    hits = sorted(hits + [s["f0"] + h for s in tl.get("SEGMENTS") or [] for h in (s.get("music") or {}).get("hits", []) if h > 0])
    mid = [t for t in hits if 0.3 * dur <= t <= 0.45 * dur]
    lines = None
    if reads is not None:
        lines = []
        for r in reads:
            t0, t1 = r["at"]
            n = need(r["text"])
            lines.append({"text": r["text"], "at": [t0, t1], "shown": round(t1 - t0, 2), "need": round(n, 2),
                          "ok": t1 - t0 >= n - 0.05, "toEnd": t1 >= dur - 0.05})
    # lettering a beat shows that its reads do not cover: the reading time is checked only on what a beat says it shows
    unread = []
    for k, a, z, names in lettering_shown(anim, tl.get("SEGMENTS")):
        cover = [r["at"] for r in reads or [] if r["at"][1] > a and r["at"][0] < z]
        said = sum(min(z, t1) - max(a, t0) for t0, t1 in cover)
        if z - a - said > 0.5:
            unread.append({"beat": k, "at": [a, z], "said": round(said, 2), "names": names[:3]})
    # the toy as a speck, or out of the frame while it is meant to be in it; not in a segment where the work is the
    # hero and the toy stands small on purpose (film.json story.segments[i].wide: a wall of their 66 pictures)
    small, off = [], []
    seen = toy_on_screen(film, anim)
    if seen is not None:
        share, on, shown = seen
        rate = anim["fps"] * anim["sub"]
        wide = np.zeros(len(share), bool)
        for s in tl.get("SEGMENTS") or []:
            if s.get("wide"):
                wide[int(s["f0"] * rate):int(s["f1"] * rate)] = True
        small = [(a, z, round(float(np.median(share[int(a * rate):int(z * rate)])), 3)) for a, z in stretches(on & (share < SMALL) & ~wide, rate)]
        off = stretches(shown & ~on, rate, 2 * LONG)
    return {"duration": dur, "bar": bar, "dead": dead, "alone": alone, "hook": hits[0] if hits else None,
            "mid": mid[0] if mid else None, "reads": lines, "unread": unread, "cuts": cuts, "starts": len(starts), "small": small, "off": off,
            "slant": slanted(anim, tl.get("SEGMENTS"))}
