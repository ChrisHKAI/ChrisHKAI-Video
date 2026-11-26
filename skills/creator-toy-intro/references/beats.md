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

Each is a worked answer to "how does this become an animation" for someone
else's material: parts and starting points, not a menu. Every point is
designed from its own material first (references/research.md, "The story
first"); take one of these whole only when it is the best way to show that
point, change it, or start the film's own from it. Their options are at the
top of each file.

| beat | for | entry |
| --- | --- | --- |
| `page-stand` | an opening: the page fills the frame like a screen, turns and parts into slabs, the toy puffs out of the picture on the 2.0 s downbeat (the other opening is the story's own `opening`: the page floats while the picture peels off like a sticker) | `{ "beat": "page-stand", "bars": 2, "turn": "right" }` |
| `count` | a number: counts up in 3D as the platform writes it (`10,000`, `1.5万`, `380+`), a label of any length, locks on a downbeat. `to` written as the platform writes it (`"31.9万"`) keeps its decimals, separator and unit; a bare number needs them said (`"to": 31.9, "unit": "万", "decimals": 1`), or its .9 is dropped | `{ "beat": "count", "bars": 3, "to": "31.9万", "label": "查看" }` |
| `calendar` | a span of time, from the idea alone: a flip calendar runs from one day to another, a count beside it, a stamp on the lock. A count beside a date is a claim: `count.keys` are their own dated milestones, each read on its day (without them a paused frame may show a number they never had) | `{ "beat": "calendar", "bars": 4, "from": "2026-07-10", "to": "2026-10-24", "count": { "to": 10000, "label": "关注者", "keys": [["2026-09-11", 1000], ["2026-10-17", 8500]] }, "stamp": "万粉" }` |
| `phrase` | the user's own words: a line rises a letter at a time, facing the camera as it locks | `{ "beat": "phrase", "bars": 3, "text": "马斯克得不到的男人", "color": "#F4F1EA", "edge": "#D8382D" }` |

None of these is the limit. The films made their own when the material
asked for it, and each is worked code to start from: chat bubbles from a
real chat (Kin's), an envelope that opens on an invitation, a post that
drops in like a notification and a cover wall as a beat (cgnot996's
`template/beats.js` on the repository's `examples` branch). Their
illustrations assembling into a little 3D world, their works flipping by, a
page scrolling past: write it (below).

## On the beat

At 120 BPM a bar is 2 s. Every hit stays on a downbeat when a beat lasts
whole bars and a piece of the story plays a whole number of bars from where
the story has it (`anim` warns otherwise). A piece may start off the bar
when the story's own cut does: isnail's end card starts at 24.383 s, so the
piece before it ends at 20.383 s, two bars earlier, and a 3-bar beat
between them keeps the end card's hits where they were.

A long piece can be played in part. Act 3 is 8.4 s; `{ "story": [14,
20.383] }` starts at its first climb (14 s is a downbeat, so the hits stay
on the grid), and a film that wants it tighter still writes its own climb
as a beat. A film is as short as its picks: an opening, two story points
and the end card come to about 22 s.

While a beat plays, the story stands still where it was cut away from; its
places are far from the beat's stage and out of its shots. Every join is a
hard cut, in the picture and the music.

## A beat of your own

When the material wants something no beat here does, write it for this film:
a file in the film (`<film>/beats/<name>.js`, entry `{ "beat": "beats/<name>.js",
"bars": 3, … }`), on the same clock and checks as the skill's. It needs no
copy of the template, so the film keeps every fix the skill gets. Tell the
user in a line what you built and why; once it has served a film, it can
come into the skill.


A beat is a module that exports `makeBeat(ctx)`; worked example:
`beats/phrase.js` (a line of big 3D type rises a letter at a time, the toy
drops in, cheers and leaps out). Start from it. Ask first, per point: how
does this material, or this idea, become an animation that shows its point?
The beat is that answer as code.

`ctx` gives:

| field | what |
| --- | --- |
| `opts` | the beat's entry in film.json (`text`, `color`, anything it reads; a colour from the creator's own, `run.mjs palette`, at 3:1 or more on the stage) |
| `len`, `bar`, `beat` | its length, a bar and a beat (s) |
| `stage`, `at(x, y, z)` | its own place, 50 m from everything else (past the camera's 40 m clip), and stage metres → world |
| `fov`, `aspect` | the lens (vertical degrees) and the frame's width / height |
| `glyph` | `adv(key)`, `geo(key, em, depth, bevel)`, `has(key)`: the lettering from the glyph step (`heavy:<char>`: every word in the entry, the digits, `,.+%` and `月日` are cut in the end card's face, but not its `why` and `music`, which never show; `glyphs.py` also harvests `kit.line`, `*TEXT`/`*STR`, `reads` and `glyph.geo` string literals from workspace-local `.js` beat/prop modules, and anything computed dynamically goes in the beat's entry or film.json `"glyphs": { "latin": ",", "heavy": "官方认证" }` / `"glyphs": "20岁大四…"`) |
| `accent`, `pop`, `page` | the theme's accent colour; the confetti's colours (film.json `pop`); the page (`image`, `w`, `h`, `panels` in UI px, `avatar` `{ c, d }`, `slab`) |
| `kit` | `engine/lib/beatkit.js`: their pictures as cards, `picture(file, width, { antiglare })` (a card with the picture on its face, standing, facing the camera: its `geo`, `mat` and `at(position, turn, size)`; pass `antiglare: true` on stark-white web/article screenshots so stage emission never blooms out dark text), `framedPicture(file, width, { border, frameColor, antiglare, … })` (pairs `picture()` with an auto-sized 4-sided `roundBox` bezel matching the image's exact aspect ratio—never hand-guess bezel heights on 9:16 portraits—with `.declare(add, prefix)`, `.put(put, prefix, pos, q, k)`, and `.standY(stageY)` so the bottom bezel sits cleanly above the plinth), `wipePicture(beforeFile, afterFile, width, { beforeFrameColor, afterFrameColor, … })` (pairs two `framedPicture()` cards—such as a blueprint and a finished poster—that flip cleanly without UV stretching or overlap as a foreground wipe bar crosses `pos[0]`), `cutout(file, width)` (or `picture(file, width, { cutout: true })`: an alpha-cutout RGBA PNG badge/icon with the same `.geo`, `.mat` and `.at(p, q, k)` interface so transparent outsides never render black), `pictureFiles(folder)`, `layout.grid`/`wall`/`arc`/`corridor`/`stack(n, …)` (where n cards go; `corridor`: two walls along a path the toy walks, facing in), `stagger(g, i, n, g0, g1)` (card i's arrival), `backToBack(front, back, p, q, k)` (two cards back to back, a badge's two sides: their two transforms; a card's body runs its thickness behind its face, so faces nearer than both thicknesses lie inside each other and render black); `stand(spot)`, `dropIn`, `cheer`, `leapOut`, `strideIn`, `strideOut`, `squash`, `landSquash`, `crouch`, `hop`, `CENTER`; everyday moves, each `(o, g, g0, g1, …)` eased in and out, on any toy (one with no arms plays them with its body): `wave(…, side)`, `nod(…, times)`, `point(…, world, side)`, `skyPoint(…, side)` (42°-outward overhead point clearing wide chibi heads), `raiseArms` (dual-arm high-V celebration clearing wide chibi ear-cups), `salute` (hands brought cleanly together in front of the chest via world-space `aimR`/`aimL`, zero chibi T-pose), `palmBlock(…, world, { both })` (grounded forward palm-stop halting an obstacle card without sideways arm flare), `spin(…, turns)` (returns its squash), `bow`, `sit`, and `lookAt(o, world, k)`; and for when things do not go its way, the same poses a story's frames use (`engine/lib/poses.json`): `startle` (thrown back, arms flung up), `duck` (head down, arms over it), `slump` (head hanging), `shrug`, `lookUp`, `push` (leaning into a weight, legs working), `kick(…, side)` (its foot furthest at the middle of the span: that is when what it kicks leaves), `holdUp` (a thing over its head); `cameraFrom(keys, …)`; `formatCount(v, { decimals, sep, unit })`, `readout(…)` (text that changes as it counts, one object per character a place shows, accepting a function `(v) => …`, unit string `"万"`, or `{ decimals, sep, unit, prefix }` in `fmt`, with `.centerAt(v, group, { afterWidth, gap })`), `readoutBadge(glyph, { from, to, fmt, label, em, labelEm })` (a centered, outline-free number + unit readout rooted into an anti-glare matte paper plate, level by default with zero stroke shimmer), `bannerLine(glyph, text, { em, padX, padY })` (a centered, outline-free 3D headline rooted into an anti-glare matte paper plaque, level by default so gentle camera azimuth drifts never shimmer CJK strokes or tilt paired bottom plaques); `line`, `declareLine`, `putLine`, `facing`, `shade` (a line of lettering, edged, standing by its lowest point, facing the camera: "Lettering" below); `confetti(…)`; `HIDDEN` |
| `signature` | the toy's own move (toy.json `signature`: any `at` target in toy mm uses IK, otherwise a chibi-safe wave) on a pose |
| `math`, `quat`, `mulberry32`, `readFilmJSON` | the engine's helpers (`quat.qFlat(yaw)` lays an XY-plane `arc` ring or disc flat onto the XZ floor while spinning horizontally by `yaw`—never use `qEuler(-Math.PI / 2, yaw, 0)`, whose intrinsic X-first order tilts the ring vertically into the air) |

It returns, every time in the beat's own seconds `g` (0 to `len`):

| field | what |
| --- | --- |
| `declare(add)` | its objects, as the template's (`{ name, geo, mat, anim: true }`); names get the beat's prefix. Its floor too (`mat: { type: "stage" }`) |
| `sample(put, g, putColor)` | every object's transform at g; g runs over the whole film, so hide them outside the beat (scale `kit.HIDDEN`) |
| `pose(g)` | the toy's pose (`kit.stand(spot)` and the moves), or null when the toy is not in it |
| `camera` | `g → { tr, fov, focus, fstop }`: `kit.cameraFrom([{ t, target, dist, elev, az, fstop? }…], { fov, aspect, shakes })` |
| `light(g)` | optional: `{ p, energy, color }`, the one moving light |
| `cues(add)` | its sounds, `add(g, kind, options)`, the synth's kinds (`whooshDown`, `pomf`, `push` with a `note`, `lock`, `sparkle`, `boing`, `whooshUp`, `ding`, `slam`…) |
| `reads` | `[{ text, at: [g0, g1], whole? }]`: each line the viewer reads, from when it comes in to when it goes (the beat's clock). The pace check holds each to how long it takes to read, so a word beat says its words here; it also says where the beat's lettering is on screen longer than its reads cover. `whole`: when a line read as it changes is all there (a count stopped at its number); the story page reads the frames from then |
| `music` | `{ groove: "light" \| "normal" \| "half" \| "double" \| "none", chords: ["Em", "C", "G", "D"], hits: [g…] }`: the song's groove under it (any chord name: Dmaj7, F#m, Bbsus4, C/E …), a big kick on each hit; with `"sound": "bed"` the long chords move away from G as the beat comes in and come home on its hits |
| `cuts` | optional: its own hard cuts `[g…]` (a beat in two shots) |
| `storyboard` | `{ part: { label, what, uses }, frames: [{ at, title, what }], hits: [{ at, label }] }`, each text per language (`zh-Hant`, `zh-Hans`, `en`) |

Write a move the kit already has with the kit (a wave, a nod, a point): the film's own code is for what only this creator's story does.

### Their pictures, many at once

Some ideas show the creator's own pictures: their drawings flipping by, a fan
of their covers round the toy, all their works at once. Others are a motion,
a process, a change, a sound, their words: the idea comes from the material,
not from what the kit makes easy. When it is pictures, the kit makes any
picture in the film a card and places many at once:

```js
const files = kit.pictureFiles("assets/work");                        // their pictures, in name order
const spots = kit.layout.wall(files.length, { c: [0, 0.6, -0.35] });  // or grid, arc (round the toy), stack
const cards = files.map((f, i) => kit.picture(f, spots[i].w ?? 0.3)); // each spots[i].w metres wide
// declare(add): cards.forEach((c, i) => add({ name: `card${i}`, geo: c.geo, mat: c.mat, anim: true }));
// sample(put, g): each arrives in turn between 0.7 and 3.6 s, out of the dark in front
cards.forEach((c, i) => {
  const u = kit.stagger(g, i, cards.length, 0.7, 3.6, 0.4);
  put(`card${i}`, u > 0 ? c.at(at(...math.v3.lerp(FROM[i], spots[i].p, math.easeOut(u))), spots[i].q)
                        : quat.trs(at(0, -2, 0), quat.qId(), kit.HIDDEN));
});
```

The cards light themselves, like the page's panels, so the light stays on the
toy. Lettering over a wall of pictures needs a plate of its own behind it (a
dark `roundBox`): their colours are everywhere behind it, the toy's too.

A card can play a film instead of a still: `kit.picture(firstFrame, w, {
movie: "assets/work/reel.mp4", frames: 240, start: 1, cyclic: false })` plays
its frames from the film's frame `start` (`cyclic: true` by default loops round
and round; pass `cyclic: false` for a showcase clip or drawing progression so
it holds its final frame instead of snapping back to frame 1 before the cut—
`check` warns when a cyclic video card wraps while still visible; `export-anim`
automatically stream-copies `.mp4`/`.mov` card clips into `build/movies/*.mkv`
so remote multi-GPU wrappers that skip `.mp4` files still bundle them cleanly). Always place
`kit.picture()` cards via `pic.at(pos, q, scale)` rather than raw `trs(...)`
(`check` flags unscaled `uiBox` cards), and use `kit.cutout(file, w)` for
transparent RGBA PNG icons or badges so their corners stay transparent. Inspect
downloaded footage for single-frame white strobe transitions before encoding.
Look for the creator's own footage before settling on stills (their reels, a
demo, their site's media library).

- **Multi-layer transparent PNGs (`mat: { type: "sticker" }`)**: when stacking
  several transparent UI or poster layers in depth (e.g. 5–7 exploded panes),
  keep the empty glass interior alpha very low (`<= 15/255`, ~5% tint) and add
  a crisp local backing halo *only* behind opaque letters/icons. Higher full-pane
  alpha stacks into milky haze in Cycles and dithered grey noise in EEVEE;
  always verify layered transparency on a Cycles preview frame rather than
  judging from the EEVEE animatic alone.
- **Annotated stills, metric plaques & overlays (selection boxes, callouts, arrows)**: compute
  box/callout coordinates programmatically from the target element's real
  pixel bounding box (`getbbox()` / `textbbox()` on its source layer/crop) plus clean padding—
  never eyeball hardcoded pixel numbers—and visually inspect the generated
  image standalone before placing it in the scene. For bottom multi-stat or
  product-suite strips mounted in `kit.framedPicture(..., { antiglare: true })`,
  render them with `stagekit.plaque(segments)` (and save recipe textures with
  `stagekit.save_if_changed(img, path)` so unchanged recipe re-runs keep file
  `mtime`s intact): `plaque()` supersamples at 2× (`LANCZOS`), auto-sizes width
  from measured glyph bounds with generous side padding so characters never
  collide with edges, draws crisp geometric `"star"` icons and subtle vertical
  dividers, and omits any inner 2D border rectangle so the 3D `framedPicture`
  bezel forms one clean frame (`palette` and `check` warn on `cramped` side
  margins and `doubleBorder` box-in-a-box plaques, while `propBlocksCard` warns
  if a tabletop mug or laptop handle sits in front of any plaque character).
- **Multi-card showcases (4–5 works), `N`-item grids & frame-edge margins**: do not pull the
  camera far back just to cram five cards into one flat row where each card
  shrinks under ~20% of frame height and UI text turns unreadable. Stagger two
  depth rows or feature 2–3 larger hero cards with flanking wings tucked well
  inside the 16:9 / 9:16 frustum (`clearance` / `check` flags any 1–5 card
  showcase whose wing cards clip past a frame edge). When a beat claims a larger
  count (`12 款工具`), stage a **two-step camera**: open close on 3–4 readable
  titled hero cards first, then pull wide to reveal all `N` cards so viewers
  both read real titles and see the promised count. Conversely, when a beat
  promises a small specific count of distinct tools or modules (e.g. `四款自研工具`),
  never show one shrunken multi-card webpage screenshot whose tiny sub-labels
  blur ("writes four, shows zero readable"): split them into *N* separate,
  boldly labeled Chinese cards popping sequentially on the beat as the toy
  points to each. And when turning dark banners (such as an eclipse) into an
  RGBA `kit.cutout()`, carve an unmistakable silhouette (a true curved crescent
  rather than a dark circular disc) so it never reads as a flat dark puck on a
  mid-tone grey stage when words are covered.
- **Dark-mode & stark-white screenshots on dark stages**: dark IDE, terminal or dashboard
  captures (`< 1.6:1` contrast against `#0B0C10` with a dark border) vanish into
  the background as illegible black rectangles—wrap them in a bright window
  bezel and gently lift midtones. Conversely, stark `#FFFFFF` web or article
  screenshots blow out past `finish`'s `0.85` bloom threshold under full UI
  emission—pass `{ antiglare: true }` to `kit.picture()` or map them onto warm
  archival paper with `stagekit.antiglare()` (`palette` and `check` warn on both
  dark cards that melt and white cards that glare). When a custom opening beat
  crops `research/shots/profile.png` into a stage card, mask out its 2D avatar
  circle with `stagekit.empty_avatar_socket()` (and align the 0–2 s 3D sticker
  via `stagekit.card_socket_coords()`) so no flat 2D avatar duplicate remains on
  the card once the 3D toy pops out.
- **Obstacle-to-turn staging & varied beat entrances**: when a beat pivots from
  an obstacle (an error card, quota wall, heavy block) to the creator's answer,
  turn `o.yaw` so the toy physically faces the obstacle it pushes (`kit.push()`
  while facing `+z` camera with the obstacle behind at `-z` reads as pantomime
  in thin air), and finish shoving or dropping the obstacle clear *before* the
  answer's stage rises so the two solids never overlap (`clearance` checks 3D
  OBB pierce/embed). Across consecutive custom beats, vary how the toy enters
  and exits—prefer `kit.strideIn` / `kit.strideOut` lateral floor dashes over repeating vertical
  sky-drops or late top-edge `leapOut` jumps that leave severed shoes dangling
  at the top border or streak across top-band 3D readouts (`heroStreaksOverText`),
  and keep `strideOut` / `leapOut` tight to the last `0.25–0.32 s` of the beat so
  the stage never sits empty for half a second before the cut (`preCutHeroGap`).
  Keep the camera close enough that the toy averages ~30–45% of frame height
  (`pace` warns when a custom beat shrinks the toy under 22% without `"wide": true`),
  keep foreground plaques below the toy's ankles (`propCoversToyBody`) yet above
  the platform player's bottom scrub-bar / caption strip (`plaqueInControlsZone`),
  keep active transition wipe bars in front of `kit.wipePicture()` cards as they
  sweep across (and park them clear of the cards once done), stagger multi-card
  arrivals or mid-beat flips/locks so no custom beat leaves its cards and
  lettering visually unchanged for `> 4.5 s` (`pace` warns on `staticHolds` even
  when SFX cues keep playing), and pair active moves with SFX cues so no beat
  sits in >4.5 s of effect silence (`pace` warns on long cue gaps).

### Choosing the faces

No face is the skill's own: a face that suits one film has never suited the
next. Choose the film's faces before its glyphs are cut (the glyph step stops
until film.json `type` names them and says why), from:

- the creator's own covers, site, logo and titles (research.md: "Their type");
- the script: 繁 or 简, and how dense its characters are (懂, 連, 結 close up in
  a heavy face long before 的 does);
- how big each line stands on screen: a title a tenth of the frame's height,
  a line beside the toy much smaller;
- what the film feels like: a children's brand, a lab, a gallery.

```bash
FILM=<film> node engine/run.mjs fonts       # the faces here that have every character the film shows
FILM=<film> node engine/run.mjs typesheet -- --faces "PingFang TC:Semibold,Yuanti TC:Bold,Lantinghei TC:Heavy" --edge "#2F6BD8"
```

The sheet (`build/type-sheet.jpg`) sets the film's own lines in each face, as
big as a beat's line and as small as a line beside the toy, on the film's
stage, at the size a phone shows the film; the computer's own text
recognition reads each back, and the sheet says how much of each line's box
is ink (over about 45%, a face closes its strokes up when small). Flat type
reads more easily than the 3D lettering: the sheet compares the faces, and
the story page reads the film's own frames afterwards. Then:

```json
"type": {
  "heavy": [{ "family": "PingFang TC", "style": "Semibold" }],
  "why": "MIQI 的 App 和网站用苹方；繁体字笔画多，半粗在手机上还分得开"
}
```

`heavy` is the film's words (the beats' lines and the end card; the name is
the role's first face, it means whatever the film chose, and a single face can
also be written as `"PingFang TC:Semibold"`), `display` a beat's
own line in the creator's own face, `cjk` and `latin` the counter's unit and
digits; a role left out takes the words' face. `track` (em) sets the air
between the end card's letters for the face chosen. Several faces in a role
are tried in order: a Mac face, then a free one for another computer.

### Lettering

`kit.line(glyph, text, em, { face, track })` lays a line out (`face:
"display"` is the creator's own face, else the film's words' face; `track`:
em between letters, 0.08 for CJK and 0.03 for Latin when not given);
`kit.declareLine(add, name, ln, { color, outline, edge, depth, finish })`
makes its letters; `kit.putLine(put, name, ln, base, q, k, { outline, depth })`
places them each sample, and `kit.facing(eye, at)` is the turn that faces a
line at `at` to the camera at `eye`:

```js
const ln = kit.line(glyph, "66 种风格", 0.06);
// declare: white, with an edge in the creator's blue round each letter
kit.declareLine(add, "count", ln, { color: "#F7F4EC", outline: "#2F6BD8", edge: 0.06 });
// sample: standing on the floor by its lowest point, facing the camera as the line locks
const q = kit.facing(camera(LOCK).pos, at(0, 0, 0));
kit.putLine(put, "count", ln, (it) => quat.apply(quat.trs(at(0, 0, 0), q, 1), [it.x, ln.stand, 0]), q, () => 1, { outline: true });
```

The look is the film's (colour, edge, finish, the face); what keeps any face
readable is built in:
- Its depth follows its size (0.08 em), and its sides take a deeper shade of
  its face (`finish.side` sets another, `null` the face's own): a line seen
  from a little above shows the tops of its strokes, and in the face's own
  colour they thicken every stroke until 懂 is one block.
- It faces the camera while it is read (`kit.facing`): a line standing
  upright with the camera 20° above it shows those tops in every frame. When
  the camera dollies or orbits during a hold, compute `kit.facing(camera(g).pos, origin)`
  (or pass `camera(g)` / `camera(g).pos` to `bannerLine` / `readoutBadge`)
  dynamically inside `sample` rather than freezing one quaternion at declare
  time. The story page says where lettering is turned more than 15° from the
  camera.
- **Mixed CJK + short Latin 3D display lines**: avoid copying social-bio
  punctuation verbatim into large 3D headlines—a full-width comma leaves an
  awkward gap and lowercase descenders (`g`, `y`, `p`) break the baseline.
  Prefer a clean space and uppercase for short English terms (`生命不息 BUG不止`
  instead of `生命不息，Bug不止`) so cap-heights align with Chinese characters.
- It does not glow (`emit` 0): the finish's bloom fills a lit letter's
  counters.
- Its edge (`outline`) is a flat plate, the letter grown evenly all round
  (`edge` em), sitting behind the face: where the letters' plates meet they
  lie in one plane, one even band round the line. `outline: true` is a dark
  glossy edge, a colour an edge in it. On the dark stage a dark edge does
  nothing; an edge earns its place in a colour that stands apart from the
  face and from what is behind the line.
- Every letter says it is one (`letter`: the character): a beat that adds
  letters of its own (`glyph.geo`) says so too, or the checks take its print
  or its logo for words, and its words for a print. A prop shaped from a
  curve in the type material (a sun, a logo) without `letter` is not
  lettering: the sinking and reading checks pass it by.
- A line that comes in letter by letter gives each letter 0.05 s at least
  (10 letters: 0.45 s from the first to the last; 0.08 s reads easier). A
  letter a frame is over before the eye starts on it: check stops the full
  render on it (the end card's labels pop up together, `pop`, and are not
  typing).
- A number on screen is white with a dark edge, floating, with its label
  (the film's rule). So is any lettering on a light or busy ground, where a
  face alone reads at under 3:1. The edge's material says `"outline": true`,
  so the colour check reads the face by its edge, never the edge as
  lettering of its own.
- Lettering that stands on a floor stands by its lowest point (`ln.stand`
  above it): set by its baseline, a descender or a low stroke sinks into the
  floor. `check` says which letters sink, how deep and when.
- Small lettering on a solid plaque, crossbar or badge (`em` under ~0.045 m)
  stays flat-printed with `kit.picture()` rather than floating 3D `declareLine`
  meshes in front of a box: floating 4–35 mm off a backing board casts offset
  double shadows under the key light and smears every stroke. `check` warns
  when small 3D lettering floats in front of a solid backing.
- A finish (`finish`, the type material's own fields): `glass` (0–1: light
  through it, a logo's glassy facets), `shine: true` (a hard shine), `metal`
  (its roughness: chrome 0.08, brass 0.3), `side: "#hex"` (its sides and bevel
  in a colour of their own: a glass face with a blue edge). When the lettering
  carries a brand, offer the user a sheet of finishes rendered side by side at
  full quality (glass, glass with an edge, chrome, enamel, a lit sign; a short
  render), and their own colour, before settling on one.
- A line's `reads` start when its last letter lands: a line rising a letter
  at a time half a second apart is half a line for two seconds. When replacing
  one 3D headline with another on the same spot, finish fading the outgoing
  line (`scale <= kit.HIDDEN`) before popping the incoming line in (`check`
  flags overlapping 3D lines). For rolling `kit.readout` counters, stepping
  progress in 8–10 crisp ticks (`Math.floor(u * 8) / 8`) avoids motion-blur
  digit ghosting on half-second review sheets.

The colours are each beat's own: the face and its edge from the creator's
colours, against that beat's stage and what glows in it. The story page says
where a line is the colour of the toy beside it or of what glows in its beat
(cyan words in front of a cyan-lit print), and reads every preview frame with
a line on it at phone size, with the finish's bloom: a line the computer
misreads, or only just reads, blocks the render until it is bigger, freer,
facing the camera or in other colours.

### Light and glow

- `{ type: "beam", image, color, strength }`: light seen in the air or as a
  pool on the floor (a stage spot's cone), glowing by the picture's alpha and
  clear elsewhere. The animatic's engine draws it rough (a ragged "Christmas
  tree"); the previews and the render are clean. Where the animatic must look
  right too, build the glow from a few dozen opaque emissive discs instead.
- `"sampled": false` on any glowing material (a lit facet, a line of light, a
  picture card right beside the toy): it shows itself but is not sampled as a
  light. Without it Cycles spends the toy's light samples on it, and the toy,
  a few millimetres behind it, comes out dark and blotched on some frames.

A beat usually opens with the toy dropping in from above (the cut from
the last segment's leap) and ends with `kit.leapOut`, so the joins read as
one toy going from stage to stage. When adjacent beats share the same physical
workbench or world, vary at least one join (e.g. a lateral pan, push-through,
or workbench continuity) rather than repeating `leapOut` → `dropIn` onto an
empty floor on every cut. always wrap every beat-local toy or prop position in `at(x, y, z)` **once**—
writing bare `[x, y, z]` teleports an object to world origin, while calling
`at(POS[0], POS[1], POS[2])` a second time on a point already returned by
`at(...)` shifts it off-stage to `2 × stage` (`check` and `rig` flag off-stage
positions and `aimR`/`aimL` targets).
On wide-headed chibi toys, use `kit.skyPoint`, `kit.raiseArms`, `kit.salute`, or
`kit.palmBlock` (or aim hands at world-space `o.aimL` / `o.aimR` targets in front
of the chest/face) rather than raw Euler `±1.3–1.9` rad sideways abduction (which
flares short chibi arms into a stiff horizontal half-T-pose) or pure vertical
`±2.4` rad with `x = 0` (which tucks short arms behind wide cheeks/hair). Keep
open books, tablets, and keyboards resting on a desk flat (`pitch = 0`) so tilted
lower edges do not sink through the tabletop, and route `strideIn` / `strideOut`
paths along the clear front apron (`+z`) rather than through solid furniture.
The first segment is the opening the
story chose (the page floating, which ends on the pinned post, or standing up
turning right or left, which ends with the toy out in front), the last the
template's end card; apply-research writes both. An opening of the film's own
(direction.opening `{ "id": "own", "beat" }`) is a beat like the others: it
starts on their page and brings the toy out of their picture in its own way,
then hands over with `kit.leapOut` (`beats/page-stand.js` builds the page and
the toy's first moment: start from it). A toy with no arms (references/toy.md) plays
every beat with its whole body: the rig turns a point into a lean.

## Check

`run.mjs glyphs anim sound`, then `storyboard -- --frames`: the beat's
frames are in the list; render them as previews with the rest
(`references/storyboard.md`). Look at each: the toy on the beat's floor
(not floating, not sunk), its text readable and inside the safe box, the
camera on it from the first frame of the beat to the last. Keep simultaneous
hero picture cards side-by-side in camera space rather than popping a second
card directly in front of the first (`cardScreenOverlaps`), arc hand-held
props around the toy's head rather than lowering them across the eyes
(`heroFaceOcclusions`), spawn downbeat confetti lower or to the sides so
flakes do not shoot across 3D readouts (`confettiOverText`), and place
foreground 3D headlines over clean dark floor below the toy's sandals and
showcase card bottoms (`lineBackdropClashes` warns when letters cross over the
toy or a card behind them). Keep un-outlined secondary readout labels (`查看`,
`关注者`) in a bloom-safe warm cream (`#F2E8D6`, below `finish`'s 0.85 bloom
threshold) or add an `outline`, and give them an open horizontal band so dense
strokes never bloom (`看` → `着`) or merge with adjacent card text in phone OCR.
`run.mjs previs` automatically diffs against `build/previs/.anim-snapshot.json`
and re-renders only changed preview frames; when updating an animatic after a
surgical beat edit, pass `-- --frames <diff-list>` to `run.mjs animatic` to
re-render only the changed EEVEE frames.
