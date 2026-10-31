"""The ledger of delivered films (engine/lib/ledger.py): how this film compares with each earlier one in its
opening, structure, signature move, colours, sound and ending. It should differ in at least four of the six.

usage: FILM=<film> python3 engine/scripts/ledger.py                       compare this film with the ledger (step 4);
                                                                          in step 2, before it has a story, the list
                                                                          (the openings and endings used so far)
       FILM=<film> python3 engine/scripts/ledger.py --add [--set sound=bed]  keep it, once delivered (step 5);
                                                                          --set corrects what film.json does not say
       python3 engine/scripts/ledger.py --list                            every film kept
"""
import json
import os
import sys
from pathlib import Path

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
import ledger  # noqa: E402

argv = sys.argv[1:]
# in step 2 the film has no story to compare yet: what the films before used is what the story needs to know
# (which way the page turned, which endings are taken: references/story-directions.md)
step = None
if os.environ.get("FILM") and (Path(os.environ["FILM"]) / "film.json").exists():
    step = json.loads((Path(os.environ["FILM"]) / "film.json").read_text()).get("step")
if "--list" in argv or (step == "research" and "--add" not in argv):
    for e in ledger.read():
        print(f"{e['date']}  {e['name']}: opening {e['opening']}, {len(e['structure'])} parts, {e['signature']}, sound {e['sound']}, ending {e['ending']}")
    print(ledger.path())
    raise SystemExit

from film import FILM  # noqa: E402

desc = ledger.describe(FILM)
for kv in [argv[i + 1] for i, a in enumerate(argv) if a == "--set"]:
    k, v = kv.split("=", 1)
    if k not in ledger.DIMS:
        raise SystemExit(f"--set takes one of {', '.join(ledger.DIMS)}")
    desc[k] = json.loads(v) if v.startswith("[") else v
if "--add" in argv:
    n = ledger.add(desc)
    print(f"ledger: {desc['name']} kept ({n} films) → {ledger.path()}")
    raise SystemExit

rows = ledger.compare(desc)
if not rows:
    print("ledger: no earlier film to compare with yet")
for e, s in rows:
    differ = len(ledger.DIMS) - len(s)
    mark = "✓" if differ >= ledger.DIFFER else "!"
    print(f"  {mark} {e['name']} ({e['date']}): differs in {differ} of 6" + (f"; the same {', '.join(s)}" if s else ""))
