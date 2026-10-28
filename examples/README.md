# The films

Every film made before and alongside the skill, as it was made: its brief,
its code and its pictures, to learn from; the finished films are on the
repository's Releases page (tag `films`), kept out of the repository so
installing the skill stays light. Each folder is
the film's own project from `videos/<film>/` of the workspace it was made
in, so paths inside it (`reference/…`, `characters/chris-toy/…`,
`videos/<other film>/`) point at that workspace; generated folders
(`build/`, caches) are left out and rebuild from the code.

| film | what it is | how it was made | finished |
| --- | --- | --- | --- |
| [isnail-intro](isnail-intro/) | 30 s self-intro for 蜗牛King (@isnail): his avatar peels off and pops into his vinyl mascot, his posts stand up as walls, 304万 rises | Node + Blender Cycles; the film `creator-toy-intro` was extracted from | [isnail-intro.mp4](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/isnail-intro.mp4) |
| [kingao-intro](kingao-intro/) | 30 s intro for Kin (@KinGao476942), starring his calico cat as a vinyl toy | Node + Blender Cycles; the pet kit's source | [kingao-intro.mp4](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/kingao-intro.mp4) |
| [cgnot996-intro](cgnot996-intro/) | 42 s self-intro for 铁柱AGI (@cgnot996), the first film the skill made for a real creator: a flip calendar to 10,000 followers, 1,500 stars, a 官方认证 seal | `creator-toy-intro` (sculpt kit) with the film's own template | [cgnot996-intro.mp4](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/cgnot996-intro.mp4) |
| [tim-intro](tim-intro/) | 142.9 s film about Tim (影视飓风): 500 folds and Steve Jobs on the 2007 keynote stage | Node + Blender Cycles; the Tim line of toys | not published (see below) |
| [chris-outro](chris-outro/) | 23.5 s end tag: Chris (@ChrisHKAI) as his own vinyl toy | Blender Cycles; the sculpted Chris toy | [chris-outro.mp4](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/chris-outro.mp4) |
| [chris-toy](chris-toy/) | the Chris toy itself: Blender assembly, look-dev, expressions, sheets | Python signed distance fields + Blender; the sculpt kit's source | `build/chris-toy-turntable.mp4` |
| [merge-conflict](merge-conflict/) | 19.2 s voxel fight: Clawd vs a DeepSeek whale in a code editor | Node + Blender Cycles | [merge-conflict.mp4](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/merge-conflict.mp4) |
| [made-with-claude](made-with-claude/) | 12 s: "Claude can drive After Effects by itself" | HyperFrames (HTML) | — |
| [made-with-deepseek](made-with-deepseek/) | the same film made with DeepSeek | HyperFrames (HTML) | [made-with-deepseek.mp4](https://github.com/ChrisHKAI/ChrisHKAI-Video/releases/download/films/made-with-deepseek.mp4) |

The sound in every film is synthesized by its own `scripts/sound.py` (or
`score.py`), so `assets/audio/score.wav` is the film's own.

## Left out, and how to get them

- The Tim film's finished cut, its score and its storyboard: they carry the
  2007 iPhone keynote, ABC News footage and the song "See You Again",
  which belong to others, so they are not published. Its code and its own
  pictures are here.
- The Chris outro's lettering face, Archivo Black (SIL Open Font License):
  download it from [Google Fonts](https://fonts.google.com/specimen/Archivo+Black)
  and put `ArchivoBlack-Regular.ttf` in `chris-outro/assets/archivo-black/`.
- Platform marks, which an agent rebuilding a film fetches itself:
  - the X mark (`chris-outro/assets/x-logo.png`, 1206 px square, white on
    black) is drawn by the film's own `scripts/ui.py`: run it;
  - the 公众号 mark the isnail film's snail shell is cut from
    (`isnail-intro/assets/gzh-logo.png`): take the green 公众号 logo from
    WeChat's own pages, save it as a PNG on a plain background, and set the
    crop in `scripts/logo.py`, which keeps the green swirl right of x = 150 px
    of the original picture.
