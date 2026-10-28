"""The inserted beat D's two cards (野生 → 官方认证大使):

  assets/invite-card.png  the invitation that slides out of the envelope: the email's subject
                          "Invite to SpaceXAI Ambassador Onboarding", "Hey Tie Zhu," and its first
                          line, set again on a white card (from assets/p1-a.jpg)
  assets/ben-card.png     Ben Lang's post as a notification: his picture (cut inside its circle,
                          clear of the extension's medal), name, badge, handle, the two lines, the
                          date (from assets/p-ben.png; the extensions' bits left out)

usage: FILM=films/cgnot996-intro python3 recipes/beat-cards.py
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw

FILM = Path(os.environ["FILM"]).resolve()


def rounded(card, r):
    m = Image.new("L", card.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius=r, fill=255)
    out = Image.new("RGBA", card.size, (0, 0, 0, 0))
    out.paste(card, (0, 0), m)
    return out


def paste(card, src, box, at, k):
    x0, y0, x1, y1 = box
    piece = src.crop(box).resize((round((x1 - x0) * k), round((y1 - y0) * k)), Image.LANCZOS)
    card.paste(piece, at)
    return at[1] + piece.height


# the invitation
mail = Image.open(FILM / "assets/p1-a.jpg").convert("RGB")
W, H = 1400, 600
card = Image.new("RGB", (W, H), (255, 255, 255))
d = ImageDraw.Draw(card)
d.rectangle((0, 0, W, 26), fill=(29, 155, 240))  # an accent band on top
y = paste(card, mail, (106, 24, 976, 90), (70, 90), 1.45)        # Invite to SpaceXAI Ambassador Onboarding
y = paste(card, mail, (106, 480, 260, 524), (70, y + 90), 1.7)    # Hey Tie Zhu,
y = paste(card, mail, (104, 558, 404, 604), (70, y + 40), 1.7)    # We'd love to invite you to
y = paste(card, mail, (404, 558, 802, 604), (70, y + 14), 1.7)    # SpaceXAI's Ambassador program.
rounded(card, 40).save(FILM / "assets/invite-card.png")

# Ben Lang's post
ben = Image.open(FILM / "assets/p-ben.png").convert("RGB")
W, H = 1400, 470
card = Image.new("RGB", (W, H), (255, 255, 255))
K = 1.25
CX, CY, R = 70, 79, 36
face = ben.crop((CX - R, CY - R, CX + R, CY + R)).resize((round(2 * R * K * 1.3),) * 2, Image.LANCZOS)
disk = Image.new("L", face.size, 0)
ImageDraw.Draw(disk).ellipse((0, 0, face.width - 1, face.height - 1), fill=255)
card.paste(face, (50, 46), disk)
nx = 50 + face.width + 28
paste(card, ben, (127, 44, 298, 82), (nx, 52), K)                 # Ben Lang + badge
paste(card, ben, (127, 86, 231, 118), (nx, 52 + round(44 * K)), K)  # @benln
y = paste(card, ben, (26, 212, 1004, 250), (44, 200), K)          # line 1
y = paste(card, ben, (26, 260, 600, 298), (44, y + 14), K)        # line 2
paste(card, ben, (28, 336, 606, 372), (46, y + 40), K)            # the date
rounded(card, 36).save(FILM / "assets/ben-card.png")
print("assets/invite-card.png assets/ben-card.png")
