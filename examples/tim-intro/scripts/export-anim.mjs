// Writes build/anim.json: every object of the world (geometry, material,
// parent), its transform twice a frame, its visibility per frame, and the
// lights and camera, all from src/anim.js. scripts/scene.py rebuilds the
// world in Blender from this file alone. Transforms: location / quaternion
// (w last) / scale in Three.js space (+y up).
//
// usage: node scripts/export-anim.mjs [--from 23] [--to 35] [--out build/anim.json]
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";
import * as A from "../src/anim.js";
import { TIM, COLORS as TIM_COLORS, FINISH as TIM_FINISH } from "../src/tim.js";
import { JOBS, COLORS as JOBS_COLORS, FINISH as JOBS_FINISH } from "../src/jobs.js";
import { DUO_PARTS, DUO_COLORS, DUO_FINISH } from "../src/duo.js";
import * as PH from "../src/iphone.js";
import { trs, qAxis, qMul } from "../src/quat.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SUB = 2;
const FRAMES = Math.round(T.DURATION * T.FPS);
const F0 = Math.max(1, Math.round(+arg("--from", 0) * T.FPS) + 1 - 2);
const F1 = Math.min(FRAMES, Math.round(+arg("--to", T.DURATION) * T.FPS) + 1 + 2);
const GLYPHS = JSON.parse(readFileSync(join(root, "build/glyphs.json"), "utf8"));

const ns = (fig, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`${fig}.${k}`, v]));
const palette = { ...ns("tim", TIM_COLORS), ...ns("jobs", JOBS_COLORS), ...DUO_COLORS };
const finish = { ...ns("tim", TIM_FINISH), ...ns("jobs", JOBS_FINISH), ...DUO_FINISH };
const own = (fig, p) => ({ ...p, mat: `${fig}.${p.mat}`, paint: (p.paint ?? []).map((l) => ({ ...l, mat: `${fig}.${l.mat}`, ...(l.speckleWith ? { speckleWith: `${fig}.${l.speckleWith}` } : {}) })) });
const pack = (t) => [...t.p, ...t.q, ...t.s].map((v) => +v.toFixed(6));

const objects = [];
const add = (o) => { objects.push({ parent: "root", tr: pack(trs([0, 0, 0])), ...o }); return o.name; };

const flat = qAxis([1, 0, 0], -Math.PI / 2);
if (T.SET.kind === "keynote") {
  // ── the keynote stage (src/timeline.js SET), in stage space ───────────────
  const { deck: D, screen: S, legs: G } = T.SET;
  const dz = (D.front + D.back) / 2, depth = D.front - D.back;
  add({ name: "stage", geo: null, tr: pack(trs([0, 0, 0], qAxis([0, 1, 0], T.SET.yaw))) });
  add({ name: "floor", parent: "stage", geo: { type: "plane", w: D.w, h: depth }, mat: { type: "deck" }, tr: pack(trs([0, 0, dz], flat)) });
  add({ name: "deck_body", parent: "stage", geo: { type: "box", size: [D.w, D.h, depth], radius: 0.002 }, mat: { type: "deckEdge" }, tr: pack(trs([0, -D.h / 2 - 0.0005, dz])) });
  add({ name: "house_floor", parent: "stage", geo: { type: "plane", w: 9, h: 9 }, mat: { type: "house" }, tr: pack(trs([0, -D.h, 3.5], flat)) });
  add({ name: "backdrop", parent: "stage", geo: { type: "plane", w: 5, h: 1.6 }, mat: { type: "drape" }, tr: pack(trs([0, 0.7, S.z - 0.03])) });
  // the legs: black drapes either side, Jobs's wing behind the left one
  for (const s of [-1, 1]) add({ name: `leg_${s < 0 ? "L" : "R"}`, parent: "stage", geo: { type: "plane", w: G.w, h: 1.6 }, mat: { type: "drape" }, tr: pack(trs([s * (G.x + G.w / 2), 0.7, G.z])) });
  add({ name: "big_screen", parent: "stage", geo: { type: "plane", w: S.w, h: S.h }, mat: { type: "keynoteScreen" }, tr: pack(trs([0, S.y + S.h / 2, S.z])) });
  // blue light raking up the black drapes either side of the screen
  [0.1, 0.24, 0.38, 0.52].forEach((dx, i) => {
    for (const s of [-1, 1]) add({ name: `beam_${s < 0 ? "L" : "R"}${i}`, parent: "stage", geo: { type: "plane", w: 0.07, h: 0.9 }, mat: { type: "beam" }, tr: pack(trs([s * (S.w / 2 + dx), 0.42, S.z - 0.025], qAxis([0, 0, 1], s * (0.1 + 0.05 * i)))) });
  });
  // the house: rows of people in the dark below the stage
  add({ name: "crowd", parent: "stage", geo: { type: "crowd", z0: D.front + 0.16, rows: 18, row: 0.072, x: 1.5, seat: 0.052, floor: -D.h, rake: 0.008 }, mat: { type: "crowd" } });
  // the lighting rig overhead
  for (let i = 0; i < 13; i++) add({ name: `fixture_${i}`, parent: "stage", geo: { type: "ellipsoid", r: [1, 1, 1] }, mat: { type: "fixture" }, tr: pack(trs([-1.2 + i * 0.2, 0.98, 0.18 + 0.05 * (i % 2)], [0, 0, 0, 1], 0.006)) });
} else {
  // ── the studio ────────────────────────────────────────────────────────────
  add({ name: "floor", geo: { type: "plane", w: 6, h: 6 }, mat: { type: "floor" }, tr: pack(trs([0, 0, 0], flat)) });
  add({ name: "backWall", geo: { type: "plane", w: 6, h: 1.2 }, mat: { type: "wall" }, tr: pack(trs([0, 0.6, -0.42])) });
  add({ name: "leftWall", geo: { type: "plane", w: 3, h: 1.2 }, mat: { type: "wall" }, tr: pack(trs([-0.62, 0.6, 0], qAxis([0, 1, 0], Math.PI / 2))) });
}

