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
  its views). X's own search stops early: `from:<handle> min_faves:100` may
  return only the last weeks and miss the biggest post. Search it in dated
  windows (`since:2026-06-01 until:2026-08-01`), or let Grok's search reach
  further back. In the browser tool, collect in short passes (scroll, read,
  scroll): one long script times out in a hidden pane.
- The work itself, all of it, as it is today: what the posts are about. A
  repository: its README, its gallery or site and its folders (how many
  styles, tools, chapters there are now, and a picture of each); an
  illustrator's drawings; a channel's videos; a product's own pages. Posts
  say what happened; the work is what the film can show. Keep its pictures in
  `assets/work/` (all of them when there are many: a quantity is material
  too), and today's count of it in `extra` with its source and date. A shop
  that opened with 12 products and sells 80 today says 80 on screen; the 12 is
  a milestone with its date.
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
  It also finds beginnings, problems, decisions, methods and personal
  moments (family, why they started, something made for one person) beyond
  popular posts. Use one targeted follow-up only for important evidence gaps
  (`references/story-directions.md`; `grok-search.mjs <film> --gaps`).
  These are leads: open each post on the page and take its numbers from
  there, as the page writes them, and open the profile itself: Grok's search
  may not reach the profile page or know the pinned post, which the browser
  shows at once. Grok's milestones and ideas become story points (`story`,
  below); its personal leads, once opened on the page, become `moments`.
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
- A pinned post X marks as a paid partnership (付费合作关系, Paid
  partnership): keep it, with `"sponsored": true`. The film's page does not
  feature it: apply-research takes another post for the page unless the story
  names this one, and says so when it does.
- The banner and every post's cover, as originals (`curl` the image URL; X
  media: `?name=orig`), in `assets/`.
- Screenshots of the profile and each post in `research/shots/` (on a Mac
  `screencapture -x -R x,y,w,h <file>`, or the browser tool where it saves
  files). They are for the story page only and never go into the film:
  the page is rebuilt by the theme, the pictures are the originals. Where
  nothing can save one (a browser pane that only shows the page), skip them:
  the covers and the profile picture stand in on the story page. A public
  page (their site, a README, a gallery) is sharp from headless Chrome:
  `node <skill>/engine/scripts/shot.mjs <url> research/shots/<name>.png`.
- Each number: the platform's own writing (`304万`, `1.1萬`, `46K`, `5,018`),
  its label as the app says it (阅读, 粉丝, 获赞), and its spot: a profile field
  or a post's count. A post's views as its own page writes them under it
  (`214.6万 次查看`, fuller than the `214万` in its action bar), with the label
  the page shows (X's 简体 page: a post's views 查看, an article's 阅读). It
  counts up in the film just as it is written. Write it
  in the film's language, the creator's own script (a 简 creator's `1.1万`
  and `关注者`, even when your browser shows X in 繁 as `1.1萬`, or the API
  gives `11375`); where the source wrote it otherwise, say so in its `note`.
  From the API (`api.fxtwitter.com`), a post's reposts as X's page counts
  them are its retweets and quotes together (284 + 166: the page's 450).
- Dates as the creator lived them: the day in their own time zone (their IP
  region, where they say they live; most creators here are on UTC+8). The page
  shows a post's date in the browser's zone and Grok and the APIs give UTC, so
  a post at 2026-09-27 17:30 UTC is 9月28日 in Beijing: convert, and keep the
  UTC time in the `note` when the day differs.
- Current counts are today's: read them from the page or the API now, never from
  an old post that mentions them ("破 3K star" is a milestone, not the count;
  the repo has 8,904 today). Each number keeps `source` (the URL it was read
  from) and `read` (the date). Historical milestones additionally keep their
  event date; they are not substituted for current counts. For supplied
  screenshots, record when received/read and label them as supplied evidence.
- Their type: the face their own covers, site or titles use (a serif, a brush,
  a mono). Name it in film.json `type.display` (`[{ "family": "Songti SC",
  "style": "Black" }]`, a face on this computer), or put the face file they
  use in the film's `fonts/`: a beat's own line is set in it, not in the end
  card's heavy face.
- Their words, whole: whatever the page or the film quotes in 「」, keep the
  text it comes from, a post's full text in its `text`, anything else in
  `research/sources/`: an article, a README, a line from a video as a
  `.txt`, a post's API answer as it came (`fx-<id>.json`).
  A quote stays in their script, word for word; a cut inside it is marked
  ……. The story page checks every 「quote」 against these texts.
- Never keep phone numbers, WeChat IDs, prices or invite codes for the screen.
  A bio line that carries one (「199 付费答疑群 +V: …」) is left out of
  `profile.bio`; the rest of the page stays as theirs.

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

Before any animation, the person: who they are, why they do it, for whom,
and the moments that show it (`moments`, below). Then what the creator is
known for and proud of: three to five story points in `story`, each a thing a
viewer should learn about them, chosen to carry that person, with the numbers
as evidence of how far it went. Look in:
- their bio and pinned post: what they say they do;
- their most-viewed and most-discussed posts: what people come for;
- milestones they posted about (a number reached, a date, a first);
- what they made: a project, a product, a style, a channel;
- a role or a title, a turn in their path, a line they are known for;
- a moment that is theirs alone: their family, why they started, something
  they made for one person, a message that moved them. It may have few views
  and still be the heart of the film. Write each one found in `moments`;
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

`moments` lists every personal moment the research found, used or not, in
the user's language: `[{ "what": "drew her sister a cat every day she was in
hospital", "date": "2025-03-14", "source": "<post URL>", "read": "2026-10-28",
"story": "s1" }]` (`story`: the point it became, if it became one). One that no
direction uses says why (`"why": "she asked readers not to share that
thread"`); views are never the reason. The story page lists them all under the
directions, so the user sees what was found and what was left out. `[]` means
you looked and found none: the page says so, and the heart is the creator and
what they keep doing (`references/story-directions.md`, "Start from the
person"). Never write one the sources do not show.

`line` is what the viewer takes away, in the creator's language. When the
user's language differs from the creator's, `line`, quotes and the words on
screen are the creator's (the film's); `says`, `special`, `pitch`, `why` and
the page itself (`--lang`) are the user's. `material`
is its pictures, files or folders of them (a folder shows its first picture
on the page, in name order: put the telling one first). `special`
is what is special about this material, and only it has: its quantity, its
scale, a before and after, its own look (a style, a typeface, a colour), a
motion it already has, a process, a sound, a joke of theirs; these are
prompts, not the list. `becomes` holds the ideas for showing it, your
recommendation first; ideas that differ in kind, not two layouts of the same
pictures.
Design them before opening the catalog:
1. Two ideas at least, one at least the film's own (`"anim": "own"`, with the
   `beat` file it will be), designed from what is special about this
   material. Each says, in the user's language, `pitch`: the idea in one
   sentence a jury would remember; and `why`: what the viewer sees, and what
   of the material it uses.
