"""Glyph outlines for the 3D lettering, flattened to polygons: the counter's
digits, unit and label (act 2) and the call to action's torn-paper labels.
Each role takes the face the film chose (film.json "type", engine/lib/fonts.py:
no face is the skill's own) and its characters from film.json (the beats' words,
and "glyphs": whatever a film's own template adds, by face). A film with no face
chosen, or a character its face does not have, stops the build here, before
anything renders.
Rings are in em units (y up, baseline 0); Blender extrudes them as curves.

usage: FILM=<film folder> python3 engine/scripts/glyphs.py   → build/glyphs.json
"""
import json
import math
import re
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from fonts import chosen, face  # noqa: E402

# what a film's own template or scene shows beyond these: film.json "glyphs" adds characters
# to a face ({"latin": ",", "heavy": "官方认证"} or shorthand string "20岁大四…")
def words(v):
    if isinstance(v, str):
        return "" if v.startswith("#") else v  # not a colour
    if isinstance(v, list):
        return "".join(words(x) for x in v)
    if isinstance(v, dict):
        return "".join(words(x) for x in v.values())
    return ""


UNSHOWN = {"beat", "why", "music"}


def merge_extra_glyphs(chars_by_role, extra):
    if not extra:
        return
    if isinstance(extra, str):
        for ch in extra:
            if ch.isspace():
                continue
            chars_by_role["heavy"] += ch
            chars_by_role["display"] += ch
            role = "latin" if ord(ch) < 0x2E80 else "cjk"
            if ch not in chars_by_role[role]:
                chars_by_role[role] += ch
        return
    if isinstance(extra, dict):
        for role, chars in extra.items():
            if role not in chars_by_role:
                raise SystemExit(f'film.json "glyphs": no face "{role}" (the faces: {", ".join(chars_by_role)})')
            chars_by_role[role] += str(chars)
        return
    raise SystemExit('film.json "glyphs": expected a string or an object mapping face roles to characters')


def harvest_js_glyphs(film_dir, film_json):
    """Harvest characters used by 3D lettering inside workspace-local custom beat and prop .js modules
    (kit.line, glyph.geo, reads[].text, and *TEXT/*STR/*LINE/*NAME/*LABEL/*HOOK constants) while ignoring
    comments and HTML-only storyboard descriptions so authors do not crash when editing beat copy."""
    rels = [s.get("beat") for s in (film_json.get("story") or {}).get("segments") or [] if isinstance(s.get("beat"), str)]
    prop_mod = ((film_json.get("cta") or {}).get("prop") or {}).get("module")
    if isinstance(prop_mod, str):
        rels.append(prop_mod)
    found = {"heavy": "", "display": "", "cjk": "", "latin": ""}
    str_lit = r"""(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`$\\])*)`)"""
    patterns = [
        re.compile(rf"""\b(?:kit\s*\.\s*)?(?:line|bannerLine)\s*\([^,]+,\s*{str_lit}"""),
        re.compile(rf"""\b(?:const|let|var)\s+[A-Za-z0-9_]*(?:TEXT|STR|LINE|TITLE|SUB|HOOK|NAME|LABEL|SLOGAN|WORD|STAMP|BADGE|UNIT)[A-Za-z0-9_]*\s*=\s*(?:String\s*\([^?]*\?\?\s*)?{str_lit}""", re.I),
        re.compile(rf"""\bopts\.[A-Za-z0-9_]+\s*\?\?\s*{str_lit}"""),
        re.compile(rf"""\[\s*\.\.\.\s*{str_lit}\s*\]"""),
        re.compile(rf"""\b(?:text|label|unit|prefix|fmt)\s*:\s*{str_lit}"""),
        re.compile(rf"""\+\s*{str_lit}"""),
    ]
    # Also harvest static prefix/suffix chunks inside template literals with `${...}` interpolations
    # (e.g. `fmt: (v) => \`${v.toFixed(1)}万\`` or `reads: [{ text: \`19.9万 ${COUNT_LABEL}\` }]`)
    tmpl_pat = re.compile(r"`((?:\\.|[^`\\])*)`")
    geo_pat = re.compile(r"""\bglyph\s*\.\s*(?:geo|adv|has)\s*\(\s*["'`](heavy|display|cjk|latin):([^"'`$\\]+)["'`]""")

    def _strip_js_interpolations(raw):
        out, i, n = [], 0, len(raw)
        while i < n:
            if raw[i] == "\\" and i + 1 < n:
                i += 2
                continue
            if raw[i:i + 2] == "${":
                depth = 1
                i += 2
                while i < n and depth > 0:
                    if raw[i] == "\\" and i + 1 < n:
                        i += 2
                        continue
                    if raw[i] == "{":
                        depth += 1
                    elif raw[i] == "}":
                        depth -= 1
                    i += 1
                continue
            out.append(raw[i])
            i += 1
        return "".join(out)

    def add_char(ch, role_hint=None):
        if ch.isspace() or ord(ch) >= 0x1F000 or 0xFE00 <= ord(ch) <= 0xFE0F:
            return
        if role_hint:
            if ch not in found[role_hint]:
                found[role_hint] += ch
            return
        for r in ("heavy", "display"):
            if ch not in found[r]:
                found[r] += ch
        script_role = "latin" if ord(ch) < 0x2E80 else "cjk"
        if ch not in found[script_role]:
            found[script_role] += ch

    for rel in dict.fromkeys(rels):
        p = Path(film_dir) / rel
        if not p.is_file() or p.suffix != ".js":
            continue
        src = p.read_text(encoding="utf-8", errors="ignore")
        # Strip block & line comments and the trailing HTML-only `storyboard: { ... }` block
        src = re.sub(r"/\*[\s\S]*?\*/", " ", src)
        src = re.sub(r"(?m)//.*$", " ", src)
        sb_idx = src.find("storyboard:")
        if sb_idx >= 0:
            src = src[:sb_idx]
        for pat in patterns:
            for m in pat.finditer(src):
                lit = next((g for g in m.groups() if g is not None), "")
                for ch in lit:
                    add_char(ch)
        for m in tmpl_pat.finditer(src):
            raw_t = m.group(1)
            if "${" in raw_t:
                for ch in _strip_js_interpolations(raw_t):
                    add_char(ch)
        for m in geo_pat.finditer(src):
            role_h, lit = m.group(1), m.group(2)
            for ch in lit:
                add_char(ch, role_h)
        if re.search(r"\b(?:readoutBadge|readout|formatCount)\s*\(", src):
            for ch in "0123456789,.+%":
                add_char(ch)
    return found


