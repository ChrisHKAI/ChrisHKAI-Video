# Chris toy

Chris (X @ChrisHKAI), the films' maker, as a designer vinyl toy: the mascot
for the end tags of his films, kept here so every film uses the same one.
From his chibi sheet (`reference/chris/chibi-character-sheet.webp`): messy
dark-brown hair swept over to his right above a short undercut, black
frames, the big grin with his top teeth, a bright blue tee, navy trousers
with rolled cuffs, white sneakers with a blue heel tab. About three heads
tall, 120 mm. The isnail film's mascot is the bar for finish (the user,
2026-10-23: full, solid, polished; not the Tim film's toy line).

## Build

| step | command | writes |
| --- | --- | --- |
| sculpt | `.venv/bin/python chris.py [--h 0.25] [--only head,hair]` | `build/parts/*.npz`, `build/chris.json`, `build/eye.png` |
| assemble | `blender -b --factory-startup -P blender/build.py` | `chris-toy.blend` |
| look-dev | `blender -b chris-toy.blend -P blender/lookdev.py -- [--views hero,front,side,back,face,facefront,top,orthofront,orthoside,orthoback] [--samples 96] [--w 1280 --hgt 720] [--out build/present]` | `build/lookdev/*.png` |
| turntable | same with `--turntable 96 --w 720 --hgt 720`, then ffmpeg at 24 fps | `build/turntable/####.png`, `build/chris-toy-turntable.mp4` |
| beside the sheet | `.venv/bin/python compare.py` (after the ortho views) | `build/compare.jpg` |

`--h` is the voxel size in mm (0.25 for finals, ~1 min; 0.4 for quick looks,
~20 s). The venv (`.venv/`, numpy + scikit-image + pillow) is local to this
folder.

## Using it in a film

Append or link the collection `ChrisToy` from `chris-toy.blend`. It holds the
armature `ChrisRig` and rigid parts parented to its bones, like a jointed
vinyl figure: `root`, `hips`, `spine`, `head` (the head carries the hair,
eyes, brows, teeth, tongue, glasses, lenses and nose pads), `upper_arm.L/R`
(sleeve and upper arm), `forearm.L/R` (forearm and hand), `thigh.L/R`
(trouser leg), `foot.L/R` (shoe, laces, heel tab). L is his left (+x); he
faces -y; the origin is between his feet on the floor; metres.

## Sources

- `sdf.py`: signed distance fields in numpy (primitives, smooth booleans,
  squash, projection onto a surface) and marching cubes.
- `chris.py`: the toy, part by part, with its paint (per-vertex colour and
  roughness), bones and the painted eye texture.
- `blender/build.py`: materials (vinyl from the vertex colours, the glossy
  eyes from `eye.png` in each eye's own frame, glass lenses), the rig, the
  parts.
- `blender/lookdev.py`: the isnail look-dev studio (three suns, a dark floor).

## Notes

- The hair is a mass over the undercut plus ~70 squashed clumps flowing from
  the crown; seeded, so it rebuilds the same. No parting (the user's call).
- The undercut is paint on the head, not geometry: from the mass's edge down
  to above the ears and the nape.
- Not done yet: expressions (eyes and mouth to swap), hands to swap (grip,
  point, wave).
