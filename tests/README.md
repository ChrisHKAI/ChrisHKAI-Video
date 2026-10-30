# Tests

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
