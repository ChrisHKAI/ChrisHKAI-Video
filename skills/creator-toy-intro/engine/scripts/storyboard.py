"""Step 4's page: the storyboard the user signs off before the full render.
The story's parts, the beat grid with its hits, the preview frames (real
renders, the platforms' own controls laid over them), the agent's own checks
and what the user decides. One HTML file with its pictures inside, to open
locally or publish.

usage: FILM=<film folder> python3 engine/scripts/storyboard.py [--frames] [--lang zh-Hant] [--in build/previs]
  --frames  prints the frames to render first (render -- --frames … --out build/previs)
writes build/storyboard/index.html
"""
import base64
import html
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM, FILM_JSON, SKILL  # noqa: E402  the film workspace (FILM env var)
from publish import PLATFORMS, SAFE, platforms, orientation, content_box, past  # noqa: E402

argv = sys.argv[1:]


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SB = json.loads((SKILL / "templates" / FILM_JSON["template"] / "storyboard.json").read_text())
TL = json.loads((FILM / "build/timeline.json").read_text())
FPS, DUR, BPM = TL["FPS"], TL["DURATION"], TL["BPM"]
EV = TL["EV"]
LANG = arg("--lang", "zh-Hant")
SRC = FILM / arg("--in", "build/previs")
OUT = FILM / "build/storyboard"


def when(ref, i=0, dt=0.0):
    """A time from an event name (its i-th time if it is a span), a number, or "end"."""
    if ref == "end":
        return float(DUR)
    if isinstance(ref, (int, float)):
        return float(ref) + dt
    v = EV[ref]
    while isinstance(v, list):  # a span [from, to], or a list of spans
        v, i = v[i], 0
    return float(v) + dt


frames = [(f, max(1, min(round(when(f.get("ev", f.get("at")), f.get("i", 0), f.get("dt", 0)) * FPS) + 1, DUR * FPS))) for f in SB["frames"]]
if "--frames" in argv:
    print(",".join(str(n) for _, n in frames))
    raise SystemExit

