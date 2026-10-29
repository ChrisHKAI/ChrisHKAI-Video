// Every object of the isnail-30 world (geometry, material, parent) and how
// each one is sampled at film time t: engine/scripts/export-anim.mjs declares
// them, samples them twice a frame and writes build/anim.json for Blender.
// Between pieces of the story, a beat (beats.js) has the toy, the camera and
// the light on its own stage while the story stands still.
import { film } from "#engine/film.js";
import { trs, qEuler } from "#engine/quat.js";
import { MASCOT_PARTS, toyGeo } from "#engine/toy.js";
import { PAPER } from "#engine/labels.js";
import { toyFrom } from "#engine/beatkit.js";
import * as T from "./timeline.js";
import * as A from "./anim.js";
import { BEATS, beatAt } from "./beats.js";

const MM = A.MM;
// hard cuts: each gets an extra key just before it (every join between segments, and a beat's own)
export const cuts = T.SEG.cutsWith([T.EV.cut], BEATS.flatMap((B) => (B.b.cuts ?? []).map((g) => B.f0 + g)));
export const scalars = () => ({ fov: [], focus: [], fstop: [], glint: [], coverMix: [], coverFlat: [], blob: [], fx_energy: [], fx_color: [] });
let pieces = [], pieces2 = [];

export function declare({ add, pack, objects }) {
  // ── Static world ──────────────────────────────────────────────────────────
  add({ name: "floor", geo: { type: "plane", w: 14, h: 14 }, mat: { type: "floor" }, tr: pack(trs([0, -1.0, 0.4], qEuler(-Math.PI / 2, 0, 0))) });
  const UI = { image: "assets/ui.png", w: T.UI_W, h: T.UI_H };
  for (const [name, r] of Object.entries(T.PANELS)) {
    add({ name: `panel_${name}`, geo: { type: "uiBox", rect: [r[0] - r[0] - r[2] / 2, r[1] - r[1] - r[3] / 2, r[2], r[3]], uvRect: r, img: UI, thickness: A.SLAB_T }, mat: { type: "ui", image: UI.image }, anim: true });
  }
  const RETRO = { image: "assets/retro.png", w: T.RETRO_RECT[2], h: T.RETRO_RECT[3] };
  add({ name: "panel_retroPost", geo: { type: "uiBox", rect: [-RETRO.w / 2, -RETRO.h / 2, RETRO.w, RETRO.h], uvRect: [0, 0, RETRO.w, RETRO.h], img: RETRO, thickness: A.SLAB_T }, mat: { type: "ui", image: RETRO.image }, anim: true });

  // the profile picture sticker, in strips that peel
  for (let i = 0; i < A.STRIPS; i++) {
    const v0 = i / A.STRIPS, v1 = (i + 1) / A.STRIPS; // from the hinge (bottom of the picture) up
    // lies in x/z, face up; the hinge-side edge (+z) carries the lower v
    add({ name: `strip_${String(i).padStart(2, "0")}`, geo: { type: "plane", w: A.STRIP_W, h: A.STRIP_H * 1.04, uvB: [0, v0, 1, v1], flat: true }, mat: { type: "sticker", image: "assets/avatar.png" }, anim: true });
  }

  // the toy
  add({ name: "hero", geo: null, anim: true });
  for (const p of MASCOT_PARTS) {
    add({ name: `hero_${p.name}`, parent: "hero", geo: toyGeo(p), mat: { type: p.mat === "shine" ? "shine" : "toy", key: p.mat, ...(p.paint?.length ? { paint: p.paint } : {}), ...(p.finish ? { finish: p.finish } : {}) }, anim: true });
  }
  add({ name: "blob", geo: { type: "plane", w: 1, h: 1 }, mat: { type: "blob" }, anim: true });

  // act 2: the selected post's outline (the theme's accent), and the count in 3D lettering
  A.GLOW_BARS.forEach((b, i) => add({ name: `glow_${i}`, geo: { type: "roundBox", size: b.size.map((v) => v * MM), radius: 1.1 * MM }, mat: { type: "glow", color: T.ACCENT, strength: 3 }, anim: true }));
  add({ name: "stat_lid", geo: { type: "roundBox", size: [0.072, 0.0006, 0.024], radius: 0.0002 }, mat: { type: "glass" }, anim: true });
  const glyphGeo = A.glyphGeo;
  const SE = A.STAT_EM;
  if (A.STAT_TEXT) {
    // the count as the platform writes it (6.5万, 7,253, 46K), its label after it
    for (const n of A.STAT_TEXT.names) {
      add(n.label
        ? { name: n.name, geo: glyphGeo(n.key, n.em, 0.006, 0.0006), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true }
        : { name: n.name, geo: glyphGeo(n.key, n.em, 0.012, 0.0012), mat: { type: "type", color: "#F4F6F8", emit: 0.55 }, anim: true, step: true });
    }
  } else {
    for (let i = 0; i < A.STAT.slots.length; i++) for (let d = 0; d <= 9; d++) {
      add({ name: `stat_${i}_${d}`, geo: glyphGeo(`latin:${d}`, SE.digit * MM, 0.012, 0.0012), mat: { type: "type", color: "#F4F6F8", emit: 0.55 }, anim: true, step: true });
    }
    add({ name: "stat_wan", geo: glyphGeo(A.STAT_KEYS.unit, SE.wan * MM, 0.012, 0.0012), mat: { type: "type", color: "#F4F6F8", emit: 0.55 }, anim: true });
    add({ name: "stat_yue", geo: glyphGeo(A.STAT_KEYS.label[0], SE.label * MM, 0.006, 0.0006), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true });
    add({ name: "stat_du", geo: glyphGeo(A.STAT_KEYS.label[1], SE.label * MM, 0.006, 0.0006), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true });
  }
  add({ name: "stat_bar", geo: { type: "roundBox", size: [A.STAT.width * MM, 0.005, 0.005], radius: 0.0022 }, mat: { type: "glow", color: T.ACCENT, strength: 3 }, anim: true, step: true });

  // the call to action
  add({ name: "cta_floor", geo: { type: "plane", w: 10, h: 10 }, mat: { type: "stage" }, tr: pack(trs([T.CTA[0], 0, T.CTA[2]], qEuler(-Math.PI / 2, 0, 0))) });
  T.PROP.declare(add); // the end card's prop (isnail's snail, or the film's own)
  // the sign-off: torn paper labels with raised letters, and the crown
  A.LABELS.forEach((L, i) => {
    const [paper, ink] = PAPER[L.paper];
    add({ name: `label${i}_rim`, geo: { type: "curve", rings: [L.rim], depth: 0.0018, bevel: 0.0003 }, mat: { type: "paper", color: "#F6F1E8" }, anim: true });
    add({ name: `label${i}_sheet`, geo: { type: "curve", rings: [L.sheet], depth: 0.0024, bevel: 0.0003 }, mat: { type: "paper", color: paper }, anim: true });
    L.letters.forEach((g, j) => add({ name: `label${i}_l${j}`, geo: glyphGeo(g.key, L.em, 0.004, 0.0005), mat: { type: "type", color: ink, emit: ink === "#161514" ? 0 : 0.12 }, anim: true }));
  });
  if (T.CROWN) add({ name: "crown", geo: { type: "curve", rings: [A.CROWN.map(([x, y]) => [+((x - 0.5) * A.CROWN_W).toFixed(6), +(y * A.CROWN_W).toFixed(6)])], depth: 0.012, bevel: 0.0018 }, mat: { type: "type", color: "#F2C14E", emit: 0.25 }, anim: true });

  // act 2: the pinned cover as a wall, and its pieces
  add({ name: "wall2", geo: null, anim: true });
  add({ name: "wall2_slab", parent: "wall2", geo: { type: "wallSlab", w: A.WALL_W, h: A.WALL2_H, d: 0.01 }, mat: { type: "cover2", w: A.WALL_W, h: A.WALL2_H } });
  for (const p of A.COVER2.pieces) {
    add({ name: `piece2_${p.name}`, parent: "wall2", geo: { type: "curve", rings: p.rings.map((r) => r.map((uv) => A.coverToWall2(uv).map((v) => +v.toFixed(6)))), depth: A.piece2Depth(p), bevel: 0.0007 }, mat: { type: "cover2", w: A.WALL_W, h: A.WALL2_H }, anim: true, _piece2: p });
  }

  // the cover wall and its pieces
  add({ name: "wall", geo: null, anim: true });
  if (T.PLAYS_ACT3) add({ name: "wall_slab", parent: "wall", geo: { type: "wallSlab", w: A.WALL_W, h: A.WALL_H, d: 0.01 }, mat: { type: "cover" } });
  for (const p of T.PLAYS_ACT3 ? A.COVER.pieces : []) {
    if (!p.rings.length) continue;
    add({ name: `piece_${p.name}`, parent: "wall", geo: { type: "curve", rings: p.rings.map((r) => r.map((uv) => A.coverToWall(uv).map((v) => +v.toFixed(6)))), depth: A.pieceDepth(p) }, mat: { type: "cover" }, anim: true, _piece: p });
  }
  // the 2D mascot sticker he turns into (a card on the 《自媒体很苦》 wall): the sticker exit only
  if (T.EXIT === "sticker") add({ name: "sticker2d", parent: "wall", geo: { type: "plane", w: A.STICKER.w, h: A.STICKER.h }, mat: { type: "card2d", image: "assets/sticker2d.png" }, anim: true });


  // particles
  for (let i = 0; i < A.FLAKES; i++) add({ name: `flake_${i}`, geo: i < 2 ? { type: "ellipsoid", r: [0.007, 0.0012, 0.0032] } : { type: "box", size: [0.0042, 0.0006, 0.0042] }, mat: { type: "flake" }, anim: true, colorAnim: true });
  for (let i = 0; i < A.SPARKS; i++) add({ name: `spark_${i}`, geo: { type: "octa", r: 0.0018 }, mat: { type: "spark", strength: 6 }, anim: true, colorAnim: true });
  for (let i = 0; i < A.BITS; i++) add({ name: `bit_${i}`, geo: { type: "box", size: [0.006, 0.0006, 0.0045] }, mat: { type: "flake" }, anim: true, colorAnim: true });
  // the beats' own objects, each on its stage (names and parents get the beat's prefix)
  for (const B of BEATS) B.b.declare?.((o) => add({ ...o, name: B.prefix + o.name, ...(o.parent ? { parent: B.prefix + o.parent } : {}) }));
  add({ name: "fx", geo: null, light: true, anim: true });
  add({ name: "camera", geo: null, camera: true, anim: true });
  pieces = objects.filter((o) => o._piece);
  pieces2 = objects.filter((o) => o._piece2);
}

