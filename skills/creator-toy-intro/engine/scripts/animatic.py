"""Encodes the EEVEE animatic (build/eev) with the film's score into
build/storyboard/animatic.mp4, for the storyboard page.

usage: FILM=<film folder> python3 engine/scripts/animatic.py
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)

SRC = FILM / "build/eev"
OUT = FILM / "build/storyboard/animatic.mp4"
frames = sorted(SRC.glob("*.png"))
if not frames:
    sys.exit(f"no frames in {SRC}: render them first (animatic step)")
OUT.parent.mkdir(parents=True, exist_ok=True)
score = FILM / "assets/audio/score.wav"
subprocess.run([
    "ffmpeg", "-v", "error", "-y",
    "-framerate", str(FILM_JSON["format"]["fps"]), "-start_number", frames[0].stem, "-i", str(SRC / "%04d.png"),
    *(["-i", str(score)] if score.exists() else []),
    "-c:v", "libx264", "-crf", "26", "-preset", "fast", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    *(["-c:a", "aac", "-b:a", "160k", "-shortest"] if score.exists() else []), "-movflags", "+faststart", str(OUT),
], check=True)
print("animatic →", OUT.relative_to(FILM))