# ── the words, filled from film.json ────────────────────────────────────────
W = {
    "zh-Hant": {"title": "{name} 自我介紹片分鏡", "parts": "故事", "grid": "音樂節拍格", "gridnote": "每格一拍，粗線係每小節第一拍，紅線係重拍事件", "frames": "預覽畫面", "framesnote": "全部係真 3D 渲染（半解像度、低取樣），唔係草圖；疊住出街平台嘅介面", "zones": "顯示平台介面", "checks": "我自己檢查咗", "decide": "開工前要你拍板", "note": "正式渲染會用全解像度同高取樣；改咗邊格就只重渲嗰幾格。", "time": "時間", "what": "發生乜事", "uses": "用咩資料", "missing": "未渲染", "animatic": "粗剪動畫", "glasses": "推眼鏡", "wave": "揮手", "portrait": "9:16 直片", "landscape": "16:9 橫片", "ok": "通過", "warn": "要留意", "c_frames": "{n}/{m} 格預覽渲染好", "c_toy": "公仔用用家確認咗嘅相：{x}", "c_notoy": "公仔用邊張相仲未確認", "c_counter": "數字 {x} 會由頁面升起跳數", "c_badcounter": "數字 {x} 未跳到數（要整數、單位同兩個字標籤）", "c_end": "結尾嘅字同公仔喺安全框入面", "c_badend": "結尾內容（字、公仔、道具一齊計）出咗安全框 {x}：睇吓有冇字俾介面遮住"},
    "zh-Hans": {"title": "{name} 自我介绍片分镜", "parts": "故事", "grid": "音乐节拍格", "gridnote": "每格一拍，粗线是每小节第一拍，红线是重拍事件", "frames": "预览画面", "framesnote": "全部是真 3D 渲染（半分辨率、低采样），不是草图；叠着发布平台的界面", "zones": "显示平台界面", "checks": "我先检查过", "decide": "开工前请你拍板", "note": "正式渲染用全分辨率和高采样；改了哪几帧就只重渲那几帧。", "time": "时间", "what": "发生什么", "uses": "用什么资料", "missing": "未渲染", "animatic": "粗剪动画", "glasses": "推眼镜", "wave": "挥手", "portrait": "9:16 竖屏", "landscape": "16:9 横屏", "ok": "通过", "warn": "要留意", "c_frames": "{n}/{m} 帧预览已渲染", "c_toy": "公仔用的是用户确认过的图：{x}", "c_notoy": "公仔用哪张图还没确认", "c_counter": "数字 {x} 会从页面升起跳数", "c_badcounter": "数字 {x} 还不能跳数（要整数、单位和两个字的标签）", "c_end": "结尾的字和公仔在安全框内", "c_badend": "结尾内容（字、公仔、道具一起算）超出安全框 {x}：看看有没有字被界面挡住"},
    "en": {"title": "{name}: storyboard", "parts": "The story", "grid": "Beat grid", "gridnote": "one cell a beat; thick lines start a bar, red lines are the hits", "frames": "Preview frames", "framesnote": "all real 3D renders (half size, few samples), not sketches; the platforms' controls laid over them", "zones": "Show the platforms' controls", "checks": "Checked first", "decide": "Before the full render, please decide", "note": "The final render is full size and fully sampled; a change re-renders only the frames it touches.", "time": "Time", "what": "What happens", "uses": "Uses", "missing": "not rendered", "animatic": "Animatic", "glasses": "pushes its glasses", "wave": "a wave", "portrait": "9:16 portrait", "landscape": "16:9 landscape", "ok": "ok", "warn": "look", "c_frames": "{n}/{m} preview frames rendered", "c_toy": "the toy is made from the picture the user confirmed: {x}", "c_notoy": "the toy's picture is not confirmed yet", "c_counter": "{x} rises from the page and counts up", "c_badcounter": "{x} cannot count up yet (whole digits, a unit and a two-character label)", "c_end": "the end card's text and toy sit inside the safe box", "c_badend": "the end card (text, toy and prop together) runs past the safe box {x}: check no text is under the controls"},
}[LANG if LANG in ("zh-Hant", "zh-Hans", "en") else "zh-Hant"]
PROP = {"snail": {"zh-Hant": "蝸牛", "zh-Hans": "蜗牛", "en": "the snail"}}
toy = json.loads((FILM / FILM_JSON["toy"]).read_text())
pr, posts, cta, counter = FILM_JSON["profile"], FILM_JSON["posts"], FILM_JSON["cta"], FILM_JSON["counter"]
short = lambda s, n=16: s if len(s) <= n else s[:n] + "…"  # noqa: E731
W_, H_ = FILM_JSON["format"]["size"]
orient = orientation(W_, H_)
publish = platforms([])
FILL = {
    "name": pr["name"], "handle": "@" + pr["handle"] if pr.get("handle") else "",
    "counter": f"{counter['value']}{counter['unit']} {counter['label']}",
    "slogan": "".join(p["text"] for p in cta["slogan"]),
    "prop": PROP.get(cta.get("prop", {}).get("kind"), {}).get(LANG, cta.get("prop", {}).get("kind", "")),
    "signature": W[(toy.get("signature") or {"move": "wave"})["move"]],
    "proof1": "「" + short(posts["pinned"]["title"]) + "」", "proof2": "「" + short(posts["retro"]["title"]) + "」",
    "publish": "、".join(PLATFORMS[p]["name"] for p in publish), "aspect": W[orient],
}
t = lambda d: (d.get(LANG) or d.get("zh-Hant") or next(iter(d.values()))).format(**FILL)  # noqa: E731
e = html.escape

# ── the agent's own checks ──────────────────────────────────────────────────
checks = []
have = [n for _, n in frames if (SRC / f"{n:04d}.png").exists()]
checks.append((len(have) == len(frames), W["c_frames"].format(n=len(have), m=len(frames))))
toyfrom = FILM_JSON.get("toyFrom")
checks.append((bool(toyfrom), W["c_toy"].format(x=", ".join(toyfrom)) if toyfrom else W["c_notoy"]))
digits_ok = float(counter["value"]).is_integer() and counter["unit"] and len(counter["label"]) == 2
checks.append((bool(digits_ok), W["c_counter" if digits_ok else "c_badcounter"].format(x=FILL["counter"])))
end = [n for _, n in frames if n >= (DUR - 1.5) * FPS and (SRC / f"{n:04d}.png").exists()]
if end:
    im = Image.open(SRC / f"{end[-1]:04d}.png").convert("RGB")
    box = content_box(im)
    s = SAFE[orient]
    over = past(box, [round(s[0] * im.width), round(s[1] * im.height), round(s[2] * im.width), round(s[3] * im.height)])
    checks.append((not over, W["c_end"] if not over else W["c_badend"].format(x=", ".join(f"{v}px {k}" for k, v in over.items()))))


# ── pictures inside the page ────────────────────────────────────────────────
def jpeg(path, width):
    im = Image.open(path).convert("RGB")
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


