// Every object of the isnail-30 world (geometry, material, parent) and how
// each one is sampled at film time t: engine/scripts/export-anim.mjs declares
// them, samples them twice a frame and writes build/anim.json for Blender.
import { film } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/film.js";
import { trs, qEuler } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/quat.js";
import { MASCOT_PARTS, toyGeo } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/toy.js";
import { PAPER } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/labels.js";
import * as T from "./timeline.js";
import * as A from "./anim.js";
import * as B from "./beats.js"; // film-local: the inserted beats (story.insert)

const MM = A.MM;
export const cuts = B.ON ? B.CUTS : [T.EVS.cut]; // hard cuts: each gets an extra key just before it
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
  const glyphGeo = (key, em, depth, bevel) => ({ type: "curve", rings: A.GLYPHS[key].rings.map((r) => r.map(([x, y]) => [+(x * em).toFixed(6), +(y * em).toFixed(6)])), depth, bevel });
  const SE = A.STAT_EM;
  // film-local: film.json look.counter colours the count (white on the dark look by default)
  const CC = { digit: "#F4F6F8", label: "#AEB4BA", emit: 0.55, labelEmit: 0.35, ...film.look?.counter };
  for (let i = 0; i < A.STAT.slots.length; i++) for (let d = 0; d <= 9; d++) {
    add({ name: `stat_${i}_${d}`, geo: glyphGeo(`latin:${d}`, SE.digit * MM, 0.012, 0.0012), mat: { type: "type", color: CC.digit, emit: CC.emit }, anim: true, step: true });
  }
  add({ name: "stat_wan", geo: glyphGeo(A.STAT_KEYS.unit, SE.wan * MM, 0.012, 0.0012), mat: { type: "type", color: CC.digit, emit: CC.emit }, anim: true });
  const labelNames = A.FOLLOW ? A.STAT_KEYS.label.map((_, j) => `stat_l${j}`) : ["stat_yue", "stat_du"]; // film-local: any length
  labelNames.forEach((name, j) => add({ name, geo: glyphGeo(A.STAT_KEYS.label[j], SE.label * MM, 0.006, 0.0006), mat: { type: "type", color: CC.label, emit: CC.labelEmit }, anim: true }));
  add({ name: "stat_bar", geo: { type: "roundBox", size: [A.STAT.width * MM, 0.005, 0.005], radius: 0.0022 }, mat: { type: "glow", color: T.ACCENT, strength: 3 }, anim: true, step: true });
  // film-local: act 3's count (story.countB): gold digits that are the cover's 380, and the gold stars
  if (A.COUNT_B) {
    const gold = { type: "type", color: "#E8B23A", emit: 0.28 };
    for (let i = 0; i < A.COUNT_B.slots; i++) for (let d = 0; d <= 9; d++) add({ name: `countB_${i}_${d}`, geo: glyphGeo(`latin:${d}`, A.COUNT_B.em, 0.016, 0.0018), mat: gold, anim: true, step: true });
    add({ name: "countB_comma", geo: glyphGeo("latin:,", A.COUNT_B.em, 0.016, 0.0018), mat: gold, anim: true });
  }
  const STAR = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.0052 : 0.013; return [+(r * Math.cos(a)).toFixed(6), +(r * Math.sin(a)).toFixed(6)]; });
  for (let i = 0; i < A.GSTARS; i++) add({ name: `gstar_${i}`, geo: { type: "curve", rings: [STAR], depth: 0.004, bevel: 0.0008 }, mat: { type: "type", color: "#F2C14E", emit: 0.25 }, anim: true });

  B.declare(add, glyphGeo, pack);

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
  add({ name: "crown", geo: { type: "curve", rings: [A.CROWN.map(([x, y]) => [+((x - 0.5) * A.CROWN_W).toFixed(6), +(y * A.CROWN_W).toFixed(6)])], depth: 0.012, bevel: 0.0018 }, mat: { type: "type", color: "#F2C14E", emit: 0.25 }, anim: true });

  // act 2: the pinned cover as a wall, and its pieces
  add({ name: "wall2", geo: null, anim: true });
  add({ name: "wall2_slab", parent: "wall2", geo: { type: "wallSlab", w: A.WALL_W, h: A.WALL2_H, d: 0.01 }, mat: { type: "cover2", w: A.WALL_W, h: A.WALL2_H } });
  for (const p of A.COVER2.pieces) {
    add({ name: `piece2_${p.name}`, parent: "wall2", geo: { type: "curve", rings: p.rings.map((r) => r.map((uv) => A.coverToWall2(uv).map((v) => +v.toFixed(6)))), depth: A.piece2Depth(p), bevel: 0.0007 }, mat: { type: "cover2", w: A.WALL_W, h: A.WALL2_H }, anim: true, _piece2: p });
  }

  // the cover wall and its pieces
  add({ name: "wall", geo: null, anim: true });
  add({ name: "wall_slab", parent: "wall", geo: { type: "wallSlab", w: A.WALL_W, h: A.WALL_H, d: 0.01 }, mat: { type: "cover" } });
  for (const p of A.COVER.pieces) {
    if (!p.rings.length) continue;
    add({ name: `piece_${p.name}`, parent: "wall", geo: { type: "curve", rings: p.rings.map((r) => r.map((uv) => A.coverToWall(uv).map((v) => +v.toFixed(6)))), depth: A.pieceDepth(p) }, mat: { type: "cover", full: true }, anim: true, _piece: p }); // film-local: pieces keep the published cover; only the slab loses what has left it
  }
  // the 2D mascot sticker he turns into (a card on the 《自媒体很苦》 wall)
  add({ name: "sticker2d", parent: "wall", geo: { type: "plane", w: A.STICKER.w, h: A.STICKER.h }, mat: { type: "card2d", image: "assets/sticker2d.png" }, anim: true });


  // particles
  for (let i = 0; i < A.FLAKES; i++) add({ name: `flake_${i}`, geo: i < 2 ? { type: "ellipsoid", r: [0.007, 0.0012, 0.0032] } : { type: "box", size: [0.0042, 0.0006, 0.0042] }, mat: { type: "flake" }, anim: true, colorAnim: true });
  for (let i = 0; i < A.SPARKS; i++) add({ name: `spark_${i}`, geo: { type: "octa", r: 0.0018 }, mat: { type: "spark", strength: 6 }, anim: true, colorAnim: true });
  for (let i = 0; i < A.BITS; i++) add({ name: `bit_${i}`, geo: { type: "box", size: [0.006, 0.0006, 0.0045] }, mat: { type: "flake" }, anim: true, colorAnim: true });
  add({ name: "fx", geo: null, light: true, anim: true });
  add({ name: "camera", geo: null, camera: true, anim: true });
  pieces = objects.filter((o) => o._piece);
  pieces2 = objects.filter((o) => o._piece2);
}

