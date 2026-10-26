"""The character sheet's front, side and back beside the toy's orthographic renders."""
from PIL import Image
ref = Image.open("../../reference/chris/chibi-character-sheet.webp").convert("RGB")
crops = [(60, 105, 380, 655), (370, 105, 690, 655), (680, 105, 1000, 655)]
H = 720
row = [ref.crop(c).resize((round(320 * H / 550), H)) for c in crops]
ren = [Image.open(f"build/lookdev/{n}.png").convert("RGB") for n in ("orthofront", "orthoside", "orthoback")]
s = Image.new("RGB", (sum(i.width for i in row) + sum(i.width for i in ren), H))
x = 0
for a, b in zip(row, ren):
    s.paste(a, (x, 0)); x += a.width; s.paste(b, (x, 0)); x += b.width
s.save("build/compare.jpg", quality=88)
