# The flat profile picture

The film opens on the creator's profile page; the profile picture peels off
like a sticker and pops into the 3D toy. For the pop to read as "the
picture came alive", the picture that peels must already be the toy: so
you redraw the profile picture with the toy in it, in the style of the
creator's own picture. The page shows this picture (`assets/avatar.png`),
not the original.

Worked example: `example/isnail/recipes/avatar.py`. isnail's own picture is
his drawn mascot on a red disc with confetti and leaves inside X's black
ring; the recipe paints the same disc, confetti and leaves, then puts the
toy rendered flat in the middle, so the 2D strips that peel and the 3D toy
that pops are one character.

## Steps

1. Render the toy flat: `FILM=<film> node engine/run.mjs lookdev --
   --avatar` writes `build/lookdev/avatar-toy.png`: the toy facing front,
   flat colours with an inked outline, on transparency.
2. Write `recipes/avatar.py`: a 1024 px square, transparent outside the
   circle, that rebuilds the creator's picture around the toy:
   - the background of their picture: its colour, gradient, pattern or
     scene, simplified (a photo's room becomes two or three flat shapes);
   - the toy (`avatar-toy.png`), cropped to its bounding box and scaled so
     the head fills about half the picture, as their face or mascot does;
   - what makes the picture theirs: a ring, a frame, confetti, a logo
     corner, their colours;
   - the platform's own ring if the app draws one (X's black border).
3. List it last in film.json `recipes` (after `lookdev -- --avatar` has
   run once), and look at it beside the original: at a glance it should
   read as their picture.

A real person's photo becomes a drawn picture of their toy: keep the
photo's light, background colour and framing, so followers still know it.
