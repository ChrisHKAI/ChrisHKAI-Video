"""The agent's side of the studio's inbox (build/comments.jsonl): the user's notes
from the storyboard page, each with its time, frame and the spot they clicked
(x, y from the top left, 0–1). For each note it writes build/comments/<id>.jpg:
the real frame they clicked (the Cycles preview frame, or the animatic's picture
at that moment) with a red ring on the spot. Look at it, change what the note
asks, re-render what it touches, then mark it done with a line on what changed
(the page shows the line under the note).

usage: FILM=<film folder> python3 engine/scripts/comments.py [--all] [--in build/previs]
       FILM=<film folder> python3 engine/scripts/comments.py --done c3 "the badge holds 2 s longer"
"""
import io
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
from film import FILM  # noqa: E402

INBOX = FILM / "build/comments.jsonl"
argv = sys.argv[1:]
notes = [json.loads(line) for line in INBOX.read_text().splitlines() if line.strip()] if INBOX.exists() else []

if argv[:1] == ["--done"]:
    nid, reply = argv[1], " ".join(argv[2:])
    note = next((n for n in notes if n["id"] == nid), None)
    if not note:
        raise SystemExit(f"no note {nid}")
    note.update(status="done", reply=reply, doneAt=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    INBOX.write_text("".join(json.dumps(n, ensure_ascii=False) + "\n" for n in notes))
    print(f"{nid} done: {reply}")
    raise SystemExit

SRC = FILM / (argv[argv.index("--in") + 1] if "--in" in argv else "build/previs")
OUT = FILM / "build/comments"


def picture(note):
    """The real frame the user clicked: the preview frame, else the animatic at that time."""
    frame = SRC / f"{note['frame']:04d}.png"
    if note.get("source") != "animatic" and frame.exists():
        return Image.open(frame).convert("RGB")
    animatic = FILM / "build/storyboard/animatic.mp4"
    if animatic.exists():
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{note['t']:.3f}", "-i", str(animatic), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
        if r.returncode == 0 and r.stdout:
            return Image.open(io.BytesIO(r.stdout)).convert("RGB")
    return Image.open(frame).convert("RGB") if frame.exists() else None


shown = notes if "--all" in argv else [n for n in notes if n["status"] == "open"]
if not shown:
    print("no open notes" if notes else "no notes yet (FILM=<film> node engine/run.mjs studio)")
for n in shown:
    img = picture(n) if n.get("x") is not None else None
    marked = ""
    if img:
        w, h = img.size
        x, y, r, lw = n["x"] * w, n["y"] * h, max(18, w * 0.035), max(4, int(w / 200))
        d = ImageDraw.Draw(img)
        d.ellipse((x - r - lw, y - r - lw, x + r + lw, y + r + lw), outline="#ffffff", width=lw)  # white under the red, so it reads on any picture
        d.ellipse((x - r, y - r, x + r, y + r), outline="#e2463b", width=lw)
        if w > 1280:
            img = img.resize((1280, round(h * 1280 / w)), Image.LANCZOS)
        OUT.mkdir(parents=True, exist_ok=True)
        img.save(OUT / f"{n['id']}.jpg", quality=85)
        marked = f"  → build/comments/{n['id']}.jpg"
    src = "animatic" if n.get("source") == "animatic" else "preview frame"
    print(f"{n['id']} [{n['status']}] {n['t']:.2f} s, frame {n['frame']} ({src}), at ({n.get('x', 0):.2f}, {n.get('y', 0):.2f}){marked}")
    print(f"   {n['text']}")
    if n.get("reply"):
        print(f"   → {n['reply']}")
