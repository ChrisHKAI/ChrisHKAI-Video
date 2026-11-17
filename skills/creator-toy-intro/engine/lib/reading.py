"""Reading a frame as a viewer does: with the finish's bloom on it, shrunk to the size a phone shows it in the
feed, read by the computer's own text recognition, against the words the film says are on screen.

The reader: on a Mac the system's own (Vision, through read-text.swift, built once into the skill's home); on
Windows and Linux tesseract with its Chinese data (chi_sim, chi_tra), when it is installed. Without one, the
check says it could not read and is skipped (it never blocks a film for want of a reader).

  r = reader()                      # None, or what reads
  lines = read(r, [png, …])         # {png: [(text, confidence 0–1 or None), …]}
  where = boxes(r, [png, …])        # {png: [(text, confidence, (x0, y0, x1, y1)), …]}: each line's box, 0–1, y down
  silent = without_words(img, [b for _, _, b in where[png]])   # the picture with its lettering blurred past reading
  base = baseline(r, ["再看懂彼此"], (font_path, index))   # {text: the reader's confidence on it flat and large}
  ok, got = match("再看懂彼此", lines[png], base["再看懂彼此"])
"""
import json
import os
import shutil
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
from PIL import Image

HOME = Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video")
SWIFT = Path(__file__).with_name("read-text.swift")
PHONE = 360  # px: a film's short side as a phone shows it in the feed (a 16:9 film 640 wide, a 9:16 one 640 tall)
SHAKY = 0.5  # Vision's confidence under this on the right words: read, but only just


def reader():
    """('vision', binary) on a Mac, ('tesseract', path, langs) with its Chinese data, else None."""
    if sys.platform == "darwin" and SWIFT.exists():
        out = HOME / "bin" / "read-text"
        if not out.exists() or out.stat().st_mtime < SWIFT.stat().st_mtime:
            if shutil.which("swiftc"):
                out.parent.mkdir(parents=True, exist_ok=True)
                r = subprocess.run(["swiftc", "-O", str(SWIFT), "-o", str(out)], capture_output=True, text=True)
                if r.returncode != 0:
                    out = None
            else:
                out = None
        if out and out.exists():
            return ("vision", str(out))
    t = shutil.which("tesseract")
    if t:
        r = subprocess.run([t, "--list-langs"], capture_output=True, text=True)
        langs = [l for l in ("chi_tra", "chi_sim", "eng") if l in r.stdout.split()]
        if any(l.startswith("chi") for l in langs):
            return ("tesseract", t, "+".join(langs))
    return None


def name(r):
    return {"vision": "macOS 文字识别", "tesseract": "tesseract"}[r[0]] if r else None


def read(r, paths):
    """Each picture's lines of text, as the reader sees them: {path: [(text, confidence or None)]}."""
    paths = [str(p) for p in paths]
    if not r or not paths:
        return {}
    if r[0] == "vision":
        res = subprocess.run([r[1], *paths], capture_output=True, text=True)
        out = {}
        for line in res.stdout.splitlines():
            try:
                d = json.loads(line)
            except ValueError:
                continue
            out[d["path"]] = [(l["text"], l["conf"]) for l in d["lines"]]
        return out
    out = {}
    for p in paths:
        res = subprocess.run([r[1], p, "stdout", "-l", r[2], "--psm", "11"], capture_output=True, text=True)
        out[p] = [(l.strip(), None) for l in res.stdout.splitlines() if l.strip()]
    return out


def wordy(text):
    """Is it lettering a viewer reads (a letter or a digit in it), not a mark alone (！ ？ …)?"""
    return any(unicodedata.category(ch)[0] in "LN" for ch in text)


def _vision(r, paths):
    res = subprocess.run([r[1], *paths], capture_output=True, text=True)
    out = {}
    for line in res.stdout.splitlines():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        out[d["path"]] = d["lines"]
    return out


def boxes(r, paths):
    """Where each line of lettering stands: {path: [(text, confidence or None, (x0, y0, x1, y1))]}, the box as
    shares of the picture, y down. Vision gives a box a line; tesseract a box a word."""
    paths = [str(p) for p in paths]
    if not r or not paths:
        return {}
    if r[0] == "vision":
        got = _vision(r, paths)
        if any(ls and "box" not in ls[0] for ls in got.values()):
            # a reader built before it gave boxes: build it again from this skill's source, once
            Path(r[1]).unlink(missing_ok=True)
            r = reader()
            got = _vision(r, paths) if r and r[0] == "vision" else {}
        return {p: [(l["text"], l.get("conf"), (l["box"][0], 1 - l["box"][1] - l["box"][3], l["box"][0] + l["box"][2], 1 - l["box"][1]))
                    for l in ls if "box" in l] for p, ls in got.items()}
    import tempfile
    from PIL import ImageOps
    out = {}
    for p in paths:
        with Image.open(p) as im:
            im = im.convert("RGB")
        W, H = im.size
        # as it is, then twice the size in grey at full contrast: light lettering on a coloured block is found
        # only so. tesseract also reads letters into rows of seats and edges of boxes: only what it is sure of,
        # at a size a viewer could read, is taken for lettering
        tries = (im, ImageOps.autocontrast(im.resize((W * 2, H * 2), Image.LANCZOS).convert("L")))
        found = []
        with tempfile.TemporaryDirectory(prefix="boxes-") as tmp:
            for k, img in enumerate(tries):
                q = Path(tmp) / f"{k}.png"
                img.save(q)
                res = subprocess.run([r[1], str(q), "stdout", "-l", r[2], "--psm", "11", "tsv"], capture_output=True, text=True)
                found += [row for row in tsv_boxes(res.stdout, *img.size) if _sure(row, W, H)]
        out[p] = found
    return out


