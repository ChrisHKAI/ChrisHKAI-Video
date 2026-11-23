# Tests

Codex installer (offline; temporary skills folders only, no rendering tools):

```sh
python3 tests/install-codex.test.py
```

Checks link and copy installation from another working directory, paths with
spaces, complete engine/resource copies, repeat installation, preservation of
existing skills and broken links, dry-run behavior, and repo-local discovery.
These checks do not constitute a complete Codex-directed film test.

The ledger of delivered films (offline; a temporary home, never
`~/.chrishkai-video`):

```sh
python3 tests/ledger.test.py
```

Checks that what two films each made for themselves is not counted the same
by its name, that near colours count as one and greys as none, that old
entries' own names read as own, that every film kept says its story in words
(and a film kept before words takes the skill's), and that the story test
can read those words.

A story's frames (offline; needs Pillow and numpy, and finds the skill's own
Python when this one has none):

```sh
python3 tests/frames.test.py
```

Checks that the stage draws a frame with what is put on it (a standing
picture, a block, the toy's cut-out, lettering, a mark), that the creator's
picture stands in before the toy is built, that a rendered pose is taken with
its scale, that every pose has its joints, a view and what it says, and that
the poses for when things go wrong are moves in the film too, that a pose
not rendered yet is said (with the command that renders it) while the
creator's picture stands in, that a 9:16 film's frame is 9:16, and that the
storyboard page keeps its own helpers to the end (a name reused by one of
its checks once took the page down for every film unlike the ones before)
and shows the story's paper frames above the previews; that a box of
lettering is blurred past its strokes and the rest of the picture left, that
a mark alone (！ ？) is not lettering, how tesseract's table is read and what
of it is trusted, and, where this computer has text recognition, that a
frame read again after its words are taken off has none left. The poses themselves
are rendered in Blender from a film's own toy, in seconds:
`FILM=<film> node skills/creator-toy-intro/engine/run.mjs poses`.

The pipeline is checked against a reference film: a folder laid out like a
film workspace (`build/`, `assets/`) whose outputs are known to be right.

```bash
FILM=films/isnail node skills/creator-toy-intro/engine/run.mjs data
node tests/regress.mjs films/isnail <reference film folder>
```

`regress.mjs` passes byte-equal files and reports the first differing path of
a JSON file; `build/glyphs.json` may be a subset of the reference's.

Rendered frames:

```bash
FILM=films/isnail node skills/creator-toy-intro/engine/run.mjs render -- --frames 1,151,391,661 --samples 128 --scale 100 --out build/render-check --look classic
python3 tests/framediff.py films/isnail/build/render-check <reference frames folder> --sheet diff.jpg
```

Cycles on the GPU differs by at most a level or two between runs of the same
scene; more than that means the scene changed.
The reference frames were made before the PBR Neutral look, so they are
compared with `--look classic` (which reproduces them to within a level).

Step 2 (research) round trip: writes the research the film's own film.json
implies, opens a new workspace, builds the material table, applies the picks
and checks that the profile, posts, counter and end card come back the same.

```bash
node tests/research-roundtrip.mjs films/isnail <scratch folder>
```

Theme layouts: `node tests/make-theme-films.mjs films/isnail` makes a 9:16
test workspace per phone theme (films/test-<theme>) with test values.

Which GPU Cycles renders on (`engine/lib/device.py`), from fake device lists
(no Blender or GPU): OptiX before CUDA, HIP, oneAPI and Metal; the CPU with a
warning; a card the preferences remember from another computer is not used.

```bash
python3 tests/render-device.test.py
```

Story direction and evidence checks (offline, no Blender or paid search):

```bash
node --test tests/story-directions.test.mjs
```

Also covers a story told as a scene: the line a viewer retells, the first five
seconds, the scene and its frames on the story page (and what the page says
when a direction lacks them), one count at most, the two readings by someone
told nothing (the page without words gives the pictures and nothing under
them, neither page holds the line, what the reader said of the pictures
alone is the review's ninth question; the review asks three more answers),
a 9:16 film's frames three to a row, and each move for when things go wrong
against the joints of the pose its frame shows.

Covers direction selection through film.json, the existing point/proof formats,
nested number provenance, material pages in three languages, resume guidance,
and saved second-round research parsing without overwriting the first round.

The same suite also covers the preproduction story test: missing/revise/stale
reports cannot move a selected direction into modelling, action meanings are
required and shown, source/ending edits invalidate the review, and legacy point
picks still work. Ready reports in unit tests are integration fixtures, not proof
that a story is compelling.

`tests/fixtures/story-comparison.json` supplies two fictional cuts from the same
source packet for qualitative evaluation. Give each generated `story-test.md` to
a fresh reviewer without revealing an expected verdict. Compare its takeaway,
continuation, specificity and action-meaning answers; no watch-time improvement
is claimed without audience testing. This evaluation does not render video.

Optional browser layout checks (requires an existing Playwright installation and
Chrome/Chromium; does not install either):

```bash
CHROME=/path/to/chrome PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/materials-browser.mjs
```

Exercises a three-direction page with alternative hooks at 390, 700 and 1200px
in all three languages, checking horizontal overflow, column changes, the final
choice prompt and full-page screenshot capture. The temporary fixture is removed
afterwards. This tests browser layout, not the CLI PNG-export path or CJK font
availability; inspect with installed Chinese fonts for final typography approval.

Whether a toy is in one piece (`engine/lib/toyparts.py`: floating, hidden,
lying on another part), in Blender on balls built for the purpose:

```bash
python3 tests/toy-parts.test.py
```

Whether the eyes behind a toy's lenses are lit and seen
(`engine/lib/toyblend.py`), in Blender, on the light paths the look-dev and
the film share: an eye behind a sculpted lens and behind a part-built
`glass` lens, from the front and from the side, against the same eye with no
lens:

```bash
python3 tests/lens.test.py
```

Prop-vs-prop and prop-vs-picture-card 3D clearance (`engine/lib/clearance.js`
and `engine/scripts/clearance.mjs`, offline; no Blender):

```bash
node --test tests/clearance.test.mjs
```

Checks hinged/moving door-through-card piercing, intersecting angled picture
cards, deep prop-into-prop embedding, settled end-card torn-paper label
overlaps, colliding 3D headline lines (`lineOverlaps`), camera-frustum
edge-crop warnings (including custom-beat props and 3D headlines), 2D
camera-space picture-card occlusions (`cardScreenOverlaps`), foreground props
crossing in front of `hero_head` (`heroFaceOcclusions`), dense confetti bursts
lingering over 3D readouts (`confettiOverText`), zero-false-positive guards for
compound parts, `declareLine` / `fastReveal` line-name separation (`slo1` vs
`slo2`), `floatingSmallLetters` double-shadow detection, `armLiftLimit`
wide-headed chibi arm clamping, `offStageHero` / `offStageObjects` missing-`at()`
and double-`at()` detection, `oversizedUiBoxes` raw-`trs()` picture-card
detection, `movieWraps` cyclic video wrap warnings, `qFlat` horizontal
floor-ring quaternions, `cutout()` / `picture({ cyclic: false })` helpers, the
`clearance.mjs` CLI exit codes / `build/clearance.json` output, `ui.js`
`pageless()` opt-in/opt-out and `page.image`/`page.panels` auto-detection,
`places.js` `two-column` non-overlapping default end-card layout, and
`tim-line/figure.js` `roundBox` mm→m conversion.

Engine reliability fixes (`pacing.slanted` hidden-letter filtering, `diff-anim.py`
hidden-track, `unitScale`-metadata & texture-asset `--images`/`--since`
filtering, `fonts.chosen` `"Family:Style"` string shorthand, `reading.match`
split-line cover, `compare.py --frames`, `score.py` groove fallback,
`run.mjs` `clearance`/`diff` & incremental `animatic -- --frames` steps,
`safezone.py` dynamic `EV.final` hold threshold, `check.mjs` active-`act2`
counter & blank-`ui.png` gating, and Blender 2D curve bevel miter-spike
flattening):

```sh
python3 tests/engine-fixes.test.py
```
