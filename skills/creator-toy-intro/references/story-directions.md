# Story directions (step 2, before choosing animation)

- [Evidence map](#1-make-an-evidence-map)
- [Material selection](#material-selection)
- [Opening variants](#opening-variants)
- [Targeted gap search](#2-search-the-important-gaps-once)
- [Complete directions](#3-propose-distinct-complete-directions)
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
an outcome and what the audience gains. Missing categories are allowed. Never
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

Evidence is a prerequisite for a factual claim, not a score that popularity or
visual appeal can offset. A creator's statement supports attribution, not an
independently verified outcome. Distinguish an available screenshot/demo from
an asset still needed; narrow the claim or use supported text when no asset is
available. Never invent a before/after result to make a visual stronger.

Keep the useful low-engagement demonstration ahead of an unrelated viral post.
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

Use the available browser/search tools. With Grok Build and the user's existing
authorization/budget, write a JSON array of questions to `research/gaps.json`:

```json
["Which original post explains the decision behind the creator's first project?"]
```

Run `node <skill>/engine/scripts/grok-search.mjs <film> --gaps`. This is one
additional paid run, not part of the first run's cost; do not run it when the
evidence is already sufficient. It keeps `grok.json` intact and writes
`grok-followup.json` and `grok-followup-raw.json`. `--gaps --from-raw` reparses the
saved response without searching or needing Grok installed. Verify retrieved
leads before adding them to facts. Record inaccessible or absent evidence.

Stop after one targeted round. If the central link is still unsupported, narrow
the claim or choose a work/method/positioning story. Do not require a growth or
adversity story when the sources support a clear portfolio introduction.

## 3. Propose distinct complete directions

Aim for three directions, not three rewrites of one opener. Use fewer when the
sources only support fewer; say why. Examples of lenses, not mandatory templates:

- **Method:** an audience problem → a representative work showing the approach
  → what the viewer can learn.
- **Journey:** a dated starting point → a documented choice or changed approach
  → an outcome. Use causal language only when the source supports it.
- **Positioning:** a specific audience need → evidence of relevant work → the
  creator's useful promise.

Each direction must say what the viewer should remember, the question or promise
that holds attention, how each fact advances it, and how the ending pays it off.
Use two or three factual beats for a typical 30-second film (one to four allowed).
Use `connection` to explain contrast, cause when evidenced, demonstration or
progression. Reorderable achievements with no relationship need a clearer lens.

Give every main beat `action: { does, means }`: what the toy visibly does and
what the viewer learns from it. Tie it to that beat's source material and the
reference character's actual body. Apply the deletion test in
`references/story-test.md`; a decorative hop is not a demonstration of a method.

Keep narrative hook and camera opening separate: "the page turns left" is a
visual treatment; it does not tell the viewer why to care. Specify first-frame
action and short on-screen text; add speech only if the film uses voiceover.
The words must be supported and the film must deliver their promise.

Write `facts.directions` and `facts.recommendedDirection`. This illustrative
shape references facts already present in `story`; replace all sample content:

```json
{
  "id": "method",
  "title": "Learn by building",
  "premise": "Their public examples make a difficult workflow approachable.",
  "hook": {
    "question": "What can I make with this workflow?",
    "visual": "The toy reveals the finished example from the creator's post.",
    "text": "Start with something you can make"
  },
  "beats": [
    { "story": "s1", "role": "Show the representative work", "connection": "", "action": { "does": "Reveal the actual project", "means": "The viewer sees what this creator makes" } },
    { "story": "s2", "role": "Reveal its documented method", "connection": "The tutorial explains how that work was made.", "action": { "does": "Point out the steps in the creator's tutorial", "means": "The viewer sees the documented approach behind the work" } }
  ],
  "payoff": "The viewer knows what they can learn from this creator.",
  "why": "Specific work, direct sources, and a clear visual demonstration.",
  "gaps": [],
  "cta": { "slogan": ["Build along", "with this creator"], "prop": "a miniature of their own project" }
}
```

Compare creator specificity, audience relevance, evidence and visual clarity in
plain words. Recommend one supported direction with a concrete reason, not a
made-up probability of going viral. Put unresolved central evidence questions in
`gaps`; such a direction is not ready to select. Never clear gaps just to pass
validation. Prefer a narrower supported option.

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

`materials.mjs` shows direction cards first: audience/goal, recommendation,
opening hook, ordered facts and connections, evidence links, payoff and gaps.
The original material cards remain below for detail and custom choices.

Ask for a direction, camera opening and ending together. Record
`picks.direction: "method"`; its `beats` supply the story order, and its `cta`
supplies the default ending. `picks.cta` may replace the ending. To choose an
alternative animation, use `picks.story: ["s1", { "id": "s2", "anim": "phrase" }]`
with the same IDs and order as the direction. If the user changes the order or
facts, update the direction, hook and payoff to match before applying it.

Older workspaces with only `picks.story` or `proof1/proof2` still work. For a new
unattended film choose the supported recommendation, record `picks.direction`
and explain the assumptions in the handover. Never silently select a direction
with missing evidence.

Before building the toy, complete the internal story test in
`references/story-test.md`. It checks the takeaway, reason to keep watching,
creator specificity and the meaning of each toy action. It adds no user approval
round; a changed direction needs a fresh review. Only then run `apply-research`.

`apply-research` stores the selected direction in `film.story.direction`. During
step 4, implement its hook in the film's own code and check the promise against
the actual frames; this metadata alone does not draw text or animate anything.
Use `references/beats.md` for custom animation. The review brief includes the
direction so the reviewer can compare intent with the rendered result.
