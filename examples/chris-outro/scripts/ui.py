"""The phone's screens, drawn as web pages and shot with headless Chrome at 3x
(1206 x 2622, the iPhone 18 Pro's pixels):

- assets/home.png: the home screen, X in the middle of the grid
- assets/profile.png: his X profile in light mode, from the user's screenshots
  (reference/chris/x-profile-verified.webp; x-profile-2026-10-24.webp: the
  display name is "Chris" with the blue check, @ChrisHKAI under it); the
  avatar, the handle and the link are left blank: each is a 3D piece of its
  own (the avatar he pops out of, the handle he tears off, the link he peels
  into a rope). The pinned post's small avatar is an empty socket too.
- assets/name.png, assets/link.png: the handle and the link (white paper strips;
  the handle keeps the name "name": its letters become the name on the floor)
- assets/avatar.png: his avatar, cut from the screenshot
- assets/x-logo.png: the X mark for the app's launch
- assets/profile-zoom.jpg: the band of the page he stands on once it is blown up,
  rendered at 12x so it stays sharp (without the handle: its letters are 3D; no @)
- assets/screen-blank.png, assets/profile-blank.jpg: the screen and that band once the app
  has gone (a plain grey, lightest behind the handle's row)
- build/ui.json: where each piece sits on the screen (screen pixels)

usage: python3 scripts/ui.py
"""
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT.parent.parent / "reference/chris/x-profile-verified.webp"
CHROME = next((Path.home() / ".cache/puppeteer/chrome-headless-shell").glob("*/chrome-headless-shell-mac-arm64/chrome-headless-shell"))
W, H, S = 402, 874, 3  # points, scale
(ROOT / "ui").mkdir(exist_ok=True)
(ROOT / "assets").mkdir(exist_ok=True)
(ROOT / "build").mkdir(exist_ok=True)

X_PATH = "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
BADGE = ('<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="vertical-align:-3px"><path fill="#1D9BF0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/>'
         '<path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m8 12.3 2.8 2.8L16.5 9"/></svg>')
ICON = {
    "back": '<path d="M15 5l-7 7 7 7"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    "grok": '<circle cx="12" cy="12" r="8"/><path d="m7 17 10-10"/>',
    "pin": '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
    "cal": '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    "chev": '<path d="m9 6 6 6-6 6"/>',
    "posts": '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 10h8M8 14h5"/>',
    "down": '<path d="m6 9 6 6 6-6"/>',
    "reply": '<path d="M4 11.5C4 7.4 7.6 4.5 12 4.5s8 2.9 8 7-3.6 7-8 7c-1 0-2-.1-2.9-.4L5 20l.9-3.6C4.7 15.1 4 13.4 4 11.5z"/>',
    "repost": '<path d="M4 9V7h12l-3-3M20 15v2H8l3 3"/><path d="M16 4l3 3-3 3M8 20l-3-3 3-3"/>',
    "media": '<rect x="3.5" y="6.5" width="17" height="13" rx="2.5"/><path d="M6 3.5h12M10.5 10.5v6l5-3z"/>',
    "articles": '<path d="M5 3.5h10l4 4v13H5z"/><path d="M8 11h8M8 15h5"/><path d="m14 18 5-5 1.5 1.5-5 5H14z"/>',
    "pinned": '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
    "home": '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" fill="currentColor"/>',
    "bell": '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
    "mail": '<path d="M4 6.5h16v11H4z"/><path d="m4 7 8 6 8-6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
}


def icon(n, s=24, c="currentColor", w=1.9):
    return (f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICON[n]}</svg>')


def xmark(s, c="#000"):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24"><path fill="{c}" d="{X_PATH}"/></svg>'


