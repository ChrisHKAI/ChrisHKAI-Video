"""What each delivered film is, kept across films (~/.chrishkai-video/ledger.json), so the next one does not come out
the same as the last.

Two kinds of thing are kept, and they are compared differently.

What a machine can tell apart, six things:
- the opening: which of the skill's it is (the page floating while the picture peels; the page standing up, turning
  right or left), or the film's own;
- the structure: its pieces in order, a ready-made one by its name, a beat written for the film as its own;
- the toy's signature move;
- the colours on screen: the lettering's, the papers' it is printed on and the confetti's, as the motion was built
  (build/anim.json), near colours counted as one;
- the sound: a ready-made one by its name, their own song by its file, a score written for the film as its own;
- the ending: a ready-made prop by its kind, a prop or an ending written for the film as its own.
A new film should differ from every earlier one in at least four of the six: three the same is a film again. That is
lemo-opuscar's rule for "not the demo again"; huashu-design keeps a ledger of what was shipped, for the same reason.
It guards against one template freezing isnail's film into every film.

What two films each made for themselves (an opening, a beat, a score, a prop) is not the same by its name, and not
different by it either: a file's name says nothing of what is on screen. The machine says which those are and leaves
them to a reader.

What only a reader can tell apart is kept in words: the story (its pitch, the person at its heart, the moment, the
image it leaves) and what the opening, each beat of the film's own, the ending and the score show. lines() gives
them to the story test (step 2) and the independent review (steps 4 and 5), which are asked whether this film is one
of them again.
"""
import json
import math
import os
from datetime import date
from pathlib import Path

DIMS = ("opening", "structure", "signature", "colours", "sound", "ending")
DIFFER = 4  # of the six, at least
DEFAULT = ["opening", "act2", "act3", "exit", "endCard"]  # isnail-30's story with no segments
OPENINGS = ("opening", "page-stand", "page-stand-left")
READY_SOUNDS = ("song", "bed", "band", "strings", "fx")
READY_PROPS = ("snail", "plinth")
OWN = "own"
NEAR = 0.06  # two colours closer than this (OKLab) are one: two reds, two golds; a blue and a violet are not
GREY = 0.04  # under this chroma a colour is a white, a cream, a black or a grey, which every film has

SKILL = Path(__file__).resolve().parents[2]


def _catalog():
    """The skill's own pieces and beats by name (beats/catalog.json): what is not one of them is a film's own."""
    try:
        anims = json.loads((SKILL / "beats/catalog.json").read_text())["animations"]
    except (OSError, ValueError, KeyError):
        anims = []
    names = {a["id"] for a in anims if a.get("id") != OWN} | set(DEFAULT)
    beats = {a["film"]["beat"] for a in anims if isinstance(a.get("film", {}).get("beat"), str) and "/" not in a["film"]["beat"]}
    return names, beats | {"page-stand", "count", "calendar", "phrase"}


READY, SKILL_BEATS = _catalog()


def path():
    return Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video") / "ledger.json"


def base():
    """The skill's own films (isnail, Kin, 铁柱), so even the first film on a new machine is compared with them."""
    return json.loads((Path(__file__).with_name("ledger-base.json")).read_text())


def mine():
    p = path()
    return json.loads(p.read_text()) if p.exists() else []


def read():
    """The films delivered so far: the skill's own, then this machine's, which win on the same id."""
    kept = mine()
    ids = {e.get("id") for e in kept}
    # the skill's own are marked: the user has not seen them, so a page names them as examples, not by creator
    return [{**e, "example": True} for e in base() if e.get("id") not in ids] + kept


# ── one film, as the ledger keeps it ────────────────────────────────────────

def _pieces(film, F):
    """The template's named pieces {name: (from, to)} in story seconds, for a stretch of the story given in seconds."""
    tpl = F.get("template") or "isnail-30"
    folder = (Path(film) / tpl) if tpl.startswith(".") or "/" in tpl else SKILL / "templates" / tpl
    try:
        S = json.loads((folder / "story.json").read_text())
    except (OSError, ValueError):
        return {}
    end = S.get("duration", 30)
    return {k: tuple(end if x == "end" else float(x) for x in v) for k, v in (S.get("pieces") or {}).items()}


def piece(s, pieces=None):
    """A segment's name: one of the skill's pieces or beats by its name, a beat written for the film as "own:<its
    file>" (a film's own copy of one of the skill's beats, under the same name, is still that beat)."""
    beat = s.get("beat")
    if beat:
        stem = Path(str(beat)).stem
        if stem == "page-stand":
            # the page standing up turns right (Kin's) or left (铁柱's): two openings
            return "page-stand-left" if s.get("turn") == "left" else "page-stand"
        return stem if stem in SKILL_BEATS else f"{OWN}:{stem}"
    st = s.get("story")
    if isinstance(st, str):
        return st
    # a stretch of the template's story in seconds: the piece most of it plays (the end card from the downbeat
    # before its cut, act 3 from its first climb), else the seconds
    span = [x for x in st]
    lo = float(span[0])
    hi = max((b for _, b in (pieces or {}).values()), default=lo) if span[1] == "end" else float(span[1])
    inside = {k: min(hi, b) - max(lo, a) for k, (a, b) in (pieces or {}).items()}
    best = max(inside, key=inside.get, default=None)
    if best and inside[best] > 0 and inside[best] >= 0.6 * (hi - lo):
        return best
    at = [f"{x:g}" if isinstance(x, (int, float)) else str(x) for x in st]
    return f"story {at[0]}–{at[1]}"


