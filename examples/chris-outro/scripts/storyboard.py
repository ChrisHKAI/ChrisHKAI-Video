"""The outro's storyboard: key frames (rendered by scripts/scene.py into
build/sb) laid out with their times and what happens, as storyboard/分镜.jpg.
The first panel is the Tim film's last frame (where the outro picks up).

usage: python3 scripts/storyboard.py --list        (the frames to render)
       python3 scripts/storyboard.py               (after rendering them)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import timeline as T  # noqa: E402

E = T.EV
PANELS = [
    (0.0, "接住 Tim 片最後一格：iPhone 4S 沉入黑暗"),
    (E["pop"] + 0.25, "「啵」一聲：iPhone 18 Pro 轉身彈上嚟"),
    (E["groove"] + 0.5, "屏幕亮起，主畫面"),
    (E["tap"] - 0.15, "鏡頭推埋 X，撳落去"),
    (E["launch"] + 0.2, "X 開 app"),
    (E["profile"] + 0.6, "你嘅主頁：Chris（藍剔），下面 @ChrisHKAI"),
    (E["glint"] - 0.1, "頭像慢慢鼓起、郁兩郁"),
    (E["toy"] + 0.25, "「啵」變 3D 公仔"),
    (E["zoom"] + 0.45, "主頁喺佢後面放大，放到佢細過啲字"),
    (E["stomp"] + 0.05, "佢跌落嚟：黑色 C 推出嚟接住佢，個 app 消失"),
    (T.PUSH[3] + 0.3, "h r i s 慢慢推出嚟，H K A I 快啲"),
    (T.PUSH[-1] + 0.2, "成排黑色字：Chris HKAI，乾淨灰色背景"),
    (T.beat(T.C_HOPS[0]) + 0.05, "踩 C 第一下：C 變白、鬆咗"),
    (T.beat(T.C_HOPS[1]) + 0.02, "第二下：再沉、再側"),
    (T.FALL[0] + 0.12, "第三下：C 跌落去，佢彈去 h"),
    (T.beat(T.STEP_BEATS[1]) + 0.08, "一拍跳一粒：踩落變白，一走就跌"),
    (T.beat(T.STEP_BEATS[4]) - 0.15, "飛過空位跳上 H"),
    (T.beat(T.STEP_BEATS[7]) + 0.05, "跳上 I，I 變白"),
    (T.FALL[-1] + 0.25, "I 都跌埋：佢喺半空，望住你"),
    (E["fall"] + 0.3, "沿住放大咗嘅主頁跌落去，主頁慢慢變黑"),
    (E["fall"] + 0.7, "黑暗之中一路跌"),
    (E["sting"] - 0.12, "跌出黑暗，落向地上個 I 字"),
    (E["sting"] + 0.25, "收尾重音：落喺 I 字頂，指住你 + wink"),
    (E["end"] - 0.05, "最後畫面：成個名 + 你企喺 I 字頂"),
]
FRAMES = [T.frame(t) for t, _ in PANELS[1:]]

if "--list" in sys.argv:
    print(",".join(map(str, FRAMES)))
    raise SystemExit

font = ImageFont.truetype("/System/Library/Fonts/Hiragino Sans GB.ttc", 24)
small = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", 20)
TW, TH, CAP, COLS = 640, 360, 52, 4
rows = (len(PANELS) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * TW, rows * (TH + CAP)), "#0d0e11")
d = ImageDraw.Draw(sheet)
tim_last = ROOT.parent / "tim-intro/build/render/4287.png"
for i, (t, text) in enumerate(PANELS):
    x, y = (i % COLS) * TW, (i // COLS) * (TH + CAP)
    src = tim_last if i == 0 else ROOT / f"build/sb/{T.frame(t):04d}.png"
    im = Image.open(src).convert("RGB").resize((TW, TH), Image.LANCZOS)
    sheet.paste(im, (x, y))
    d.rectangle((x, y + TH, x + TW, y + TH + CAP), fill="#16181d")
    d.text((x + 10, y + TH + 13), f"{i + 1:02d}", fill="#7c8496", font=small)
    d.text((x + 48, y + TH + 10), text, fill="#eef1f6", font=font)
    d.text((x + TW - 78, y + 8), f"{t:5.1f}s", fill="#ffd54a", font=small)
out = ROOT / "storyboard"
out.mkdir(exist_ok=True)
sheet.save(out / "分镜.jpg", quality=90)
print("wrote", out / "分镜.jpg", sheet.size)
