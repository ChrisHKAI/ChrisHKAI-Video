// Writes build/anim.json: every object of the world (geometry, material,
// parent) and its transform twice a frame, computed by src/anim.js.
// scripts/scene.py rebuilds the world in Blender from this file alone.
// Transforms are location / quaternion (w last) / scale in Three.js space
// (+y up); Blender parents everything to an empty that turns it z-up.
// A track only keeps the samples where something changes, so Blender's linear
// keys reproduce every sample exactly.
//
// usage: node scripts/export-anim.mjs [--until 8]
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";
import * as A from "../src/anim.js";
import { CAT_PARTS, COLORS } from "../src/cat.js";
import { MEDAL_PARTS, PROP_COLORS, BOTS } from "../src/props.js";
import { trs, qEuler } from "../src/quat.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUB = 2;
const FRAMES = Math.round(T.DURATION * T.FPS); // 900
const SAMPLES = (FRAMES - 1) * SUB + 1;

const objects = [];
const add = (o) => { objects.push({ parent: "root", tr: pack(trs([0, 0, 0])), ...o }); return o.name; };
function pack(t) {
  return [...t.p.map((v) => +v.toFixed(6)), ...t.q.map((v) => +v.toFixed(6)), ...t.s.map((v) => +v.toFixed(6))];
}
const PALETTE = { ...COLORS, ...PROP_COLORS };

// ── Static world ────────────────────────────────────────────────────────────
for (const [k, p] of Object.entries(T.STAGE)) {
  add({ name: `floor_${k}`, geo: { type: "plane", w: 12, h: 12 }, mat: { type: "floor" }, tr: pack(trs(p, qEuler(-Math.PI / 2, 0, 0))) });
}

// act 0: the profile's slabs (face at z = 0, thickness behind)
const UI = { image: "assets/ui.png", w: T.UI_W, h: T.UI_H };
for (const [name, r] of Object.entries(T.PANELS)) {
  add({ name: `panel_${name}`, geo: { type: "uiBox", w: r[2] * T.PX, h: r[3] * T.PX, uvRect: r, img: UI, thickness: A.SLAB_T }, mat: { type: "ui", image: UI.image }, anim: true });
}
add({ name: "backing", geo: { type: "plane", w: T.UI_W * T.PX, h: T.UI_H * T.PX }, mat: { type: "matteBlack" }, anim: true });
add({ name: "avatar", geo: { type: "disc", r: A.AV_R, depth: 0.0012, ring: T.AVATAR.ring * T.PX }, mat: { type: "photo", image: "assets/avatar-real.png" }, anim: true });

// the calico, part by part, and its medal
add({ name: "cat", geo: null, anim: true });
CAT_PARTS.forEach((p) => add({ name: `cat_${p.name}`, parent: "cat", geo: { type: "toyPart", part: p }, mat: { type: "vinyl", base: p.mat, paint: p.paint ?? [] }, anim: true }));
add({ name: "medal", geo: null, anim: true });
MEDAL_PARTS.forEach((p) => add({ name: `medal_${p.name}`, parent: "medal", geo: { type: "toyPart", part: p }, mat: { type: "vinyl", base: p.mat, paint: [] }, tr: pack(trs(p.pos, p.rot ? qEuler(...p.rot) : undefined)) }));
add({ name: "blob", geo: { type: "plane", w: 1, h: 1 }, mat: { type: "blob" }, anim: true });

// a toy under one empty, its parts at rest inside it
const toy = (name, parts) => {
  add({ name, geo: null, anim: true });
  parts.forEach((p) => add({ name: `${name}_${p.name}`, parent: name, geo: { type: "toyPart", part: p }, mat: { type: "vinyl", base: p.mat, paint: [] }, tr: pack(trs(p.pos, p.rot ? qEuler(...p.rot) : undefined)) }));
  add({ name: `${name}_blob`, geo: { type: "plane", w: 1, h: 1 }, mat: { type: "blob", fixed: 0.55 }, anim: true });
};

// act 1–4: torn-paper labels with raised letters
const glyphGeo = (key, em, depth, bevel) => ({ type: "curve", rings: A.GLYPHS[key].rings.map((r) => r.map(([x, y]) => [+(x * em).toFixed(6), +(y * em).toFixed(6)])), depth, bevel });
A.LABELS.forEach((L, i) => {
  const [paper, ink] = A.PAPER[L.paper];
  add({ name: `label${i}_rim`, geo: { type: "curve", rings: [L.rim], depth: 0.0018, bevel: 0.0003 }, mat: { type: "paper", color: "#F6F1E8" }, anim: true });
  add({ name: `label${i}_sheet`, geo: { type: "curve", rings: [L.sheet], depth: 0.0024, bevel: 0.0003 }, mat: { type: "paper", color: paper }, anim: true });
  L.letters.forEach((g, j) => add({ name: `label${i}_l${j}`, geo: glyphGeo(g.key, L.em, Math.max(0.002, L.em * 0.07), Math.max(0.0003, L.em * 0.008)), mat: { type: "type", color: ink, emit: ink === "#161514" ? 0 : 0.12 }, anim: true }));
});

