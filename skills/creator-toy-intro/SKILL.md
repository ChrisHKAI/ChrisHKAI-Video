---
name: creator-toy-intro
description: Make a self-introduction film for a creator on X (30 s by default, as long as what it says), starring the creator as a smooth 3D vinyl toy that pops out of their profile page, rendered in Blender Cycles. Use when someone asks for a self-intro or intro video, 自我介绍视频, 自我介紹短片, 个人介绍片 or a creator intro with a 3D toy.
effort: xhigh
---

# creator-toy-intro

A self-introduction film for a creator, made from their own material: their
profile page, the posts and numbers they are known for, their own words.
They star in it as a smooth 3D vinyl toy with the body their picture has (a
person, an animal, or an object: a lemon stays a lemon), which pops out of
their profile picture and acts out their story, then rides a prop that says
what they want people to come for while their line slaps up on torn paper.
Everything is code: the toy is built from a part list or sculpted, the page
is HTML, the score is synthesized, Blender renders.

**This skill is a floor, not a fence.** It holds what earlier films learned:
tools, worked examples, checks. Whatever a film needs that it lacks (an
animation for this creator's material, a move for this toy, a number written
another way, a prop), build it in the film's own code (a beat, a prop, a
recipe: `references/beats.md`, `props.md`), say so to the user in a line,
and note it so it can come back into the skill. Never make a film worse to
fit the skill: a template piece that does not fit the material is left out,
not forced. What stays fixed, whatever is built:
- numbers are sourced (where and when read): current counts are fresh,
  historical milestones retain their event dates and original values;
- the profile picture is the creator's own, never redrawn;
- the user picks the toy's picture, the story and the ending, and signs off
  the storyboard; nothing renders for hours before they have seen previews.

**The bar: a film a jury would shortlist.** Make every film as if it were
going to the awards where a 30 s piece made for someone competes: Annie's
Best Sponsored Production, Annecy's Commissioned Films, D&AD's animation and
film craft (the Oscar for an animated short asks the same of a story). Their
juries ask, and so does every step here:
- one idea, said in a sentence;
- the idea grows out of this creator's material: give the film to another
  creator and it breaks;
- one image people remember;
- the craft serves the idea: its lettering, colours, motion and sound come
  from the material;
- nothing that looks like a template, or like the last film.

The film's job stays fixed: a stranger learns who this is, what they make
and where to find them, and every fact is sourced. The awards are the bar
for the idea and the craft, never a reason to go vague, long or arty.

**No clock.** There is no time limit. Designing each animation from the
creator's material is the work, not a step to get through, and time or
effort is never a reason to take a ready-made piece. When a ready-made piece
needs forcing (boxes placed by hand round a cover with no room for them, a
count that is not the point), stop: design what the material wants and bring
it to the user, even when they picked the ready-made one.

A film is pieces, each its own animation (film.json `story.segments`): an
opening that hands over to the first point (the page floating while the
picture peels off like a sticker, which ends on the pinned post; the page
lying flat, then turning right, or left, to stand up), the story points the
user picked, each as an animation designed from its own material, and the
end card. The skill's animations (a number rising from its spot on the page,
a cover standing up as a wall the toy climbs, a count, a flip calendar, a
line rising letter by letter) are parts to build from; one plays whole only
when it is the best way to show that point. It runs as long as what it
says: about 22 s for two points, 30 s or more for three.

