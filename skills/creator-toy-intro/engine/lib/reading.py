"""Reading a frame as a viewer does: with the finish's bloom on it, shrunk to the size a phone shows it in the
feed, read by the computer's own text recognition, against the words the film says are on screen.

The reader: on a Mac the system's own (Vision, through read-text.swift, built once into the skill's home); on
Windows and Linux tesseract with its Chinese data (chi_sim, chi_tra), when it is installed. Without one, the
check says it could not read and is skipped (it never blocks a film for want of a reader).

  r = reader()                      # None, or what reads
  lines = read(r, [png, …])         # {png: [(text, confidence 0–1 or None), …]}
  ok, got = match("再看懂彼此", lines[png])
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


def match(expected, lines):
    """(how it went, what it read): "ok", "shaky" (the words, but at low confidence), or "wrong", with the text it read
    nearest the line. Lines on screen are read in any order and in pieces (a line split over two labels)."""
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
    confs = [c for t, c in near if c is not None]
    return ("shaky" if confs and min(confs) < SHAKY else "ok"), said
