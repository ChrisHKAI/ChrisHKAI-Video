"""The storyboard for review: every scene (幕) with its time, what is heard and
what is seen, over real renders of the film's frames.

usage: node scripts/cues.mjs && python3 scripts/storyboard.py [--frames build/sb]
       → storyboard/分镜-1.jpg …
The frames are renders of round(t*30)+1 for every t below (scene.py --scale 50).
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FR = ROOT / (sys.argv[sys.argv.index("--frames") + 1] if "--frames" in sys.argv else "build/sb")
OUT = ROOT / "storyboard"
CUE = json.loads((ROOT / "build/cues.json").read_text())
EV, DUR = CUE["EV"], CUE["DURATION"]

LTH = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/f14049099a04e570b893c01d9a4cd71f87c9e8d8.asset/AssetData/Lantinghei.ttc"
HEAVY, DEMI = 2, 0  # Lantinghei SC Heavy / Demibold
font = lambda size, w=HEAVY: ImageFont.truetype(LTH, size, index=w)

SHOTS = json.loads(subprocess.run(["node", "--input-type=module", "-e", "import { SHOTS } from './src/timeline.js'; console.log(JSON.stringify(SHOTS))"], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
S = {name: t for t, name in SHOTS}
BAND_END = EV["portrait"] + 224.4 - CUE["SONG"]["start"]  # the band stops at 224.4 in the song

SCENES = [
    ("2007：发布 iPhone", 0.0, EV["d8"],
     "大屏原声：乔布斯 2007 年发布 iPhone（你的剪辑版，中英字幕）；Tim 折手机的咔哒声轻轻垫在下面",
     "发布会舞台一片暗，Tim 一个人站在右边，背对我们看着大屏，脚边的计数慢慢跳。镜头推近，大屏占满画面，整段发布会完整播放、字幕清楚：一部 iPod、一部手机、一部互联网通讯设备……「我们把它叫做 iPhone」。",
     [(0.5, "开场：Tim 看着大屏"), (2.9, "推近大屏"), (5.0, "「这一天」"), (15.0, "一部 iPod 一部手机"), (20.0, "还有一部互联网通讯设备"), (29.0, "你们明白了吗"), (36.5, "这是一部设备"), (44.0, "我们把它叫做 iPhone")]),
    ("D8 与新闻", EV["d8"], EV["portrait"],
     "大屏原声：2010 D8 访谈 → 新闻主播 → 讣告，没有配乐。只有 Tim 折手机的咔哒声越折越快、越来越响，到黑白相一下停住",
     "大屏仍然占满画面（你的剪辑版 v4，中英字幕）：2010 年 D8 被问到 iPad 能不能更有弹性，「我们还没有这种技术……可能还要很多年」；然后是 2011 年的新闻：「这个人真正改变了我们每天的生活方式」，「史蒂夫·乔布斯……已经去世，享年 56 岁」。",
     [(EV["d8"] + 1.0, "2010 D8：iPad 能更有弹性吗"), (EV["d8"] + 7.2, "「我们还没有这种技术」"), (EV["news"] - 2.0, "「可能还要很多年」"), (EV["news"] + 1.2, "新闻主播"), (EV["portrait"] - 1.5, "「享年 56 岁」")]),
    ("黑白相，歌声进来", EV["portrait"], EV["flicker"],
     "折手机声停在 491；静下来的一刻《See You Again》的钢琴副歌进来：It's been a long day without you, my friend",
     "黑白相占满大屏，镜头慢慢拉出，回到 Tim 背后：他小小的背影站在巨大的遗照前，脚边的计数停在 491。",
     [(EV["portrait"] + 0.2, "黑白相，歌声进来"), (EV["portrait"] + 1.6, "镜头拉出"), (EV["portrait"] + 4.1, "Tim 站在遗照前")]),
    ("大屏熄灭", EV["flicker"], EV["gone"],
     "And I'll tell you all about it；电流声，关机声在会场里回响，压在钢琴下面",
     "大屏画面跳闪，收成一条线，再收成一个点，整个会场跟着黑下来。",
     [(EV["flicker"] + 0.25, "画面跳闪"), (EV["off"] + 0.12, "压成一条线"), (EV["vanish"] + 0.3, "全场黑下来")]),
    ("舞台全黑，追光亮起", EV["gone"], EV["walk0"],
     "when I see you again；大屏亮起时一阵低沉的气流声，追光打下时「咔」一声灯闸",
     "全黑，只剩 Tim 脚边的 491。大屏在他面前慢慢亮起紫光，镜头同时从他背后一路往后拉，越过观众席头顶（不切镜头）；追光「咔」一声打在舞台左边的空地上；拉到观众席视角停住时，乔布斯正从左边侧幕走进光里，Tim 转身望向他。",
     [(EV["gone"] + 0.8, "全黑，只剩 491"), (EV["light0"] + 0.3, "大屏亮起，镜头往后拉（when）"), (EV["line"] + 0.25, "追光打在空地（see you）"), (EV["open"] + 0.6, "他从侧幕走进光里（again）")]),
    ("乔布斯走向 Tim", EV["walk0"], S["timCU"],
     "We've come a long way from where we began",
     "大屏亮出「iPhone Duo」，排版跟 2007 年发布会最后那张「iPhone」一样。他在追光里一步步走向 Tim，边走边看着他；镜头从观众席慢慢推到 Tim 肩后，舞台灯也慢慢亮回来。",
     [(EV["walk0"] + 0.15, "「iPhone Duo」亮起"), (EV["walk0"] + 2.35, "走向 Tim"), (EV["walk0"] + 5.35, "推到 Tim 肩后")]),
    ("Tim 近景", S["timCU"], S["jobsCU"],
     "Oh, I'll tell you all about it",
     "Tim 看着他走过来，脸被大屏的紫光照着，眼里有光，被打动。",
     [(S["timCU"] + 1.23, "Tim 看着他")]),
    ("乔布斯近景", S["jobsCU"], S["last"],
     "when I see you again",
     "他停在 Tim 面前，追光照着他，背后是大屏和蓝色光束；他慢慢把右手托到下巴，就是黑白相里的姿势。",
     [(S["jobsCU"] + 0.29, "抬手"), (S["jobsCU"] + 1.79, "手托下巴")]),
    ("最后九下", S["last"], EV["give"] - 0.3 * CUE["BEAT"],
     "When I see you again → 鼓声回来",
     "Tim 一愣，然后跟着鼓点把最后九下折完，492…500，再拿着手机走向他。从这里到转黑是一个连续运镜，不切镜头：镜头从侧面慢慢降下来、靠近，头顶的 500 自然出画。",
     [(S["last"] + 0.29, "491"), (S["last"] + 2.19, "跟着鼓点折"), (EV["done"] + 0.1, "500"), (EV["timWalk0"] + 0.7, "走过去，镜头降下来")]),
    ("交给你", EV["give"] - 0.3 * CUE["BEAT"], EV["black"],
     "全乐队副歌，一直到转黑",
     "镜头刚好降到手机的高度：Tim 双手递上折叠手机，乔布斯双手接过，Tim 松手；乔布斯把手机拿近低头看，再抬头对 Tim 笑、慢慢点头，Tim 也点头，镜头一路慢慢推近。点头后停一停，再往后往上拉，绕回观众席：全场灯光亮起，两人站在舞台中间，头顶是大屏上的「iPhone Duo」。",
     [(EV["take"] - 0.14, "递上手机"), (EV["release"] + 0.58, "Tim 松手"), (EV["lookDown"] + 0.84, "低头看手机"), (EV["nod"] + 0.39, "抬头笑、点头"), (EV["swell"] + 0.27, "往后拉"), (EV["swell"] + 4.37, "拉远：iPhone Duo")]),
    ("最后一条信息", EV["black"], DUR,
     f"转黑落在一个重拍上；信息发出「嗖」一声；乐队在 {int(BAND_END // 60)}:{int(BAND_END % 60):02d} 收住，回复的提示音落在安静里；最后锁屏「咔」一声",
     "黑暗里一部 iPhone 4S 亮起（他在世时发布的最后一部 iPhone），屏幕是 2011 年 iOS 5 的信息，联系人 Steve。镜头一路慢慢推近：发出「Steve, we miss you」→ 已送达 → 他正在输入… →「I'll always be here」。停几秒，锁屏熄灭，停在最后一格。",
     [(EV["wake"] + 0.6, "iPhone 4S 亮起"), (EV["send"] + 0.6, "Steve, we miss you"), (EV["typing"] + 0.8, "他正在输入…"), (EV["reply"] + 1.0, "I'll always be here"), (EV["lock"] + 0.8, "锁屏熄灭，完")]),
]
PAGES = [[0, 1], [2, 3, 4], [5, 6, 7], [8, 9, 10]]
if "--list" in sys.argv:  # the film frames the storyboard shows, for scene.py --frames
    print(",".join(str(round(t * 30) + 1) for s in SCENES for t, _ in s[5]))
    sys.exit()

W, PAD = 1920, 56
COLS, GAP = 4, 24
TW = (W - 2 * PAD - (COLS - 1) * GAP) // COLS
TH = TW * 9 // 16
BG, INK, MUTE, ACC, LINE = (20, 20, 22), (242, 240, 236), (160, 158, 154), (232, 70, 58), (60, 60, 64)
COLORS = [(92, 108, 140), (120, 110, 150), (150, 150, 150), (110, 90, 90), (70, 70, 80), (200, 180, 130), (120, 140, 120), (180, 140, 110), (90, 130, 170), (190, 120, 110), (60, 60, 60)]
mmss = lambda t: f"{int(t // 60)}:{t % 60:04.1f}"


def frame(t):
    return Image.open(FR / f"{round(t * 30) + 1:04d}.png").convert("RGB").resize((TW, TH), Image.LANCZOS)


def wrap(d, text, f, width):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=f) > width:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    return lines + [cur] if cur else lines


def scene_block(i):
    title, a, b, sound, see, shots = SCENES[i]
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    fb, fs = font(28, DEMI), font(22, DEMI)
    snd = wrap(probe, "声音  " + sound, fb, W - 2 * PAD)
    pic = wrap(probe, "画面  " + see, fb, W - 2 * PAD)
    rows = (len(shots) + COLS - 1) // COLS
    h = 70 + 40 * (len(snd) + len(pic)) + 16 + rows * (TH + 48) + 30
    im = Image.new("RGB", (W, h), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((PAD, 14, PAD + 10, 58), fill=COLORS[i])
    d.text((PAD + 26, 12), f"第 {i + 1} 幕  {title}", font=font(44), fill=INK)
    d.text((W - PAD, 18), f"{mmss(a)} – {mmss(b)}   {b - a:.1f} 秒", font=font(32, DEMI), fill=MUTE, anchor="ra")
    y = 76
    for ln in snd:
        d.text((PAD, y), ln, font=fb, fill=(214, 190, 140))
        y += 40
    for ln in pic:
        d.text((PAD, y), ln, font=fb, fill=INK)
        y += 40
    y += 16
    for k, (t, cap) in enumerate(shots):
        x, yy = PAD + (k % COLS) * (TW + GAP), y + (k // COLS) * (TH + 48)
        im.paste(frame(t), (x, yy))
        d.text((x, yy + TH + 8), f"{mmss(t)}  {cap}", font=fs, fill=MUTE)
    d.line((PAD, h - 2, W - PAD, h - 2), fill=LINE, width=2)
    return im


def overview():
    h = 250
    im = Image.new("RGB", (W, h), BG)
    d = ImageDraw.Draw(im)
    d.text((PAD, 18), "Tim 致敬片 · 分镜（第 6 版：iPhone 4S 结尾）", font=font(52), fill=INK)
    d.text((W - PAD, 30), f"共 {len(SCENES)} 幕 · {DUR:.1f} 秒", font=font(30, DEMI), fill=MUTE, anchor="ra")
    x0, x1, y0, y1 = PAD, W - PAD, 112, 162
    sx = lambda t: x0 + (x1 - x0) * t / DUR
    for i, (_, a, b, *_r) in enumerate(SCENES):
        d.rectangle((sx(a), y0, sx(b) - 3, y1), fill=COLORS[i])
        if sx(b) - sx(a) > 34:
            d.text(((sx(a) + sx(b)) / 2, (y0 + y1) / 2), str(i + 1), font=font(28), fill=(255, 255, 255), anchor="mm")
    song = CUE["SONG"]
    at = lambda st: EV["portrait"] + st - song["start"]
    for k, (t, lab) in enumerate(((EV["portrait"], "歌声进来"), (at(song["drop"]), "鼓声回来"), (at(200.55), "全乐队"), (DUR, "歌曲结束"))):
        X, dy = sx(t), 34 * (k % 2)
        d.line((X, y0 - 8, X, y1 + 10 + dy), fill=ACC, width=3)
        d.text((min(X, x1 - 60), y1 + 14 + dy), f"{lab} {mmss(t)}", font=font(22, DEMI), fill=ACC, anchor="ma")
    return im


def stack(parts):
    h = sum(p.height for p in parts) + 30
    out = Image.new("RGB", (W, h), BG)
    y = 10
    for p in parts:
        out.paste(p, (0, y))
        y += p.height
    return out


OUT.mkdir(exist_ok=True)
for old in OUT.glob("分镜-*.jpg"):
    old.unlink()
for n, page in enumerate(PAGES, 1):
    parts = ([overview()] if n == 1 else []) + [scene_block(i) for i in page]
    stack(parts).save(OUT / f"分镜-{n}.jpg", quality=90)
    print(OUT / f"分镜-{n}.jpg")
