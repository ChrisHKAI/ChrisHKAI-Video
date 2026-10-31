# Step 2: research

Find out who the creator is: what they are known for and proud of, with
the material that shows it (their posts, pictures, numbers, their own
words). Keep numbers exactly as the platform writes them, with where and
when they were read. Current counts are fresh; historical milestones retain
their event dates and original values. Keep pictures as originals. Then show the user the
story page and let them pick. Two selection rounds: which picture the toy is
made from (as soon as the profile picture is in), then the story direction (with its ideas) and the ending together.
Infer audience and goal from the request and sources and show that assumption
on the story page for correction. Keep user-supplied numbers as supplied,
label their source and date, and distinguish them from independently read counts.

The film is their story turned into animation, not a template filled in.
Pick material for what it says about them, never for the slot it fits.

## Where to look

Read only, always: never like, follow, comment or message.

- The user's own browser, already logged in (the agent's browser tool, or
  computer use on Chrome). A login page or a QR code: the user logs in or
  scans themselves; never type a password.
- X: the profile; the pinned post; the most-viewed posts (each post shows
  its views).
- The work itself, all of it, as it is today: what the posts are about. A
  repository: its README, its gallery or site and its folders (how many
  styles, tools, chapters there are now, and a picture of each); an
  illustrator's drawings; a channel's videos; a product's own pages. Posts
  say what happened; the work is what the film can show. Keep its pictures in
  `assets/work/` (all of them when there are many: a quantity is material
  too), and today's count of it in `extra` with its source and date. A
  library that launched with 39 styles and has 66 today says 66 on screen; the
  39 is a milestone with its date.
