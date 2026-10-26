// Writes build/anim.json: every object of the world (geometry, material,
// parent) and its transform twice a frame, computed by src/anim.js.
// scripts/scene.py rebuilds the world in Blender from this file alone.
// Transforms are location / quaternion (w last) / scale in Three.js space
// (+y up); Blender parents everything to an empty that turns it z-up.
// A track only keeps the samples where something changes (the cubes ride
// their hero and only need keys while they fly), so Blender's linear keys
// reproduce every sample exactly.
//
// usage: node scripts/export-anim.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";
import * as A from "../src/anim.js";
import { CLAWD_PARTS, WHALE_PARTS, CLAWD_BEADS, WHALE_BEADS, COLORS, CENTER, SPLIT_AXIS, TITLE_TEXT, TITLE_SIZE, TITLE_FONT } from "../src/hero.js";
import { GLYPHS, glyphSlot, GLYPH_SLOT, GLYPH_SHEET } from "../src/glyphs.js";
import { ATLAS } from "../src/atlas-layout.js";
import { trs, qEuler } from "../src/quat.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUB = 2;
const FRAMES = Math.round(T.DURATION * T.FPS); // 576: t = 0 … 19.1667
const SAMPLES = (FRAMES - 1) * SUB + 1;
const MM = A.MM;

const objects = [];
const restOf = new Map();
const add = (o) => { objects.push({ parent: "root", tr: pack(trs([0, 0, 0])), ...o }); return o.name; };
function pack(t) {
  return [...t.p.map((v) => +v.toFixed(6)), ...t.q.map((v) => +v.toFixed(6)), ...t.s.map((v) => +v.toFixed(6))];
}
const uvOf = (r, W, H) => [r[0] / W, r[1] / H, (r[0] + r[2]) / W, (r[1] + r[3]) / H];

// ── Static world ────────────────────────────────────────────────────────────
add({ name: "floor", geo: { type: "plane", w: 10, h: 10 }, mat: { type: "floor" }, tr: pack(trs([-0.2, -1.1, 0.2], qEuler(-Math.PI / 2, 0, 0))) });
for (const [name, r] of Object.entries(T.PANELS)) {
  add({ name: `panel_${name}`, geo: null, anim: true });
  add({ name: `slab_${name}`, parent: `panel_${name}`, geo: { type: "uiBox", rect: r, thickness: A.SLAB_T }, mat: { type: "ui" } });
  add({ name: `shadow_${name}`, parent: `panel_${name}`, geo: { type: "plane", w: r[2] * MM + 0.08, h: r[3] * MM + 0.08 }, mat: { type: "slabShadow" }, tr: pack(trs([0.01, -0.05, 0.016], qEuler(-Math.PI / 2, 0, 0))) });
}
const atlasPlane = (name, panel, rect, region, strength) => add({
  name, parent: `panel_${panel}`,
  geo: { type: "plane", w: rect[2] * MM, h: rect[3] * MM, uv: uvOf(region, ATLAS.w, ATLAS.h) },
  mat: { type: "atlas", strength },
  tr: pack(trs(A.panelLocal(panel, rect[0] + rect[2] / 2, rect[1] + rect[3] / 2, 0.0004), qEuler(-Math.PI / 2, 0, 0))),
});
atlasPlane("atlas_code", "editor", T.CODE, ATLAS.code, 1.0);
atlasPlane("atlas_term", "terminal", T.TERM, ATLAS.term, 1.0);
atlasPlane("atlas_status", "statusbar", T.STATUS, ATLAS.status, 1.0);
add({ name: "button", parent: "panel_editor", geo: { type: "uiBox", rect: T.ACCEPT_BOTH, thickness: T.BUTTON_H * MM }, mat: { type: "ui", bright: 1.25 }, anim: true });

