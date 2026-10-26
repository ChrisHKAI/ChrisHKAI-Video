// Poses a figure of the toy line (Tim, Steve Jobs): forward kinematics over
// the joint tree, two-bone IK that puts the hands on the Duo's halves (or on
// any targets), and the face pieces of an expression.
// solve(pose, fig, prefix) → every part's transform (the figure's parts as
// `${prefix}_name`, the Duo's as `duo_name`, in the space pose.root and
// pose.phone are given in), the hidden parts, and the joints' transforms.
//
// pose = {
//   root: { p, q },                 // the toy in its parent's space (m)
//   joints: { name: { q, t } },     // local turns (quaternions), nudges (m)
//   expr: "surprised",              // src/figure.js EXPRESSIONS
//   phone: { p, q, phi, hold: ["L", "R"], along },  // the Duo; held halves
//   reach: { L: { wrist, F, N, pole } },             // hands to other targets
// }
import { EXPRESSIONS, ARM_M } from "./figure.js";
import { TIM } from "./tim.js";
import { DUO_PARTS, halfQ, grip } from "./duo.js";
import { qAxis, qConj, qFromBasis, qFromTo, qId, qMul, qRot, trs, mulT, apply } from "./quat.js";

const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const scl = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const norm = (a) => scl(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const perp = (v, axis) => norm(sub(v, scl(axis, dot(v, axis))));

function fk(JOINTS, root, local) {
  const W = {};
  for (const j of Object.keys(JOINTS)) { // parents come first
    const { p, parent, t: rest = [0, 0, 0], s = 1 } = JOINTS[j];
    const L = local[j] ?? {};
    const off = add(add(parent ? sub(p, JOINTS[parent].p) : p, rest), L.t ?? [0, 0, 0]);
    W[j] = mulT(parent ? W[parent] : root, trs(off, L.q ?? qId(), s));
  }
  return W;
}

// rotation taking the hand's rest frame onto (F, N): fingers, palm normal
const frameQ = (F, N) => qFromBasis(F, N, cross(F, N));

function armIK(JOINTS, side, chestW, target) {
  const s = side === "L" ? 1 : -1;
  // the arm's rest pivots: shoulder, elbow, wrist
  const S0 = JOINTS[`arm${side}`].p, E0 = JOINTS[`fore${side}`].p, W0 = JOINTS[`hand${side}`].p;
  const pc = JOINTS.chest.p, ci = qConj(chestW.q), k = 1 / chestW.s[0];
  // into the chest's rest space
  const toRest = (x) => add(pc, scl(qRot(ci, sub(x, chestW.p)), k));
  const Wt = toRest(target.wrist), F = qRot(ci, target.F), N = qRot(ci, target.N);
  const L1 = len(sub(E0, S0)), L2 = len(sub(W0, E0));
  let d = len(sub(Wt, S0));
  const u = norm(sub(Wt, S0));
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-5);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const v = perp(target.pole ?? [s * 0.75, -0.35, -0.55], u);
  const E = add(S0, add(scl(u, a), scl(v, h)));
  const W = add(S0, scl(u, d));
  const qu = qFromTo(norm(sub(E0, S0)), norm(sub(E, S0)));
  // forearm: point it at the wrist, then roll its back (the watch side) toward the back of the hand
  const d1 = norm(sub(W, E));
  let qf = qFromTo(norm(sub(W0, E0)), d1);
  const b1 = perp(qRot(qf, [s, 0, 0]), d1), want = perp(scl(N, -1), d1);
  const roll = Math.atan2(dot(cross(b1, want), d1), dot(b1, want));
  qf = qMul(qAxis(d1, roll * (target.roll ?? 0.85)), qf);
  const qh = qMul(frameQ(F, N), qConj(frameQ([0, -1, 0], [-s, 0, 0])));
  return {
    [`arm${side}`]: { q: qu },
    [`fore${side}`]: { q: qMul(qConj(qu), qf) },
    [`hand${side}`]: { q: qMul(qConj(qf), qh) },
  };
}

export function solve(pose, fig = TIM, prefix = "tim") {
  const { parts: PARTS, joints: JOINTS } = fig;
  const root = pose.root ? trs(pose.root.p, pose.root.q) : trs([0, 0, 0]);
  const local = { ...(pose.joints ?? {}) };
  const ex = EXPRESSIONS[pose.expr ?? "calm"];
  for (const [s, n] of [[1, "L"], [-1, "R"]]) {
    local[`brow${n}`] = { t: [0, ex.brow.lift * 0.001, 0], q: qAxis([0, 0, 1], -s * ex.brow.tilt), ...(local[`brow${n}`] ?? {}) };
  }
  const ph = pose.phone;
  const P = ph ? trs(ph.p, ph.q) : null;
  if (ph?.hold?.length) {
    const W0 = fk(JOINTS, root, local);
    for (const n of ph.hold) {
      const g = grip(n, ph.along, ph.gripZ), hq = qMul(P.q, halfQ(n, ph.phi ?? 0));
      const contact = apply(P, qRot(halfQ(n, ph.phi ?? 0), g.contact));
      const F = qRot(hq, g.F), N = qRot(hq, g.N);
      const centre = sub(contact, scl(N, ARM_M.half));
      const wrist = sub(centre, scl(F, ARM_M.palm));
      Object.assign(local, armIK(JOINTS, n, W0.chest, { wrist, F, N, pole: ph.pole?.[n] }));
    }
  }
  if (pose.reach) {
    const W0 = fk(JOINTS, root, local);
    for (const [n, t] of Object.entries(pose.reach)) Object.assign(local, armIK(JOINTS, n, W0.chest, t));
  }
  // thumbs: over the edge onto the screen while the Duo is open, out alongside as it shuts
  for (const [s, n] of [[1, "L"], [-1, "R"]]) {
    const held = ph?.hold?.includes(n);
    const over = held ? (ph.thumb ?? Math.min(1, Math.max(0, (1.3 - (ph.phi ?? 0)) / 0.5))) : 0.45;
    local[`thumb${n}`] ??= { q: qAxis([0, -1, 0], -s * (1 - over) * 1.35) };
  }
  const J = fk(JOINTS, root, local);
  const parts = {}, hidden = [];
  for (const p of PARTS) {
    const g = p.group, jp = JOINTS[g].p;
    parts[`${prefix}_${p.name}`] = mulT(J[g], trs(sub(p.pos, jp), p.q ?? qId()));
    if (p.expr) {
      const [k, v] = p.expr.split(":");
      if (ex[k] !== v) hidden.push(`${prefix}_${p.name}`);
    }
  }
  if (P) {
    for (const p of DUO_PARTS) {
      parts[`duo_${p.name}`] = mulT(mulT(P, trs([0, 0, 0], halfQ(p.half, ph.phi ?? 0))), trs(p.pos, p.q ?? qId()));
    }
  }
  return { parts, hidden, joints: J };
}
