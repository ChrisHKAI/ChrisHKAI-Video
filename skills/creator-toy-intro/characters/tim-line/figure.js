// The toy line Tim and Steve Jobs are both cast in: one head mould (the face
// pieces for every expression, posable brows), one body and arm rig, and
// helpers for the parts that make each of them who they are (hair, glasses,
// clothes) — those live in src/tim.js and src/jobs.js.
// Local axes follow Three.js: +y up, +z = the face. Origin = on the ground
// between the feet. Units: modelled in mm; finish() turns a figure into metres.
// Sides are the figure's own: L = its left = +x, R = its right = -x.
import { qAxis, qFromTo, qFromBasis, qMul, qRot } from "../../engine/lib/quat.js";

const mm = 0.001;
const M = (v) => v.map((x) => x * mm);
export const SIDES = [[-1, "R"], [1, "L"]];

// ── shapes the face sits on (mm) ────────────────────────────────────────────
export const HEAD = { c: [0, 112, 1], r: [26.5, 30, 25.5], p: 2.25, taper: 0.1 };

function superZ(b, x, y) {
  const p = b.p ?? 2, yn = (y - b.c[1]) / b.r[1], f = 1 + (b.taper ?? 0) * yn;
  const u = Math.abs((x - b.c[0]) / (b.r[0] * f)) ** p + Math.abs(yn) ** p;
  return u >= 1 ? -Infinity : b.c[2] + b.r[2] * f * (1 - u) ** (1 / p);
}
// the head's surface: front z at (x, y), and side x at (y, z)
export const faceZ = (x, y) => superZ(HEAD, x, y);
export function sideX(y, z) {
  const b = HEAD, yn = (y - b.c[1]) / b.r[1], f = 1 + b.taper * yn;
  const u = Math.abs(yn) ** b.p + Math.abs((z - b.c[2]) / (b.r[2] * f)) ** b.p;
  return u >= 1 ? 0 : b.r[0] * f * (1 - u) ** (1 / b.p);
}
// unit normal of the face at (x, y)
function faceN(x, y) {
  const e = 0.05, z = faceZ(x, y);
  const dx = (faceZ(x + e, y) - faceZ(x - e, y)) / (2 * e), dy = (faceZ(x, y + e) - faceZ(x, y - e)) / (2 * e);
  const n = [-dx, -dy, 1], l = Math.hypot(...n);
  return { z, n: n.map((v) => v / l) };
}
// a point on the face at (x, y), lifted `lift` mm along the normal
export function onFace(x, y, lift = 0) {
  const { z, n } = faceN(x, y);
  return [x + n[0] * lift, y + n[1] * lift, z + n[2] * lift];
}
// a flat piece lying on the face at (x, y): its local +z along the normal
export function faceQ(x, y, roll = 0) {
  const q = qFromTo([0, 0, 1], faceN(x, y).n);
  return roll ? qMul(q, qAxis([0, 0, 1], roll)) : q;
}

export const mir = (v, s) => [s * v[0], v[1], v[2]];
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const scl = (a, k) => a.map((v) => v * k);
export const norm = (a) => scl(a, 1 / Math.hypot(...a));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function ellipse(rx, rz, y, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [rx * Math.cos(a), y, rz * Math.sin(a)];
  });
}

export const blob = (c, r) => ({ c, r });
export const layer = (mat, blobs, opts = {}) => ({ mat, blobs, soft: 0.04, noise: 0.18, ...opts });

// ── face pieces ─────────────────────────────────────────────────────────────
export const EYE_Y = 107, EYE_X = 10.6;
export const tubeOnFace = (pts2, radii, lift) => ({ pts: pts2.map(([x, y]) => onFace(x, y, lift)), radii });

