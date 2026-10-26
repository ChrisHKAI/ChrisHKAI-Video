// Writes build/anim.json: every object of the world (geometry, material,
// parent) and its transform twice a frame, computed by src/anim.js.
// scripts/scene.py rebuilds the world in Blender from this file alone.
// Transforms are location / quaternion (w last) / scale in Three.js space
// (+y up); Blender parents everything to an empty that turns it z-up.
// A track only keeps the samples where something changes, so Blender's linear
// keys reproduce every sample exactly.
//
// usage: node scripts/export-anim.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";
import * as A from "../src/anim.js";
import { MASCOT_PARTS } from "../src/hero.js";
import { trs, qEuler } from "../src/quat.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUB = 2;
const FRAMES = Math.round(T.DURATION * T.FPS); // 900
const SAMPLES = (FRAMES - 1) * SUB + 1;
const MM = A.MM;

const objects = [];
const add = (o) => { objects.push({ parent: "root", tr: pack(trs([0, 0, 0])), ...o }); return o.name; };
function pack(t) {
  return [...t.p.map((v) => +v.toFixed(6)), ...t.q.map((v) => +v.toFixed(6)), ...t.s.map((v) => +v.toFixed(6))];
}

// ── Static world ────────────────────────────────────────────────────────────
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
  const geo = p.shape === "roundBox" ? { type: "roundBox", size: p.size, radius: p.radius }
    : p.shape === "ellipsoid" ? { type: "ellipsoid", r: p.r }
    : { type: "arc", radius: p.radius, tube: p.tube, arc: p.arc };
  add({ name: `hero_${p.name}`, parent: "hero", geo, mat: { type: p.mat === "shine" ? "shine" : "toy", key: p.mat }, anim: true });
}
add({ name: "blob", geo: { type: "plane", w: 1, h: 1 }, mat: { type: "blob" }, anim: true });

// act 2: the selected post's outline, and 304万 阅读 in 3D lettering
A.GLOW_BARS.forEach((b, i) => add({ name: `glow_${i}`, geo: { type: "roundBox", size: b.size.map((v) => v * MM), radius: 1.1 * MM }, mat: { type: "glow", color: "#1D9BF0", strength: 3 }, anim: true }));
add({ name: "stat_lid", geo: { type: "roundBox", size: [0.072, 0.0006, 0.024], radius: 0.0002 }, mat: { type: "glass" }, anim: true });
const glyphGeo = (key, em, depth, bevel) => ({ type: "curve", rings: A.GLYPHS[key].rings.map((r) => r.map(([x, y]) => [+(x * em).toFixed(6), +(y * em).toFixed(6)])), depth, bevel });
const SE = A.STAT_EM;
for (let i = 0; i < 3; i++) for (let d = 0; d <= 9; d++) {
  add({ name: `stat_${i}_${d}`, geo: glyphGeo(`latin:${d}`, SE.digit * MM, 0.012, 0.0012), mat: { type: "type", color: "#F4F6F8", emit: 0.55 }, anim: true, step: true });
}
add({ name: "stat_wan", geo: glyphGeo("cjk:万", SE.wan * MM, 0.012, 0.0012), mat: { type: "type", color: "#F4F6F8", emit: 0.55 }, anim: true });
add({ name: "stat_yue", geo: glyphGeo("cjk:阅", SE.label * MM, 0.006, 0.0006), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true });
add({ name: "stat_du", geo: glyphGeo("cjk:读", SE.label * MM, 0.006, 0.0006), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true });
add({ name: "stat_bar", geo: { type: "roundBox", size: [A.STAT.width * MM, 0.005, 0.005], radius: 0.0022 }, mat: { type: "glow", color: "#1D9BF0", strength: 3 }, anim: true, step: true });

