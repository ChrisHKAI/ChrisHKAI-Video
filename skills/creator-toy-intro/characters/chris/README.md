# Chris

Chris (X @ChrisHKAI), who makes these films, as a designer vinyl toy: the
sculpt kit's worked example, a person from a chibi character sheet. Messy
dark-brown hair swept over to his right above a short undercut, black
frames, the big grin with his top teeth, a bright blue tee, navy trousers
with rolled cuffs, white sneakers with a blue heel tab. About three heads
tall, 120 mm. The isnail mascot's finish is the bar: full, solid, polished.

```bash
python3 characters/chris/sculpt.py --out <folder> [--h 0.25] [--only head,hair]
FILM=<film> python3 engine/scripts/import-sculpt.py <folder> --manifest chris.json
```

`--h` is the voxel size in mm: 0.4 while shaping (about 25 s for the whole
toy), 0.25 for the film (about a minute). It needs scikit-image (step 0
installs it).

## How it is built

Every part is a signed distance field (`engine/lib/sdf.py`): primitives,
smooth unions and cuts, surfaces projected onto others. Each is meshed by
marching cubes and painted per vertex (colour and roughness), then written
in its own frame with the bone it rides on. The eyes are painted once into
`eye.png` and mapped over the eye pieces' fronts. Swappable pieces come in
`variants`: mouths (grin, grit, oh), eyes (open, happy, squint), hands
(relaxed, grip, point, open); the film takes the first of each.

- The hair is a mass over the undercut plus about 70 squashed clumps flowing
  from the crown; seeded, so it rebuilds the same. No parting.
- The undercut is paint on the head, not geometry: from the mass's edge down
  to above the ears and the nape.