function eyes() {
  return SIDES.flatMap(([s, n]) => {
    const x = s * EYE_X, y = EYE_Y;
    const at = (dx, dy, lift) => onFace(x + dx, y + dy, lift);
    const q = faceQ(x, y);
    const arc = (k, sag) => {
      const pts = [], radii = [];
      for (let i = 0; i <= 6; i++) {
        const t = -1 + i / 3;
        pts.push([x + 4.1 * t, y + sag * (1 - t * t) + k * t]);
        radii.push(0.62 + 0.32 * (1 - t * t));
      }
      return tubeOnFace(pts, radii, 0.25);
    };
    return [
      // wide (surprised): whites, small pupils, a glint
      { name: `eyeWhite${n}`, shape: "blob", r: [4.3, 4.7, 1.3], p: 2.1, pos: at(0, 0, -0.35), q, mat: "eyeWhite", expr: "eyes:wide" },
      { name: `pupilW${n}`, shape: "ellipsoid", r: [2.25, 2.45, 1.0], pos: at(-s * 0.2, -0.2, 0.55), q, mat: "pupil", expr: "eyes:wide" },
      { name: `glintW${n}`, shape: "ellipsoid", r: [0.72, 0.72, 0.45], pos: at(0.75, 0.85, 1.15), q, mat: "glint", expr: "eyes:wide" },
      // bead (calm, focused): a black oval with a glint
      { name: `bead${n}`, shape: "ellipsoid", r: [2.55, 3.25, 1.25], pos: at(0, -0.3, 0.1), q, mat: "pupil", expr: "eyes:bead" },
      { name: `glintB${n}`, shape: "ellipsoid", r: [0.75, 0.75, 0.45], pos: at(0.8, 0.75, 1.0), q, mat: "glint", expr: "eyes:bead" },
      // squint (straining): a short flat bead
      { name: `squint${n}`, shape: "ellipsoid", r: [2.9, 1.25, 1.0], pos: at(0, -0.4, 0.15), q: faceQ(x, y, -s * 0.12), mat: "pupil", expr: "eyes:squint" },
      // happy: ∩ arcs; closed (worn out): ∪ arcs
      { name: `happy${n}`, shape: "tube", ...arc(0, 2.0), mat: "pupil", expr: "eyes:happy" },
      { name: `closed${n}`, shape: "tube", ...arc(0, -1.5), mat: "pupil", expr: "eyes:closed" },
    ];
  });
}

const MOUTH_Y = 93.5;
function mouths() {
  const at = (dx, dy, lift) => onFace(dx, MOUTH_Y + dy, lift);
  const q = faceQ(0, MOUTH_Y);
  const line = (pts, r) => tubeOnFace(pts.map(([x, y]) => [x, MOUTH_Y + y]), pts.map(() => r), 0.2);
  return [
    // open (surprised): a dark oval, upper teeth, the tongue
    { name: "mouthO", shape: "blob", r: [4.5, 5.4, 1.5], p: 2.1, pos: at(0, -0.6, -0.5), q, mat: "mouth", expr: "mouth:open" },
    { name: "teethO", shape: "blob", r: [2.9, 1.15, 0.75], p: 2.6, pos: at(0, 2.9, 0.55), q, mat: "teeth", expr: "mouth:open" },
    { name: "tongueO", shape: "ellipsoid", r: [3.0, 1.9, 0.8], pos: at(0, -3.6, 0.45), q, mat: "tongue", expr: "mouth:open" },
    // grin (laughing): a wide dark D, teeth across the top
    { name: "mouthD", shape: "blob", r: [6.8, 4.1, 1.4], p: 2.3, taper: 0.28, pos: at(0, -0.8, -0.45), q, mat: "mouth", expr: "mouth:grin" },
    { name: "teethD", shape: "blob", r: [5.3, 1.15, 0.7], p: 2.8, pos: at(0, 1.9, 0.5), q, mat: "teeth", expr: "mouth:grin" },
    { name: "tongueD", shape: "ellipsoid", r: [3.6, 1.5, 0.7], pos: at(0, -3.2, 0.4), q, mat: "tongue", expr: "mouth:grin" },
    // smile and flat (pressed, concentrating) lines
    { name: "mouthSmile", shape: "tube", ...line([[-5.2, 1.1], [-2.8, -0.5], [0, -1.1], [2.8, -0.5], [5.2, 1.1]], 0.62), mat: "line", expr: "mouth:smile" },
    { name: "mouthFlat", shape: "tube", ...line([[-3.6, 0.2], [-1.2, -0.2], [1.2, 0.1], [3.6, -0.3]], 0.6), mat: "line", expr: "mouth:flat" },
  ];
}

// brows: thick and nearly straight; their joints raise and tilt them
const BROW_Y = 116.6, BROW_X = 11.2;
function brows(radii = [1.65, 1.75, 1.55, 1.1]) {
  return SIDES.map(([s, n]) => {
    const pts = [[s * 5.4, BROW_Y - 0.4], [s * 9.2, BROW_Y + 0.5], [s * 13.2, BROW_Y + 0.6], [s * 16.6, BROW_Y - 0.5]];
    return { name: `brow${n}`, shape: "tube", ...tubeOnFace(pts, radii, 0.5), mat: "brow", group: `brow${n}` };
  });
}