// put(name, transform) every sample; putColor(name, hex) and the scalars on
// whole frames (`whole`); camera scalars on every regular sample. During a
// beat its camera, toy and light play (g: the beat's own seconds) and the
// story stands still at t.
export function sample(ft, { put, putColor, regular, whole, scalars, hex }) {
  const B = beatAt(ft), g = B ? ft - B.f0 : 0;
  const t = T.SEG.storyTime(ft);
  const cam = B ? B.b.camera(g) : A.cameraAt(t);
  put("camera", cam.tr);
  if (regular) {
    scalars.fov.push(cam.fov);
    scalars.focus.push(+cam.focus.toFixed(5));
    scalars.fstop.push(+cam.fstop.toFixed(3));
  }

  for (const name of Object.keys(T.PANELS)) put(`panel_${name}`, A.panelAt(name, t));
  put("panel_retroPost", A.retroAt(t));
  for (let i = 0; i < A.STRIPS; i++) put(`strip_${String(i).padStart(2, "0")}`, A.stripAt(i, t));

  const m = B ? toyFrom(B.b.pose?.(g) ?? null, B.stage) : null; // the toy on the beat's stage
  const { hero } = m ?? A.mascotAt(t);
  put("hero", hero);
  (m ? m.parts : A.mascotParts(t)).forEach((tr, i) => put(`hero_${MASCOT_PARTS[i].name}`, tr));
  const b = m ? m.blob : A.blobAt(t);
  put("blob", b.tr);

  A.GLOW_BARS.forEach((_, i) => put(`glow_${i}`, A.glowBarAt(i, t)));
  put("stat_lid", A.lidAt(t));
  for (const [name, tr] of Object.entries(A.statAt(t))) put(name, tr);
  T.PROP.sample(put, t);
  A.LABELS.forEach((L, i) => {
    put(`label${i}_rim`, A.labelRimAt(i, t));
    put(`label${i}_sheet`, A.labelSheetAt(i, t));
    L.letters.forEach((_, j) => put(`label${i}_l${j}`, A.labelLetterAt(i, j, t)));
  });
  if (T.CROWN) put("crown", A.crownAt(t));

  put("wall2", A.wall2At(t));
  for (const o of pieces2) put(o.name, A.piece2At(o._piece2, t));
  put("wall", A.wallAt(t).tr);
  if (T.EXIT === "sticker") put("sticker2d", A.sticker2dAt(t));
  for (const o of pieces) put(o.name, A.pieceAt(o._piece, t));

  for (let i = 0; i < A.FLAKES; i++) { const f = A.flakeAt(i, t); put(`flake_${i}`, f.tr); putColor(`flake_${i}`, f.color); }
  for (let i = 0; i < A.SPARKS; i++) { const f = A.sparkAt(i, t); put(`spark_${i}`, f.tr); putColor(`spark_${i}`, f.color); }
  for (let i = 0; i < A.BITS; i++) { const f = A.bitAt(i, t); put(`bit_${i}`, f.tr); putColor(`bit_${i}`, f.color); }

  for (const Bk of BEATS) Bk.b.sample?.((name, tr) => put(Bk.prefix + name, tr), ft - Bk.f0, (name, color) => putColor(Bk.prefix + name, color));

  const fx = B ? (B.b.light?.(g) ?? { p: [B.stage[0], 0.15, 0.15], energy: 0.3, color: "#FFF1E6" }) : A.fxAt(t);
  put("fx", trs(fx.p));
  if (whole) {
    scalars.glint.push(+(m ? m.glint : A.glintAt(t)).toFixed(3));
    scalars.coverMix.push(+A.coverMix(t).toFixed(4));
    scalars.coverFlat.push(+A.coverFlat(t).toFixed(4));
    scalars.blob.push(+b.opacity.toFixed(3));
    scalars.fx_energy.push(+fx.energy.toFixed(4));
    scalars.fx_color.push(hex(fx.color).map((v) => +v.toFixed(3)));
  }
}

