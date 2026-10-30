# The toy never goes through anything

A vinyl toy is solid. When it walks into a wall, stands inside a piece
that pushed out of it, or a label slides through it, the film looks broken
at once, however good the rest is. The first testers' films all did this:
their covers stood out in other places and further than isnail's, and the
toy kept to isnail's places.

## What keeps it clear

The template's toy keeps clear of both cover walls by itself (anim.js
`keepClear`). It works with any cover, with no tuning:
- Wherever the story puts the toy in front of a wall, it moves out along
  the wall's facing until every piece across its body is behind it. It
  makes way a moment before a piece pushes out, along a smooth curve
  round its corners.
- A wall rising under the toy tips it off forward.
- The piece under its feet carries it and is never in the way.
- The toy never steps off the front edge of the piece it stands on.

So most covers need nothing. The one case it cannot solve is a toy standing
on a piece that is shallower than a piece across its body (a box under a
deep title). There the toy would have to step off into the air.

## The check

```bash
FILM=<film> node <skill>/engine/scripts/clearance.mjs
```

It reads build/anim.json (from `run.mjs anim`, before Blender, in
seconds), places every object at every frame and tests points on each of the
toy's parts against every solid: the walls and their pieces, the counter,
the lettering, the end card's labels and prop, a beat's own objects. It
writes `build/clearance.json`. Each line is a moment:
- ✗ (`into`): a good share of the toy (15% or more), or deeper than a
  quarter of its height. The viewer sees it go through: fix it.
- ! (`touch`): a hand, an ear or a heel a few mm in. The eye forgives it
  in motion; look at a preview of that moment if it lasts.

check.mjs runs it too (a warning while previewing, a stop before the full
render), and the storyboard page lists every ✗ in plain words for the user.

## Fixing a ✗

The line names the moment, the solid (`piece_title`, `piece2_grid`,
`label1_sheet`, `stat_0_3`…) and the toy's part.

- **Standing on a role's piece under a deeper one** (act 3, `ledge`,
  `box9` or `box46` under the title): make the piece it stands on deeper.
  The rule is its depth ≥ the deeper piece's depth + the toy's depth. Or
  set its `at` (wall mm) where nothing is above it, or make the piece
  above shallower (film.json `story.wall`).
- **Act 2's pieces**: the toy moves out by itself. A ✗ there means a
  piece is so deep that the toy leaves the camera's frame. Make that piece
  shallower (`story.wall2`, big shapes 40–80 mm).
- **A beat** (your own or the skill's): the beat places the toy itself.
  Move its spot, or the object, apart by the toy's width
  (`build/hero.json` gives its parts). Or make the toy land on the object's
  top: a toy on top of a thing is never inside it.
- **The end card**: a label or the prop through the toy is a layout
  problem: film.json `cta` positions, the prop's `topAt`.

Then `run.mjs anim` and the check again. A ✗ the user has seen and wants
kept (a toy that dives into a picture on purpose) stays. Say so on the page,
and start the render with `-- --force`.