// put(name, transform) every sample; putColor(name, hex) and the scalars on
// whole frames (`whole`); camera scalars on every regular sample
export function sample(t, { put, putColor, regular, whole, scalars, hex }) {
  // film-local: the story runs on its own clock (story.insert); in the gap beats.js has the toy,
  // the camera and the light, and the story stands still where it cut away
  const gap = T.inBeat(t), ft = t;
  t = T.storyTime(t);
  const cam = gap ? B.cameraAt(ft) : A.cameraAt(t);
  put("camera", cam.tr);
  if (regular) {
    scalars.fov.push(cam.fov);
    scalars.focus.push(+cam.focus.toFixed(5));
    scalars.fstop.push(+cam.fstop.toFixed(3));
  }

  for (const name of Object.keys(T.PANELS)) put(`panel_${name}`, A.panelAt(name, t));
  put("panel_retroPost", A.retroAt(t));
  for (let i = 0; i < A.STRIPS; i++) put(`strip_${String(i).padStart(2, "0")}`, A.stripAt(i, t));

  const m = gap ? B.mascot(ft) : null;
  const hero = gap ? m.hero : A.mascotAt(t).hero;
  const parts = gap ? m.parts : A.mascotParts(t);
  put("hero", hero);
  parts.forEach((tr, i) => put(`hero_${MASCOT_PARTS[i].name}`, tr));
  const b = gap ? B.blobAt(ft) : A.blobAt(t);
  put("blob", b.tr);
  B.sample(put, ft, parts, hero);

  A.GLOW_BARS.forEach((_, i) => put(`glow_${i}`, A.glowBarAt(i, t)));
  put("stat_lid", A.lidAt(t));
  for (const [name, tr] of Object.entries(B.statOverride(ft) ?? A.statAt(t))) put(name, tr);
  for (const [name, tr] of Object.entries(A.countBAt_(t))) put(name, tr);
  for (let i = 0; i < A.GSTARS; i++) put(`gstar_${i}`, A.gstarAt(i, t));
  T.PROP.sample(put, t);
  A.LABELS.forEach((L, i) => {
    put(`label${i}_rim`, A.labelRimAt(i, t));
    put(`label${i}_sheet`, A.labelSheetAt(i, t));
    L.letters.forEach((_, j) => put(`label${i}_l${j}`, A.labelLetterAt(i, j, t)));
  });
  put("crown", A.crownAt(t));

  put("wall2", A.wall2At(t));
  for (const o of pieces2) put(o.name, A.piece2At(o._piece2, t));
  put("wall", A.wallAt(t).tr);
  put("sticker2d", A.sticker2dAt(t));
  for (const o of pieces) put(o.name, A.pieceAt(o._piece, t));

  for (let i = 0; i < A.FLAKES; i++) { const f = A.flakeAt(i, t); put(`flake_${i}`, f.tr); putColor(`flake_${i}`, f.color); }
  for (let i = 0; i < A.SPARKS; i++) { const f = A.sparkAt(i, t); put(`spark_${i}`, f.tr); putColor(`spark_${i}`, f.color); }
  for (let i = 0; i < A.BITS; i++) { const f = A.bitAt(i, t); put(`bit_${i}`, f.tr); putColor(`bit_${i}`, f.color); }

  const fx = gap ? B.fxAt(ft) : A.fxAt(t);
  put("fx", trs(fx.p));
  if (whole) {
    scalars.glint.push(+(gap ? B.glintAt(ft) : A.glintAt(t)).toFixed(3));
    scalars.coverMix.push(+A.coverMix(t).toFixed(4));
    scalars.coverFlat.push(+A.coverFlat(t).toFixed(4));
    scalars.blob.push(+b.opacity.toFixed(3));
    scalars.fx_energy.push(+fx.energy.toFixed(4));
    scalars.fx_color.push(hex(fx.color).map((v) => +v.toFixed(3)));
  }
}
