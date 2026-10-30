# Step 5: render, finish, export

After the user signs the storyboard off. The render takes hours: say how
long first, then let it run in the background.

## How long

```bash
FILM=<film> node <skill>/engine/run.mjs estimate
```

renders three frames at the final settings (Cycles, 48 samples, full size)
and says how long the whole film takes (an Apple M3 Max: about 4 s a frame,
about 40 min for 30 s; an M4 Pro or an M5, about 5 s a frame, 1.5 h for 32 s).
Then, before the hours, the sample: the stretch of the film most likely to
disappoint, at the final settings with its sound (a few minutes):

```bash
FILM=<film> node <skill>/engine/run.mjs sample -- --from 6 --to 14
```

Pick the stretch yourself: the creator's own beat (the default when the film
has one), the walls, a hard camera move, the end card. Watch it against the
reference films first (references/quality.md, `run.mjs compare -- --in
build/sample`), fix what falls short and sample again. Only then show it to
the user with the estimate. A flaw found in a ten-second sample costs
minutes; found in the finished film, it costs the render.

Tell the user, and offer two ways:
- **the quick version first** (about a quarter of the time): the whole film
  at half size and 16 samples, to watch before committing the hours:
  `run.mjs render -- --samples 16 --scale 50 --out build/quick`, then
  `run.mjs finish -- --in build/quick --out out/<id>-quick.mp4`;
- **the final version** straight away (below). 48 samples is the final quality:
the denoiser (OpenImageDenoise) and adaptive sampling are on, and side by
side with 128 samples it looks the same (the Tim and 铁柱AGI films: under
1/255 mean difference) at half the time. Render 128 only when the user asks
for it. On a slow computer (hours more, no GPU) offer 32 samples
(`--samples 32`); the EEVEE animatic is the draft.

## Render

```bash
FILM=<film> node <skill>/engine/run.mjs render -- --samples 48 --scale 100 --resume
```

With no `--frames` it renders the whole film: its frame count is film.json's
`format.duration` × `format.fps` (30 s is 900 frames, a 38 s film 1,140), so
a film whose length follows its content needs no other change. `--frames`
renders a part (`--frames 300-420`, `--frames 13,49,121`).

Run it in the background. It keeps a Mac awake while it runs, prints each
frame with the time left, and `--resume` picks up from the frames already
on disk if it stops. While it runs, look at a few finished frames now and
then (`build/render/`): stop early if something is wrong rather than an
hour later. After a late change, render only the frames `diff-anim.py`
lists (`references/storyboard.md`).

### The light

The stage is dark and the light goes to the toy. This was measured on
before-and-after previews of two films.

The colour transform is **Khronos PBR Neutral**. It keeps the paint's and the
skin's own colours, which Standard greyed.

The **rim light falls on the toy alone** (Cycles light linking). It follows
the camera, from behind the toy and above, and the vinyl reflects it. That
outlines dark hair against the dark stage in every shot, and it lights
nothing else.

The **stage takes the other side of the toy**. A toy that is mostly dark
(a black hoodie, navy clothes, near-black hair: 15% or more of it under
1.6:1 on the dark stage, `engine/lib/colors.py`) would melt into the dark,
so its film plays on a mid-tone stage instead: a blue slate, or a neutral
grey when the toy's own dark is blue. The floors, the end card's glass, the
beats' stages and what the camera sees past them all take that tone. White
lettering still reads on it (3:1 or more), and the creator's page keeps its
own theme. A light toy (a white cat, a white mascot) keeps the dark stage,
and so does a film already delivered (the ledger). The toy's look-dev in
step 3 shows the same stage, and the storyboard page says when it changed.
If a colour still melts, the check prints the same hue made just light
enough to read.

The **sky splits in two**. What reflects sees a bright softbox overhead, so
vinyl keeps its highlights. What is lit sees a dim sky, so floors and walls
stay dark: the end card's floor was a flat grey before.

film.json `"look"` changes the defaults:

| key | default | what |
| --- | --- | --- |
| `rim` | 4 | the rim's strength: more for very dark hair or a black prop |
| `rimOn` | `["hero"]` | the objects the rim falls on, by name (`"cta_prop"` adds a dark prop) |
| `sky` | 0.22 | what the dim sky lends to what is lit |
| `softbox` | 1.4 | how bright the reflected softbox is |
| `view` | `"Khronos PBR Neutral"` | the colour transform |
| `light` | | `"classic"`: the first films' look (Standard, a rim on everything, one even sky) |
| `stage` | by the toy | `"dark"`, `"mid"` (blue slate) or `"grey"`: the stage's tone, when the user wants another than the toy picks |

`-- --look classic` and `-- --rim 6` try a look on a few frames first
(`--frames … --samples 24 --scale 50`). The toy's look-dev (step 3) shares
this light (`engine/lib/look.py`), so a change here shows there too.

## Finish and export

```bash
FILM=<film> node <skill>/engine/run.mjs finish
```

does, in one go:

- the look: bloom on the brightest light only (over 0.85 of white, at 0.3:
  a white page or white lettering on the dark stage stays sharp; `-- --bloom-from
  0.7 --bloom 0.4` for more glow), a soft vignette, fine grain, on every
  core; then the film, H.264 with the score as AAC (`out/<name>.mp4`);
- the cut with the sound effects alone, where a publish platform asks for
  it (抖音: creators there lay the platform's own music under a film):
  `out/<name>-sfx.mp4`;
- each platform's covers from the held last frame (`out/covers/`, and
  `build/covers-check.jpg`);
- the last look (`qa`): duration, size, frame rate, loudness (aim about -13
  LUFS, true peak -1 dBTP or lower), the big hits on their frames, every
  export there, and `build/qa-sheet.jpg`, the film in twelve frames.

Read `build/qa.txt` and look at both sheets before you hand anything over.
Then watch the film yourself once, start to end, with sound. Run the
independent review on the finished film too
(`FILM=<film> node <skill>/engine/run.mjs review -- --final`,
references/review.md). Fix what it ranks first only if the fix is small and
safe at this stage. Otherwise tell the user what it found, and let them choose.

## Handing it over

Give the user the film, the effects-only cut where there is one, and the
covers, each named for its platform. Offer, once, to write each platform's
post: a title and a caption in the creator's voice, with what the film
promotes and the link, kept within each app's limits (X: 280 characters
unless they have Premium; 小红书: a title of at most 20 characters). Never
add a credit for this skill to the picture; at most suggest a hashtag in
the caption.

Once the user takes the film, keep it in the ledger:
`FILM=<film> node <skill>/engine/run.mjs ledger -- --add`. It records the
film's opening, structure, signature move, colours, sound and ending. The
next film is compared with them (references/storyboard.md). Where
film.json does not say what the film did, set it: `-- --add --set
sound=bed`.

Then keep what this film taught for the next one, so it is never asked or
learned twice:
- `<film>/notes.md`: the decisions that made this film, each with its
  reason (the story the user picked and why, what they changed on the page,
  what the review fixed, what the sample caught). A film reopened later
  starts from here.
- `~/.chrishkai-video/preferences.md`: what the user decided that holds for
  every film, a dated line each, in their words where they gave any (繁體 for
  their films, no confetti, their slogans short, a sound they always like).
  Not this creator's facts: those stay with the film.

When the film's sound is on real instruments (`strings`, `band`),
`build/credits.txt` holds the credits their licences require: the
Salamander piano (CC BY 3.0), the MuldjordKit drums (CC BY 4.0). Give the
user those lines with the film. They go in the post's caption or a reply
under it, as the licences ask: credit where the work is shared. The CC0
line is a thanks, which they may drop.
