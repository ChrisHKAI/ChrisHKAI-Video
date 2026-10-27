"""The profile picture that peels off as a sticker: the creator's own picture,
never redrawn, so the page in the film matches their real one. Cut to a
circle and set inside the ring the app draws round it (X: 4 px of the page's
black round a 134 px picture), transparent outside.

film.json "profile.avatar": the picture as research saved it; "avatarRing":
the ring's colour (default "#000000" on the X themes, X's dark page;
"#FFFFFF" for a light one), or false for none (the default on other themes)
  → assets/avatar.png (1024 px square, RGBA)

usage: FILM=<film folder> python3 engine/scripts/avatar.py   (film.json "recipes": "@avatar")
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON  # noqa: E402

N = 1024
SS = 2  # supersample
S = N * SS
src_path = FILM_JSON.get("profile", {}).get("avatar")
if not src_path or not (FILM / src_path).exists():
    raise SystemExit(f"film.json profile.avatar is {src_path!r}: save the creator's profile picture first (step 2)")
src = Image.open(FILM / src_path).convert("RGBA")
w, h = src.size
k = min(w, h)
src = src.crop(((w - k) // 2, (h - k) // 2, (w - k) // 2 + k, (h - k) // 2 + k))

ring = FILM_JSON.get("avatarRing", "#000000" if FILM_JSON.get("theme", "").startswith("x-") else False)
band = round(S * 4 / 134) if ring else 0
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
if ring:
    disc = Image.new("L", (S, S), 0)
    ImageDraw.Draw(disc).ellipse((0, 0, S - 1, S - 1), fill=255)
    img.paste(Image.new("RGBA", (S, S), ring), (0, 0), disc)
# the picture itself fills the circle inside the ring, nothing of it cut off but the corners
inner = S - 2 * band
pic = src.resize((inner, inner), Image.LANCZOS)
mask = Image.new("L", (inner, inner), 0)
ImageDraw.Draw(mask).ellipse((0, 0, inner - 1, inner - 1), fill=255)
mask = Image.composite(pic.getchannel("A"), Image.new("L", (inner, inner), 0), mask)
img.paste(pic, (band, band), mask)
img.resize((N, N), Image.LANCZOS).save(FILM / "assets/avatar.png")
print(f"assets/avatar.png  (from {src_path}{', ring ' + ring if ring else ''})")
