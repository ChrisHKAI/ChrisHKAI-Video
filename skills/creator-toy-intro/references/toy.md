# Step 3: the toy

Build the creator as a smooth vinyl toy from the picture(s) the user
confirmed in step 2 (film.json `toyFrom`; never anything else), show its
turnaround beside them, and change it from the user's words until they say
it is right.

## The toy line

Every toy belongs to one line, whatever it is made of:

- smooth designer vinyl, about three heads tall, mitten hands; soft coat,
  no photo textures, no real fabric or hair strands (a toy, never a likeness
  pasted on);
- the finish of the isnail mascot is the bar: full, solid, polished;
- the face carries the likeness: hair shape, glasses, the smile, a mark the
  creator is known by; then two or three colours that say who it is;
- about 90 to 120 mm tall (`height`, metres); origin between the feet on
  the floor, +y up, the face towards +z, the toy's right (R) at −x.

## Three kits

Pick from the picture; parts of one kit may sit on another's toy.

| the picture shows | kit | how it is made |
| --- | --- | --- |
| a mascot, a logo, a drawn character | parts | toy.json lists rounded boxes, balls, arcs: the isnail mascot |
| a pet or another animal | pet | toy.json adds blobs (superellipsoids), tubes (tails, whiskers, eyelids), loops and plates (glasses), and markings painted on in soft blobs |
| a real person, a chibi drawing | sculpt | a sculpt script shapes signed distance fields (`engine/lib/sdf.py`), meshes them and paints them per vertex; `import-sculpt.py` brings them in |
| nothing that can be a character | — | offer two or three mascot ideas from the name or brand, and build the one picked |

Start from the nearest toy in `characters/` (the isnail mascot, a calico
cat, Tim and Steve Jobs in one simpler toy line, Chris as a sculpt):
copy its toy.json or its source and change it, rather than from nothing.

### toy.json (parts and pet kits)

```json
{ "name": "…", "kit": "pet", "height": 0.094, "center": [0, 0.042, 0],
  "colors": { "white": "#F6F2EA", "orange": "#E8903A" },
  "finish": { "white": "soft", "line": "gloss" },
  "joints": { "body": { "p": [0, 0.014, 0], "parent": null }, "head": { "p": [0, 0.038, 0.002], "parent": "body" } },
  "parts": [
    { "name": "head", "shape": "blob", "r": [0.032, 0.024, 0.025], "p": 2.6, "taper": -0.08, "pos": [0, 0.058, 0.001], "mat": "white", "group": "head",
      "paint": [{ "mat": "orange", "blobs": [{ "c": [0.015, 0.009, 0.009], "r": [0.018, 0.0125, 0.021] }], "soft": 0.035, "noise": 0.22 }] }
  ] }
```

Shapes: `roundBox` (size, radius), `ellipsoid` (r), `arc` (radius, tube,
arc), `blob` (r, p: 2 round … 3 boxy, taper < 0 narrows the top), `tube` (pts,
radii: through the points, round ends), `prism` (sides, r, depth, bevel),
`loop` (pts, radii: a closed tube; rims, collars), `plate` (w, d, t, corner,
bevel, or an `outline` of (x, z) points; lenses, watch faces). `pos` and
`rot` (Euler XYZ) or `q` (a quaternion [x, y, z, w]) place a part; paint
blobs sit in the part's own space (before its `pos` and turn). Finishes:
`vinyl` (default), `soft` (light under the surface: white, skin), `matte`,
`gloss` (eyes, lines, noses, frames), `satin`, `metal`, `glass` (clear
lenses), `blackGlass` (a watch face), `emit` (a glint), `lens` (glowing
lenses). A joint may carry `t` and `s`, a nudge and a scale kept for good
(the Tim line's big head).

### The sculpt kit

The sculpt script writes a folder: a manifest (`units`, `facing` "-y" for
Blender's axes, `height_mm`, `parts` [{ name, file, bone, material,
frame? }], `bones` [{ name, head, tail, parent }], `variants`) and one `.npz`
per part (verts in metres, faces, normals, `color` sRGB 0–1, `rough`), plus
an `eye.png` painted over the eye pieces if the eyes are painted. Name the
bones `hips`, `spine`, `head`, `brow.R/L`, `upper_arm.R/L`, `forearm.R/L`,
`hand.R/L`, `thigh.R/L`, `foot.R/L` and the rig contract follows by itself
(`--map` for others). Materials become finishes: `skin`, `lens` and `pad` →
glass, `eye`, `frame` and `teeth` → gloss, the rest vinyl.

```bash
FILM=<film> python3 <skill>/engine/scripts/import-sculpt.py <sculpt folder> --manifest <name>.json
```

Mesh at about 0.4 mm voxels while shaping (seconds), 0.25 mm for the film.

## The rig contract

The story poses these joints; a toy has the ones it needs:
`body`; `head` (`parent` body); `armR`, `armL` (body; a pet's front legs);
`legR`, `legL` (no parent; a pet's hind legs); optional `ears` (head; both
ears), `finger` / `fingerL` (on the arm: grows when the toy points). Any
other joint (a tail) keeps its rest pose under its parent. Parts whose name
starts with `sleeve` stretch when an arm reaches.

## The checkpoint

```bash
FILM=<film> node <skill>/engine/run.mjs hero lookdev
```

renders five views (front, three-quarter pointing, side, back cheering, the
face), framed by the toy's height, and `build/lookdev/compare.jpg`: the
confirmed picture(s) beside them. Look at it first yourself: likeness,
proportions, nothing floating or sunk, the colours. Then show the user and
change it from their words, a round at a time (about a minute each). Once
they say it is right, keep a copy for the next film:
`~/.chrishkai-video/characters/<name>/` (toy.json, and `build/toy/` for a
sculpt), and move film.json `step` on to `story`.