2. Each idea of the film's own gets a `sketch`: a picture made from the
   creator's own material, so it stands on the story page as something seen,
   beside the preview strips of the skill's animations. Most ideas need one
   composed for them (a fold climbing to the moon, a staircase, a turning
   boat), and that is the usual case: `engine/lib/sketchkit.py` gives the
   pieces (their picture as a card, the toy's disc, a caption, a label, an
   arrow or an arc). For many pictures at once, `engine/scripts/sketch.py`
   lays them out in a grid, a wall, a fan, a stack or a row.
3. Only then the skill's animations (`beats/catalog.json`, with `opts` as its
   `takes` says, below): one is an idea when it is the best way to show
   this point, or a part the film's own animation starts from. Hold each to
   its material: with another creator's material, would it be the same
   animation? Then it is a template, not an idea. Hold the story to it too,
   and swap the story, not the fact: a well-known fact (how far light travels
   in a year) goes to anyone; who did something with it, why and for whom
   does not.

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

Each one's `takes` (in the catalog) says what an idea's `opts` give it:
`count` `{ to, label }` (and `from`, `unit`…), `calendar` `{ from, to }` (and
`count`, its `keys` their dated milestones `[["2026-09-11", 1000], …]`, and
`stamp`), `phrase` `{ text }`; `act2` may name `{ post, number }`
(the post whose number rises and which number: `"views"`), `act3` `{ post }`,
else the point's first post. The values the catalog's `film` entry shows are
another film's example: they never reach this one, so an idea that leaves out
one it needs stops `apply-research`, and the story page says so first.

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

The user sees and picks the story on one page, the story page, made by
`materials.mjs` below and served like the storyboard's: no slide deck,
narrated pitch or rough cut on top of it unless they ask for one, and no
extra approval round. It says what it is (a story proposal: the plot and the
order, not the final animation style), and each beat says what the viewer
will see happen, not only its sentence.

`node <skill>/engine/scripts/materials.mjs <film> --lang <the user's
language>` writes `research/materials.png` (complete directions first, each
with its pitch, the opening it starts with and why, and its points' ideas:
the film's own with their sketches, the skill's with their preview strips;
then the endings) and `research/materials-posts.png` (every post found, each
point in detail, and the skill's animations as parts), and
`research/materials.html` with both, and `research/story/index.html`: the same
page as the storyboard's is made, served by the studio with its pictures,
where the user clicks any card (a direction, a point, an idea, an ending, a
post) to leave a note (`build/comments.jsonl`, `run.mjs comments` lists
them). It says which point still lacks an idea of the film's own, or its
sketch: add them before the user sees the page. Serve it and give the user
the address it prints, on a line of its own (words stuck to it become part of
the link). Each film's studio takes a port of its own (another film's may hold
4173), so the address is the one printed, never one remembered:

```bash
FILM=<film> node <skill>/engine/run.mjs studio   # prints http://127.0.0.1:<port>/story/
```

Where the chat shows pictures, show them too, one story a picture
(`materials-A.png`, `-B`, `-C`, then `materials-endings.png`, at twice the
page's pixels): one tall picture is shrunk by a chat until it blurs. Then ask in one
round (AskUserQuestion where the agent has it, else one message). AskUserQuestion
takes four questions at most: the direction, the ideas, the ending and what to keep
out, with the ideas as one question ("the recommended idea for every point", or
another for a point, said in their own words), never a second round:
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
