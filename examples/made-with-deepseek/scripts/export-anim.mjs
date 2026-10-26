// Writes build/anim.json: every object of the world (geometry, material, parent)
// and its transform at every half frame, computed by src/anim.js — the same
// motion the preview plays. scripts/scene.py rebuilds the world in Blender
// from this file alone. Matrices are row-major, in Three.js space (+y up);
// Blender parents everything to an empty that turns that space z-up.
//
// usage: node scripts/export-anim.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";
import * as A from "../src/anim.js";
import { HERO_PARTS, FIN_PIVOTS, HERO_COLORS, U } from "../src/hero.js";
import { ATLAS } from "../src/atlas-layout.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUB = 2; // samples per frame, so motion blur sees the arcs
const FRAMES = Math.round(T.DURATION * T.FPS) + 1;
const SAMPLES = (FRAMES - 1) * SUB + 1;
const MM = A.MM;

// ── Three.js-compatible matrices ────────────────────────────────────────────
function rotation([x, y, z], order) {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  if (order === "YXZ") {
    const ce = c * e, cf = c * f, de = d * e, df = d * f;
    return [[ce + df * b, de * b - cf, a * d], [a * f, a * e, -b], [cf * b - de, df + ce * b, a * c]];
  }
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [[c * e, -c * f, d], [af + be * d, ae - bf * d, -b * c], [bf - ae * d, be + af * d, a * c]];
}
function compose(pos, rot = [0, 0, 0], scale = 1, order = "XYZ") {
  const s = typeof scale === "number" ? [scale, scale, scale] : scale;
  const R = rotation(rot, order);
  return [
    R[0][0] * s[0], R[0][1] * s[1], R[0][2] * s[2], pos[0],
    R[1][0] * s[0], R[1][1] * s[1], R[1][2] * s[2], pos[1],
    R[2][0] * s[0], R[2][1] * s[1], R[2][2] * s[2], pos[2],
    0, 0, 0, 1,
  ].map((v) => +v.toFixed(7));
}
function lookAt(eye, target) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const z = norm(sub(eye, target));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return [x[0], y[0], z[0], eye[0], x[1], y[1], z[1], eye[1], x[2], y[2], z[2], eye[2], 0, 0, 0, 1].map((v) => +v.toFixed(7));
}
const HIDDEN = 0.0001;

// ── The world's objects ─────────────────────────────────────────────────────
const objects = [];
const add = (o) => (objects.push({ parent: "root", matrix: compose([0, 0, 0]), ...o }), o.name);

add({ name: "floor", geo: { type: "plane", w: 9, h: 9 }, mat: { type: "floor" }, matrix: compose([-0.35, -1.1, -0.2], [-Math.PI / 2, 0, 0]) });

