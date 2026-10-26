"""Put the outro together: the rendered frames, with the Tim film's last frame
(the black iPhone 4S) sinking into the dark over the first second, and the
sound (assets/audio/score.wav), into an mp4; then the Tim film with the
outro after it.

usage: python3 scripts/finish.py [--frames build/render] [--preview | --uhd]
  --preview: from build/lowres at 960x540, writing out/chris-outro-preview.mp4
             and out/preview-with-tim.mp4 (the Tim film's last 4 s, then the outro)
  --uhd:     from build/render4k: out/chris-outro-4k.mp4 at 3840x2160, and the
             Tim film with it at the Tim film's 1920x1080
  otherwise: out/chris-outro.mp4 and out/tim-intro-with-outro.mp4 at 1920x1080
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import timeline as T  # noqa: E402

TIM = ROOT.parent / "tim-intro"
argv = sys.argv[1:]
PREVIEW = "--preview" in argv
UHD = "--uhd" in argv
SRC = ROOT / (argv[argv.index("--frames") + 1] if "--frames" in argv else
              ("build/lowres" if PREVIEW else "build/render4k" if UHD else "build/render"))
W, H = (960, 540) if PREVIEW else (3840, 2160) if UHD else (1920, 1080)
JW, JH = (960, 540) if PREVIEW else (1920, 1080)  # the join: the Tim film's size
COMP = ROOT / ("build/comp-preview" if PREVIEW else "build/comp4k" if UHD else "build/comp")
OUT = ROOT / "out"


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def main():
    COMP.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(exist_ok=True)
    last = TIM / "build/final/4287.png"  # the Tim film's last frame as finished (its grain and vignette)
    plate = Image.open(last if last.exists() else TIM / "build/render/4287.png").convert("RGB").resize((W, H), Image.LANCZOS)
    for f in range(1, T.FRAMES + 1):
        t = (f - 1) / T.FPS
        im = Image.open(SRC / f"{f:04d}.png").convert("RGB").resize((W, H), Image.LANCZOS)
        if t < 1.1:  # the 4S of the Tim film sinks back into the dark
            k = ease(t / 1.0)
            s = 1 - 0.14 * k
            p = ImageEnhance.Brightness(plate.resize((round(W * s), round(H * s)), Image.LANCZOS)).enhance(1 - k)
            canvas = Image.new("RGB", (W, H), "black")
            canvas.paste(p, ((W - p.width) // 2, (H - p.height) // 2 + round(0.3 * H * k * k)))
            im = ImageChops.lighter(im, canvas)
        im.save(COMP / f"{f:04d}.jpg", quality=95)
    name = "chris-outro-preview.mp4" if PREVIEW else "chris-outro-4k.mp4" if UHD else "chris-outro.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(T.FPS), "-i", str(COMP / "%04d.jpg"),
                    "-i", str(ROOT / "assets/audio/score.wav"), "-c:v", "libx264", "-preset", "slow", "-crf", "16" if not PREVIEW else "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(OUT / name)], check=True)
    print("wrote", OUT / name)
    # the Tim film (or its last 4 s), then the outro
    tim = TIM / "out/tim-intro.mp4"
    joined = OUT / ("preview-with-tim.mp4" if PREVIEW else "tim-intro-with-outro.mp4")
    pre = ["-ss", "138.9"] if PREVIEW else []
    subprocess.run(["ffmpeg", "-v", "error", "-y", *pre, "-i", str(tim), "-i", str(OUT / name), "-filter_complex",
                    f"[0:v]scale={JW}:{JH}:flags=lanczos,setsar=1,fps={T.FPS}[a];[1:v]scale={JW}:{JH}:flags=lanczos,setsar=1,fps={T.FPS}[b];"
                    "[0:a]aresample=48000[x];[1:a]aresample=48000[y];[a][x][b][y]concat=n=2:v=1:a=1[v][au]",
                    "-map", "[v]", "-map", "[au]", "-c:v", "libx264", "-preset", "slow", "-crf", "16" if not PREVIEW else "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(joined)], check=True)
    print("wrote", joined)


if __name__ == "__main__":
    main()
