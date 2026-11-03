"""Colours: how the film's own colours stand against the stage (WCAG contrast),
and the creator's colours from their own pictures (OKLab k-means).

Against the dark stage: lettering wants 3:1 or more; a colour that covers much
of the toy under 1.6:1 melts into the stage (a user, of a black prop on the
black stage, and of white digits on a white post: the stage decides what reads).
"""
import json
import math
from pathlib import Path

import numpy as np

STAGE = "#0b0c10"  # what the camera sees behind everything on the dark stage (engine/scripts/scene.py's world)
# The stage the film plays on takes the other side of the toy (stage_for): the dark one the first films used,
# or a mid tone a dark toy (a black hoodie, navy hair) stands out on while white lettering still reads (3:1):
# a blue slate, or a neutral grey when the toy's own dark is blue (navy on slate is blue on blue).
# sky: what the camera sees past the floor; floor: the stage under the page (its edge, the ring, the middle);
# glass and fade: the end card's and the beats' glass floor and where it fades; lookdev: the turnaround's floor.
STAGES = {
    "dark": {"sky": STAGE, "floorEdge": "#08090c", "floorRing": "#10131a", "floorMid": "#1a2030", "glass": "#08090c", "fade": "#000000", "lookdev": "#24272e"},
    "mid": {"sky": "#4a505d", "floorEdge": "#434956", "floorRing": "#596070", "floorMid": "#788093", "glass": "#555c6b", "fade": "#4a505d", "lookdev": "#6c7384"},
    "grey": {"sky": "#57585c", "floorEdge": "#4e4f53", "floorRing": "#626368", "floorMid": "#7f8086", "glass": "#5c5d62", "fade": "#57585c", "lookdev": "#737479"},
}
READ, MELT = 3.0, 1.6  # lettering wants READ:1; a big colour under MELT:1 melts into the stage
TWIN = 0.12  # lettering closer than this (OKLab distance) to the toy's main colour melts into the toy beside it


def rgb(hex_):
    h = hex_.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float) / 255


def hexof(c):
    return "#" + "".join(f"{int(round(max(0, min(1, v)) * 255)):02X}" for v in c)


def linear(c):
    c = np.asarray(c, dtype=float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def contrast(a, b):
    """WCAG contrast of two colours (hex), 1 to 21."""
    la, lb = (float(linear(rgb(x)) @ [0.2126, 0.7152, 0.0722]) for x in (a, b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def oklab(c):
    """sRGB (n, 3) in 0–1 → OKLab (n, 3)."""
    lin = linear(c)
    lms = lin @ np.array([[0.4122214708, 0.2119034982, 0.0883024619],
                          [0.5363325363, 0.6806995451, 0.2817188376],
                          [0.0514459929, 0.1073969566, 0.6299787005]])
    lms = np.cbrt(lms)
    return lms @ np.array([[0.2104542553, 1.9779984951, 0.0259040371],
                           [0.7936177850, -2.4285922050, 0.7827717662],
                           [-0.0040720468, 0.4505937099, -0.8086757660]])


def part_area(p):
    """About how much of the toy's surface a part covers (m²): boxes by their size, round parts by their radii,
    tubes by their length."""
    if "size" in p:
        x, y, z = (list(p["size"]) + [0, 0, 0])[:3]
        return 2 * (x * y + y * z + z * x)
    if "r" in p and isinstance(p["r"], list):
        a, b, c = (list(p["r"]) + p["r"][-1:] * 3)[:3]
        q = 1.6075
        return 4 * np.pi * (((a * b) ** q + (a * c) ** q + (b * c) ** q) / 3) ** (1 / q)
    if p.get("shape") == "tube" and p.get("pts"):
        pts, r = np.array(p["pts"], float), float(np.mean(p.get("radii", [0.002])))
        return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum()) * 2 * np.pi * r
    return 0.0


def toy_colours(film, against=None):
    """The toy's colours on the stage (`against`: its sky; the film's own by default), by how much of it each
    covers (largest first)."""
    film = Path(film)
    F = json.loads((film / "film.json").read_text())
    toy_file = F.get("toy", "toy.json")
    toy = json.loads((film / toy_file).read_text()) if (film / toy_file).exists() else {}
    palette = dict(toy.get("colors", {}))
    area = {}
    for p in toy.get("parts", []):
        if p.get("shape") == "mesh" and (film / p.get("file", "")).is_file():
            # a sculpted part: its painted vertices (linear), averaged over its faces' area
            m = np.load(film / p["file"])
            v, f, col = m["verts"], m["faces"], m["color"]
            a = 0.5 * np.linalg.norm(np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]]), axis=1)
            lin = (col[f].mean(axis=1) * a[:, None]).sum(axis=0) / max(a.sum(), 1e-12)
            palette[p["name"]] = hexof(np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0), 1 / 2.4) - 0.055))
            area[p["name"]] = float(a.sum())
            continue
        key = p.get("mat")
        if key in palette:
            area[key] = area.get(key, 0) + part_area(p)
    total = sum(area.values()) or 1
    against = against or stage_for(film)[1]["sky"]
    return sorted(({"key": k, "hex": palette[k], "share": a / total, "contrast": contrast(palette[k], against)} for k, a in area.items()), key=lambda r: -r["share"])


