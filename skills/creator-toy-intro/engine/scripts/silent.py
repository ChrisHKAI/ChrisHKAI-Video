"""A story's frames with every word taken off (references/story-test.md, "Read it blind first"). A film is
understood by its pictures first: a frame whose meaning lives in a caption says nothing to someone scrolling past.
So before a reader sees a story's frames with their words, they see them without: the lettering on each frame
(labels, signs, a post's text, the creator's own covers) is found by the computer's text recognition and blurred
past reading, and what it stood on stays. Marks that are not words (！ ？ …) stay too.

A frame drawn with engine/lib/stagekit.py has a wordless twin of its own (the frames' script run with
STAGEKIT_SILENT=1: silent/<name>.drawn.jpg), with the kit's lettering blurred wherever it stands, even at a slant
text recognition cannot read; this starts from it and blurs what the kit did not letter. The picture is read
whole and in tiles at twice the size, so a slide's small lines go too.

usage: python3 engine/scripts/silent.py <film> <picture> [<picture> …]   (pictures as the film names them)
→ <picture's folder>/silent/<its name>, and one JSON line: {"reader", "made": {picture: silent picture},
  "took": {picture: [what was taken off]}, "left": {picture: [what can still be read]}}
With no text recognition on this computer (engine/lib/reading.py: Vision on a Mac, tesseract elsewhere) nothing is
made and "reader" is null: the reading is then done from the pictures as they are, and says so.
"""
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import reading  # noqa: E402

ROUNDS = 3  # blur, read again, blur harder what is still read


def twin(src):
    """The wordless twin the frames' script drew (STAGEKIT_SILENT=1), if it is as new as the picture."""
    t = src.parent / "silent" / (src.stem + ".drawn.jpg")
    return t if t.is_file() and t.stat().st_mtime >= src.stat().st_mtime - 60 else None


def silence(r, src, dst):
    """One picture without its words → dst. Returns (what was taken off, what can still be read)."""
    took, left = [], []
    img = Image.open(twin(src) or src).convert("RGB")
    with tempfile.TemporaryDirectory(prefix="silent-") as tmp:
        cur = Path(tmp) / "cur.png"
        img.save(cur)
        for n in range(ROUNDS):
            found = [(t, b) for t, _, b in reading.boxes_closer(r, cur) if reading.wordy(t)]
            if not found:
                left = []
                break
            if n == 0:
                took = [t for t, _ in found]
            left = [t for t, _ in found]
            img = reading.without_words(img, [b for _, b in found], strength=1.0 + 0.8 * n)
            img.save(cur)
        else:
            left = [t for t, _, b in reading.boxes_closer(r, cur) if reading.wordy(t)]
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, quality=92)
    return took, left


if __name__ == "__main__":
    film, pictures = Path(sys.argv[1]), sys.argv[2:]
    r = reading.reader()
    out = {"reader": reading.name(r) if r else None, "made": {}, "took": {}, "left": {}}
    for p in pictures:
        src = film / p
        if not r or not src.is_file():
            continue
        dst = src.parent / "silent" / (src.stem + ".jpg")
        tw = twin(src)
        newest = max(src.stat().st_mtime, tw.stat().st_mtime if tw else 0)
        if dst.is_file() and dst.stat().st_mtime >= newest and (dst.parent / (src.stem + ".json")).is_file():
            kept = json.loads((dst.parent / (src.stem + ".json")).read_text())  # made already, from this picture as it is
            took, left = kept["took"], kept["left"]
        else:
            took, left = silence(r, src, dst)
            (dst.parent / (src.stem + ".json")).write_text(json.dumps({"took": took, "left": left, "drawn": bool(tw)}, ensure_ascii=False))
        out["made"][p] = str(dst.relative_to(film))
        out["took"][p], out["left"][p] = took, left
    print(json.dumps(out, ensure_ascii=False))
