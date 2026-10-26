# Leaving the act 3 wall

At the end of act 3 (21.35 s) the toy leaves the second cover, so that the
next shot, squared up to the cover (21.8–24.4 s), shows the creator's cover
as they published it. Then the cut to the end card at 24.4 s. There is one
toy on screen, always. Two ways, by what the cover shows:

| the cover | exit | film.json |
| --- | --- | --- |
| has the creator's character drawn on it (isnail's mascot on 《自媒体很苦》) | `sticker`: the toy hops onto the drawing's spot, poofs flat into a sticker card that sinks into the picture (it becomes the drawing), and at 24 s peels back off and pops out to the end card | `sticker2d` set (and the wall texture without the drawing) |
| anything else | `jump`: the toy crouches and leaps straight up out of the frame; after the cut it drops from above onto the end card's prop | nothing (or `story.exit: "jump"`) |

The template picks `sticker` when film.json has `sticker2d`, else `jump`;
`story.exit` forces either.

## The sticker exit

1. Find the drawing on the cover: a box round it in the cover's design px.
2. Set film.json `sticker2d`: `{ "from": "assets/<cover>", "cardWidth":
   <the cover's width in design px>, "crop": [x0, y0, x1, y1] }` and add
   `@sticker2d` to `recipes`: it lifts the drawing out as a card with a cream
   rim (`assets/sticker2d.png`, `build/sticker2d.json`).
3. In the cover recipe (`references/cover-wall.md`), save two textures: the
   cover as published, and the same with the drawing filled in with the
   paper around it (`fill()`), because while the toy is out, the drawing must
   not be there twice. Worked example: `example/isnail/recipes/cover-retro.py`.
4. The toy's pose on the card is the drawing's: the last pose before the
   poof (pointing up, a lunge) should match it.

## Later (v2): a sticker on any cover

A cover without a drawing could still get the sticker exit: paste the flat
toy (`build/lookdev/avatar-toy.png`) onto the cover as if printed there, so
the toy has a drawing of itself to become. Not in v1: try it while making v2.
