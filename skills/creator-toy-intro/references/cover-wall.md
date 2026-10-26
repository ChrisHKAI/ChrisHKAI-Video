# The cover walls

The two proof posts' covers stand up as walls and come apart: their words,
numbers and pictures push out as 3D pieces. Every cover is different, so
you write a recipe for each one: a short Python script that cuts that
cover into pieces. This is the craft of the film; take the time.

Worked example: `example/isnail/recipes/cover-pinned.py` (act 2) and
`cover-retro.py` (act 3), on `engine/lib/cutlib.py`.

## What a recipe does

1. Opens the cover (`assets/<cover>`) and works at its own pixels (or a
   fixed scale of them: write coordinates in one place, convert with a
   helper like `P(x, y)`).
2. Classifies colour with `hsv(img)`: masks like `RED = (hue < .05 | hue >
   .93) & sat > .45`, `DARK = val < .33`, `LIGHT = val > .8 & sat < .25`.
   Pick thresholds by sampling the cover's own colours.
3. Cuts pieces, each `{ name, kind, rings }` with rings in cover UV
   (0..1, v down):
   - a box: a hand-placed face (four or more corners, clockwise from top
     left), pushed out as one solid: `uv(points, W, H)`;
   - ink: a colour mask inside a region, traced: `rings(mask & region(...),
     W, H, min_area=…, tol=…, close=…, hole=…, fill=…)`. Lettering goes
     one character or one word per piece, so it can arrive on the beat;
   - an ink piece may ride on a box (`"kind": "ink", "of": "<box>"`): it
     stands 5 mm further out than its box.
4. Where a piece leaves a hole that should not show (a drawing that becomes
   the toy, a chip the app laid over the cover), patch the paper with
   `fill(img, polygon, detail_box, protect=…)` (smooth fill plus the
   paper's own grain) or `clone(img, from_xy, box)`, and save that as the
   wall's texture.
5. Writes `build/cover.json` (act 3) or `build/cover2.json` (act 2):
   `{ w, h, src, pieces }`, and a check image with every outline drawn
   (`check_image`). Look at it: every outline on its letter or shape, no
   piece swallowing its neighbour, nothing missing.

List the recipe in film.json `recipes`, in order.

## Act 2: the pinned post's cover

Any number of pieces; film.json `story.wall2` gives each its moment and
depth: `{ "<piece>": [push-out time s, depth mm] }`. The pinned cover stands
up at 6.75 s and pieces push out one after another, on eighth notes,
until about 8.4 s: the ground first (a stage, a floor), then the main
picture's parts, then the title a character at a time, the props last.
Depth says how far out a piece stands: big shapes 40–80 mm, lettering
30–50, props 14–30.

## Act 3: the second post's cover

The story gives the second wall parts to play, by role. Name the pieces
for the roles in film.json `story.wall`:

| role | what it does | the piece |
| --- | --- | --- |
| `ledge` | rises at 12.35 s; the toy lands on it | a low, wide piece: a strip, a tag, a caption bar (`at`: where it lands, wall mm) |
| `title` | flies out and slams back at 13.0 s; the camera shakes | the headline |
| `box9` | the first proof: rises in `clunks` steps from 14.0 s (0.175 s each, 1 to 9: one a unit of a small number, 9个月 → 9), and the toy climbs it | the first number or claim on the cover (`at`: where it stands on it) |
| `box46` | the second proof: slides out over 16–17.2 s; the toy climbs it | the second (`at`) |
| `box7` | the third: punches out at 18.5 s; the toy points at it from the second (`aim`: wall mm, else the middle of its face) | the biggest number, the payoff |
| `arrow` | an accent at 19.0 s | an arrow, a mark, an underline |

Each role is `{ "piece": "<name in cover.json>", "depth": mm, … }`. A
cover with fewer elements still needs all six: make them from what is
there (a caption strip as the ledge, a subject cut out of a photo as a
proof, a word of the title as the arrow). The words on a box come with it
as its ink piece.

The toy leaves at the end of act 3 by becoming the drawing of itself on
this cover when there is one (`references/exits.md`).

## Check before rendering

`node engine/run.mjs recipes` then look at `build/cover-check.png` and
`build/cover2-check.png`; then a few previews of 7.6–8.4 s and 13–20 s.