// act 2: the phone, its bubbles, Grok bot and the article
const PH = T.PHONE;
add({ name: "phone", geo: { type: "roundBox", size: [A.PHONE_W + 0.014, A.PHONE_H + 0.014, PH.depth], radius: 0.016 }, mat: { type: "phoneBody" }, anim: true });
add({ name: "phone_screen", geo: { type: "roundCard", size: [A.PHONE_W, A.PHONE_H, 0.0008], radius: 0.012 }, mat: { type: "screen", image: "assets/phone.png" }, anim: true });
T.CHAT.forEach((m) => { const [w, h] = A.CHAT_SIZE[m.id]; add({ name: `bubble_${m.id}`, geo: { type: "roundCard", size: [w * PH.px, h * PH.px, 0.004], radius: m.sticker ? 0.008 : 0.006 }, mat: { type: "bubble", image: `assets/bubble-${m.id}.png` }, anim: true }); });
toy("botB", BOTS.black);
add({ name: "article", geo: { type: "uiBox", w: A.ARTICLE_W, h: A.ARTICLE_H, uvRect: [0, 0, T.ARTICLE_SLAB.w, T.ARTICLE_SLAB.h], img: { w: T.ARTICLE_SLAB.w, h: T.ARTICLE_SLAB.h }, thickness: T.ARTICLE_SLAB.depth }, mat: { type: "ui", image: "assets/article.png" }, anim: true });

// act 2–3: the counters, every digit of every slot (they swap on the frame)
for (const [id, C] of Object.entries(A.COUNTERS)) {
  const mat = { type: "type", color: "#F4F6F8", emit: 0.55 };
  const deep = (em) => ({ depth: em * 0.16, bevel: em * 0.016 });
  for (let s = 0; s < C.slots; s++) for (let d = 0; d <= 9; d++) {
    const g = deep(C.em);
    add({ name: `${id}_${s}_${d}`, geo: glyphGeo(`heavy:${d}`, C.em, g.depth, g.bevel), mat, anim: true, step: true });
  }
  const words = (list, tag, em) => list.forEach((w, i) => w.line.glyphs.forEach((gl, j) => { const g = deep(em); add({ name: `${id}_${tag}${i}_${j}`, geo: glyphGeo(gl.key, em, g.depth, g.bevel), mat: { ...mat, color: "#DCE3EA", emit: 0.4 }, anim: true }); }));
  words(C.before, "b", id === "days" ? C.em : C.wem);
  words(C.after, "a", C.wem);
  if (id === "fans") add({ name: "fans_plus", geo: glyphGeo("heavy:+", C.em, C.em * 0.16, C.em * 0.016), mat, anim: true, step: true });
}

// act 3: the bar chart
A.COLS.forEach((c, i) => {
  add({ name: `col_${i}`, geo: { type: "roundBox", size: [A.COL_W, c.h, A.COL_W], radius: 0.006 }, mat: { type: "glass" }, anim: true });
  add({ name: `col_${i}_top`, parent: `col_${i}`, geo: { type: "roundBox", size: [A.COL_W * 0.84, 0.0024, A.COL_W * 0.84], radius: 0.001 }, mat: { type: "glow", color: "#1D9BF0", strength: 3 }, tr: pack(trs([0, c.h / 2 + 0.0004, 0])) });
});

// act 4: the bots
for (const name of Object.keys(A.BOTS_D)) toy(`bot_${name}`, BOTS[name]);

// particles
for (let i = 0; i < A.PUFFS; i++) add({ name: `puff_${i}`, geo: { type: "ellipsoid", r: [0.012, 0.012, 0.012] }, mat: { type: "puff" }, anim: true });
for (let i = 0; i < A.FLAKES; i++) add({ name: `flake_${i}`, geo: { type: "box", size: [0.0042, 0.0006, 0.0042] }, mat: { type: "flake" }, anim: true, colorAnim: true });
for (let i = 0; i < A.CONFETTI; i++) add({ name: `confetti_${i}`, geo: { type: "box", size: [0.011, 0.0007, 0.0065] }, mat: { type: "flake" }, anim: true, colorAnim: true });
for (let i = 0; i < A.SPARKS; i++) add({ name: `spark_${i}`, geo: { type: "octa", r: 0.0016 }, mat: { type: "spark", strength: 6 }, anim: true, colorAnim: true });
add({ name: "fx", geo: null, light: true, anim: true });
add({ name: "camera", geo: null, camera: true, anim: true });

