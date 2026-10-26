"""The big screen's feed for every frame of the film, edited from the references
to src/timeline.js's clock (build/cues.json), plus its sound:

  keynote → portrait the user's subtitled cut, whole (jobs-2007-2011-subs.mp4):
                     the 2007 keynote, "an iPod, a phone, an internet communicator
                     ... and we are calling it iPhone"; D8 (2010), a flexible iPad?
                     "...probably many years away"; the news (2011), "The death of
                     a man who literally changed the way we live ... has died at
                     the age of 56"
  portrait → flicker the black-and-white portrait (See You Again comes up)
  flicker → off      the picture jumps and flashes
  off → vanish       it collapses to a line, a dot, then dark

and how bright each frame is (build/tv/luma.json: mean linear luminance), for
the screen's light on the stage.

usage: node scripts/cues.mjs && python3 scripts/tv.py   → build/tv/####.jpg (film frame numbers), tv.wav, luma.json
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT.parent.parent / "reference/tim"
OUT = ROOT / "build/tv"
OUT.mkdir(parents=True, exist_ok=True)
FPS, W, H = 30, 1920, 1080  # full size: the screen fills the frame for a minute
CUE = json.loads((ROOT / "build/cues.json").read_text())
EV, DUR = CUE["EV"], CUE["DURATION"]
TOTAL = round(DUR * FPS)


def frames_of(src, start, dur, vf="", first=1):
    """Extract `dur` seconds from `start` as film frames first, first+1, …"""
    tmp = OUT / "tmp"
    tmp.mkdir(exist_ok=True)
    for f in tmp.glob("*.jpg"):
        f.unlink()
    chain = (vf + "," if vf else "") + f"fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1"
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", str(src), "-vf", chain, "-q:v", "2", str(tmp / "%04d.jpg")], check=True)
    got = sorted(tmp.glob("*.jpg"))
    n = round(dur * FPS)
    for i in range(n):
        g = got[min(i, len(got) - 1)]
        g.replace(OUT / f"{first + i:04d}.jpg") if i < len(got) - 1 else Image.open(g).save(OUT / f"{first + i:04d}.jpg", quality=92)
    return first + n


def frame_no(t):
    return round(t * FPS) + 1


SEGS = [  # (source, start, length, crop, film time)
    (REF / "jobs-2007-2011-subs.mp4", 0.0, EV["portrait"] - EV["keynote"], "", EV["keynote"]),
]
for src, st, du, vf, at in SEGS:
    frames_of(src, st, du, vf=vf, first=frame_no(at))

# the portrait on its white page, letterboxed to 16:9
pic = Image.open(REF / "steve-jobs-bw.jpg").convert("RGB")
page = Image.new("RGB", (W, H), (255, 255, 255))
s = H / pic.height
pic = pic.resize((round(pic.width * s), H), Image.LANCZOS)
page.paste(pic, ((W - pic.width) // 2, 0))
for i in range(frame_no(EV["portrait"]), frame_no(EV["flicker"])):
    page.save(OUT / f"{i:04d}.jpg", quality=92)

# the picture jumps, rolls and flashes
rng = np.random.default_rng(7)
base = np.asarray(page, dtype=np.float32)
for i in range(frame_no(EV["flicker"]), frame_no(EV["off"])):
    k = (i - frame_no(EV["flicker"])) / (frame_no(EV["off"]) - frame_no(EV["flicker"]))
    img = np.roll(base, int(rng.integers(-40, 40) * k), axis=1)
    img = np.roll(img, int(rng.integers(-30, 30) * k), axis=0)
    gain = 1.0 + (rng.random() * 0.9 if rng.random() < 0.5 else -rng.random() * 0.7) * (0.4 + k)
    img = img * gain
    rows = rng.random(H) < 0.08 * (0.3 + k)
    img[rows] = img[rows] * 0.25 + 200
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(OUT / f"{i:04d}.jpg", quality=92)

# power off: squeeze to a bright line, then to a dot, then dark
a, b = frame_no(EV["off"]), frame_no(EV["vanish"])
for i in range(a, b):
    k = (i - a) / (b - a)
    img = Image.new("RGB", (W, H), (0, 0, 0))
    if k < 0.55:
        h = max(2, int(H * (1 - k / 0.55) ** 3))
        strip = page.resize((W, h)).point(lambda v: min(255, v * (1 + 2 * k)))
        img.paste(strip, (0, (H - h) // 2))
    else:
        kk = (k - 0.55) / 0.45
        w = max(2, int(W * (1 - kk) ** 2))
        line = Image.new("RGB", (w, 3), (255, 255, 255))
        img.paste(line, ((W - w) // 2, H // 2 - 1))
        if kk > 0.6:
            dot = Image.new("RGB", (8, 8), (int(255 * (1 - kk) * 2.5),) * 3)
            img.paste(dot, (W // 2 - 4, H // 2 - 4))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    img.save(OUT / f"{i:04d}.jpg", quality=92)
black = Image.new("RGB", (W, H), (0, 0, 0))
for i in range(b, TOTAL + 1):
    black.save(OUT / f"{i:04d}.jpg", quality=92)

luma = []
for i in range(1, TOTAL + 1):
    im = Image.open(OUT / f"{i:04d}.jpg")
    im.draft("RGB", (W // 8, H // 8))
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255
    a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    luma.append(round(float((a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).mean()), 4))
(OUT / "luma.json").write_text(json.dumps(luma))

# its sound: the clips back to back, then nothing
segs = [(src, st, du) for src, st, du, _, _ in SEGS]
inputs, filt = [], []
for k, (src, st, du) in enumerate(segs):
    inputs += ["-ss", str(st), "-t", str(du), "-i", str(src)]
    filt.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=0.04,afade=t=out:st={du - 0.06}:d=0.06[a{k}]")
filt.append("".join(f"[a{k}]" for k in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1,apad=whole_dur={DUR}[out]")
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]", "-t", str(DUR), str(OUT / "tv.wav")], check=True)
print("tv frames:", len(list(OUT.glob("*.jpg"))), "→", OUT)
