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

STAGE = "#0b0c10"  # what the camera sees behind everything (engine/scripts/scene.py's world)
READ, MELT = 3.0, 1.6  # lettering wants READ:1; a big colour under MELT:1 melts into the stage


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


def film_colours(film):
    """The film's colours as the viewer meets them on the stage: the toy's (by how much of it each covers),
    the lettering's (from build/anim.json's type materials) and the confetti's (film.json pop)."""
    film = Path(film)
    F = json.loads((film / "film.json").read_text())
    anim = json.loads((film / "build/anim.json").read_text())
    toy = json.loads((film / F["toy"]).read_text()) if F.get("toy") and (film / F["toy"]).exists() else {}
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
        x, y, z = (list(p.get("size", [0, 0, 0])) + [0, 0, 0])[:3]
        key = p.get("mat")
        if key in palette:
            area[key] = area.get(key, 0) + 2 * (x * y + y * z + z * x)
    total = sum(area.values()) or 1
    toy_rows = sorted(({"key": k, "hex": palette[k], "share": a / total, "contrast": contrast(palette[k], STAGE)} for k, a in area.items()), key=lambda r: -r["share"])
    # dark lettering printed on a paper of its own group (label0_l0 on label0_sheet, a calendar's day on its
    # page) is read against the paper; the rest against the stage
    group = lambda name: name.split("_")[0]  # noqa: E731
    papers = {}
    for o in anim["objects"]:
        m = o.get("mat") or {}
        if m.get("type") == "paper" and isinstance(m.get("color"), str):
            papers.setdefault(group(o["name"]), m["color"])
    text = {}
    for o in anim["objects"]:
        m = o.get("mat") or {}
        # lettering: glyph outlines (curves) in a type material (confetti and a calendar's boxes share the material)
        if m.get("type") == "type" and isinstance(m.get("color"), str) and (o.get("geo") or {}).get("type") == "curve":
            back = papers.get(group(o["name"])) if contrast(m["color"], STAGE) < READ else None
            text.setdefault((m["color"].upper(), (back or STAGE).upper()), []).append(o["name"])
    text_rows = sorted(({"hex": h, "on": b, "objects": len(n), "names": n[:4], "contrast": contrast(h, b)} for (h, b), n in text.items()), key=lambda r: r["contrast"])
    conf = [c for c in (F.get("pop") or {}).get("confetti", []) if isinstance(c, str)]
    conf_rows = [{"hex": c.upper(), "contrast": contrast(c, STAGE)} for c in conf]
    return {"stage": STAGE, "toy": toy_rows, "text": text_rows, "confetti": conf_rows}


def problems(fc):
    """What will not read on the stage: (kind, row) for a big toy colour that melts, lettering under READ, confetti that melts."""
    out = [("toy", r) for r in fc["toy"] if r["share"] >= 0.1 and r["contrast"] < MELT]
    out += [("text", r) for r in fc["text"] if r["contrast"] < READ]
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