// ── The fighters: toy parts and the beads they burst into ──────────────────
const PARTS = { clawd: CLAWD_PARTS, whale: WHALE_PARTS }, BEADS = { clawd: CLAWD_BEADS, whale: WHALE_BEADS };
for (const who of ["clawd", "whale"]) {
  add({ name: who, geo: null, anim: true });
  for (const p of PARTS[who]) {
    const geo = p.shape === "roundBox" ? { type: "roundBox", size: p.size, radius: p.radius }
      : p.shape === "ellipsoid" ? { type: "ellipsoid", r: p.r }
      : { type: "arc", radius: p.radius, tube: p.tube, arc: p.arc };
    add({ name: `${who}_${p.name}`, parent: who, geo, mat: { type: "hero", who, key: p.mat, color: p.mat === "body" ? COLORS[who === "clawd" ? "orange" : "blue"] : COLORS[p.mat === "eye" ? "black" : "belly"], other: COLORS[who === "clawd" ? "blue" : "orange"], axis: SPLIT_AXIS[who] }, anim: true });
  }
  BEADS[who].forEach((_, i) => add({ name: `${who}_b${String(i).padStart(3, "0")}`, parent: who, geo: { type: "orb" }, mat: { type: "bead", who }, anim: true, colorAnim: true }));
}
add({ name: "beam_core", geo: { type: "cyl" }, mat: { type: "glow", color: "#FF7A45", strength: 2.4 }, anim: true });
const pools = [["beam", A.BEAM_N, A.beamVoxel], ["spout", A.SPOUT_N, A.spoutVoxel], ["spark", A.SPARK_N, A.sparkVoxel], ["impact", A.IMPACT_N, A.impactVoxel], ["sparkle", A.SPARKLE_N, A.sparkleAt]];
for (const [kind, n] of pools) {
  for (let j = 0; j < n; j++) add({ name: `${kind}_${j}`, geo: { type: kind === "sparkle" ? "octa" : "orb" }, mat: { type: kind === "spout" ? "water" : "glowVoxel", strength: { beam: 2.2, spout: 0.6, spark: 9, impact: 9, sparkle: 5 }[kind] }, anim: true, colorAnim: true });
}
GLYPHS.forEach((g, i) => {
  const [sx, sy] = glyphSlot(i);
  add({ name: `glyph_${i}`, geo: { type: "plane", w: A.GLYPH_W, h: A.GLYPH_H, uv: uvOf([sx, sy, GLYPH_SLOT[0], GLYPH_SLOT[1]], GLYPH_SHEET[0], GLYPH_SHEET[1]) }, mat: { type: "glyph", image: "build/glyphs.png" }, anim: true });
});
add({ name: "keycap", geo: { type: "box", size: A.KEYCAP, topImage: true }, mat: { type: "keycap", image: "build/keycap.png" }, anim: true });
for (const who of ["clawd", "whale"]) for (let k = 0; k < 3; k++) add({ name: `star_${who}_${k}`, geo: { type: "star", r: 0.0055 }, mat: { type: "glow", color: "#FFD54A", strength: 5 }, anim: true });
// the title: Blender sets each slot's x from the letter widths
add({ name: "title", geo: null, tr: pack(trs([A.wx(A.TITLE_AT[0]), 0, A.wz(A.TITLE_AT[1])])) });
[...TITLE_TEXT].forEach((ch, i) => {
  add({ name: `title_slot_${i}`, parent: "title", geo: null, slot: i });
  add({ name: `title_${i}`, parent: `title_slot_${i}`, geo: { type: "text", text: ch, size: TITLE_SIZE, font: TITLE_FONT }, mat: { type: "title" }, anim: true });
});
for (const who of ["clawd", "whale"]) add({ name: `blob_${who}`, geo: { type: "plane", w: 1, h: 1 }, mat: { type: "blob", who }, anim: true });
for (const name of ["fxA", "fxB"]) add({ name, geo: null, light: true, anim: true });
add({ name: "camera", geo: null, camera: true, anim: true });

function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }
function mix(a, b, s) { const x = hex(a), y = hex(b); return x.map((v, i) => +(v + (y[i] - v) * s).toFixed(4)); }

// ── Sample ──────────────────────────────────────────────────────────────────
const tracks = Object.fromEntries(objects.filter((o) => o.anim).map((o) => [o.name, []]));
const colors = Object.fromEntries(objects.filter((o) => o.colorAnim).map((o) => [o.name, []]));
const scalars = { fov: [], focus: [], fstop: [], glow_clawd: [], glow_whale: [], split_clawd: [], split_whale: [], blob_clawd: [], blob_whale: [], fxA_energy: [], fxB_energy: [], fxA_color: [], fxB_color: [] };