def _colours(film, F):
    """The colours on screen: the lettering's, the papers' it is printed on and the confetti's, from the motion as
    built (engine/lib/colors.py); with no motion yet, the confetti's."""
    conf = [c.upper() for c in (F.get("pop") or {}).get("confetti", []) if isinstance(c, str)]
    try:
        import colors  # numpy and build/anim.json: neither is there for a film in step 2
        fc = colors.film_colours(film)
        stage = fc["stage"].upper()
        seen = {r["hex"].upper() for r in fc["text"]} | {r["on"].upper() for r in fc["text"] if r["on"].upper() != stage}
        return sorted(seen | set(conf))
    except Exception:  # noqa: BLE001  whatever keeps the motion from being read, the confetti is still the film's
        return sorted(conf)


def _words(v):
    return v.strip() if isinstance(v, str) and v.strip() else None


def describe(film):
    """One film folder as the ledger keeps it, from film.json, toy.json and the motion as built."""
    film = Path(film)
    F = json.loads((film / "film.json").read_text())
    toy = json.loads((film / F["toy"]).read_text()) if F.get("toy") and (film / F["toy"]).exists() else {}
    story = F.get("story") or {}
    segs = story.get("segments")
    pieces = _pieces(film, F)
    names = [piece(s, pieces) for s in segs] if segs else list(DEFAULT)
    direction = story.get("direction") or {}
    heart = direction.get("heart") or {}
    op = direction.get("opening") or {}
    # the opening: one of the skill's when the story names it so (a film's own copy of it too), else its first piece
    opening = op.get("id") if op.get("id") in OPENINGS else names[0]
    cta = F.get("cta") or {}
    prop = cta.get("prop") or {}
    # the ending, as it is on screen: the template's end card with a prop written for the film, or a ready-made one
    # by its kind (an idea not built yet still plays the template's snail), or the film's own last beat
    if names[-1] != "endCard":
        ending = names[-1] if names[-1].startswith(OWN) else f"{OWN}:{names[-1]}"
    elif prop.get("module"):
        ending = f"{OWN}:{Path(prop['module']).stem}"
    elif prop.get("kind") == "plinth":
        ending = f"plinth:{prop['shape']}" if prop.get("shape") else "plinth"
    else:
        ending = "snail"
    sound = F.get("sound", "song")
    music = F.get("music") or {}
    if sound == "own":
        sound += ": " + Path(music.get("file", "")).name
    # in words, for a reader: what each part shows (the machine does not compare these)
    beats = []
    for s, name in zip(segs or [], names):
        if name.startswith(OWN) and name not in (opening, ending):
            does = next((b.get("action", {}).get("does") for b in direction.get("beats", []) if _words(s.get("why")) and b.get("action", {}).get("means") == s.get("why")), None)
            beats.append(" · ".join(x for x in (_words(does), _words(s.get("why")), _words(s.get("text"))) if x) or name)
    slogan = "".join(p.get("text", "") for p in cta.get("slogan", []) if isinstance(p, dict))
    return {
        "id": F.get("id") or film.name, "name": (F.get("profile") or {}).get("name") or F.get("id") or film.name,
        "film": str(film.resolve()), "date": date.today().isoformat(),
        "opening": opening, "structure": names,
        "signature": (toy.get("signature") or {}).get("move", "wave"),
        "colours": _colours(film, F),
        "sound": sound,
        "ending": ending,
        "story": {k: v for k, v in {
            "pitch": _words(direction.get("pitch")) or _words(direction.get("premise")),
            "who": _words(heart.get("who")), "why": _words(heart.get("why")), "moment": _words(heart.get("moment")),
            "image": _words(direction.get("image")),
        }.items() if v},
        "seen": {k: v for k, v in {
            "opening": _words(op.get("why")) or _words(op.get("pitch")),
            "beats": beats,
            "ending": " · ".join(x for x in (_words(prop.get("idea")), slogan) if x) or None,
            "sound": _words(music.get("idea")),
        }.items() if v},
    }


# ── two films ───────────────────────────────────────────────────────────────