for (const [name, r] of Object.entries(T.PANELS)) {
  add({ name: `panel_${name}`, geo: null, anim: true });
  add({ name: `slab_${name}`, parent: `panel_${name}`, geo: { type: "uiBox", rect: r, thickness: A.SLAB_T }, mat: { type: "ui", emitGroup: name } });
  add({
    name: `shadow_${name}`, parent: `panel_${name}`,
    geo: { type: "plane", w: r[2] * MM + 0.09, h: r[3] * MM + 0.09 }, mat: { type: "slabShadow" },
    matrix: compose([0.012, -0.045, 0.018], [-Math.PI / 2, 0, 0]),
  });
}
const BUTTONS = { selection: ["menubar", T.toolRect("selection")], rect: ["menubar", T.toolRect("rect")], pen: ["menubar", T.toolRect("pen")], type: ["menubar", T.toolRect("type")], play: ["preview", T.previewRect("play")] };
for (const [name, [panel, r]] of Object.entries(BUTTONS)) {
  add({ name: `btn_${name}`, parent: `panel_${panel}`, geo: { type: "uiBox", rect: r, thickness: A.BUTTON_T }, mat: { type: "ui", emitGroup: panel, tintKey: name }, anim: true });
}
{
  const [x, y, w, h] = T.COMP;
  const uv = (r) => [r[0] / ATLAS.w, r[1] / ATLAS.h, (r[0] + r[2]) / ATLAS.w, (r[1] + r[3]) / ATLAS.h];
  add({ name: "compPlane", parent: "panel_comp", geo: { type: "plane", w: w * MM, h: h * MM, uv: uv(ATLAS.comp) }, mat: { type: "atlas", strength: 1.05, emitGroup: "comp" }, matrix: compose(A.panelLocal("comp", x + w / 2, y + h / 2, 0.0004), [-Math.PI / 2, 0, 0]) });
  const tcs = [["tc_comp", "comp", T.TC_COMP, ATLAS.tcComp], ["tc_timeline", "timeline", T.TC_TIMELINE, ATLAS.tcTimeline]];
  for (const [name, panel, r, region] of tcs) {
    add({ name, parent: `panel_${panel}`, geo: { type: "plane", w: r[2] * MM, h: r[3] * MM, uv: uv(region) }, mat: { type: "atlasAlpha", strength: 1.0, emitGroup: panel }, matrix: compose(A.panelLocal(panel, r[0] + r[2] / 2, r[1] + r[3] / 2, 0.0003), [-Math.PI / 2, 0, 0]) });
  }
}
T.TL_ROWS.forEach((row, i) => {
  if (row.type !== "layer") return;
  const len = (T.TL.trackX1 - T.TL.trackX0) * MM;
  add({
    name: `bar_${i}`, parent: "panel_timeline",
    geo: { type: "roundBox", size: [len, 0.004, (T.TL.rowH - 10) * MM], radius: 0.0012 },
    mat: { type: "emissive", color: T.LAYERS[row.layer].color, base: "#111111", strength: 0.62, roughness: 0.62, emitGroup: "timeline" },
    matrix: compose(A.panelLocal("timeline", (T.TL.trackX0 + T.TL.trackX1) / 2, T.rowCenterY(i), 0.002)),
  });
});
T.KEY_COMP_TIMES.forEach((ct, i) => {
  add({ name: `key_${i}`, parent: "panel_timeline", geo: { type: "roundBox", size: [0.012, 0.012, 0.012], radius: 0.0018 }, mat: { type: "emissive", color: "#ffffff", base: "#f2f2f2", strength: 0.45, roughness: 0.5, emitGroup: "timeline" }, anim: true });
});
add({ name: "cti", parent: "panel_timeline", geo: null, anim: true });
add({ name: "ctiHead", parent: "cti", geo: { type: "roundBox", size: [0.018, T.SURF.ctiHead * MM, 0.022], radius: 0.003 }, mat: { type: "emissive", color: "#7cc4ff", base: "#9fd4ff", strength: 1.5, roughness: 0.3, emitGroup: "timeline" }, matrix: compose([0, (T.SURF.ctiHead * MM) / 2, 0]) });
{
  const len = (T.TL.bottom - T.TL.rulerY - 8) * MM;
  add({ name: "ctiLine", parent: "cti", geo: { type: "box", size: [0.0024, 0.0012, len] }, mat: { type: "light", color: "#4ea3ff", strength: 3.2, emitGroup: "timeline" }, matrix: compose([0, 0.0007, 0.008 + len / 2]) });
}

// the whale
add({ name: "hero", geo: null, anim: true });
add({ name: "heroBody", parent: "hero", geo: null, anim: true });
for (const [name, p] of Object.entries(FIN_PIVOTS)) add({ name: `pivot_${name}`, parent: "heroBody", geo: null, anim: true, pivot: p });
for (const part of HERO_PARTS) {
  const parent = FIN_PIVOTS[part.group] ? `pivot_${part.group}` : "heroBody";
  const geo = part.shape === "ellipsoid"
    ? { type: "ellipsoid", r: part.r.map((v) => v * U) }
    : { type: "arc", radius: part.radius * U, tube: part.tube * U, arc: part.arc };
  const animated = part.group === "eyes" || part.group === "happy";
  add({ name: `hero_${part.name}`, parent, geo, mat: { type: "hero", key: part.mat, color: HERO_COLORS[part.mat] }, matrix: compose(part.pos.map((v) => v * U), part.rot), anim: animated, group: part.group });
}
add({ name: "blob", geo: { type: "plane", w: 1, h: 1 }, mat: { type: "blob" }, anim: true });
add({ name: "card", geo: { type: "plane", w: A.CARD_SIZE[0], h: A.CARD_SIZE[1], hinge: true }, mat: { type: "image", image: "build/sprite.png", strength: 0.55 }, anim: true });
add({ name: "chip", geo: { type: "box", size: [T.GLOW_CHIP[2] * MM, 0.005, T.GLOW_CHIP[3] * MM], topImage: true }, mat: { type: "chip", image: "build/chip.png" }, anim: true });
A.SHARDS.forEach((sh, i) => add({ name: `shard_${i}`, geo: { type: "tri", verts: sh.tri }, mat: { type: "glass" }, anim: true }));
for (let i = 0; i < 14; i++) add({ name: `sparkle_${i}`, geo: { type: "octa", r: 0.0016 }, mat: { type: "light", color: "#7f9cff", strength: 2.2 }, anim: true });
add({ name: "camera", geo: null, anim: true, camera: true });

