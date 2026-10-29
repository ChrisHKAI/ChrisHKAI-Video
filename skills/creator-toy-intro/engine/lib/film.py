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
# the toy lives in toy.json unless film.json names another file
FILM_JSON.setdefault("toy", "toy.json")
# the story template: the skill's (templates/<name>) or the film's own copy (a path: "./template";
# a film made before this took its path from the skill's templates folder, "../../../films/<id>/template":
# where the film has no such folder, that still works)
_template = FILM_JSON.get("template", "")
TEMPLATE = SKILL / "templates" / _template
if _template.startswith(".") or "/" in _template or "\\" in _template:
    _in_film, _before = (FILM / _template).resolve(), (SKILL / "templates" / _template).resolve()
    TEMPLATE = _in_film if _in_film.exists() or not _before.exists() else _before