// a polygon with its corners rounded (radius r, n points per corner)
export function roundPoly(vs, r, n = 4) {
  const out = [];
  vs.forEach((v, i) => {
    const a = vs[(i + vs.length - 1) % vs.length], b = vs[(i + 1) % vs.length];
    const u1 = [a[0] - v[0], a[1] - v[1]], u2 = [b[0] - v[0], b[1] - v[1]];
    const l1 = Math.hypot(...u1), l2 = Math.hypot(...u2);
    const e1 = [u1[0] / l1, u1[1] / l1], e2 = [u2[0] / l2, u2[1] / l2];
    const th = Math.acos(Math.max(-1, Math.min(1, e1[0] * e2[0] + e1[1] * e2[1])));
    const d = Math.min(r / Math.tan(th / 2), l1 / 2.05, l2 / 2.05), rr = d * Math.tan(th / 2);
    const p1 = [v[0] + e1[0] * d, v[1] + e1[1] * d], p2 = [v[0] + e2[0] * d, v[1] + e2[1] * d];
    const bis = [e1[0] + e2[0], e1[1] + e2[1]], bl = Math.hypot(...bis);
    const c = [v[0] + (bis[0] / bl) * (rr / Math.sin(th / 2)), v[1] + (bis[1] / bl) * (rr / Math.sin(th / 2))];
    let a0 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), a1 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= n; k++) out.push([c[0] + rr * Math.cos(a0 + (da * k) / n), c[1] + rr * Math.sin(a0 + (da * k) / n)]);
  });
  return out;
}
// a temple arm from a hinge point back along the side of the head, over the
// ear, hooking behind it
export function temple(s, hinge, ty, r = [0.8, 0.75, 0.7, 0.68, 0.6]) {
  const pts = [hinge, [s * (sideX(ty, 14) + 1.0), ty + 0.2, 14], [s * (sideX(ty, 4) + 1.05), ty, 4], [s * (sideX(ty - 1, -5) + 1.0), ty - 1, -5], [s * (sideX(ty - 4, -8.5) + 0.5), ty - 4.5, -8.5]];
  return { shape: "tube", pts, radii: r };
}

// ── arms and hands (rest: hanging, palms to the thighs) ────────────────────
export const ARM = {
  S: [19.4, 69, 0], // shoulder (L side; mirror x for R)
  E: [22, 52.4, 0.6], // elbow
  W: [23, 36.6, 2.2], // wrist
  palm: 6.6, // wrist → mitten centre, along the fingers
  half: 3.5, // mitten half thickness (palm to back)
};
// sleeves: "tee" (short, flared, bare arms) or "long" (to a cuff at the wrist)
function arms(sleeves) {
  return SIDES.flatMap(([s, n]) => {
    const S = mir(ARM.S, s), E = mir(ARM.E, s), W = mir(ARM.W, s), d = norm(sub(W, E));
    const long = sleeves === "long";
    const parts = [
      { name: `sleeve${n}`, shape: "blob", r: long ? [6.2, 8.4, 6.6] : [6.6, 8.8, 7.0], p: 2.3, taper: long ? -0.1 : -0.24, pos: add(S, long ? [s * 1.2, -5.2, 0] : [s * 1.7, -5.6, 0]), q: qAxis([0, 0, 1], s * (long ? 0.14 : 0.24)), mat: "shirt", group: `arm${n}` },
      { name: `upper${n}`, shape: "tube", pts: [add(S, [s * 1.6, -8, 0]), E], radii: long ? [5.4, 5.2] : [5.0, 4.8], mat: long ? "shirt" : "skin", group: `arm${n}` },
      { name: `fore${n}`, shape: "tube", pts: [E, add(W, scl(d, long ? -1.6 : -1.0))], radii: long ? [5.15, 4.6] : [4.75, 4.15], mat: long ? "shirt" : "skin", group: `fore${n}` },
      // mitten hand: thin across the palm (x), long along the fingers (-y), a thumb in front
      { name: `hand${n}`, shape: "blob", r: [3.5, 7.4, 5.6], p: 2.15, taper: 0.06, pos: add(W, [0, -ARM.palm, 0]), mat: "skin", group: `hand${n}` },
      // the thumb curls toward the palm side; its joint swings it out alongside
      { name: `thumb${n}`, shape: "tube", pts: [add(W, [-s * 0.4, -2.6, 3.6]), add(W, [-s * 2.6, -5.2, 5.5]), add(W, [-s * 6.0, -7.4, 3.6])], radii: [2.0, 1.8, 1.6], mat: "skin", group: `thumb${n}` },
    ];
    if (long) {
      // a ribbed cuff, the wrist showing below it
      parts.push(
        { name: `cuff${n}`, shape: "blob", r: [5.0, 2.4, 5.0], p: 2.8, pos: add(W, scl(d, -2.4)), q: qFromTo([0, 1, 0], d), mat: "shirt", group: `fore${n}` },
        { name: `wrist${n}`, shape: "tube", pts: [add(W, scl(d, -2.0)), add(W, scl(d, 0.6))], radii: [3.9, 3.9], mat: "skin", group: `fore${n}` },
      );
    }
    if (s > 0 && sleeves === "tee+watch") {
      // the watch on the left wrist: case and face on the back of the wrist, a sport band
      const back = norm(cross(cross(d, [1, 0, 0]), d)); // ⊥ the forearm, outward
      const c = add(W, scl(d, -3.4));
      // a plate lies in its own xz plane: width across the wrist, depth along the forearm, face outward
      const xAx = cross(back, d);
      const qPlate = qFromBasis(xAx, back, d);
      parts.push(
        { name: "watchBand", shape: "blob", r: [5.0, 3.1, 5.0], p: 3.2, pos: c, q: qFromTo([0, 1, 0], d), mat: "band", group: "foreL" },
        { name: "watchCase", shape: "plate", w: 7.2, d: 8.6, t: 2.3, corner: 2.1, bevel: 0.85, pos: add(c, scl(back, 4.6)), q: qPlate, mat: "watch", group: "foreL" },
        { name: "watchFace", shape: "plate", w: 5.9, d: 7.3, t: 0.3, corner: 1.5, bevel: 0.12, pos: add(c, scl(back, 5.85)), q: qPlate, mat: "watchFace", group: "foreL" },
        { name: "watchCrown", shape: "ellipsoid", r: [0.9, 1.0, 0.9], pos: add(add(c, scl(back, 4.6)), scl(xAx, -3.8)), mat: "watch", group: "foreL" },
      );
    }
    return parts;
  });
}