def boxes_closer(r, path, n=3, zoom=2, over=0.06):
    """boxes() of one picture, and of its n × n tiles at zoom times the size, overlapping by `over`: the small
    lettering a viewer reads off a still (a slide's lines, a post's text, a corner's date) that a reading of the
    whole picture passes over. [(text, confidence or None, box as shares of the picture)]."""
    import tempfile
    path = str(path)
    found = list(boxes(r, [path]).get(path, []))
    with Image.open(path) as im:
        im = im.convert("RGB")
    W, H = im.size
    with tempfile.TemporaryDirectory(prefix="closer-") as tmp:
        tiles = {}
        for i in range(n):
            for j in range(n):
                x0, y0 = max(0.0, i / n - over), max(0.0, j / n - over)
                x1, y1 = min(1.0, (i + 1) / n + over), min(1.0, (j + 1) / n + over)
                t = im.crop((round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H)))
                q = str(Path(tmp) / f"{i}-{j}.png")
                t.resize((t.width * zoom, t.height * zoom), Image.LANCZOS).save(q)
                tiles[q] = (x0, y0, x1 - x0, y1 - y0)
        for q, rows in boxes(r, list(tiles)).items():
            ox, oy, sx, sy = tiles[q]
            found += [(t, c, (ox + b[0] * sx, oy + b[1] * sy, ox + b[2] * sx, oy + b[3] * sy)) for t, c, b in rows]
    return found


def _sure(row, W, H):
    """Is tesseract's word lettering a viewer would read: sure of itself, big enough, more than a stray stroke?"""
    text, conf, (x0, y0, x1, y1) = row
    if conf is not None and conf < 0.6:
        return False
    if min((x1 - x0) * W, (y1 - y0) * H) < 0.012 * min(W, H):
        return False
    letters = [ch for ch in text if unicodedata.category(ch)[0] in "LN"]
    if len(letters) == 1:  # one letter alone: a character of Chinese it is sure of, never a dash read as 一
        return ord(letters[0]) >= 0x3400 and letters[0] not in "一二三十丨" and (conf is None or conf >= 0.8)
    return bool(letters)


def tsv_boxes(tsv, W, H):
    """tesseract's table of what it read (level, …, left, top, width, height, conf, text): its words, with their boxes."""
    rows = []
    for line in tsv.splitlines()[1:]:
        c = line.split("\t")
        if len(c) < 12 or c[0] != "5" or not c[11].strip():
            continue
        try:
            x, y, w, h, conf = int(c[6]), int(c[7]), int(c[8]), int(c[9]), float(c[10])
        except ValueError:
            continue
        if conf < 0 or w <= 0 or h <= 0:
            continue
        rows.append((c[11].strip(), conf / 100, (x / W, y / H, (x + w) / W, (y + h) / H)))
    return rows


