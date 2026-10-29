# The end card's prop

The end card says what the creator wants people to come for. Its prop
carries that: an object made from what they promote, tied to who they are,
that arrives on the beat, carries the toy and moves while the closing line
appears. isnail promotes his 公众号 (WeChat account) and is called 蜗牛
(snail): his 公众号 mark drops in, becomes a snail's shell, the toy rides it,
and the snail crawls out the line 公众号变现 找蜗牛.

The idea comes from the user in step 2 (film.json `cta.prop.idea`, picked
with the closing line). You build it here, as code, for this creator.

## Its timing (the isnail-30 end card)

| time (s) | what happens | events |
| --- | --- | --- |
| 24.38 | the cut to the end card's stage | `cut` |
| 24.39–24.70 | the prop arrives (isnail's mark drops in spinning) | `logo` |
| 24.70–25.10 | it becomes itself (the snail grows under the mark, eyes pop) | `snail`, `eyes` |
| 24.83–25.15 | the toy falls onto it and lands | `ride` |
| 25.25–25.75 | the toy's signature move, riding it | `push2` |
| 25.90–27.90 | it travels along the floor path while the line slaps down letter by letter | `glide`, `letters` |
| 28.00 | the toy points at the camera; name and handle slap up | `final`, `name` |

## Ready-made, to fill in

When no idea of the creator's own comes up, or to show one quickly, the
built-in plinth takes the creator's colours and mark: film.json
`cta.prop`: `{ "kind": "plinth", "shape": "round" | "square" | "star",
"colors": { "plinth": "#…", "plinthTop": "#…" }, "logo": true }` (their mark
from `build/logo.json`, cut by the `@shape` recipe, on its front; a star
lies flat and the toy rides it). It drops in spinning on the cut, the toy
lands on it and it glides along the line. A prop that says who they are
(the snail) is still better: write it.

## Writing it

A prop is a module in the film's workspace, set in film.json
`cta.prop.module` (e.g. `"recipes/prop.js"`), that exports
`makeProp(ctx)` returning:

- `declare(add)`: its objects, each `add({ name, geo, mat, anim: true })`.
  `geo` is any shape the toy kits have (`references/toy.md`), or a `curve`
  extruded from outline rings (a logo or a product's silhouette:
  `@shape` cuts one from a picture into `build/logo.json`); `mat` is
  `{ type: "toy", key: <colour name> }` with the colours in film.json
  `cta.prop.colors`, or `{ type: "type", color, emit }` for a lit mark.
- `sample(put, t)`: every object's transform at film time t,
  `put(name, trs(position, quaternion, scale))`, in the end card's stage
  (`ctx.cta(x, y, z)` turns stage metres into the world). Hidden before it
  arrives: scale `ctx.lib.HIDDEN`.
- `topAt(t)`: where the toy's feet stand on it (world, metres).
- `cues(add)`: its sounds, `add(time, kind, options)`, with the synth's
  kinds (`whooshDown`, `land`, `squelch`, `boing`, `glide`, `pop`,
  `slide`, `ding`, `coins`, `glint`…).

`ctx` gives `film`, the story's events `E`, `cta`, the floor `path` ([x0,
x1] in stage metres, where the line appears), `readFilmJSON`, and `lib`
(lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3, trs, qId,
qEuler, apply, mulT, HIDDEN). Worked example:
`templates/isnail-30/props/snail.js` (the built-in `cta.prop.kind:
"snail"`).

## Check

Previews at 24.5, 24.9, 25.3, 26.5 and 29 s: the prop reads as what it
is, the toy stands on it (not floating, not sunk), the line is readable
beside it, and everything sits inside the safe box (`safezone`).