// ── Tim and the Duo ─────────────────────────────────────────────────────────
add({ name: "tim", geo: null, anim: true });
for (const p of TIM.parts) add({ name: `tim_${p.name}`, parent: "tim", geo: { type: "part", part: own("tim", p) }, anim: true });
for (const p of DUO_PARTS) add({ name: `duo_${p.name}`, parent: "tim", geo: { type: "part", part: p }, anim: true });

// ── Steve Jobs, the toy, and the follow spot ────────────────────────────────
add({ name: "jobs", geo: null, anim: true });
for (const p of JOBS.parts) add({ name: `jobs_${p.name}`, parent: "jobs", geo: { type: "part", part: own("jobs", p) }, anim: true });
add({ name: "followspot", geo: { type: "spotLight", radius: 0.03, blend: 0.3 }, anim: true });

// ── the fold counter (under the big screen, over Tim for the last nine) ────
const C = T.COUNTER;
add({ name: "counter", geo: null, anim: true });
// white glowing numerals like the follower count in kingao-intro, each with a
// dark fattened twin behind it, so they read on the white studio and in the dark
const glyph = (ch, em, depth, bevel = em * 0.012) => ({ type: "glyph", rings: GLYPHS[`heavy:${ch}`].rings.map((r) => r.map(([x, y]) => [+(x * em).toFixed(6), +(y * em).toFixed(6)])), depth, bevel });
const lettering = (name, ch, em, x, y) => {
  add({ name: `${name}`, parent: "counter", geo: glyph(ch, em, em * 0.14), mat: { type: "countType" }, tr: pack(trs([x, y, 0])) });
  add({ name: `${name}_edge`, parent: "counter", geo: glyph(ch, em, em * 0.1, em * 0.045), mat: { type: "countEdge" }, tr: pack(trs([x, y, -em * 0.1])) });
};
const ADV = GLYPHS["heavy:0"].advance * C.em;
const slotX = (k) => -C.em * 1.25 + k * ADV; // three slots, the number right-aligned
for (let k = 0; k < 3; k++) for (let d = 0; d <= 9; d++) lettering(`digit_${k}_${d}`, String(d), C.em, slotX(k) + (ADV - GLYPHS[`heavy:${d}`].advance * C.em) / 2, -C.em * 0.36);
const small = C.em * 0.46;
// 次 above, folds under it, right of the number
lettering("label_ci", "次", small, slotX(3) + C.em * 0.1, -C.em * 0.36 + small * 0.62);
["f", "o", "l", "d", "s"].reduce((x, ch, i) => {
  lettering(`label_en${i}`, ch, small * 0.6, x, -C.em * 0.36);
  return x + GLYPHS[`heavy:${ch}`].advance * small * 0.6;
}, slotX(3) + C.em * 0.1);

// ── the last word: the iPhone 4S in the dark, far from the stage ───────────
const PA = T.PHONE.at;
add({ name: "phone", geo: null, tr: pack(trs(PA)) });
for (const p of PH.PARTS) add({ name: `phone_${p.name}`, parent: "phone", geo: p.geo, mat: p.mat, tr: pack(trs(p.p, p.turn ? qAxis(p.turn[0], (p.turn[1] * Math.PI) / 180) : [0, 0, 0, 1])) });
// soft lights that lift it out of the dark (keyed "phoneKey"): the band picked
// out from both sides, the glass left black (anything in front shows in it)
const near = (v) => PA.map((x, i) => x + v[i]);
add({ name: "phone_key", geo: { type: "areaLight", size: 0.2, energy: 1.6, color: "#fff4ea", key: "phoneKey" }, tr: pack(A.lookAt(near([-0.3, 0.22, 0.12]), PA)) });
add({ name: "phone_rim", geo: { type: "areaLight", size: 0.2, energy: 1.2, color: "#dfe6ff", key: "phoneKey" }, tr: pack(A.lookAt(near([0.3, 0.12, -0.02]), PA)) });

