"""Encodes the EEVEE animatic (build/eev) with the film's score into
build/storyboard/animatic.mp4, for the storyboard page.

usage: FILM=<film folder> python3 engine/scripts/animatic.py
       FILM=<film folder> python3 engine/scripts/animatic.py --speeds 1.1,1.2,1.3
         → animatic-1.1x.mp4 … beside it, the cut sped up (picture and sound), to compare a pace the user
           asks for before re-timing the beats and the score
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)

SRC = FILM / "build/eev"
OUT = FILM / "build/storyboard/animatic.mp4"
if "--speeds" in sys.argv:
    if not OUT.exists():
        sys.exit(f"no {OUT.relative_to(FILM)} yet: run.mjs animatic first")
    sound = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", str(OUT)],
                           capture_output=True, text=True).stdout.strip() != ""
    for k in sys.argv[sys.argv.index("--speeds") + 1].split(","):
        v = float(k)
        out = OUT.with_name(f"animatic-{k}x.mp4")
        graph = f"[0:v]setpts=PTS/{v}[v]" + (f";[0:a]atempo={v}[a]" if sound else "")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT), "-filter_complex", graph, "-map", "[v]", *(["-map", "[a]"] if sound else []),
                        "-c:v", "libx264", "-crf", "26", "-preset", "fast", "-pix_fmt", "yuv420p",
                        *(["-c:a", "aac", "-b:a", "160k"] if sound else []), "-movflags", "+faststart", str(out)], check=True)
        print(f"{k}x →", out.relative_to(FILM))
    sys.exit(0)
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