TW = 360 if orient == "portrait" else 560
zones = [(p, z) for p in publish for z in PLATFORMS[p]["zones"][orient]]
ZC = {"x": "#1D9BF0", "douyin": "#FE2C55", "xhs": "#FF9F0A", "channels": "#07C160", "ig": "#BF5AF2"}
overlay = "".join(f'<i class="z" style="left:{z["box"][0]*100:.2f}%;top:{z["box"][1]*100:.2f}%;width:{(z["box"][2]-z["box"][0])*100:.2f}%;height:{(z["box"][3]-z["box"][1])*100:.2f}%;border-color:{ZC.get(p, "#fff")}"></i>' for p, z in zones)
sb = SAFE[orient]
overlay += f'<i class="safe" style="left:{sb[0]*100:.2f}%;top:{sb[1]*100:.2f}%;width:{(sb[2]-sb[0])*100:.2f}%;height:{(sb[3]-sb[1])*100:.2f}%"></i>'

cards = []
for f, n in frames:
    p = SRC / f"{n:04d}.png"
    img = f'<div class="shot" style="aspect-ratio:{W_}/{H_}"><img src="{jpeg(p, TW)}" alt="{e(t(f["title"]))}">{overlay}</div>' if p.exists() else f'<div class="shot none" style="aspect-ratio:{W_}/{H_}">{W["missing"]} #{n}</div>'
    cards.append(f'<figure>{img}<figcaption><code>{(n - 1) / FPS:.1f} s</code><h4>{e(t(f["title"]))}</h4><p>{e(t(f["what"]))}</p></figcaption></figure>')

hero_n = end[-1] if end else (have[-1] if have else None)
hero = f'<img class="hero" src="{jpeg(SRC / f"{hero_n:04d}.png", 720 if orient == "landscape" else 420)}" alt="">' if hero_n else ""

rows = "".join(f'<tr><td><b>{e(t(pt["label"]))}</b><br><code>{when(pt["from"]):.1f}–{when(pt["to"]):.1f} s</code></td><td>{e(t(pt["what"]))}</td><td>{e(t(pt["uses"]))}</td></tr>' for pt in SB["parts"])

# the beat grid: a cell a beat, bands for the parts, a red line on each hit
beats = round(DUR * BPM / 60)
bt = 60 / BPM
g = "".join(f'<div class="band b{k % 5}" style="grid-column:{round(when(pt["from"]) / bt) + 1}/{round(when(pt["to"]) / bt) + 1}">{e(t(pt["label"]))}</div>' for k, pt in enumerate(SB["parts"]))
g += "".join(f'<div class="beat{" down" if i % 4 == 0 else ""}" style="grid-column:{i + 1}"><span>{f"{i * bt:g}" if i % 4 == 0 else ""}</span></div>' for i in range(beats))
g += "".join(f'<div class="hit{" low" if k % 2 else ""}" style="grid-column:{min(beats, round(when(h["ev"]) / bt) + 1)}/span 4"><i></i><em>{when(h["ev"]):.1f}s {e(t(h["label"]))}</em></div>' for k, h in enumerate(SB["hits"]))

anim = OUT / "animatic.mp4"
animatic = f'<section><h2>{W["animatic"]}</h2><video controls src="animatic.mp4" style="width:100%;max-width:{720 if orient == "landscape" else 360}px"></video></section>' if anim.exists() else ""
checks_html = "".join(f'<li class="{"ok" if ok else "warn"}"><b>{W["ok"] if ok else W["warn"]}</b>{e(msg)}</li>' for ok, msg in checks)
decide = "".join(f"<li>{e(t(d))}</li>" for d in SB["decisions"])
specs = [f"{W_}×{H_} · {FPS} fps", f"{DUR} s · {BPM} BPM", FILL["publish"], "Blender Cycles"]
title = W["title"].format(**FILL)

