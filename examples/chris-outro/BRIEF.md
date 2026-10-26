# Chris outro

A 23.5 s tag joined to the end of the Tim film (`videos/tim-intro`, 142.9 s):
Chris (X @ChrisHKAI, the films' maker) as his own vinyl toy, the reusable
mascot in `characters/chris-toy/` (isnail-level finish, not the Tim film's toy
line: the user's call, 2026-10-23), from his chibi sheet. Blender Cycles,
1920x1080 (the Tim film's size: the user's call, no 4K), 30 fps. Status
(2026-10-24): the final render.

References (`reference/chris/`): `chibi-character-sheet.webp` (front, side,
back, six expressions, palette: deep brown hair, ink-black frames, bright blue
tee, warm skin, soft white), `x-profile-verified.webp` (his profile on his
phone, the blue check; 3,231 followers that day), `x-profile-pending.webp`
(the same before the check came through), `x-profile-2026-10-24.webp` (the
display name is "Chris" with the blue check, @ChrisHKAI under it; 487
following, 3,276 followers). `reference/clawd-pixar/` (the CLAWD film and its
prompt pack): the look on the floor.

## Music

"Funky Groove Stomp" (the user's pick, 2026-10-23): Sonilo text-to-music on
the user's sonilo.com Pro account (commercial licence),
`assets/audio/candidates/3-FunkA-Funky-Groove-Stomp.m4a` (AAC 256 kbps,
44.1 kHz, 20.0 s). Tight drums, slap bass, wah guitar, brass. Measured:
118.8 BPM (beat 0.505 s, bar 2.02 s), the first beat at 0.108 s.
- 0.108 a brass hit, then a one-beat pickup; the groove comes in at 1.118
- bar downbeats: 2.128, 4.148, 6.168, 8.188, 10.208, 12.228, 14.248, 16.268
- 9.2–10.2 a fill (busier onsets) into bar 6
- 16.27–18.29 the brass holds a chord (the build)
- 18.288 the stinger (the strongest hit in the track), then a ring-out to
  silence by ~19.3

Film time = song time + 1.2 s (the 4S's exit before the first hit).

The other five candidates stay in `assets/audio/candidates/`. The Sonilo API
is a separate pay-as-you-go platform (platform.sonilo.com) and is not used.

## Story (film s; every cue in scripts/timeline.py, the picture on an even beat grid)

1. 0–1.2: the Tim film's last frame (the black iPhone 4S) sinks into the dark.
2. 1.3: the iPhone 18 Pro springs up; 2.3 its screen wakes; 3.3 in on X; 4.3
   the icon presses; 4.4 the app opens; 5.3 his profile ("Chris", the blue
   check, @ChrisHKAI), held a second.
3. 6.4: the avatar swells a second; 7.4 it pops into the toy.
4. 7.5–8.0: the page blows up behind him (about 17 times) till its type is as
   tall as the name on the floor; the handle's letters are 3D from here, flat
   and pure black (SF Pro Heavy), the @ dropped.
5. 8.4: he drops onto the handle: the black C bursts out under him; the app
   fades to the page's plain white. h r i s H K A I push out three quarters of
   a beat apart (the user's pick of three speeds), the camera gliding along
   them; out to the whole name, held about 1.5 s.
6. 12.9: three hops on the C: it turns white and the page behind it turns black
   (dark mode, following him), it gives, gives more, drops; then a letter a
   beat, each white under him on the next note of a scale, dropping as he
   leaves it. 17.0: the I goes: a moment in the air; 17.5 he falls as the page
   floods black, the camera locked on him, into the floor's 35 mm lens.
7. 18.5 the stinger: he lands on the I of "Chris HKAI" on CLAWD's grey satin
   floor (no motion blur on those frames: he stops dead); a wink, a point, the
   glint; out to the card; held four seconds, to 23.5.

The music is re-cut to the picture (`EDL`): two beats out of the profile, two
out of the swell, bar 6 played twice; the stinger stays on its beat.

## Pipeline

| step | command | writes |
| --- | --- | --- |
| fonts | `python3 scripts/fonts.py` | `build/SFPro-Black.ttf`, `build/SFRounded-Black.ttf` |
| screens | `python3 scripts/ui.py` (headless Chrome at 3x; the blown-up band at 12x) | `assets/{home,profile,name,link,avatar,x-logo,name-paper,screen-blank}.png`, `assets/profile-{zoom,blank}.jpg`, `build/ui.json` |
| screen frames | `python3 scripts/screen.py` | `build/screen/####.jpg` (the phone's screen, frame by frame) |
| handle letters | `python3 scripts/strip.py` | `build/strip.json` (each letter's place in the handle's print) |
| sound | `python3 scripts/sound.py` | `assets/audio/score.wav` (the music and the synthesized effects) |
| render | `blender -b --factory-startup -P scripts/scene.py -- [--frames 1-645] [--samples 32] [--scale 100] [--noblur] [--out build/render]` | `build/render/####.png` |
| storyboard | frames from `python3 scripts/storyboard.py --list` rendered `--samples 32 --scale 50 --out build/sb`, then `python3 scripts/storyboard.py` | `storyboard/分镜.jpg` |
| preview | render `--samples 12 --scale 25 --out build/animatic`, then ffmpeg with `assets/audio/score.wav` | `out/chris-outro-preview-v*.mp4` |
| final | render `--samples 48 --scale 100 --out build/render` (about 3 s a frame on the Mac's GPU), then `python3 scripts/finish.py` | `out/chris-outro.mp4`, `out/tim-intro-with-outro.mp4` |

`scripts/scene.py` builds the world (the phone, the screen pieces, the
letters, the toy appended from `characters/chris-toy`, lights, camera) and
runs `scripts/choreo.py` for all the motion; `scripts/timeline.py` holds
every cue.

## Decisions (the user's)

- 2026-10-24: everything on the floor is CLAWD's design: Archivo Black
  (`assets/archivo-black/`, SIL OFL, from Google Fonts), white plaster letters
  (PIXAR's white, measured), a grey satin floor fading to black, blurred
  reflections, a black void, a 35 mm lens low and centred. The view transform
  stays Standard (AgX greyed the phone's UI and his tee).
- 2026-10-24: the letters about his height (cut by 32% from the first size, so
  he reads in the end card); the font's own spacing.
- 2026-10-24: the profile as it is ("Chris" + check, @ChrisHKAI under it); he
  takes the handle, not the name line. No paper strip: the page blows up and
  the handle's letters push out under him (the snail film's wall), black, and
  turn white as he stomps (the user's wife: a letter falls each time he leaves
  it; the C takes three hops). The app goes as he lands; no @. Close framing,
  things cut by the frame's edges, as in the snail film.
- Blue check (verified 2026-10-23); follower count refreshed before render.
- Music: Funky Groove Stomp. Status bar 9:41 (as on the 4S); the UI in his
  phone's Traditional Chinese, the bio as he wrote it.
- 2026-10-24: the page stays white and the letters pure black ("Chanel" black,
  `INKS`), white under his feet as the page goes black behind (dark mode); SF
  Pro Heavy, 10% tracking, letters standing off the page at the floor's depth,
  the camera square on (deep letters hid the A's counter and turned HKAI); the
  push-outs three quarters of a beat apart; the card held four seconds.
- Earlier versions: `build/backup-stone/` (stone letters), `build/backup-before-stomp/`
  (the torn paper strip).

## Open

- The iPhone 18 Pro's shipped look (only pre-launch leaks found so far: a
  smaller Dynamic Island, new colours); mostly its front is seen.
- Sound effects: our own synth kit (scripts/sound.py) for now; Sonilo text-to-SFX
  if it needs more.
