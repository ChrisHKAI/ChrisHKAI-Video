# The profile picture

The film opens on the creator's profile page; the profile picture peels off
like a sticker and pops into the 3D toy. The picture that peels is the
creator's own, exactly as their page shows it. Never redraw it, in any case:
the page in the film has to match their real page, and a redrawn picture no
longer does (the user, after the first test with a new creator). The pop
reads as the picture coming alive because the toy is made from that picture
(step 3), not because the picture was changed.

## The step

`@avatar` (`engine/scripts/avatar.py`) cuts the picture research saved
(film.json `profile.avatar`, the original at full size) to a circle, sets it
inside the ring the app draws round it and writes `assets/avatar.png` (1024 px,
transparent outside), the sticker that peels. `new-film.mjs` puts `@avatar`
in film.json `recipes`, so `run.mjs data` makes it every time.

The ring: on the X themes, X's black ring round the picture (4 px round 134 px
on the web); film.json `avatarRing` changes its colour (`"#FFFFFF"` for X's
light page) or turns it off (`false`, the default on the other themes).

## Check

Look at `assets/avatar.png` beside the creator's picture on their real page:
the same picture, the same framing, the ring like the app's. Nothing else to
make or approve here.
