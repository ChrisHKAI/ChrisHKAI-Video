"""Finishes the Cycles frames and encodes the film.

Bloom on the brightest light only (glints, sparks, the lock flash; Cycles does not glow by itself): over 0.85 of
white, at 0.3, so a white page or white lettering on the dark stage stays sharp (a first film bloomed from 0.55
at 0.5 and every white surface glowed: "點解成條片都咁光既，睇唔清"), a soft vignette,
fine seeded grain, every core at once; then H.264 High CRF 17, 30 fps, the WAV muxed as AAC 320k,
+faststart. Where a publish platform asks for it (platforms.json "sfxCut": 抖音, whose creators lay
their own music under a film), also the same picture with the sound effects alone (score-sfx.wav).

usage: FILM=<film folder> python3 engine/scripts/finish.py [--in build/render] [--out out/<name>.mp4]  (default: film.json "output")
       [--sfx-cut] (always write the effects-only cut) [--workers N] [--bloom-from 0.85] [--bloom 0.3]
"""
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
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
BLOOM = (float(arg("--bloom-from", 0.85)), float(arg("--bloom", 0.3)))  # from what brightness, how strong
_vignette = {}


def look(job):
    """One frame: bloom, vignette, grain (seeded by its index, so a re-run matches)."""
    i, f = job
    srgb = np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) / 255
    H, W = srgb.shape[:2]
    if (H, W) not in _vignette:
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.hypot((xx - W / 2) / (W / 2), (yy - H * 0.47) / (H / 2) * 1.0)
        _vignette[(H, W)] = (1 - 0.22 * np.clip((r - 0.45) / 0.9, 0, 1) ** 1.6)[..., None]
    lin = srgb ** 2.2
    lum = lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    bright = lin * (np.clip((lum - BLOOM[0]) / (1 - BLOOM[0]), 0, 1)[..., None])
    small = bright[::2, ::2]
    glow = gaussian_filter(small, sigma=(6, 6, 0)) * 0.55 + gaussian_filter(small, sigma=(22, 22, 0)) * 0.35
    glow = np.repeat(np.repeat(glow, 2, axis=0), 2, axis=1)[:H, :W]
    lin = lin + glow * BLOOM[1]
    lin *= _vignette[(H, W)]
    out = np.clip(lin, 0, 1) ** (1 / 2.2)
    rng = np.random.default_rng(1000 + i)
    out += (rng.random((H, W, 1), dtype=np.float32) - 0.5) * 0.014
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(FIN / f.name)
    return i


def sfx_cut_wanted():
    if "--sfx-cut" in argv:
        return True
    from publish import PLATFORMS, platforms  # noqa: E402
    return any(PLATFORMS[p].get("sfxCut") for p in platforms([]))


def main():
    FIN.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames = sorted(SRC.glob("*.png"))
    if not frames:
        sys.exit(f"no frames in {SRC}")
    workers = int(arg("--workers", os.cpu_count() or 4))
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for n, _ in enumerate(pool.map(look, enumerate(frames), chunksize=4), 1):
            if n % 60 == 0:
                print(f"finished {n}/{len(frames)}", flush=True)

    first = int(frames[0].stem)
    fps = str(FILM_JSON["format"]["fps"])
    subprocess.run([
        "ffmpeg", "-v", "error", "-y",
        "-framerate", fps, "-start_number", str(first), "-i", str(FIN / "%04d.png"),
        "-i", str(ROOT / "assets/audio/score.wav"),
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",  # H.264 4:2:0 wants even sides (a small test render may be odd)
        "-c:v", "libx264", "-profile:v", "high", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p",
        "-af", "volume=-0.3dB",  # the limiter holds samples at -1 dBFS; AAC's overshoot needs a little more room
        "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart",
        str(OUT),
    ], check=True)
    hold_peak(OUT)
    print("wrote", OUT)
    fx = ROOT / "assets/audio/score-sfx.wav"
    if sfx_cut_wanted():
        if not fx.exists():
            sys.exit(f"no {fx.relative_to(ROOT)}: run the sound step again")
        cut = OUT.with_name(OUT.stem + "-sfx" + OUT.suffix)
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-i", str(OUT), "-i", str(fx),
            "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-af", "volume=-0.3dB", "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart",
            str(cut),
        ], check=True)
        hold_peak(cut)
        print("wrote", cut, "(sound effects only)")


def true_peak(path):
    """The file's true peak (dBTP), as qa measures it."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    tail = err[err.rfind("True peak:"):]
    return float(tail.split("Peak:")[1].split("dBFS")[0]) if "Peak:" in tail else None


def hold_peak(path, aim=-1.1):
    """AAC can overshoot what the mix held (a loud score came out at -0.8 dBTP): over -1 dBTP, the sound is
    turned down by the difference and encoded again, the picture copied as it is."""
    tp = true_peak(path)
    if tp is None or tp <= aim + 0.1:
        return
    tmp = path.with_name(path.stem + ".peak" + path.suffix)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-map", "0:v", "-map", "0:a", "-c:v", "copy",
                    "-af", f"volume={aim - tp:.2f}dB", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", str(tmp)], check=True)
    tmp.replace(path)
    print(f"true peak {tp:.1f} dBTP → {true_peak(path):.1f} (the sound {aim - tp:.1f} dB down)")


if __name__ == "__main__":
    main()
