// The isnail-30 story's numbers, read from the film workspace: the platform
// page's layout comes from the theme, the creator's content and the story's
// tuned events, places and camera keys from film.json. Three readers use
// them: the UI builder, the motion (anim.js → Blender) and the score (through
// build/timeline.json). Every time here is the story's own seconds (the
// film's, unless film.json "story.segments" cuts it into pieces between beats:
// engine/lib/segments.js); at 120 BPM a beat is 0.5 s and a bar 2 s, and every
// big hit sits on a downbeat.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { film, fromFilm, fromSkill, readFilmJSON } from "#engine/film.js";
import { lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3 } from "#engine/math.js";
import { trs, qId, qEuler, apply, mulT } from "#engine/quat.js";
import { makeSegments } from "#engine/segments.js";
import { places } from "./places.js";

const L = await import(pathToFileURL(fromSkill("themes", film.theme, "layout.js")).href);
// the story's own tuned values (story.json), under whatever film.json "story" pins:
// a table (events) merges key by key, anything else (a list, a number) replaces
const STORY = JSON.parse(readFileSync(new URL("./story.json", import.meta.url), "utf8"));
const isTable = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const S = { ...STORY, ...film.story };
for (const [k, v] of Object.entries(film.story ?? {})) if (isTable(STORY[k]) && isTable(v)) S[k] = { ...STORY[k], ...v };
const [FW, FH] = film.format.size;
export const PORTRAIT = FH > FW;
export const ASPECT = FW / FH;
// the box clear of every platform's own controls (engine/lib/platforms.json)
const SAFE = JSON.parse(readFileSync(fromSkill("engine/lib/platforms.json"), "utf8")).safe[PORTRAIT ? "portrait" : "landscape"];
// the cover walls once they stand up (m): their width is the story's, their height the cover's
const coverAspect = (f, w, h) => { const c = readFilmJSON(f, null); return c ? c.h / c.w : h / w; };
const WALL_W_M = S.coverMM / 1000;
const D = places(L, { portrait: PORTRAIT, aspect: ASPECT, safe: SAFE }, { w: WALL_W_M, h2: WALL_W_M * coverAspect("build/cover2.json", 1983, 793), h3: WALL_W_M * coverAspect("build/cover.json", 1028, 411) });
// the end card's layout: film.json "cta" pins positions, else the defaults for the orientation
export const CTA_LAYOUT = D.cta;

export const FPS = film.format.fps;
export const BPM = film.format.bpm;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const bar = (n, beat = 0) => +(n * BAR + beat * BEAT).toFixed(4);
// the film: the story whole, or pieces of it between beats (film.json "story.segments");
// the story's own length is story.json "duration" when it is cut up, the film's otherwise
export const STORY_DURATION = S.segments?.length ? S.duration : film.format.duration;
export const SEG = makeSegments({ list: S.segments, storyDuration: STORY_DURATION, bar: BAR, pieces: S.pieces });
export const DURATION = SEG.on ? SEG.duration : film.format.duration;
// act 3 (the second cover as a wall the toy climbs) is optional: a film whose segments never play it
// needs no cover cut for it and no roles (film.json story.wall)
const ACT3 = S.pieces.act3;
export const PLAYS_ACT3 = !SEG.on || SEG.list.some((s) => s.kind === "story" && s.s0 < ACT3[1] - 1e-6 && s.s1 > ACT3[0] + 1e-6);

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
// an end card played from the downbeat before its cut (when what comes before it adds up to whole bars,
// apply-research writes { "story": [24, "end"] }) cuts to its stage on that downbeat, so its hits stay on
// the film's downbeats and nothing of the story before the cut shows
const END_FROM = SEG.list.find((s) => s.kind === "story" && s.s0 < S.events.cut - 1e-6 && s.s0 > S.events.cut - BAR && s.s1 > S.events.cut)?.s0;
export const EV = END_FROM !== undefined ? { ...S.events, cut: END_FROM } : S.events;
export const SLOGAN = film.cta.slogan.map((p) => p.text).join("");
// the slogan's letters land a half beat apart; a long one closes up (16th notes, say) so its last letter is
// down before the final lock, and the line holds to the end
export const LETTER_STEP = Math.min(BEAT / 2, (EV.final - EV.letters - BEAT / 2) / Math.max(1, [...SLOGAN].length - 1));
export const SLOGAN_RED = film.cta.slogan[0].text.length; // the second label's letters are red
export const CTA = S.stage; // the CTA stage: far beyond every other shot's clip distance
export const SPOT = S.spots ?? D.spots; // places in UI px
export const WALL2 = S.wall2 ?? {}; // act 2 cover pieces: [push-out time, depth mm]; none when the film leaves act 2 out
export const WALL = S.wall ?? (PLAYS_ACT3 ? noWall() : null); // act 3 wall pieces (wall mm; box tops are where he can stand)
function noWall() {
  throw new Error('the film plays act 3 (the second cover as a wall), but film.json story.wall names none of its pieces: cut the cover and name the roles (references/cover-wall.md), or leave act 3 out of story.segments');
}
// how the toy leaves the act 3 wall: "sticker" (it becomes the drawing of itself
// on that cover: film.json "sticker2d" says where) or "jump" (out of the top of
// the frame; it falls onto the end card's prop after the cut)
export const EXIT = S.exit ?? (film.sticker2d && PLAYS_ACT3 ? "sticker" : "jump");
// the crown lands on the end card's name only when the creator's own name carries one (蜗牛King's 👑)
export const CROWN = (film.profile.nameEmoji ?? "").includes("👑");
// the end card's prop: the film's own module (film.json cta.prop.module, written
// for this creator) or a built-in one by kind (props/<kind>.js; isnail's snail)
const PROP_URL = film.cta.prop?.module ? pathToFileURL(fromFilm(film.cta.prop.module)).href : new URL(`./props/${film.cta.prop?.kind ?? "snail"}.js`, import.meta.url).href;
export const PROP = (await import(PROP_URL)).makeProp({
  film, E: EV, cta: (x, y, z) => [CTA[0] + x, CTA[1] + y, CTA[2] + z], path: CTA_LAYOUT.path, readFilmJSON,
  lib: { lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3, trs, qId, qEuler, apply, mulT, HIDDEN: 1e-4 },
});
export const COVER_MM = S.coverMM; // the act 3 wall's width once it stands up
// camera keys: target = [UI x, UI y, height mm] or a tracker name; dist m,
// elev / az deg (az 0 = from the south edge); after the cut, CAMERA2 targets
// are metres from the CTA stage
export const CAMERA = S.camera ?? D.camera;
export const CAMERA2 = S.camera2 ?? D.camera2;
export const FOV = S.fov;
export const SHAKES = S.shakes; // 2–3 frame shakes on hits: [t, strength]