// ── Sample the motion ───────────────────────────────────────────────────────
const anim = Object.fromEntries(objects.filter((o) => o.anim).map((o) => [o.name, []]));
const scalars = { fov: [], focus: [], fstop: [], blobOpacity: [] };
for (const n of Object.keys(T.PANELS)) scalars[`emit_${n}`] = [];
for (const n of Object.keys(BUTTONS)) scalars[`on_${n}`] = [];

const eyeParts = Object.fromEntries(HERO_PARTS.map((p) => [p.name, p]));
for (let s = 0; s < SAMPLES; s++) {
  const t = s / (T.FPS * SUB);
  const S = A.stateAt(t);
  const c = S.cam;
  anim.camera.push(lookAt(c.pos, c.target));
  scalars.fov.push(+c.fov.toFixed(4));
  scalars.focus.push(+c.focus.toFixed(5));
  scalars.fstop.push(+c.fstop.toFixed(4));

  for (const [n, P] of Object.entries(S.panels)) {
    anim[`panel_${n}`].push(compose(P.pos, P.rot, P.visible ? 1 : HIDDEN));
    scalars[`emit_${n}`].push(+P.emit.toFixed(4));
  }
  for (const [n, [panel, r]] of Object.entries(BUTTONS)) {
    const rest = A.panelLocal(panel, r[0] + r[2] / 2, r[1] + r[3] / 2, A.BUTTON_T);
    anim[`btn_${n}`].push(compose([rest[0], rest[1] - S.buttons[n].press * 0.0022, rest[2]]));
    scalars[`on_${n}`].push(S.buttons[n].on ? 1 : 0);
  }
  S.keys.forEach((k, i) => {
    const p = A.panelLocal("timeline", T.compTimeToX(T.KEY_COMP_TIMES[i]), T.POSITION_ROW_Y, 0.008);
    anim[`key_${i}`].push(compose(p, [0, Math.PI / 4, 0], k > 0 ? Math.max(0.001, k) : HIDDEN));
  });
  anim.cti.push(compose(A.panelLocal("timeline", S.ctiX, T.TL.rulerY, 0)));

  const h = S.hero;
  anim.hero.push(compose(h.pos, h.rot, h.visible ? 1 : HIDDEN, "YXZ"));
  anim.heroBody.push(compose([0, 0, 0], [0, 0, 0], h.scale));
  for (const [n, p] of Object.entries(FIN_PIVOTS)) {
    anim[`pivot_${n}`].push(compose(p.pos.map((v) => v * U), [p.rot[0], p.rot[1], n === "finL" ? h.finL : h.finR]));
  }
  for (const n of ["eyeL", "eyeR", "happyL", "happyR"]) {
    const part = eyeParts[n];
    const isEye = part.group === "eyes";
    const show = isEye ? !h.happy : h.happy;
    const sc = show ? (isEye && h.blink ? [1, 0.15, 1] : [1, 1, 1]) : [HIDDEN, HIDDEN, HIDDEN];
    anim[`hero_${n}`].push(compose(part.pos.map((v) => v * U), part.rot, sc));
  }

  const b = S.blob;
  anim.blob.push(compose(b.pos, [-Math.PI / 2, 0, b.yaw], b.visible ? [b.sx, b.sz, 1] : HIDDEN));
  scalars.blobOpacity.push(+b.opacity.toFixed(4));
  anim.card.push(compose(S.card.pos, S.card.rot, S.card.visible ? S.card.scale : HIDDEN));
  anim.chip.push(compose(S.chip.pos, S.chip.rot, S.chip.visible ? S.chip.scale : HIDDEN));
  S.shards.forEach((sh, i) => anim[`shard_${i}`].push(compose(sh.pos, sh.rot, sh.visible ? sh.scale : HIDDEN)));
  S.sparkles.forEach((sp, i) => anim[`sparkle_${i}`].push(compose(sp.pos, sp.rot, sp.visible ? sp.scale : HIDDEN)));
}

const out = {
  fps: T.FPS, frames: FRAMES, sub: SUB, samples: SAMPLES,
  ui: { w: T.UI_W, h: T.UI_H, image: "assets/ui.png" },
  atlas: { ...ATLAS, dir: "build/atlas" },
  audio: "assets/audio/score.wav",
  objects, anim, scalars,
};
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/anim.json"), JSON.stringify(out));
console.log(`anim.json: ${objects.length} objects, ${Object.keys(anim).length} animated, ${SAMPLES} samples`);
