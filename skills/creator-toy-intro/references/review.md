# The independent review

The agent that made the film cannot see it fresh. A reviewer who gets only the
film and a short brief can, and catches what the user would otherwise catch a
round later. A film that bores is the one users turn down most, so the review
always asks where attention first drifts.

Run it twice:
- in step 4, after you have looked at the page yourself and before the user
  sees it;
- in step 5, on the finished film before you hand it over.

Each time, run at most two rounds.

## Run it

```bash
FILM=<film> node <skill>/engine/run.mjs pace                # the numbers: quiet stretches, the toy alone, reading time
FILM=<film> node <skill>/engine/run.mjs review              # → build/review.md and build/review/sheet-*.jpg
FILM=<film> node <skill>/engine/run.mjs review -- --final   # step 5: the finished film instead of the animatic
```

`build/review.md` is the reviewer's whole brief:
- the creator and the platform;
- the film's parts;
- the contact sheets (a frame every half second, each labelled with its
  time; the preview frames when there is no animatic yet);
- the cues and the lines to read;
- the pace check's results;
- the rubric below.

Give it to a fresh reviewer: a subagent where you can start one, told to read
`build/review.md` and the pictures it names and nothing else. It does not get
this conversation. Where you cannot start one, review it yourself, from the
brief alone, as if you had never seen the film.

Then:
- **Fix only the three problems the reviewer ranks first**, and render again
  only what they touch (`diff-anim`, storyboard.md).
- **Run the review again**, once at most.
- **The user's word wins, and they hear the other side.** When the reviewer
  argues with something the user decided ("no snail", the slogan, how a
  number is written), leave it as the user had it. Offer the reviewer's view
  to the user as one more choice, in a line: "the reviewer would write it 1万;
  keep 10,000?"
- **Tell the user, in one line each, what the review changed.**

<!-- rubric -->
## The rubric

Score each from 1 (fails) to 5 (nothing to fix):

1. **The creator.** Is the toy them, in motion too? Is the profile picture
   their own? Are their numbers right and written the way their platform
   writes them ("1,500", "304万")?
2. **The idea.** Does the film say who they are with their own material?
   Is there one moment only this kind of film could do?
3. **The pacing.** Where does attention first drift? Always answer with a
   time. Look for a hit in the first 3 s, quiet stretches, a move repeated
   for no reason, and a part that stays longer than it has things to show.
   The pace check's results are in the brief; judge what they cannot.
4. **The motion.** Does each move have weight: it winds up, follows through
   and lands? Is there one toy on screen? Does anything pass through a wall
   or the floor?
5. **The lettering.** Does every line stay long enough to read (the brief
   says how long each needs)? Can it be read against what is behind it?
   Is it inside the safe box?
6. **The look.** Does the dark stage stay dark? Do whites read as white
   without glowing? Does the toy look like vinyl? Is the light on the toy,
   not on the world?
7. **Sound and picture.** You cannot hear the film. From the cue list,
   judge whether every hit has its sound, whether a sound plays over
   nothing, and whether the moments that matter are marked.
8. **The finish.** Look for flicker, jumps at a join between parts, a frame
   that shows both sides of a cut, and anything cut off at an edge.

Answer in this form, in English:

```
scores: creator 4, idea 3, pacing 2, motion 4, lettering 3, look 4, sound 4, finish 5
drifts: 14.5 s, the wall holds and nothing new happens
fix (the biggest effect on a viewer first, three at most):
1. 13.0–18.4 s · pacing · the toy climbs three boxes the same way · climb two, a bar shorter
2. …
3. …
keep: what works and must survive the fixes (one or two things)
```

Each fix names:
- its time;
- the rubric line it falls under;
- what is wrong, as the viewer sees it;
- the smallest change that would mend it.

Leave out what you cannot see in the brief.
<!-- /rubric -->

The rubric's lines follow the one in Vincentwei1021/mg-styles-15 (MIT), with
the creator and the toy added. Three other sources shaped the review:
- huashu-motion (MIT): the question about drifting attention, and a reviewer
  who sees only a narrow brief;
- @0xwhrrari's notes on a video studio built around a model: three defects
  with times, one round at a time;
- lemo-opuscar (MIT): the reading speeds.

The words here are ours.