// ── lights and camera ───────────────────────────────────────────────────────
add({ name: "camera", geo: { type: "camera" }, anim: true });

// ── sampling ────────────────────────────────────────────────────────────────
const tracks = {}, vis = {}, scalars = { studio: [], glint: [], rig: [], screen: [], feed: [], word: [], spot: [], phone: [], phoneKey: [], spotSize: [], fov: [], focus: [], fstop: [] };
const put = (name, tr, s) => (tracks[name] ??= []).push([s, ...pack(tr)]);
const show = (name, f, on) => {
  const v = (vis[name] ??= []);
  if (!v.length || v[v.length - 1][1] !== (on ? 1 : 0)) v.push([f, on ? 1 : 0]);
};
const S0 = (F0 - 1) * SUB, S1 = (F1 - 1) * SUB;
for (let s = S0; s <= S1; s++) {
  const t = s / (SUB * T.FPS);
  const fr = A.frameAt(t);
  for (const [n, tr] of Object.entries(fr.tim.parts)) put(n, tr, s);
  for (const [n, tr] of Object.entries(fr.jobs.parts)) put(n, tr, s);
  put("jobs", fr.jobsRoot, s);
  put("camera", fr.camera.tr, s);
  put("tim", fr.timRoot, s);
  put("counter", A.counterFrame(t), s);
  put("followspot", fr.spot.tr, s);
  scalars.spotSize.push([s, +fr.spot.size.toFixed(3)]);
  scalars.fov.push([s, fr.camera.fov]);
  scalars.focus.push([s, +fr.camera.focus.toFixed(4)]);
  scalars.fstop.push([s, fr.camera.fstop]);
  if (s % SUB) continue;
  const f = s / SUB + 1; // the frame this sample starts
  for (const k of ["studio", "glint", "rig", "screen", "feed", "word", "spot", "phone", "phoneKey"]) scalars[k].push([s, +fr.lights[k].toFixed(4)]);
  const hidden = new Set([...fr.tim.hidden, ...fr.jobs.hidden]);
  for (const n of Object.keys(fr.tim.parts)) show(n, f, !hidden.has(n));
  // Jobs is on only once he sets off for the stage, in the dark behind the leg
  const jobsOn = t >= A.jobsSetsOff;
  for (const n of Object.keys(fr.jobs.parts)) show(n, f, jobsOn && !hidden.has(n));
  // the counter: right-aligned digits, shown in the wides and the last nine
  // (on and off only at cuts: the pull back to the house is one move)
  const counterOn = fr.shot === "main" || fr.shot === "stage" || (fr.shot === "last" && t < A.countOff());
  const digits = String(fr.folds.count).padStart(3, " ");
  for (let k = 0; k < 3; k++) for (let d = 0; d <= 9; d++) for (const e of ["", "_edge"]) show(`digit_${k}_${d}${e}`, f, counterOn && digits[k] === String(d));
  for (const n of ["label_ci", ...[0, 1, 2, 3, 4].map((i) => `label_en${i}`)]) for (const e of ["", "_edge"]) show(`${n}${e}`, f, counterOn);
}

// quaternion sign continuity, then drop samples equal to both neighbours
const same = (a, b) => a.every((v, i) => i === 0 || v === b[i]);
function compress(list) {
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
    if (a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7] < 0) for (let k = 4; k < 8; k++) b[k] = +(-b[k]).toFixed(6) || 0;
  }
  outTracks[name] = compress(list);
  keys += outTracks[name].length;
}
for (const k of Object.keys(scalars)) scalars[k] = compress(scalars[k]);
// the frames that open a shot with a jump of the camera (not a move running on)
const cuts = [];
for (let f = F0 + 1; f <= F1; f++) {
  const [a, b] = [f - 2, f - 1].map((g) => A.cameraAt(g / T.FPS).tr.p);
  if (T.shotAt((f - 1) / T.FPS).i !== T.shotAt((f - 2) / T.FPS).i && Math.hypot(...a.map((v, i) => v - b[i])) > 0.03) cuts.push(f);
}
const out = { fps: T.FPS, frames: FRAMES, sub: SUB, range: [F0, F1], set: T.SET, palette, finish, objects, tracks: outTracks, vis, scalars, cuts };
const file = join(root, arg("--out", "build/anim.json"));
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out));
console.log(`${file}: ${objects.length} objects, ${Object.keys(outTracks).length} animated, ${keys} keys, frames ${F0}-${F1}`);
