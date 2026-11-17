# Test the story before making the toy

Run after choosing a complete direction, before the storyboard's previews (the
toy can be built meanwhile). This is an internal text review, not another user
approval step, and advice rather than a gate: it never stops the film. Older point/proof projects still work;
use these questions manually when revisiting them.

## Give every major action a purpose

For every `directions[].beats[]`, write:

```json
{
  "story": "s1",
  "role": "Show the creator's tool",
  "action": {
    "does": "The toy reveals the creator's actual tool screenshot inside a small-screen frame.",
    "means": "Editors see that the tool previews captions before export."
  }
}
```

Use an action the reference character's body supports. A lemon can roll or
direct attention with its position; it need not grow hands to present a tool.
After inspecting the confirmed image, optionally record a short factual
`facts.toy.description` of its body. A text-only reviewer with just an image path
must leave anatomy unassessed; the reference/rig checks in step 3 still apply.
Standing still can be purposeful when the work needs attention. A brief greeting
or move between scenes may serve identity or navigation, but should not occupy
a whole beat without adding meaning.

Apply the deletion test: if removing a hop, climb, spin or particle burst leaves
the viewer's understanding unchanged, shorten/remove it or name its specific
navigation/identity purpose. Do not merely rename decoration as storytelling.
Show the actual work when the point is what the creator makes; show an accurately
labelled number when the point is a documented result. A visual metaphor must
not imply an unsupported event, endorsement, skill, income or causal claim.

## Read it blind first

A film is watched by people who were told nothing. The agent that wrote the
story cannot say whether its frames plant the line: it already knows the
line. So when the chosen direction has frames, `story-test.mjs` first writes
`research/story-blind.md`: the frames in order, what moves in each, the
words on screen, and six questions (who is this, in a sentence to a friend;
what would you come to them for; the one frame you remember; where you
smiled or felt something; where you were lost; what is left with the words
taken off). It holds nothing of the line, the pitch or the person.

Give it to a reader who has not seen the story: a new subagent, started with
no history and told to read that file and the pictures it names and nothing
else, or a person. A fork of this conversation has read the story and is not
blind. Where the reader can open the film's other files, hand it a copy of
the page and its pictures in a folder that holds nothing else. Save
the answer as `research/story-blind.json` (`retell`, `offer`, `remember`,
`felt`, `lost`, `wordless`) and run `story-test.mjs` again: the brief then
sets what the reader said beside the line the story means to plant
(`retold`). Where no such reader can be had, say so (`"blind": "not read: no
reader"`); never answer for them. The frames are cheap to change: when the
reader says something else, change the frames or the line, and read again
(two rounds at most).

A sentence that matches the line is the least of what the reading gives. The
first one done this way matched its line, and still said that four of seven
frames told nothing without their words, that a drawn microphone was a grey
disc, that the toy pointed away from the screen it was showing and stood
far from the block it was meant to push, and that the joke and the point
both lived in a post's text. Read `lost` and `wordless` as the list of
frames to draw again, and `felt` as where the film is alive: frames nobody
felt anything at are asked what they are for.

A story told as a scene is asked three more things in the review below:
- **retold**: is the reader's sentence the same person and the same reason
  to come as the line? If not, what did the frames plant instead?
- **scene**: what the toy wants, what is in the way, how it turns, and the
  frame that shows each. A film with nothing in the way is good news read out.
- **shown**: with every word removed, what is left? Each frame whose meaning
  lives only in its words, and how its picture could carry it; and whether
  more than one number counts up.

## Review the selected story cheaply

1. Run `node <skill>/engine/scripts/story-test.mjs <film>`. It writes
   `research/story-test.md` from the selected direction, facts, source posts,
   effective ending and character reference. It never generates a ready verdict.
