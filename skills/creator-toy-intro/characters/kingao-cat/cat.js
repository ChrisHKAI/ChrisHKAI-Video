// The calico (reference/cat/cat.png) as a smooth vinyl toy: a wide rounded
// head with a white blaze, orange round both eyes, a black streak between the
// ears and black behind the left ear; closed, content eyes; a pear body that
// sits on its haunches, front legs together, a raised tail. The markings are
// painted on (soft-edged masks in each part's own space), not modelled.
// One part list, read by src/anim.js (motion) and, through build/hero.json,
// by scripts/lookdev.py and scripts/scene.py.
// Local axes follow Three.js: +y up, +z = the face. Origin = under the chest
// on the ground. Units: metres (modelled in mm).
// Sides are the cat's own: R = its right = -x, L = its left = +x.
import { qEuler, qRot, qConj } from "../../engine/lib/quat.js";

const mm = 0.001;
const M = (v) => v.map((x) => x * mm);

export const COLORS = {
  white: "#F6F2EA",
  orange: "#E8903A",
  black: "#2A1F1B",
  nose: "#E9897A",
  earPink: "#F2B3A6",
  line: "#2B1C17",
  whisker: "#FFFFFF",
};

// ── shapes the face sits on (mm), for placing lines on the surface ──────────
const HEAD = { c: [0, 58, 1], r: [32, 24, 25], p: 2.6, taper: -0.08 };
const MUZZLE = [-1, 1].map((s) => ({ c: [s * 5.6, 49.4, 21.6], r: [7.6, 5.8, 5.8] }));
const CHIN = { c: [0, 45.8, 19.6], r: [4.6, 3, 4] };

function superZ(b, x, y) {
  const p = b.p ?? 2, yn = (y - b.c[1]) / b.r[1], f = 1 + (b.taper ?? 0) * yn;
  const u = Math.abs((x - b.c[0]) / (b.r[0] * f)) ** p + Math.abs(yn) ** p;
  return u >= 1 ? -Infinity : b.c[2] + b.r[2] * f * (1 - u) ** (1 / p);
}
// the face's front surface z at (x, y)
export const faceZ = (x, y) => Math.max(superZ(HEAD, x, y), ...MUZZLE.map((m) => superZ(m, x, y)), superZ(CHIN, x, y));
// a line drawn on the face: points (x, y) in mm, sunk to half its thickness
const onFace = (pts, sink) => pts.map(([x, y]) => [x, y, faceZ(x, y) - sink]);

// a paint layer: blobs { c, r } (mm, cat space) unioned into one soft mask
const blob = (c, r) => ({ c, r });
const layer = (mat, blobs, opts = {}) => ({ mat, blobs, soft: 0.035, noise: 0.22, ...opts });

// closed eye: a gentle arch, the outer end a little higher (content squint)
function eye(s) {
  const cx = s * 12.8, cy = 60.4, pts = [], radii = [];
  for (let i = 0; i <= 8; i++) {
    const t = -1 + i / 4;
    pts.push([cx + s * 5.4 * t, cy + 1.9 * (1 - t * t) + 0.8 * t]);
    radii.push(0.62 + 0.3 * (1 - t * t));
  }
  return { pts: onFace(pts, 0.35), radii };
}
// cat mouth: a short stroke down from the nose, then a soft "ω"
function mouth() {
  const pts = [[-4.6, 50.4], [-3.6, 49.4], [-2.2, 48.9], [-0.9, 49.3], [0, 50.2], [0.9, 49.3], [2.2, 48.9], [3.6, 49.4], [4.6, 50.4]];
  return { pts: onFace(pts, 0.3), radii: pts.map(() => 0.5) };
}
function whisker(s, k) {
  const y0 = 50.6 - k * 2.0, dy = [0, 0.5 - k * 0.5, 0.7 - k * 1.3, 0.6 - k * 2.4];
  const xs = [10, 17, 25, 33], lift = [-0.4, 0.9, 1.8, 0];
  const pts = xs.map((x, i) => [s * x, y0 + dy[i], (i < 3 ? faceZ(s * x, y0 + dy[i]) : faceZ(s * 25, y0) - 5) + lift[i]]);
  return { pts, radii: [0.45, 0.38, 0.3, 0.2] };
}

