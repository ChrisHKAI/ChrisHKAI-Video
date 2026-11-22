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

## Props and picture cards (`solidClashes`)

`clearance.mjs`, `check.mjs`, and `storyboard` also test all box props
(`box`, `roundBox`, `wallSlab`) and picture cards (`uiBox`) against every other
group across `build/anim.json` using oriented bounding-box SAT overlap
(`solidClashes` / `describeClashes`). Same-group parts (such as the four rails
and stiles of one gate door, or a mounted phone screen on its phone body) and
static rigid prop assemblies are skipped; any moving door, prop, or picture card
that pierces (`>= 8 mm`) or embeds (`>= 12 mm`) into another group is flagged as
a clash and blocks `--render`.

When fixing a prop or card clash:
- **Swinging doors or hinged panels**: widen the outer hinges or swing doors
  past 90° (e.g. `104°`), keep background cards parked behind the full swing
  arc, and delay card forward motion until the doors clear the corridor.
- **Layered picture cards**: stagger `z` depth or widen `x`/`yaw` spacing so
  adjacent cards stay clear of one another (`>= 10 mm`).

## End-card label overlaps and frame-edge crops

- **Label overlaps (`labelOverlaps`)**: `clearance.mjs`, `check.mjs`, and
  `storyboard` also check all end-card torn-paper labels (`label<i>_rim` /
  `label<i>_sheet`) against each other once settled (`>= 0.25 s`). Two slogan
  strips touching or overlapping by `>= 8 mm` block `--render`; widen their
  horizontal gap, reduce `em`, or use `cta.layout: "two-column"`.
- **Edge crops (`edgeCrops`)**: `clearance.mjs` and `check.mjs` project the
  settled toy (`hero`) and end-card prop (`cta_prop`) through the active
  camera frustum and warn (`!`) whenever either is partially cut off by a
  frame edge for `>= 0.25 s` (fast vertical jump entries/exits are ignored).
  Pull the camera back or switch the end card to `cta.layout: "two-column"`
  so nothing clips an edge mid-pan.
- **3D headline overlaps (`lineOverlaps`)**: checks distinct 3D `letter` lines
  on the same stage and flags transitions where an outgoing headline has not
  finished hiding before the incoming headline appears on the same spot.
- **Off-stage objects (`offStageHero`, `offStageObjects`)**: flags a visible
  toy or custom beat/CTA prop that never comes within range of the active
  camera—catching both missing `at(x, y, z)` (`x ≈ 0`) and accidental double
  `at(POS[0], POS[1], POS[2])` calls (`x ≈ 2 × stage`).
- **Unscaled picture cards & cyclic video wraps (`oversizedUiBoxes`,
  `movieWraps`)**: flags `kit.picture()` cards placed with raw `trs(...)`
  instead of `pic.at(...)`, and warns when a cyclic video card runs out of
  frames and wraps back to frame 1 while still visible on screen.
