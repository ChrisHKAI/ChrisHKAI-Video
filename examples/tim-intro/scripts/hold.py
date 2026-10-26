"""The opening's long hold on the big screen without Cycles: while the camera is
square on to the screen and it fills the frame (src/timeline.js MOVE, push end
to pull start), a rendered frame is only the feed, scaled to the screen's size
in the frame and through the screen's emission (×1.15) and the Standard view
transform; round it, the drape as Cycles rendered it in the first of these
frames (build/hold-plate/), dimmed with the stage lights. Matches Cycles to
about 1/255 on average. Writes those frames into the render folder; scene.py
renders the rest.

usage: python3 scripts/hold.py --list                       → the frames, e.g. 121-2580
       blender … scene.py -- --frames <first> --samples 32 --out build/hold-plate
       python3 scripts/hold.py [--out build/render] [--scale 25 (%, as scene.py's)]
                               [--check 900 (against build/timing/0900.png)]
"""
import json
import subprocess
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
argv = sys.argv[1:]
OUT = ROOT / (argv[argv.index("--out") + 1] if "--out" in argv else "build/render")
SCALE = int(argv[argv.index("--scale") + 1]) if "--scale" in argv else 100
W, H = 1920, 1080
GAIN = 1.15  # the feed's emission strength on the screen (scene.py keynoteScreen)

# film frame → the screen's height in the frame (0..1) and the stage lights,
# from src/anim.js
JS = """
import * as T from './src/timeline.js'; import * as A from './src/anim.js';
const { push, pull } = T.MOVE, S = T.SET.screen;
const c = A.fromStage([0, S.y + S.h / 2, S.z]), out = {};
for (let f = Math.ceil(push[1] * T.FPS) + 1; (f - 1) / T.FPS < pull[0]; f++) {
  const t = (f - 1) / T.FPS, cam = A.cameraAt(t), d = Math.hypot(...cam.tr.p.map((v, i) => v - c[i]));
  out[f] = [S.h / (2 * d * Math.tan((cam.fov * Math.PI) / 360)), A.lightsAt(t).studio];
}
console.log(JSON.stringify(out));
"""
HOLD = {int(k): v for k, v in json.loads(subprocess.run(["node", "--input-type=module", "-e", JS], cwd=ROOT, capture_output=True, text=True, check=True).stdout).items()}
FIRST = min(HOLD)
if "--list" in argv:
    print(f"{FIRST}-{max(HOLD)}")
    sys.exit()


def lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def srgb(a):
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.clip(a, 0.0031308, None) ** (1 / 2.4) - 0.055)


PLATE = lin(np.asarray(Image.open(ROOT / f"build/hold-plate/{FIRST:04d}.png").convert("RGB"), dtype=np.float32) / 255)
YY, XX = np.mgrid[0:H, 0:W]


def frame(f):
    feed = Image.open(ROOT / f"build/tv/{f:04d}.jpg").convert("RGB")
    k, studio = HOLD[f]
    # the feed's pixel under each frame pixel, the screen centred and k of the frame high
    s = feed.height / (k * H)
    pic = feed.transform((W, H), Image.AFFINE, (s, 0, feed.width / 2 - s * W / 2, 0, s, feed.height / 2 - s * H / 2), Image.BICUBIC)
    a = lin(np.asarray(pic, dtype=np.float32) / 255) * GAIN
    # the screen only ever grows through the hold, so the first frame's drape covers what is left of it
    inside = (np.abs(XX + 0.5 - W / 2) <= k * H * feed.width / feed.height / 2) & (np.abs(YY + 0.5 - H / 2) <= k * H / 2)
    a = np.where(inside[..., None], a, PLATE * studio / HOLD[FIRST][1])
    return Image.fromarray((srgb(np.clip(a, 0, 1)) * 255 + 0.5).astype(np.uint8))


if "--check" in argv:
    f = int(argv[argv.index("--check") + 1])
    mine = np.asarray(frame(f), dtype=np.float32)
    cyc = np.asarray(Image.open(ROOT / f"build/timing/{f:04d}.png").convert("RGB"), dtype=np.float32)
    d = np.abs(mine - cyc)
    print(f"frame {f}: mean |diff| {d.mean():.2f}/255, 99th pct {np.percentile(d, 99):.1f}, max {d.max():.0f}; "
          f"mean level hold {mine.mean():.1f} vs cycles {cyc.mean():.1f}; cycles corners {cyc[:8, :8].mean(axis=(0, 1)).round(1)}")
    frame(f).save(ROOT / f"build/timing/{f:04d}-hold.png")
    sys.exit()

def write(f):
    im = frame(f)
    if SCALE != 100:
        im = im.resize((W * SCALE // 100, H * SCALE // 100), Image.LANCZOS)
    im.save(OUT / f"{f:04d}.png")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with Pool() as pool:
        for i, _ in enumerate(pool.imap_unordered(write, sorted(HOLD), chunksize=8)):
            if (i + 1) % 400 == 0:
                print(f"hold {i + 1}/{len(HOLD)}", flush=True)
    print(f"hold frames {min(HOLD)}-{max(HOLD)} → {OUT}")
