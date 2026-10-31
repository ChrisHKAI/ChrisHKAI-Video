# The sound: the film's own score

A film's music is written for that film, the way its animations are: from
what the creator is, on the cut's own parts and hits. There is no menu of
ready-made sounds to choose from. A template's song never fits a cut it was
not written for (users heard the synthesized full score many times and it
never sat right), and choosing between versions is not composing.

The animatic plays the film's sound: its effects over its score. The effects
alone are kept too (`assets/audio/score-sfx.wav`), and `finish -- --sfx-cut`
makes the cut with them for platforms where creators lay their own music.

## When

In step 4, once the cut is set: the parts' lengths and the hits will not
move again. Write it before the animatic, so the user sees and hears the film
at once on the storyboard page. When the cut changes later, change the score
with it.

## How

film.json `"sound": "score"` (`new-film` writes it). The score is a Python
file in the film, `music/score.py` (or film.json `"music": { "score":
"music/<file>.py" }`), that defines `compose(ctx)` and returns the music:
stereo, `(ctx.n, 2)` at `ctx.sr`, the effects left out.

```bash
FILM=<film> node <skill>/engine/run.mjs sound      # → assets/audio/score.wav (and score-sfx.wav, the effects alone)
FILM=<film> node <skill>/engine/run.mjs animatic   # the picture with it
```

The engine lays the effects over it, lets it give way a little under each
loud one, sets it under them by `"music": { "gain": -6 }` (dB), and masters
the two at -13 LUFS under -1 dBTP. Without `music/score.py` yet, the film
plays its effects alone, and `next` and `check` say so.

`ctx` (`engine/lib/compose.py`) holds what a score is written to:
- `sections`: each part of the film in order, its film seconds (`f0`, `f1`),
  its kind (a piece of the story or a beat), its name, and a beat's own
  `music` (groove, chords, hits);
- `hits`: the film's big moments, in film seconds; `cues`: every effect;
- `dur`, `bpm`, `beat`, `bar`, `sr`, `n`, `film` (film.json);
- `real`: the sampled instruments, when the libraries are on this computer
  (`note`, `hit`, `chord`, `room`: piano, strings, kalimba, marimba,
  glockenspiel, ukulele, guzheng, erhu, harp, drums and more); else `None`;
- `synth`: the synth kit, always there; `add(buf, x, t, gain, pan)`;
  `midi("G3")`.

`compose.example(ctx)` is a worked score that plays every part and hit: a
bass, a piano on each bar's chord, a four-note motif, light drums, a chord
and a cymbal on each hit. It shows the plumbing; its key, motif, instruments
and arrangement are placeholders. Start from it, then write this film's own.

## What to write

Hold it to the bar the film is held to (SKILL.md, "The bar"):
- **One musical idea from the creator.** An instrument their work suggests,
  a motif from the rhythm of their name or their line, the feel of their own
  videos, the place they work from. A sound another creator's film could
  have as well is a template.
- **The cut's own shape.** Each part its own texture; an accent on each hit;
  space where a line is read; a build into the payoff; the end card on the
  home chord, holding to the last frame.
- **Under the effects.** The effects carry the action, the music the space
  around it. The engine ducks it under them; leave room in the mids where the
  effects sit.

You cannot hear it. Check what can be measured: `sound` prints each bar's
level (no bar jumps out unless it is a hit), the mix against the effects
alone bar by bar (the music fills the quiet stretches), the peak. Then the
user listens on the storyboard page. When they don't like it, ask what they
hear (too busy, too sad, the wrong instrument) and rewrite it from their
words: never offer a menu of versions instead.

## The real instruments

`node <skill>/engine/scripts/instruments.mjs --list` shows each sample
library, how big it is and its licence. Download them only on the user's yes
(`… instruments.mjs all`, about 1.4 GB, into `~/.chrishkai-video/`); they come
from lemo-opuscar's release, checked against pinned SHA-256s. Two of them
need credit when used: the Salamander piano (CC BY 3.0) and the MuldjordKit
drums (CC BY 4.0). `sound` writes `build/credits.txt` when the score played
them; those lines go with the film's post (references/render.md).

## Their own song

When the user brings a song of theirs instead: `"sound": "own"`, the file in
`assets/` and film.json `"music": { "file": "assets/<song>.mp3" }`:
- `start`: the second of the song the film starts at (otherwise found);
- `skip`: seconds of intro to leave out when finding it;
- `match: false`: keep the song's own tempo;
- `gain`: dB under the effects, -8 by default.

`engine/lib/music.py` finds the song's tempo and stretches it to the film's
BPM without changing its pitch (when they are within a quarter of each
other), starts it so a beat lands on the film's first hit, and lets it give
way a little under each loud effect. Check that the creator has the rights to
the song: the platforms check.

Films made before keep their sound: `"bed"`, `"song"`, `"band"`, `"strings"`
and `"fx"` still play as they did.