page = f"""<!doctype html>
<html lang="{LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<style>
:root {{ --bg:#0c0d10; --panel:#15171c; --ink:#eceae6; --muted:#9a978f; --rule:#2a2d33; --red:#e2463b; --b0:#e2463b; --b1:#3d7bff; --b2:#c9a679; --b3:#43b37a; --b4:#b06ae0; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 "PingFang TC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif; }}
.wrap {{ max-width:1240px; margin:0 auto; padding:28px 16px 64px; display:grid; gap:40px; }}
header {{ display:grid; gap:16px; grid-template-columns:auto 1fr; align-items:end; }}
@media (max-width:720px) {{ header {{ grid-template-columns:1fr; }} }}
.hero {{ max-width:100%; max-height:420px; border-radius:6px; border:1px solid var(--rule); }}
h1 {{ font-size:30px; margin:0 0 8px; }} h2 {{ font-size:20px; margin:0 0 14px; }} h2 small {{ color:var(--muted); font-size:13px; font-weight:400; margin-left:10px; }}
.specs span {{ display:inline-block; border:1px solid var(--rule); border-radius:20px; padding:2px 12px; margin:0 6px 6px 0; color:var(--muted); font-size:13px; }}
table {{ width:100%; border-collapse:collapse; background:var(--panel); border-radius:8px; overflow:hidden; }}
td {{ padding:12px 14px; border-top:1px solid var(--rule); vertical-align:top; }} tr:first-child td {{ border-top:0; }}
td:first-child {{ white-space:nowrap; }} code {{ font:12px ui-monospace,Menlo,monospace; color:var(--muted); }}
.gridbox {{ overflow-x:auto; background:var(--panel); border-radius:8px; padding:14px; }}
.grid {{ display:grid; grid-template-columns:repeat({beats},minmax(16px,1fr)); grid-auto-rows:auto; min-width:{beats * 16}px; row-gap:6px; }}
.band {{ grid-row:1; font-size:12px; padding:3px 6px; border-radius:4px; white-space:nowrap; overflow:hidden; }}
.b0 {{ background:color-mix(in srgb,var(--b0) 30%,transparent); }} .b1 {{ background:color-mix(in srgb,var(--b1) 30%,transparent); }} .b2 {{ background:color-mix(in srgb,var(--b2) 30%,transparent); }} .b3 {{ background:color-mix(in srgb,var(--b3) 30%,transparent); }} .b4 {{ background:color-mix(in srgb,var(--b4) 30%,transparent); }}
.beat {{ grid-row:2; height:26px; border-left:1px solid var(--rule); position:relative; }} .beat.down {{ border-left:2px solid var(--muted); }}
.beat span {{ position:absolute; top:28px; left:3px; font-size:11px; color:var(--muted); }}
.hit {{ grid-row:3; position:relative; height:34px; margin-top:14px; }} .hit.low {{ grid-row:4; }}
.hit i {{ position:absolute; left:0; top:-58px; bottom:16px; border-left:2px solid var(--red); }} .hit em {{ font-style:normal; font-size:12px; color:#ffb4ad; white-space:nowrap; padding-left:4px; }}
.frames {{ display:grid; grid-template-columns:repeat(auto-fill,minmax({200 if orient == "portrait" else 300}px,1fr)); gap:18px; }}
figure {{ margin:0; background:var(--panel); border-radius:8px; overflow:hidden; }}
.shot {{ position:relative; background:#000; }} .shot img {{ width:100%; height:100%; object-fit:cover; display:block; }}
.shot.none {{ display:flex; align-items:center; justify-content:center; color:var(--muted); }}
.z {{ position:absolute; border:1px solid; background:rgba(0,0,0,.28); }} .safe {{ position:absolute; border:1.5px dashed #fff; }}
body.nozones .z, body.nozones .safe {{ display:none; }}
figcaption {{ padding:10px 12px 14px; }} figcaption h4 {{ margin:2px 0; font-size:16px; }} figcaption p {{ margin:0; color:var(--muted); font-size:14px; }}
label.tg {{ font-size:13px; color:var(--muted); cursor:pointer; }}
ul.checks, ol.ask {{ background:var(--panel); border-radius:8px; padding:16px 16px 16px 36px; margin:0; }}
ul.checks li {{ margin:4px 0; }} ul.checks b {{ display:inline-block; min-width:56px; margin-right:8px; }} li.ok b {{ color:#43b37a; }} li.warn b {{ color:#ff9f0a; }}
ol.ask li {{ margin:6px 0; font-size:16px; }} .note {{ color:var(--muted); font-size:13px; }}
</style></head>
<body><div class="wrap">
<header>{hero}<div><h1>{e(title)}</h1><div class="specs">{"".join(f"<span>{e(s)}</span>" for s in specs)}</div></div></header>
<section><h2>{W["parts"]}</h2><table><tr><td><b>{W["time"]}</b></td><td><b>{W["what"]}</b></td><td><b>{W["uses"]}</b></td></tr>{rows}</table></section>
<section><h2>{W["grid"]}<small>{W["gridnote"]}</small></h2><div class="gridbox"><div class="grid">{g}</div></div></section>
<section><h2>{W["frames"]}<small>{W["framesnote"]}</small></h2><p><label class="tg"><input type="checkbox" checked onchange="document.body.classList.toggle('nozones',!this.checked)"> {W["zones"]}</label></p><div class="frames">{"".join(cards)}</div></section>
{animatic}
<section><h2>{W["checks"]}</h2><ul class="checks">{checks_html}</ul></section>
<section><h2>{W["decide"]}</h2><ol class="ask">{decide}</ol><p class="note">{W["note"]}</p></section>
</div></body></html>
"""
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "index.html").write_text(page)
print(f"storyboard → {(OUT / 'index.html').relative_to(FILM)} ({len(have)}/{len(frames)} frames, {len(page) // 1024} KB)")
for ok, msg in checks:
    print(("  ✓ " if ok else "  ! ") + msg)
