# -*- coding: utf-8 -*-
# (declared: Python 3.9 misreads a UTF-8 line this long, the words' tables, without it)
"""Step 4's page: the storyboard the user signs off before the full render.
The story's parts, the beat grid with its hits, the preview frames (real
renders, one to four a row, as the viewer picks), the agent's own checks
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
from film import FILM, FILM_JSON, TEMPLATE  # noqa: E402  the film workspace (FILM env var)
from publish import PLATFORMS, SAFE, platforms, orientation, content_box, past  # noqa: E402
import pacing  # noqa: E402
import colors  # noqa: E402
import ledger  # noqa: E402

argv = sys.argv[1:]


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


SB = json.loads((TEMPLATE / "storyboard.json").read_text())
TL = json.loads((FILM / "build/timeline.json").read_text())
FPS, DUR, BPM = TL["FPS"], TL["DURATION"], TL["BPM"]
# the film may be pieces of the story between beats (SEGMENTS): the template's parts,
# frames and hits are on the story's clock and go where the film plays them; each beat
# adds its own (its module's "storyboard", in its own seconds)
SEGS = TL.get("SEGMENTS")
EV = TL["STORY"]["EV"] if SEGS else TL["EV"]
SDUR = TL["STORY"]["DURATION"] if SEGS else DUR
LANG = arg("--lang", "zh-Hant")
SRC = FILM / arg("--in", "build/previs")
OUT = FILM / "build/storyboard"


def when(ref, i=0, dt=0.0):
    """A story time from an event name (its i-th time if it is a span), a number, or "end"."""
    if ref == "end":
        return float(SDUR)
    if isinstance(ref, (int, float)):
        return float(ref) + dt
    v = EV[ref]
    while isinstance(v, list):  # a span [from, to], or a list of spans
        v, i = v[i], 0
    return float(v) + dt


def film_t(s):
    """Where the film plays story time s (None: no piece of the film plays it)."""
    if not SEGS:
        return s
    for g in SEGS:
        if g["kind"] == "story" and g["s0"] - 1e-6 <= s <= g["s1"] + 1e-6:
            return s - g["s0"] + g["f0"]
    return None


frame_n = lambda ft: max(1, min(round(ft * FPS) + 1, DUR * FPS))  # noqa: E731
frames = [(f, frame_n(ft)) for f in SB["frames"] if (ft := film_t(when(f.get("ev", f.get("at")), f.get("i", 0), f.get("dt", 0)))) is not None]
# the parts in film time: (part, from, to); a part the film cuts into pieces shows once per piece
PARTS = []
for pt in SB["parts"]:
    a, b = when(pt["from"]), when(pt["to"])
    if not SEGS:
        PARTS.append((pt, a, b))
        continue
    for g in SEGS:
        lo, hi = max(a, g.get("s0", 0)), min(b, g.get("s1", 0))
        if g["kind"] == "story" and hi - lo > 1e-6:
            PARTS.append((pt, lo - g["s0"] + g["f0"], hi - g["s0"] + g["f0"]))
HITS = [(h, ft) for h in SB["hits"] if (ft := film_t(when(h["ev"]))) is not None]
for g in SEGS or []:
    if g["kind"] != "beat":
        continue
    sb = g.get("storyboard") or {}
    PARTS.append((sb.get("part") or {"label": g["beat"], "what": "", "uses": ""}, g["f0"], g["f1"]))
    frames += [(f, frame_n(g["f0"] + f["at"])) for f in sb.get("frames", [])]
    HITS += [(h, g["f0"] + h["at"]) for h in sb.get("hits", [])]
if SEGS:
    PARTS.sort(key=lambda p: p[1])
    frames.sort(key=lambda fn: fn[1])
    HITS.sort(key=lambda h: h[1])
if "--frames" in argv:
    print(",".join(str(n) for _, n in frames))
    raise SystemExit

# ── the words, filled from film.json ────────────────────────────────────────
W = {
    "zh-Hant": {"title": "{name} 自我介紹片分鏡", "parts": "故事", "grid": "音樂節拍格", "gridnote": "每格一拍，粗線係每小節第一拍，紅線係重拍事件", "frames": "預覽畫面", "framesnote": "全部係真 3D 渲染（半解像度、低取樣），唔係草圖", "cols": "每行", "checks": "我自己檢查咗", "decide": "開工前要你拍板", "note": "正式渲染會用全解像度同高取樣；改咗邊格就只重渲嗰幾格。", "time": "時間", "what": "發生乜事", "uses": "用咩資料", "missing": "未渲染", "animatic": "粗剪動畫", "glasses": "推眼鏡", "wave": "揮手", "portrait": "9:16 直片", "landscape": "16:9 橫片", "ok": "通過", "warn": "要留意", "c_frames": "{n}/{m} 格預覽渲染好", "c_toy": "公仔用用家確認咗嘅相：{x}", "c_notoy": "公仔用邊張相仲未確認", "c_counter": "數字 {x} 會由頁面升起跳數", "c_badcounter": "數字 {x} 未跳到數（要整數、單位同兩個字標籤）", "c_nocounter": "呢部片冇計數器", "c_len": "片長 {x} 秒，{p} 最長收 {m} 秒", "c_badlen": "片長 {x} 秒，超過 {p} 嘅 {m} 秒上限：拍子要縮短", "c_end": "結尾嘅字同公仔喺安全框入面", "c_badend": "結尾內容（字、公仔、道具一齊計）出咗安全框 {x}：睇吓有冇字俾介面遮住", "c_hook": "{t} 秒有第一下重拍（頭 3 秒內有鉤）", "c_nohook": "頭 3 秒冇重拍：第一下喺 {t} 秒，觀眾可能未入戲就碌走", "c_nodead": "冇死位：每兩小節（{m} 秒）內都有新嘢發生", "c_dead": "{a}–{b} 秒有 {n} 秒冇新嘢發生（兩小節 {m} 秒內要有）：加一下動作，或者剪短", "c_alone": "{a}–{b} 秒淨係公仔自己跳 {n} 下，冇其他新嘢：睇吓使唔使", "c_reads": "{n} 段字都停夠時間俾人睇完", "c_readsend": "（結尾 {k} 段停到片尾，播完停喺最後一格）", "c_short": "「{x}」停 {s} 秒，要 {n} 秒先睇得完：慢返 {more} 秒", "c_noreads": "template 冇講邊啲字要讀，閱讀時間未檢查", "c_toycolor": "公仔嘅 {x}（{hex}，佔 {p}%）喺黑舞台上溶埋（對比 {r}:1）：加輪廓光，或者舞台調光啲", "c_textcolor": "{n} 件字用 {hex}，對比得 {r}:1（要 3:1 以上）：換一隻顏色", "c_confetti": "彩紙 {hex} 喺黑舞台上睇唔到（對比 {r}:1）：換一隻", "c_colors": "公仔、字同彩紙喺舞台上都睇得清", "c_ledger": "同 {x} 只有 {d} 樣唔同（一樣：{what}）：最少要 4 樣唔同，換一兩樣", "c_ledger_ok": "同之前 {n} 條片都夠唔同（最似 {x}：{d} 樣唔同）", "c_ledger_none": "未有交咗嘅片可以比較", "dims": {"opening": "開場", "structure": "結構", "signature": "招牌動作", "colours": "顏色", "sound": "聲", "ending": "結尾"}, "sep": "、"},
    "zh-Hans": {"title": "{name} 自我介绍片分镜", "parts": "故事", "grid": "音乐节拍格", "gridnote": "每格一拍，粗线是每小节第一拍，红线是重拍事件", "frames": "预览画面", "framesnote": "全部是真 3D 渲染（半分辨率、低采样），不是草图", "cols": "每行", "checks": "我先检查过", "decide": "开工前请你拍板", "note": "正式渲染用全分辨率和高采样；改了哪几帧就只重渲那几帧。", "time": "时间", "what": "发生什么", "uses": "用什么资料", "missing": "未渲染", "animatic": "粗剪动画", "glasses": "推眼镜", "wave": "挥手", "portrait": "9:16 竖屏", "landscape": "16:9 横屏", "ok": "通过", "warn": "要留意", "c_frames": "{n}/{m} 帧预览已渲染", "c_toy": "公仔用的是用户确认过的图：{x}", "c_notoy": "公仔用哪张图还没确认", "c_counter": "数字 {x} 会从页面升起跳数", "c_badcounter": "数字 {x} 还不能跳数（要整数、单位和两个字的标签）", "c_nocounter": "这部片没有计数器", "c_len": "片长 {x} 秒，{p} 最长收 {m} 秒", "c_badlen": "片长 {x} 秒，超过 {p} 的 {m} 秒上限：拍子要缩短", "c_end": "结尾的字和公仔在安全框内", "c_badend": "结尾内容（字、公仔、道具一起算）超出安全框 {x}：看看有没有字被界面挡住", "c_hook": "{t} 秒有第一下重拍（头 3 秒内有钩子）", "c_nohook": "头 3 秒没有重拍：第一下在 {t} 秒，观众可能还没入戏就划走", "c_nodead": "没有死位：每两小节（{m} 秒）内都有新东西发生", "c_dead": "{a}–{b} 秒有 {n} 秒没有新东西发生（两小节 {m} 秒内要有）：加一个动作，或者剪短", "c_alone": "{a}–{b} 秒只有公仔自己跳 {n} 下，没有别的新东西：看看要不要", "c_reads": "{n} 段字都停够时间让人看完", "c_readsend": "（结尾 {k} 段停到片尾，播完停在最后一帧）", "c_short": "「{x}」停 {s} 秒，要 {n} 秒才看得完：放慢 {more} 秒", "c_noreads": "模板没说哪些字要读，阅读时间未检查", "c_toycolor": "公仔的 {x}（{hex}，占 {p}%）在黑舞台上融在一起（对比 {r}:1）：加轮廓光，或者把舞台调亮一点", "c_textcolor": "{n} 个字用 {hex}，对比只有 {r}:1（要 3:1 以上）：换一个颜色", "c_confetti": "彩纸 {hex} 在黑舞台上看不见（对比 {r}:1）：换一个", "c_colors": "公仔、字和彩纸在舞台上都看得清", "c_ledger": "和 {x} 只有 {d} 样不同（一样：{what}）：至少要 4 样不同，换一两样", "c_ledger_ok": "和之前 {n} 条片都够不同（最像 {x}：{d} 样不同）", "c_ledger_none": "还没有交付的片可以比较", "dims": {"opening": "开场", "structure": "结构", "signature": "招牌动作", "colours": "颜色", "sound": "声音", "ending": "结尾"}, "sep": "、"},
    "en": {"title": "{name}: storyboard", "parts": "The story", "grid": "Beat grid", "gridnote": "one cell a beat; thick lines start a bar, red lines are the hits", "frames": "Preview frames", "framesnote": "all real 3D renders (half size, few samples), not sketches", "cols": "Per row", "checks": "Checked first", "decide": "Before the full render, please decide", "note": "The final render is full size and fully sampled; a change re-renders only the frames it touches.", "time": "Time", "what": "What happens", "uses": "Uses", "missing": "not rendered", "animatic": "Animatic", "glasses": "pushes its glasses", "wave": "a wave", "portrait": "9:16 portrait", "landscape": "16:9 landscape", "ok": "ok", "warn": "look", "c_frames": "{n}/{m} preview frames rendered", "c_toy": "the toy is made from the picture the user confirmed: {x}", "c_notoy": "the toy's picture is not confirmed yet", "c_counter": "{x} rises from the page and counts up", "c_badcounter": "{x} cannot count up yet (whole digits, a unit and a two-character label)", "c_nocounter": "this film has no counter", "c_len": "{x} s long; {p} takes up to {m} s", "c_badlen": "{x} s long, past {p}'s {m} s: shorten the beats", "c_end": "the end card's text and toy sit inside the safe box", "c_badend": "the end card (text, toy and prop together) runs past the safe box {x}: check no text is under the controls", "c_hook": "the first hit at {t} s (a hook within 3 s)", "c_nohook": "no hit in the first 3 s: the first is at {t} s; viewers may scroll on before it", "c_nodead": "no quiet stretch: something new at least every two bars ({m} s)", "c_dead": "{a}–{b} s: {n} s with nothing new (two bars: {m} s): add a move, or cut it shorter", "c_alone": "{a}–{b} s: only the toy hopping ({n} hops), nothing else new: does it need them?", "c_reads": "all {n} lines stay long enough to read", "c_readsend": " (the end card's {k} to the last frame, which stays)", "c_short": "\"{x}\" stays {s} s and reads in {n} s: {more} s longer", "c_noreads": "the template does not say what the viewer reads: reading time not checked", "c_toycolor": "the toy's {x} ({hex}, {p}% of it) melts into the dark stage ({r}:1): a rim light, or a lighter stage", "c_textcolor": "{n} letters in {hex} stand at {r}:1 (3:1 or more reads): another colour", "c_confetti": "confetti {hex} vanishes on the dark stage ({r}:1): another colour", "c_colors": "the toy, the lettering and the confetti all read on the stage", "c_ledger": "only {d} of 6 differ from {x} (the same: {what}): four at least; change one or two", "c_ledger_ok": "differs enough from the {n} earlier films (closest, {x}: {d} of 6 differ)", "c_ledger_none": "no delivered film to compare with yet", "dims": {"opening": "opening", "structure": "structure", "signature": "signature move", "colours": "colours", "sound": "sound", "ending": "ending"}, "sep": ", "},
}[LANG if LANG in ("zh-Hant", "zh-Hans", "en") else "zh-Hant"]
PROP = {"snail": {"zh-Hant": "蝸牛", "zh-Hans": "蜗牛", "en": "the snail"}}
toy = json.loads((FILM / FILM_JSON["toy"]).read_text())
pr, posts, cta = FILM_JSON["profile"], FILM_JSON["posts"], FILM_JSON["cta"]
# the counter, unless the film has none (no film.json "counter", or story "counter": false)
counter = FILM_JSON.get("counter") if FILM_JSON.get("story", {}).get("counter", True) is not False else None
short = lambda s, n=16: s if len(s) <= n else s[:n] + "…"  # noqa: E731
W_, H_ = FILM_JSON["format"]["size"]
orient = orientation(W_, H_)
publish = platforms([])
FILL = {
    "name": pr["name"], "handle": "@" + pr["handle"] if pr.get("handle") else "",
    # as the platform writes it when research kept that ("10,000 关注者"), else the digits and the unit
    "counter": f"{counter.get('display') or str(counter['value']) + counter['unit']} {counter['label']}" if counter else "",
    "slogan": "".join(p["text"] for p in cta["slogan"]),
    "prop": PROP.get(cta.get("prop", {}).get("kind"), {}).get(LANG, cta.get("prop", {}).get("kind", "")),
    "signature": W[(toy.get("signature") or {"move": "wave"})["move"]],
    "proof1": "「" + short(posts["pinned"]["title"]) + "」", "proof2": "「" + short(posts["retro"]["title"]) + "」",
    "publish": "、".join(PLATFORMS[p]["name"] for p in publish), "aspect": W[orient],
}
t = lambda d: (d if isinstance(d, str) else (d.get(LANG) or d.get("zh-Hant") or next(iter(d.values()), ""))).format(**FILL)  # noqa: E731
e = html.escape

# notes on the real frames (storyboard-notes.js, inlined): through the studio they land in
# build/comments.jsonl; opened as a file they are copied, to paste into the chat
NOTE_WORDS = {
    "zh-Hant": {"title": "意見", "hint": "撳任何一格，或者粗剪片（會停低）嘅畫面，喺要改嘅位置寫一句，寄出。", "hintFile": "撳任何一格或者粗剪片嘅畫面，寫低要改乜：意見會複製，貼返俾 agent。", "at": "{t} 秒 · 第 {n} 格", "send": "寄出", "copy": "複製", "cancel": "取消", "copied": "已複製，貼返俾 agent", "line": "[意見] 第 {n} 格（{t} 秒），位置 ({x}, {y})：", "none": "仲未有意見。", "open": "未處理", "done": "改咗", "frame": "預覽格", "animatic": "粗剪片"},
    "zh-Hans": {"title": "意见", "hint": "点任何一帧，或粗剪片（会暂停）的画面，在要改的位置写一句，发送。", "hintFile": "点任何一帧或粗剪片的画面，写下要改什么：意见会复制，贴给 agent。", "at": "{t} 秒 · 第 {n} 帧", "send": "发送", "copy": "复制", "cancel": "取消", "copied": "已复制，贴给 agent", "line": "[意见] 第 {n} 帧（{t} 秒），位置 ({x}, {y})：", "none": "还没有意见。", "open": "未处理", "done": "已改", "frame": "预览帧", "animatic": "粗剪片"},
    "en": {"title": "Notes", "hint": "Click a spot on any frame, or on the animatic (it pauses), write what to change, send.", "hintFile": "Click a spot on any frame or the animatic and write what to change: the note is copied, to paste to the agent.", "at": "{t} s · frame {n}", "send": "Send", "copy": "Copy", "cancel": "Cancel", "copied": "Copied: paste it to the agent", "line": "[note] frame {n} ({t} s), at ({x}, {y}): ", "none": "No notes yet.", "open": "open", "done": "done", "frame": "preview frame", "animatic": "animatic"},
}[LANG if LANG in ("zh-Hant", "zh-Hans", "en") else "zh-Hant"]
NOTES_JS = (Path(__file__).with_name("storyboard-notes.js")).read_text()
# frames a row, 1 to 4, kept in this browser (it may refuse: then the page's own default)
COLS_JS = """(() => {
  const box = document.querySelector(".frames"), bs = document.querySelectorAll(".cols button");
  const set = (c) => {
    box.style.setProperty("--cols", c);
    box.dataset.cols = c;
    bs.forEach((b) => b.classList.toggle("on", b.dataset.c === String(c)));
  };
  bs.forEach((b) => (b.onclick = () => { set(b.dataset.c); try { localStorage.setItem("storyboard-cols", b.dataset.c); } catch {} }));
  let c = "%d";
  try { c = localStorage.getItem("storyboard-cols") || c; } catch {}
  set(c);
})();"""

# ── the agent's own checks ──────────────────────────────────────────────────
checks = []
have = [n for _, n in frames if (SRC / f"{n:04d}.png").exists()]
checks.append((len(have) == len(frames), W["c_frames"].format(n=len(have), m=len(frames))))
toyfrom = FILM_JSON.get("toyFrom")
checks.append((bool(toyfrom), W["c_toy"].format(x=", ".join(toyfrom)) if toyfrom else W["c_notoy"]))
if counter:
    digits_ok = float(counter["value"]).is_integer() and counter["unit"] and len(counter["label"]) == 2
    checks.append((bool(digits_ok), W["c_counter" if digits_ok else "c_badcounter"].format(x=FILL["counter"])))
else:
    checks.append((True, W["c_nocounter"]))
# the length: what the segments come to, within what every publish platform takes
for p in publish:
    cap = PLATFORMS[p].get("maxDuration")
    if cap:
        checks.append((DUR <= cap, W["c_len" if DUR <= cap else "c_badlen"].format(x=f"{DUR:g}", p=PLATFORMS[p]["name"], m=cap)))
end = [n for _, n in frames if n >= (DUR - 1.5) * FPS and (SRC / f"{n:04d}.png").exists()]
if end:
    im = Image.open(SRC / f"{end[-1]:04d}.png").convert("RGB")
    box = content_box(im)
    s = SAFE[orient]
    over = past(box, [round(s[0] * im.width), round(s[1] * im.height), round(s[2] * im.width), round(s[3] * im.height)])
    checks.append((not over, W["c_end"] if not over else W["c_badend"].format(x=", ".join(f"{v}px {k}" for k, v in over.items()))))
# the pacing (engine/lib/pacing.py): the first hit, quiet stretches, the toy alone, reading time
if (FILM / "build/anim.json").exists():
    P = pacing.check(FILM)
    two, hook = f"{2 * P['bar']:g}", P["hook"]
    checks.append((hook is not None and hook <= 3, W["c_hook" if hook is not None and hook <= 3 else "c_nohook"].format(t=f"{hook:g}" if hook is not None else "–")))
    checks += [(False, W["c_dead"].format(a=f"{a:g}", b=f"{z:g}", n=f"{z - a:.1f}", m=two)) for a, z in P["dead"]] or [(True, W["c_nodead"].format(m=two))]
    checks += [(False, W["c_alone"].format(a=f"{a:g}", b=f"{z:g}", n=n)) for a, z, n in P["alone"]]
    if P["reads"] is None:
        checks.append((False, W["c_noreads"]))
    else:
        short = [r for r in P["reads"] if not r["ok"] and not r["toEnd"]]
        held = sum(1 for r in P["reads"] if not r["ok"] and r["toEnd"])
        checks += [(False, W["c_short"].format(x=r["text"], s=f"{r['shown']:g}", n=f"{r['need']:.1f}", more=f"{r['need'] - r['shown']:.1f}")) for r in short]
        if not short:
            checks.append((True, W["c_reads"].format(n=len(P["reads"])) + (W["c_readsend"].format(k=held) if held else "")))
    # the colours on the stage (engine/lib/colors.py; run.mjs palette draws them beside the creator's own)
    bad = colors.problems(colors.film_colours(FILM))
    for kind, r in bad:
        if kind == "toy":
            checks.append((False, W["c_toycolor"].format(x=r["key"], hex=r["hex"], p=round(r["share"] * 100), r=f"{r['contrast']:.1f}")))
        elif kind == "text":
            checks.append((False, W["c_textcolor"].format(n=r["objects"], hex=r["hex"], r=f"{r['contrast']:.1f}")))
        else:
            checks.append((False, W["c_confetti"].format(hex=r["hex"], r=f"{r['contrast']:.1f}")))
    if not bad:
        checks.append((True, W["c_colors"]))
    # against the films delivered before (engine/lib/ledger.py): four of the six at least should differ
    rows = ledger.compare(ledger.describe(FILM))
    alike = [(e, sm) for e, sm in rows if len(ledger.DIMS) - len(sm) < ledger.DIFFER]
    checks += [(False, W["c_ledger"].format(x=e["name"], d=len(ledger.DIMS) - len(sm), what=W["sep"].join(W["dims"][k] for k in sm))) for e, sm in alike]
    if not rows:
        checks.append((True, W["c_ledger_none"]))
    elif not alike:
        checks.append((True, W["c_ledger_ok"].format(n=len(rows), x=rows[0][0]["name"], d=len(ledger.DIMS) - len(rows[0][1]))))


# ── pictures inside the page ────────────────────────────────────────────────
def jpeg(path, width):
    im = Image.open(path).convert("RGB")
    width = min(width, im.width)
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# big enough for one frame a row (the preview's own size, at most 1280 px); the
# platforms' controls are the agent's check (safezone), not drawn over the frames
TW = 1280
COLS = 1  # a row, until the viewer picks 1–4

cards = []
for f, n in frames:
    p = SRC / f"{n:04d}.png"
    img = f'<div class="shot" style="aspect-ratio:{W_}/{H_}"><img src="{jpeg(p, TW)}" alt="{e(t(f["title"]))}"></div>' if p.exists() else f'<div class="shot none" style="aspect-ratio:{W_}/{H_}">{W["missing"]} #{n}</div>'
    cards.append(f'<figure data-t="{(n - 1) / FPS:.4f}" data-n="{n}">{img}<figcaption><code>{(n - 1) / FPS:.1f} s</code><h4>{e(t(f["title"]))}</h4><p>{e(t(f["what"]))}</p></figcaption></figure>')

hero_n = end[-1] if end else (have[-1] if have else None)
hero = f'<img class="hero" src="{jpeg(SRC / f"{hero_n:04d}.png", 720 if orient == "landscape" else 420)}" alt="">' if hero_n else ""

rows = "".join(f'<tr><td><b>{e(t(pt["label"]))}</b><br><code>{a:.1f}–{b:.1f} s</code></td><td>{e(t(pt.get("what", "")))}</td><td>{e(t(pt.get("uses", "")))}</td></tr>' for pt, a, b in PARTS)

# the beat grid: a cell a beat, bands for the parts, a red line on each hit
beats = round(DUR * BPM / 60)
bt = 60 / BPM
g = "".join(f'<div class="band b{k % 5}" style="grid-column:{round(a / bt) + 1}/{round(b / bt) + 1}">{e(t(pt["label"]))}</div>' for k, (pt, a, b) in enumerate(PARTS))
g += "".join(f'<div class="beat{" down" if i % 4 == 0 else ""}" style="grid-column:{i + 1}"><span>{f"{i * bt:g}" if i % 4 == 0 else ""}</span></div>' for i in range(beats))
g += "".join(f'<div class="hit{" low" if k % 2 else ""}" style="grid-column:{min(beats, round(ht / bt) + 1)}/span 4"><i></i><em>{ht:.1f}s {e(t(h["label"]))}</em></div>' for k, (h, ht) in enumerate(HITS))

anim = OUT / "animatic.mp4"
animatic = f'<section><h2>{W["animatic"]}</h2><video controls src="animatic.mp4" style="width:100%;max-width:{720 if orient == "landscape" else 360}px"></video></section>' if anim.exists() else ""
# the same picture under each sound (run.mjs listen): chosen by ear, which says more than "唔順"
SOUND_WORDS = {
    "zh-Hant": {"title": "聽聲揀版本", "note": "同一段畫面配唔同嘅聲，聽完話俾 agent 知揀邊個", "now": "而家用緊",
                "song": ("成首配樂", "合成嘅完整配樂：鼓、低音、和弦，跟住畫面轉段"), "band": ("成首配樂（真樂器）", "同一首編曲，換做真鼓、低音大提琴、弦樂、鋼琴、法國號"), "strings": ("弦樂鋼琴和弦底", "聲效喺面，下面墊真弦樂嘅長和弦，每次轉和弦鋼琴輕輕彈一下"), "bed": ("聲效加輕和弦底", "動作嘅聲效喺面，下面墊一層好輕嘅長和弦"),
                "fx": ("淨聲效", "冇音樂，淨係動作嘅聲"), "own": ("你自己首歌", "{file}，拉到片嘅速度，一下拍子對正第一下重拍")},
    "zh-Hans": {"title": "听声选版本", "note": "同一段画面配不同的声音，听完告诉 agent 选哪个", "now": "现在用的",
                "song": ("整首配乐", "合成的完整配乐：鼓、低音、和弦，跟着画面转段"), "band": ("整首配乐（真乐器）", "同一首编曲，换成真鼓、低音提琴、弦乐、钢琴、圆号"), "strings": ("弦乐钢琴和弦底", "音效在上面，下面垫真弦乐的长和弦，每次换和弦钢琴轻轻弹一下"), "bed": ("音效加轻和弦底", "动作的音效在上面，下面垫一层很轻的长和弦"),
                "fx": ("只有音效", "没有音乐，只有动作的声音"), "own": ("你自己的歌", "{file}，拉到片子的速度，一下拍子对准第一下重拍")},
    "en": {"title": "Choose the sound by ear", "note": "The same picture under each sound: tell the agent which one", "now": "now",
           "song": ("The whole score", "A synthesized score: drums, bass, chords, changing with the picture"), "band": ("The whole score, real instruments", "The same arrangement on real drums, double bass, strings, piano and horns"), "strings": ("Effects over strings and piano", "The effects on top of long chords on a real string section, a piano touching each change"), "bed": ("Effects over a bed", "The action's effects on top of one quiet layer of long chords"),
           "fx": ("Effects alone", "No music, only the sounds of what happens"), "own": ("Your own song", "{file}, at the film's tempo, a beat on the first hit")},
}[LANG if LANG in ("zh-Hant", "zh-Hans", "en") else "zh-Hant"]
heard = [k for k in ("song", "band", "bed", "strings", "fx", "own") if (OUT / f"sound-{k}.mp4").exists()]
now = FILM_JSON.get("sound", "song")
song_file = Path((FILM_JSON.get("music") or {}).get("file", "")).name
now_tag = f' <em>{SOUND_WORDS["now"]}</em>'
sounds = (f'<section><h2>{SOUND_WORDS["title"]}<small>{SOUND_WORDS["note"]}</small></h2><div class="sounds">'
          + "".join(f'<figure><video controls preload="metadata" src="sound-{k}.mp4"></video><figcaption><h4>{e(SOUND_WORDS[k][0])}'
                    f'{now_tag if k == now else ""}</h4><p>{e(SOUND_WORDS[k][1].format(file=song_file))}</p></figcaption></figure>' for k in heard)
          + "</div></section>") if heard else ""
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
.wrap {{ max-width:1240px; margin:0 auto; padding:28px 16px 64px; display:grid; grid-template-columns:minmax(0,1fr); gap:40px; }}
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
.frames {{ display:grid; grid-template-columns:repeat(var(--cols,{COLS}),minmax(0,1fr)); gap:18px; }}
@media (max-width:640px) {{ .frames {{ grid-template-columns:1fr; }} }}
{".frames[data-cols='1'] figure { width:100%; max-width:480px; margin:0 auto; }" if orient == "portrait" else ""}
.cols {{ display:flex; gap:6px; align-items:center; font-size:13px; color:var(--muted); margin:0 0 12px; }}
.cols button {{ background:var(--panel); color:var(--ink); border:1px solid var(--rule); border-radius:6px; min-width:34px; padding:3px 10px; font:inherit; cursor:pointer; }}
.cols button.on {{ background:#3d7bff; border-color:#3d7bff; }}
figure {{ margin:0; background:var(--panel); border-radius:8px; overflow:hidden; }}
.shot {{ position:relative; background:#000; }} .shot img {{ width:100%; height:100%; object-fit:cover; display:block; }}
.shot.none {{ display:flex; align-items:center; justify-content:center; color:var(--muted); }}
.sounds {{ display:grid; grid-template-columns:repeat(auto-fill,minmax({300 if orient == "landscape" else 200}px,1fr)); gap:18px; }}
.sounds video {{ width:100%; display:block; background:#000; }} .sounds em {{ font-style:normal; font-size:12px; color:#43b37a; margin-left:6px; }}
figcaption {{ padding:10px 12px 14px; }} figcaption h4 {{ margin:2px 0; font-size:16px; }} figcaption p {{ margin:0; color:var(--muted); font-size:14px; }}
ul.checks, ol.ask {{ background:var(--panel); border-radius:8px; padding:16px 16px 16px 36px; margin:0; }}
ul.checks li {{ margin:4px 0; }} ul.checks b {{ display:inline-block; min-width:56px; margin-right:8px; }} li.ok b {{ color:#43b37a; }} li.warn b {{ color:#ff9f0a; }}
ol.ask li {{ margin:6px 0; font-size:16px; }} .note {{ color:var(--muted); font-size:13px; }}
</style></head>
<body><div class="wrap">
<header>{hero}<div><h1>{e(title)}</h1><div class="specs">{"".join(f"<span>{e(s)}</span>" for s in specs)}</div></div></header>
<section><h2>{W["parts"]}</h2><table><tr><td><b>{W["time"]}</b></td><td><b>{W["what"]}</b></td><td><b>{W["uses"]}</b></td></tr>{rows}</table></section>
<section><h2>{W["grid"]}<small>{W["gridnote"]}</small></h2><div class="gridbox"><div class="grid">{g}</div></div></section>
<section><h2>{W["frames"]}<small>{W["framesnote"]}</small></h2><p class="cols">{W["cols"]}{"".join(f'<button data-c="{c}">{c}</button>' for c in range(1, 5))}</p><div class="frames">{"".join(cards)}</div></section>
{animatic}
{sounds}
<section><h2>{W["checks"]}</h2><ul class="checks">{checks_html}</ul></section>
<section><h2>{W["decide"]}</h2><ol class="ask">{decide}</ol><p class="note">{W["note"]}</p></section>
</div>
<script>{COLS_JS % COLS}</script>
<script>const NOTES ={json.dumps({"fps": FPS, "words": NOTE_WORDS}, ensure_ascii=False)};</script>
<script>{NOTES_JS}</script>
</body></html>
"""
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "index.html").write_text(page)
print(f"storyboard → {(OUT / 'index.html').relative_to(FILM)} ({len(have)}/{len(frames)} frames, {len(page) // 1024} KB)")
for ok, msg in checks:
    print(("  ✓ " if ok else "  ! ") + msg)