STATUS = """
<div class="status" style="color:{c}">
  <span class="time">9:41</span>
  <span class="right">
    <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="{c}"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1" fill="{c}"/><rect x="10" y="3" width="3.2" height="9" rx="1" fill="{c}"/><rect x="15" y="0" width="3.2" height="12" rx="1" fill="{c}"/></svg>
    <span class="g">5G</span>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="{c}" stroke-opacity=".4"/><rect x="2.5" y="2.5" width="19" height="8" rx="2.2" fill="{c}"/><path d="M25 4.5v4c.9-.3 1.5-1.1 1.5-2s-.6-1.7-1.5-2z" fill="{c}" fill-opacity=".45"/></svg>
  </span>
</div>"""

CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 402px; height: 874px; overflow: hidden; }
body { font-family: -apple-system, "SF Pro Text", "PingFang HK", "PingFang SC", sans-serif; -webkit-font-smoothing: antialiased; color: #0F1419; background: #fff; position: relative; }
.abs { position: absolute; }
.status { position: absolute; left: 0; top: 0; width: 402px; height: 54px; font-weight: 600; font-size: 17px; }
.status .time { position: absolute; left: 52px; top: 17px; letter-spacing: -.2px; }
.status .right { position: absolute; right: 30px; top: 19px; display: flex; gap: 6px; align-items: center; }
.status .g { font-size: 14.5px; font-weight: 600; }
.grey { color: #536471; }
.blue { color: #1D9BF0; }
.socket { position: absolute; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #1c1f24 0 55%, #08090b 75%); box-shadow: inset 0 6px 14px rgba(0,0,0,.9); }
"""

MEASURE = """
<script>
const r = {};
for (const el of document.querySelectorAll('[data-m]')) {
  const b = el.getBoundingClientRect();
  r[el.dataset.m] = [b.left, b.top, b.width, b.height];
}
document.getElementById('rects').textContent = JSON.stringify(r);
</script>"""


def page(body, css="", bg="#fff"):
    return f'<!doctype html><html><head><meta charset="utf-8"><style>{CSS}{css}</style></head><body style="background:{bg}">{body}<pre id="rects" style="display:none"></pre>{MEASURE}</body></html>'


def shot(html_name, out, w=W, h=H, transparent=False, scale=S):
    args = [str(CHROME), "--headless", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
            f"--force-device-scale-factor={scale}", f"--window-size={w},{h}", f"--screenshot={ROOT / out}"]
    if transparent:
        args.append("--default-background-color=00000000")
    subprocess.run(args + [f"file://{ROOT / 'ui' / html_name}"], check=True, capture_output=True)


def measure(html_name, w=W, h=H):
    dom = subprocess.run([str(CHROME), "--headless", "--disable-gpu", "--allow-file-access-from-files", f"--window-size={w},{h}",
                          "--dump-dom", f"file://{ROOT / 'ui' / html_name}"], check=True, capture_output=True).stdout.decode()
    return json.loads(re.search(r'<pre id="rects"[^>]*>(.*?)</pre>', dom, re.S).group(1))


# ── the profile ─────────────────────────────────────────────────────────────
AV = {"cx": 46.1, "cy": 138.4, "r": 33.0}  # the avatar with its white ring (points)
ZOOM = {"scale": 12, "top": 174, "bottom": 470}  # the blown-up page's band (points) and its pixels per point
NAME_TOP = 182.5


def profile_html(layer):
    """layer: "base" (the pieces left blank), "name" or "link" (that piece alone on its strip),
    "zoom" (the page he stands on, blown up: the link printed, the handle not: its letters are 3D, the @ dropped)."""
    hide = lambda piece: "visibility:hidden;" if layer not in ("all", piece) and not (layer == "zoom" and piece == "link") else "visibility:visible;"
    only = "visibility:hidden;" if layer in ("name", "link") else ""
    body = f"""
<div style="{only}">
  <div class="abs" style="left:0;top:0;width:402px;height:106px;background:linear-gradient(#a9adb1,#8d9195)"></div>
  {STATUS.format(c="#fff")}
  <div class="abs" style="left:15px;top:52px;width:37px;height:37px;border-radius:50%;background:rgba(15,20,25,.55);display:flex;align-items:center;justify-content:center;color:#fff">{icon("back", 22, w=2.4)}</div>
  <div class="abs" style="left:304px;top:52px;width:37px;height:37px;border-radius:50%;background:rgba(15,20,25,.55);display:flex;align-items:center;justify-content:center;color:#fff">{icon("grok", 20, w=2.2)}</div>
  <div class="abs" style="left:349px;top:52px;width:37px;height:37px;border-radius:50%;background:rgba(15,20,25,.55);display:flex;align-items:center;justify-content:center;color:#fff">{icon("search", 20, w=2.4)}</div>
  <div class="socket" style="left:{AV['cx'] - AV['r'] + 2}px;top:{AV['cy'] - AV['r'] + 2}px;width:{2 * AV['r'] - 4}px;height:{2 * AV['r'] - 4}px"></div>
  <div class="abs" style="left:9px;top:{NAME_TOP}px;font-size:23.5px;line-height:26px;font-weight:800;white-space:nowrap;letter-spacing:-.3px">Chris {BADGE.format(s=22)}</div>
  <div class="abs" style="left:9px;top:240px;font-size:16px;line-height:21.6px;width:390px">
    89｜HK｜热爱AI｜用AI赚到了副业收入<br>分享自身使用AI经历，因为冲动订了个年费Heavy<br>因为Grok Bot 写了个<span data-m="link" class="blue" style="{hide('link')}">usegrokbot.com</span>
  </div>
  <div class="abs grey" style="left:8px;top:307px;font-size:15.5px;display:flex;align-items:center;gap:4px">{icon("pin", 19)}<span>香港</span><span style="width:12px"></span>{icon("cal", 18)}<span>於 2018年6月加入</span>{icon("chev", 17)}</div>
  <div class="abs" style="left:9px;top:338px;font-size:15.5px"><b>487</b> <span class="grey">跟隨中</span>&nbsp;&nbsp;&nbsp;<b>3,276</b> <span class="grey">跟隨者</span></div>
  <div class="abs" style="left:9px;top:372px;width:188px;height:37px;border:1px solid #cfd9de;border-radius:19px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">分享個人資料</div>
  <div class="abs" style="left:205px;top:372px;width:188px;height:37px;border:1px solid #cfd9de;border-radius:19px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">編輯個人資料</div>
  <div class="abs" style="left:0;top:422px;width:402px;height:36px;display:flex;align-items:center;justify-content:space-around;color:#0F1419">
    <span style="display:flex;align-items:center;gap:5px;font-weight:700;font-size:17px">{icon("posts", 22)}貼文{icon("down", 16)}</span>
    <span class="grey">{icon("reply", 22)}</span><span class="grey">{icon("repost", 22)}</span><span class="grey">{icon("media", 22)}</span><span class="grey">{icon("articles", 22)}</span>
  </div>
  <div class="abs" style="left:15px;top:455px;width:98px;height:3.5px;border-radius:2px;background:#1D9BF0"></div>
  <div class="abs" style="left:0;top:458px;width:402px;height:1px;background:#eff3f4"></div>
  <div class="abs grey" style="left:44px;top:468px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:4px">{icon("pinned", 16, w=2)}已釘選</div>
  <div class="socket" style="left:9px;top:492px;width:43px;height:43px"></div>
  <div class="abs" style="left:61px;top:488px;font-size:15.5px;white-space:nowrap"><b>Chris</b> {BADGE.format(s=17)} <span class="grey">@ChrisHKAI·1天</span></div>
  <div class="abs" style="left:375px;top:490px">{xmark(19)}</div>
  <div class="abs" style="left:61px;top:510px;font-size:15.5px;line-height:21px;width:330px">帮蜗牛哥<span class="blue">@isnail</span>做了介绍片<br><br>弱弱的问一句，可以卖＄99吗？这会不会太贵了<br>😢</div>
  <div class="abs" style="left:61px;top:597px;width:332px;height:190px;border-radius:16px;border:1px solid #cfd9de;overflow:hidden;background:url('../build/isnail/pinned.jpg') center/cover"></div>
  <div class="abs" style="left:0;top:792px;width:402px;height:82px;background:#fff;border-top:1px solid #eff3f4"></div>
  <div class="abs" style="left:0;top:803px;width:402px;display:flex;justify-content:space-around;color:#0F1419">{icon("home", 26)}{icon("search", 26)}{icon("grok", 25)}{icon("bell", 26)}{icon("mail", 26)}</div>
  <div class="abs" style="left:337px;top:727px;width:59px;height:59px;border-radius:50%;background:#1D9BF0;box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;color:#fff">{icon("plus", 28, w=2.6)}</div>
  <div class="abs" style="left:134px;top:861px;width:134px;height:5px;border-radius:3px;background:#0F1419"></div>
</div>
<div data-m="name" class="abs grey" style="left:9px;top:209px;font-size:16px;line-height:19px;white-space:nowrap;{hide('name')}">@ChrisHKAI</div>
"""
    return page(body)


def strip(src, rect, pad, out):
    """Cut a piece out of its layer onto a white paper strip, with a margin."""
    im = Image.open(ROOT / src).convert("RGBA")
    x, y, w, h = [v * S for v in rect]
    p = pad * S
    box = (int(x - p), int(y - p), int(x + w + p), int(y + h + p))
    piece = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (255, 255, 255, 255))
    piece.alpha_composite(im.crop(box))
    piece.convert("RGB").save(ROOT / out)
    return [box[0], box[1], box[2] - box[0], box[3] - box[1]]


def blank(out, size, centre, scale, light=150, dark=14, reach=150):
    """A plain backdrop: grey `light` at `centre` (pixels), falling off to `dark` over `reach` points."""
    w, h = size
    small = 8  # drawn small and scaled up: it is all soft
    g = Image.new("L", (w // small, h // small))
    cx, cy, r = centre[0] / small, centre[1] / small, reach * scale / small
    px = g.load()
    for y in range(g.height):
        for x in range(g.width):
            d = min(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / r, 1.0)
            k = 1 - (3 * d * d - 2 * d * d * d)  # smoothstep down
            px[x, y] = round(dark + (light - dark) * k)
    g.resize(size, Image.BICUBIC).convert("RGB").save(out, quality=95)


def paper(src, out, color=(239, 232, 214), edge=(70, 66, 60)):
    """The piece as a paper sticker: cream stock, the print on it, a dark edge, so it reads over the white screen."""
    im = Image.open(ROOT / src).convert("RGB")
    ink = ImageOps.autocontrast(Image.eval(im.convert("L"), lambda v: 255 - v))  # the print, as coverage: the grey handle prints solid
    sheet = Image.new("RGB", im.size, color)
    sheet.paste(im, (0, 0), ink)
    d = ImageDraw.Draw(sheet)
    w = max(4, im.height // 18)
    d.rectangle((0, 0, im.width - 1, im.height - 1), outline=edge, width=w)
    sheet.save(ROOT / out)


# ── the home screen ─────────────────────────────────────────────────────────
APPS = [
    ("相片", "#f6f6f6", '<circle cx="12" cy="7" r="3.2" fill="#f7b500"/><circle cx="17" cy="12" r="3.2" fill="#4cd964" fill-opacity=".9"/><circle cx="12" cy="17" r="3.2" fill="#34aadc" fill-opacity=".9"/><circle cx="7" cy="12" r="3.2" fill="#ff3b30" fill-opacity=".85"/>'),
    ("相機", "linear-gradient(#e6e6e8,#9d9da3)", '<rect x="3" y="7" width="18" height="12" rx="3" fill="#2b2b2e"/><circle cx="12" cy="13" r="4" fill="#57575c"/><circle cx="12" cy="13" r="2.4" fill="#18181a"/>'),
    ("天氣", "linear-gradient(#3e8ef0,#1d5fd1)", '<circle cx="10" cy="10" r="4.2" fill="#ffd60a"/><path d="M8 18h9a3.2 3.2 0 0 0 0-6.4 4.4 4.4 0 0 0-8.4 1.2A2.6 2.6 0 0 0 8 18z" fill="#fff"/>'),
    ("時鐘", "#111", '<circle cx="12" cy="12" r="8.5" fill="#fff"/><path d="M12 6.5V12l3.5 2" stroke="#111" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
    ("地圖", "linear-gradient(135deg,#9fe39b,#f4f1e8 60%,#7fc7f7)", '<path d="M4 16 20 8" stroke="#f5c242" stroke-width="2.4"/><circle cx="13" cy="10" r="3" fill="#ff3b30"/>'),
    ("備忘錄", "linear-gradient(#ffd84d 0 28%,#fff 28%)", '<path d="M5 12h14M5 15.5h14M5 19h9" stroke="#c9c9cc" stroke-width="1.1"/>'),
    ("日曆", "#fff", '<text x="12" y="8" font-size="4.5" text-anchor="middle" fill="#ff3b30" font-family="-apple-system" font-weight="600">星期五</text><text x="12" y="19.5" font-size="11" text-anchor="middle" fill="#111" font-family="-apple-system" font-weight="300">23</text>'),
    ("設定", "linear-gradient(#c7c7cc,#8e8e93)", '<circle cx="12" cy="12" r="6.5" fill="none" stroke="#3a3a3c" stroke-width="2.6" stroke-dasharray="2.2 1.6"/><circle cx="12" cy="12" r="2.6" fill="#3a3a3c"/>'),
    ("音樂", "linear-gradient(#fb5c74,#fa233b)", '<path d="M10 17.5V7l8-1.6v10" stroke="#fff" stroke-width="1.8" fill="none"/><circle cx="8.3" cy="17.5" r="2" fill="#fff"/><circle cx="16.3" cy="15.4" r="2" fill="#fff"/>'),
    ("錢包", "#111", '<rect x="4" y="7" width="16" height="11" rx="2" fill="#5ac8fa"/><rect x="4" y="9.5" width="16" height="9" rx="2" fill="#ffcc00"/><rect x="4" y="12" width="16" height="7" rx="2" fill="#ff9500"/>'),
    ("計算機", "#1c1c1e", '<circle cx="8" cy="8" r="2" fill="#a5a5a5"/><circle cx="16" cy="8" r="2" fill="#ff9f0a"/><circle cx="8" cy="16" r="2" fill="#333"/><circle cx="16" cy="16" r="2" fill="#ff9f0a"/>'),
    ("健康", "#fff", '<path d="M12 19s-7-4.2-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 1.8c0 5-7 9.2-7 9.2z" fill="#ff2d55"/>'),
    ("X", "#000", f'<path transform="translate(4.6 4.6) scale(.62)" fill="#fff" d="{X_PATH}"/>'),
    ("書籍", "linear-gradient(#ff9f0a,#ff7a00)", '<path d="M6 6h5.5v12H6zM12.5 6H18v12h-5.5z" fill="#fff"/>'),
    ("Podcast", "linear-gradient(#c56cf0,#8e2de2)", '<circle cx="12" cy="10" r="2.6" fill="#fff"/><path d="M8 15a5.6 5.6 0 1 1 8 0" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M11 14h2l-.4 5h-1.2z" fill="#fff"/>'),
    ("尋找", "linear-gradient(#4cd964,#2fb24c)", '<circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="#fff"/>'),
]
DOCK = [
    ("電話", "linear-gradient(#5bf675,#2bc84b)", '<path d="M8 4.5c.8 0 1.5 2.7 1.6 3.6.1.9-1.3 1.6-1.2 2.4.4 2.2 2.8 4.6 5 5 .8.1 1.5-1.3 2.4-1.2.9.1 3.6.8 3.6 1.6 0 1.6-1.6 3.6-3.4 3.6C9.4 19.5 4.5 14.6 4.5 8c0-1.8 2-3.5 3.5-3.5z" fill="#fff"/>'),
    ("瀏覽器", "linear-gradient(#f2f2f7,#d1d1d6)", '<circle cx="12" cy="12" r="8" fill="#1a8cff"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" fill="#fff"/><path d="m15.5 8.5-4.8 2.2 2.6 2.6z" fill="#ff3b30"/>'),
    ("訊息", "linear-gradient(#5bf675,#2bc84b)", '<ellipse cx="12" cy="11.5" rx="7.5" ry="6" fill="#fff"/><path d="M7 15.5 5.5 19l4-2z" fill="#fff"/>'),
    ("郵件", "linear-gradient(#5ac8fa,#1a8cff)", '<rect x="4" y="7" width="16" height="11" rx="1.5" fill="#fff"/><path d="m4.5 7.5 7.5 6 7.5-6" stroke="#1a8cff" stroke-width="1.2" fill="none"/>'),
]
GRID = {"x0": 57, "dx": 96, "y0": 245, "dy": 101, "size": 64}


def app_icon(name, bg, svg, size=64, label=True):
    lab = f'<div style="margin-top:6px;font-size:12.5px;font-weight:500;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35);text-align:center">{name}</div>' if label else ""
    return (f'<div style="width:{size + 20}px;display:flex;flex-direction:column;align-items:center">'
            f'<div style="width:{size}px;height:{size}px;border-radius:{size * 0.225}px;background:{bg};box-shadow:0 1px 3px rgba(0,0,0,.18);overflow:hidden">'
            f'<svg width="{size}" height="{size}" viewBox="0 0 24 24">{svg}</svg></div>{lab}</div>')


def home_html():
    cells = []
    for i, (n, bg, svg) in enumerate(APPS):
        cx, cy = GRID["x0"] + (i % 4) * GRID["dx"], GRID["y0"] + (i // 4) * GRID["dy"]
        m = ' data-m="xicon"' if n == "X" else ""
        cells.append(f'<div class="abs"{m} style="left:{cx - 42}px;top:{cy - 32}px">{app_icon(n, bg, svg)}</div>')
    dock = "".join(f'<div style="margin:0 2px">{app_icon(n, bg, svg, 64, False)}</div>' for n, bg, svg in DOCK)
    body = f"""
<div class="abs" style="left:0;top:0;width:402px;height:874px;background:
  radial-gradient(circle at 20% 15%, #4f8dff 0, transparent 45%),
  radial-gradient(circle at 85% 70%, #1f3fd1 0, transparent 50%),
  radial-gradient(circle at 30% 90%, #0b1c6b 0, transparent 55%),
  linear-gradient(160deg, #2a62f0, #0c1d73)"></div>
{STATUS.format(c="#fff")}
<div class="abs" style="left:17px;top:66px;width:368px;height:150px;border-radius:26px;background:rgba(255,255,255,.16);backdrop-filter:blur(20px);color:#fff;padding:16px 18px">
  <div style="font-size:15px;font-weight:600">香港</div>
  <div style="font-size:48px;font-weight:200;line-height:1.05">24°</div>
  <div style="font-size:13.5px;font-weight:500;margin-top:6px">☀︎ 天晴　最高 27° 最低 21°</div>
</div>
{''.join(cells)}
<div class="abs" style="left:160px;top:745px;width:82px;height:8px;display:flex;gap:7px;justify-content:center"><div style="width:7px;height:7px;border-radius:50%;background:#fff"></div><div style="width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.4)"></div></div>
<div class="abs" style="left:12px;top:770px;width:378px;height:92px;border-radius:36px;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center">{dock}</div>
<div class="abs" style="left:134px;top:861px;width:134px;height:5px;border-radius:3px;background:#fff"></div>
"""
    return page(body, bg="#0c1d73")


def main():
    # the pinned post's picture: the isnail film's wall
    src = Image.open(ROOT / "build/isnail/f19.0.jpg")
    w, h = src.size
    cw, ch = int(w * 0.80), int(w * 0.80 * 190 / 332)
    src.crop((w // 2 - cw // 2 + 20, h // 2 - ch // 2 - 10, w // 2 + cw // 2 + 20, h // 2 + ch // 2 - 10)).save(ROOT / "build/isnail/pinned.jpg", quality=92)

    (ROOT / "ui/profile.html").write_text(profile_html("base"))
    (ROOT / "ui/profile-name.html").write_text(profile_html("name"))
    (ROOT / "ui/profile-link.html").write_text(profile_html("link"))
    (ROOT / "ui/home.html").write_text(home_html())
    rects = measure("profile-name.html")
    rects.update(measure("home.html"))
    shot("profile.html", "assets/profile.png")
    shot("profile-name.html", "build/layer-name.png", transparent=True)
    shot("profile-link.html", "build/layer-link.png", transparent=True)
    shot("home.html", "assets/home.png")
    # the page he stands on once it is blown up (about 17 times): its band from the name line
    # to the tabs, sharp at that size
    (ROOT / "ui/profile-zoom.html").write_text(profile_html("zoom"))
    shot("profile-zoom.html", "build/profile-zoom.png", scale=ZOOM["scale"])
    z = Image.open(ROOT / "build/profile-zoom.png").convert("RGB")
    z.crop((0, ZOOM["top"] * ZOOM["scale"], W * ZOOM["scale"], ZOOM["bottom"] * ZOOM["scale"])).save(ROOT / "assets/profile-zoom.jpg", quality=93)
    layout = {"scale": S, "avatar": {k: v * S for k, v in AV.items()}}
    layout["name"] = strip("build/layer-name.png", rects["name"], 1.2, "assets/name.png")
    layout["link"] = strip("build/layer-link.png", rects["link"], 2, "assets/link.png")
    paper("assets/name.png", "assets/name-paper.png")
    x, y, w, h = rects["xicon"]
    layout["xicon"] = [(x + 10) * S, y * S, 64 * S, 64 * S]  # the icon's square (without its label)
    layout["zoom"] = [0, ZOOM["top"] * S, W * S, (ZOOM["bottom"] - ZOOM["top"]) * S]
    # the app gone, when he lands on the handle: a plain grey, lightest behind the row and falling
    # off to near black, so black letters and white ones both read on it; the whole screen and the
    # sharp band, the same
    nx, ny, nw, nh = rects["name"]
    blank(ROOT / "assets/screen-blank.png", (W * S, H * S), ((nx + nw / 2) * S, (ny + nh / 2) * S), S)
    blank(ROOT / "assets/profile-blank.jpg", (W * ZOOM["scale"], (ZOOM["bottom"] - ZOOM["top"]) * ZOOM["scale"]),
          ((nx + nw / 2) * ZOOM["scale"], (ny + nh / 2 - ZOOM["top"]) * ZOOM["scale"]), ZOOM["scale"])

    # the avatar: cut from the screenshot, a disc with its white ring
    ref = Image.open(REF).convert("RGB")
    k = ref.width / W
    cx, cy, r = AV["cx"] * k, AV["cy"] * k, AV["r"] * k
    av = ref.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).resize((768, 768), Image.LANCZOS)
    av = av.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    mask = Image.new("L", (768 * 4, 768 * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 768 * 4 - 1, 768 * 4 - 1), fill=255)
    out = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    out.paste(av, (0, 0), mask.resize((768, 768), Image.LANCZOS))
    out.save(ROOT / "assets/avatar.png")

    # the X mark, white on black, for the launch
    (ROOT / "ui/x.html").write_text(page(f'<div style="width:402px;height:402px;display:flex;align-items:center;justify-content:center;background:#000">{xmark(300, "#fff")}</div>', bg="#000"))
    shot("x.html", "assets/x-logo.png", 402, 402)
    (ROOT / "build/ui.json").write_text(json.dumps(layout, indent=1))
    print(json.dumps(layout))


if __name__ == "__main__":
    main()
