---
name: creator-toy-intro
description: Make a self-introduction film for a creator on X (30 s by default, as long as what it says), starring the creator as a smooth 3D vinyl toy that pops out of their profile page, rendered in Blender Cycles. Use when someone asks for a self-intro or intro video, 自我介绍视频, 自我介紹短片, 个人介绍片 or a creator intro with a 3D toy.
effort: xhigh
---

# creator-toy-intro

A creator's profile page floats as glass slabs; their profile picture peels
off like a sticker and puffs into a 3D vinyl toy of them; the toy stomps their
best posts, whose covers stand up as walls while the numbers lift out of the
spots where the page shows them; the end card slaps their name and call to
action up on torn paper. Everything is code: the toy is built from a part
list, the page is HTML, the score is synthesized, Blender renders.

**This release publishes on X** (16:9 or 9:16). The phone themes for 抖音,
小红书, 视频号 and Instagram are here and work, and come out one platform per
later release.

**Status: development stage 4 of 4 (testing with new creators).** The
engine, one story template (`isnail-30`) and six platform themes work in
16:9 and 9:16, and rebuild the reference film exactly; finish cuts each
platform's covers, and previews are checked against each app's own
controls. Steps 0 to 4 (the computer, onboarding, research, the toy in three
kits, the storyboard page) work. For each creator you also write the
film's own code, as for isnail (`example/isnail/`): the cover walls'
recipes, the end card's prop (from what they want to promote) and the exit;
`references/` has the method for each. The profile picture is never
redrawn: the creator's own peels off (`references/avatar.md`). A film can
be pieces of the story with beats of its own between them, each on its own
clock, so it runs as long as what it says (`references/beats.md`; four
beats so far in `beats/`).

## Making a film

Effort stays at xhigh. Each step ends on something the user looks at.
Every line the user sees is in their language: the replies, the short
progress lines between tool calls, task lists, questions and the pages
made for them. Only paths, commands and code stay as they are.

| step | what | how |
| --- | --- | --- |
| 0 | the computer: check, then one yes installs what is missing | `references/onboarding.md` |
| 1 | onboarding: the creator's link, where the film goes, a workspace | `references/onboarding.md` |
| 2 | research: profile, pinned and best posts, numbers; the user confirms the toy's picture and picks from a material table | `references/research.md` |
| 3 | the toy from the confirmed picture, in one of three kits; a turnaround beside it to approve | `references/toy.md` |
| 4 | the film's own code (cover walls, exit, prop, its beats; the profile picture is the creator's own), then the storyboard page: the story, the length, the beat grid, real preview renders under the platforms' controls; the user signs off | `references/cover-wall.md`, `avatar.md`, `exits.md`, `props.md`, `beats.md`, `storyboard.md` |
| 5 | how long, the render, the finish: the film, the effects-only cut, each platform's covers, the last look | `references/render.md` |

## Layout