2. Read that brief with fresh eyes, or give only the brief to a fresh reviewer.
   No research, paid calls, modelling or rendering is needed. Answer:
   - **Takeaway:** how would a stranger introduce this creator in one sentence?
     And could they finish "when I need ___, I find ___ with them" from what the
     film shows (the direction's `viewer`, references/story-directions.md)?
   - **Continuation:** why would they watch the next beat, or the payoff of a
     one-beat story?
   - **Specificity:** what work, method, words or detail prevents this from
     being the same film after swapping the creator's name?
   - **Action meaning:** what does each main action communicate, and does it
     survive the deletion test?
   - **Material:** what is special about each beat's material, and does its
     animation use it? Swap in another creator's material: if the animation
     stays the same, it is a template, not an idea. A ready-made animation
     has to beat the point's own idea; say why it does. Would a jury at Annie
     (Best Sponsored Production), Annecy (Commissioned Films) or D&AD call a
     piece a template or a repeat of another film, and what one image would
     they remember (SKILL.md, "The bar")? Does the opening hand over to the
     first beat?
   - **Heart:** who is at its heart (a person: who they are, why they do it,
     for whom), and what would a stranger feel? A film of numbers and devices
     can be clever and still move no one. Does the film show the moment its
     `heart` names? Of the `moments` found, was a stronger one left out, and is
     its reason good (never its views)?
3. Save the actual review to `research/story-test.json`:

```json
{
  "signature": "<copy the exact signature from the generated brief>",
  "verdict": "revise",
  "takeaway": "A concrete answer about this creator, grounded in the packet.",
  "continuation": "The specific reason to keep watching, or what is missing.",
  "specificity": "The distinctive evidence, or why a name swap still works.",
  "actionMeaning": "What the major actions communicate; identify empty motion.",
  "material": "What each beat's animation takes from its material, which piece a jury would call a template, and the one image they would remember.",
  "heart": "The person at its heart, why and for whom, and what a stranger would feel; or that it is all numbers.",
  "issues": ["s1: the toy hops beside a count, but the tool is never shown; reveal the actual tool instead."]
}
```

Use `ready` and an empty `issues` list only after the story earns them. The
script checks completeness and freshness, not whether a story is compelling.
Do not paste canned answers, change the signature to reuse an old review, or
remove an issue just to unblock production. Resolve at most three problems,
then review once more. Each round's review is kept: when the story changed,
`story-test.mjs` copies the last `story-test.json` to
`story-test-round1.json` (then `-round2` …) before you save the next. If it remains weak, narrow the claim/direction to supported
work and explain the limitation; do not enter an endless review loop or invent
facts. Preserve the user's explicit choices and explain any necessary change.

4. Run `node <skill>/engine/scripts/story-test.mjs <film> --check`, then
   `apply-research.mjs <film>`. A missing, stale or revise review is reported
   by `apply-research`, `next` and `check` as something to look at; it does not
   stop the film. Fix what the review found, or tell the user in a line why it
   stays. Old point/proof selections do not acquire a new schema.

Changing the source packet, hook, action, story order or chosen ending invalidates
the report. Re-review the changed story; JSON key ordering alone does not matter. A change
that leaves the review standing (a word in a why, a typo, a sentence of the
heart said better) needs no new review: `story-test.mjs <film> --resign "what
changed and why the review stands"` signs it again on the story as it is and
keeps the note with the old signature (`resigned`). A changed story, beat,
source or ending is reviewed again.

The chosen direction lives in two places, film.json `story.direction` and
the direction in `research/facts.json`: `check` stops the render when they
differ and names the parts. Make a change on both sides; run apply-research
again only for a new direction, as it rewrites `story.segments` (a film's
hand-made segments too).
`next` explains the pending check, and preflight checks it again before rendering.

## Verify the meaning in actual frames

During step 4 implement `action.does` in the film's own animation code. The
metadata is a brief, not an animation command. The material page shows both the
action and its meaning, and the reviewer receives them through `story.direction`.
At storyboard/final review, watch without the explanatory notes first: can the
picture communicate `action.means`? If only the written explanation makes it
work, change the action, framing or short text. Keep existing motion/physics,
reading-time and anatomy checks.