def kind(dim, value):
    """What an entry says in one of the six, as it is compared: one of the skill's own by its name, or "own" for what
    a film made for itself. A ledger kept before this one named a film's own beat by its file, its score by the film's
    id and its prop by the first words of its idea: all of them the film's own."""
    if dim == "structure":
        return [kind("piece", n) for n in value or []]
    if dim == "colours":
        return sorted(value or [])
    v = str(value or "")
    if dim in ("opening", "piece"):
        if v in READY or v.startswith("story "):
            return v
        stem = Path(v.split(":", 1)[-1]).stem
        return stem if stem in SKILL_BEATS and not v.startswith(OWN) else OWN
    if dim == "sound":
        return v if v in READY_SOUNDS or v.startswith("own: ") else OWN
    if dim == "ending":
        return v if v.split(":")[0] in READY_PROPS else OWN
    return v


def _oklab(hex_):
    h = hex_.lstrip("#")
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))]
    l, m, s = (v ** (1 / 3) for v in (
        0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2],
        0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2],
        0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


def shared_colours(ca, cb):
    """The colours of one film that the other has too, near ones counted as one, whites, blacks and greys left out
    (every film has them): [(a, b)]."""
    def hued(cs):
        out = []
        for c in cs or []:
            try:
                lab = _oklab(c)
            except (ValueError, IndexError):
                continue
            if math.hypot(lab[1], lab[2]) >= GREY:
                out.append((c, lab))
        return out
    A, B = hued(ca), hued(cb)
    pairs = []
    for c, lab in A:
        near = min(B, key=lambda x: math.dist(lab, x[1]), default=None)
        if near and math.dist(lab, near[1]) < NEAR:
            pairs.append((c, near[0]))
    return pairs, min(len(A), len(B))


def same(a, b):
    """({what two films share of the six}, {what both made for themselves, which a name cannot compare})."""
    alike, own = [], []
    for d in DIMS:
        ka, kb = kind(d, a.get(d)), kind(d, b.get(d))
        if d == "colours":
            # half the hues of the film with fewer, and two at least
            pairs, fewer = shared_colours(ka, kb)
            if fewer and len(pairs) >= max(2, math.ceil(fewer / 2)):
                alike.append(d)
        elif d == "structure":
            if ka == kb and OWN not in ka:
                alike.append(d)
            elif OWN in ka and OWN in kb:
                own.append(d)
        elif ka == OWN and kb == OWN:
            own.append(d)
        elif ka == kb:
            alike.append(d)
    return alike, own


def compare(desc, ledger=None):
    """Each earlier film with what it shares with this one and what both made for themselves, the most alike first."""
    rows = [(e, *same(desc, e)) for e in (read() if ledger is None else ledger) if e.get("id") != desc["id"]]
    return sorted(rows, key=lambda r: -len(r[1]))


# ── in words, for a reader ──────────────────────────────────────────────────

def lines(e):
    """One film as a reader meets it: its story, then what its parts show. [] for a film kept with no words."""
    st, seen = e.get("story") or {}, e.get("seen") or {}
    out = []
    for label, v in (("the story", st.get("pitch")), ("at its heart", " · ".join(x for x in (st.get("who"), st.get("why")) if x)),
                     ("the moment", st.get("moment")), ("the image it leaves", st.get("image")), ("its opening", seen.get("opening")),
                     ("its beats", "; ".join(seen.get("beats") or [])), ("its ending", seen.get("ending")), ("its score", seen.get("sound"))):
        if v:
            out.append(f"{label}: {v}")
    return out


def stories(ledger=None, but=None):
    """[(entry, its lines)] of the films delivered before that say anything in words, for the story test and the
    review: the question a machine cannot answer is whether this film is one of them again."""
    return [(e, ls) for e in (read() if ledger is None else ledger) if e.get("id") != but for ls in [lines(e)] if ls]


# ── keeping ─────────────────────────────────────────────────────────────────

def add(desc):
    """Keep this film in the ledger (replacing its earlier entry)."""
    entries = [e for e in mine() if e.get("id") != desc["id"]] + [desc]
    path().parent.mkdir(parents=True, exist_ok=True)
    path().write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n")
    return len(entries)


def refresh():
    """Read this machine's films again as the ledger keeps them now (their stories in words, the colours on screen),
    each from its own folder, keeping its date; a film whose folder is gone stays as it was kept, and one of the
    skill's own (isnail, Kin, 铁柱) takes the skill's record of it. → [(entry, "read again" | "the skill's own" |
    "kept as it was: <why>")]"""
    theirs = {e["id"]: e for e in base()}
    out = []
    for e in mine():
        if e.get("id") in theirs:
            out.append(({**theirs[e["id"]], **{k: e[k] for k in ("film", "date") if k in e}}, "the skill's own"))
            continue
        folder = Path(e.get("film") or "")
        if not (folder / "film.json").exists():
            out.append((e, f"kept as it was: {folder or 'its folder'} is not there"))
            continue
        try:
            out.append(({**describe(folder), "date": e.get("date", date.today().isoformat())}, "read again"))
        except Exception as err:  # noqa: BLE001  a film that no longer reads is kept as it was
            out.append((e, f"kept as it was: {err}"))
    if out:
        path().write_text(json.dumps([e for e, _ in out], ensure_ascii=False, indent=1) + "\n")
    return out
