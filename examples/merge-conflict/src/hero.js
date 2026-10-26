// The two fighters as smooth toy figures. One part list per hero, read by
// src/anim.js (motion) and, through build/anim.json, by scripts/scene.py.
// When a hit bursts a body it turns into plastic beads sampled on its own
// surface; they fly, and when they come home the solid toy snaps back.
// Local axes follow Three.js: +y up, +z = the face. Origin = between the feet.
// Units: metres.
import { mulberry32 } from "./rng.js";

const mm = 0.001;
export const U = 0.0045; // the whale's modelling unit (as in made-with-deepseek)

export const COLORS = {
  orange: "#D97757",
  blue: "#4D6BFE",
  belly: "#EEF1FF",
  black: "#121214",
};

// shape: ellipsoid (r = radii) | roundBox (size, radius) | arc (torus segment)
// rot: Euler XYZ. group: swings / blinks / hides with the pose.
// mat: body (the hero's colour, half-swapped after the explosion) | belly | eye
const M = (v) => v.map((x) => x * mm);
export const CLAWD_PARTS = [
  { name: "body", shape: "roundBox", size: M([60, 30, 28]), radius: 7 * mm, pos: M([0, 25, 0]), mat: "body" },
  ...[-18, -7, 7, 18].map((x, i) => ({ name: `leg${i}`, shape: "roundBox", size: M([7.5, 13, 9]), radius: 2.6 * mm, pos: M([x, 6.5, 0]), mat: "body" })),
  { name: "armL", shape: "roundBox", size: M([10, 10, 11]), radius: 3.4 * mm, pos: M([-33.5, 23, 0]), mat: "body", group: "armL" },
  { name: "armR", shape: "roundBox", size: M([10, 10, 11]), radius: 3.4 * mm, pos: M([33.5, 23, 0]), mat: "body", group: "armR" },
  { name: "eyeL", shape: "roundBox", size: M([5, 10.5, 3]), radius: 1.6 * mm, pos: M([-13, 28.5, 13.9]), mat: "eye", group: "eyeL" },
  { name: "eyeR", shape: "roundBox", size: M([5, 10.5, 3]), radius: 1.6 * mm, pos: M([13, 28.5, 13.9]), mat: "eye", group: "eyeR" },
  { name: "happyL", shape: "arc", radius: 3.8 * mm, tube: 1.25 * mm, arc: Math.PI * 0.8, pos: M([-13, 26, 14.4]), rot: [0, 0, Math.PI * 0.1], mat: "eye", group: "happy" },
  { name: "happyR", shape: "arc", radius: 3.8 * mm, tube: 1.25 * mm, arc: Math.PI * 0.8, pos: M([13, 26, 14.4]), rot: [0, 0, Math.PI * 0.1], mat: "eye", group: "happy" },
];

