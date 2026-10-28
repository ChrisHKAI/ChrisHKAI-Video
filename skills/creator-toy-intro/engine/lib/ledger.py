"""What each delivered film looks like, kept across films (~/.chrishkai-video/ledger.json), so the next one
does not come out the same as the last.

Six things are compared:
- the opening;
- the structure;
- the toy's signature move;
- the colours;
- the sound;
- the ending.

A new film should differ from every earlier one in at least four of the six. That is lemo-opuscar's rule for
"not the demo again"; huashu-design keeps a ledger of what was shipped, for the same reason. It guards
against one template freezing isnail's film into every film.
"""
import json
import os
from datetime import date
from pathlib import Path

DIMS = ("opening", "structure", "signature", "colours", "sound", "ending")
DIFFER = 4  # of the six, at least
DEFAULT = ["opening", "act2", "act3", "exit", "endCard"]  # isnail-30's story with no segments


def path():
    return Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video") / "ledger.json"


def read():
    p = path()
    return json.loads(p.read_text()) if p.exists() else []


def piece(s):
    """A segment's name: its beat, its named story piece, or the story's seconds it plays."""
    if s.get("beat"):
        return s["beat"]
    st = s.get("story")
    return st if isinstance(st, str) else f"story {st[0]:g}–{st[1]:g}"


def describe(film):
    """The six for one film folder, from film.json and toy.json."""
    film = Path(film)
    F = json.loads((film / "film.json").read_text())
    toy = json.loads((film / F["toy"]).read_text()) if F.get("toy") and (film / F["toy"]).exists() else {}
    segs = (F.get("story") or {}).get("segments")
    names = [piece(s) for s in segs] if segs else DEFAULT
    prop = (F.get("cta") or {}).get("prop") or {}
    sound = F.get("sound", "song")
    if sound == "own":
        sound += ": " + Path((F.get("music") or {}).get("file", "")).name
    return {
        "id": F.get("id") or film.name, "name": (F.get("profile") or {}).get("name") or F.get("id") or film.name,
        "film": str(film.resolve()), "date": date.today().isoformat(),
        "opening": names[0], "structure": names,
        "signature": (toy.get("signature") or {}).get("move", "wave"),
        "colours": sorted(c.upper() for c in (F.get("pop") or {}).get("confetti", []) if isinstance(c, str)),
        "sound": sound,
        "ending": prop.get("kind") or (prop.get("idea") or "")[:30] or Path(prop.get("module", "")).stem or "snail",
    }


def same(a, b):
    """Which of the six two films share. Colours count as the same when half the confetti or more is shared."""
    out = []
    for d in DIMS:
        if d == "colours":
            ca, cb = set(a.get(d, [])), set(b.get(d, []))
            if ca and cb and len(ca & cb) >= max(2, min(len(ca), len(cb)) / 2):
                out.append(d)
        elif a.get(d) == b.get(d):
            out.append(d)
    return out


def compare(desc, ledger=None):
    """Each earlier film with what it shares with this one, the most alike first."""
    rows = [(e, same(desc, e)) for e in (read() if ledger is None else ledger) if e.get("id") != desc["id"]]
    return sorted(rows, key=lambda r: -len(r[1]))


def add(desc):
    """Keep this film in the ledger (replacing its earlier entry)."""
    entries = [e for e in read() if e.get("id") != desc["id"]] + [desc]
    path().parent.mkdir(parents=True, exist_ok=True)
    path().write_text(json.dumps(entries, ensure_ascii=False, indent=1) + "\n")
    return len(entries)
