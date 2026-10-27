"""The film workspace for the Python side (see engine/lib/film.js): FILM names
the folder with film.json; scripts read and write inside it."""
import json
import os
from pathlib import Path

if not os.environ.get("FILM"):
    raise SystemExit("FILM is not set: point it at a film workspace (the folder that holds film.json)")
FILM = Path(os.environ["FILM"]).resolve()
SKILL = Path(__file__).resolve().parent.parent.parent
FILM_JSON = json.loads((FILM / "film.json").read_text())
# the story template: the skill's (templates/<name>) or the film's own copy (a path: "./template")
_template = FILM_JSON.get("template", "")
TEMPLATE = (FILM / _template).resolve() if _template.startswith(".") or "/" in _template or "\\" in _template else SKILL / "templates" / _template
