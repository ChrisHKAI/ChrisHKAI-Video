# Step 2: research

Find out who the creator is: what they are known for and proud of, with
the material that shows it (their posts, pictures, numbers, their own
words). Keep numbers exactly as the platform writes them, with where and
when they were read. Current counts are fresh; historical milestones retain
their event dates and original values. Keep pictures as originals. Then show the user the
story page and let them pick. Two selection rounds: which picture the toy is
made from (as soon as the profile picture is in), then the story direction, opening and ending together.
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
- With Grok Build (step 0), start Grok first, in the background:
  `node <skill>/engine/scripts/grok-search.mjs <film>`. Grok's X search
  reaches what a browser hardly can: X's own post search with its
  operators, each post's thread and numbers. The run takes minutes and
  about a dollar, on the user's Grok account. It writes
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
    when it was made), `…/stargazers` with `Accept:
    application/vnd.github.star+json` for when the stars came;
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
  toy) can start right away while the research goes on.
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

Each story point:

```json
{ "id": "s1", "line": "一个月 8,904 颗 star", "says": "lemo-opuscar, a month old",
  "posts": ["p3"], "material": ["assets/p3.jpg"],
  "numbers": [{ "display": "8,904", "label": "star", "source": "https://api.github.com/repos/…", "read": "2026-10-28" }],
  "becomes": [{ "anim": "calendar", "why": "9月26日 → 10月28日, the stars counting up beside it",
                "opts": { "from": "2026-09-26", "to": "2026-10-28", "count": { "to": 8904, "label": "star" }, "stamp": "满月" } },
              { "anim": "count", "opts": { "to": 8904, "label": "star" } }] }
```

`line` is what the viewer takes away, in the creator's language; `becomes`
is one or two animations from `beats/catalog.json`, the best first, with the
options it needs (`opts`, as the catalog's `film` entry writes them), and why
in one line, as the user would see it on screen. Fit the animation to the
material, not the other way round:
- a number on a post → `act2` (it rises from its spot on the page), or
  `count` on its own stage;
- a span of days → `calendar`;
- their own words → `phrase`;
- a cover with big lettering and claims to climb → `act3`. Not for an
  illustration, a photo or small text: those smear as 3D lettering;
- anything none of these shows well (their illustrations, a product, a page
  to scroll through, a before and after) → `"anim": "own"`: an animation
  written for this film (references/beats.md, "A beat of your own"). Say
  what it will look like in `why`.

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
Synthesize the evidence, search important gaps once, then propose up to three
distinct supported directions and recommend one. Store `narrative`,
`directions` and `recommendedDirection` beside `story` in facts.json. Keep
historical milestones dated; today's counts are a separate fact.

## The story page

`node <skill>/engine/scripts/materials.mjs <film> --lang <the user's
language>` writes `research/materials.png` (complete directions first, then the choices: the story
points, each with its picture, numbers, sources and a preview strip of what
it becomes; the three openings with their previews; the endings) and
`research/materials-posts.png` (every post found, and the menu of
animations), and `research/materials.html` with both. Show the first, and
ask in one round (AskUserQuestion where the agent has it, else one message):
- which direction (including its ordered story points), or changes to it;
  for older workspaces without directions, which story points in what order;
- which opening (isnail's glass page, Kin's page turning right, 铁柱's
  turning left);
- which ending, or their own words.
For a direction, write `picks.direction` to its ID; its beats and ending are
the defaults (`picks.cta` may override the ending). Otherwise keep the existing
point-selection format in `picks`: `{ "story": ["s2", { "id": "s1", "anim":
"count" }], "opening": "page-stand", "cta": { "slogan": […], "prop": "…" } }`
(a story point by its id takes its first animation; `{ id, anim }` another).
If they name something no story point covers, add it as one, with what it
becomes, and show it again.

When the user is away (an unattended run), record the supported recommended
direction in `picks.direction` (older workspaces: the strongest story points), an opening and an ending
the earlier films did not use (`run.mjs ledger` lists them), and say so in
the hand-over.

## Into film.json

`node <skill>/engine/scripts/apply-research.mjs <film>` turns the picks
into the film: `story.segments` (the opening, each picked story point's
animation in order, the end card, timed so every hit stays on a downbeat),
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
