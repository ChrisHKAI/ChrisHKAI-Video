# isnail: a whole film, worked

The workspace of 蜗牛King's film (@isnail) in the engine, as a worked
example of everything an agent writes for one creator: `film.json` (the
research, the story's wall roles, the end card), `toy.json` (the parts
kit), and `recipes/`: the two cover recipes (`cover-pinned.py`,
`cover-retro.py`, `references/cover-wall.md`) and the flat profile picture
(`avatar.py`, `references/avatar.md`). Its end card's prop is the built-in
snail (`templates/isnail-30/props/snail.js`, `references/props.md`) and it
leaves act 3 by the sticker exit (`references/exits.md`).

## Running it

1. Copy this folder somewhere outside the skill.
2. Put the creator's pictures in its `assets/`: `avatar-real.jpg`,
   `banner-real.jpg`, `cover-large.jpg` and `pinned-cover.jpg` from
   `examples/isnail-intro/assets/` at the top of this repository.
3. Fetch the 公众号 mark (`assets/gzh-logo.png`) yourself (WeChat's own
   pages) and set the crop in film.json `cta.prop.shape`; it is not kept
   here.
4. `FILM=<folder> node <skill>/engine/run.mjs lookdev -- --avatar`, then
   `data`, `storyboard`, `render`, `finish` (SKILL.md).
