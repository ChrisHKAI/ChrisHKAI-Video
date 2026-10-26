// Steve Jobs at a person's proportions, for the figure that walks out of the
// white light: backlit, it reads as a silhouette with a rim of light, so it is
// built plainly (black mock turtleneck, jeans, grey sneakers, round glasses)
// with knees and elbows to walk and to raise a hand to the chin.
// Modelled in mm at life size (1780 mm tall); the film scales the root.
// Axes as everywhere: +y up, +z = his front; L = his left = +x.
import { qAxis, qMul } from "./quat.js";

const mm = 0.001;
const M = (v) => v.map((x) => x * mm);
const SIDES = [[-1, "R"], [1, "L"]];

export const COLORS = {
  skin: "#D9A98A",
  hair: "#8E8B87",
  shirt: "#111114",
  jeans: "#3E5A7E",
  shoe: "#9C9FA4",
  sole: "#E8E8E4",
  frame: "#CDD0D4",
};
export const FINISH = { frame: "metal" };
export const LIFE = 1780; // mm

const JOINTS_MM = {
  hips: { p: [0, 980, 0], parent: null },
  chest: { p: [0, 1060, 0], parent: "hips" },
  head: { p: [0, 1500, 10], parent: "chest" },
  thighL: { p: [95, 930, 0], parent: "hips" },
  thighR: { p: [-95, 930, 0], parent: "hips" },
  shinL: { p: [95, 505, 12], parent: "thighL" },
  shinR: { p: [-95, 505, 12], parent: "thighR" },
  footL: { p: [95, 90, 0], parent: "shinL" },
  footR: { p: [-95, 90, 0], parent: "shinR" },
  armL: { p: [188, 1418, 0], parent: "chest" },
  armR: { p: [-188, 1418, 0], parent: "chest" },
  foreL: { p: [212, 1128, -12], parent: "armL" },
  foreR: { p: [-212, 1128, -12], parent: "armR" },
  handL: { p: [222, 868, 8], parent: "foreL" },
  handR: { p: [-222, 868, 8], parent: "foreR" },
};

const PARTS_MM = [
  { name: "pelvis", shape: "blob", r: [168, 125, 108], p: 2.4, pos: [0, 950, 0], mat: "jeans", group: "hips" },
  { name: "torso", shape: "blob", r: [196, 285, 122], p: 2.4, taper: 0.16, pos: [0, 1240, 0], mat: "shirt", group: "chest" },
  { name: "collar", shape: "tube", pts: [[0, 1470, 6], [0, 1555, 12]], radii: [62, 58], mat: "shirt", group: "chest" },
  { name: "head", shape: "blob", r: [88, 122, 104], p: 2.1, taper: 0.08, pos: [0, 1660, 12], mat: "skin", group: "head" },
  { name: "hair", shape: "blob", r: [92, 104, 106], p: 2.3, pos: [0, 1700, -8], mat: "hair", group: "head" },
  ...SIDES.map(([s, n]) => ({ name: `ear${n}`, shape: "ellipsoid", r: [14, 30, 20], pos: [s * 76, 1640, 4], mat: "skin", group: "head" })),
  { name: "nose", shape: "blob", r: [16, 30, 20], p: 2.0, pos: [0, 1630, 104], mat: "skin", group: "head" },
  ...SIDES.map(([s, n]) => ({ name: `rim${n}`, shape: "loop", pts: Array.from({ length: 20 }, (_, i) => [s * 34 + 24 * Math.cos((2 * Math.PI * i) / 20), 1660 + 24 * Math.sin((2 * Math.PI * i) / 20), 108]), radii: Array(20).fill(2.4), mat: "frame", group: "head" })),
  ...SIDES.flatMap(([s, n]) => [
    { name: `thigh${n}`, shape: "tube", pts: [[s * 95, 940, 0], [s * 95, 505, 12]], radii: [96, 72], mat: "jeans", group: `thigh${n}` },
    { name: `shin${n}`, shape: "tube", pts: [[s * 95, 505, 12], [s * 95, 100, 0]], radii: [70, 54], mat: "jeans", group: `shin${n}` },
    { name: `shoe${n}`, shape: "blob", r: [52, 48, 132], p: 2.3, taper: -0.15, pos: [s * 95, 52, 42], mat: "shoe", group: `foot${n}` },
    { name: `sole${n}`, shape: "blob", r: [55, 16, 136], p: 2.6, pos: [s * 95, 16, 42], mat: "sole", group: `foot${n}` },
    { name: `upper${n}`, shape: "tube", pts: [[s * 188, 1418, 0], [s * 212, 1128, -12]], radii: [64, 54], mat: "shirt", group: `arm${n}` },
    { name: `fore${n}`, shape: "tube", pts: [[s * 212, 1128, -12], [s * 222, 878, 8]], radii: [53, 43], mat: "shirt", group: `fore${n}` },
    { name: `hand${n}`, shape: "blob", r: [30, 86, 50], p: 2.2, pos: [s * 222, 790, 14], mat: "skin", group: `hand${n}` },
  ]),
];

function finish() {
  const parts = PARTS_MM.map((p) => {
    const q = { ...p, pos: M(p.pos ?? [0, 0, 0]) };
    if (p.r) q.r = M(p.r);
    if (p.pts) Object.assign(q, { pts: p.pts.map(M), radii: M(p.radii) });
    return q;
  });
  const joints = Object.fromEntries(Object.entries(JOINTS_MM).map(([k, j]) => [k, { ...j, p: M(j.p) }]));
  return { parts, joints };
}
export const HUMAN = finish();

// a walking pose at gait phase ph (radians; one stride per 2π)
export function walkPose(ph, amt = 1) {
  const sw = Math.sin(ph) * 0.42 * amt;
  const knee = (side) => Math.max(0, Math.sin(ph + (side > 0 ? 0 : Math.PI) + 1.2)) * 0.75 * amt;
  return {
    thighL: { q: qAxis([1, 0, 0], -sw) },
    thighR: { q: qAxis([1, 0, 0], sw) },
    shinL: { q: qAxis([1, 0, 0], knee(1)) },
    shinR: { q: qAxis([1, 0, 0], knee(-1)) },
    footL: { q: qAxis([1, 0, 0], -knee(1) * 0.3) },
    footR: { q: qAxis([1, 0, 0], -knee(-1) * 0.3) },
    armL: { q: qMul(qAxis([0, 0, 1], 0.06), qAxis([1, 0, 0], sw * 0.7)) },
    armR: { q: qMul(qAxis([0, 0, 1], -0.06), qAxis([1, 0, 0], -sw * 0.7)) },
    foreL: { q: qAxis([1, 0, 0], -0.22 * amt) },
    foreR: { q: qAxis([1, 0, 0], -0.22 * amt) },
    hips: { t: M([0, -Math.abs(Math.cos(ph)) * 18 * amt + 9 * amt, 0]) },
  };
}
