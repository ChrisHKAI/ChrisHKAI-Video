# A story's frames: the storyboard on paper

- [Why](#why)
- [The toy's poses](#the-toys-poses)
- [Composing a frame](#composing-a-frame)
- [What makes a frame worth showing](#what-makes-a-frame-worth-showing)
- [Into the story](#into-the-story)

Read with `references/story-directions.md`, before the story page is built.

## Why

A direction promises an image. Until that image is composed as a picture,
nobody has seen it: not the user who chooses the story, not the agent who
builds it. One film's promise was "three big words fall from the hall's
ceiling and he catches them"; its sketch was three labels with arrows
pointing at the creator's picture; what was built was three small labels on
an empty floor. The sketch was a diagram of the idea, and the film came out
as the diagram.

So each direction is drawn first as five to seven frames, each composed as
the film will frame it: the film's own toy in the pose it takes, their own
material standing as the set, the words that are on screen and no others.
A frame takes a second to draw. A story is changed on paper, where a change
costs nothing; the user chooses between stories they can see; and a reader
who is told nothing can say what the pictures tell without their words,
and then what the frames plant (`references/story-test.md`: the silent
reading, then the blind one).

## The toy's poses

```bash
FILM=<film> node <skill>/engine/run.mjs poses                          # every pose, each from its usual side
FILM=<film> node <skill>/engine/run.mjs poses -- startle,kick:right    # these; pose:view, pose:view:close
```

The film's own toy, alone, on a clear background, a few seconds each, in
`build/poses/` (with `poses.json`: each cut-out's scale). It needs the toy
(step 3 can run beside step 2: build the toy as soon as its picture is
agreed); before there is one, the kit stands the creator's picture in its
place, and the frames are drawn again when the toy arrives.

`engine/lib/poses.json` names the poses and what each says:

| pose | says |
| --- | --- |
| `stand` | at rest |
| `holdUp` | both arms up: a sign, a prize, a thing over its head |
| `hop` | mid-stride, in the air |
| `startle` | thrown back, arms flung up: a surprise, good or bad |
| `duck` | head down, arms over it: something is coming down |
| `slump` | head hanging: at a loss, let down |
| `shrug` | arms out, head to one side: well, then |
| `lookUp` | head back, looking up at something big |
| `push` | leaning into a weight with both arms (seen from its side: the weight stands before it) |
| `kick` | one leg out: kicking a thing away (seen from its side) |
| `point`, `pointLeft` | an arm out at something |
| `present` | an arm raised to what stands behind it |
| `speak` | a hand before its mouth: a microphone, a word to the viewer |
| `balance` | arms out, feet apart: riding something |

Views: `front`, `q-left` / `q-right` (a quarter turn), `h-left` / `h-right`
(half), `left` / `right` (its side), `back`, `back-left`, `back-right`;
`close` frames its head and shoulders. A view is named for the side of the
frame the toy faces: `push:right` leans into a weight on its right,
`kick:left` sends a thing off to the left, `point` (from `h-left`) points to
the left and `pointLeft` to the right. Each pose has the view it reads best
from; ask for another when the frame wants the toy facing the thing it acts
on. A pose of the film's own goes in
film.json, in the same shape: `"poses": { "bow-low": { "joints": { "body":
[0.5, 0, 0], "head": [0.3, 0, 0] }, "view": "q-left" } }` (joint turns in
radians, the joints toy.json names). The same poses are moves in the film
(`engine/lib/beatkit.js`: `startle`, `duck`, `slump`, `shrug`, `lookUp`,
`push`, `kick`, `holdUp`), so what a frame shows can be played.

A toy's face does not move. What it feels is in its body, and where that is
not enough, in a mark over its head: `mark("!")`, `"?"`, `"…"`, `"sweat"`,
`"heart"`.

## Composing a frame

`engine/lib/stagekit.py` is a small stage: boxes, standing pictures, the toy's
cut-outs and lettering in one perspective, drawn with Pillow. The world is in
toy heights (a toy is 1 tall): x to the right, y up, z away from the camera.
A frame has the film's shape: `Stage()` is 1600 × 900; a 9:16 film's is
`Stage(w=900, h=1600)`, and the story page stands those three to a row.

```python
import sys; sys.path.insert(0, "<skill>/engine/lib")
from pathlib import Path
from stagekit import Stage, toy, thing, load, text, paper, board, stamp, mark, faces

film = Path("<film>")
faces(film)                                           # letter in the film's own faces, once it has chosen them
st = Stage(cam=(0, 1.1, -5.2), pitch=5,               # where the camera stands, how far it looks down
           sky=("#EFE6D6", "#F7F1E6"), floor=("#EBDFCB", "#F3EADB"))   # their colours, not the skill's
st.card(load(film / "assets/p-guide.jpg"), 1.8, 0.5, 2.3, height=1.15, yaw=-8)   # their cover, standing like a sign
st.box(-1.2, 0, 0.4, 1.2, 0.33, 1.0, "#F0842C")       # a stepping stone: x, y, z, then wide, high, deep
st.sprite(toy(film, "startle"), -1.2, 0.4, y=0.33)    # the toy on it
st.screen(mark("!", 110), *st.at((-1.2, 1.45, 0.4)))  # over its head: at() says where a point of the world lands
st.screen(paper("铁柱AGI", 64), 300, 160, rot=-3, shadow=110)   # a label on the frame (frame pixels, 1600 × 900)
(film / "research/frames").mkdir(exist_ok=True)
st.save(film / "research/frames/a-4.jpg")       # STAGEKIT_SILENT=1: its wordless twin in silent/
```

`toy(film, pose)` takes a pose as `run.mjs poses` rendered it (`"startle"`,
`"kick:right"`, `"stand:back:close"`). One not rendered yet is drawn as the
creator's picture on a small body, and the kit says the command that renders
it: a frame with a disc where the toy should be is not finished.

The pieces (each is in the module's own notes):
- `Stage.card` a picture standing (a cover, a screen, a page; `tilt` leans
  it, `glow` lights it, `dim` darkens it, `blur` puts it out of focus);
  `Stage.lying` a picture on the floor; `Stage.quad` any four corners.
- `Stage.box` a block, with a picture on a face (`tex={"front": …}`);
  `Stage.floor_poly` a pit, a runway, a pool of light; `Stage.poly`.
- `Stage.sprite` a cut-out standing in the world: the toy (`toy(film, pose)`,
  `toy(film, "kick:right")`), or anything drawn (`thing(picture)`, with
  `height=`).
- `Stage.screen` straight on the frame: a label, a mark; `Stage.lines`,
  `burst`, `confetti` for a move and a hit.
- `text`, `paper` (a torn label), `board` (a sign, a bubble;
  `marks={"不": "#D8382D"}` paints one character), `stamp`, `arrow_sign`.

What a film needs that is not here (a black ball with eyes, a paper plane, a
microphone) is a few lines of Pillow in the film's own frames script: draw
it, and stand it with `thing()`. Keep the script in the film
(`<film>/research/frames.py`), so a frame is drawn again in a second when
the story changes.

## What makes a frame worth showing

Hold each frame to the film the user keeps as the best, not to a diagram:
- **The frame is full, and it is theirs.** Their covers, photos, colours and
  things fill it. A toy on an empty floor beside a label is a slide.
- **The toy is in it, doing something.** Big enough to read its pose (a
  third of the frame's height or more in its own shots; small on purpose
  only where the scale is the point, a person under a huge screen).
- **The toy is turned to what it acts on.** It pushes the block it touches,
  points at the screen it shows, looks at the thing that fell. A toy facing
  the camera beside the thing is posing for a photo: ask for the view that
  turns it (`push:right`, `present:h-left`).
- **One thing happens.** If a frame needs three captions to be understood,
  it is three frames or it is not a picture yet.
- **What is drawn is recognised without its label.** A microphone that reads
  as a grey disc is a grey disc; a plane that could be taking off does not
  say "landing". The blind reading says which were not.
- **With its words blurred off, it still says its part.** `story-test.mjs`
  makes that picture of every frame (`research/frames/silent/`): look at
  them yourself first. Run the frames' script once more with
  `STAGEKIT_SILENT=1` (frames saved with `st.save(path)`): the kit blurs
  every word it lettered wherever it stands, on a block's top, white on a
  light bar, where text recognition reads nothing and a reader still does.
  A frame that is a blank board and a small figure once its words are gone
  is told by its caption, and is drawn again.
- **What is remembered is a move that is the meaning.** Two retold films,
  read blind: what each reader kept was the one frame where the toy's act
  says it with no word (three blocks falling as "the sky fell", a kick that
  knocks the 不 off his own line). The person the story turns on, met only
  as a heart on an avatar, was read as a fan; a joke that is a word blurred
  off was a blank square kicked. Who the story turns on is drawn as a person
  in their place, and the act is chosen so the picture carries it.
- **The background does not tell the ending.** Their page in the first frame
  shows them before the story: a bio that already says "official ambassador"
  was read first and gave the turn away.
- **A feeling reads one way.** Confetti beside a startled, clenched face is
  good news or bad; the pose and the mark say the same thing.
- **What comes back was met before.** A companion first seen in frame 1 and
  gone in frame 4 is nobody; two numbers of the same kind on one frame (1,500
  star, 380+ star) fight, and the reader keeps neither.
- **Few words, and theirs.** Every word on screen is listed in the frame's
  `words`. Their own lettering on their own covers is scenery; a caption
  that explains the picture is the picture failing.
- **The image to remember is composed first**, and is the fullest frame of
  all (`"key": true`). If it does not make someone stop, the story is not
  there yet: change the story, not the lighting.
- **The frames differ.** Five frames with the same camera and the same floor
  are one frame.

## Into the story

Each direction lists its frames (`references/story-directions.md`):
`"frames": [{ "picture": "research/frames/a-1.jpg", "part": "intro", "at":
[0, 5], "seen": "…", "words": ["…"] }, …]`. The story page shows them first
on the card, big. `materials.mjs` says which direction has none, which frame
has no picture, which carries the story in words, and when no frame is the
image to remember.

In step 4 the frames are the brief for the film's own code: build the image
to remember first, and hold its preview render beside its frame. A film may
frame things better than its paper did; it may not shrink them.
