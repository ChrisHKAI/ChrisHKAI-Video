# Step 5: render, finish, export

After the user signs the storyboard off. The render takes hours: say how
long first, then let it run in the background.

## How long

```bash
FILM=<film> node <skill>/engine/run.mjs estimate
```

renders three frames at the final settings (Cycles, 128 samples, full size)
and says how long the whole film takes (isnail on an Apple M-series GPU:
about 6–7 s a frame, 1.5–2 h for 30 s). Tell the user. On a slow computer
(hours more, no GPU) offer a lighter render: 64 samples (`--samples 64`)
looks nearly the same; the EEVEE animatic is the draft.

## Render

```bash
FILM=<film> node <skill>/engine/run.mjs render -- --frames 1-900 --samples 128 --scale 100 --resume
```

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

- the look: bloom on the brightest light, a soft vignette, fine grain, on
  every core; then the film, H.264 with the score as AAC (`out/<name>.mp4`);
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
