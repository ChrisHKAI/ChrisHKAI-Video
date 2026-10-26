"""Finishes the Cycles frames and encodes the film.

Bloom on the brightest light (glints, sparks, the lock flash; Cycles does not glow by itself), a soft vignette,
fine seeded grain; then H.264 High CRF 17, 30 fps, the WAV muxed as AAC 320k,
+faststart.

usage: FILM=<film folder> python3 engine/scripts/finish.py [--in build/render] [--out out/<name>.mp4]  (default: film.json "output")
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)

ROOT = FILM
argv = sys.argv[1:]


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SRC = ROOT / arg("--in", "build/render")
FIN = ROOT / "build/final"
OUT = ROOT / arg("--out", FILM_JSON.get("output", "out/film.mp4"))
FIN.mkdir(parents=True, exist_ok=True)
OUT.parent.mkdir(parents=True, exist_ok=True)

frames = sorted(SRC.glob("*.png"))
if not frames:
    sys.exit(f"no frames in {SRC}")
H, W = np.asarray(Image.open(frames[0])).shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
r = np.hypot((xx - W / 2) / (W / 2), (yy - H * 0.47) / (H / 2) * 1.0)
VIGNETTE = (1 - 0.22 * np.clip((r - 0.45) / 0.9, 0, 1) ** 1.6)[..., None]

for i, f in enumerate(frames):
    srgb = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255
    lin = srgb ** 2.2
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    bright = lin * (np.clip((lum - 0.55) / 0.45, 0, 1)[..., None])
    small = bright[::2, ::2]
    glow = gaussian_filter(small, sigma=(6, 6, 0)) * 0.55 + gaussian_filter(small, sigma=(22, 22, 0)) * 0.35
    glow = np.repeat(np.repeat(glow, 2, axis=0), 2, axis=1)[:H, :W]
    lin = lin + glow * 0.5
    lin *= VIGNETTE
    out = np.clip(lin, 0, 1) ** (1 / 2.2)
    rng = np.random.default_rng(1000 + i)
    out += (rng.random((H, W, 1), dtype=np.float32) - 0.5) * 0.014
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(FIN / f.name)
    if (i + 1) % 60 == 0:
        print(f"finished {i + 1}/{len(frames)}", flush=True)

first = int(frames[0].stem)
subprocess.run([
    "ffmpeg", "-v", "error", "-y",
    "-framerate", "30", "-start_number", str(first), "-i", str(FIN / "%04d.png"),
    "-i", str(ROOT / "assets/audio/score.wav"),
    "-c:v", "libx264", "-profile:v", "high", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart",
    str(OUT),
], check=True)
print("wrote", OUT)