// ears: tapered blobs tipped outward; the pink inner ear sits on the front
const EAR_TILT = 0.42;
function ears() {
  return [-1, 1].flatMap((s) => {
    const g = s < 0 ? "earR" : "earL", side = s < 0 ? "R" : "L";
    const rot = [-0.08, 0, -s * EAR_TILT];
    const pos = [s * 18.5, 83.5, -1];
    const inner = qRot(qEuler(...rot), [0, 1.5, 2.0]);
    return [
      {
        name: `ear${side}`, shape: "blob", r: M([10.4, 10.8, 4.6]), p: 2.0, taper: -0.66, pos: M(pos), rot, mat: "orange", group: g,
        // the left ear is all orange; the right one has black where the streak runs into it
        paint: s < 0 ? [layer("black", [blob([6, 1, 0], [5, 7.5, 6])], { local: true, soft: 0.12 })] : [],
      },
      { name: `inner${side}`, shape: "blob", r: M([6, 5.8, 2.6]), p: 2.0, taper: -0.6, pos: M(pos.map((v, i) => v + inner[i])), rot, mat: "earPink", group: g },
    ];
  });
}

// the body's patches, shared by the haunches so they run on across the seam
const bodyPaint = () => [
  layer("orange", [blob([12, 24, -15], [14, 12, 13]), blob([2, 30, -19], [10, 7, 8]), blob([-13, 16, -15], [8, 8, 8]), blob([-22, 12, -12], [5, 6, 7])]),
  layer("black", [blob([17, 32, -13], [7, 5.5, 7]), blob([9, 10, -19], [9, 6, 7])], { noise: 0.3 }),
];

