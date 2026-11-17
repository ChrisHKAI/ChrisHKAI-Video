# Story directions (step 2, before choosing animation)

- [Evidence map](#1-make-an-evidence-map)
- [Material selection](#material-selection)
- [Opening variants](#opening-variants)
- [Targeted gap search](#2-search-the-important-gaps-once)
- [Told as a scene](#3-tell-it-as-a-scene): the line a viewer retells, the first five seconds, a scene not a list, their world, how it feels
- [Start from the person](#start-from-the-person)
- [The ending](#the-ending), and [seen before it is built](#see-it-before-it-is-built) (the frames: references/frames.md)
- [Selection and handoff](#4-one-choice-then-the-existing-film-pipeline)

Read after collecting the first round of sources, before building the story
page. Make the creator memorable through one supported idea, told as one small
scene and seen on paper before anything is built. Keep the existing
toy-picture question and one story-selection round; do not add a questionnaire.

## 1. Make an evidence map

Infer the audience and purpose from the request, bio, pinned post and links;
write the assumption in `facts.narrative = { audience, goal, inferred: true }`.
Show it on the story page so the user can correct it. Prefer their explicit
instructions; use `inferred: false` when both audience and goal are explicit.
For mixed inputs keep `inferred: true` and say which part is assumed. Do not
assume every creator wants to sell a course.

Keep three to five facts in `facts.story` as research.md describes. For each,
add `sources: [{ url, read, kind, supports }]`: the original post/page or supplied
screenshot, when read, `creator_statement` / `observed` / `interpretation`, and
exactly what it supports. Separate interpretations from facts. Engagement is a
discovery signal, not proof of expertise, quality, motive or causation.

Look for: a beginning, a problem, a decision, a method, representative work,
a personal moment (family, why they started, something made for one person:
each one found goes in `facts.moments`, references/research.md), an outcome and
what the audience gains. Missing categories are allowed. Never
invent a struggle, quotation, motive, turning point or success to fill an arc.
Historical milestones keep their event date and value; current profile counts
keep today's reading. Do not replace a past milestone with today's count.

### Material selection

Before reducing the research to three to five story facts, compare the verified
candidates against the audience and goal. Use short reasons, not numeric scores:

| Criterion | Ask |
| --- | --- |
| Relevance | Does this help this audience remember the intended idea? |
| Specificity | Does it show this creator's actual work, choice or method? |
| Evidence | What exact claim does the accessible primary source support? |
| Visual clarity | Can the real material be understood briefly on a phone? |
| Contribution | Does it add something the other selected facts do not? |
| Heart | Is there a person in it (who, why, for whom), and would a stranger feel something? |

Evidence is a prerequisite for a factual claim, not a score that popularity or
visual appeal can offset. A creator's statement supports attribution, not an
independently verified outcome. Distinguish an available screenshot/demo from
an asset still needed; narrow the claim or use supported text when no asset is
available. Never invent a before/after result to make a visual stronger.

Keep the useful low-engagement demonstration ahead of an unrelated viral post.
Weigh the most human moment first: their family, why they started, something
they made for one person. It is a candidate for the heart of the film whatever
its views: engagement says what people came for, not what a stranger will feel.
Avoid three facts that all prove popularity. Select complementary facts; their
story order follows their relationship, not this comparison. User priorities
may change the relevance judgement but cannot supply missing evidence.

For each retained `facts.story` entry, add optional editorial metadata:

```json
"selection": {
  "relevance": "Shows editors what they can check before export.",
  "specificity": "The creator's own CaptionCheck demo.",
  "evidence": "The original demo shows contrast and safe-area checks only.",
  "visual": "A readable crop of the supplied demo; no measured improvement claim.",
  "contribution": "Explains the tool, unlike the milestone count.",
  "reason": "Use the demo to explain the creator's value before showing reach."
}
```

Record up to three significant exclusions in `facts.selectionNotes` as plain
strings (e.g. "The viral joke is verified but does not explain the editor tool").
Do not store every rejected post or repeat the full research. The story page
shows each retained reason and these tradeoffs. Older facts need no migration.

## 2. Search the important gaps once

Identify up to five concrete questions that could change the story choice.
Search original threads and linked primary sources, including less popular
posts. For example: "Did the creator explain why they changed their approach?"
is better than another search for their highest-viewed post.

Use the available browser/search tools. When the user said yes to Grok Build
(film.json `grok`), write a JSON array of questions to `research/gaps.json`:

```json
["Which original post explains the decision behind the creator's first project?"]
```

Run `node <skill>/engine/scripts/grok-search.mjs <film> --gaps`. This is one
more run on the user's Grok account, part of the research they agreed to (say
what it found, never what it cost); do not run it when the evidence is already
sufficient. It keeps `grok.json` intact and writes
`grok-followup.json` and `grok-followup-raw.json`. `--gaps --from-raw` reparses the
saved response without searching or needing Grok installed. Verify retrieved
leads before adding them to facts. Record inaccessible or absent evidence.

Stop after one targeted round. If the central link is still unsupported, narrow
the claim or choose a work/method/positioning story. Do not require a growth or
adversity story when the sources support a clear portfolio introduction.

## 3. Tell it as a scene

A direction is not a list of points. A film that shows one fact after
another, each with its own device on its own empty stage (a count, a
calendar, a card held up to read), is a report card: every fact is true and
nobody remembers the person. Eight films taught this. The one the user keeps
as the best (蜗牛King's) says one thing, plays inside the creator's own covers,
and turns four things into other things; the ones that fell short told their
points in order, in words, with a toy that only cheered.

Aim for three directions, not three rewrites of one opener; use fewer when
the sources only support fewer, and say why. Each is told as below.

### The line a viewer retells

Write first, before any beat: the sentence a viewer would say to a friend
afterwards, 「就是那个……的人」 (`retold`, in the film's language). The whole
film exists to plant this one sentence.
- It names them and one thing. A contrast inside it is what makes it stay:
  「就是那个自称『马斯克得不到的男人』、最后被官方认证的铁柱」, 「就是那个给几百人
  讲 AI 落地、回到家却被一页 PPT 难住的讲师」. A list does not stay:
  「一万粉、1,500 star、官方大使」 is three facts and no person.
- It is theirs alone: say it of another creator and it is false.
- What does not serve it is left out, however big its number.

Write ten of them first, fast, and different in kind (what they call
themselves, what they keep doing, what went wrong once, what people come to
them for, what only they would say), from the sources. Strike the ones
another creator could wear. Develop three. Ten lines cost a minute; three
directions built on the first line that came are three versions of one idea.
The lenses that help find them, never as templates: a moment that is theirs,
a method shown on one piece of work, a dated start and what it became, a
need they answer.

### The first five seconds

Who this is, before what they did (`intro`). A film that opens on an
anecdote before the viewer knows whose it is has nobody to care about.
- **The name**, readable. The page shows it; an opening that turns the page
  away before it can be read says it again, as the toy arrives.
- **Their own words** (`intro.words`): one line of theirs that says who they
  are, quoted. The bio usually holds it (「马斯克得不到的男人」, 「养成系小白」).
  The toy can carry it, plant it, wear it.
- **What only they would do** (`intro.does`): the first thing the toy does.
  Not a wave: every toy waves. Tapping a microphone before a hall, holding
  up its own boast, pushing its 3D glasses.
- **What it carries, who comes with it** (`intro.carries`, `intro.with`):
  a thing or a companion from their own pictures (the black ball that is in
  every one of 铁柱's covers, a saxophone on a banner, a work badge). It
  comes back at the end.

### A scene, not a list

`scene: { where, wants, stuck, turn }`, in the user's language:
- **where**: one place, and it is theirs ("Their world" below). The film
  stays in it; things in it become other things.
- **wants**: what the toy is trying to do in this film. Something seen (lay
  a road, hold a hall, answer a question), not "succeed".
- **stuck**: what is in the way. A film where nothing is in the way is good
  news read out: a win, a count, confetti, and again. It need not be
  dramatic: a gap, a wait, a request, a thing too heavy. It must be true:
  never invent a struggle. Their own words usually hold it (「自媒体很苦」,
  「天塌了啊！！！」, 「野生」), and what cannot be sourced is left out.
- **turn**: how it flips. This is the image people remember (`image`): the
  biggest, fullest picture in the film, with a held beat before it (the
  music stops, the toy waits), and the first thing built in step 4.

The points (`facts.story`) are what the scene is made of, not its outline:
one or two stretches of it (`beats`), each a part of the same scene. A point
that needs a stage of its own and a device of its own is a second film.

Numbers are evidence and scale. One counts up at most, the one the story
turns on; the others stand as they are written, on the thing they belong to
(a cover, a stamp beside the name). `materials.mjs` says when a direction has
two counts.

Things become other things, and each change means something: the picture
becomes the toy, a cover becomes the stage, a photo becomes the hall it was
taken in, the screen shrinks to a laptop, a logo becomes a snail's shell. A
film has two or three of these; they are what only this kind of film can do.

A toy that only cheers has no story. Its face does not move, so its body
says it: startled, ducking, slumped, leaning into a weight, kicking a thing
away, looking up (`engine/lib/poses.json`: the same poses on the frames and,
as moves, in the film), with a mark over its head where that helps (！ ？ …,
a drop of sweat). Give it someone to play against where the material has
one: a companion, a thing that answers back, whoever asked the question
(present without a face when they are private: a letter, a bubble, a small
pair of shoes).

### Their world

Where the film plays is theirs (`scene.where`): the colours, the things and
the place come from their banner, covers, site and photos, written down in
the research (`facts.character.world`). 铁柱's covers hold a whole world
(cream, orange stepping stones, a black ball) his first film hardly used;
a banner in yellow and black with a saxophone is a stage waiting.
The skill's dark stage is for material that carries its own colour (covers
that fill the frame). On plain material (posts, screenshots, photos) the
same dark floor with white boxes on it is where films come out alike.

Material becomes places, things and characters, not cards to read: a photo
grows into its hall, a chat's bot hops out of the screen, a post's three
tool names fall as three blocks. A card held still to be read is the
exception, for when the exact words are the proof and nothing else can be.
Strip every word from the film in your head: what is left to see is the
story it tells.

### How it feels

`tone`: how the film feels, from how they write, with the line that shows
it. Someone who jokes about themselves gets a film that is funny; someone
quiet gets one that slows down. Every film on the same celebrating beat is
one film. The score, the pace and the toy's moves follow it.

### Start from the person

Write each direction from its heart outwards. First the person: who they are,
why they do it, for whom, and the moment that shows it, from `facts.moments`.
Then the points that carry that moment; only then the numbers. A count says
how far something went: it is evidence and scale, never the story. A film
built the other way round (the biggest numbers first, a person added to
explain them) proves popularity and moves no one.

Record it as `heart: { who, why, forWhom, moment, story }`, in the user's
language; `story` is the point that holds the moment, so the film shows it.
Every part comes from the sources, like any fact: a part they do not show is
left out, never guessed, and a motive the creator never stated is a gap, not a
heart.

What moves people is someone who cares about something and what it cost
them: that is not a synonym for family. Three films in a row put a family
member's sentence in a speech bubble at the centre; that is a formula as much
as a count is. And the moment has to show what a viewer comes to them for:
the father who answers his child's question step by step is the man whose
tutorials go step by step. A moving moment that sits apart from what they
offer makes a film in two halves, an anecdote and then a résumé on a card.

When the research found no personal moment (`moments: []`), the heart
is the creator and what they keep doing, said plainly (`who`, `why`), and the
page says none was found; never invent one. A heart need not be family: the
readers they answer every night, the tool they built because they needed it.

Every direction has a heart, whatever its lens: directions differ in how they
tell it. The story page shows it first on each card, above the pitch, and
`materials.mjs` says which direction has none, which never shows its moment,
and which is only numbers.

### What the viewer comes to them for

Every direction also answers, for a stranger watching it: when I have what
need, what do I find with this creator? Record it as `viewer: { who, need,
finds, when, next }`, in the user's language: who it is for (else the page uses
`narrative.audience`), the need they arrive with ("I want to make a poster with
AI and don't know where to start"), what they find here (the posts, tests and
tutorials that answer it, from the sources), when they will think of the
creator again, and where to look next (the account, the post, the site). The
opening, the beats and the ending answer it together: a row of their work alone
does not say what it is for. "What they offer" means what a viewer can read,
watch or use there; a paid course, commissions or consulting go in only when a
source shows them. When no direction can answer it, write a clearer one rather
than keep three that can't. `materials.mjs` names every direction without
`need`, `finds` and `when`.

Each direction must say what the viewer should remember, the question or promise
that holds attention, how each fact advances it, and how the ending pays it off.
Use one or two factual beats for a typical 30-second film: stretches of the one
scene (the engine allows up to four; a third and a fourth are usually a list
starting). Use `connection` to explain contrast, cause when evidenced,
demonstration or progression. Achievements that could be shown in any order
are not a scene yet: find what the toy wants and what is in its way.

Hold each direction to the swap test as a story: who it is about, why they did
it, for whom. Give it to another creator and it should break. A fact alone (a
famous puzzle, a tool's feature, a follower count) passes to anyone.

A visual metaphor may carry the film through its points: one motion that comes
back (a fold that doubles, a thread that lengthens) and ties a moment to a
milestone. It is a way of showing, not a claim: the film never says one fact
caused the other, and every number on screen keeps its source. A claim of
cause needs a source; a rhyme between two facts does not. `connection` says
which it is.

Give every main beat `action: { does, means }`: what the toy visibly does and
what the viewer learns from it. Tie it to that beat's source material and the
reference character's actual body. Apply the deletion test in
`references/story-test.md`; a decorative hop is not a demonstration of a method.

Keep narrative hook and camera opening separate: "the page turns left" is a
visual treatment; it does not tell the viewer why to care. Specify first-frame
action and short on-screen text; add speech only if the film uses voiceover.
The words must be supported and the film must deliver their promise.

Give every direction a `pitch`: the whole film's idea in one sentence a jury
would remember (SKILL.md, "The bar"); and an `image`: the one picture it
leaves, as the viewer sees it (the page folded again and again, the stack
rising to the star), in the user's language. The story page shows both under
the title, and the review asks whether the film delivers that image. Each beat
plays its point's recommended idea (`becomes[0]`, designed from the material
first: references/research.md); a direction may prefer another
(`beats[].idea`, its place in `becomes`).

Choose the camera opening for the story, not from a menu, and record it as
`opening: { "id", "why" }`: it hands over to the first beat. The page floating
while the picture peels off (`opening`) ends with the toy on the pinned post,
so it opens a film whose first beat rises from that post (`act2`); otherwise
the page lying flat and standing up (`page-stand`, `page-stand-left`) ends with
the toy out in front, ready for any beat; or the film's own opening, when the
material asks for one: `{ "id": "own", "beat": "beats/<name>.js", "pitch",
"sketch", "why" }`, shown on the card by its pitch and sketch like a point's
own idea, and written as a beat (references/beats.md). Left or right: whichever the films delivered before
used less (`run.mjs ledger` lists them while the film is in step 2). The user
is not asked; the card shows `why` alone, so it says what the viewer sees in
this story's words, and why it fits; they can still ask for another.

Write `facts.directions` and `facts.recommendedDirection`. This illustrative
shape references facts already present in `story`; replace all sample content:

```json
{
  "id": "for-her-father",
  "title": "Made for her father",
  "premise": "She builds reading tools for people with weak eyes; the first was for her father.",
  "heart": {
    "who": "A developer who builds reading tools",
    "why": "Her father could no longer read his phone",
    "forWhom": "Her father first, now anyone whose eyes are failing",
    "moment": "The evening she rebuilt his phone's screen by hand, button by button",
    "story": "s1"
  },
  "viewer": {
    "who": "People whose eyes are failing, and the children who set up their phones",
    "need": "Their phone's letters are too small to read, and the settings don't help enough",
    "finds": "Her free reading tools, and the posts showing how to set each one up",
    "when": "When a parent can no longer read their phone",
    "next": "Her account's pinned post, which lists the tools"
  },
  "retold": "就是那个为了爸爸看得见，把手机按钮一个个做大的人",
  "intro": { "words": "「字太小，就做大」(her bio)", "does": "Taps a button on the page, and it grows under her finger", "carries": "her father's old phone" },
  "scene": {
    "where": "Inside her father's phone: its home screen as a room, the buttons its furniture",
    "wants": "To make every button big enough for him to read",
    "stuck": "The buttons are too many and too small; each one she pushes grows, and three more shrink",
    "turn": "She stops pushing buttons and pushes the wall: the whole screen grows at once, and the toy can stand on the letters"
  },
  "tone": "warm and plain: she writes in short sentences, never an exclamation mark",
  "pitch": "Every button she made bigger was made bigger for him first",
  "image": "Her father's phone screen growing, button by button, until the toy can stand on the letters",
  "opening": { "id": "page-stand", "why": "the page lies flat, then stands up; the toy comes out in front of it, ready to show his phone" },
  "hook": {
    "question": "Why would someone rebuild a phone's screen by hand?",
    "visual": "The toy pushes one tiny button on a phone screen, and it grows.",
    "text": "It started with one phone"
  },
  "beats": [
    { "story": "s1", "role": "The moment it began", "connection": "", "action": { "does": "Push each button of her father's screen until it is big enough to read", "means": "The viewer sees why she builds what she builds" } },
    { "story": "s2", "role": "What it became", "connection": "The tool she made for him is the one she shares now.", "action": { "does": "Step from his phone onto the app's own screen", "means": "The viewer sees the same idea, now for everyone" } }
  ],
  "payoff": "The viewer knows whom she builds for, and that they can use it too.",
  "why": "Her own post tells the evening with her father; the app's page shows the same big buttons.",
  "gaps": [],
  "cta": { "slogan": ["Bigger letters", "for everyone"], "prop": "her father's old phone, its buttons grown big", "sketch": "research/sketches/ending.jpg" },
  "frames": [
    { "picture": "research/frames/a-1.jpg", "part": "intro", "at": [0, 5], "seen": "Her page stands up; the toy steps out holding the old phone and taps a button, which grows", "words": ["<her name>", "字太小，就做大"] },
    { "picture": "research/frames/a-2.jpg", "part": "wants", "at": [5, 12], "seen": "Inside the phone: she pushes button after button bigger", "words": [] },
    { "picture": "research/frames/a-3.jpg", "part": "stuck", "at": [12, 15], "seen": "Three shrink for every one she grows; she stops, arms hanging", "words": [] },
    { "picture": "research/frames/a-4.jpg", "part": "turn", "at": [15, 21], "seen": "She pushes the wall instead: the whole screen grows, and she stands on a letter", "words": [], "key": true },
    { "picture": "research/frames/a-5.jpg", "part": "ending", "at": [21, 26], "seen": "The phone, its buttons grown big, is what she stands on", "words": ["Bigger letters", "for everyone"] }
  ]
}
```

`frames` is the storyboard on paper ("See it before it is built", below):
`part` is `intro`, `wants`, `stuck`, `turn`, `after` or `ending`; `at` its
seconds; `seen` what moves in it (the user's language); `words` every word on
screen in it (the film's language); `key` the image to remember.

### The ending

The last picture puts the name and what to come for into one thing (`cta`):
蜗牛King's 公众号 mark is the shell of a snail. To find it, write down what
the name pictures (铁柱: an iron post; a name that means miles: a runway) and what the
offer pictures (a guide: a signpost; 落地: a landing), and look for the
thing that is both: 铁柱 is the iron post that carries the signpost;
「AI 落地 找他」 lands a paper plane. A prop that belongs to neither
(a ball, a star, a stack of cubes) is a pedestal. What the toy carried in
its first five seconds comes back here.

### See it before it is built

A direction's image has to be seen as a picture before the user chooses and
before production starts: `frames`, five to seven of them, each composed as
the film will frame it, with the film's own toy in the pose it takes and
their own material as the set (`references/frames.md`). A label with an
arrow to the creator's picture explains an idea; it does not show the frame,
and what was never composed as a frame comes out of production as three
labels on an empty floor. The story page shows the line and the frames
first; the readings by someone told nothing (`references/story-test.md`:
without a word, then blind) are taken from them.

An opening of the film's own (`"opening": { "id": "own", ... }`) has no preview
strip of the skill's: its `"sketch"` is made from their material, like a point's
idea, and the story page shows it whole under the opening's line.

What production needs before it can start (a face to install, frames to cut
from their film, a picture to ask the user for) goes in the direction's
`prepare`, a line each: the card shows it apart from `gaps`, which are evidence.

Compare creator specificity, audience relevance, evidence and visual clarity in
plain words. Recommend one supported direction with a concrete reason, not a
made-up probability of going viral. Put unresolved central evidence questions in
`gaps`; the story page shows them. Such a direction can still be chosen once its
claims are narrowed to what the sources support (`apply-research` repeats the gaps
as a warning). Never clear gaps to hide them. Prefer a narrower supported option.

### Opening variants

For the recommended direction, draft up to three genuinely different hooks
using the same verified facts: show the work first, ask a specific audience
question, or contrast two documented states. Use fewer if the evidence cannot
support three. A question must not smuggle in an unverified premise; do not
promise money, speed or a transformation that the film cannot demonstrate.

Keep the recommended hook in `direction.hook`. Put up to two alternatives in
`direction.hookAlternatives`, each `{ question, visual, text, why }`. `why`
explains the tradeoff for this audience. Write in the film's language. Each
variant needs a legible first image, a short line and a clear connection to the
first factual beat and ending. A different camera move or synonym is not a new
hook. These are editorial options, not measured retention predictions.

Show alternatives alongside the recommended story, within the existing choice
round; do not ask for an extra approval. Unless the user prefers an alternative,
keep the recommended hook. If they do, copy that alternative's `question`,
`visual`, and `text` into `direction.hook`, keeping the other options for
reference. There is no `picks.hook` field or automatic option resolver.
Regenerate the story-test brief and review the changed promise before applying.
At step 4 implement the selected hook only; alternatives are not extra scenes.

## 4. One choice, then the existing film pipeline

`materials.mjs` shows the direction cards as the story choice, lettered A/B/C.
A card opens on the line a viewer retells and its frames, big, each with the
part it plays, what is seen and the words on screen; then the first five
seconds and the scene in rows.
Above them a table sets the directions side by side, one row each for the
pitch, the heart, who it is for, their need, what they find, when they come
back, where to look next, the order of the beats, the image, the length and
the ending (a row none of them fills is left out); a single direction gets the
same rows as one short block instead. Each card then has its audience/goal,
recommendation, the person at its heart, what the viewer comes for, a row of
small pictures from the opening to the ending (each one a link to that part;
the ending's is `cta.sketch`, when there is one), the pitch, the image, the opening, the first
picture and its words, each fact with its picture, its connection, what the
viewer learns and its ideas (the film's own with their sketches, the skill's
with their preview strips), the payoff, the ending, evidence links and gaps.
The fact cards move to the second picture (`materials-posts.png`) for detail
and custom choices. Under the directions it lists the personal moments found
(`moments`): which direction uses each, and why one is left out. Endings are numbered, so an answer reads "story A,
ending 1".

Ask for a direction (with another idea for a point, if they prefer one) and
the ending together. Record `picks.direction: "method"`; its `beats` supply
the story order, its `opening` the opening, and its `cta` the default ending.
`picks.cta` may replace the ending. To choose another idea for a point, use
`picks.story: ["s1", { "id": "s2", "idea": 1 }]` (or `{ "id": "s2", "anim":
"phrase" }`) with the same IDs and order as the direction. If the user changes
the order or facts, update the direction, hook, opening and payoff to match
before applying it. When the ending they pick is not the direction's own,
check the payoff still answers the hook, rewrite it if not, and write the
picked ending into the direction's `cta` (until then `apply-research` and
`check` say so).

Older workspaces with only `picks.story` or `proof1/proof2` still work. For a new
unattended film choose the supported recommendation, record `picks.direction`
and explain the assumptions in the handover. Never silently select a direction
with missing evidence: say which gaps remain and how its claims were narrowed.

Then run the internal story test in `references/story-test.md` (the toy can
be built meanwhile). It checks the takeaway, reason to keep watching, creator
specificity and the meaning of each toy action. It adds no user approval round
and stops nothing: `apply-research` reports what it still asks for. A changed
direction is worth a fresh review.

`apply-research` stores the selected direction in `film.story.direction`. During
step 4, implement its hook in the film's own code and check the promise against
the actual frames; this metadata alone does not draw text or animate anything.
Use `references/beats.md` for custom animation. The review brief includes the
direction so the reviewer can compare intent with the rendered result.