The sound of a new film (film.json `"sound": "bed"`, which `new-film` writes)
is the effects over one quiet layer of long chords, 14 dB under them, at -13
LUFS: a creator chose it over the full song after hearing both. The others:
`"song"` (the template's full score), `"band"` (the song on real
instruments), `"strings"` (the bed on a real string section and a piano;
both need the sample libraries, `engine/scripts/instruments.mjs`, about 1.4
GB, on the user's yes), `"fx"` (the effects alone), `"own"` (their own song
on the film's beat, film.json `"music"`). The storyboard page plays each
under the animatic, so the user chooses by ear.

**This release publishes on X** (16:9 or 9:16). The phone themes for 抖音,
小红书, 视频号 and Instagram are here and work, and come out one platform per
later release.

**Status: testing with new creators.** Three films were made with the skill
by outside testers (Opus and Sonnet at high effort, unattended; Opus with
Haiku): their lessons are in this version. `run.mjs next` says where a film
stands and what comes next; `run.mjs check` says, before Blender, what will
break.

## Making a film

Effort xhigh does best; high works (Opus and Sonnet both finished films at
high). Each step ends on something the user looks at. Every line the user
sees is in their language: the replies, the short progress lines between
tool calls, task lists, questions and the pages made for them. Only paths,
commands and code stay as they are. And in plain words: say what will happen
on screen, never the skill's own names for things (an opening named after an
earlier film, "act 2", a beat's id), and never what a tool cost (a Grok
search's price or minutes). At any point, `FILM=<film> node
<skill>/engine/run.mjs next` says what the film's step still lacks and the
commands to run.

| step | what | where it stops for the user | how |
| --- | --- | --- | --- |
| 0 | the computer: check, then one yes installs what is missing | the install list, if anything is missing | `references/onboarding.md` |
| 1 | onboarding: the creator's link, a workspace; how long it all takes, said once | 16:9 or 9:16 | `references/onboarding.md` |
| 2 | research, story first: what the creator is known for and proud of, and the work itself (all of it, as it is today), each fact with its sources and numbers (current counts fresh, milestones dated); for each point, what is special about its material and the ideas designed from it (one at least the film's own, each with a one-line pitch and a sketch made from their material); up to three complete story directions (a hook, connected facts, what the toy does and what the viewer learns, a payoff, the opening that hands over to the first point), one recommended; one targeted search for important gaps, if needed; then a cheap text story test of the chosen one, with the jury's questions (advice, never a gate); `apply-research` turns the picks into the film's pieces | the toy's picture; the story page (`materials.png`): a story direction (A/B/C) with its ideas, and the ending | `references/research.md`, `story-directions.md`, `story-test.md` |
| 3 | the toy, with the body its picture has (person, animal, object), in one of three kits; its colours checked on the dark stage | the turnaround beside the picture | `references/toy.md` |
| 4 | the film's own code (what its pieces need: cover cuts, a beat of its own, the prop), `check`, then the storyboard page: the story, the beat grid, real preview renders, every sound under the animatic, the checks (pace, the toy's size, reading time, colours, the toy never going through anything, not the last film again, a second opinion), and the frames held beside the approved films' (`compare`) | the storyboard page: notes on the frames, the sound, sign-off | `references/storyboard.md`, `quality.md`, `beats.md`, `cover-wall.md`, `clearance.md`, `props.md`, `avatar.md`, `exits.md` |
| 5 | the sample (the riskiest stretch at the final quality, with its sound, held to the approved films), how long (a quick half-size version first, if they like), the render, the finish: the film, the effects-only cut, each platform's covers, the last look | the finished film | `references/render.md` |

The full render starts only when `check` passes and the storyboard page's
checks are clean and signed off (`run.mjs render` runs it; `-- --force` when
the user knowingly keeps something, said in a line).

## Layout

| path | what it is |
| --- | --- |
| `example/isnail/` | a whole film's own code, worked: film.json, toy.json, the cover recipes |
| `characters/` | every toy made so far (isnail, a calico cat, Tim, Steve Jobs, Chris), in step 3's formats, to start a new one from |
| `references/` | how to run each step with the user: `onboarding.md` (steps 0 and 1), `research.md`, `story-directions.md` and `story-test.md` (step 2: sources, gap search, complete narrative options, early story review and purposeful actions), `toy.md` (step 3), `cover-wall.md`, `clearance.md`, `avatar.md`, `exits.md`, `props.md`, `beats.md` and `storyboard.md` (step 4), `review.md` (the independent review, steps 4 and 5), `quality.md` (the standard: the approved films' frames in `references/look/`, compare and the sample, steps 4 and 5), `render.md` (step 5) |
| `beats/` | the skill's beats, to play between pieces of the story (`references/beats.md`): `catalog.json` (every animation, what it fits, a preview strip in `previews/`, its film.json entry: the story page's menu), `page-stand.js` (an opening: the page lies flat like a screen, stands up turning right or left, the toy puffs out of the picture), `count.js` (a number counts up as the platform writes it), `calendar.js` (a span of days as a flip calendar), `phrase.js` (a line of big type rises a letter at a time) |
| `engine/run.mjs` | runs pipeline steps for one film workspace |
| `engine/lib/` | shared modules: film workspace, the film's segments and beats' clocks (`segments.js`), the beats' kit (`beatkit.js`), toy rig, camera, sticker peel, counter, torn-paper labels, particles, easing, quaternions; `cutlib.py` (cover pieces), `fonts.py` (lettering faces by name), `synth.py` (instruments and effects); `platforms.json` (where films are published: covers, each app's controls, the safe box) read through `publish.py`; `tools.js` (where Blender, Python and Chrome are); `link.js` (reads a creator's link); `numbers.js` (reads 304万, 1.1萬, 46K); `toyblend.py` (the pet and sculpt kits' shapes and paint in Blender); `look.py` (the light, shared by the film and the toy's look-dev); `device.py` (which GPU Cycles renders on: OptiX, CUDA, HIP, oneAPI or Metal, whichever the computer has; doctor reports it); `music.py` (their own song on the film's beat); `real.py` and `instruments.json` (the real instruments: lemo-opuscar's sampler, vendored in `engine/vendor/lemo/` under MIT, and the sample libraries it plays); `clearance.js` (where the toy goes into something solid, and its size at rest); `pacing.py`, `colors.py` and `ledger.py` (the page's checks: the pace and the toy's size on screen, the colours, the ledger of delivered films: the skill's own in `ledger-base.json`, this machine's in `~/.chrishkai-video/ledger.json`); `sdf.py` (the sculpt kit's signed distance fields) |
| `engine/scripts/` | next (where a film stands), check (what will break, before Blender), clearance (where the toy goes through something, frame by frame, before Blender), doctor (step 0), new-film (step 1), materials (the story page), grok-search (X search, with Grok Build) and apply-research (step 2), instruments (the real instruments' samples), import-sculpt and toysheet (step 3: with the toy's colours on the stage), storyboard (with storyboard-notes.js), animatic, diff-anim, studio and comments, pace, palette, ledger, review and compare (step 4; `engine/lib/pacing.py`, `engine/lib/colors.py`), regions (a cover's blocks and lines of lettering, numbered), finish (holds the true peak under -1 dBTP), covers and qa (step 5), build-ui, export-anim, glyphs, avatar, sticker2d, shape, lookdev, scene (Blender), safezone, sheet |
| `templates/isnail-30/` | the story: `story.json` (its tuned beat times, wall width, lens, shakes), `storyboard.json` (its parts, preview moments, hits and sign-off points for the page), `props/` (built-in end-card props: `snail.js`, isnail's; `plinth.js`, a ready-made plinth or star in the creator's colours), `timeline.js` (events, places, camera keys, sound cues), `anim.js` (choreography), `world.js` (objects), `ui.js` (pages to screenshot), `score.py` (arrangement and mix); it reaches the engine as `#engine/<file>` (the skill's `package.json`), so a copy in a film works too |
| `themes/<theme>/` | a platform's profile page: `layout.js` (sizes and anchors: the theme contract), `page.js` (the page as HTML from film.json); `x-desktop` (16:9), `x-mobile`, `douyin-mobile`, `xhs-mobile`, `channels-mobile`, `ig-mobile` (9:16); `_shared/icons.js` |

## Requirements

Blender 5.2 LTS or later (Apple silicon on a Mac; on Windows and Linux an
NVIDIA, AMD or Intel graphics card, else the final render takes many hours),
Node 22+, Python 3.9+
with numpy, scipy, pillow, fonttools, contourpy and scikit-image (the sculpt
kit), ffmpeg, and Chrome
(headless); `engine/scripts/doctor.mjs` checks them all and installs what is
missing (step 0). The end
card's face is Lantinghei SC/TC Heavy, the counter's PingFang Semibold and
Helvetica Neue Bold (macOS); without them `engine/lib/fonts.py` falls back to
Source Han Sans, and Arial (Windows) or Liberation Sans (Linux). Never copy font files into the skill.

## A film workspace

A folder outside the skill, never committed:

```
<film>/
  film.json        content, story numbers, palette (below)
  toy.json         the toy: kit, parts, joints, colours, finishes (references/toy.md)
  recipes/         the film's own scripts (cover cuts)
  assets/          the creator's pictures; the pipeline adds textures here
  build/           everything generated (anim.json, glyphs, frames)
  research/        step 2: facts.json, screenshots, the story page
  out/             the finished film; out/covers/ the platforms' covers
  template/        only if the film has its own copy of the story (below)
  engine/scene.py  only if the film has its own copy of the Blender scene (below)
```

`engine/scripts/new-film.mjs` opens one (step 1).

What this film needs that the skill lacks goes in the film first, in the
smallest piece that does it: a beat of its own (`beats/<name>.js`), a prop
(`cta.prop.module`), a recipe. They follow every fix the skill gets. Only
when a piece of the story itself must change (its own look, a move inside
act 2), change a copy in the film, never the skill:

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
`references/avatar.md`), `posts` (the two posts the page shows: date, title,
counts, cover; `kind` article, video or image; `pinned: false` when the first
is not pinned), `counter` (value, unit, label, and `display`: the count as the
platform writes it, 304万, 6.5万, 7,253, 46K; it counts up just so), `cta` (slogan labels, name and handle
labels, the prop: `module`, or `kind` snail or plinth; positions optional:
the template lays the end card out per orientation and fits a long slogan
to its space), `sticker2d`, `pop` (confetti and leaf colours; party colours
without it), `story` (the cover walls' pieces, only when the film plays
act 3; events, places, camera keys
and shakes only where they differ from the template's own `story.json`:
`events` merge one by one, a list such as `camera` or `shakes` replaces the
template's whole; `segments`, pieces of the story and beats one after
another: `references/beats.md`), `story.direction` (the chosen hook, connected facts and payoff; implement these
in step 4), `source` (the creator's link, platform,
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
| `x-desktop` | X on the web, dark | `nameEmoji`, `handle`, `banner`, `postsCount`, `meta` (`location` or `topic`, `link`, `joined`), `following`, `followers`; a bio of any length (more than three lines is set smaller) | no grid: both posts show `counts` (replies, reposts, likes, views) |
| `x-mobile` | the X app | `nameEmoji`, `handle`, `banner`, `meta` (`location` or `topic`, `link`), `following`, `followers` | no grid: as above |
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
Notes on the real frames: `studio` serves the storyboard page, where the
user clicks a spot on a preview frame or the paused animatic and writes
what to change (into `build/comments.jsonl`); `comments` lists them, each
with its frame marked (`references/storyboard.md`).
Before the user sees the page: `check` (what will break), then `pace`
reads the film's numbers, with nothing rendered. It reports:
- quiet stretches of more than two bars;
- the toy hopping with nothing else new;
- the toy a speck (under 8% of the frame's height) or out of the frame;
- no hit in the first 3 s;
- a line gone before it can be read.
The page shows the same, and the full render waits until they are fixed or
the user keeps them knowingly.

Then `review` writes the brief for an independent reviewer, who scores the
film and names the three biggest problems with their times
(`references/review.md`).

## Rules the films taught

- The film is the creator's story, not a template filled in: material is
  picked for what it says about them, and each piece is designed from it
  first (what is special about this material, and the animation that shows
  it). The skill's animations are parts; one that does not fit is left out,
  never forced (a lemon's illustrations are not a cover wall; a cloud is not
  a number; a hundred recipes are not one cover).
- The opening is chosen by the story, never asked: it hands over to the first
  point. The page floating ends with the toy on the pinned post, so it opens a
  film whose first point rises from that post; the page standing up ends with
  the toy out in front of it, ready for any beat.
- Each major toy action states what it does and what the viewer learns; remove
  empty motion. A cheap text story test of the chosen direction (takeaway, why
  keep watching, what makes it this creator) comes before the storyboard
  (`references/story-test.md`): advice, never a gate, and no extra question
  for the user.
- The toy has the body its original has: a lemon gets no arms or legs.
- What the skill lacks, the film builds; the skill never makes a film worse
  than the model would make it without it.
- Current counts are today's, read from the page or an API with where and when;
  never a round figure from an old post (3,000 when the repo has 8,904).
- One toy on screen, ever: the toy and the flat sticker swap, never both.
- The film is as long as what it says: one beat per point, each as long as
  its animation needs, on whole bars; 30 s is a default, never a cap.
- The profile picture is the creator's own, never redrawn: the page has to
  match their real page.
- No fade to black: the last frame holds and is the cover.
- Colours come from the creator's own pictures, never from memory (`palette`),
  and everything reads on the dark stage: lettering 3:1 or more, and no
  big part of the toy under 1.6:1 (a creator's dark hair melted into the
  dark stage until a rim light lifted it).
- Not the last film again: each film differs from every one delivered before in at least four of six
  (opening, structure, signature move, colours, sound, ending: `ledger`).
- The light goes to the toy, not the world. The rim falls on the toy alone and
  follows the camera; the stage stays dark (`references/render.md`, "The light").
- A number rises from the spot on the page where it is shown.
- Storyboards are real renders from this pipeline, never flat sketches.
- After a change, re-render only the frames it touches; keep the old frames
  until the new cut is checked.
- Look before spending GPU time: check the UI texture, cover-piece check
  images, a contact sheet of previews and the safe-zone sheet before the
  full render. Counters, labels and the end card's text stay inside the safe box.
- The toy is the star: on screen it stands at least 8% of the frame's height
  (`pace`), never a speck beside a wall.
- Small lettering stays printed: pushed out of a wall it smears.
