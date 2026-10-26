# Kin intro

A 30 s introduction film for the X creator Kin (@KinGao476942), starring his
calico cat (his avatar, `reference/cat/cat.png`) as a smooth vinyl toy. Blender
Cycles, 1920x1080, 30 fps, 120 BPM (bar = 2 s). On-screen text in Simplified
Chinese, Lantinghei SC Heavy. Facts from the user and an X search
(notes: `side-session-notes/…/kingao-x-profile.md`); the bio's contact number
and rate are left out.

1. **Flat → 3D (0–4 s).** Kin's X profile fills the frame flat, like a screen.
   It turns left and backs off to the right while the columns part into
   floating glass slabs (the black margins are a card pushed back into the
   dark). The avatar photo bulges and, on the 2.0 s downbeat, the calico puffs
   out of it as the toy (flattened, then inflated; the photo card is gone on
   that frame) and leaps to the floor; chin up, eyes shut, as in the photo.
2. **SpaceXAI 官方认证大使 (4–8 s).** A gold medal drops round its neck; torn
   paper labels slap up: SpaceXAI, 官方认证大使 (a letter per 16th), and the
   stamp 中国区 on 6.0 s.
3. **微信 × Grok bot (8–16 s).** A drop to a phone with Kin's real first chat
   with Grok bot on 微信 (from his screenshots, `reference/chat/`): 你好，你是 Grok
   bot 么？ → Grok bot (the black ball from his banner stickers, as a toy) hops
   out of the screen beside its reply 回皇上，是奴才，御前总管太监…; the labels
   第一个想到用微信 / 直接和 Grok bot 聊天的人 slap up above the phone (10.0 s); then
   把奶娃的达里奥表情包发我 → 这个我帮不了 + sticker → 不要逼我把你号封了 + sticker →
   封号还不退款 (the calico shakes with laughter); messages scroll up and shrink
   away under the title bar. The long article rises; 155万 浏览 lifts out of its
   action bar and counts up, locking on 15.0 s.
4. **一个月零18天 破万粉 (16–24 s).** It hops up a rising bar chart while 第N天 and
   the follower count run; on 20.0 s the count locks on 10000 粉丝 with a 破万!
   stamp and confetti; 一个月零18天; on 22.0 s it rolls on to 11000+.
5. **Call to action (24–30 s).** The three Grok bots (orange, black, purple)
   drop in round it; 想学 Grok bot | 找 Kin 进群 a word per 8th; Kin and
   @KinGao476942; the calico beckons like a lucky cat; hold from 28 s (no fade).

Storyboard (approved 2026-10-22): `storyboard/storyboard.html`, published at
https://claude.ai/artifact/DaiDjMommPQ7vmBp4hePD3 (31 previs frames + the animatic).

Never twice: the cat photo exists only as the avatar card until 2.0 s (the
pinned post's small avatar and the article's avatar are empty sockets); the
bots appear in 3D only on stages where the banner is not in shot.

## Pipeline (one timeline drives everything)

| step | command | writes |
| --- | --- | --- |
| look-dev turnaround | `node scripts/dump-hero.mjs && blender -b --factory-startup -P scripts/lookdev.py -- [--views front,face]` | `build/lookdev/*.png` |
| UI, cues, text list | `node scripts/build-ui.mjs` | `assets/{ui,phone,article,bubble-*}.png`, `build/{timeline,text,chat}.json` (bubble sizes measured in Chrome) |
| lettering | `python3 scripts/glyphs.py` | `build/glyphs.json` (Lantinghei SC Heavy) |
| motion | `node scripts/export-anim.mjs [--until 8]` | `build/anim.json` |
| framing check | `node scripts/probe.mjs 1.85,2.0` | screen coords of the avatar, landing, page |
| render | `blender -b --factory-startup -P scripts/scene.py -- --frames 1-900 --samples 128 --scale 100` | `build/render/####.png` |
| sound | `python3 scripts/sound.py` | `assets/audio/score.wav` |
| finish | `python3 scripts/finish.py` | `out/kingao-intro.mp4` |
| contact sheet | `python3 scripts/sheet.py <dir> <out.jpg> <frames> [cols] [width]` | |

## Sources

- `src/cat.js` — the calico's parts (blobs = superellipsoids with taper, tubes
  for eyes / mouth / whiskers / tail), painted markings (soft masks of unioned
  ellipsoids in each part's space), joints.
- `src/props.js` — the medal and the three Grok bots.
- `src/timeline.js` — UI layout, story events (`EV`), stages (100 m apart),
  labels, counters, camera keys per stage, shakes, sound cues.
- `src/anim.js` — every object at time t; the cat's pose per stage; cuts at
  `EV.cut1..3` (an extra key 1/60 s before each).
- `scripts/toy.py` — meshes and vinyl/paint materials shared by look-dev and
  the film.

## Assets

- `assets/sticker-1.png`, `assets/sticker-2.png` — the two stickers from the chat,
  cropped from the user's files (`reference/chat/`).
- `assets/banner-real.jpg` — Kin's X banner (pbs.twimg.com, downloaded with the
  user's OK). `assets/avatar-real.png` — the user's photo of the cat.
