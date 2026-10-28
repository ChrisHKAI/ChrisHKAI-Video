# Step 4: the storyboard

The one stop before the full render: a page with the story, the beat grid
and real preview renders, checked by you first, then signed off by the user.
Nothing is rendered in full before they say yes.

## Build it

```bash
FILM=<film> node <skill>/engine/run.mjs data                     # everything the story needs
FILM=<film> node <skill>/engine/run.mjs storyboard -- --frames   # the moments to preview
FILM=<film> node <skill>/engine/run.mjs render -- --frames <those> --samples 24 --scale 50 --out build/previs
FILM=<film> node <skill>/engine/run.mjs safezone                 # the platforms' controls over them
FILM=<film> node <skill>/engine/run.mjs storyboard -- --lang <the user's language>
```

About 16 frames, a few seconds each. The template says which moments
(`templates/<template>/storyboard.json`: its parts, frames, hits and the
points to decide, in zh-Hant, zh-Hans and English). The page,
`build/storyboard/index.html`, holds its pictures inside: it opens on its
own and can be published as it is.

The animatic, the whole film in EEVEE at a third of the size with its
score (a few minutes on an Apple GPU, more on others; run it in the
background), joins the page when it is done, as `animatic.mp4` beside it
(publish the two together):

```bash
FILM=<film> node <skill>/engine/run.mjs animatic && FILM=<film> node <skill>/engine/run.mjs storyboard
```

## Look first yourself

Before the user sees it, look at every frame and the safe-zone sheet:

- the toy is the creator (the step 3 likeness holds in motion), one toy on
  screen, nothing passing through a wall or the floor;
- every number readable and ending the way the platform writes it;
- counters, labels and the end card's text inside the white box, clear of
  every platform's controls (the page's "checked first" list says what the
  scripts measured; your eyes decide the rest);
- the signature move suits the toy (toy.json `signature`: `glasses` with
  the point the fingers go to, or the default `wave`);
- the cut at 24.4 s: no frame shows both sides.

Fix what you find and render those frames again before showing the page.

The colours come from the creator's own pictures, never from memory:

```bash
FILM=<film> node <skill>/engine/run.mjs palette  # → build/palette-check.jpg
```

The sheet shows their colours (the profile picture, the photos the toy came
from, the banner, the covers) and the accents to choose from. Below them it
shows the film's own colours, each with its contrast on the dark stage:
- the toy's, by how much of it each covers;
- the lettering's (dark ink on a paper of its own is read against the
  paper);
- the confetti's.

Take the confetti (film.json `pop.confetti`) and a beat's lettering
(`color`) from their accents; lettering wants 3:1 or more. A big part of the
toy under 1.6:1 (dark hair, a black hoodie) melts into the stage. Light it
with a rim, or lift the colour a little in toy.json; tell the user which.
The page's "checked first" list shows the same.

Then the numbers, and a pair of eyes that has not seen the film being made:

```bash
FILM=<film> node <skill>/engine/run.mjs pace     # from build/anim.json: nothing rendered
FILM=<film> node <skill>/engine/run.mjs review   # the independent review's brief (references/review.md)
```

`pace` reports, and the page's "checked first" list shows:
- any stretch of more than two bars with nothing new (a cue, a cut, or a
  thing other than the toy starting to move);
- the toy hopping with nothing else going on ("公仔跳左幾下，其實唔使");
- a film with no hit in its first 3 s;
- a line the viewer reads that goes before it can be read (4.5 Chinese
  characters a second, three Latin words a second, plus 1.5 s).

The template and each beat say what the viewer reads, and when
(`build/reads.json`, written with `anim`).

Mend those first. Then run the review: fix the three things it ranks first,
and render again only what they touch.

## Notes on the real frames

The user points at what to change on the page itself, on real renders only:
a click on a spot of a preview frame (Cycles), or on the animatic (EEVEE: it
pauses there), opens a box under it; they write a line and send it. There is
no second, drawn-in-the-browser preview: everything the user sees is what
Blender makes, so nothing on the page misleads about the film's look.

```bash
FILM=<film> node <skill>/engine/run.mjs studio        # serves the page; runs until stopped
```

prints the page's address (only this computer reaches it). Give it to the
user on a line of its own: in a chat, words or punctuation stuck to it (a
"，" in Chinese) become part of the link. Through it a
note lands in `build/comments.jsonl` with its time, frame and the spot
(x, y from the top left, 0–1); opened as a plain file the page copies the
note instead, to paste into the chat. Read them:

```bash
FILM=<film> node <skill>/engine/run.mjs comments                         # the open notes
FILM=<film> node <skill>/engine/run.mjs comments -- --done c3 "the badge holds 2 s longer"
```

Each note comes with `build/comments/<id>.jpg`: the frame it was written on,
with a red ring on the spot. Look at it, change only what the note asks,
render what it touches, and mark it done with a line on what changed (the
page shows the line under the note). Notes in words or screenshots in the
chat work as before.

## The sign-off

Show the page (send the file; publish it too where the agent can; or the
studio's address), and ask the points at its end in one round. The user
answers in words or in notes on the frames: "the 9:16 end card higher", "a
different slogan", "no snail". Change the timeline, film.json or toy.json
accordingly; then render only what changed:

```bash
cp <film>/build/anim.json /tmp/anim-before.json
FILM=<film> node <skill>/engine/run.mjs anim
python3 <skill>/engine/scripts/diff-anim.py /tmp/anim-before.json <film>/build/anim.json   # e.g. 73-121,755-778
```

Re-render the preview frames inside those ranges, rebuild the page, show it
again. Keep the old frames until the new ones are looked at. When the user
says yes, film.json `step` moves on to `render`.
