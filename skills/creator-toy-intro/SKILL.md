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

**Status: development stage 3 of 4 under way.** The engine, one story
template (`isnail-30`) and six platform themes work in 16:9 and 9:16, and
rebuild the reference film exactly; finish cuts each platform's covers, and
previews are checked against each app's own controls. Steps 0 and 1 (the
computer, onboarding) and 2 (research) work. Not yet: the toy kits and the
storyboard page (the rest of stage 3); testing with new creators (stage 4).
Until then, after research a film for a new creator needs the rest of its
film.json, its toy.json and cover recipes written by hand, as below.

## Making a film

Effort stays at xhigh. Each step ends on something the user looks at.

| step | what | how |
| --- | --- | --- |
| 0 | the computer: check, then one yes installs what is missing | `references/onboarding.md` |
| 1 | onboarding: the creator's link, where the film goes, a workspace | `references/onboarding.md` |
| 2 | research: profile, pinned and best posts, numbers; the user confirms the toy's picture and picks from a material table | `references/research.md` |
| 3 | the toy from the profile picture; a turnaround to approve | not yet: by hand (`toy.json`, `lookdev`) |
| 4 | story and storyboard: real preview renders, safe zones | `render` previews, `safezone` |
| 5 | render, finish, covers | `render`, `finish` |

## Layout

| path | what it is |
| --- | --- |
| `references/` | how to run each step with the user: `onboarding.md` (steps 0 and 1), `research.md` (step 2) |
| `engine/run.mjs` | runs pipeline steps for one film workspace |
| `engine/lib/` | shared modules: film workspace, toy rig, camera, sticker peel, counter, torn-paper labels, particles, easing, quaternions; `cutlib.py` (cover pieces), `fonts.py` (lettering faces by name), `synth.py` (instruments and effects); `platforms.json` (where films are published: covers, each app's controls, the safe box) read through `publish.py`; `tools.js` (where Blender, Python and Chrome are); `link.js` (reads a creator's link); `numbers.js` (reads 304万, 1.1萬, 46K) |
| `engine/scripts/` | doctor (step 0), new-film (step 1), materials and apply-research (step 2), build-ui, export-anim, glyphs, sticker2d, shape, lookdev, scene (Blender), finish, covers, safezone, sheet |
| `templates/isnail-30/` | the story: `story.json` (its tuned beat times, wall width, lens, shakes), `timeline.js` (events, places, camera keys, sound cues), `anim.js` (choreography), `world.js` (objects), `ui.js` (pages to screenshot), `score.py` (arrangement and mix) |
| `themes/<theme>/` | a platform's profile page: `layout.js` (sizes and anchors: the theme contract), `page.js` (the page as HTML from film.json); `x-desktop` (16:9), `x-mobile`, `douyin-mobile`, `xhs-mobile`, `channels-mobile`, `ig-mobile` (9:16); `_shared/icons.js` |

## Requirements

Blender 5.2 LTS or later (Apple silicon on a Mac), Node 22+, Python 3.9+
with numpy, scipy, pillow, fonttools and contourpy, ffmpeg, and Chrome
(headless); `engine/scripts/doctor.mjs` checks them all and installs what is
missing (step 0). The end
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
  research/        step 2: facts.json, screenshots, the material table
  out/             the finished film; out/covers/ the platforms' covers