| path | what it is |
| --- | --- |
| `example/isnail/` | a whole film's own code, worked: film.json, toy.json, the cover recipes |
| `characters/` | every toy made so far (isnail, a calico cat, Tim, Steve Jobs, Chris), in step 3's formats, to start a new one from |
| `references/` | how to run each step with the user: `onboarding.md` (steps 0 and 1), `research.md` (step 2), `toy.md` (step 3), `cover-wall.md`, `avatar.md`, `exits.md`, `props.md`, `beats.md` and `storyboard.md` (step 4), `render.md` (step 5) |
| `beats/` | the skill's beats, to play between pieces of the story (`references/beats.md`): `page-stand.js` (Kin's opening: the page stands up, the toy puffs out of the picture), `count.js` (a number counts up as the platform writes it), `calendar.js` (a span of days as a flip calendar), `phrase.js` (a line of big type rises a letter at a time) |
| `engine/run.mjs` | runs pipeline steps for one film workspace |
| `engine/lib/` | shared modules: film workspace, the film's segments and beats' clocks (`segments.js`), the beats' kit (`beatkit.js`), toy rig, camera, sticker peel, counter, torn-paper labels, particles, easing, quaternions; `cutlib.py` (cover pieces), `fonts.py` (lettering faces by name), `synth.py` (instruments and effects); `platforms.json` (where films are published: covers, each app's controls, the safe box) read through `publish.py`; `tools.js` (where Blender, Python and Chrome are); `link.js` (reads a creator's link); `numbers.js` (reads 304万, 1.1萬, 46K); `toyblend.py` (the pet and sculpt kits' shapes and paint in Blender); `sdf.py` (the sculpt kit's signed distance fields) |
| `engine/scripts/` | doctor (step 0), new-film (step 1), materials and apply-research (step 2), import-sculpt and toysheet (step 3), storyboard, animatic and diff-anim (step 4), finish, covers and qa (step 5), build-ui, export-anim, glyphs, avatar, sticker2d, shape, lookdev, scene (Blender), safezone, sheet |
| `templates/isnail-30/` | the story: `story.json` (its tuned beat times, wall width, lens, shakes), `storyboard.json` (its parts, preview moments, hits and sign-off points for the page), `props/` (built-in end-card props: `snail.js`), `timeline.js` (events, places, camera keys, sound cues), `anim.js` (choreography), `world.js` (objects), `ui.js` (pages to screenshot), `score.py` (arrangement and mix); it reaches the engine as `#engine/<file>` (the skill's `package.json`), so a copy in a film works too |
| `themes/<theme>/` | a platform's profile page: `layout.js` (sizes and anchors: the theme contract), `page.js` (the page as HTML from film.json); `x-desktop` (16:9), `x-mobile`, `douyin-mobile`, `xhs-mobile`, `channels-mobile`, `ig-mobile` (9:16); `_shared/icons.js` |

## Requirements

Blender 5.2 LTS or later (Apple silicon on a Mac), Node 22+, Python 3.9+
with numpy, scipy, pillow, fonttools, contourpy and scikit-image (the sculpt
kit), ffmpeg, and Chrome
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
  toy.json         the toy: kit, parts, joints, colours, finishes (references/toy.md)
  recipes/         the film's own scripts (cover cuts)
  assets/          the creator's pictures; the pipeline adds textures here
  build/           everything generated (anim.json, glyphs, frames)
  research/        step 2: facts.json, screenshots, the material table
  out/             the finished film; out/covers/ the platforms' covers
  template/        only if the film has its own copy of the story (below)
  engine/scene.py  only if the film has its own copy of the Blender scene (below)
```

`engine/scripts/new-film.mjs` opens one (step 1).

When this film needs what the template or the Blender scene can't do (a
story told in another order, a beat of its own, its own look), change a
copy in the film, never the skill:

```bash
FILM=<film> node <skill>/engine/run.mjs own -- template scene.py
```

copies `templates/<template>/` to `<film>/template/` (film.json `template`
becomes `"./template"`, `templateFrom` keeps the original's name) and
`engine/scripts/scene.py` to `<film>/engine/scene.py`; every step then runs
the film's copies (`render`, `estimate` and `animatic` say so). The copies
find the engine of the skill that runs them: the template as
`#engine/<file>`, Python through the `SKILL` variable `run.mjs` sets. Take
only what you change: a copy no longer follows the skill's fixes.

film.json holds: `template` (a template's name, or `./template` for the
film's own copy), `theme`, `language`, `format` (fps, bpm,
duration, size), `output`, `publish` (where the film goes: ids in
`engine/lib/platforms.json`; default the stage theme's platform), `toy`, `recipes` (in order; `@avatar`,
`@sticker2d` and `@shape` are engine tools), `branding` (the creator's own
copies of platform marks, if any), `profile` (name, handle, bio, counts,
pictures), `avatarRing` (the ring round the profile picture:
`references/avatar.md`), `posts` (pinned and the second post: date, title,
counts, cover), `counter` (value, unit, label; `display` for the storyboard
page, as the platform writes it), `cta` (slogan labels, name and handle
labels, the prop; positions optional: the template lays the end card out per
orientation), `sticker2d`, `pop` (confetti and leaf colours; party colours
without it), `story` (the cover walls' pieces; events, places, camera keys
and shakes only where they differ from the template's own `story.json`:
`events` merge one by one, a list such as `camera` or `shakes` replaces the
template's whole; `segments`, pieces of the story and beats one after
another: `references/beats.md`), `source` (the creator's link, platform,
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
FILM=<film> node engine/run.mjs render -- --samples 48 --scale 100 --resume   # the whole film: duration × fps from film.json
FILM=<film> node engine/run.mjs finish    # → out/ (+ the effects-only cut), covers → out/covers/, the last look → build/qa.txt
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
- The film is as long as what it says: one beat per point, each as long as
  its animation needs, on whole bars; 30 s is a default, never a cap.
- The profile picture is the creator's own, never redrawn: the page has to
  match their real page.
- No fade to black: the last frame holds and is the cover.
- A number rises from the spot on the page where it is shown.
- Storyboards are real renders from this pipeline, never flat sketches.
- After a change, re-render only the frames it touches; keep the old frames
  until the new cut is checked.
- Look before spending GPU time: check the UI texture, cover-piece check
  images, a contact sheet of previews and the safe-zone sheet before the
  full render. Counters, labels and the end card's text stay inside the safe box.