// build/reads.json: what the viewer reads, in film time (engine/lib/pacing.py
// checks each stays long enough): the story's lines where its pieces play them
// (the longest stretch one piece plays), the beats' on their own clocks
export function reads() {
  const r4 = (v) => +v.toFixed(4);
  const story = T.reads();
  if (!T.SEG.on) return story.map((r) => ({ ...r, at: r.at.map(r4) }));
  const out = [];
  for (const r of story) {
    let best = null;
    for (const s of T.SEG.list.filter((x) => x.kind === "story")) {
      const a = Math.max(r.at[0], s.s0), b = Math.min(r.at[1], s.s1);
      if (b - a > 1e-6 && (!best || b - a > best[1] - best[0])) best = [a - s.s0 + s.f0, b - s.s0 + s.f0];
    }
    if (best) out.push({ ...r, at: best.map(r4) });
  }
  for (const B of BEATS) for (const r of B.b.reads ?? []) out.push({ ...r, at: r.at.map((g) => r4(B.f0 + g)) });
  return out.sort((a, b) => a.at[0] - b.at[0]);
}

// build/timeline.json: the film's clock for the score, the storyboard and the
// last look. With segments, the story's events and cues where the film plays
// them, the beats' cues in film time, the story's own clock (STORY) for the
// score, and each segment with its beat's music and storyboard
export function timeline() {
  const base = { FPS: T.FPS, DURATION: T.DURATION, BPM: T.BPM, BEAT: T.BEAT, BAR: T.BAR };
  if (!T.SEG.on) return { ...base, EV: T.EV, cues: T.soundCues() };
  const cues = T.SEG.cues(T.soundCues());
  for (const B of BEATS) B.b.cues?.((g, kind, extra = {}) => cues.push({ t: +(B.f0 + g).toFixed(4), kind, ...extra }));
  cues.sort((a, b) => a.t - b.t);
  const r4 = (v) => +v.toFixed(4);
  const SEGMENTS = T.SEG.list.map((s) => {
    if (s.kind === "story") return { kind: "story", f0: r4(s.f0), f1: r4(s.f1), s0: s.s0, s1: s.s1 };
    const B = BEATS.find((x) => x.i === s.i);
    return { kind: "beat", beat: s.entry.beat, f0: r4(s.f0), f1: r4(s.f1), music: B.b.music ?? {}, storyboard: B.b.storyboard ?? {} };
  });
  return { ...base, EV: T.SEG.events(T.EV), cues, STORY: { DURATION: T.STORY_DURATION, EV: T.EV }, SEGMENTS };
}
