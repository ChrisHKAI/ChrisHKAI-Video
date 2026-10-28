# Step 5: render, finish, export

After the user signs the storyboard off. The render takes hours: say how
long first, then let it run in the background.

## How long

```bash
FILM=<film> node <skill>/engine/run.mjs estimate
```

renders three frames at the final settings (Cycles, 48 samples, full size)
and says how long the whole film takes (an Apple M3 Max: about 4 s a frame,
about 40 min for 30 s). Tell the user. 48 samples is the final quality:
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
Then watch the film yourself once, start to end, with sound.

## Handing it over

Give the user the film, the effects-only cut where there is one, and the
covers, each named for its platform. Offer, once, to write each platform's
post: a title and a caption in the creator's voice, with what the film
promotes and the link, kept within each app's limits (X: 280 characters
unless they have Premium; 小红书: a title of at most 20 characters). Never
add a credit for this skill to the picture; at most suggest a hashtag in
the caption.