// The toy whale from made-with-deepseek, with a tail group for the swipe
const BODY = { r: [4.6, 4.3, 5.2], pos: [0, 4.3, 0.8] };
function onBody(x, y) {
  const [rx, ry, rz] = BODY.r, [, cy, cz] = BODY.pos;
  const k = 1 - (x / rx) ** 2 - ((y - cy) / ry) ** 2;
  const z = cz + rz * Math.sqrt(Math.max(0, k));
  const n = [x / rx ** 2, (y - cy) / ry ** 2, (z - cz) / rz ** 2];
  const len = Math.hypot(...n);
  const nn = n.map((v) => v / len);
  return { pos: [x + nn[0] * 0.12, y + nn[1] * 0.12, z + nn[2] * 0.12], n: nn, yaw: Math.atan2(nn[0], nn[2]), pitch: -Math.asin(nn[1]) };
}
const eyeL = onBody(-2.5, 5.1), eyeR = onBody(2.5, 5.1);
const W = (v) => v.map((x) => x * U);
export const WHALE_PARTS = [
  { name: "body", shape: "ellipsoid", r: W(BODY.r), pos: W(BODY.pos), mat: "body" },
  { name: "rear", shape: "ellipsoid", r: W([3.4, 3.4, 4.4]), pos: W([0, 4.0, -3.4]), rot: [-0.16, 0, 0], mat: "body" },
  { name: "belly", shape: "ellipsoid", r: W([4.15, 3.1, 5.0]), pos: W([0, 3.25, 1.25]), mat: "belly" },
  { name: "tail", shape: "ellipsoid", r: W([1.5, 1.6, 3.1]), pos: W([0, 5.3, -7.2]), rot: [-0.72, 0, 0], mat: "body", group: "tail" },
  { name: "flukeL", shape: "ellipsoid", r: W([2.5, 0.48, 1.45]), pos: W([-1.75, 7.5, -9.1]), rot: [-0.55, -0.42, 0.22], mat: "body", group: "tail" },
  { name: "flukeR", shape: "ellipsoid", r: W([2.5, 0.48, 1.45]), pos: W([1.75, 7.5, -9.1]), rot: [-0.55, 0.42, -0.22], mat: "body", group: "tail" },
  { name: "finL", shape: "ellipsoid", r: W([2.2, 0.5, 1.25]), pos: W([-5.8, 2.45, 2.2]), rot: [0, -0.35, 0.32], mat: "body", group: "finL" },
  { name: "finR", shape: "ellipsoid", r: W([2.2, 0.5, 1.25]), pos: W([5.8, 2.45, 2.2]), rot: [0, 0.35, -0.32], mat: "body", group: "finR" },
  { name: "eyeL", shape: "ellipsoid", r: W([0.36, 0.92, 0.3]), pos: W(eyeL.pos), rot: [eyeL.pitch, eyeL.yaw, 0], order: "YXZ", mat: "eye", group: "eyeL" },
  { name: "eyeR", shape: "ellipsoid", r: W([0.36, 0.92, 0.3]), pos: W(eyeR.pos), rot: [eyeR.pitch, eyeR.yaw, 0], order: "YXZ", mat: "eye", group: "eyeR" },
  { name: "happyL", shape: "arc", radius: 0.78 * U, tube: 0.24 * U, arc: Math.PI * 0.8, pos: W([eyeL.pos[0], eyeL.pos[1] - 0.35, eyeL.pos[2] + 0.05]), rot: [eyeL.pitch, eyeL.yaw, Math.PI * 0.1], order: "YXZ", mat: "eye", group: "happy" },
  { name: "happyR", shape: "arc", radius: 0.78 * U, tube: 0.24 * U, arc: Math.PI * 0.8, pos: W([eyeR.pos[0], eyeR.pos[1] - 0.35, eyeR.pos[2] + 0.05]), rot: [eyeR.pitch, eyeR.yaw, Math.PI * 0.1], order: "YXZ", mat: "eye", group: "happy" },
];

// group pivots (hero-local) and the axis each group swings around
export const PIVOTS = {
  clawd: {
    armL: { p: M([-29, 24, 0]), axis: [0, 0, 1], sign: -1 },
    armR: { p: M([29, 24, 0]), axis: [0, 0, 1], sign: 1 },
    eyeL: { p: M([-13, 28.5, 13.9]), axis: [0, 0, 1], sign: 1 },
    eyeR: { p: M([13, 28.5, 13.9]), axis: [0, 0, 1], sign: 1 },
  },
  whale: {
    finL: { p: W([-4.1, 2.7, 2.1]), axis: [0, 0, 1], sign: -1 },
    finR: { p: W([4.1, 2.7, 2.1]), axis: [0, 0, 1], sign: 1 },
    tail: { p: W([0, 4.6, -5.0]), axis: [1, 0, 0], sign: 1 },
    eyeL: { p: W(eyeL.pos), axis: eyeL.n, sign: 1 },
    eyeR: { p: W(eyeR.pos), axis: eyeR.n, sign: 1 },
  },
};

// flips and tumbles turn around these; stars circle above TOP
export const CENTER = { clawd: M([0, 22, 0]), whale: W([0, 4.3, -1.0]) };
export const TOP = { clawd: 0.04, whale: 8.6 * U };
// where the beam and the spout leave the body (hero-local)
export const MOUTH = M([0, 18, 15]);
export const BLOWHOLE = W([0, 8.4, 1.6]);
// how far the face sticks out in front of the origin (for the collisions)
export const FRONT = { clawd: 0.015, whale: 6.0 * U };

