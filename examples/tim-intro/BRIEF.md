# Tim intro — 500 folds and Steve Jobs

A 142.9 s 3D film about Tim (Tim Pan, 影视飓风 / MediaStorm, X: @mediastorm_en),
starring him as a smooth vinyl toy. Blender Cycles, 1920x1080, 30 fps.
On-screen text: Simplified Chinese with English. Story by the user (2026-10-22;
the keynote stage and Jobs's walk-on from the wing, 2026-10-23; no TV, the
feed on the big screen, the user's 86 s cut of keynote → D8 → news, the news
dry under the folds, "iPhone Duo" on the screen from Jobs's walk-on, an iMessage
on an iPhone 4S for the end in place of the paper labels, 2026-10-23).

References (`reference/tim/`): `fold-500-reference.mp4` (Tim's iPhone Duo review;
the 500-fold scene is 0:00–0:18, the D8 clip of Jobs 21:22–21:33),
`tim-still.webp`, `steve-jobs-bw.jpg` (the 1955–2011 portrait),
`jobs-2007-2011-subs.mp4` (the user's cut, 85.85 s, subtitles burned in, from
`~/Downloads/Steve Jobs iPhone 2007 剪接版 简英字幕 v4.mp4`: the 2007 keynote
0–47.5, "this is a day…", "an iPod, a phone, and an internet communicator",
"…and we are calling it iPhone"; D8 47.5–73.98, a flexible iPad? "we don't have
the technology… probably many years away"; ABC News from 73.98, "The death of a
man who literally changed the way we live… has died at the age of 56"; its
keynote part is the earlier v2 cut, `iphone-2007-keynote-subs.mp4`),
`news-died-at-56.mp4` (ABC News, vertical repost), `see-you-again.mp3` (the
user's file; the final chorus comes down at 198.2 s, 80 BPM). X facts:
side-session notes `mediastorm-x-profile.md`.

## Story (the user's)

The set is the stage of the 2007 iPhone keynote (Moscone West): the big
screen's slide as it reads on the tape (black over the top third, deep violet,
a dusky lavender at the foot; the user's call over a brighter purple), blue beams on black drapes, the house in the dark. Every shot is from
the house's side: Tim on the right, Jobs comes on from the left
(`src/timeline.js` has every time; the storyboard is `storyboard/分镜-*.jpg`,
11 scenes).
1. 0–47.5 s: Tim stands alone on the dark stage watching the big screen,
   folding the iPhone Duo; the count at his feet runs faster and faster
   (2007 → 2011). We push in until the screen fills the frame: the user's cut
   of the 2007 keynote plays whole, subtitles in.
2. 47.5–85.85 s: still full frame: D8, a flexible iPad, "We don't have the
   technology… probably many years away"; the news (73.98): "The death of a
   man who literally changed the way we live… has died at the age of 56".
   No music under the news: only the folds, faster and louder (up 8 dB).
3. 85.85 s: the black-and-white portrait; fold 491; Tim stops, the folds fall
   silent, and 《See You Again》 comes in on its quiet piano chorus. We pull back behind him: his small back
   before the portrait.
4. 91.9–93.55 s: the picture flickers, collapses to a line and a dot; the hall
   goes black. Only 491 at Tim's feet.
5. Behind Tim in the dark, the big screen comes up before him
   ("when", 95.44) and we pull back, one move with no cut, out over the
   heads of the house to its view of the stage (94.54–97.64; a cut in the
   dark only jumped the count); a follow spot strikes the empty stage left
   ("see", 96.1); Steve Jobs (the
   toy) walks on from behind the left leg into it ("again", 97.04) as in 2007,
   and Tim turns from the screen to him; "iPhone Duo" on the screen (98.1), set
   as "iPhone" was at the end of the keynote; he walks to Tim (on his mark
   105.7). Tim's close-up (103.72), Jobs's close-up, hand to his chin like the
   portrait (107.8).
6. 109.76 s: Tim remembers nine to go and folds them on the half beats: 500 at
   113.85 as the full band comes in; Jobs nods.
7. 114.82 s: Tim shuts the Duo, walks over and holds it out with both hands;
   Jobs takes it (118.19), Tim lets go, Jobs looks at it, then up at Tim; they
   nod. The spot opens out to hold them both; back out to the house, the stage
   full up (126.58) under "iPhone Duo". From the last nine to black is one
   camera move, no cuts (the user's call: the four shots it replaced jumped):
   down and in from the side as Tim walks over, the count leaving the frame
   (then hidden), onto the Duo as he gives it, in slowly through the nods,
   a breath, then back and round to the house.
8. 132.57 s: black, on a downbeat; no Tim. An iPhone 4S (the last iPhone
   announced in Jobs's life, 2011-10-04) comes out of the dark; its screen
   wakes (133.27) on iOS 5 Messages, to Steve, "Steve, we miss you" in the
   field. Sent (134.47, a whoosh), Delivered, he is typing (136.07), the song
   ends, and in the quiet "I'll always be here" (138.0, the iMessage bell).
   The camera pushes in all the way. The screen locks off (141.4, a click);
   the black phone holds to the end (142.9 s). No subtitles.

Never twice: Jobs is on the big screen until it dies; the toy appears only
after. The white studio and the door of light Jobs first came out of are in
`build/backup-before-wing/`; the TV version (a TV on the stage that squashed
away in sparks, the 5 s keynote) in `build/backup-before-screen/`.
Dropped on the way (the user's calls): a photo-real Jobs from the portrait
(`scripts/depth.py`, `scripts/relief.py`, Depth-Anything-V2-Small) and a white
light-figure Jobs (`src/human.js`): they kept switching looks; the toy stays.

## Pipeline

| step | command | writes |
| --- | --- | --- |
| look-dev | `node scripts/dump-hero.mjs && blender -b --factory-startup -P scripts/lookdev.py -- [--views front,face] [--scale 100]`; `python3 scripts/lookdev_sheets.py` | `build/lookdev*/`, `build/lookdev-sheets/` |
| Duo screens | `python3 scripts/screen.py` | `assets/duo-screen.png`, `assets/duo-cover.png` |
| keynote slide | `python3 scripts/slide.py` | `assets/keynote-iphone-duo.png` ("iPhone Duo"; SF Pro Semibold for Myriad) |
| screen feed | `python3 scripts/tv.py` | `build/tv/####.jpg` (film frames), `build/tv/tv.wav`, `build/tv/luma.json` (each frame's brightness, for the screen's light) |
| iMessage | `node scripts/cues.mjs && python3 scripts/imessage.py` | `build/imsg/####.png` (the 4S screen from black to the end, 640x960) |
| lettering | `python3 scripts/glyphs.py` | `build/glyphs.json` (Lantinghei SC Heavy) |
| motion | `node scripts/export-anim.mjs [--from 23 --to 36 --out build/anim-test.json]` | `build/anim.json` |
| framing | `node scripts/probe.mjs 1,66.5` | frame positions of the big screen, Tim, Jobs, the count |
| sound cues | `node scripts/cues.mjs && python3 scripts/sound.py` | `build/cues.json`, `assets/audio/score.wav` |
| hold | `python3 scripts/hold.py --list` (121-2580), its first frame rendered `--samples 32 --out build/hold-plate`, then `python3 scripts/hold.py` (~2 min) | `build/render/0121–2580.png`: the screen full frame made straight from the feed, no Cycles (matches it to ~1/255) |
| render | `blender -b --factory-startup -P scripts/scene.py -- --frames 1-120,2581-4287 --samples 32 --scale 100` (denoised 32 spp matches 128 spp to the eye and in frame-to-frame flicker, at ~9 s a frame instead of ~25) | `build/render/####.png` |
| storyboard | frames from `python3 scripts/storyboard.py --list` rendered `--samples 32 --scale 50 --out build/sb`, then `python3 scripts/storyboard.py` | `storyboard/分镜-*.jpg` |
| preview | `python3 scripts/hold.py --scale 25 --out build/animatic`; the rest rendered `--samples 12 --scale 25 --out build/animatic`; ffmpeg with the score at 960x540 | `storyboard/全片-预览.mp4` (~17 min) |
| finish | `python3 scripts/finish.py` | `out/tim-intro.mp4` |
| contact sheet | `python3 scripts/sheet.py <dir> <out.jpg> <frames> [cols] [width]` | |

## Sources

- `src/figure.js` — the toy line: one head mould (face pieces for every
  expression, posable brows), body, arms; `src/tim.js` (approved look-dev) and
  `src/jobs.js` give each his hair, glasses, clothes and paint.
- `src/rig.js` — FK, two-bone arm IK (hands on the Duo's halves, Jobs's hand to
  his chin), expressions.
- `src/duo.js` — the iPhone Duo: two halves fold about the hinge.
- `src/anim.js` — everything at time t: the fold count (exponential to 491),
  Tim's look and face (turned to the screen, then a step round to Jobs),
  Jobs's walk-on (a curve from the wing to his mark, timed to clear the leg on
  "again"), the follow spot, the handing over (the toys' big heads keep their
  roots ≥ 84 mm apart; Jobs's arms are then near full reach), lights, shots
  (the opening's framings are in stage space: behind Tim, the screen full
  frame, behind him low).
- `src/iphone.js` — the iPhone 4S of the end: steel band, black glass front
  and back, screen, home button, earpiece, camera, side buttons (the paper
  labels it replaced, `src/labels.js`, are in `build/backup-before-phone/`).
- `scripts/toy.py` — meshes (blobs, tubes, loops, rounded plates) and finishes.
- `scripts/scene.py` — the world from anim.json: the keynote stage (deck,
  drapes, beams, the big screen playing build/tv as an image sequence and then
  its slide, the house as raked rows of toy silhouettes), its light rig (the
  screen's glow follows each feed frame's brightness), the follow spot;
  visibility is keyed `hide_render` (constant).
