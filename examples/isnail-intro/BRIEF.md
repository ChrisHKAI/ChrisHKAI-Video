# isnail intro

A 30 s self-introduction film for the X creator 蜗牛King (@isnail), rendered
in Blender Cycles. 1920x1080, 30 fps, 120 BPM (bar = 2 s). X in dark mode
(Simplified Chinese UI) as floating glass slabs; the mascot is a smooth vinyl
toy (no voxels).

1. The profile picture peels off like a sticker and puffs into the 3D toy;
   he pushes his 3D glasses and hops down to the pinned article.
2. He stomps the pinned post (= click): it lights up, the rest of the page
   sinks away, and its cover (《公众号新号从0到1…》) stands up as a wall whose
   characters and pictures push out one per 16th note (the 1 on the 8.0 s
   downbeat). 304万 阅读 lifts out of the post's action bar as 3D lettering and
   counts up under the wall, locking at 10.0 s.
3. The 《自媒体很苦》 post rises; its cover stands up as a wall. The tagline
   pushes out as his road, the title punches out and slams (13.0 s), then the
   boxes push out in half, normal and double time: 9个月 (nine clunks), 46K粉,
   变现7W. He steps onto the spot where the cover's 2D mascot sticker is drawn,
   takes its pose and poofs into that sticker as a flat card (22.0 s), which
   presses back flush with the boxes; at that frame the cover shows the
   drawing again, so there is only ever one mascot (the Clawd film's trick:
   flat card ⇄ toy, never both).
4. Call to action: the sticker peels back off the same spot (23.8 s) and pops
   into the toy on the 24.0 s downbeat; on a separate stage
   the 公众号 mark drops in and grows a snail under it (it is the shell); he
   rides it, and torn-paper labels like the cover's slap down where it has
   crawled: 公众号变现 | 找蜗牛, a letter per 8th note. At 28.0 s he points at
   you while 蜗牛King (gold crown) and @isnail are slapped up in the space
   above; the frame holds to 30 s (no fade). Lettering: Lantinghei SC Heavy.

Storyboard (approved): `storyboard/storyboard.html`.

## Pipeline (one timeline drives everything)

| step | command | writes |
| --- | --- | --- |
| look-dev / flat avatar | `blender -b --factory-startup -P scripts/lookdev.py -- [--avatar]` | `build/lookdev/*.png` |
| avatar sticker | `python3 scripts/avatar.py` | `assets/avatar.png` |
| cover pieces | `python3 scripts/cover.py` | `assets/cover-{full,wall}.png`, `build/cover.json` |
| pinned cover pieces | `python3 scripts/cover-pinned.py` | `build/cover2.json` |
| 2D mascot sticker | `python3 scripts/sticker2d.py` | `assets/sticker2d.png`, `build/sticker2d.json` |
| lettering | `python3 scripts/glyphs.py` | `build/glyphs.json` (PingFang SC Semibold, Helvetica Neue Bold, Lantinghei SC Heavy) |
| 公众号 mark | `python3 scripts/logo.py` | `build/logo.json` (from `assets/gzh-logo.png`, the user's picture) |
| UI + cue dump | `node scripts/build-ui.mjs` | `assets/ui.png`, `assets/retro.png`, `build/timeline.json` |
| motion | `node scripts/export-anim.mjs` | `build/anim.json` (2 samples/frame, only changing keys) |
| render | `blender -b --factory-startup -P scripts/scene.py -- --frames 1-870 --samples 128 --scale 100` | `build/render/####.png` |
| animatic | same with `--engine eevee --samples 4 --scale 33 --out build/eev` (EEVEE stalls ~15 min on first use of some shaders) | |
| sound | `python3 scripts/sound.py` | `assets/audio/score.wav` |
| finish | `python3 scripts/finish.py` | `out/isnail-intro.mp4` |
| contact sheet | `python3 scripts/sheet.py <dir> <out.jpg> <frames> [cols] [width]` | |

## Sources

- `src/timeline.js` — layout (UI px = mm), story events (`EV`), spots, the wall's
  stand-on boxes, camera keys, shakes, sound cues.
- `src/hero.js` — the toy's parts and joints (R = his right = -x, the pointing hand).
- `src/anim.js` — every object at time t: slabs, the peeling sticker strips, the
  toy's poses and joints (arm aiming, finger, squash), the two cover walls and
  their pieces, the 304万 stat, the CTA (logo, snail, torn-paper labels, crown),
  particles, fx light, camera (a hard cut at `EV.cut`, between two frames).

## Assets

- `assets/cover-large.jpg`, `assets/pinned-cover.jpg`, `assets/banner-real.jpg`,
  `assets/avatar-real.jpg` — 蜗牛's public images from pbs.twimg.com (downloaded
  with the user's OK). The sticker is our own flat render of the toy, so the pop
  matches exactly.
- `reference/isnail/article-cover.webp` — the user's screenshot of the cover card.

## Notes

- Cover outlines are hand-placed in "card px" (the webp crop, 1028x411); card px
  (x, y) is cover px (x + 1, y - 1) at 1030 wide. The 2D mascot is filled out of
  `cover-wall.png`; `cover-full.png` returns as he flattens back in.
- All cover-textured parts share one material mapped in the wall's object space,
  so pieces pushed out along z keep the picture on their faces.
- Hidden objects are parked at their next position (scale 1e-4) so motion blur
  never streaks them. The stat's digits swap with constant keys (`step`).
- `scene.py --hide label,crown` leaves objects out of a render (text-free plates
  for type mock-ups, `storyboard/ref/`).
- The CTA stage sits 100 m away, past every other shot's clip distance; the cut
  to it gets an extra key 1/60 s before, so no frame's shutter spans both sides.