COS_NEEDLE = math.cos(math.radians(4))


def unspike(ring):
    """A ring without its needles: an outline that runs out and back on itself under 4 degrees wide (Lantinghei
    Heavy's 格 has one, 0.58 degrees), which a bevel turns into a long thin line shooting out of the letter; and
    without a point repeated. A needle is many points thin, so its tip goes again and again until none is left."""
    pts = [p for i, p in enumerate(ring) if i == 0 or p != ring[i - 1]]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    was = -1
    while len(pts) != was and len(pts) >= 3:
        was = len(pts)
        keep = []
        for i, b in enumerate(pts):
            a, c = pts[i - 1], pts[(i + 1) % len(pts)]
            v1, v2 = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
            l1, l2 = math.hypot(*v1), math.hypot(*v2)
            if l1 > 1e-9 and l2 > 1e-9 and (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2) < COS_NEEDLE:
                keep.append(b)
        pts = keep
    return pts


class Flatten(BasePen):
    def __init__(self, glyphset, steps=10):
        super().__init__(glyphset)
        self.rings, self.cur, self.steps = [], [], steps

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps
            a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))

    def _closePath(self):
        ring = unspike(self.cur)
        if len(ring) >= 3:
            self.rings.append(ring)
        self.cur = []

    _endPath = _closePath


def main():
    from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
    root = FILM
    f = FILM_JSON
    prefs = chosen(f.get("type"))
    if "heavy" not in prefs:
        raise SystemExit('film.json "type": choose the film\'s faces first, and say why (run.mjs fonts lists the faces '
                         'here that have every character it shows; run.mjs typesheet sets its lines in them at phone size '
                         'and reads them back; references/beats.md, "Choosing the faces")')
    if not str((f.get("type") or {}).get("why", "")).strip():
        raise SystemExit('film.json "type": say why these faces ("why": their covers use it, its strokes stay open at the '
                         'size the lines stand, …): the story page shows it')
    cta = f["cta"]
    chars_by_role = {
        "latin": "0123456789",  # the counter's digits
        "cjk": f["counter"]["unit"] + f["counter"]["label"],
        "heavy": "".join(p["text"] for p in [*cta["slogan"], cta["name"], cta.get("handle") or {"text": ""}]),
    }
    ctr = f["counter"]
    for ch in dict.fromkeys(str(ctr.get("display", "")) + str(ctr.get("unit", "")) + ctr["label"]):
        if ch.isspace():
            continue
        role = "latin" if ord(ch) < 0x2E80 else "cjk"
        if ch not in chars_by_role[role]:
            chars_by_role[role] += ch
        if ch not in chars_by_role["heavy"]:
            chars_by_role["heavy"] += ch
    beats = [s for s in f.get("story", {}).get("segments", []) if "beat" in s]
    chars_by_role["display"] = ""
    for s in beats:
        chars_by_role["heavy"] += words({k: v for k, v in s.items() if k not in UNSHOWN})
        chars_by_role["display"] += words({k: v for k, v in s.items() if k not in UNSHOWN})
    if beats:
        chars_by_role["heavy"] += "0123456789,.+%月日"
    chars_by_role["heavy"] += words((cta.get("prop") or {}).get("text", ""))
    chars_by_role["display"] += words((cta.get("prop") or {}).get("text", ""))
    for role, chs in harvest_js_glyphs(root, f).items():
        for ch in chs:
            if ch not in chars_by_role[role]:
                chars_by_role[role] += ch
    merge_extra_glyphs(chars_by_role, f.get("glyphs"))
    fonts = {}
    for role, chars in chars_by_role.items():
        path, index, name = face(role, prefs.get(role, ()), [str(FILM / "fonts")], prefs)
        fonts[role] = (path, index, chars)
        print(f"{role:6s} {name}  ({Path(path).name} #{index})")

    out = {}
    for key, (path, index, chars) in fonts.items():
        font = TTFont(path, fontNumber=index)
        upm = font["head"].unitsPerEm
        cmap = font.getBestCmap()
        gs = font.getGlyphSet()
        hmtx = font["hmtx"]
        missing = sorted({ch for ch in chars if ord(ch) not in cmap})
        if missing and key != "display":  # the creator's own face may lack a sign: the beat takes the heavy face's
            raise SystemExit(f"{key}: {Path(path).name} has no glyph for {' '.join(missing)}")
        for ch in sorted(set(chars) - set(missing)):
            name = cmap[ord(ch)]
            pen = Flatten(gs)
            gs[name].draw(pen)
            out[f"{key}:{ch}"] = {
                "advance": round(hmtx[name][0] / upm, 5),
                "rings": [[[round(x / upm, 5), round(y / upm, 5)] for x, y in r] for r in pen.rings],
            }
    (root / "build").mkdir(exist_ok=True)
    (root / "build/glyphs.json").write_text(json.dumps(out))
    print(len(out), "glyphs ->", root / "build/glyphs.json")


if __name__ == "__main__":
    main()
