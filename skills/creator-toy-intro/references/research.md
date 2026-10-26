# Step 2: research

Find the creator's profile, pinned post and three to five best posts, with
every number exactly as the page writes it and the spot where it sits; keep
the pictures as originals; then show a material table and let the user pick.
Two questions only: which picture the toy is made from (as soon as the
profile picture is in), and the picks. Never ask who the film is for or
whether a number is true: use the numbers the user gives as they are.

## Where to look

Read only, always: never like, follow, comment or message.

- The user's own browser, already logged in (the agent's browser tool, or
  computer use on Chrome). A login page or a QR code: the user logs in or
  scans themselves; never type a password.
- X: the profile; the pinned post; the most-viewed posts (each post shows
  its views). An agent that searches X (grok, for one) can rank the
  creator's posts by engagement first; then open each.
- 抖音, 小红书, Instagram: the profile page in the logged-in browser.
- 视频号, 公众号 counts: desktop WeChat through computer use, where the agent
  has it; otherwise the user's screenshots.
- YouTube, B站: public pages.
- A share link (`v.douyin.com`, `xhslink.com`): open it to reach the profile.
- No browser tool at all: ask once for screenshots of the profile and the
  best posts, and read everything from them.

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
  files). They are for the material table only and never go into the film:
  the page is rebuilt by the theme, the pictures are the originals.
- Each number: the platform's own writing (`304万`, `1.1萬`, `46K`, `5,018`),
  its label as the app says it (阅读, 粉丝, 获赞), and its spot: a profile field
  or a post's count.
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
    "numbers": { "followers": { "label": "关注者", "display": "5.5万" }, "following": { "label": "正在关注", "display": "1,380" }, "posts": { "label": "帖子", "display": "3.5万" } }
  },
  "posts": [
    { "id": "p1", "url": "…", "date": "5月31日", "title": "…", "cover": "assets/p1.jpg", "shot": "research/shots/p1.png", "pinned": true,
      "numbers": { "replies": { "label": "回复", "display": "163" }, "reposts": { "label": "转帖", "display": "914" }, "likes": { "label": "喜欢", "display": "5,018" }, "views": { "label": "阅读", "display": "304万" } } }
  ],
  "toy": { "images": ["assets/avatar.jpg"], "confirmed": true },
  "extra": [{ "label": "总播放", "display": "1200万", "source": "research/shots/dashboard.png" }],
  "slots": { "proof1": [], "proof2": [], "cta": [] },
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

## Candidates and the material table

For each slot of the 30 s story, three candidates, best first, each with its
post, number and one line of why:

- `proof1`, the post whose number rises from its spot on the page: the
  biggest number, a pinned post if it has one. `{ "post": "p1", "number":
  "views", "why": "…" }`. The counter counts whole digits with a unit after
  them and a two-character label (`304万 阅读`); `1.1万` or a bare `5,018` will
  not count up yet.
- `proof2`, the post whose cover stands up as a wall and comes apart: a
  cover with big lettering or numbers on it works best. `{ "post": "p2",
  "why": "…" }`.
- `cta`, what the film ends on: the closing line in one or two short parts
  and the end card's prop, together. First work out what the creator wants
  people to come for (a course, a group, a product, a service, a link: their
  bio, pinned post and links say); each candidate pairs a line with a prop
  that ties that to who they are, the way isnail's 公众号 mark becomes the
  shell of a snail because he is 蜗牛King: `{ "slogan": ["公众号变现",
  "找蜗牛"], "prop": "his 公众号 mark becomes a snail's shell; the toy rides it",
  "why": "…" }`. The question asks what they want to promote as much as
  which line: "other" lets them say it in their own words.

Then `node <skill>/engine/scripts/materials.mjs <film> --lang <the user's
language>` writes `research/materials.png` (and `.html`). Show it, and ask
in one round: one question per slot, A / B / C and "other" (AskUserQuestion
where the agent has it, else one message). Write the answers into `picks`
(the chosen candidate objects, or the user's own words in the same shape).
If they name something to promote that no candidate covers, propose two or
three props for it in a follow-up message before going on.

## Into film.json

`node <skill>/engine/scripts/apply-research.mjs <film>` fills `profile`,
`posts` (`pinned` = proof 1, `retro` = proof 2), `counter`, `grid` (the other
posts), the end card's name, handle, slogan and prop idea (`cta.prop.idea`,
built in step 4: `references/props.md`), `toyFrom` (the confirmed
pictures), and moves `step` to `toy`. It stops while the toy's picture is
not confirmed.
It warns when proof 1's number cannot be the counter: pick another, or
change its label. Set film.json `language` from the profile's own script
(简 → `zh-Hans`, 繁 → `zh-Hant`).
