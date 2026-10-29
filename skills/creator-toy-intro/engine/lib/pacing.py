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
    mid = [t for t in hits if 0.3 * dur <= t <= 0.45 * dur]
    lines = None
    if reads is not None:
        lines = []
        for r in reads:
            t0, t1 = r["at"]
            n = need(r["text"])
            lines.append({"text": r["text"], "at": [t0, t1], "shown": round(t1 - t0, 2), "need": round(n, 2),
                          "ok": t1 - t0 >= n - 0.05, "toEnd": t1 >= dur - 0.05})
    # the toy as a speck, or out of the frame while it is meant to be in it
    small, off = [], []
    seen = toy_on_screen(film, anim)
    if seen is not None:
        share, on, shown = seen
        rate = anim["fps"] * anim["sub"]
        small = [(a, z, round(float(np.median(share[int(a * rate):int(z * rate)])), 3)) for a, z in stretches(on & (share < SMALL), rate)]
        off = stretches(shown & ~on, rate, 2 * LONG)
    return {"duration": dur, "bar": bar, "dead": dead, "alone": alone, "hook": hits[0] if hits else None,
            "mid": mid[0] if mid else None, "reads": lines, "cuts": cuts, "starts": len(starts), "small": small, "off": off}
