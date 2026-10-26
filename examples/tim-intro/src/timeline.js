// The film's clock and layout: when everything happens, where everything
// stands, and the camera's shots. src/anim.js turns this into motion.
// Units: seconds, metres; Three.js axes (+y up, the camera's default front +z).

export const FPS = 30;

// ── See You Again (reference/tim/see-you-again.mp3, song seconds) ──────────
// It comes in with the black-and-white portrait, as the folds stop, on the
// quiet piano chorus ("It's been a long day" sung at 172.85,
// at song time `start`); the drums come back at 198.30 and the full band from
// 200.55; it ends at 225.7. 80.1 BPM.
export const SONG = { start: 172.55, drop: 198.3, end: 225.7 };
export const BEAT = 60 / 80.1;

// the big screen's feed: the user's subtitled cut (reference/tim/jobs-2007-2011-subs.mp4),
// the 2007 keynote, D8 in 2010 and the news in 2011, from "this is a day I've
// been looking forward to" to "...has died at the age of 56" (its cuts, s)
const FEED = { d8: 47.5, news: 73.98, end: 85.85 };

// ── story (s) ───────────────────────────────────────────────────────────────
const P = FEED.end; // the portrait, and the song
const at = (songT) => P + songT - SONG.start; // a moment of the song in film time
export const EV = {
  // the big screen (scripts/tv.py edits its feed to these times)
  keynote: 0.0, // 2007: "an iPod, a phone, an internet communicator ... iPhone"
  d8: FEED.d8, // 2010, D8: a flexible iPad? "we don't have the technology ... probably many years away"
  news: FEED.news, // 2011: "The death of a man who literally changed the way we live"
  portrait: P, // the black-and-white portrait; fold 491; Tim stops; the song comes in
  flicker: at(178.6), // "And I'll tell you all about it": the picture jumps
  off: at(179.2), // collapses to a line, a dot
  vanish: at(179.65), // dark
  gone: at(180.25), // the stage black
  light0: at(182.14), // "when": the big screen comes up on the dark stage
  line: at(182.8), // "see": a follow spot strikes the empty stage left
  open: at(183.74), // "again": Steve Jobs walks on from the wing into it
  walk0: at(184.8), // "We've come a long way": "iPhone Duo" on the screen
  walk1: at(192.4), // on his mark before Tim (he walks on all through Tim's close-up)
  chin: at(194.5), // in his close-up: hand to the chin, as in the portrait
  remember: at(196.46), // "When I see you again": Tim, nine to go!
  fold9: at(SONG.drop) - 1.5 * BEAT, // the last nine, an eighth note each
  done: at(SONG.drop) + 3 * BEAT, // 500, as the full band comes in
  shut: at(SONG.drop) + 4.3 * BEAT, // Tim closes the Duo
  timWalk0: at(SONG.drop) + 5 * BEAT, // and walks over to Steve Jobs
  timWalk1: at(SONG.drop) + 8.3 * BEAT,
  give: at(SONG.drop) + 8.3 * BEAT, // holds it out to him
  jobsStep: at(SONG.drop) + 7.8 * BEAT, // Jobs steps in
  take: at(SONG.drop) + 8.8 * BEAT, // and takes it
  release: at(SONG.drop) + 10.5 * BEAT, // Tim lets go, his hands down
  lookDown: at(SONG.drop) + 11.5 * BEAT, // Jobs draws it in and looks at it
  lookUp: at(SONG.drop) + 15 * BEAT, // then up at Tim
  nod: at(SONG.drop) + 16.5 * BEAT, // a slow nod; Tim nods back a beat later
  swell: at(SONG.drop) + 20 * BEAT, // the stage comes up full as we pull away
  black: at(SONG.drop) + 28 * BEAT, // black, on the downbeat at 219.28
  // the last word, on an iPhone 4S in the dark (the last iPhone he saw
  // announced, the day before he died; iMessage came with it)
  wake: at(SONG.drop) + 28 * BEAT + 0.7, // its screen wakes on Messages, to "Steve"
  send: at(SONG.drop) + 28 * BEAT + 1.9, // "Steve, we miss you" goes
  delivered: at(SONG.drop) + 28 * BEAT + 2.7,
  typing: at(SONG.drop) + 28 * BEAT + 3.5, // he is typing…
  reply: at(224.4) + 0.3, // "I'll always be here", as the band stops
  lock: at(224.4) + 3.7, // it locks: the screen goes off
  end: at(224.4) + 5.2, // and holds
};
export const DURATION = Math.round(EV.end * FPS) / FPS;