def film_colours(film):
    """The film's colours as the viewer meets them on the stage: the toy's (by how much of it each covers),
    the lettering's (from build/anim.json's type materials) and the confetti's (film.json pop)."""
    film = Path(film)
    F = json.loads((film / "film.json").read_text())
    anim = json.loads((film / "build/anim.json").read_text())
    STAGE = stage_for(film)[1]["sky"]
    toy_rows = toy_colours(film, STAGE)
    # dark lettering printed on a paper of its own group (label0_l0 on label0_sheet, a calendar's day on its
    # page) is read against the paper; the rest against the stage
    group = lambda name: name.split("_")[0]  # noqa: E731
    papers = {}
    for o in anim["objects"]:
        m = o.get("mat") or {}
        if m.get("type") == "paper" and isinstance(m.get("color"), str):
            papers.setdefault(group(o["name"]), m["color"])
    # lettering never shown on any frame (a template's own end card a film of its own beats never plays) is not read
    tracks = anim.get("tracks") or {}
    shown = lambda name: name not in tracks or any(max(abs(k[8]), abs(k[9]), abs(k[10])) > 1e-3 for k in tracks[name])  # noqa: E731
    text, edges = {}, {}
    for o in anim["objects"]:
        m = o.get("mat") or {}
        # lettering: glyph outlines (curves) in a type material (confetti and a calendar's boxes share the material)
        # (an outline behind a letter, "outline": true, is its edge, not lettering of its own: the face is read by it)
        if m.get("type") == "type" and not m.get("outline") and isinstance(m.get("color"), str) and (o.get("geo") or {}).get("type") == "curve" and shown(o["name"]):
            # a beat may say what its lettering stands on ("on": a carpet, a sign) and the dark edge round it ("edge")
            back = m.get("on") or (papers.get(group(o["name"])) if contrast(m["color"], STAGE) < READ else None)
            key = (m["color"].upper(), (back or STAGE).upper())
            text.setdefault(key, []).append(o["name"])
            if isinstance(m.get("edge"), str):
                edges[key] = m["edge"].upper()

    def row(h, b, n):
        r = {"hex": h, "on": b, "objects": len(n), "names": n[:4], "contrast": contrast(h, b)}
        e = edges.get((h, b))
        if e and r["contrast"] < READ:  # an edged letter reads by its edge on the ground and its face on the edge
            r["edge"], r["contrast"] = e, min(contrast(e, b), contrast(h, e))
        return r
    text_rows = sorted((row(h, b, n) for (h, b), n in text.items()), key=lambda r: r["contrast"])
    # lettering on the stage beside the toy, in the toy's own colour (a gold line by a lemon): the two read as one
    main = [r for r in toy_rows if r["share"] >= 0.25]
    for r in text_rows:
        if r["on"] == STAGE.upper():
            near = [m for m in main if float(np.linalg.norm(oklab(np.array([rgb(r["hex"])]))[0] - oklab(np.array([rgb(m["hex"])]))[0])) < TWIN]
            if near:
                r["twin"] = near[0]["hex"].upper()
    conf = [c for c in (F.get("pop") or {}).get("confetti", []) if isinstance(c, str)]
    conf_rows = [{"hex": c.upper(), "contrast": contrast(c, STAGE)} for c in conf]
    return {"stage": STAGE, "toy": toy_rows, "text": text_rows, "confetti": conf_rows}


def from_oklab(lab):
    """OKLab (n, 3) → sRGB (n, 3) in 0–1 (clipped)."""
    lab = np.atleast_2d(np.asarray(lab, dtype=float))
    lms = lab @ np.array([[1.0, 1.0, 1.0],
                          [0.3963377774, -0.1055613458, -0.0894841775],
                          [0.2158037573, -0.0638541728, -1.2914855480]])
    lin = (lms ** 3) @ np.array([[4.0767416621, -1.2684380046, -0.0041960863],
                                 [-3.3077115913, 2.6097574011, -0.7034186147],
                                 [0.2309699292, -0.3413193965, 1.7076147010]])
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def lift(hex_, target=MELT + 0.2, against=STAGE):
    """The same colour made lighter, its hue and chroma kept (OKLab lightness raised), just enough to stand at
    `target`:1 on the stage: a navy stays a navy, only one the eye can find."""
    lab = oklab(np.array([rgb(hex_)]))[0]
    if contrast(hex_, against) >= target:
        return hex_.upper()
    lo, hi = lab[0], 1.0
    for _ in range(30):
        mid = (lo + hi) / 2
        h = hexof(from_oklab([[mid, lab[1], lab[2]]])[0])
        lo, hi = (mid, hi) if contrast(h, against) < target else (lo, mid)
    return hexof(from_oklab([[hi, lab[1], lab[2]]])[0]).upper()


