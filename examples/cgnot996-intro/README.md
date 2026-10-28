# cgnot996 intro

A 42 s self-introduction film for the X creator 铁柱AGI (@cgnot996), the
first film `creator-toy-intro` made for a real creator (stage 4, October
2026), shown here with his permission. 1920x1080, 30 fps, 120 BPM, Blender
Cycles at 48 samples.

1. Opening: his X page fills the frame flat like a screen, turns and backs
   off as its columns part into standing slabs; his picture bulges and he
   puffs out of it on the 2.0 s downbeat.
2. 10,000 followers: a desk calendar flips from 7月10日, faster and faster,
   while the count climbs; at 10.0 s it stops on 10月24日, the count locks on
   10,000 and a red 万粉 stamp slams on.
3. Where he started, the Grok App: his 7/30 post's cover stands as the wall;
   he points at 380, which turns into gold 3D digits counting to 1,500 stars.
4. Wild → official ambassador: 野生大使 on his head, the invitation flies in
   as an envelope, a red 官方认证 seal slaps on and 野生 bursts off; Ben Lang's
   post pops up.
5. 马斯克得不到的男人 rises a letter at a time; he kicks the red 不 out.
6. Call to action: he lands on his prop, the lines slap down, he points at
   you and holds.

The sound is the effects over a quiet layer of long chords that change with
the picture, picked by ear in a listening test over two synthesized songs
(the skill's `"sound": "bed"` comes from this film).

## What is here

The film's workspace as it was made, without `build/` and `out/` (the
finished film is `cgnot996-intro.mp4` on the Releases page, tag `films`):

| path | what it is |
| --- | --- |
| `film.json`, `toy.json` | the content, story numbers and look; the toy (sculpt kit) |
| `template/` | the film's own story: timeline, choreography, world, beats, score |
| `theme/`, `ui/` | its X page, as code and as the HTML that was screenshotted |
| `engine/` | film-local copies of `scene.py`, `glyphs.py`, `finish.py` (a gentler bloom) and `blender.sh` |
| `recipes/`, `toy/` | the cover cuts, the avatar and the prop; the toy's sculpt |
| `research/` | the facts found on his profile and the material table he picked from |
| `assets/` | his picture, banner and post covers, and the synthesized score |

## Rebuilding it

The code imports the skill's `engine/lib` by the absolute path of the
workspace it was made in (`/Users/chris/Developer/ChrisHKAI-Video/…`), and
`film.json` reaches its template as `../../../films/cgnot996-intro/template`:
put the folder at `films/cgnot996-intro/` of a checkout and change those
paths to yours. It was built on the skill as of commit `3a4714a`: check
that out to rebuild it exactly.

His profile picture, posts, covers and name belong to him; the code is MIT
like the rest of the repository.
