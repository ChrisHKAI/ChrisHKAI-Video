// The isnail-30 story's numbers, read from the film workspace: the platform
// page's layout comes from the theme, the creator's content and the story's
// tuned events, places and camera keys from film.json. Three readers use
// them: the UI builder, the motion (anim.js → Blender) and the score (through
// build/timeline.json). Every time is film seconds; at 120 BPM a beat is
// 0.5 s and a bar 2 s, and every big hit sits on a downbeat.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { film, fromFilm, fromSkill, readFilmJSON } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/film.js";
import { lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3 } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/math.js";
import { trs, qId, qEuler, apply, mulT } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/quat.js";
import { places } from "./places.js";

const L = await import(pathToFileURL(fromSkill("themes", film.theme, "layout.js")).href);
// the story's own tuned values (story.json), under whatever film.json "story" pins
const STORY = JSON.parse(readFileSync(new URL("./story.json", import.meta.url), "utf8"));
// film-local: events merge key by key (film.json pins only the beats it moves)
const S = { ...STORY, ...film.story, events: { ...STORY.events, ...film.story?.events } };
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
export const EVS = S.events; // story time: what anim.js choreographs
// film-local (cgnot996-intro): the film is a list of segments (film.json story.segments), each a
// piece of the story ({ story: [from, to] }, story seconds) or a beat of beats.js ({ beat, len }).
// The story keeps its own clock; a story segment plays at its place in the film, a beat plays
// while the story stands still (far away, out of every beat's shot). Story segments sit a whole
// number of bars from where the story had them, so every hit stays on a downbeat. Beats: O the
// opening (Kin's flat page, mirrored), W the follower count (a flip calendar, 7/10 → 10/24),
// G the inserted beats D/E/C (GB: seconds into G).
const SEGS = (() => {
  let f = 0;
  return (S.segments ?? [{ story: [0, Infinity] }]).map((g) => {
    const len = g.story ? g.story[1] - g.story[0] : g.len;
    const out = { ...g, f0: f, f1: f + len };
    f += len;
    return out;
  });
})();
export const SEGMENTS = SEGS;
const segAt = (t) => SEGS.find((g) => t < g.f1) ?? SEGS[SEGS.length - 1];
const nextStory = (g) => SEGS.slice(SEGS.indexOf(g)).find((x) => x.story) ?? [...SEGS].reverse().find((x) => x.story);
export const beatAt = (t) => { const g = segAt(t); return g.beat ? { name: g.beat, f0: g.f0, g: t - g.f0 } : null; };
export const inBeat = (t) => !!segAt(t).beat;
export const storyTime = (t) => {
  const g = segAt(t);
  if (g.story) return g.story[0] + Math.min(t - g.f0, g.f1 - g.f0);
  const prev = [...SEGS.slice(0, SEGS.indexOf(g))].reverse().find((x) => x.story);
  return prev ? prev.story[1] - 1e-4 : nextStory(g).story[0] - 1e-4;
};
const segOf = (name) => SEGS.find((g) => g.beat === name);
export const INSERT = segOf("G") ?? null;
export const T_INS = INSERT ? INSERT.f0 : Infinity; // the gap's start, film time
export const GAP = INSERT ? INSERT.len : 0;
export const inGap = (t) => t >= T_INS && t < T_INS + GAP;
// story → film: inside a story segment, its place in the film; outside every one, the nearest edge
function toFilm(v) {
  const g = SEGS.find((x) => x.story && v >= x.story[0] - 1e-6 && v < x.story[1]);
  if (g) return +(v - g.story[0] + g.f0).toFixed(4);
  const after = SEGS.find((x) => x.story && x.story[0] > v);
  return after ? +after.f0.toFixed(4) : +SEGS[SEGS.length - 1].f1.toFixed(4);
}
// the beats' own moments (seconds into each beat)
export const OB = { turn: [0.45, 1.85], split: [0.55, 1.6], bulge: [1.55, 2.0], pop: 2.0, land: 2.55, sig: [2.85, 3.75], leap: [4.0, 4.5] };
export const WB = { drop: [0.05, 0.5], cal: [0.5, 1.1], label: 1.5, flip: [1.5, 5.25], lock: 5.5, cheer: [5.65, 6.25], leap: [7.3, 7.8] };
export const GB = {
  dLand: 0.6, envFly: [1.0, 1.617], flap: [1.9, 2.25], card: [2.35, 2.9], cardZoom: [2.95, 3.35, 4.75, 5.1] /* the invitation up at the camera too (the user: "呢個都同ben 一樣") */, seal: [5.3, 5.617], cheer: [5.75, 6.35],
  // 官方认证大使 held a second longer before Ben's post (the user: "官方認証大使果幕要留長多少少，太快")
  ben: [7.3, 7.6],
  // Ben's post flies up to three quarters of the frame, holds, goes back (the user: "放大到佔畫面3／4 show 下先，再縮返去"),
  // held a second longer too: D two bars longer in all, so E (and C) start 4 s later and the kick still lands on a downbeat
  benZoom: [7.55, 7.95, 10.6, 10.95], dLeap: [11.15, 11.617],
  eIn: 11.617, eLand: 12.15, letters: 11.75, kick: 13.617, close: [13.75, 14.117] /* the lock on the double groove's clap (film 34.5 s), not a flam before it */, sig: [14.25, 14.9], eLeap: [15.53, 16.0],
  // C (Grok Bot 新手指南's stones) is out (the user: "睇唔出有咩意思，可以刪除佢"): it starts where G ends
  cIn: 16.0, cLand: 16.43, stones: 16.06, title: 16.13, hops: [[16.58, 16.93], [17.0, 17.35], [17.42, 17.77]], cLeap: [17.88, 18.38],
};
// film-time events for build/timeline.json (the score, the storyboard): the story's where it
// plays, and the beats' own (the opening's pop and the calendar's count land where the story's did)
const shiftEv = (v) => (Array.isArray(v) ? v.map(shiftEv) : toFilm(v));
const at = (b, g) => +(b.f0 + g).toFixed(4);
const O_ = segOf("O"), W_ = segOf("W");
export const EV = S.segments ? {
  ...Object.fromEntries(Object.entries(EVS).map(([k, v]) => [k, shiftEv(v)])),
  ...(O_ ? { pop: at(O_, OB.pop), land: at(O_, OB.land), push: [at(O_, OB.sig[0]), at(O_, OB.sig[1])], turn: [at(O_, OB.turn[0]), at(O_, OB.turn[1])], oLeap: at(O_, OB.leap[0]) } : {}),
  ...(W_ ? { wIn: at(W_, 0), count: [at(W_, WB.flip[0]), at(W_, WB.flip[1])], lock: at(W_, WB.lock), wLeap: at(W_, WB.leap[0]), a3: +W_.f1.toFixed(4) } : {}),
  ...(INSERT ? { dIn: T_INS, envelope: at(INSERT, GB.envFly[1]), seal: at(INSERT, GB.seal[1]), ben: at(INSERT, GB.ben[0]), eIn: at(INSERT, GB.eIn), kick: at(INSERT, GB.kick), close: at(INSERT, GB.close[1]), ...(GB.cIn < GAP ? { cIn: at(INSERT, GB.cIn) } : {}), gapEnd: +INSERT.f1.toFixed(4) } : {}),
} : EVS;
export const SLOGAN = film.cta.slogan.map((p) => p.text).join("");
export const SLOGAN_RED = film.cta.slogan[0].text.length; // the second label's letters are red
// film-local: when each slogan letter lands: CJK on 8th notes, Latin on 16ths
export const LETTER_T = (() => { let t = S.events.letters; return [...SLOGAN].map((c) => { const at = +t.toFixed(4); t += /[\x00-\x7f]/.test(c) ? 0.125 : 0.25; return at; }); })();
export const CTA = S.stage; // the CTA stage: far beyond every other shot's clip distance
export const SPOT = S.spots ?? D.spots; // places in UI px
export const WALL2 = S.wall2; // act 2 cover pieces: [push-out time, depth mm]
export const WALL = S.wall; // act 3 wall pieces (wall mm; box tops are where he can stand)
// how the toy leaves the act 3 wall: "sticker" (it becomes the drawing of itself
// on that cover: film.json "sticker2d" says where) or "jump" (out of the top of
// the frame; it falls onto the end card's prop after the cut)
export const EXIT = S.exit ?? (film.sticker2d ? "sticker" : "jump");
// the end card's prop: the film's own module (film.json cta.prop.module, written
// for this creator) or a built-in one by kind (props/<kind>.js; isnail's snail)
const PROP_URL = film.cta.prop?.module ? pathToFileURL(fromFilm(film.cta.prop.module)).href : new URL(`./props/${film.cta.prop?.kind ?? "snail"}.js`, import.meta.url).href;
export const PROP = (await import(PROP_URL)).makeProp({
  film, E: EVS, cta: (x, y, z) => [CTA[0] + x, CTA[1] + y, CTA[2] + z], path: CTA_LAYOUT.path, readFilmJSON,
  lib: { lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3, trs, qId, qEuler, apply, mulT, HIDDEN: 1e-4 },
});
export const COVER_MM = S.coverMM; // the act 3 wall's width once it stands up
// camera keys: target = [UI x, UI y, height mm] or a tracker name; dist m,
// elev / az deg (az 0 = from the south edge); after the cut, CAMERA2 targets
// are metres from the CTA stage
// film-local: story.cameraKeys { "<t>": { target, dist, elev, az, fstop } } retunes single keys
export const CAMERA = (S.camera ?? D.camera).map((k) => (S.cameraKeys?.[String(k.t)] ? { ...k, ...S.cameraKeys[String(k.t)] } : k));
export const CAMERA2 = S.camera2 ?? D.camera2;
export const FOV = S.fov;
export const SHAKES = S.shakes; // 2–3 frame shakes on hits: [t, strength]

