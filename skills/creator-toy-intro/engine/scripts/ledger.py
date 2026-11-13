"""The ledger of delivered films (engine/lib/ledger.py). It says how this film compares with each earlier one in the
six things a machine can tell apart (opening, structure, signature move, colours, sound, ending: four at least should
differ), which of them both films made for themselves and no name can compare, and then each earlier film in words
(its story, what its parts show), for a reader to say whether this film is one of them again.

usage: FILM=<film> python3 engine/scripts/ledger.py                       compare this film with the ledger (step 4);
                                                                          in step 2, before it has a story, the list
                                                                          (the openings and endings used so far, and
                                                                          each film's story in words)
       FILM=<film> python3 engine/scripts/ledger.py --add [--set sound=bed]  keep it, once delivered (step 5);
                                                                          --set corrects what film.json does not say
       python3 engine/scripts/ledger.py --list                            every film kept
       python3 engine/scripts/ledger.py --words [--but <id>]               the films before in words, as JSON (the story
                                                                          test's packet reads it)
       python3 engine/scripts/ledger.py --refresh                         read this machine's films again from their
                                                                          folders (their stories, the colours on
                                                                          screen), keeping their dates
"""
import json
import os
import sys
from pathlib import Path

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
import ledger  # noqa: E402

argv = sys.argv[1:]


def told(entries, but=None):
    """Each film in words, for a reader."""
    rows = ledger.stories(entries, but)
    if not rows:
        return
    print("\nthe films before, in words (the story test and the review read these: is this film one of them again?):")
    for e, ls in rows:
        print(f"  {e['name']} ({e['date']})")
        for line in ls:
            print(f"    {line}")
    bare = [e["name"] for e in entries if e.get("id") != but and not ledger.lines(e)]
    if bare:
        print(f"  kept with no words (before the ledger kept stories): {', '.join(bare)}; ledger -- --refresh reads them again where their folders are")


if "--words" in argv:
    but = argv[argv.index("--but") + 1] if "--but" in argv else None
    print(json.dumps([{"name": e["name"], "date": e["date"], **({"example": True} if e.get("example") else {}), "words": ls}
                      for e, ls in ledger.stories(but=but)], ensure_ascii=False, indent=1))
    raise SystemExit

if "--refresh" in argv:
    for e, how in ledger.refresh():
        print(f"  {e['name']}: {how}")
    print(ledger.path())
    raise SystemExit

# in step 2 the film has no story to compare yet: what the films before used is what the story needs to know
# (which way the page turned, which endings are taken, what stories are told: references/story-directions.md)
step = None
if os.environ.get("FILM") and (Path(os.environ["FILM"]) / "film.json").exists():
    step = json.loads((Path(os.environ["FILM"]) / "film.json").read_text()).get("step")
if "--list" in argv or (step == "research" and "--add" not in argv):
    entries = ledger.read()
    for e in entries:
        print(f"{e['date']}  {e['name']}: opening {e['opening']}, {len(e['structure'])} parts, {e['signature']}, sound {e['sound']}, ending {e['ending']}")
    told(entries)
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
    said = len(ledger.lines(desc))
    print(f"ledger: {desc['name']} kept ({n} films), {len(desc['colours'])} colours on screen, {said} lines of its story and parts in words → {ledger.path()}")
    if not desc.get("story"):
        print("  ! it says nothing of its story (film.json story.direction has no pitch or heart): the next film cannot be read against it")
    raise SystemExit

rows = ledger.compare(desc)
if not rows:
    print("ledger: no earlier film to compare with yet")
for e, alike, own in rows:
    differs = [d for d in ledger.DIMS if d not in alike and d not in own]
    # three of the six the same is the film again (four at least differ, counting what no name can compare as not the same)
    mark = "✓" if len(ledger.DIMS) - len(alike) >= ledger.DIFFER else "!"
    print(f"  {mark} {e['name']} ({e['date']}): "
          + (f"the same {', '.join(alike)}" if alike else "nothing the same")
          + (f"; differs in {', '.join(differs)}" if differs else "")
          + (f"; each film's own, not compared: {', '.join(own)}" if own else ""))
if any(own for _, _, own in rows):
    print("  (what two films each made for themselves is neither the same nor different by its name: a reader says, from the words below)")
told([e for e, _, _ in rows])
mine = ledger.lines(desc)
if mine:
    print(f"\nthis film, in words:\n" + "\n".join(f"    {line}" for line in mine))
