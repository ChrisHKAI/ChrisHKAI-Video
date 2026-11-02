# Story directions (step 2, before choosing animation)

- [Evidence map](#1-make-an-evidence-map)
- [Material selection](#material-selection)
- [Opening variants](#opening-variants)
- [Targeted gap search](#2-search-the-important-gaps-once)
- [Complete directions](#3-propose-distinct-complete-directions)
- [Start from the person](#start-from-the-person)
- [Selection and handoff](#4-one-choice-then-the-existing-film-pipeline)

Read after collecting the first round of sources, before building the story
page. Make the creator memorable through one supported idea. Keep the existing
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

## 3. Propose distinct complete directions

Aim for three directions, not three rewrites of one opener. Use fewer when the
sources only support fewer; say why. Each starts from its person (below).
Examples of lenses, not mandatory templates:

- **Person:** a moment that is theirs (a question someone asked them, why they
  started, something made for one person) → what they made of it → what it
  says about them, and what the viewer gets from it.
- **Method:** an audience problem → a representative work showing the approach
  → what the viewer can learn.
- **Journey:** a dated starting point → a documented choice or changed approach
  → an outcome. Use causal language only when the source supports it.
- **Positioning:** a specific audience need → evidence of relevant work → the
  creator's useful promise.

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
heart. When the research found no personal moment (`moments: []`), the heart
is the creator and what they keep doing, said plainly (`who`, `why`), and the
page says none was found; never invent one. A heart need not be family: the
readers they answer every night, the tool they built because they needed it.

Every direction has a heart, whatever its lens: directions differ in how they
tell it. The story page shows it first on each card, above the pitch, and
`materials.mjs` says which direction has none, which never shows its moment,
and which is only numbers.

Each direction must say what the viewer should remember, the question or promise
that holds attention, how each fact advances it, and how the ending pays it off.
Use two or three factual beats for a typical 30-second film (one to four allowed).
Use `connection` to explain contrast, cause when evidenced, demonstration or
progression. Reorderable achievements with no relationship need a clearer lens.

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
  "cta": { "slogan": ["Bigger letters", "for everyone"], "prop": "her father's old phone, its buttons grown big" }
}
```

An opening of the film's own (`"opening": { "id": "own", ... }`) has no preview
strip of the skill's: its `"sketch"` is made from their material, like a point's
idea, and the story page shows it whole under the opening's line.

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

`materials.mjs` shows the direction cards as the story choice, lettered A/B/C:
audience/goal, recommendation, the person at its heart, the pitch, the image, the opening, the first
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
check the payoff still answers the hook, and rewrite it if not.

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
