"""The last look before a film goes out: what the file is, how loud it is,
whether its big hits land on their frames, that every export is there, and
a contact sheet of the film itself to look at.

  file      duration, size, frame rate and codecs against film.json "format"
  loudness  integrated loudness and true peak (aim ≈ -13 LUFS, ≤ -1 dBTP)
  sync      the film's own audio at the story's big hits (lock, slam, peak,
            final…): the attack within a frame of the cue
  exports   the effects-only cut where a platform asks for it, every cover
writes build/qa.txt and build/qa-sheet.jpg

usage: FILM=<film folder> python3 engine/scripts/qa.py [--film out/<name>.mp4]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
from publish import PLATFORMS, platforms, orientation  # noqa: E402

argv = sys.argv[1:]
OUT = FILM / (argv[argv.index("--film") + 1] if "--film" in argv else FILM_JSON.get("output", "out/film.mp4"))
if not OUT.exists():
    sys.exit(f"no {OUT}: run finish first")
F = FILM_JSON["format"]
lines, bad = [], 0


def say(ok, text):
    global bad
    bad += not ok
    lines.append(("✓ " if ok else "! ") + text)


# ── the file ────────────────────────────────────────────────────────────────
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(OUT)], capture_output=True, text=True, check=True).stdout)
v = next(s for s in pr["streams"] if s["codec_type"] == "video")
a = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
dur = float(pr["format"]["duration"])
num, den = map(int, v["r_frame_rate"].split("/"))
say(abs(dur - F["duration"]) < 0.1, f"{dur:.2f} s (film.json {F['duration']} s)")
say([v["width"], v["height"]] == F["size"], f"{v['width']}×{v['height']} (film.json {F['size'][0]}×{F['size'][1]})")
say(abs(num / den - F["fps"]) < 0.01, f"{num / den:g} fps, {v['codec_name']} {v.get('profile', '')}, {int(pr['format']['bit_rate']) / 1e6:.1f} Mbps")
say(a is not None, f"audio {a['codec_name']} {int(a['sample_rate']) // 1000} kHz {a['channels']} ch" if a else "no audio")

# ── loudness ────────────────────────────────────────────────────────────────
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(OUT), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
summary = r.stderr[r.stderr.rfind("Summary:"):]
lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
say(-15 <= lufs <= -11, f"loudness {lufs:.1f} LUFS (aim about -13)")
say(tp <= -1.0, f"true peak {tp:.1f} dBTP (aim -1.0 or lower)")

# ── the big hits on their frames ────────────────────────────────────────────
SR = 48000
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
hop = SR // 1000  # 1 ms
env = np.sqrt(np.convolve(x ** 2, np.ones(hop * 5) / (hop * 5), "same")[::hop])
rise = np.diff(env, prepend=env[0])
tl = json.loads((FILM / "build/timeline.json").read_text())
cues = [c for c in tl["cues"] if c["kind"] in ("lock", "slam", "pop", "land") or c.get("big")]
off = []
for c in cues:
    i0, i1 = int((c["t"] - 0.04) * 1000), int((c["t"] + 0.06) * 1000)
    if i0 < 0 or i1 >= len(rise):
        continue
    off.append((np.argmax(rise[i0:i1]) + i0) / 1000 - c["t"])
if off:
    worst = max(abs(o) for o in off)
    say(worst <= 1 / F["fps"] + 0.01, f"{len(off)} big hits, the attacks within {worst * 1000:.0f} ms of their cues")

# ── the other exports ───────────────────────────────────────────────────────
publish = platforms([])
if any(PLATFORMS[p].get("sfxCut") for p in publish):
    cut = OUT.with_name(OUT.stem + "-sfx" + OUT.suffix)
    say(cut.exists(), f"effects-only cut {cut.relative_to(FILM)}" if cut.exists() else "no effects-only cut: finish writes it")
orient = orientation(*F["size"])
want = sum(len(PLATFORMS[p]["covers"][orient]) for p in publish)
have = len(list((FILM / "out/covers").glob("*.jpg"))) if (FILM / "out/covers").exists() else 0
say(have >= want, f"{have} covers for {', '.join(PLATFORMS[p]['name'] for p in publish)} (expected {want})")

# ── a sheet of the film to look at ──────────────────────────────────────────
sheet = FILM / "build/qa-sheet.jpg"
cols, rows = (6, 2) if orient == "portrait" else (4, 3)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT), "-vf", f"fps={cols * rows}/{F['duration']},scale={300 if orient == 'portrait' else 480}:-2,tile={cols}x{rows}", "-frames:v", "1", str(sheet)], check=True)
lines.append(f"sheet: {sheet.relative_to(FILM)}")

(FILM / "build/qa.txt").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
print("all good" if not bad else f"{bad} to look at")
