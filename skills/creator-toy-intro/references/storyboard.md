# Step 4: the storyboard

The one stop before the full render: a page with the story, the beat grid
and real preview renders, checked by you first, then signed off by the user.
Nothing is rendered in full before they say yes.

## Carry the chosen story into the frames

Read `film.story.direction` when present. Implement its first-frame visual and
short on-screen hook using the film's own code; metadata does not draw them.
Each segment must advance its stated role and relationship to the previous one.
Implement each beat's `action.does`; judge `action.means` from the actual frames
without relying on the written explanation. Remove empty gestures. Read
`references/story-test.md` for the deletion test and anatomy constraints.
Check that the ending delivers the hook's promise. Preserve supported facts;
when the user changes the arc, update facts.json and apply it again before
rebuilding previews. Older films without a direction use their selected points.

## Verify the animation treatment

A step-2 story proposal approves the narrative only. Turn each agreed beat into
visible events: the subject's action, a change in the scene, the camera's part
and the transition to the next beat. Short text may clarify names or facts, but
do not simply animate the proposal's slides and call that the intended film.
Metaphors must not imply instant, guaranteed or unsupported results.

For a new or uncertain treatment, build one representative 5–8 second motion
test before extending it across the film. Use the actual film code and character
when ready; mark any placeholder explicitly. Choose a beat that tests the main
storytelling action or transition, not just an easy logo reveal. Check whether
its meaning is understandable without the proposal's explanation. If only still
frames are available, call them still previews; do not claim motion is verified.

Include this test in the existing storyboard review, or proceed on an already
approved treatment; it adds no compulsory approval round. Only real rendered
frames and the actual animatic establish the film's visual style and motion.
If the runtime cannot render them, report that limit and hand off the story
proposal without claiming the animation pipeline has been validated.

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

Nothing goes through the toy: `run.mjs storyboard` first runs
`engine/scripts/clearance.mjs`, which tests the toy against every solid at
every frame, and the page lists each moment it goes into a wall, a piece, a
label or the prop. Fix each one before the page goes to the user
(`references/clearance.md`); the eye forgives a hand a few mm in, never the
body.

Not the last film again: `FILM=<film> node <skill>/engine/run.mjs ledger`
compares this film with every film delivered before: the skill's own
(isnail, Kin, 铁柱: `engine/lib/ledger-base.json`, so even a first film on a
new computer is compared) and this computer's (`~/.chrishkai-video/
ledger.json`), in six things:
- the opening;
- the structure (its pieces and beats in order);
- the toy's signature move;
- the colours;
- the sound;
- the ending.

It should differ from each earlier film in at least four of the six. A
film built from the template's defaults comes out as isnail again (it
differs from isnail in one of the six). When it is too close, change what
costs least and suits the creator: another of the three openings, a beat
built from their material, their own colours, another sound, another prop.
Tell the user in a line what changed and why. The page's "checked first"
list shows the same.

Then the numbers, and a pair of eyes that has not seen the film being made:

```bash
FILM=<film> node <skill>/engine/run.mjs check    # before Blender: what will break, in plain words
FILM=<film> node <skill>/engine/run.mjs pace     # from build/anim.json: nothing rendered (the toy's size on screen too)
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
no second, drawn-in-the-browser animation substitute on this step-4 page:
its visual sign-off uses what Blender makes. The earlier, explicitly labelled
step-2 story proposal may use text and supplied footage; it is not this sign-off.

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

## The sound, chosen by ear

Users judge the sound by ear, and often cannot say what is wrong. The
cgnot996 test went through two synthesized scores ("好唔順", twice) before a
listening test settled it in one round. So once the animatic is in, lay
every sound under it and let the user choose:

```bash
FILM=<film> node <skill>/engine/run.mjs listen   # → build/storyboard/sound-<sound>.mp4, on the page
```

`run.mjs storyboard` makes them by itself when the animatic is there and
they are not: the sound is never skipped.

The page plays them side by side:
- **the whole score** (`song`): the template's synthesized arrangement;
- **the whole score on real instruments** (`band`): the same arrangement on
  sampled drums, double bass, strings, piano and horns. Each one is as loud
  as the synthesized instrument it replaces, so the mix keeps its balance;
- **effects over a bed** (`bed`, what new films start with): long chords
  14 dB under the effects;
- **effects over strings and piano** (`strings`): the same chords on a real
  string section, with a piano touching each change;
- **the effects alone** (`fx`);
- **their own song** (`own`).

The two real-instrument sounds need the sample libraries:
`node <skill>/engine/scripts/instruments.mjs --list` shows each library,
how big it is and its licence. Download them only on the user's yes
(`… instruments.mjs all`, about 1.4 GB, into `~/.chrishkai-video/`); they
come from lemo-opuscar's release, checked against pinned SHA-256s. Two of
them need credit when used: the Salamander piano (CC BY 3.0) and the
MuldjordKit drums (CC BY 4.0). `sound` then writes `build/credits.txt`;
those lines go with the film's post (references/render.md).

Write the choice into film.json `"sound"`, run `sound`, and the animatic's
picture keeps its place.

Their own song: put the file in `assets/` and add film.json
`"music": { "file": "assets/<song>.mp3" }`:
- `start`: the second of the song the film starts at (otherwise found);
- `skip`: seconds of intro to leave out when finding it;
- `match: false`: keep the song's own tempo;
- `gain`: dB under the effects, -8 by default.

`engine/lib/music.py` finds the song's tempo and stretches it to the film's
BPM without changing its pitch (when they are within a quarter of each
other). It starts the song so a beat (its kick, its bass) lands on the
film's first hit, and lets the song give way a little under each loud
effect. Check that the creator has the rights to the song: the platforms
check.

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

`diff-anim` lists the frames where anything moved differently and, for an
object added, removed or rebuilt (a new prop, a longer bar), only the frames
where it shows. Re-render the preview frames inside those ranges, rebuild
the page, show it again. Keep the old frames until the new ones are looked
at. When the user says yes, film.json `step` moves on to `render`: the full
render starts only then, and only with the page's checks clean (`run.mjs
render` runs `check --render`; `-- --force` when the user knowingly keeps
one, said in a line).
