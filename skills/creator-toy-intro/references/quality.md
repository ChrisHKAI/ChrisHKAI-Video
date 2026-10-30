# The standard: as good as the films the user approved

The steps make a film. They do not make it a good one. The first testers
followed every step and got films that looked alike: the toy inside the walls,
a frame with five things in it, a number too small to read. Nothing compared
their films with the ones that work.

This page is that standard. It was measured from the three films the user
approved: isnail's, Kin's and 铁柱's (`references/look/` holds their frames).
Two tools hold each film to it:
- `run.mjs compare` puts this film's frames beside theirs, moment by moment.
- `run.mjs sample` renders the riskiest stretch at the final quality before
  the hours of the whole.

## What the approved films do

Each rule says how it is checked. Where only the eye can check it, compare
puts the frames side by side for you.

1. **The toy is the hero.** When it arrives, it fills 45–70% of the frame's
   height. The camera is at its eye level, 8–16° above, and the world behind
   it is soft. It is never a speck: under 8% of the height, the pace check
   flags it.
2. **One idea a shot.** A proof shows one number, big: its lettering is
   15–25% of the frame's height, with the toy beside it reacting (pointing,
   cheering) and the post it came from behind, soft. When a frame has three
   things competing, cut one or give it its own beat. (compare)
3. **Everything lands on the beat.** Every number locks, every word lands
   and every cut falls on a downbeat. The shake and the sparks come only on
   those hits. (the beat grid on the storyboard page; `segments.js` warns
   when a part leaves the downbeats)
4. **The stage is dark; the colour is in the content.** Measured on the
   references' frames (0–255):
   - the toy's and the proof's shots: brightness 48–76, contrast 33–88;
   - the proof, the payoff and the end card: colourfulness 27–48. Under
     that, the frame reads grey and flat.

   A light X page may be bright (铁柱's opening is 200). The toy must still
   stand out: the colour check's 3:1, and a rim light where it melts in.
   (compare prints every frame outside the references' range; the storyboard
   page's colour checks)
5. **Lettering that reads.** The end card's heavy face on cream torn paper
   and an accent label in red or the creator's own colour, at 3:1 or more.
   Every line stays up long enough to read. (the page's reading-time and
   colour checks)
6. **Always something new.** Something new at least every two bars, and
   never the toy hopping alone. (the pace check)
7. **Each part grows from the last.** The toy carries across: it leaps out
   of one part and drops into the next. Or one thing becomes the next: the
   cover stands up into a wall, the count rises out of the page. Never a cut
   to an unrelated stage with nothing carried over. (the animatic; the
   reviewer's "finish")
8. **The camera has a reason.** It follows the toy, or squares up to what
   the toy shows, and holds still while a line is read. Its moves land with
   the beat. (the animatic)
9. **Solid things are solid.** Nothing goes through the toy, and the toy
   goes through nothing. (`clearance.mjs`: references/clearance.md)
10. **The creator's own, and nobody else's.** Their posts, numbers and words
    are on screen in every part. The film differs from every earlier film in
    four of six things. (the ledger; the story test)
11. **The end card.** Their name, their handle and a two-part slogan, with
    the toy on its prop, all inside the platform's safe box. (the page's
    safe-box check)

## The loop

1. **Previews.** Once the storyboard's preview frames are rendered:

   ```bash
   FILM=<film> node <skill>/engine/run.mjs compare
   ```

   Look at `build/compare.jpg` row by row: the opening, the toy arriving,
   the proof, the payoff, the end card. For each row, is the toy as big, the
   number as big, the stage as dark, the colour as rich and the frame as
   simple as the references? It prints the frames to render when one is
   missing, and every number outside the references' range. Write what
   differs, a line each, and fix it. Render those frames again and compare
   again: two rounds at most. Then the page goes to the user.
2. **The sample.** Before the full render, render the stretch most likely to
   disappoint at the final settings, with its sound:

   ```bash
   FILM=<film> node <skill>/engine/run.mjs sample -- --from <s> --to <s>
   FILM=<film> node <skill>/engine/run.mjs compare -- --in build/sample
   ```

   Pick the creator's own beat, the walls, or a hard camera move. Watch it
   for what stills cannot show:
   - each move winds up, follows through and lands;
   - the hits sit on the sound;
   - nothing jumps at a join.

   Fix what falls short and sample again. Then show the user the sample
   beside the estimate (references/render.md).

## A reference of the user's own

When the user brings a film whose look they want, it becomes this film's
standard where it does not fight the platform's page or the toy. Before
building anything, take it apart and write the result to `build/spec.md`:
- the visual style: light, palette, materials;
- the type: faces, sizes as a share of the frame, how lines come in;
- the motion: what moves, how fast, how it lands;
- the transitions: how one shot becomes the next;
- the camera: lens, height, moves, holds;
- its rhythm: shots per bar, where the hits fall.

Measure from its frames as this page does: extract stills with ffmpeg and
read them. Put one still for each kind of moment in a folder of the film
(`refs/<name>/opening.jpg`, `toy.jpg`, `proof.jpg`, `payoff.jpg`,
`end.jpg`). Then design each story point's shot from that spec, and make
`run.mjs sample` your ten-second test against it:

```bash
FILM=<film> node <skill>/engine/run.mjs compare -- --in build/sample --refs refs/<name>
```

Check the differences, fix them, and only then render the whole.