def darkness(film, against=STAGE):
    """How much of the toy melts into a stage (`against`: its sky): the share of its surface in colours under
    MELT:1 (0–1)."""
    try:
        return float(sum(r["share"] for r in toy_colours(film, against) if r["contrast"] < MELT))
    except Exception:  # no toy yet, or one these colours cannot read
        return 0.0


def delivered():
    """The ids of the films this machine has delivered (engine/lib/ledger.py's ledger)."""
    import os
    p = Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video") / "ledger.json"
    try:
        return {e.get("id") for e in json.loads(p.read_text())}
    except Exception:
        return set()


def stage_of(hex_):
    """A stage in one colour (film.json look.stage "#RRGGBB": the toy's contrast colour, when neither dark nor
    a mid tone sets the toy off, a grey logo with blue in it, say): the camera sees that colour, the floor is a
    little darker at its edge and lighter in its middle (OKLab lightness, the hue kept)."""
    lab = oklab(np.array([rgb(hex_)]))[0]
    shade = lambda d: hexof(from_oklab([[max(0.0, min(1.0, lab[0] + d)), lab[1], lab[2]]])[0])  # noqa: E731
    return {"sky": hex_.upper(), "floorEdge": shade(-0.08), "floorRing": shade(-0.03), "floorMid": shade(0.03),
            "glass": shade(-0.05), "fade": hex_.upper(), "lookdev": shade(0.02),
            # a light stage (a white like the logo's own paper): the camera sees it as it is and the floor runs into
            # it with no horizon, the toy's contact shadow on it (engine/lib/look.py light_floor)
            "light": bool(lab[0] >= 0.85)}


def stage_for(film):
    """(name, palette) of the stage this film plays on: film.json look.stage when it says ("dark", "mid",
    "grey", or a colour "#RRGGBB": stage_of); else the dark stage, unless 15% or more of the toy melts into it
    and less melts into a mid one: the slate, or the grey when what melts is blue (a delivered film keeps the
    dark one it was approved on)."""
    film = Path(film)
    try:
        F = json.loads((film / "film.json").read_text())
    except Exception:
        F = {}
    name = (F.get("look") or {}).get("stage")
    if isinstance(name, str) and name.startswith("#") and len(name) == 7:
        return name.upper(), stage_of(name)
    if name not in STAGES and (F.get("step") == "done" or F.get("id") in delivered()):
        name = "dark"  # a delivered film keeps the stage it was approved on
    if name not in STAGES:
        dark = darkness(film, STAGES["dark"]["sky"])
        name = "dark"
        if dark >= 0.15:
            # the hue of what melts, by how much of the toy it covers: blue (OKLab b under 0) wants the grey
            rows = [r for r in toy_colours(film, STAGES["dark"]["sky"]) if r["contrast"] < MELT]
            b = sum(oklab(np.array([rgb(r["hex"])]))[0][2] * r["share"] for r in rows) / max(1e-9, sum(r["share"] for r in rows))
            mid = "grey" if b < -0.015 else "mid"
            if darkness(film, STAGES[mid]["sky"]) < dark:
                name = mid
    return name, STAGES[name]


def problems(fc):
    """What will not read on the stage: (kind, row) for a big toy colour that melts, lettering under READ, confetti that melts."""
    out = [("toy", r) for r in fc["toy"] if r["share"] >= 0.1 and r["contrast"] < MELT]
    out += [("text", r) for r in fc["text"] if r["contrast"] < READ]
    out += [("twin", r) for r in fc["text"] if r.get("twin")]
    out += [("confetti", r) for r in fc["confetti"] if r["contrast"] < MELT]
    return out


