# Test the story before making the toy

Run after choosing a complete direction and confirming the toy's reference,
before building its geometry or rendering previews. This is an internal text
review, not another user approval step. Older point/proof projects still work;
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

## Review the selected story cheaply

1. Run `node <skill>/engine/scripts/story-test.mjs <film>`. It writes
   `research/story-test.md` from the selected direction, facts, source posts,
   effective ending and character reference. It never generates a ready verdict.
2. Read that brief with fresh eyes, or give only the brief to a fresh reviewer.
   No research, paid calls, modelling or rendering is needed. Answer:
   - **Takeaway:** how would a stranger introduce this creator in one sentence?
   - **Continuation:** why would they watch the next beat, or the payoff of a
     one-beat story?
   - **Specificity:** what work, method, words or detail prevents this from
     being the same film after swapping the creator's name?
   - **Action meaning:** what does each main action communicate, and does it
     survive the deletion test?
3. Save the actual review to `research/story-test.json`:

```json
{
  "signature": "<copy the exact signature from the generated brief>",
  "verdict": "revise",
  "takeaway": "A concrete answer about this creator, grounded in the packet.",
  "continuation": "The specific reason to keep watching, or what is missing.",
  "specificity": "The distinctive evidence, or why a name swap still works.",
  "actionMeaning": "What the major actions communicate; identify empty motion.",
  "issues": ["s1: the toy hops beside a count, but the tool is never shown; reveal the actual tool instead."]
}
```

Use `ready` and an empty `issues` list only after the story earns them. The
script checks completeness and freshness, not whether a story is compelling.
Do not paste canned answers, change the signature to reuse an old review, or
remove an issue just to unblock production. Resolve at most three problems,
then review once more. If it remains weak, narrow the claim/direction to supported
work and explain the limitation; do not enter an endless review loop or invent
facts. Preserve the user's explicit choices and explain any necessary change.

4. Run `node <skill>/engine/scripts/story-test.mjs <film> --check`, then
   `apply-research.mjs <film>`. Missing, stale or revise verdicts stop the selected
   direction from entering the toy-building stage. Old point/proof selections
   do not acquire a new mandatory schema.

Changing the source packet, hook, action, story order or chosen ending invalidates
the report. Re-review the changed story; JSON key ordering alone does not matter.
`next` explains the pending check, and preflight checks it again before rendering.

## Verify the meaning in actual frames

During step 4 implement `action.does` in the film's own animation code. The
metadata is a brief, not an animation command. The material page shows both the
action and its meaning, and the reviewer receives them through `story.direction`.
At storyboard/final review, watch without the explanatory notes first: can the
picture communicate `action.means`? If only the written explanation makes it
work, change the action, framing or short text. Keep existing motion/physics,
reading-time and anatomy checks.