// ── Sound cues derived from the same numbers ────────────────────────────────
export function soundCues() {
  const cues = [];
  const add = (t, kind, extra = {}) => cues.push({ t: +t.toFixed(4), kind, ...extra });
  const E = EVS;
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
  if (!film.story?.act2Flat) add(E.stand2[0], "stand", { dur: E.stand2[1] - E.stand2[0] }); // film-local: no wall in act 2
  const LINE = ["G4", "A4", "B4", "D5", "E5", "G5"];
  if (!film.story?.act2Flat) Object.entries(WALL2).forEach(([name, [at, , o = {}]]) => {
    const i = ["t0", "t1", "t2", "t3", "t4", "cong"].indexOf(name);
    if (o.note) add(at, "push", { note: o.note }); // film-local: a piece's own note
    else if (o.tower || o.sound === "none") { if (o.tower) add(at, "tower", { big: o.tower === "big" }); }
    else if (i >= 0) add(at, "push", { note: LINE[i] });
    else if (name === "zero" || name === "one") add(at, "tower", { big: name === "one" });
    else if (name !== "board_ink") add(at, "push", { soft: true });
  });
  add(E.walk[0], "boing", { soft: true }); add(7.2, "pomf", { soft: true });
  add(7.2, "boing", { soft: true }); add(E.walk[1], "pomf", { soft: true });
  add(E.point, "ding", { note: "B5" });
  if (film.story?.counter !== false) add(E.count[0] + 0.12, "ticker", { dur: E.count[1] - E.count[0] - 0.12 });
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
  if (WALL.box9.piece !== "none") for (let i = 0; i < (WALL.box9.clunks ?? 9); i++) add(E.rise9[0] + i * 0.175 + 0.07, "wood", { i }); // film-local: a role may be "none"
  add(E.climb9[0], "boing"); add(E.climb9[1], "pomf");
  if (WALL.box46.piece !== "none") add(E.rise46[0], "slide", { dur: E.rise46[1] - E.rise46[0], long: true });
  add(E.climb46[0], "boing"); add(E.climb46[1], "pomf");
  add(E.point7, "ding", { note: "D6" });
  add(E.rise7[0], "whooshUp", { dur: E.rise7[1] - E.rise7[0], fast: true });
  add(E.rise7[1], "slam", { soft: true });
  add(E.arrow[0], "boing", { long: true });
  // film-local: act 3's count (story.countB): 380 turns into the digits, counts, drops back into the cover
  const CB = film.story?.countB;
  if (CB) {
    add(CB.swap, "pop", { soft: true });
    add(CB.count[0], "ticker", { dur: CB.count[1] - CB.count[0] });
    add(CB.back[0], "whoosh", { dur: CB.back[1] - CB.back[0] });
    add(CB.back[1], "slap", { i: 2 });
  }
  // film-local: act 3's other pieces push out, its words pop (story.wallPop)
  Object.entries(film.story?.wallPop ?? {}).forEach(([name, w], i) => (w[2]?.note ? add(w[0], "push", { note: w[2].note }) : add(w[0], w.length > 1 ? "push" : "namePop", w.length > 1 ? { soft: true } : { i })));
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
  const TUNE = ["G5", "A5", "B5", "D6", "E6", "G6", "A6", "B6", "D7", "E7", "G7"]; // film-local: a 10-letter slogan
  [...SLOGAN].forEach((_, i) => add(LETTER_T[i], "letter", { note: TUNE[i % TUNE.length], red: i >= SLOGAN_RED }));
  add(E.final, "lock", { big: true });
  add(E.final + 0.02, "sparkle");
  add(E.final + 0.15, "glint");
  // the torn-paper labels slap on; the name's letters pop; the crown lands
  const starts = film.cta.slogan.map((_, k) => film.cta.slogan.slice(0, k).reduce((n, p) => n + [...p.text].length, 0));
  [...starts.map((start) => LETTER_T[start] - 0.06), E.name, E.name + 0.18].forEach((at, i) => add(at, "slap", { i }));
  const nameLen = [...film.cta.name.text].length;
  for (let i = 0; i < nameLen; i++) add(E.name + 0.05 + 0.05 * i, "namePop", { i });
  add(E.name + 0.22, "namePop", { i: nameLen, handle: true });
  if (film.profile.nameEmoji?.includes("👑")) { add(E.crown[1], "crown"); add(E.crown[1] + 0.05, "sparkle"); }
  if (S.segments) {
    for (let i = cues.length - 1; i >= 0; i--) {
      const c = cues[i], g = SEGS.find((x) => x.story && c.t >= x.story[0] - 0.03 && c.t < x.story[1]);
      if (g) c.t = +(Math.max(c.t, g.story[0]) - g.story[0] + g.f0).toFixed(4); else cues.splice(i, 1);
    }
    gapCues((g, kind, extra) => add(T_INS + g, kind, extra));
    if (O_) openCues((g, kind, extra) => add(O_.f0 + g, kind, extra));
    if (W_) calCues((g, kind, extra) => add(W_.f0 + g, kind, extra));
  }
  return cues.sort((a, b) => a.t - b.t);
}
// the opening's sounds (seconds into O): the page turns and parts, the photo bulges and pops
function openCues(add) {
  const o = OB;
  add(0.6, "glint", { soft: true });
  add(o.turn[0], "whoosh", { dur: o.turn[1] - o.turn[0] });
  add(o.split[0] + 0.2, "slide", { dur: 0.6 });
  add(o.bulge[0], "peel", { dur: o.bulge[1] - o.bulge[0] + 0.05 });
  add(o.pop, "pop"); add(o.pop + 0.05, "tinkles", { dur: 1.2 });
  add(o.land, "pomf");
  add(o.sig[0] + 0.4, "glint");
  add(o.leap[0], "boing", { long: true }); add(o.leap[0] + 0.05, "whooshUp", { dur: 0.45 });
}
// the calendar's (seconds into W): it rises, its pages flip ever faster, 10月24日 locks and is stamped 万粉
function calCues(add) {
  const w = WB;
  add(w.drop[0], "whooshDown", { dur: 0.45 }); add(w.drop[1], "pomf");
  add(w.cal[0], "stand", { dur: w.cal[1] - w.cal[0] });
  add(w.flip[0], "ticker", { dur: w.flip[1] - w.flip[0] });
  add(w.lock, "lock"); add(w.lock + 0.02, "sparkle"); add(w.lock + 0.04, "slam");
  add(w.cheer[0], "boing"); add(w.cheer[1] - 0.05, "pomf", { soft: true });
  add(w.leap[0], "boing", { long: true }); add(w.leap[0] + 0.05, "whooshUp", { dur: 0.45 });
}
// the inserted beats' sounds (seconds into the gap)
function gapCues(add) {
  const g = GB;
  // D: he drops in; the envelope flies in, lands, opens, the card slides up; the seal slaps on; Ben pings
  add(0.05, "whooshDown", { dur: 0.5 }); add(g.dLand, "pomf");
  add(g.envFly[0], "whoosh", { dur: g.envFly[1] - g.envFly[0] }); add(g.envFly[1], "slap", { i: 0 });
  add(g.flap[0], "peel", { dur: g.flap[1] - g.flap[0] }); add(g.card[0], "whooshUp", { dur: g.card[1] - g.card[0] }); add(g.card[1], "ding", { note: "B5" });
  add(g.cardZoom[0], "whooshUp", { dur: g.cardZoom[1] - g.cardZoom[0] }); add(g.cardZoom[2], "whooshDown", { dur: g.cardZoom[3] - g.cardZoom[2] });
  add(g.seal[0], "whoosh", { dur: g.seal[1] - g.seal[0] }); add(g.seal[1], "slam"); add(g.seal[1] + 0.02, "sparkle"); add(g.seal[1] + 0.05, "debris", { dur: 0.6 });
  add(g.cheer[0], "boing"); add(g.cheer[1] - 0.05, "pomf", { soft: true });
  add(g.ben[0], "ding", { note: "E6" }); add(g.ben[0] + 0.12, "ding", { note: "B6" });
  add(g.benZoom[0], "whooshUp", { dur: g.benZoom[1] - g.benZoom[0] }); add(g.benZoom[2], "whooshDown", { dur: g.benZoom[3] - g.benZoom[2] });
  add(g.dLeap[0], "boing", { long: true }); add(g.dLeap[0] + 0.05, "whooshUp", { dur: 0.45 });
  // E: the line rises a letter per 16th; the kick; the line closes up
  add(g.eIn + 0.03, "whooshDown", { dur: 0.5 }); add(g.eLand, "pomf");
  ["G4", "A4", "B4", "D5", "E5", "G5", "A5", "B5", "D6"].forEach((n, i) => add(g.letters + i * 0.125, "push", { note: n }));
  add(g.kick - 0.3, "boing", { soft: true }); add(g.kick, "slam"); add(g.kick + 0.02, "whoosh", { dur: 0.45 });
  add(g.close[0], "slide", { dur: g.close[1] - g.close[0] }); add(g.close[1], "lock"); add(g.close[1] + 0.02, "sparkle");
  add(g.sig[0] + 0.3, "glint");
  add(g.eLeap[0], "boing", { long: true }); add(g.eLeap[0] + 0.05, "whooshUp", { dur: 0.45 });
  // C: the stones pop up, the title slaps, he hops along and leaps out (only if G still holds it)
  if (g.cIn >= GAP) return;
  add(g.cIn + 0.03, "whooshDown", { dur: 0.4 }); add(g.cLand, "pomf");
  [0, 1, 2, 3].forEach((i) => add(g.stones + i * 0.08, "push", { note: ["D5", "E5", "G5", "A5"][i] }));
  add(g.title, "slap", { i: 1 });
  g.hops.forEach(([a, b]) => { add(a, "boing", { soft: true }); add(b, "pomf", { soft: true }); });
  add(g.cLeap[0], "boing", { long: true }); add(g.cLeap[0] + 0.05, "whooshUp", { dur: 0.45 });
}
