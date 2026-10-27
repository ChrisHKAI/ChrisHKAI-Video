# Beats: a film as long as what it says

A film is a list of segments, one after another, in film.json
`story.segments`: pieces of the template's own story, and beats with clocks
of their own. The film is as long as its segments together; 30 s is only
the template's own length. One beat per point the user keeps, each as long
as its animation needs, on whole bars.

```json
"story": {
  "segments": [
    { "story": [0, 20.383333333333333] },
    { "beat": "phrase", "bars": 3, "text": "马斯克得不到的男人" },
    { "story": [24.383333333333333, "end"] }
  ]
}
```

- `{ "story": [from, to] }` plays that piece of the template's story (story
  seconds; `"end"` for its last), on the story's own clock: its moves,
  camera, sounds and music, as the template tuned them. The template names
  its pieces (story.json `pieces`): isnail-30 has `opening` (0–6: the page,
  the sticker peel, the pop), `act2` (6–12: the pinned cover as a wall, the
  counter), `act3` (12–20.383: the second cover as a wall, the climb),
  `exit` (20.383–24.383) and `endCard` (24.383–end), so `{ "story":
  "endCard" }` will do. When a beat comes before the end card, set film.json
  `story.exit` to `"jump"`: the toy then drops onto the prop from above, as
  it would after a beat's leap.
- `{ "beat": <name or path>, "bars": n, … }` plays a beat for n bars (or
  `"len"` seconds). A name is one of the skill's (`beats/<name>.js`); a path
  is the film's own (`"beats/calendar.js"`, in the film). The rest of the
  entry is the beat's own options (`text`, `color`…), as its file says.
- Without `segments` the film is the template's story, whole.

`run.mjs anim` sets film.json `format.duration` to what the segments come
to, so `render`, `finish` and `qa` agree; the storyboard page shows the
length and checks it against each publish platform's longest
(`platforms.json` `maxDuration`: X takes 140 s).

## The skill's beats

Each is a worked answer to "how does this become an animation"; take one
when it fits the point, change it or write the film's own when it doesn't.
Their options are at the top of each file.

| beat | for | entry |
| --- | --- | --- |
| `page-stand` | an opening: the page fills the frame like a screen, turns and parts into slabs, the toy puffs out of the picture on the 2.0 s downbeat (Kin's; the story's own `opening` is the other) | `{ "beat": "page-stand", "bars": 2, "turn": "right" }` |
| `count` | a number: counts up in 3D as the platform writes it (`10,000`, `1.5万`, `380+`), a label of any length, locks on a downbeat | `{ "beat": "count", "bars": 3, "to": 10000, "label": "关注者" }` |
| `calendar` | a span of time, from the idea alone: a flip calendar runs from one day to another, a count beside it, a stamp on the lock | `{ "beat": "calendar", "bars": 4, "from": "2026-07-10", "to": "2026-10-24", "count": { "to": 10000, "label": "关注者" }, "stamp": "万粉" }` |
| `phrase` | the user's own words: a line rises a letter at a time | `{ "beat": "phrase", "bars": 3, "text": "马斯克得不到的男人" }` |

Not here yet (the cgnot996 test made them for its film): chat bubbles from
a real chat (Kin's), an envelope that opens on an invitation, a post that
drops in like a notification, and a cover wall as a beat of its own.

## On the beat

At 120 BPM a bar is 2 s. Every hit stays on a downbeat when a beat lasts
whole bars and a piece of the story plays a whole number of bars from where
the story has it (`anim` warns otherwise). A piece may start off the bar
when the story's own cut does: isnail's end card starts at 24.383 s, so the
piece before it ends at 20.383 s, two bars earlier, and a 3-bar beat
between them keeps the end card's hits where they were.

While a beat plays, the story stands still where it was cut away from; its
places are far from the beat's stage and out of its shots. Every join is a
hard cut, in the picture and the music.

## Writing a beat

A beat is a module that exports `makeBeat(ctx)`; worked example:
`beats/phrase.js` (a line of big 3D type rises a letter at a time, the toy
drops in, cheers and leaps out). Start from it. Ask first, per point: how
does this material, or this idea, become an animation that shows its point?
The beat is that answer as code.

`ctx` gives:

| field | what |
| --- | --- |
| `opts` | the beat's entry in film.json (`text`, `color`, anything it reads) |
| `len`, `bar`, `beat` | its length, a bar and a beat (s) |
| `stage`, `at(x, y, z)` | its own place, 50 m from everything else (past the camera's 40 m clip), and stage metres → world |
| `fov`, `aspect` | the lens (vertical degrees) and the frame's width / height |
| `glyph` | `adv(key)`, `geo(key, em, depth, bevel)`, `has(key)`: the lettering from the glyph step (`heavy:<char>`: every word in the entry, the digits, `,.+%` and `月日` are cut in the end card's face) |
| `accent`, `pop`, `page` | the theme's accent colour; the confetti's colours (film.json `pop`); the page (`image`, `w`, `h`, `panels` in UI px, `avatar` `{ c, d }`, `slab`) |
| `kit` | `engine/lib/beatkit.js`: `stand(spot)`, `dropIn`, `cheer`, `leapOut`, `squash`, `landSquash`, `crouch`, `hop`, `CENTER`; `cameraFrom(keys, …)`; `formatCount(v, { decimals, sep, unit })`, `readout(…)` (text that changes as it counts, one object per character a place shows); `confetti(…)`; `HIDDEN` |
| `signature` | the toy's own move (toy.json `signature`) on a pose |
| `math`, `quat`, `mulberry32`, `readFilmJSON` | the engine's helpers |

It returns, every time in the beat's own seconds `g` (0 to `len`):

| field | what |
| --- | --- |
| `declare(add)` | its objects, as the template's (`{ name, geo, mat, anim: true }`); names get the beat's prefix. Its floor too (`mat: { type: "stage" }`) |
| `sample(put, g, putColor)` | every object's transform at g; g runs over the whole film, so hide them outside the beat (scale `kit.HIDDEN`) |
| `pose(g)` | the toy's pose (`kit.stand(spot)` and the moves), or null when the toy is not in it |
| `camera` | `g → { tr, fov, focus, fstop }`: `kit.cameraFrom([{ t, target, dist, elev, az, fstop? }…], { fov, aspect, shakes })` |
| `light(g)` | optional: `{ p, energy, color }`, the one moving light |
| `cues(add)` | its sounds, `add(g, kind, options)`, the synth's kinds (`whooshDown`, `pomf`, `push` with a `note`, `lock`, `sparkle`, `boing`, `whooshUp`, `ding`, `slam`…) |
| `music` | `{ groove: "light" \| "normal" \| "half" \| "double" \| "none", chords: ["Em", "C", "G", "D"], hits: [g…] }`: the score's bed under it, a big kick on each hit |
| `cuts` | optional: its own hard cuts `[g…]` (a beat in two shots) |
| `storyboard` | `{ part: { label, what, uses }, frames: [{ at, title, what }], hits: [{ at, label }] }`, each text per language (`zh-Hant`, `zh-Hans`, `en`) |

A beat usually opens with the toy dropping in from above (the cut from
the last segment's leap) and ends with `kit.leapOut`, so the joins read as
one toy going from stage to stage. The first and last segments are usually
the template's opening and end card.

## Check

`run.mjs glyphs anim sound`, then `storyboard -- --frames`: the beat's
frames are in the list; render them as previews with the rest
(`references/storyboard.md`). Look at each: the toy on the beat's floor
(not floating, not sunk), its text readable and inside the safe box, the
camera on it from the first frame of the beat to the last.
