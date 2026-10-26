// The hero: a smooth toy whale in DeepSeek blue. One part list, two builders:
// src/scene.js (Three.js preview) and scripts/scene.py (Blender) both read it.
// Units: 1 unit = HERO_UNIT mm. Local axes follow Three.js: +y up, +z = head.
// Origin is where the belly touches the ground.
import { HERO_UNIT } from "./timeline.js";

export const U = HERO_UNIT * 0.001; // metres per unit

export const HERO_COLORS = {
  skin: "#4D6BFE",
  belly: "#B9C6FF",
  eye: "#0B0D1A",
};

const BODY = { r: [4.6, 4.3, 5.2], pos: [0, 4.3, 0.8] };

// eyes sit on the body's surface, turned to its normal
function onBody(x, y) {
  const [rx, ry, rz] = BODY.r, [, cy, cz] = BODY.pos;
  const k = 1 - (x / rx) ** 2 - ((y - cy) / ry) ** 2;
  const z = cz + rz * Math.sqrt(Math.max(0, k));
  const n = [x / rx ** 2, (y - cy) / ry ** 2, (z - cz) / rz ** 2];
  const len = Math.hypot(...n);
  const nn = n.map((v) => v / len);
  return { pos: [x + nn[0] * 0.12, y + nn[1] * 0.12, z + nn[2] * 0.12], yaw: Math.atan2(nn[0], nn[2]), pitch: -Math.asin(nn[1]) };
}
const eyeL = onBody(-2.5, 5.1), eyeR = onBody(2.5, 5.1);

// shape: ellipsoid (r = radii) or arc (a torus segment: radius, tube, arc).
// rot is Euler XYZ in radians. group lets the animator show/hide or swing it.
export const HERO_PARTS = [
  { name: "body", shape: "ellipsoid", r: BODY.r, pos: BODY.pos, rot: [0, 0, 0], mat: "skin" },
  { name: "rear", shape: "ellipsoid", r: [3.4, 3.4, 4.4], pos: [0, 4.0, -3.4], rot: [-0.16, 0, 0], mat: "skin" },
  { name: "belly", shape: "ellipsoid", r: [4.15, 3.1, 5.0], pos: [0, 3.25, 1.25], rot: [0, 0, 0], mat: "belly" },
  { name: "tail", shape: "ellipsoid", r: [1.5, 1.6, 3.1], pos: [0, 5.3, -7.2], rot: [-0.72, 0, 0], mat: "skin" },
  { name: "flukeL", shape: "ellipsoid", r: [2.5, 0.48, 1.45], pos: [-1.75, 7.5, -9.1], rot: [-0.55, -0.42, 0.22], mat: "skin" },
  { name: "flukeR", shape: "ellipsoid", r: [2.5, 0.48, 1.45], pos: [1.75, 7.5, -9.1], rot: [-0.55, 0.42, -0.22], mat: "skin" },
  { name: "finL", shape: "ellipsoid", r: [2.2, 0.5, 1.25], pos: [-1.7, -0.25, 0.1], rot: [0, 0, 0.32], mat: "skin", group: "finL" },
  { name: "finR", shape: "ellipsoid", r: [2.2, 0.5, 1.25], pos: [1.7, -0.25, 0.1], rot: [0, 0, -0.32], mat: "skin", group: "finR" },
  { name: "eyeL", shape: "ellipsoid", r: [0.36, 0.92, 0.3], pos: eyeL.pos, rot: [eyeL.pitch, eyeL.yaw, 0], mat: "eye", group: "eyes" },
  { name: "eyeR", shape: "ellipsoid", r: [0.36, 0.92, 0.3], pos: eyeR.pos, rot: [eyeR.pitch, eyeR.yaw, 0], mat: "eye", group: "eyes" },
  { name: "happyL", shape: "arc", radius: 0.78, tube: 0.24, arc: Math.PI * 0.8, pos: [eyeL.pos[0], eyeL.pos[1] - 0.35, eyeL.pos[2] + 0.05], rot: [eyeL.pitch, eyeL.yaw, Math.PI * 0.1], mat: "eye", group: "happy" },
  { name: "happyR", shape: "arc", radius: 0.78, tube: 0.24, arc: Math.PI * 0.8, pos: [eyeR.pos[0], eyeR.pos[1] - 0.35, eyeR.pos[2] + 0.05], rot: [eyeR.pitch, eyeR.yaw, Math.PI * 0.1], mat: "eye", group: "happy" },
];

// fins swing around these pivots (units, local to the hero)
export const FIN_PIVOTS = {
  finL: { pos: [-4.1, 2.7, 2.1], rot: [0, -0.35, 0] },
  finR: { pos: [4.1, 2.7, 2.1], rot: [0, 0.35, 0] },
};

export const HERO_CENTER = [0, 4.3, -1.0]; // flips turn around this (units)
export const HERO_TOP = 8.6; // units
// turn from facing the camera so he shows a three-quarter profile at rest
export const REST_TURN = -0.7;