// ── What the viewer reads, and when (story time) ────────────────────────────
// engine/lib/pacing.py checks each stays long enough to read (build/reads.json).
// The covers' own words are pictures, seen rather than read: not listed
export function reads() {
  const E = EV, END = STORY_DURATION;
  return [
    { text: film.profile.name, at: [0, E.hops[0][0]] }, // the page, before he hops onto it
    { text: `${film.counter.display ?? `${VIEWS_COUNT}${film.counter.unit}`} ${film.counter.label}`, at: [E.count[0], E.leap[0]] },
    { text: SLOGAN, at: [E.letters, END] },
    { text: `${film.cta.name.text} ${film.cta.handle.text}`, at: [E.name, END] },
  ];
}

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
  if (WALL) for (let i = 0; i < (WALL.box9.clunks ?? 9); i++) add(E.rise9[0] + i * 0.175 + 0.07, "wood", { i });
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
  if (EXIT === "sticker") {
    add(E.toSticker[0], "boing", { soft: true }); add(E.toSticker[1], "pomf", { soft: true });
    add(E.flat[0], "pop", { soft: true });
    add(E.flat[0] + 0.05, "suck", { dur: E.flatLand - E.flat[0] - 0.05 });
    add(E.flatLand, "slap", { i: 0 });
    add(E.flatLand + 0.05, "glint", { soft: true });
    add(E.peel2[0], "peel", { dur: E.peel2[1] - E.peel2[0] });
  } else {
    add(E.toSticker[0] + 0.2, "boing", { long: true });
    add(E.toSticker[0] + 0.25, "whooshUp", { dur: 0.5 });
  }
  // the call to action
  if (EXIT === "sticker") {
    add(E.repop, "pop");
    add(E.repop + 0.06, "whoosh", { dur: E.cut - E.repop });
  } else add(E.cut + 0.1, "whooshDown", { dur: 0.6 });
  PROP.cues(add);
  add(E.ride, "pomf");
  add(E.glint2, "glint");
  const TUNE = ["G5", "A5", "B5", "D6", "E6", "G6", "A6", "B6"];
  // a letter a note up the scale; a slogan longer than the scale spreads it over every letter, still rising
  const n = [...SLOGAN].length;
  const note = (i) => TUNE[n <= TUNE.length ? i : Math.round((i * (TUNE.length - 1)) / (n - 1))];
  [...SLOGAN].forEach((_, i) => add(EV.letters + i * LETTER_STEP, "letter", { note: note(i), red: i >= SLOGAN_RED }));
  add(E.final, "lock", { big: true });
  add(E.final + 0.02, "sparkle");
  add(E.final + 0.15, "glint");
  // the torn-paper labels slap on; the name's letters pop; the crown lands
  const starts = film.cta.slogan.map((_, k) => film.cta.slogan.slice(0, k).reduce((n, p) => n + [...p.text].length, 0));
  [...starts.map((start) => EV.letters + start * LETTER_STEP - 0.06), E.name, E.name + 0.18].forEach((at, i) => add(at, "slap", { i }));
  const nameLen = [...film.cta.name.text].length;
  for (let i = 0; i < nameLen; i++) add(E.name + 0.05 + 0.05 * i, "namePop", { i });
  add(E.name + 0.22, "namePop", { i: nameLen, handle: true });
  if (CROWN) {
    add(E.crown[1], "crown");
    add(E.crown[1] + 0.05, "sparkle");
  }
  return cues.sort((a, b) => a.t - b.t);
}
