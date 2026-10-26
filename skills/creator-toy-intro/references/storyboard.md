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

## The sign-off

Show the page (send the file; publish it too where the agent can), and ask
the points at its end in one round. The user answers in words: "the 9:16
end card higher", "a different slogan", "no snail". Change the timeline,
film.json or toy.json accordingly; then render only what changed:

```bash
cp <film>/build/anim.json /tmp/anim-before.json
FILM=<film> node <skill>/engine/run.mjs anim
python3 <skill>/engine/scripts/diff-anim.py /tmp/anim-before.json <film>/build/anim.json   # e.g. 73-121,755-778
```

Re-render the preview frames inside those ranges, rebuild the page, show it
again. Keep the old frames until the new ones are looked at. When the user
says yes, film.json `step` moves on to `render`.
