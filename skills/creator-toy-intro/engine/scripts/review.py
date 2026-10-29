"""The independent review's brief (references/review.md): build/review.md, all a
fresh reviewer gets. It holds the creator and the platform, the film's parts,
contact sheets of the film (a frame every half second, each with its time), the
sound cues, the lines to read and how long each needs, the pace check's results
and the rubric with the form to answer in.

The sheets come from the animatic (step 4), or with --final from the finished
film (step 5). With neither, they come from the preview frames.

usage: FILM=<film folder> python3 engine/scripts/review.py [--final]
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
from film import FILM, FILM_JSON, SKILL, TEMPLATE  # noqa: E402
from publish import PLATFORMS, platforms  # noqa: E402
import pacing  # noqa: E402

F = FILM_JSON
B = FILM / "build"
OUT = B / "review"
TL = json.loads((B / "timeline.json").read_text())
DUR, FPS = TL["DURATION"], TL["FPS"]
W_, H_ = F["format"]["size"]
EVERY, COLS, ROWS = 0.5, 5, 4  # a frame every half second, 20 to a sheet (10 s)
TH = (320, round(320 * H_ / W_)) if W_ >= H_ else (round(220 * W_ / H_), 220)


def label(im, text):
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.load_default(size=max(14, im.height // 12))
    except TypeError:  # an older Pillow: its one small font
        font = ImageFont.load_default()
    x0, y0, x1, y1 = d.textbbox((6, 4), text, font=font)
    d.rectangle((x0 - 4, y0 - 3, x1 + 4, y1 + 3), fill=(0, 0, 0))
    d.text((6, 4), text, fill=(255, 220, 60), font=font)
    return im


def sheets(shots):
    """Contact sheets from [(time, picture path)]: COLS × ROWS to a sheet, each frame labelled with its time."""
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("sheet-*.jpg"):
        old.unlink()
    paths, per = [], COLS * ROWS
    for k in range(0, len(shots), per):
        part = shots[k:k + per]
        sheet = Image.new("RGB", (COLS * TH[0], ((len(part) + COLS - 1) // COLS) * TH[1]), (12, 13, 16))
        for i, (t, p) in enumerate(part):
            im = label(Image.open(p).convert("RGB").resize(TH, Image.LANCZOS), f"{t:.1f} s")
            sheet.paste(im, ((i % COLS) * TH[0], (i // COLS) * TH[1]))
        path = OUT / f"sheet-{k // per + 1:02d}.jpg"
        sheet.save(path, quality=85)
        paths.append((path, part[0][0], part[-1][0]))
    return paths


def from_video(video):
    tmp = Path(tempfile.mkdtemp())
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"fps={1 / EVERY}", str(tmp / "%04d.png")], check=True)
    return [(i * EVERY, p) for i, p in enumerate(sorted(tmp.glob("*.png")))]


final = FILM / F.get("output", "out/film.mp4")
animatic = B / "storyboard/animatic.mp4"
if "--final" in sys.argv:
    if not final.exists():
        raise SystemExit(f"no {final.relative_to(FILM)} yet: finish the film first (or leave out --final)")
    source, shots = f"the finished film ({final.name})", from_video(final)
elif animatic.exists():
    source, shots = "the animatic (EEVEE, a third of the size: the light and materials are close to the final, not the same)", from_video(animatic)
else:
    previs = sorted((B / "previs").glob("*.png"))
    if not previs:
        raise SystemExit("nothing to look at yet: render the preview frames or the animatic first (references/storyboard.md)")
    source, shots = "the preview frames (Cycles, half size; only these moments)", [((int(p.stem) - 1) / FPS, p) for p in previs]
made = sheets(shots)

# the film's parts: its segments, or the template's own parts on the story's events, their {names} filled as on the page
class Fill(dict):
    def __missing__(self, k):
        return "{" + k + "}"


prof, cta, counter = F.get("profile", {}), F.get("cta", {}), F.get("counter")
toy = json.loads((FILM / F["toy"]).read_text()) if F.get("toy") and (FILM / F["toy"]).exists() else {}
FILL = Fill(name=prof.get("name", ""), handle="@" + prof.get("handle", ""), slogan="".join(p["text"] for p in cta.get("slogan", [])),
            counter=f"{counter.get('display') or str(counter['value']) + counter['unit']} {counter['label']}" if counter else "",
            prop=cta.get("prop", {}).get("kind", "the end card's prop"),
            signature={"glasses": "pushes his glasses"}.get((toy.get("signature") or {}).get("move"), "a wave"),
            proof1=F.get("posts", {}).get("pinned", {}).get("title", ""), proof2=F.get("posts", {}).get("retro", {}).get("title", ""))
en = lambda d: (d.get("en", "") if isinstance(d, dict) else d or "").format_map(FILL)  # noqa: E731
parts = []
if TL.get("SEGMENTS"):
    for s in TL["SEGMENTS"]:
        if s["kind"] == "beat":
            sb = s.get("storyboard", {}).get("part", {})
            parts.append(f"{s['f0']:.1f}–{s['f1']:.1f} s: beat \"{s['beat']}\": {en(sb.get('what', ''))}")
        else:
            parts.append(f"{s['f0']:.1f}–{s['f1']:.1f} s: the story, its {s['s0']:.1f}–{s['s1']:.1f} s")
elif (TEMPLATE / "storyboard.json").exists():
    ev = TL["EV"]
    at = lambda v: v if isinstance(v, (int, float)) else (DUR if v == "end" else (ev[v][0] if isinstance(ev[v], list) else ev[v]))  # noqa: E731
    for p in json.loads((TEMPLATE / "storyboard.json").read_text())["parts"]:
        parts.append(f"{at(p['from']):.1f}–{at(p['to']):.1f} s: {en(p['label'])}: {en(p['what'])}")

P = pacing.check(FILM)
pace = [f"- first hit: {P['hook']} s" + ("" if P["hook"] is not None and P["hook"] <= 3 else " (not within 3 s)")]
pace += [f"- quiet: {a}–{z} s, {z - a:.1f} s with nothing new" for a, z in P["dead"]] or [f"- no quiet stretch longer than two bars ({2 * P['bar']:g} s)"]
pace += [f"- the toy alone: {a}–{z} s, {n} hops and nothing else new" for a, z, n in P["alone"]]
if P["reads"] is None:
    reads = ["(the template does not say: read what you can from the sheets)"]
else:
    reads = [f"- \"{r['text']}\" {r['at'][0]:g}–{r['at'][1]:g} s: shown {r['shown']:g} s, needs {r['need']:g} s"
             + ("" if r["ok"] else " (to the end: the last frame stays)" if r["toEnd"] else " (too short)") for r in P["reads"]]
cues = ", ".join(f"{c['t']:.2f} {c['kind']}" for c in sorted(TL["cues"], key=lambda c: c["t"]))
rubric = (SKILL / "references/review.md").read_text().split("<!-- rubric -->")[1].split("<!-- /rubric -->")[0].strip()
where = ", ".join(PLATFORMS[p]["name"] for p in platforms([])) or "X"

direction = F.get("story", {}).get("direction")
narrative = ("\n## Intended story (compare against the actual frames)\n\n```json\n"
             + json.dumps(direction, ensure_ascii=False, indent=2) + "\n```\n"
             if direction else "")

brief = f"""# Review: {prof.get('name', F.get('id', 'the film'))}'s intro film

