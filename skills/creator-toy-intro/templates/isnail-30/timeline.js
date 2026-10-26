// The isnail-30 story's numbers, read from the film workspace: the platform
// page's layout comes from the theme, the creator's content and the story's
// tuned events, places and camera keys from film.json. Three readers use
// them: the UI builder, the motion (anim.js → Blender) and the score (through
// build/timeline.json). Every time is film seconds; at 120 BPM a beat is
// 0.5 s and a bar 2 s, and every big hit sits on a downbeat.
import { pathToFileURL } from "node:url";
import { film, fromSkill } from "../../engine/lib/film.js";
import { places } from "./places.js";

const L = await import(pathToFileURL(fromSkill("themes", film.theme, "layout.js")).href);
const S = film.story;
const [FW, FH] = film.format.size;
export const PORTRAIT = FH > FW;
const D = places(L, PORTRAIT); // defaults from the theme's anchors; film.json "story" pins its own

export const FPS = film.format.fps;
export const BPM = film.format.bpm;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = film.format.duration;
export const bar = (n, beat = 0) => +(n * BAR + beat * BEAT).toFixed(4);

// ── The page (theme contract: themes/<theme>/layout.js) ─────────────────────
export const { UI_W, UI_H, UI_SCALE, PANELS, AVATAR, ACCENT } = L;

// ── The two posts: the pinned one (act 2) and the one that rises (act 3) ───
export const PINNED = film.posts.pinned;
export const RETRO = film.posts.retro;
// the count lifts out of the spot where the pinned post shows it, as 3D lettering
export const VIEWS = L.ANCHORS.count;
export const VIEWS_COUNT = film.counter.value;
// the pinned post's cover: it stands up as a wall in act 2 (hinge = bottom edge)
export const PINNED_COVER = L.ANCHORS.pinnedCover;
// the second post rises below the pinned one in act 3 (assets/retro.png)
export const RETRO_RECT = L.ANCHORS.second;
// its cover: the wall's hinge is the cover's bottom edge
export const RETRO_COVER = L.ANCHORS.secondCover;

// ── Story (film.json "story") ───────────────────────────────────────────────
export const EV = S.events;
export const SLOGAN = film.cta.slogan.map((p) => p.text).join("");
export const SLOGAN_RED = film.cta.slogan[0].text.length; // the second label's letters are red
export const CTA = S.stage; // the CTA stage: far beyond every other shot's clip distance
export const SPOT = S.spots ?? D.spots; // places in UI px
export const WALL2 = S.wall2; // act 2 cover pieces: [push-out time, depth mm]
export const WALL = S.wall; // act 3 wall pieces (wall mm; box tops are where he can stand)
export const COVER_MM = S.coverMM; // the act 3 wall's width once it stands up
// camera keys: target = [UI x, UI y, height mm] or a tracker name; dist m,
// elev / az deg (az 0 = from the south edge); after the cut, CAMERA2 targets
// are metres from the CTA stage
export const CAMERA = S.camera ?? D.camera;
export const CAMERA2 = S.camera2 ?? D.camera2;
export const FOV = S.fov;
export const SHAKES = S.shakes; // 2–3 frame shakes on hits: [t, strength]