- Grok Build, when the user said yes to it in step 1 (film.json `grok`:
  true): run it first, before the browser, every time:
  `node <skill>/engine/scripts/grok-search.mjs <film>`. Run it in the
  background where the agent can, and read the page meanwhile. Where the
  agent cannot run things in the background, run it and wait: it takes a
  few minutes. Grok's X search reaches what a browser hardly can: X's own
  post search with its operators, each post's thread and numbers. When it
  fails (the agent's sandbox has no network, Grok is not signed in), tell
  the user in a line what it needs (allow the network for it; `grok login`
  in their Terminal) instead of quietly going on without it. Say what it
  found, never what it cost. With `grok` false, or no Grok Build on this
  computer, the browser alone, without asking. It writes
  `research/grok.json` with:
  - the pinned post;
  - the posts with the most views or engagement;
  - the milestones they posted about, with dates and numbers;
  - ideas for the film.
  It also finds beginnings, problems, decisions and methods beyond popular
  posts. Use one targeted follow-up only for important evidence gaps
  (`references/story-directions.md`; `grok-search.mjs <film> --gaps`).
  These are leads: open each post on the page and take its numbers from
  there, as the page writes them. Grok's milestones and ideas become story
  points (`story`, below).
- 抖音, 小红书, Instagram: the profile page in the logged-in browser.
- 视频号, 公众号 counts: desktop WeChat through computer use, where the agent
  has it; otherwise the user's screenshots.
- YouTube, B站: public pages.
- A share link (`v.douyin.com`, `xhslink.com`): open it to reach the profile.
- A browser that is not logged in: X hides the counts behind a login wall
  and shows only a few posts. Ask the user to log in in that browser
  themselves (never type a password), or to send screenshots.
- No browser to use (or the user is away): the public sources, read only:
  - X: `https://api.fxtwitter.com/<handle>` (the profile and its counts)
    and `https://api.fxtwitter.com/<handle>/status/<id>` (a post, its
    numbers, its media);
  - GitHub: `https://api.github.com/repos/<owner>/<repo>` (stars, forks,
    when it was made, its description), `…/readme` with `Accept:
    application/vnd.github.raw` and `…/contents/<folder>` (the work itself);
    when the stars came needs a token (`…/stargazers` with `Accept:
    application/vnd.github.star+json`); without one, the creator's own dated
    milestone posts;
  - YouTube, B站: their public pages.
  Ask once for screenshots of what none of these reaches.

The user may add screenshots of their own any time (total plays, follower
growth from the app's dashboard). A number with no spot on the profile page
goes to `extra`; in the film it rises from the name at the top.

## What to keep

- The profile picture first, full size, as `assets/avatar.<ext>`. On X, drop
  the `_normal` / `_400x400` size from the image URL for the original.
- Then, before anything is built from it, show it and ask which picture the
  toy is made from: this one, or another the user sends. Many profile
  pictures are real people, and some are not the person at all (a logo, a
  pet, a friend's photo), so this is always asked, never assumed. A real
  person's toy reads better from a clearer photo (half or full body, plain
  light), so offer that too. Record the answer in `toy` (below); step 3 (the
  toy) can start right away while the research goes on: a changed story
  changes what the toy does, not its body.
- The banner and every post's cover, as originals (`curl` the image URL; X
  media: `?name=orig`), in `assets/`.
- Screenshots of the profile and each post in `research/shots/` (on a Mac
  `screencapture -x -R x,y,w,h <file>`, or the browser tool where it saves
  files). They are for the story page only and never go into the film:
  the page is rebuilt by the theme, the pictures are the originals.
- Each number: the platform's own writing (`304万`, `1.1萬`, `46K`, `5,018`),
  its label as the app says it (阅读, 粉丝, 获赞), and its spot: a profile field
  or a post's count. It counts up in the film just as it is written.
- Current counts are today's: read them from the page or the API now, never from
  an old post that mentions them ("破 3K star" is a milestone, not the count;
  the repo has 8,904 today). Each number keeps `source` (the URL it was read
  from) and `read` (the date). Historical milestones additionally keep their
  event date; they are not substituted for current counts. For supplied
  screenshots, record when received/read and label them as supplied evidence.
- Never keep phone numbers, WeChat IDs, prices or invite codes for the screen.

`research/` stays out of any git repository.

## research/facts.json

```json
{
  "platform": "x", "url": "https://x.com/isnail", "read": "2026-10-26",
  "profile": {
    "name": "蜗牛King", "handle": "isnail", "bio": ["…", "…"],
    "avatar": "assets/avatar.jpg", "banner": "assets/banner.jpg", "shot": "research/shots/profile.png",
    "fields": { "nameEmoji": "👑", "verified": true, "meta": { "link": "chuhai.pet" }, "ip": "广东" },
    "numbers": { "followers": { "label": "关注者", "display": "5.5万", "source": "https://x.com/isnail", "read": "2026-10-26" }, "following": { "label": "正在关注", "display": "1,380", "source": "https://x.com/isnail", "read": "2026-10-26" }, "posts": { "label": "帖子", "display": "3.5万", "source": "https://x.com/isnail", "read": "2026-10-26" } }
  },
  "posts": [
    { "id": "p1", "url": "…", "date": "5月31日", "title": "…", "cover": "assets/p1.jpg", "shot": "research/shots/p1.png", "pinned": true,
      "numbers": { "replies": { "label": "回复", "display": "163", "source": "<original post URL>", "read": "2026-10-26" }, "reposts": { "label": "转帖", "display": "914", "source": "<original post URL>", "read": "2026-10-26" }, "likes": { "label": "喜欢", "display": "5,018", "source": "<original post URL>", "read": "2026-10-26" }, "views": { "label": "阅读", "display": "304万", "source": "<original post URL>", "read": "2026-10-26" } } }
  ],
  "toy": { "images": ["assets/avatar.jpg"], "confirmed": true },
  "extra": [{ "label": "总播放", "display": "1200万", "source": "research/shots/dashboard.png", "read": "2026-10-26" }],
  "story": [{ "id": "s1", "line": "…", "posts": ["p1"], "numbers": [], "becomes": [] }],
  "slots": { "cta": [] },
  "picks": {}
}
```

`toy.images` are the pictures the user said the toy is made from (the
avatar, or what they sent instead, saved in `assets/`); `confirmed` is true
only once they said so. `profile.fields` takes what the stage theme shows (SKILL.md lists them per
theme: `ip`, `title`, `category`, `tags`, `collections`, `highlights`,
`meta`…); `profile.numbers` the counts (`followers`, `following`, `likes`,
`posts`). A post's numbers are keyed `replies`, `reposts`, `likes`, `views`
(plays count as `views`).

## The story first

Before any animation, write down what the creator is known for and proud
of: three to five story points in `story`, each a thing a viewer should
learn about them. Look in:
- their bio and pinned post: what they say they do;
- their most-viewed and most-discussed posts: what people come for;
- milestones they posted about (a number reached, a date, a first);
- what they made: a project, a product, a style, a channel;
- a role or a title, a turn in their path, a line they are known for;
- Grok's milestones and ideas, and the user's own words.

Each story point (an illustrator's, to show the thinking: every creator's
material asks for its own idea, never this one):

```json
{ "id": "s1", "line": "一年 365 天，每天一张猫", "says": "a drawing a day for a year, the same cat in each",
  "special": "365 drawings of one cat: in order, they are already an animation",
  "posts": ["p3"], "material": ["assets/work/"],
  "numbers": [{ "display": "365", "label": "张", "source": "https://…/gallery", "read": "2026-10-28" }],
  "becomes": [
    { "anim": "own", "beat": "beats/flipbook.js",
      "pitch": "她一年的猫，一页页翻成一段动画：猫走过一整年",
      "why": "the drawings flip past like a flipbook, faster and faster; the cat walks across the year, and the toy walks beside it",
      "sketch": "research/sketches/s1-flipbook.jpg" },
    { "anim": "calendar", "pitch": "一年翻过去", "why": "a flip calendar runs a year; the count reaches 365",
      "opts": { "from": "2025-10-28", "to": "2026-10-28", "count": { "to": 365, "label": "张" } } }] }
```

`line` is what the viewer takes away, in the creator's language. `special`
is what is special about this material: its quantity, its scale, a before
and after, its own look (a style, a typeface, a colour), a motion it already
has. `becomes` holds the ideas for showing it, your recommendation first.
Design them before opening the catalog:
1. Two ideas at least, one at least the film's own (`"anim": "own"`, with the
   `beat` file it will be), designed from what is special about this
   material. Each says, in the user's language, `pitch`: the idea in one
   sentence a jury would remember; and `why`: what the viewer sees, and what
   of the material it uses.