// folds: 491 by EV.portrait, faster and faster (time passing, 2007 → 2011)
export const FOLDS_BEFORE = 491;
export const FOLDS_TOTAL = 500;

// ── the set ────────────────────────────────────────────────────────────────
// "keynote": the stage of the 2007 iPhone keynote (Moscone West): a dark deck,
// the big purple screen upstage (a toy stands a quarter of its height, as Jobs
// did), blue light on black drapes, the house in the dark. The action is
// blocked on the diagonal, the house off Tim's left shoulder (the stage turned
// yaw about y), so from the house Tim is on the right and Jobs comes on from
// the left, from behind the left leg. Tim stands alone on the dark stage
// watching the big screen: the keynote, D8, the news, the portrait, which then
// dies. In stage space +z is toward the house, +x to its right. "studio": the
// white room the film was first made in.
export const SET = {
  kind: "keynote",
  yaw: -Math.PI / 4,
  deck: { w: 2.2, front: 0.42, back: -0.56, h: 0.1 },
  screen: { w: 0.96, h: 0.54, y: 0.07, z: -0.5 },
  slide: "2007", // its slide under "iPhone Duo": black at the top to a dusky lavender (scripts/scene.py SLIDES)
  legs: { x: 0.6, w: 0.26, z: 0.04 }, // the black legs either side, inner edge x
  wing: { from: [-0.8, -0.05], edge: -0.67 }, // where Jobs waits, and where (seen from the house) he clears the leg at EV.open
  spot: [0.15, 1.9, 2.9], // the follow spot, high at the back of the house
};

// ── layout (m) ──────────────────────────────────────────────────────────────
// Tim faces Jobs's mark (yaw), turned toward the big screen until Jobs walks
// on (watch, rad); we start behind him
export const TIM = { p: [0, 0, 0.25], yaw: Math.PI, watch: -0.42 };
// the fold count: standing on the deck at Tim's feet, by his left foot from the
// house, while he watches the big screen (stage space, scale); over him (p,
// world) for the last nine. At his feet it leans to the camera behind him, so
// it stands high enough that the bottom of the 9 just touches the deck.
export const COUNTER = { p: [0, 0.215, 0.25], feet: { p: [0.085, 0.0156, 0.23], s: 1 }, em: 0.034 };
export const PORTAL = { w: 0.12, h: 0.29 }; // (the studio's door of light)
export const JOBS = { mark: [0, 0, -0.02], yaw: 0 }; // his mark before Tim, facing him (m, rad)

// the opening move: behind Tim, push in until the big screen fills the frame,
// stay on it, then pull back down behind Tim when the portrait comes up (s)
// back: from behind Tim out over the house, as the screen comes up and the spot
// strikes, settling on the house's view as Jobs steps into the light
export const MOVE = { push: [1.8, 4.0], pull: [P + 0.15, P + 2.2], back: [EV.light0 - 0.9, EV.open + 0.6] };

// the iPhone 4S (src/iphone.js), upright in the dark far from the stage, its
// screen to +z (m)
export const PHONE = { at: [100, 0, 0] };
// ── shots: [start, name] in order ──────────────────────────────────────────
export const SHOTS = [
  [0, "main"],
  [MOVE.back[1], "stage"], // no cut: the pull back lands here, on the house's view; Jobs walks to Tim
  [at(190.42), "timCU"], // "Oh, I'll tell you all about it"
  [at(194.16), "jobsCU"], // "when I see you again"
  [EV.remember, "last"], // one move, no cuts: the last nine, the handing over, out to the house under "iPhone Duo"
  [EV.black, "phone"], // the iPhone 4S in the dark
];
export const shotAt = (t) => {
  let i = 0;
  while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
  return { i, start: SHOTS[i][0], end: SHOTS[i + 1]?.[0] ?? DURATION, name: SHOTS[i][1] };
};