function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }

// ── Sample ──────────────────────────────────────────────────────────────────
const until = process.argv.includes("--until") ? +process.argv[process.argv.indexOf("--until") + 1] : T.DURATION;
const tracks = Object.fromEntries(objects.filter((o) => o.anim).map((o) => [o.name, []]));
const colors = Object.fromEntries(objects.filter((o) => o.colorAnim).map((o) => [o.name, []]));
const scalars = { fov: [], focus: [], fstop: [], blob: [], fx_energy: [], fx_color: [] };

// every cut gets an extra key 1/60 s before it, so no frame's shutter spans both sides
const TIMES = [];
const last = Math.min(SAMPLES - 1, Math.round(until * T.FPS * SUB));
for (let s = 0; s <= last; s++) TIMES.push([s, s]);
for (const c of [T.EV.cut1, T.EV.cut2, T.EV.cut3]) if (c < until) TIMES.push([c * T.FPS * SUB - 0.02, null]);
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
    scalars.fov.push(+cam.fov.toFixed(4));
    scalars.focus.push(+cam.focus.toFixed(5));
    scalars.fstop.push(+cam.fstop.toFixed(3));
  }
  for (const name of Object.keys(T.PANELS)) put(`panel_${name}`, A.panelAt(name, t));
  put("backing", A.backingAt(t));
  put("avatar", A.avatarAt(t));

  const { cat } = A.catAt(t);
  put("cat", cat);
  A.catParts(t).forEach((tr, i) => put(`cat_${CAT_PARTS[i].name}`, tr));
  put("medal", A.medalAt(t));
  A.LABELS.forEach((L, i) => {
    put(`label${i}_rim`, A.labelRimAt(i, t));
    put(`label${i}_sheet`, A.labelSheetAt(i, t));
    L.letters.forEach((_, j) => put(`label${i}_l${j}`, A.labelLetterAt(i, j, t)));
  });
  put("phone", A.phoneAt(t));
  put("phone_screen", A.phoneScreenAt(t));
  T.CHAT.forEach((m, i) => put(`bubble_${m.id}`, A.bubbleAt(i, t)));
  const bb = A.botBAt(t);
  put("botB", bb); put("botB_blob", A.botBlobAt(bb));
  put("article", A.articleAt(t));
  for (const id of Object.keys(A.COUNTERS)) for (const [name, tr] of Object.entries(A.counterAt(id, t))) put(name, tr);
  A.COLS.forEach((_, i) => put(`col_${i}`, A.columnAt(i, t)));
  for (const name of Object.keys(A.BOTS_D)) { const tr = A.botDAt(name, t); put(`bot_${name}`, tr); put(`bot_${name}_blob`, A.botBlobAt(tr)); }
  const b = A.blobAt(t);
  put("blob", b.tr);

  for (let i = 0; i < A.PUFFS; i++) put(`puff_${i}`, A.puffAt(i, t));
  for (let i = 0; i < A.FLAKES; i++) { const f = A.flakeAt(i, t); put(`flake_${i}`, f.tr); putColor(`flake_${i}`, f.color); }
  for (let i = 0; i < A.CONFETTI; i++) { const f = A.confettiAt(i, t); put(`confetti_${i}`, f.tr); putColor(`confetti_${i}`, f.color); }
  for (let i = 0; i < A.SPARKS; i++) { const f = A.sparkAt(i, t); put(`spark_${i}`, f.tr); putColor(`spark_${i}`, f.color); }

  const fx = A.fxAt(t);
  put("fx", trs(fx.p));
  if (whole) {
    scalars.blob.push(+b.opacity.toFixed(3));
    scalars.fx_energy.push(+fx.energy.toFixed(4));
    scalars.fx_color.push(hex(fx.color).map((v) => +v.toFixed(3)));
  }
  if (regular && s % 120 === 0) process.stdout.write(`\rsampled ${t.toFixed(1)}s`);
}
process.stdout.write("\n");

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

const out = { fps: T.FPS, frames: FRAMES, sub: SUB, samples: SAMPLES, palette: PALETTE, objects, tracks: outTracks, colors: outColors, scalars };
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/anim.json"), JSON.stringify(out));
console.log(`anim.json: ${objects.length} objects, ${Object.keys(outTracks).length} animated, ${keys} keys, ${TIMES.length} samples`);
