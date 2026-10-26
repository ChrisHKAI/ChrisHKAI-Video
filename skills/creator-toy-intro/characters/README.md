# The toys

Every toy made for the films so far, in the formats step 3 builds
(`references/toy.md`), to learn from and to start a new toy from. Put a
toy.json in a film workspace (film.json `"toy": "toy.json"`), or bring a
sculpt in with `engine/scripts/import-sculpt.py`.

| toy | kit | from | files |
| --- | --- | --- | --- |
| 蜗牛King's mascot (isnail) | parts | the creator's avatar | `isnail/toy.json` |
| Kin's calico cat (@KinGao476942) | pet | his avatar, a photo of the cat | `kingao-cat/cat.js` → `toy.json` |
| Tim (Tim Pan, 影视飓风) | pet, the Tim line | a still from his video | `tim-line/figure.js`, `tim.js` → `tim/toy.json` |
| Steve Jobs | pet, the Tim line | his portrait | `tim-line/figure.js`, `jobs.js` → `steve/toy.json` |
| Chris (@ChrisHKAI) | sculpt | his chibi character sheet | `chris/sculpt.py` |

```bash
node characters/build.mjs [--expression happy]   # the cat, Tim and Steve → toy.json
```

The Tim line is one mould for both men: one head with face pieces for
every expression (`EXPRESSIONS` in `figure.js`: surprised, happy, focus,
strain, tired, calm, moved, gentle), posable brows, elbows, hands and
thumbs, a big toy head (the head joint's scale), hair, glasses and clothes
per person. `build.mjs` keeps one expression's pieces; the extra joints
(chest, elbows, hands, thumbs, brows) rest under their parents in the story.
The cat's front legs are its arms and its hind legs its legs, so it waves a
paw where a person points.