```

`engine/scripts/new-film.mjs` opens one (step 1).

film.json holds: `template`, `theme`, `language`, `format` (fps, bpm,
duration, size), `output`, `publish` (where the film goes: ids in
`engine/lib/platforms.json`; default the stage theme's platform), `toy`, `recipes` (in order; `@sticker2d` and
`@shape` are engine tools), `branding` (the creator's own copies of platform
marks, if any), `profile` (name, handle, bio, counts, pictures), `posts`
(pinned and the second post: date, title, counts, cover), `counter` (value,
unit, label), `cta` (slogan labels, name and handle labels, the prop;
positions optional: the template lays the end card out per orientation),
`sticker2d`, `pop` (confetti colours), `story` (the cover walls' pieces;
events, places, camera keys and shakes only where they differ from the
template's own `story.json`), `source` (the creator's link, platform,
handle), `toyFrom` (the pictures the user confirmed the toy is made from)
and `step` (the step a film being made is at).

`format.size` is `[1920, 1080]` for 16:9 or `[1080, 1920]` for 9:16, and the
theme matches it: `x-desktop` is 16:9, the `-mobile` themes 9:16. The camera
and the end card follow the orientation; `story` and `cta` only pin values
that should differ from them.

What each theme shows (a field left out is simply not shown; every theme
shows `profile.name` and `profile.bio`, a list of lines):

| theme | the page | from `profile` | a grid tile's number |
| --- | --- | --- | --- |
| `x-desktop` | X on the web, dark | `nameEmoji`, `handle`, `banner`, `postsCount`, `meta` (`topic`, `link`, `joined`), `following`, `followers` | no grid: both posts show `counts` (replies, reposts, likes, views) |
| `x-mobile` | the X app | `nameEmoji`, `handle`, `banner`, `meta` (`topic`, `link`), `following`, `followers` | no grid: as above |
| `douyin-mobile` | 抖音 | `handle`, `banner`, `likes`, `following`, `followers`, `ip`, `tags`, `posts`, `collections` | likes |
| `xhs-mobile` | 小红书 | `handle`, `banner`, `ip`, `following`, `followers`, `likes`, `tags`, `collections` | likes |
| `channels-mobile` | 视频号 | `title` (with a verified mark), `ip`, `posts`, `collections` | likes |
| `ig-mobile` | Instagram, Reels tab | `handle`, `posts`, `followers`, `following`, `category`, `meta.link`, `highlights` | plays |

`ip` is the region the app shows (广东), `likes` the profile's total, `posts`
the number of works, `tags` and `collections` short lists of words,
`highlights` `[{ image, label }]` (default: the first three grid covers,
labelled with `collections`). The pinned and second posts give `date`,
`title`, `counts` and `cover`, plus `count`, the number their tile shows on a
mobile theme (default from `counts`: likes, plays on Instagram). `grid` is the
creator's other posts that fill the grid after those two, `[{ cover, count }]`,
repeated when there are fewer than seven. All numbers are text, written the
way the app writes them (`5.5万`, `1,380`), and taken as the creator gives them.

## Pipeline

```bash
FILM=<film> node engine/run.mjs data      # recipes glyphs hero ui anim sound
FILM=<film> node engine/run.mjs lookdev   # the toy's turnaround → build/lookdev/
FILM=<film> node engine/run.mjs render -- --frames 1-900 --samples 128 --scale 100
FILM=<film> node engine/run.mjs finish    # → out/, then covers → out/covers/
```

Covers are cut from the held last frame at the film's own pixels, one set
per platform in `publish` (`covers` alone re-cuts them). Look at
`build/covers-check.jpg`: every cut drawn on the frame, the covers beside it;
a cut that loses part of the end card is reported.

Previews: `render -- --frames 13,49,121 --samples 32 --scale 50 --out build/previs`.
Then `safezone`: the platforms' own controls (top bar, captions, the
buttons column) laid over the previews in `build/safezone-check.jpg`, with
the safe box clear of all of them; include a frame of the end card's hold to
have it checked by itself.
An animatic: `--engine eevee --samples 4 --scale 33 --out build/eev`.

## Rules the films taught

- One toy on screen, ever: the toy and the flat sticker swap, never both.
- No fade to black: the last frame holds and is the cover.
- A number rises from the spot on the page where it is shown.
- Storyboards are real renders from this pipeline, never flat sketches.
- After a change, re-render only the frames it touches; keep the old frames
  until the new cut is checked.
- Look before spending GPU time: check the UI texture, cover-piece check
  images, a contact sheet of previews and the safe-zone sheet before the
  full render. Counters, labels and the end card's text stay inside the safe box.