You review a short film on your own, with fresh eyes. Read this file and the
pictures it names, nothing else.

The film introduces a creator, {prof.get('name', '')} (@{prof.get('handle', '')}), to their audience on {where}.
Their profile picture becomes a 3D vinyl toy of them, which acts out their best
posts and numbers on a dark stage, and ends on their name and a call to action.
It is {DUR:g} s long, {W_}×{H_} ({'portrait' if H_ > W_ else 'landscape'}), {FPS} fps, {TL['BPM']} BPM (a bar is {TL['BAR']:g} s).
The words on screen are in {F.get('language', 'zh-Hans')}.

## What to look at

{source}, a frame every {EVERY:g} s, each labelled with its time:

""" + "\n".join(f"- `{p}` ({a:.1f}–{z:.1f} s)" for p, a, z in made) + """

## The film's parts

""" + "\n".join(f"- {p}" for p in parts) + narrative + f"""

## The sound cues (time in s, then what)

{cues}

## The lines the viewer reads

""" + "\n".join(reads) + """

## The pace check (from the film's numbers)

""" + "\n".join(pace) + f"""

{rubric}
"""
(B / "review.md").write_text(brief)
print(f"review → build/review.md, {len(made)} sheet(s) in build/review/ from {source.split(' (')[0]}")
print("give build/review.md to a fresh reviewer (references/review.md); fix its three, render what they touch")
