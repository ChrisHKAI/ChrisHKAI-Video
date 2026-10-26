// Writes build/anim.json: every object of the film's world (geometry,
// material, parent) and its transform twice a frame. The template's world.js
// declares the objects and samples them (its anim.js computes the motion);
// engine/scripts/scene.py rebuilds the world in Blender from this file alone.
// Transforms are location / quaternion (w last) / scale in Three.js space
// (+y up); Blender parents everything to an empty that turns it z-up.
// A track only keeps the samples where something changes, so Blender's linear
// keys reproduce every sample exactly. Also writes build/timeline.json (the
// events and sound cues the template's score reads).
//
// usage: FILM=<film folder> node engine/scripts/export-anim.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { film, FILM, fromSkill } from "../lib/film.js";
import { trs } from "../lib/quat.js";

const template = (f) => import(pathToFileURL(fromSkill("templates", film.template, f)).href);
const T = await template("timeline.js");
const W = await template("world.js");
const root = FILM;
const SUB = 2;
const FRAMES = Math.round(T.DURATION * T.FPS); // 900
const SAMPLES = (FRAMES - 1) * SUB + 1;

const objects = [];
const add = (o) => { objects.push({ parent: "root", tr: pack(trs([0, 0, 0])), ...o }); return o.name; };
function pack(t) {
  return [...t.p.map((v) => +v.toFixed(6)), ...t.q.map((v) => +v.toFixed(6)), ...t.s.map((v) => +v.toFixed(6))];
}

W.declare({ add, pack, objects });

function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }

// ── Sample ──────────────────────────────────────────────────────────────────
const tracks = Object.fromEntries(objects.filter((o) => o.anim).map((o) => [o.name, []]));
const colors = Object.fromEntries(objects.filter((o) => o.colorAnim).map((o) => [o.name, []]));
const scalars = W.scalars();

const TIMES = [];
for (let s = 0; s < SAMPLES; s++) TIMES.push([s, s]);
for (const cut of W.cuts) TIMES.push([cut * T.FPS * SUB - 0.02, null]); // no frame's shutter spans a cut
TIMES.sort((a, b) => a[0] - b[0]);
for (const [idx, s] of TIMES) {
  const t = idx / (T.FPS * SUB);
  const regular = s !== null;
  const whole = regular && s % SUB === 0;
  const put = (name, tr) => tracks[name].push([idx, ...pack(tr)]);
  const putColor = (name, color) => { if (whole) colors[name].push([s / SUB, ...hex(color).map((v) => +v.toFixed(4)), 1]); };

  W.sample(t, { put, putColor, regular, whole, scalars, hex });
  if (regular && s % 120 === 0) process.stdout.write(`\rsampled ${t.toFixed(1)}s`);
}
process.stdout.write("\n");
for (const o of objects) for (const k of Object.keys(o)) if (k.startsWith("_")) delete o[k]; // the world's own references

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

mkdirSync(join(root, "build"), { recursive: true });
// the story's numbers for the score (templates/<t>/score.py)
writeFileSync(join(root, "build/timeline.json"), JSON.stringify({ FPS: T.FPS, DURATION: T.DURATION, BPM: T.BPM, BEAT: T.BEAT, BAR: T.BAR, EV: T.EV, cues: T.soundCues ? T.soundCues() : [] }, null, 1));
const out = { fps: T.FPS, frames: FRAMES, sub: SUB, samples: SAMPLES, objects, tracks: outTracks, colors: outColors, scalars };
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/anim.json"), JSON.stringify(out));
console.log(`anim.json: ${objects.length} objects, ${Object.keys(outTracks).length} animated, ${keys} keys, ${SAMPLES} samples`);
