"""The faces a film's lettering is cut in, by name, wherever the system keeps them (macOS keeps PingFang and
Lantinghei as on-demand assets under a hashed path), and the faces on this computer to choose from.

No face is the skill's own. Each film chooses its faces (references/beats.md, "Choosing the faces"): from the
creator's own covers, site and logo, the script (繁 or 简), how dense its characters are, how big they stand on
screen and what the film feels like. `run.mjs fonts` lists the faces here that have every character the film
shows; `run.mjs typesheet` sets the film's own lines in the candidates, at phone size, and reads them back.
The choice goes in film.json "type", with why:

  "type": {
    "heavy":   [{ "family": "PingFang TC", "style": "Semibold" }],  the words: the beats' lines, the end card
    "display": [{ "family": "Songti TC", "style": "Bold" }],        a beat's own line in the creator's own face
    "cjk":     [...],                                               the counter's unit and label
    "latin":   [...],                                               the counter's digits
    "why": "…"
  }

Only "heavy" (the role's name is the end card's first face, Lantinghei Heavy: it now means the film's words in
whatever face it chose) and "why" are needed; a role left out takes the words' face (display, cjk and latin all
follow heavy). Several faces in a role are tried in order (a Mac face first, a free one for another computer).
Font files a film brings sit in its fonts/ folder.

The skill's own pages (the story page's captions, the cover sheets) are not the film and take the "page" role.
"""
import glob
import os
from pathlib import Path

from fontTools.ttLib import TTCollection, TTFont

ROLES = ("heavy", "display", "cjk", "latin")
FOLLOW = {"display": "heavy", "cjk": "heavy", "latin": "heavy"}  # a role the film leaves out takes its words' face
# the skill's own pages: any face with Chinese that reads at caption size
PAGE = [("PingFang SC", "Semibold"), ("PingFang TC", "Semibold"), ("Hiragino Sans GB", "W6"), ("Microsoft YaHei", "Bold"),
        ("Source Han Sans SC", "Bold"), ("Source Han Sans CN", "Bold"), ("Noto Sans CJK SC", "Bold")]
# faces step 0 installed (scripts/doctor.mjs) sit in the skill's home
HOME_FONTS = str(Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video") / "fonts")
DIRS = [
    HOME_FONTS,
    "/System/Library/Fonts", "/System/Library/Fonts/Supplemental", "/Library/Fonts", str(Path.home() / "Library/Fonts"),
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font*/*/AssetData",
    # Windows: the system's faces, and the ones installed "for me only" (what a double-click does)
    str(Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"),
    str(Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData/Local") / "Microsoft/Windows/Fonts"),
    "/usr/share/fonts/**", "/usr/local/share/fonts/**", str(Path.home() / ".local/share/fonts/**"),
]
_faces = {}


def _scan(extra_dirs=()):
    """(family, style) → (path, index) for every face found."""
    key = tuple(extra_dirs)
    if key in _faces:
        return _faces[key]
    faces = {}
    for d in [*extra_dirs, *DIRS]:
        for path in sorted(glob.glob(f"{d}/*.tt[cf]", recursive=True) + glob.glob(f"{d}/*.otf", recursive=True)
                           + glob.glob(f"{d}/*.TT[CF]", recursive=True) + glob.glob(f"{d}/*.OTF", recursive=True)):
            try:
                fonts = TTCollection(path).fonts if path.lower().endswith(".ttc") else [TTFont(path, lazy=True)]
            except Exception:
                continue
            for i, f in enumerate(fonts):
                name = f["name"]
                fam = name.getDebugName(16) or name.getDebugName(1)
                sty = name.getDebugName(17) or name.getDebugName(2)
                faces.setdefault((fam, sty), (path, i))
    _faces[key] = faces
    return faces


def chosen(type_):
    """film.json "type" as {role: [(family, style), …]}: the roles it names (its "why" and other notes left out)."""
    return {role: [(p["family"], p["style"]) for p in v] for role, v in (type_ or {}).items() if role in ROLES and isinstance(v, list)}


def face(role, prefs=(), extra_dirs=(), chosen_roles=None):
    """The face for a role: (path, index, "family style"). prefs: the faces the film chose for it, else the role it
    follows (FOLLOW) from chosen_roles; "page" is the skill's own pages. No choice stops with what to do."""
    faces = _scan(extra_dirs)
    wanted = list(prefs)
    if not wanted and role != "page":
        follow = FOLLOW.get(role)
        wanted = list((chosen_roles or {}).get(follow, ())) if follow else []
    if role == "page":
        wanted = [*wanted, *PAGE]
    if not wanted:
        raise SystemExit(f'no face chosen for {role}: film.json "type" names the film\'s faces and why '
                         '(run.mjs fonts lists the faces here, run.mjs typesheet compares them; references/beats.md, "Choosing the faces")')
    for fam, sty in wanted:
        if (fam, sty) in faces:
            path, index = faces[(fam, sty)]
            return path, index, f"{fam} {sty}"
    raise SystemExit(f"no face for {role} on this computer: tried {', '.join(f'{a} {b}' for a, b in wanted)} "
                     "(run.mjs fonts lists the faces here)")


def covering(chars, extra_dirs=()):
    """Every face here that has all of chars: [(family, style, path, index)], by family."""
    need = {ord(c) for c in chars if not c.isspace()}
    out, files = [], {}
    for (fam, sty), (path, index) in sorted(_scan(extra_dirs).items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1]))):
        if not fam or fam.startswith(".") or "LastResort" in fam:  # the system's own interface and fallback faces
            continue
        try:
            if path not in files:
                files[path] = TTCollection(path).fonts if path.lower().endswith(".ttc") else [TTFont(path, lazy=True)]
            cmap = files[path][index].getBestCmap() or {}
        except Exception:
            continue
        if need <= cmap.keys():
            out.append((fam, sty, path, index))
    return out