for (let s = 0; s < SAMPLES; s++) {
  const t = s / (T.FPS * SUB);
  const whole = s % SUB === 0;
  const put = (name, tr) => tracks[name].push(pack(tr));
  const putColor = (name, color, glow) => { if (whole) colors[name].push([...hex(color).map((v) => +v.toFixed(4)), +glow.toFixed(3)]); };

  const cam = A.cameraAt(t);
  put("camera", cam.tr);
  scalars.fov.push(cam.fov);
  scalars.focus.push(+cam.focus.toFixed(5));
  scalars.fstop.push(+cam.fstop.toFixed(3));

  for (const name of Object.keys(T.PANELS)) put(`panel_${name}`, A.panelAt(name, t));
  put("button", A.buttonAt(t));

  for (const who of ["clawd", "whale"]) {
    const tt = A.tau(t);
    put(who, A.heroT(A.poseAt(who, t), CENTER[who]));
    const parts = A.heroParts(who, t);
    PARTS[who].forEach((p, i) => put(`${who}_${p.name}`, parts[i]));
    A.heroBeads(who, t).forEach((c, i) => {
      const n = `${who}_b${String(i).padStart(3, "0")}`;
      put(n, c.local);
      putColor(n, c.color, c.glow);
    });
    const b = A.blobAt(who, t);
    put(`blob_${who}`, b.tr);
    if (whole) {
      scalars[`glow_${who}`].push(+A.glowAt(who, t).toFixed(3));
      scalars[`blob_${who}`].push(+b.opacity.toFixed(3));
      scalars[`split_${who}`].push(+A.splitAt(who, t).toFixed(4));
    }
    for (let k = 0; k < 3; k++) put(`star_${who}_${k}`, A.starAt(who, k, t));
    void tt;
  }
  put("beam_core", A.beamCore(A.tau(t)));
  for (const [kind, n, fn] of pools) {
    for (let j = 0; j < n; j++) {
      const r = fn(j, kind === "sparkle" ? t : A.tau(t));
      put(`${kind}_${j}`, r.tr);
      putColor(`${kind}_${j}`, r.color || "#FFFFFF", 0);
    }
  }
  GLYPHS.forEach((g, i) => put(`glyph_${i}`, A.glyphAt(g, A.tau(t))));
  put("keycap", A.keycapAt(t, cam.az));
  [...TITLE_TEXT].forEach((_, i) => put(`title_${i}`, A.titleLetter(i, t)));
  const L = A.lightsAt(t);
  for (const name of ["fxA", "fxB"]) {
    put(name, trs(L[name].p));
    if (whole) {
      scalars[`${name}_energy`].push(+L[name].energy.toFixed(4));
      scalars[`${name}_color`].push(hex(L[name].color).map((v) => +v.toFixed(3)));
    }
  }
  if (s % 120 === 0) process.stdout.write(`\rsampled ${(t).toFixed(1)}s`);
}
process.stdout.write("\n");

// quaternion sign continuity, then drop samples equal to both neighbours
const same = (a, b) => a.every((v, i) => v === b[i]);
function compress(list, step) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (i > 0 && i < list.length - 1 && same(list[i], list[i - 1]) && same(list[i], list[i + 1])) continue;
    out.push([i * step, ...list[i]]);
  }
  return out;
}
let keys = 0;
const outTracks = {};
for (const [name, list] of Object.entries(tracks)) {
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    const d = a[3] * b[3] + a[4] * b[4] + a[5] * b[5] + a[6] * b[6];
    if (d < 0) for (let k = 3; k < 7; k++) b[k] = +(-b[k]).toFixed(6) || 0;
  }
  outTracks[name] = compress(list, 1);
  keys += outTracks[name].length;
}
const outColors = {};
for (const [name, list] of Object.entries(colors)) outColors[name] = compress(list, 1);

const out = {
  fps: T.FPS, frames: FRAMES, sub: SUB, samples: SAMPLES,
  ui: { w: T.UI_W, h: T.UI_H, image: "assets/ui.png" },
  atlas: { ...ATLAS, dir: "build/atlas" },
  objects, tracks: outTracks, colors: outColors, scalars,
};
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/anim.json"), JSON.stringify(out));
console.log(`anim.json: ${objects.length} objects, ${Object.keys(outTracks).length} animated, ${keys} keys, ${SAMPLES} samples`);
