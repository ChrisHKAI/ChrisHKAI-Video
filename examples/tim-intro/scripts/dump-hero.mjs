// Writes build/hero.json for the look-dev: Tim's and the Duo's parts, their
// colours and finishes, and a few named poses (every part's transform, the
// hidden face pieces), all solved in src/rig.js.
// usage: node scripts/dump-hero.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TIM, COLORS as TIM_COLORS, FINISH as TIM_FINISH } from "../src/tim.js";
import { JOBS, COLORS as JOBS_COLORS, FINISH as JOBS_FINISH } from "../src/jobs.js";
import { DUO_PARTS, DUO_COLORS, DUO_FINISH } from "../src/duo.js";
import { solve } from "../src/rig.js";
import { qAxis } from "../src/quat.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mm = (v) => v.map((x) => x * 0.001);
const pack = (t) => [...t.p, ...t.q, ...t.s].map((v) => +v.toFixed(7));

const held = (phi, extra = {}) => ({
  phone: { p: mm([0, 55, 25]), q: qAxis([1, 0, 0], -0.42), phi, hold: ["L", "R"], ...extra.phone },
  joints: { head: { q: qAxis([1, 0, 0], 0.12) }, ...extra.joints },
  expr: extra.expr,
});
const POSES = {
  rest: { expr: "surprised", joints: { armL: { q: qAxis([0, 0, 1], 0.06) }, armR: { q: qAxis([0, 0, 1], -0.06) } } },
  calm: { expr: "calm" },
  open: held(0, { expr: "happy" }),
  // the still: facing out, eyes wide, the Duo half shut at his waist
  photo: held(0.55, { expr: "surprised", phone: { p: mm([0, 50, 25]), q: qAxis([1, 0, 0], -0.15) }, joints: { head: { q: qAxis([1, 0, 0], -0.04) } } }),
  shut: held(1.5, { expr: "strain", phone: { p: mm([0, 52, 24]), q: qAxis([1, 0, 0], -0.1) } }),
  // the faces
  ...Object.fromEntries(["surprised", "happy", "focus", "strain", "tired", "calm"].map((e) => [`expr_${e}`, { expr: e }])),
  // Steve Jobs
  jobsRest: { fig: "jobs", expr: "calm" },
  jobsGentle: { fig: "jobs", expr: "gentle" },
  // the photo: right hand to the chin
  jobsChin: { fig: "jobs", expr: "calm", reach: { R: { wrist: mm([-6.5, 76, 26]), F: [0.35, 0.55, 0.76], N: [0.25, -0.75, 0.6], pole: [-0.6, -0.5, -0.3] } }, joints: { head: { q: qAxis([1, 0, 0], -0.06) } } },
  jobsWalk: { fig: "jobs", expr: "calm", joints: { legL: { q: qAxis([1, 0, 0], -0.32) }, legR: { q: qAxis([1, 0, 0], 0.3) }, armL: { q: qAxis([1, 0, 0], 0.28) }, armR: { q: qAxis([1, 0, 0], -0.3) } } },
  // the Duo on its own: open, half, shut
  duoOpen: { phone: { p: mm([0, 0, 0]), q: qId(), phi: 0 } },
  duoHalf: { phone: { p: mm([0, 0, 0]), q: qId(), phi: 0.75 } },
  duoShut: { phone: { p: mm([0, 0, 0]), q: qId(), phi: Math.PI / 2 } },
};
function qId() { return [0, 0, 0, 1]; }

const poses = {};
const FIGS = { tim: TIM, jobs: JOBS };
for (const [name, pose] of Object.entries(POSES)) {
  const fig = pose.fig ?? "tim";
  const { parts, hidden } = solve(pose, FIGS[fig], fig);
  const duoOnly = name.startsWith("duo");
  poses[name] = {
    parts: Object.fromEntries(Object.entries(parts).filter(([k]) => !duoOnly || k.startsWith("duo_")).map(([k, t]) => [k, pack(t)])),
    hidden,
  };
}
// each figure's colours are its own: materials are named figure.colour
const own = (fig, P) => P.map((p) => ({ ...p, name: `${fig}_${p.name}`, mat: `${fig}.${p.mat}`, paint: (p.paint ?? []).map((l) => ({ ...l, mat: `${fig}.${l.mat}`, ...(l.speckleWith ? { speckleWith: `${fig}.${l.speckleWith}` } : {}) })) }));
const ns = (fig, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`${fig}.${k}`, v]));
const parts = [...own("tim", TIM.parts), ...own("jobs", JOBS.parts), ...DUO_PARTS.map((p) => ({ ...p, name: `duo_${p.name}` }))];
const colors = { ...ns("tim", TIM_COLORS), ...ns("jobs", JOBS_COLORS), ...DUO_COLORS };
const finish = { ...ns("tim", TIM_FINISH), ...ns("jobs", JOBS_FINISH), ...DUO_FINISH };
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/hero.json"), JSON.stringify({ parts, colors, finish, poses }));
console.log(`hero.json: ${parts.length} parts, poses ${Object.keys(poses).join(" ")}`);
