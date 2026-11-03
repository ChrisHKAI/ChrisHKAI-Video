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
    """This film's time for each kind of moment (s), from build/timeline.json: the story's own events where the film
    plays them; in a film of its own beats, each beat's own moment (its last storyboard frame: where it locks)."""
    tl = json.loads((FILM / "build/timeline.json").read_text())
    dur, segs = tl["DURATION"], tl.get("SEGMENTS") or []
    story = tl["STORY"]["EV"] if segs else tl.get("EV", {})

    def at(k):  # a story event in film time, or None when no piece of the film plays it
        v = story.get(k)
        if not isinstance(v, (int, float)):
            return None
        if not segs:
            return v
        return next((v - s["s0"] + s["f0"] for s in segs if s["kind"] == "story" and s["s0"] - 1e-6 <= v <= s["s1"] + 1e-6), None)
    # the beats between the opening and the end card (a film of its own beats opens and ends with one too)
    beats = [s for s in segs if s["kind"] == "beat"]
    middle = [s for s in beats if s["f0"] > 1e-3 and s["f1"] < dur - 1e-3] or beats

    def times(s):  # a beat's storyboard frames in film time
        return [s["f0"] + f["at"] for f in (s.get("storyboard") or {}).get("frames") or []] or [s["f1"] - 0.5]
    if len(middle) > 1:
        mine = (times(middle[0])[-1], times(middle[-1])[-1])
    elif middle:
        ts = times(middle[0])
        mine = (ts[len(ts) // 2] if len(ts) > 1 else ts[0], ts[-1])
    else:
        mine = (dur * 0.33, dur * 0.66)
    proof = at("lock") or mine[0]
    payoff = at("peak") or mine[1]
    return {"opening": 0.5, "toy": (at("pop") or 2.0) + 1.5, "proof": proof, "payoff": payoff, "end": dur - 0.5}, tl["FPS"]


def luma_of(path):
    """A picture's mean brightness (0–255), or None."""
    try:
        return float((np.asarray(Image.open(path).convert("L"), dtype=np.float32)).mean())
    except Exception:
        return None


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
    # a light stage (white paper, a logo's own background) is outside the dark references by design: its brightness
    # and contrast are not held to theirs (the user's own references can be: --refs)
    import colors  # noqa: E402
    sky = colors.stage_for(FILM)[1]["sky"]
    light = not OWN and float(np.dot([int(sky[i:i + 2], 16) for i in (1, 3, 5)], [0.2126, 0.7152, 0.0722])) > 150
    if light:
        print(f"a light stage ({sky}): brightness and contrast are not held to the dark references; colourfulness is, and the toy must still stand out (the colour check)")
    # a dark cover makes a dark frame whatever the light: said as the cover's, not as the light's
    covers = {k: luma_of(FILM / ((FILM_JSON.get("posts") or {}).get(k) or {}).get("cover", "")) for k in ("pinned", "retro")}
    darkest = min((v for v in covers.values() if v is not None), default=None)
    # where this film's numbers fall outside the references' own range, said in a line each
    for kind, row in numbers.items():
        me = row.get("this film")
        refs = [row[n] for n in REFS if n in row]
        if not me or not refs:
            continue
        for k, word in (("bright", "brightness"), ("contrast", "contrast"), ("colour", "colourfulness")):
            if light and k != "colour":
                continue
            lo, hi = min(v[k] for v in refs), max(v[k] for v in refs)
            if me[k] < lo * 0.8 or me[k] > hi * 1.25:
                why = ""
                if k == "bright" and me[k] < lo * 0.8 and kind in ("proof", "payoff") and darkest is not None and darkest < 50:
                    why = f": the cover itself is dark (brightness {darkest:.0f}), so the frame is dark by its material, not its light; frame it closer, or keep it (references/storyboard.md)"
                print(f"! {LABEL[kind]}: {word} {me[k]:.0f}, the references {lo:.0f}–{hi:.0f}{why}")
    if missing:
        print(f"render these first: FILM={FILM} node engine/run.mjs render -- --frames {','.join(map(str, sorted(set(missing))))} --samples 24 --scale 50 --out {SRC.relative_to(FILM)}")


if __name__ == "__main__":
    main()