def without_words(img, where, strength=1.0):
    """The picture with each box of lettering blurred past reading. What the lettering stood on keeps its place and
    its colour (a label is still a label, a sign a sign, a screen a screen); what it said is gone. where: boxes
    (x0, y0, x1, y1) as shares of the picture, y down."""
    from PIL import ImageDraw, ImageFilter
    out = img.convert("RGB").copy()
    W, H = out.size
    for x0, y0, x1, y1 in where:
        size = max(2.0, min((x1 - x0) * W, (y1 - y0) * H))  # the letters' size: the short side of their line
        pad = max(4, round(0.22 * size))
        box = (max(0, round(x0 * W) - pad), max(0, round(y0 * H) - pad), min(W, round(x1 * W) + pad), min(H, round(y1 * H) + pad))
        if box[2] - box[0] < 3 or box[3] - box[1] < 3:
            continue
        piece = out.crop(box)
        # a letter's strokes are an eighth of its height or so: a blur of half that height leaves no letter
        blurred = piece.filter(ImageFilter.GaussianBlur(max(5.0, 0.5 * size * strength)))
        mask = Image.new("L", piece.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((pad // 3, pad // 3, piece.width - 1 - pad // 3, piece.height - 1 - pad // 3), radius=pad, fill=255)
        out.paste(blurred, box[:2], mask.filter(ImageFilter.GaussianBlur(max(1.0, pad / 3))))
    return out


def finish_look(img, bloom_from=0.85, bloom=0.3):
    """The finish step's bloom on a frame of any size (engine/scripts/finish.py: its glow, scaled to the frame)."""
    from scipy.ndimage import gaussian_filter
    srgb = np.asarray(img.convert("RGB"), dtype=np.float32) / 255
    if bloom <= 0:
        return img.convert("RGB")
    H, W = srgb.shape[:2]
    k = max(W, H) / 1920
    lin = srgb ** 2.2
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    bright = lin * (np.clip((lum - bloom_from) / (1 - bloom_from), 0, 1)[..., None])
    small = bright[::2, ::2]
    glow = gaussian_filter(small, sigma=(6 * k, 6 * k, 0)) * 0.55 + gaussian_filter(small, sigma=(22 * k, 22 * k, 0)) * 0.35
    glow = np.repeat(np.repeat(glow, 2, axis=0), 2, axis=1)[:H, :W]
    out = np.clip(lin + glow * bloom, 0, 1) ** (1 / 2.2)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8))


def phone(img):
    """The frame as small as a phone shows it in the feed: its short side PHONE pixels."""
    w, h = img.size
    k = PHONE / min(w, h)
    return img.resize((round(w * k), round(h * k)), Image.LANCZOS)


# what a reader takes one for the other, where the film's words do not care (I and 1, O and 0, full and half width)
CONFUSE = str.maketrans({"1": "I", "l": "I", "|": "I", "!": "I", "0": "O"})


def norm(s):
    """Letters and characters only, in one width and case, the look-alikes made one."""
    s = unicodedata.normalize("NFKC", s).translate(CONFUSE)
    return "".join(c for c in s if unicodedata.category(c)[0] in "LN").upper().translate(CONFUSE)


def _mostly(t, want):
    """Whether most of a recognised line's characters are the target's: a neighbour sharing an I or a 0 is not it."""
    return sum(b.size for b in SequenceMatcher(None, t, want, autojunk=False).get_matching_blocks()) >= 0.6 * len(t)


def confidence(expected, lines):
    """The reader's lowest confidence on the recognised lines that are this line (None: no confidence, or not there)."""
    want = norm(expected)
    confs = [c for t, c in ((norm(t), c) for t, c in lines) if t and c is not None and _mostly(t, want)]
    return min(confs) if confs else None


def match(expected, lines, base=None):
    """(how it went, what it read): "ok", "shaky" (the words, but at low confidence), or "wrong", with the text it read
    nearest the line. Lines on screen are read in any order and in pieces (a line split over two labels).
    base: the reader's confidence on the same line drawn flat and large (baseline()). Vision's confidence says how
    much a string looks like a sentence, not how clear it is: a line of Chinese with a Latin word in it gets 0.3
    however large; so only a confidence under the line's own base counts as shaky."""
    want = norm(expected)
    if not want:
        return "ok", ""
    texts = [(norm(t), c) for t, c in lines if norm(t)]
    whole = "".join(t for t, _ in texts)
    sm = SequenceMatcher(None, want, whole, autojunk=False)
    got = sum(b.size for b in sm.get_matching_blocks())
    # the text it read where the line is: the recognised lines that share characters with it, in order
    near = [(t, c) for t, c in texts if set(t) & set(want)]
    said = "".join(t for t, _ in near)
    if got < len(want):
        return "wrong", said
    own = [(t, c) for t, c in near if _mostly(t, want)] or near
    confs = [c for t, c in own if c is not None]
    return ("shaky" if confs and min(confs) < min(SHAKY, base if base is not None else SHAKY) else "ok"), said


def baseline(r, texts, face, em=120):
    """Each line's confidence drawn flat, large, black on white in the film's face: {text: confidence or None}.
    face: (path, index). What the reader gives a line it cannot miss is its ceiling for that line."""
    if not r or not texts:
        return {}
    import tempfile
    from PIL import ImageDraw, ImageFont
    f = ImageFont.truetype(face[0], em, index=face[1])
    tmp = Path(tempfile.mkdtemp())
    paths = {}
    for i, t in enumerate(texts):
        w = round(f.getlength(t)) + em
        img = Image.new("RGB", (w, round(em * 2)), "white")
        ImageDraw.Draw(img).text((em // 2, em // 3), t, font=f, fill="black")
        paths[t] = tmp / f"{i}.png"
        img.save(paths[t])
    got = read(r, list(paths.values()))
    shutil.rmtree(tmp, ignore_errors=True)
    return {t: confidence(t, got.get(str(p), [])) for t, p in paths.items()}
