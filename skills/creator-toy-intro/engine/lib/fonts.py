"""Finds the faces for each lettering role by name, wherever the system keeps
them (macOS keeps PingFang and Lantinghei as on-demand assets under a hashed
path), and falls back to free faces where a Mac face is missing.

Roles (isnail's type design):
  latin  the counter's digits          Helvetica Neue Bold → Arial Bold
  cjk    the counter's unit and label  PingFang SC/TC Semibold → Source Han Sans Bold
  heavy  the torn-paper labels         Lantinghei SC/TC Heavy → Source Han Sans Heavy
film.json "type": { role: [{ "family": …, "style": … }, …] } puts the film's own
choices in front. Font files a film brings sit in its fonts/ folder.
"""
import glob
import os
from pathlib import Path

from fontTools.ttLib import TTCollection, TTFont

ROLES = {
    "latin": {"*": [("Helvetica Neue", "Bold"), ("Arial", "Bold")]},
    "cjk": {
        "zh-Hans": [("PingFang SC", "Semibold"), ("Source Han Sans CN", "Bold"), ("Source Han Sans SC", "Bold")],
        "zh-Hant": [("PingFang TC", "Semibold"), ("PingFang HK", "Semibold"), ("Source Han Sans HK", "Bold"), ("Source Han Sans TC", "Bold")],
    },
    "heavy": {
        "zh-Hans": [("Lantinghei SC", "Heavy"), ("Source Han Sans CN", "Heavy"), ("Source Han Sans SC", "Heavy")],
        "zh-Hant": [("Lantinghei TC", "Heavy"), ("Source Han Sans HK", "Heavy"), ("Source Han Sans TC", "Heavy")],
    },
}
# faces step 0 installed (scripts/doctor.mjs) sit in the skill's home
HOME_FONTS = str(Path(os.environ.get("CHRISHKAI_VIDEO_HOME") or Path.home() / ".chrishkai-video") / "fonts")
DIRS = [
    HOME_FONTS,
    "/System/Library/Fonts", "/System/Library/Fonts/Supplemental", "/Library/Fonts", str(Path.home() / "Library/Fonts"),
    "/System/Library/AssetsV2/com_apple_MobileAsset_Font*/*/AssetData",
    "C:/Windows/Fonts", "/usr/share/fonts/**", "/usr/local/share/fonts/**", str(Path.home() / ".local/share/fonts/**"),
]
_faces = None


def _scan(extra_dirs):
    """(family, style) → (path, index) for every face found."""
    faces = {}
    for d in [*extra_dirs, *DIRS]:
        for path in sorted(glob.glob(f"{d}/*.tt[cf]", recursive=True) + glob.glob(f"{d}/*.otf", recursive=True)):
            try:
                fonts = TTCollection(path).fonts if path.lower().endswith(".ttc") else [TTFont(path, lazy=True)]
            except Exception:
                continue
            for i, f in enumerate(fonts):
                name = f["name"]
                fam = name.getDebugName(16) or name.getDebugName(1)
                sty = name.getDebugName(17) or name.getDebugName(2)
                faces.setdefault((fam, sty), (path, i))
    return faces


def face(role, language, prefs=(), extra_dirs=()):
    """The first face found for a role: (path, index, "family style")."""
    global _faces
    if _faces is None:
        _faces = _scan(extra_dirs)
    table = ROLES[role]
    wanted = [*prefs, *table.get(language, table.get("zh-Hans", table.get("*")))]
    for fam, sty in wanted:
        if (fam, sty) in _faces:
            path, index = _faces[(fam, sty)]
            return path, index, f"{fam} {sty}"
    raise SystemExit(f"no face for {role} ({language}): tried {', '.join(f'{a} {b}' for a, b in wanted)}")
