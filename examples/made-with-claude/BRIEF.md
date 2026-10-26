---
workflow: general-video
flow: automation
storyboard: no
message: "Claude can drive After Effects by itself"
destination: x-feed
aspect: 1920x1080
language: en
length: 12s
angle: recreation
---

## Intent

Recreate the reference film analysed in `../../reference/ANALYSIS.md` (the
@0xwhrrari "Opus 5.5 replaced After Effects" clip). One continuous 3D camera
move over a tilted After Effects interface: the orange Claude mascot is
selected in the comp, breaks out through the viewer, hops along the menu bar,
drags the Glow effect onto the title, rides the playhead across the timeline,
presses Preview, and the camera settles on the finished
"MADE WITH CLAUDE / OPUS 5.5" title. User asked to build it directly ("直接整片").

## Assets

- ../../reference/source.mp4 — reference only, never placed in the film.
- ../../reference/ANALYSIS.md — shot timing, palette, sound map.
- ../../reference/prompt-no-after-effects.pdf — the author's prompt pack (beats, look, sound prompt); followed as the spec.

## Customizations

- Look: Three.js scene (not Blender, which isn't installed) with depth of field, bloom and 12-sample sub-frame motion blur.
- One timeline (src/timeline.js) drives the UI texture, the 3D scene and the sound, like the PDF's timeline.py.
- Every hop lands on the 120 BPM beat grid (0.5 s); drop at 2.0 s = Clawd breaks the viewer.
- Sound synthesized in Python per the PDF's sound prompt (scripts/sound.py); Sonilo was not needed.

## Notes

- AE interface is drawn in code (no screenshots of Adobe software).
- Mascot colour is Claude orange #D97757; the Info panel shows R:217 G:119 B:87.