// ── a figure ────────────────────────────────────────────────────────────────
// o = { sleeves: "tee" | "tee+watch" | "long", collar: "crew" | "mock",
//       shoes: [upper, sole], headPaint: [layers], hair: [parts], glasses: [parts],
//       browRadii, extra: [parts] }
export function buildFigure(o) {
  const parts = [
    // legs: jeans and sneakers
    ...SIDES.flatMap(([s, n]) => [
      { name: `leg${n}`, shape: "tube", pts: [[s * 9.4, 31, 0], [s * 9.6, 20, 0.4], [s * 9.6, 11, 0.8]], radii: [8.2, 7.7, 7.4], mat: "jeans", group: `leg${n}` },
      { name: `shoe${n}`, shape: "blob", r: [8.0, 5.4, 12.6], p: 2.3, taper: -0.12, pos: [s * 9.8, 6.4, 3.6], mat: "shoe", group: `leg${n}` },
      { name: `sole${n}`, shape: "blob", r: [8.5, 1.9, 13.2], p: 2.6, pos: [s * 9.8, 1.9, 3.6], mat: "sole", group: `leg${n}` },
    ]),
    { name: "pelvis", shape: "blob", r: [18.6, 10.5, 13.2], p: 2.4, pos: [0, 33, 0], mat: "jeans", group: "hips" },
    // the top: a soft box body, the hem, a crew collar or a mock turtleneck
    { name: "torso", shape: "blob", r: [18.6, 21.6, 13.6], p: 2.6, taper: 0.1, pos: [0, 56, 0], mat: "shirt", group: "chest" },
    { name: "hem", shape: "loop", pts: ellipse(18.0, 13.2, 36.2, 40), radii: Array(40).fill(1.2), mat: "shirt", group: "chest" },
    ...(o.collar === "mock"
      ? [{ name: "collar", shape: "blob", r: [9.6, 5.2, 8.8], p: 2.6, pos: [0, 80.0, 0.3], mat: "shirt", group: "chest" }]
      : [
          { name: "collar", shape: "loop", pts: ellipse(8.8, 7.8, 77.6, 32), radii: Array(32).fill(1.1), mat: "shirt", group: "chest" },
          { name: "neck", shape: "blob", r: [6.8, 6.5, 6.6], pos: [0, 80.2, 0.4], mat: "skin", group: "chest" },
        ]),
    ...arms(o.sleeves),
    // head, ears, nose, hair
    { name: "head", shape: "blob", r: HEAD.r, p: HEAD.p, taper: HEAD.taper, pos: HEAD.c, mat: "skin", group: "head", paint: o.headPaint ?? [] },
    ...SIDES.map(([s, n]) => ({ name: `ear${n}`, shape: "blob", r: [3.6, 6.8, 5.0], p: 2.1, pos: [s * 26.4, 105, -1.6], q: qMul(qAxis([0, 1, 0], s * 0.35), qAxis([0, 0, 1], -s * 0.14)), mat: "skin", group: "head" })),
    { name: "nose", shape: "blob", r: [3.1, 3.7, 2.6], p: 2.1, taper: 0.25, pos: onFace(0, 101, 0.4), mat: "skin", group: "head" },
    ...o.hair,
    ...eyes().map((p) => ({ ...p, group: "head" })),
    ...mouths().map((p) => ({ ...p, group: "head" })),
    ...brows(o.browRadii),
    ...o.glasses.map((p) => ({ ...p, group: "head" })),
    ...(o.extra ?? []),
  ];
  return finish(parts, JSON.parse(JSON.stringify(JOINTS_MM)));
}