export const CAT_PARTS = [
  // body: a pear that sits on its haunches
  {
    name: "body", shape: "blob", r: M([21.5, 19.5, 19.5]), p: 2.3, taper: -0.16, pos: M([0, 20, -1]), mat: "white", group: "body",
    paint: bodyPaint(),
  },
  // haunches and hind paws
  ...[-1, 1].flatMap((s) => {
    const g = s < 0 ? "hindR" : "hindL";
    return [
      {
        name: `haunch${g}`, shape: "ellipsoid", r: M([9, 9.5, 12.5]), pos: M([s * 15.5, 10, -2]), mat: "white", group: g,
        paint: bodyPaint(),
      },
      { name: `hindpaw${g}`, shape: "ellipsoid", r: M([5.8, 3.1, 7.4]), pos: M([s * 16, 3.1, 8]), mat: "white", group: g },
    ];
  }),
  // front legs and paws
  ...[-1, 1].flatMap((s) => {
    const g = s < 0 ? "legR" : "legL";
    return [
      { name: `leg${g}`, shape: "blob", r: M([6.2, 9.5, 5.8]), p: 2.2, taper: 0.06, pos: M([s * 8, 11.5, 14.5]), mat: "white", group: g },
      { name: `paw${g}`, shape: "ellipsoid", r: M([6.6, 3.4, 7]), pos: M([s * 8.2, 3.3, 18]), mat: "white", group: g },
    ];
  }),
  // tail: two tubes that meet in a ball at the joint
  {
    name: "tail1", shape: "tube", pts: [[0, 7, -17], [-2, 8.5, -28], [-6, 16, -35]].map(M), radii: M([5, 4.8, 4.6]), pos: [0, 0, 0], mat: "white", group: "tail1",
    paint: [layer("orange", [blob([-5, 15, -34], [6, 7, 6])], { soft: 0.1 })],
  },
  {
    name: "tail2", shape: "tube", pts: [[-6, 16, -35], [-9, 28, -37], [-10, 40, -32], [-7, 48, -26]].map(M), radii: M([4.6, 4.3, 4.0, 3.6]), pos: [0, 0, 0], mat: "orange", group: "tail2",
    paint: [layer("black", [blob([-8, 45, -28], [6, 6.5, 6]), blob([-9, 28, -37], [6, 3, 6])], { soft: 0.1 })],
  },
  // head
  {
    name: "head", shape: "blob", r: M(HEAD.r), p: HEAD.p, taper: HEAD.taper, pos: M(HEAD.c), mat: "white", group: "head",
    paint: [
      layer("orange", [
        blob([15, 67, 10], [18, 12.5, 21]), blob([27, 60, 2], [8, 8, 14]),
        blob([-15, 68, 10], [17, 11.5, 21]), blob([-14, 72, -14], [12, 9, 10]),
      ]),
      layer("white", [blob([0, 63, 24], [3.6, 13, 8]), blob([0, 52, 22], [9, 6, 9])], { noise: 0.12 }),
      layer("black", [blob([0, 80.5, 3], [5, 6, 11]), blob([-6, 80, -6], [6.5, 6, 10]), blob([-11, 77, 0], [5, 5, 6]), blob([22, 61, -14], [7.5, 10.5, 7.5])]),
    ],
  },
  ...MUZZLE.map((m, i) => ({ name: `muzzle${i}`, shape: "ellipsoid", r: M(m.r), pos: M(m.c), mat: "white", group: "head" })),
  { name: "chin", shape: "ellipsoid", r: M(CHIN.r), pos: M(CHIN.c), mat: "white", group: "head" },
  { name: "nose", shape: "blob", r: M([3.6, 2.5, 2.4]), p: 2.3, taper: 0.5, pos: M([0, 53.8, faceZ(0, 53.8) + 0.6]), mat: "nose", group: "head" },
  ...[-1, 1].map((s) => ({ name: `eye${s < 0 ? "R" : "L"}`, shape: "tube", ...scaleTube(eye(s)), pos: [0, 0, 0], mat: "line", group: "head" })),
  { name: "mouth", shape: "tube", ...scaleTube(mouth()), pos: [0, 0, 0], mat: "line", group: "head" },
  ...[-1, 1].flatMap((s) => [0, 1, 2].map((k) => ({ name: `whisker${s < 0 ? "R" : "L"}${k}`, shape: "tube", ...scaleTube(whisker(s, k)), pos: [0, 0, 0], mat: "whisker", group: "head" }))),
  ...ears(),
];

function scaleTube(t) {
  return { pts: t.pts.map(M), radii: M(t.radii) };
}

// paint blobs are written in cat space; the material reads the part's own
// (mesh) space, so move them there now
for (const part of CAT_PARTS) {
  for (const l of part.paint ?? []) {
    l.blobs = l.blobs.map((b) => {
      let c = M(b.c);
      if (!l.local) {
        c = c.map((v, i) => v - part.pos[i]);
        if (part.rot) c = qRot(qConj(qEuler(...part.rot)), c);
      }
      return { c, r: M(b.r) };
    });
    delete l.local;
  }
}

// joints: where each group turns (cat-local) and its parent joint
export const JOINTS = {
  body: { p: M([0, 14, 0]), parent: null },
  head: { p: M([0, 38, 2]), parent: "body" },
  earL: { p: M([15, 77, 0]), parent: "head" },
  earR: { p: M([-15, 77, 0]), parent: "head" },
  legL: { p: M([8, 19, 13.5]), parent: "body" },
  legR: { p: M([-8, 19, 13.5]), parent: "body" },
  hindL: { p: M([15.5, 10, -2]), parent: "body" },
  hindR: { p: M([-15.5, 10, -2]), parent: "body" },
  tail1: { p: M([0, 7, -17]), parent: "body" },
  tail2: { p: M([-6, 16, -35]), parent: "tail1" },
};

export const HEIGHT = 0.094;
export const CENTER = M([0, 42, 0]); // flips and squashes turn around here