2. Each idea of the film's own gets a `sketch`: a picture made from the
   creator's own material (`engine/scripts/sketch.py` lays their pictures out
   in a grid, a fan, a stack or a row around the toy's picture, or compose
   one yourself), so it stands on the story page as something seen, beside
   the preview strips of the skill's animations.
3. Only then the skill's animations (`beats/catalog.json`, with `opts` as its
   `film` entry writes them): one is an idea when it is the best way to show
   this point, or a part the film's own animation starts from. Hold each to
   its material: with another creator's material, would it be the same
   animation? Then it is a template, not an idea.

What the skill's animations need, so that one is never forced:
- `act2`, a post's number rising from its spot on the page: a post whose
  number is the point;
- `act3`, a cover standing up as a wall the toy climbs: big lettering, and
  room to climb: a low ledge and three boxes stepping up across the cover,
  each with the toy's height of clear space above it (`engine/scripts/
  regions.py` numbers the cover's blocks). Most covers have the lettering and
  not the room. Illustrations, photos and small text smear as 3D lettering;
- `count`, `calendar`, `phrase`: a number, a span of days, a line of their
  own words, each on a stage of its own.

Also in facts.json: `slots.cta`, two or three endings, each the closing line
in one or two short parts and the end card's prop, together. First work out
what the creator wants people to come for (a course, a group, a product, a
service, a link: their bio, pinned post and links say); each pairs a line
with a prop that ties that to who they are, the way isnail's 公众号 mark
becomes the shell of a snail because he is 蜗牛King: `{ "slogan":
["公众号变现", "找蜗牛"], "prop": "his 公众号 mark becomes a snail's shell; the
toy rides it", "why": "…" }`.

## Choose a complete direction

Read `references/story-directions.md` before matching facts to animations.
Compare candidates for audience relevance, specificity, evidence, visual clarity
and complementary contribution; record selection reasons and important exclusions.
Synthesize the evidence, search important gaps once, then propose up to three
distinct supported directions and recommend one. Store `narrative`,
`directions` and `recommendedDirection` beside `story` in facts.json. Keep
historical milestones dated; today's counts are a separate fact.

## The story page

Explain the proposed story before production, within the existing choice round.
Default to a short in-chat outline (opening → connected events → ending) or the
existing light material page. A polished PPT, slide deck or narrated sales pitch
is not required. Make a timed text-and-footage rough cut only when useful or
requested; do not add a mandatory deliverable or another approval round.

Label this stage clearly in the user's language: “Story proposal — confirms the
plot and order, not the final animation style.” Say what is actual supplied
footage, what is a placeholder, and what remains to animate. A text-card video
is a story rough cut, not an animation test or a rendered storyboard approval.
For each beat describe what the viewer will see happen, not just the sentence
on a slide. Keep explanations beside the proposal, not as final-film subtitles.

For explanatory pages/cards, use a bright background (white, warm ivory or pale
blue), dark readable text and restrained accents. Avoid default black/navy
corporate decks. Follow explicit user preferences; this presentation palette
does not choose the final film's palette. Do not rebuild a prettier deck when
the user only wants to understand the story.


`node <skill>/engine/scripts/materials.mjs <film> --lang <the user's
language>` writes `research/materials.png` (complete directions first, each
with its pitch, the opening it starts with and why, and its points' ideas:
the film's own with their sketches, the skill's with their preview strips;
then the endings) and `research/materials-posts.png` (every post found, each
point in detail, and the skill's animations as parts), and
`research/materials.html` with both. It says which point still lacks an idea
of the film's own, or its sketch: add them before the user sees the page.
Show the first, and ask in one round (AskUserQuestion where the agent has
it, else one message):
- which direction (including its ordered story points), or changes to it;
  for older workspaces without directions, which story points in what order;
- for a point with more than one idea, which (the first is the one you
  recommend);
- which ending, or their own words.
Not the opening: the story chooses it (`references/story-directions.md`), and
the direction card says which and why. Ask only if the user raises it.
For a direction, write `picks.direction` to its ID; its beats, opening and
ending are the defaults (`picks.cta` may override the ending, `picks.opening`
the opening when the user asked for another). Another idea for a point:
`picks.story` in the direction's order, `{ "id": "s2", "idea": 1 }` (its place
in `becomes`, 0 the first) or `{ "id": "s2", "anim": "count" }`. Older
workspaces keep the point-selection format: `{ "story": ["s2", "s1"], "cta":
{ "slogan": […], "prop": "…" } }` (a story point by its id takes its first idea).
If they name something no story point covers, add it as one, with what it
becomes, and show it again. What they want kept out of the film (a number, an
old name, a picture, a topic) goes in `picks.avoid`, a line each, in their
words: apply-research carries it to film.json `avoid`, check stops on any
word on screen that matches, and the storyboard page and the review list
the rest for the eye. Real material stays real: their picture, their posts,
their numbers as the platform writes them are never redrawn or invented.

When the user is away (an unattended run), record the supported recommended
direction in `picks.direction` (older workspaces: the strongest story points)
with its recommended ideas and its opening, and an ending the earlier films
did not use (`run.mjs ledger` lists them), and say so in the hand-over.

## Into film.json

For a complete direction, run `story-test.mjs <film>` and review the generated
brief (`references/story-test.md`): a cheap text check of the chosen story,
internal work, not another question for the user. It is advice: `apply-research`,
`next` and `check` say what it still asks for, and the film goes on.

`node <skill>/engine/scripts/apply-research.mjs <film>` turns the picks
into the film: `story.segments` (the opening the story chose, each picked
story point's idea in order, the end card, timed so every hit stays on a downbeat),
`profile`, `posts` (the two the page shows: the one whose number rises, and
the next), `counter` (that number as the platform writes it), `grid` (the
other posts), the end card's name, handle, slogan and prop idea
(`cta.prop.idea`, built in step 4: `references/props.md`), `toyFrom` (the
confirmed pictures), and moves `step` to `toy`. It stops while the toy's
picture is not confirmed, and names each `own` animation still to write.
The chosen direction is also stored in `film.story.direction` for the
storyboard and review. It is a brief to implement, not rendered text by itself.
Set film.json `language` from the profile's own script (简 → `zh-Hans`, 繁 →
`zh-Hant`).