// ── Sound cues derived from the same numbers ────────────────────────────────
export function soundCues() {
  const cues = [];
  const add = (t, kind, extra = {}) => cues.push({ t: +t.toFixed(4), kind, ...extra });
  const E = EV;
  add(E.glint, "glint", { soft: true });
  add(E.peel[0], "peel", { dur: E.peel[1] - E.peel[0] + 0.1 });
  add(E.pop, "pop");
  add(E.pop + 0.05, "tinkles", { dur: 1.2 });
  add(E.land, "pomf");
  add(E.lensGlint, "glint");
  E.hops.forEach(([a, b]) => { add(a, "boing"); add(b, "pomf"); });
  add(E.click - 0.32, "boing", { soft: true });
  add(E.click, "click");
  add(E.focus[0] + 0.05, "sink", { dur: 0.9 });
  // act 2: the pinned cover stands, its pieces push out (the title as a rising line)
  add(E.hopOff[0], "boing", { soft: true }); add(E.hopOff[1], "pomf", { soft: true });
  add(E.stand2[0], "stand", { dur: E.stand2[1] - E.stand2[0] });
  const LINE = ["G4", "A4", "B4", "D5", "E5", "G5"];
  Object.entries(WALL2).forEach(([name, [at]]) => {
    const i = ["t0", "t1", "t2", "t3", "t4", "cong"].indexOf(name);
    if (i >= 0) add(at, "push", { note: LINE[i] });
    else if (name === "zero" || name === "one") add(at, "tower", { big: name === "one" });
    else if (name !== "board_ink") add(at, "push", { soft: true });
  });
  add(E.walk[0], "boing", { soft: true }); add(7.2, "pomf", { soft: true });
  add(7.2, "boing", { soft: true }); add(E.walk[1], "pomf", { soft: true });
  add(E.point, "ding", { note: "B5" });
  add(E.count[0] + 0.12, "ticker", { dur: E.count[1] - E.count[0] - 0.12 });
  add(E.lock, "lock");
  add(E.lock + 0.02, "sparkle");
  add(10.15, "boing"); add(10.55, "pomf");
  add(E.retroIn[0], "whooshUp", { dur: E.retroIn[1] - E.retroIn[0] });
  add(E.leap[0], "boing", { long: true });
  add(E.leap[0] + 0.1, "whoosh", { dur: 0.6 });
  add(E.sink2[0], "sink", { dur: 0.7 });
  // act 3: the retrospective cover
  add(E.stand[0] + 0.05, "pomf");
  add(E.stand[0], "stand", { dur: E.stand[1] - E.stand[0] });
  add(12.35, "slide", { dur: 0.3 });
  add(12.7, "boing", { soft: true }); add(12.95, "pomf", { soft: true });
  add(12.72, "whoosh", { dur: 0.28 });
  add(E.slam, "slam");
  add(E.slam + 0.03, "debris", { dur: 1.1 });
  for (let i = 0; i < 9; i++) add(E.rise9[0] + i * 0.175 + 0.07, "wood", { i });
  add(E.climb9[0], "boing"); add(E.climb9[1], "pomf");
  add(E.rise46[0], "slide", { dur: E.rise46[1] - E.rise46[0], long: true });
  add(E.climb46[0], "boing"); add(E.climb46[1], "pomf");
  add(E.point7, "ding", { note: "D6" });
  add(E.rise7[0], "whooshUp", { dur: E.rise7[1] - E.rise7[0], fast: true });
  add(E.rise7[1], "slam", { soft: true });
  add(E.arrow[0], "boing", { long: true });
  add(E.peak, "lock", { big: true });
  add(E.peak + 0.02, "coins", { dur: 0.9 });
  add(E.tagGlint, "glint");
  add(E.toSticker[0], "boing", { soft: true }); add(E.toSticker[1], "pomf", { soft: true });
  add(E.flat[0], "pop", { soft: true });
  add(E.flat[0] + 0.05, "suck", { dur: E.flatLand - E.flat[0] - 0.05 });
  add(E.flatLand, "slap", { i: 0 });
  add(E.flatLand + 0.05, "glint", { soft: true });
  add(E.peel2[0], "peel", { dur: E.peel2[1] - E.peel2[0] });
  // the call to action
  add(E.repop, "pop");
  add(E.repop + 0.06, "whoosh", { dur: E.cut - E.repop });
  add(E.logo[0], "whooshDown", { dur: E.logo[1] - E.logo[0] });
  add(E.logo[1], "land");
  add(E.snail[0], "squelch", { dur: E.snail[1] - E.snail[0] + 0.1 });
  add(E.eyes[0], "boing", { soft: true }); add(E.eyes[0] + 0.1, "boing", { soft: true });
  add(E.ride, "pomf");
  add(E.glint2, "glint");
  add(E.glide[0], "glide", { dur: E.glide[1] - E.glide[0] });
  const TUNE = ["G5", "A5", "B5", "D6", "E6", "G6", "A6", "B6"];
  [...SLOGAN].forEach((_, i) => add(EV.letters + i * BEAT / 2, "letter", { note: TUNE[i], red: i >= SLOGAN_RED }));
  add(E.final, "lock", { big: true });
  add(E.final + 0.02, "sparkle");
  add(E.final + 0.15, "glint");
  // the torn-paper labels slap on; the name's letters pop; the crown lands
  const starts = film.cta.slogan.map((_, k) => film.cta.slogan.slice(0, k).reduce((n, p) => n + [...p.text].length, 0));
  [...starts.map((start) => EV.letters + start * BEAT / 2 - 0.06), E.name, E.name + 0.18].forEach((at, i) => add(at, "slap", { i }));
  const nameLen = [...film.cta.name.text].length;
  for (let i = 0; i < nameLen; i++) add(E.name + 0.05 + 0.05 * i, "namePop", { i });
  add(E.name + 0.22, "namePop", { i: nameLen, handle: true });
  add(E.crown[1], "crown");
  add(E.crown[1] + 0.05, "sparkle");
  return cues.sort((a, b) => a.t - b.t);
}
