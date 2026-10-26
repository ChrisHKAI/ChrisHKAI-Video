# Merge Conflict

A 19.2 s voxel fight film: Clawd (Claude orange #D97757) vs a DeepSeek whale
(#4D6BFE) inside a VS Code-style dark editor (no logos), floating glass slabs,
rendered in Blender Cycles. 1920x1080, 30 fps, 150 BPM (bar = 1.6 s, 12 bars),
draw ending, title "MERGED.".

## Pipeline (one timeline drives everything)

| step | command | writes |
| --- | --- | --- |
| UI + cue dump | `node scripts/build-ui.mjs` | `assets/ui.png`, `build/timeline.json` |
| per-frame textures | `node scripts/render-atlas.mjs [--frames 1-576 \| 13,99]` | `build/atlas/####.png`, `build/glyphs.png`, `build/keycap.png` |
| motion | `node scripts/export-anim.mjs` | `build/anim.json` (2 samples/frame, only changing keys) |
| render | `blender -b --factory-startup -P scripts/scene.py -- --frames 1-576 --samples 128 --scale 100` | `build/render/####.png` |
| animatic | same with `--engine eevee --samples 4 --scale 33 --out build/eev` (~2 min) | |
| sound | `python3 scripts/sound.py` | `assets/audio/score.wav` |
| finish | `python3 scripts/finish.py` | `out/merge-conflict.mp4` |
| contact sheet | `python3 scripts/sheet.py <dir> <out.jpg> <frames> [cols] [width]` | |

## Sources

- `src/timeline.js` — layout, story events (`EV`), places, hops, camera keys, shakes, sound cues.
- `src/hero.js` — the voxel fighters from text grids (shell only), pivots, the 5x7 title font.
- `src/anim.js` — every object's transform at time t: slow-mo warp, both choreographies,
  the burst + Ctrl+Z rewind, the explosion simulated at 240 Hz, beam/spout/spark pools, camera.
- `src/code.js`, `src/editor.js` — editor text, merge collapse, terminal transcript, atlas painter.

## Notes

- Cubes are parented to their hero; while they fly their local transform is world ÷ hero,
  so the hero must be unsquashed (`rigid`) in those windows.
- Half-swapped colours are per-cube object colours (Object Info), keyed only when they change.
- Hidden objects are parked where they next appear (scale 1e-4) so motion blur never streaks them.
- Full-res 128 spp ran ~7 s/frame on the M3 Max.