// the call to action
add({ name: "cta_floor", geo: { type: "plane", w: 10, h: 10 }, mat: { type: "stage" }, tr: pack(trs([T.CTA[0], 0, T.CTA[2]], qEuler(-Math.PI / 2, 0, 0))) });
add({ name: "logo", geo: { type: "curve", rings: A.LOGO.rings.map((r) => r.map(([x, y]) => [+(x * A.SHELL_H).toFixed(6), +(y * A.SHELL_H).toFixed(6)])), depth: A.SHELL_D, bevel: 0.0022 }, mat: { type: "type", color: "#07C160", emit: 0.25 }, anim: true });
A.SNAIL_PARTS.forEach((p) => {
  const geo = p.shape === "roundBox" ? { type: "roundBox", size: p.size, radius: p.radius } : p.shape === "ellipsoid" ? { type: "ellipsoid", r: p.r } : { type: "arc", radius: p.radius, tube: p.tube, arc: p.arc };
  add({ name: `snail_${p.name}`, geo, mat: { type: "toy", key: { body: "snail", eye: "white", pupil: "black" }[p.mat] }, anim: true });
});
// the sign-off: torn paper labels with raised letters, and the crown
A.LABELS.forEach((L, i) => {
  const [paper, ink] = { cream: ["#EFE6D4", "#161514"], red: ["#D8382D", "#FBF3E6"], blue: ["#2F5D9E", "#F3EEE4"] }[L.paper];
  add({ name: `label${i}_rim`, geo: { type: "curve", rings: [L.rim], depth: 0.0018, bevel: 0.0003 }, mat: { type: "paper", color: "#F6F1E8" }, anim: true });
  add({ name: `label${i}_sheet`, geo: { type: "curve", rings: [L.sheet], depth: 0.0024, bevel: 0.0003 }, mat: { type: "paper", color: paper }, anim: true });
  L.letters.forEach((g, j) => add({ name: `label${i}_l${j}`, geo: glyphGeo(g.key, L.em, 0.004, 0.0005), mat: { type: "type", color: ink, emit: ink === "#161514" ? 0 : 0.12 }, anim: true }));
});
add({ name: "crown", geo: { type: "curve", rings: [A.CROWN.map(([x, y]) => [+((x - 0.5) * A.CROWN_W).toFixed(6), +(y * A.CROWN_W).toFixed(6)])], depth: 0.012, bevel: 0.0018 }, mat: { type: "type", color: "#F2C14E", emit: 0.25 }, anim: true });

// act 2: the pinned cover as a wall, and its pieces
add({ name: "wall2", geo: null, anim: true });
add({ name: "wall2_slab", parent: "wall2", geo: { type: "wallSlab", w: A.WALL_W, h: A.WALL2_H, d: 0.01 }, mat: { type: "cover2", w: A.WALL_W, h: A.WALL2_H } });
for (const p of A.COVER2.pieces) {
  add({ name: `piece2_${p.name}`, parent: "wall2", geo: { type: "curve", rings: p.rings.map((r) => r.map((uv) => A.coverToWall2(uv).map((v) => +v.toFixed(6)))), depth: A.piece2Depth(p), bevel: 0.0007 }, mat: { type: "cover2", w: A.WALL_W, h: A.WALL2_H }, anim: true, piece2: p });
}

// the cover wall and its pieces
add({ name: "wall", geo: null, anim: true });
add({ name: "wall_slab", parent: "wall", geo: { type: "wallSlab", w: A.WALL_W, h: A.WALL_H, d: 0.01 }, mat: { type: "cover" } });
for (const p of A.COVER.pieces) {
  if (!p.rings.length) continue;
  add({ name: `piece_${p.name}`, parent: "wall", geo: { type: "curve", rings: p.rings.map((r) => r.map((uv) => A.coverToWall(uv).map((v) => +v.toFixed(6)))), depth: A.pieceDepth(p) }, mat: { type: "cover" }, anim: true, piece: p });
}
// the 2D mascot sticker he turns into (a card on the 《自媒体很苦》 wall)
add({ name: "sticker2d", parent: "wall", geo: { type: "plane", w: A.STICKER.w, h: A.STICKER.h }, mat: { type: "card2d", image: "assets/sticker2d.png" }, anim: true });


// particles
for (let i = 0; i < A.FLAKES; i++) add({ name: `flake_${i}`, geo: i < 2 ? { type: "ellipsoid", r: [0.007, 0.0012, 0.0032] } : { type: "box", size: [0.0042, 0.0006, 0.0042] }, mat: { type: "flake" }, anim: true, colorAnim: true });
for (let i = 0; i < A.SPARKS; i++) add({ name: `spark_${i}`, geo: { type: "octa", r: 0.0018 }, mat: { type: "spark", strength: 6 }, anim: true, colorAnim: true });
for (let i = 0; i < A.BITS; i++) add({ name: `bit_${i}`, geo: { type: "box", size: [0.006, 0.0006, 0.0045] }, mat: { type: "flake" }, anim: true, colorAnim: true });
add({ name: "fx", geo: null, light: true, anim: true });
add({ name: "camera", geo: null, camera: true, anim: true });

function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }

// ── Sample ──────────────────────────────────────────────────────────────────
const tracks = Object.fromEntries(objects.filter((o) => o.anim).map((o) => [o.name, []]));
const colors = Object.fromEntries(objects.filter((o) => o.colorAnim).map((o) => [o.name, []]));
const scalars = { fov: [], focus: [], fstop: [], glint: [], coverMix: [], coverFlat: [], blob: [], fx_energy: [], fx_color: [] };
const pieces = objects.filter((o) => o.piece);
const pieces2 = objects.filter((o) => o.piece2);

