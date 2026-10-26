---
name: creator-toy-intro
description: Make a 30 s self-introduction film for a creator (X, 抖音, 小红书, 视频号, Instagram), starring the creator as a smooth 3D vinyl toy that pops out of their profile page, rendered in Blender Cycles. Use when someone asks for a self-intro or intro video, 自我介绍视频, 自我介紹短片, 个人介绍片 or a creator intro with a 3D toy.
effort: xhigh
---

# creator-toy-intro

A creator's profile page floats as glass slabs; their profile picture peels
off like a sticker and puffs into a 3D vinyl toy of them; the toy stomps their
best posts, whose covers stand up as walls while the numbers lift out of the
spots where the page shows them; the end card slaps their name and call to
action up on torn paper. Everything is code: the toy is built from a part
list, the page is HTML, the score is synthesized, Blender renders.

**Status: development stage 1 of 4.** The engine, one story template
(`isnail-30`), one theme (`x-desktop`) and the film workspace format work, and
rebuild the reference film exactly. Not yet: 9:16 and the other platform
themes (stage 2); onboarding, creator research, the toy kits and the
storyboard page (stage 3); testing with new creators (stage 4). Until then,
building a film for a new creator means writing its film.json, toy.json and
cover recipes by hand, as below.

## Layout

| path | what it is |
| --- | --- |
| `engine/run.mjs` | runs pipeline steps for one film workspace |
| `engine/lib/` | shared modules: film workspace, toy rig, camera, sticker peel, counter, torn-paper labels, particles, easing, quaternions; `cutlib.py` (cover pieces), `fonts.py` (lettering faces by name), `synth.py` (instruments and effects) |
| `engine/scripts/` | build-ui, export-anim, glyphs, sticker2d, shape, lookdev, scene (Blender), finish, sheet |
| `templates/isnail-30/` | the story: `timeline.js` (events, places, camera keys, sound cues), `anim.js` (choreography), `world.js` (objects), `ui.js` (pages to screenshot), `score.py` (arrangement and mix) |
| `themes/x-desktop/` | X on the desktop web, dark mode: `layout.js`, `page.js` |

## Requirements

Blender 5.2 LTS or later, Node 22+, Python 3.9+ with numpy, scipy, pillow,
fonttools, contourpy and scikit-image, ffmpeg, and Chrome (headless). The end
card's face is Lantinghei SC/TC Heavy, the counter's PingFang Semibold and
Helvetica Neue Bold (macOS); without them `engine/lib/fonts.py` falls back to
Source Han Sans and Arial. Never copy font files into the skill.

## A film workspace

A folder outside the skill, never committed:

```
<film>/
  film.json        content, story numbers, palette (below)
  toy.json         the toy: parts, joints, colours, finishes
  recipes/         the film's own scripts (cover cuts, its flat avatar)
  assets/          the creator's pictures; the pipeline adds textures here
  build/           everything generated (anim.json, glyphs, frames)
  out/             the finished film
```

film.json holds: `template`, `theme`, `language`, `format` (fps, bpm,
duration, size), `output`, `toy`, `recipes` (in order; `@sticker2d` and
`@shape` are engine tools), `branding` (the creator's own copies of platform
marks, if any), `profile` (name, handle, bio, counts, pictures), `posts`
(pinned and the second post: date, title, counts, cover), `counter` (value,
unit, label), `cta` (slogan labels, name and handle labels, the prop),
`sticker2d`, `pop` (confetti colours), `story` (events, places, wall pieces,
camera keys, shakes).

## Pipeline

```bash
FILM=<film> node engine/run.mjs data      # recipes glyphs hero ui anim sound
FILM=<film> node engine/run.mjs lookdev   # the toy's turnaround → build/lookdev/
FILM=<film> node engine/run.mjs render -- --frames 1-900 --samples 128 --scale 100
FILM=<film> node engine/run.mjs finish    # → out/
```

Previews: `render -- --frames 13,49,121 --samples 32 --scale 50 --out build/previs`.
An animatic: `--engine eevee --samples 4 --scale 33 --out build/eev`.

## Rules the films taught

- One toy on screen, ever: the toy and the flat sticker swap, never both.
- No fade to black: the last frame holds and is the cover.
- A number rises from the spot on the page where it is shown.
- Storyboards are real renders from this pipeline, never flat sketches.
- After a change, re-render only the frames it touches; keep the old frames
  until the new cut is checked.
- Look before spending GPU time: check the UI texture, cover-piece check
  images and a contact sheet of previews before the full render.