// ── Beads: where a burst body's plastic bits live, sampled on its surface ───
function rotXYZ(v, [rx, ry, rz], order = "XYZ") {
  const X = (p) => [p[0], p[1] * Math.cos(rx) - p[2] * Math.sin(rx), p[1] * Math.sin(rx) + p[2] * Math.cos(rx)];
  const Y = (p) => [p[0] * Math.cos(ry) + p[2] * Math.sin(ry), p[1], -p[0] * Math.sin(ry) + p[2] * Math.cos(ry)];
  const Z = (p) => [p[0] * Math.cos(rz) - p[1] * Math.sin(rz), p[0] * Math.sin(rz) + p[1] * Math.cos(rz), p[2]];
  return order === "YXZ" ? Y(X(Z(v))) : X(Y(Z(v)));
}
function sampleBeads(parts, n, seed, swapTest) {
  const r = mulberry32(seed);
  const solid = parts.filter((p) => p.shape !== "arc");
  const area = (p) => {
    if (p.shape === "roundBox") { const [a, b, c] = p.size; return 2 * (a * b + b * c + a * c); }
    const [a, b, c] = p.r, q = 1.6;
    return 4 * Math.PI * (((a * b) ** q + (a * c) ** q + (b * c) ** q) / 3) ** (1 / q);
  };
  const total = solid.reduce((s, p) => s + area(p), 0);
  const beads = [];
  for (const p of solid) {
    const k = Math.max(p.mat === "eye" ? 1 : 2, Math.round((n * area(p)) / total));
    for (let i = 0; i < k; i++) {
      let local;
      const rad = (p.mat === "eye" ? 1.8 : 3.2 + 1.4 * r()) * mm;
      if (p.shape === "roundBox") {
        const [a, b, c] = p.size;
        const faces = [[a * b, 2], [b * c, 0], [a * c, 1]];
        let pick = r() * (a * b + b * c + a * c), axis = 2;
        for (const [w, ax] of faces) { if (pick < w) { axis = ax; break; } pick -= w; }
        const s = [(r() - 0.5) * (a - p.radius), (r() - 0.5) * (b - p.radius), (r() - 0.5) * (c - p.radius)];
        s[axis] = (r() < 0.5 ? -1 : 1) * (p.size[axis] / 2 - rad * 0.55);
        local = s;
      } else {
        let u = [0, 0, 0].map(() => r() * 2 - 1);
        while (Math.hypot(...u) > 1 || Math.hypot(...u) < 0.1) u = [0, 0, 0].map(() => r() * 2 - 1);
        const l = Math.hypot(...u);
        local = u.map((v, j) => (v / l) * Math.max(p.r[j] - rad * 0.55, p.r[j] * 0.3));
      }
      const v = rotXYZ(local, p.rot || [0, 0, 0], p.order);
      const pos = [p.pos[0] + v[0], p.pos[1] + v[1], p.pos[2] + v[2]];
      const color = p.mat === "eye" ? "black" : p.mat === "belly" ? "belly" : null;
      beads.push({ pos, r: rad, color, part: p.name, swap: p.mat === "body" && swapTest(pos) });
    }
  }
  return beads;
}
export const CLAWD_BEADS = sampleBeads(CLAWD_PARTS, 130, 7, (p) => p[0] < 0).map((b) => ({ ...b, color: b.color || "orange" }));
export const WHALE_BEADS = sampleBeads(WHALE_PARTS, 140, 8, (p) => p[2] < 0).map((b) => ({ ...b, color: b.color || "blue" }));

// colour split after the explosion: Clawd's left half (x < split) turns blue,
// the whale's back half (z < split) turns orange
export const SPLIT_AXIS = { clawd: 0, whale: 2 };
export const SPLIT_NONE = -0.06;

// ── Title ───────────────────────────────────────────────────────────────────
export const TITLE_TEXT = "MERGED.";
export const TITLE_SIZE = 0.1; // font em (m)
export const TITLE_FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf";