def creator_colours(pictures, k=10, seed=7):
    """The colours of the creator's own pictures [(label, path, weight)]: OKLab k-means over their pixels
    (transparent ones left out). Returns [{hex, share, light, chroma, hue, from}] by share, then the accents:
    the saturated ones, by share × chroma, a clear step apart."""
    from PIL import Image
    rng = np.random.default_rng(seed)
    px, wt, src = [], [], []
    for label, path, weight in pictures:
        im = Image.open(path).convert("RGBA")
        im.thumbnail((256, 256))
        a = np.asarray(im, dtype=float) / 255
        p = a[..., :3][a[..., 3] > 0.5]
        if len(p) > 6000:
            p = p[rng.choice(len(p), 6000, replace=False)]
        px.append(p)
        wt.append(np.full(len(p), weight / max(1, len(p))))
        src.append(np.full(len(p), label, dtype=object))
    px, wt, src = np.concatenate(px), np.concatenate(wt), np.concatenate(src)
    lab = oklab(px)
    centres = lab[rng.choice(len(lab), k, replace=False)]
    for _ in range(25):
        idx = np.argmin(((lab[:, None, :] - centres[None]) ** 2).sum(-1), axis=1)
        centres = np.array([np.average(lab[idx == j], axis=0, weights=wt[idx == j]) if (idx == j).any() else centres[j] for j in range(k)])
    rows = []
    for j in range(k):
        m = idx == j
        if not m.any():
            continue
        L, A, B = centres[j]
        froms = sorted(set(src[m]), key=lambda s: -wt[m][src[m] == s].sum())
        rows.append({"hex": hexof(np.average(px[m], axis=0, weights=wt[m])), "share": float(wt[m].sum() / wt.sum()),
                     "light": float(L), "chroma": float(math.hypot(A, B)), "hue": float(math.degrees(math.atan2(B, A)) % 360), "from": froms})
    rows.sort(key=lambda r: -r["share"])
    accents = []
    for r in sorted((r for r in rows if r["chroma"] >= 0.05 and 0.3 <= r["light"] <= 0.93), key=lambda r: -r["share"] * r["chroma"]):
        if all(abs((r["hue"] - a["hue"] + 180) % 360 - 180) > 25 for a in accents):
            accents.append(r)
    return rows, accents


def set_against(rows, toy=None, n=4):
    """Colours to set against the creator's own (the stage, a carpet, ropes, a plinth), never red by habit: their own
    background when it is plain (a logo's white paper); the hue opposite their main one, light, for the toy's darks
    to read on, and deep, for its lights; a deep of their own family; a neutral in their hue. rows: creator_colours'
    rows; toy: the toy's main colours (hexes; else their accents). Each [{hex, why, worst}], worst the lowest
    contrast of the toy's colours on it: a sheet to show the user, who picks."""
    toy = [t.upper() for t in (toy or [])] or [r["hex"] for r in rows if r["chroma"] >= 0.05][:3] or [rows[0]["hex"]]
    loud = [r for r in rows if r["chroma"] >= 0.04] or rows
    a = sum(math.cos(math.radians(r["hue"])) * r["share"] * r["chroma"] for r in loud)
    b = sum(math.sin(math.radians(r["hue"])) * r["share"] * r["chroma"] for r in loud)
    hue, opp = math.degrees(math.atan2(b, a)) % 360, (math.degrees(math.atan2(b, a)) + 180) % 360
    at = lambda L, c, h: hexof(from_oklab([[L, c * math.cos(math.radians(h)), c * math.sin(math.radians(h))]])[0]).upper()  # noqa: E731
    worst = lambda h, among=toy: round(min(contrast(t, h) for t in among), 2)  # noqa: E731
    light_of = lambda h: float(oklab(np.array([rgb(h)]))[0][0])  # noqa: E731
    darks, lights = [t for t in toy if light_of(t) < 0.6], [t for t in toy if light_of(t) >= 0.6]

    def best(Ls, among, chroma=0.09):  # the lightness in Ls where `among` stands best on the opposite hue
        c = lambda L: min(chroma, (1 - L) * 0.4 + 0.01)  # noqa: E731  less chroma near white: a pale tint, not a clipped cyan
        tries = [(L, worst(at(L, c(L), opp), among)) for L in Ls]
        top = max(w for _, w in tries)
        L = max(L for L, w in tries if w >= top * 0.95)
        return at(L, c(L), opp)
    out = []
    plain = next((r for r in rows if r["chroma"] < 0.03 and r["light"] > 0.88 and r["share"] >= 0.1), None)
    if plain:
        out.append({"hex": plain["hex"].upper(), "why": "their own background"})
    if darks:
        out.append({"hex": best([L / 100 for L in range(62, 97, 2)], darks), "why": "the hue opposite theirs, light: the toy's darks read on it"})
    if lights:
        out.append({"hex": best([L / 100 for L in range(14, 42, 2)], lights, 0.07), "why": "the hue opposite theirs, deep: the toy's lights read on it"})
    out.append({"hex": at(0.26, 0.06, hue), "why": "a deep of their own family"})
    out.append({"hex": at(0.55, 0.012, hue), "why": "a neutral in their hue"})
    return [{**c, "worst": worst(c["hex"])} for c in out[:n]]