// joints: pivot (toy space, mm) and parent
const JOINTS_MM = {
  hips: { p: [0, 32, 0], parent: null },
  legL: { p: [9.4, 30, 0], parent: "hips" },
  legR: { p: [-9.4, 30, 0], parent: "hips" },
  chest: { p: [0, 38, 0], parent: "hips" },
  head: { p: [0, 84, 0.5], parent: "chest", t: [0, -4, 0], s: 1.12 }, // a big toy head
  browL: { p: [BROW_X, BROW_Y, faceZ(BROW_X, BROW_Y)], parent: "head" },
  browR: { p: [-BROW_X, BROW_Y, faceZ(-BROW_X, BROW_Y)], parent: "head" },
  armL: { p: ARM.S, parent: "chest" },
  armR: { p: mir(ARM.S, -1), parent: "chest" },
  foreL: { p: ARM.E, parent: "armL" },
  foreR: { p: mir(ARM.E, -1), parent: "armR" },
  handL: { p: ARM.W, parent: "foreL" },
  handR: { p: mir(ARM.W, -1), parent: "foreR" },
  thumbL: { p: add(ARM.W, [-0.4, -2.6, 3.6]), parent: "handL" },
  thumbR: { p: add(mir(ARM.W, -1), [0.4, -2.6, 3.6]), parent: "handR" },
};

// expressions: the face pieces shown and the brows' pose (lift mm, tilt rad;
// tilt > 0 raises the inner ends)
export const EXPRESSIONS = {
  surprised: { eyes: "wide", mouth: "open", brow: { lift: 3.0, tilt: 0.1 } },
  happy: { eyes: "happy", mouth: "grin", brow: { lift: 1.4, tilt: 0 } },
  focus: { eyes: "bead", mouth: "flat", brow: { lift: -0.8, tilt: -0.2 } },
  strain: { eyes: "squint", mouth: "flat", brow: { lift: -1.2, tilt: -0.28 } },
  tired: { eyes: "closed", mouth: "flat", brow: { lift: -0.6, tilt: 0.3 } },
  calm: { eyes: "bead", mouth: "smile", brow: { lift: 0, tilt: 0 } },
  moved: { eyes: "wide", mouth: "flat", brow: { lift: 1.6, tilt: 0.35 } },
  gentle: { eyes: "happy", mouth: "smile", brow: { lift: 0.6, tilt: 0.1 } },
};

export const HEIGHT = 0.148;
export const ARM_M = Object.fromEntries(Object.entries(ARM).map(([k, v]) => [k, Array.isArray(v) ? M(v) : v * mm]));

// in metres, paint blobs moved into each part's own (mesh) space
function finish(parts, joints) {
  for (const p of parts) {
    if (p.pts) Object.assign(p, { pts: p.pts.map(M), radii: M(p.radii) });
    if (p.r) p.r = M(p.r);
    for (const k of ["w", "d", "t", "corner", "bevel"]) if (p[k] !== undefined) p[k] = Array.isArray(p[k]) ? M(p[k]) : p[k] * mm;
    if (p.outline) p.outline = p.outline.map(M);
    p.pos = p.pos ? M(p.pos) : [0, 0, 0];
    for (const l of p.paint ?? []) {
      l.blobs = l.blobs.map((b) => {
        let c = sub(M(b.c), p.pos);
        if (p.q) c = qRot([-p.q[0], -p.q[1], -p.q[2], p.q[3]], c);
        return { c, r: M(b.r) };
      });
    }
  }
  for (const j of Object.values(joints)) { j.p = M(j.p); if (j.t) j.t = M(j.t); }
  return { parts, joints };
}