const TIMES = [];
for (let s = 0; s < SAMPLES; s++) TIMES.push([s, s]);
const cutIdx = T.EV.cut * T.FPS * SUB;
TIMES.push([cutIdx - 0.02, null]);
TIMES.sort((a, b) => a[0] - b[0]);
for (const [idx, s] of TIMES) {
  const t = idx / (T.FPS * SUB);
  const regular = s !== null;
  const whole = regular && s % SUB === 0;
  const put = (name, tr) => tracks[name].push([idx, ...pack(tr)]);
  const putColor = (name, color) => { if (whole) colors[name].push([s / SUB, ...hex(color).map((v) => +v.toFixed(4)), 1]); };

  const cam = A.cameraAt(t);
  put("camera", cam.tr);
  if (regular) {
    scalars.fov.push(cam.fov);
    scalars.focus.push(+cam.focus.toFixed(5));
    scalars.fstop.push(+cam.fstop.toFixed(3));
  }

  for (const name of Object.keys(T.PANELS)) put(`panel_${name}`, A.panelAt(name, t));
  put("panel_retroPost", A.retroAt(t));
  for (let i = 0; i < A.STRIPS; i++) put(`strip_${String(i).padStart(2, "0")}`, A.stripAt(i, t));

  const { hero } = A.mascotAt(t);
  put("hero", hero);
  A.mascotParts(t).forEach((tr, i) => put(`hero_${MASCOT_PARTS[i].name}`, tr));
  const b = A.blobAt(t);
  put("blob", b.tr);

  A.GLOW_BARS.forEach((_, i) => put(`glow_${i}`, A.glowBarAt(i, t)));
  put("stat_lid", A.lidAt(t));
  for (const [name, tr] of Object.entries(A.statAt(t))) put(name, tr);
  put("logo", A.logoAt(t));
  A.snailPartsAt(t).forEach((tr, i) => put(`snail_${A.SNAIL_PARTS[i].name}`, tr));
  A.LABELS.forEach((L, i) => {
    put(`label${i}_rim`, A.labelRimAt(i, t));
    put(`label${i}_sheet`, A.labelSheetAt(i, t));
    L.letters.forEach((_, j) => put(`label${i}_l${j}`, A.labelLetterAt(i, j, t)));
  });
  put("crown", A.crownAt(t));

  put("wall2", A.wall2At(t));
  for (const o of pieces2) put(o.name, A.piece2At(o.piece2, t));
  put("wall", A.wallAt(t).tr);
  put("sticker2d", A.sticker2dAt(t));
  for (const o of pieces) put(o.name, A.pieceAt(o.piece, t));

  for (let i = 0; i < A.FLAKES; i++) { const f = A.flakeAt(i, t); put(`flake_${i}`, f.tr); putColor(`flake_${i}`, f.color); }
  for (let i = 0; i < A.SPARKS; i++) { const f = A.sparkAt(i, t); put(`spark_${i}`, f.tr); putColor(`spark_${i}`, f.color); }
  for (let i = 0; i < A.BITS; i++) { const f = A.bitAt(i, t); put(`bit_${i}`, f.tr); putColor(`bit_${i}`, f.color); }

  const fx = A.fxAt(t);
  put("fx", trs(fx.p));
  if (whole) {
    scalars.glint.push(+A.glintAt(t).toFixed(3));
    scalars.coverMix.push(+A.coverMix(t).toFixed(4));
    scalars.coverFlat.push(+A.coverFlat(t).toFixed(4));
    scalars.blob.push(+b.opacity.toFixed(3));
    scalars.fx_energy.push(+fx.energy.toFixed(4));
    scalars.fx_color.push(hex(fx.color).map((v) => +v.toFixed(3)));
  }
  if (regular && s % 120 === 0) process.stdout.write(`\rsampled ${t.toFixed(1)}s`);
}
process.stdout.write("\n");
for (const o of pieces) delete o.piece;
for (const o of pieces2) delete o.piece2;

// quaternion sign continuity, then drop samples equal to both neighbours
const same = (a, b) => a.every((v, i) => i === 0 || v === b[i]);
function compress(list) { // rows are [sample position, ...values]
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (i > 0 && i < list.length - 1 && same(list[i], list[i - 1]) && same(list[i], list[i + 1])) continue;
    out.push(list[i]);
  }
  return out;
}
let keys = 0;
const outTracks = {};
for (const [name, list] of Object.entries(tracks)) {
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    const d = a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7];
    if (d < 0) for (let k = 4; k < 8; k++) b[k] = +(-b[k]).toFixed(6) || 0;
  }
  outTracks[name] = compress(list);
  keys += outTracks[name].length;
}
const outColors = {};
for (const [name, list] of Object.entries(colors)) outColors[name] = compress(list); // positions in frames

const out = { fps: T.FPS, frames: FRAMES, sub: SUB, samples: SAMPLES, objects, tracks: outTracks, colors: outColors, scalars };
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/anim.json"), JSON.stringify(out));
console.log(`anim.json: ${objects.length} objects, ${Object.keys(outTracks).length} animated, ${keys} keys, ${SAMPLES} samples`);
