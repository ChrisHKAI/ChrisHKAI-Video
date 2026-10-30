"""This film beside the reference films, moment by moment, before the full render.

The reference films are the delivered ones the user approved (isnail's, Kin's,
铁柱's: references/look/, from release/films). Each film has the same kinds of
moment: the opening, the toy as it arrives, the proof (a number locking), the
payoff, the end card. This film's own frames for those moments come from
rendered previews (build/previs, or --in build/sample). The sheet puts them in
rows with the references beside, and under each the frame's brightness,
contrast and colourfulness, so a flat, dark or washed-out frame shows as a
number too. The agent looks at it against references/quality.md, fixes what
falls short, and renders again.

usage: FILM=<film folder> python3 engine/scripts/compare.py [--in build/previs] [--out build/compare.jpg]
        [--refs <folder>,…: a reference of the user's own instead, its stills named opening, toy, proof, payoff, end (.jpg or .png)]
  → build/compare.jpg (the sheet), build/compare.json (the numbers); the frames still to render are printed
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)

SKILL = Path(__file__).resolve().parents[2]
LOOK = SKILL / "references/look"
argv = sys.argv[1:]


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


SRC = FILM / arg("--in", "build/previs")
OUT = FILM / arg("--out", "build/compare.jpg")
# the approved films, or folders of the user's own reference stills (--refs, relative to the film)
OWN = [FILM / r for r in arg("--refs", "").split(",") if r]
REFS = [r.name for r in OWN] or ["isnail", "kingao", "cgnot996"]


def ref_still(name, kind):
    folder = next((r for r in OWN if r.name == name), None)
    if folder is None:
        return LOOK / f"{name}-{kind}.jpg"
    return next((folder / f"{kind}{e}" for e in (".jpg", ".png", ".jpeg") if (folder / f"{kind}{e}").exists()), folder / f"{kind}.jpg")
KINDS = ["opening", "toy", "proof", "payoff", "end"]
LABEL = {"opening": "opening", "toy": "the toy arrives", "proof": "the proof locks", "payoff": "the payoff", "end": "the end card"}


def moments():
    """This film's time for each kind of moment (s), from build/timeline.json."""
    tl = json.loads((FILM / "build/timeline.json").read_text())
    E, dur = tl.get("EV", {}), tl["DURATION"]
    beats = [s for s in tl.get("SEGMENTS", []) if s["kind"] == "beat"]
    at = lambda k: E.get(k) if isinstance(E.get(k), (int, float)) else None  # noqa: E731
    proof = at("lock") or (beats[0]["f1"] - 0.5 if beats else dur * 0.33)
    payoff = at("peak") or (beats[-1]["f1"] - 0.5 if len(beats) > 1 else dur * 0.66)
    return {"opening": 0.5, "toy": (at("pop") or 2.0) + 1.5, "proof": proof, "payoff": payoff, "end": dur - 0.5}, tl["FPS"]


def stats(im):
    """Brightness (mean luma, 0–255), contrast (its spread) and colourfulness (Hasler and Süsstrunk)."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    luma = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    rg, yb = a[..., 0] - a[..., 1], 0.5 * (a[..., 0] + a[..., 1]) - a[..., 2]
    colour = np.hypot(rg.std(), yb.std()) + 0.3 * np.hypot(rg.mean(), yb.mean())
    return {"bright": round(float(luma.mean()), 1), "contrast": round(float(luma.std()), 1), "colour": round(float(colour), 1)}


def nearest(t, fps):
    """The rendered frame nearest t (within half a second), or None."""
    best = None
    for f in SRC.glob("*.png"):
        if not f.stem.isdigit():
            continue
        d = abs((int(f.stem) - 1) / fps - t)
        if d <= 0.5 and (best is None or d < best[0]):
            best = (d, f)
    return best[1] if best else None


def main():
    at, fps = moments()
    W, H = 480, 270
    pad, head = 10, 34
    sheet = Image.new("RGB", (pad + (W + pad) * (1 + len(REFS)), head + (H + 44 + pad) * len(KINDS)), (24, 24, 26))
    d = ImageDraw.Draw(sheet)
    for c, name in enumerate(["this film"] + REFS):
        d.text((pad + c * (W + pad), 10), name, fill=(240, 240, 240))
    numbers, missing = {}, []
    for r, kind in enumerate(KINDS):
        y = head + r * (H + 44 + pad)
        row = {}
        for c, name in enumerate(["this film"] + REFS):
            x = pad + c * (W + pad)
            path = nearest(at[kind], fps) if c == 0 else ref_still(name, kind)
            if path is None or not path.exists():
                d.rectangle([x, y, x + W, y + H], outline=(120, 60, 60))
                if c == 0:
                    missing.append(round(at[kind] * fps) + 1)
                    d.text((x + 12, y + H // 2), f"not rendered: frame {missing[-1]} ({at[kind]:.1f} s)", fill=(230, 120, 120))
                else:
                    d.text((x + 12, y + H // 2), f"no still: {path.name}", fill=(230, 120, 120))
                continue
            im = Image.open(path).convert("RGB")
            im.thumbnail((W, H))
            sheet.paste(im, (x + (W - im.width) // 2, y + (H - im.height) // 2))
            s = stats(im)
            row[name] = s
            d.text((x, y + H + 4), f"{LABEL[kind]}" + (f"  {at[kind]:.1f} s" if c == 0 else ""), fill=(200, 200, 200))
            d.text((x, y + H + 22), f"bright {s['bright']:.0f}  contrast {s['contrast']:.0f}  colour {s['colour']:.0f}", fill=(150, 150, 150))
        numbers[kind] = row
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, quality=88)
    (OUT.with_suffix(".json")).write_text(json.dumps({"at": at, "numbers": numbers}, indent=1))
    print("wrote", OUT.relative_to(FILM))
    # where this film's numbers fall outside the references' own range, said in a line each
    for kind, row in numbers.items():
        me = row.get("this film")
        refs = [row[n] for n in REFS if n in row]
        if not me or not refs:
            continue
        for k, word in (("bright", "brightness"), ("contrast", "contrast"), ("colour", "colourfulness")):
            lo, hi = min(v[k] for v in refs), max(v[k] for v in refs)
            if me[k] < lo * 0.8 or me[k] > hi * 1.25:
                print(f"! {LABEL[kind]}: {word} {me[k]:.0f}, the references {lo:.0f}–{hi:.0f}")
    if missing:
        print(f"render these first: FILM={FILM} node engine/run.mjs render -- --frames {','.join(map(str, sorted(set(missing))))} --samples 24 --scale 50 --out {SRC.relative_to(FILM)}")


if __name__ == "__main__":
    main()
