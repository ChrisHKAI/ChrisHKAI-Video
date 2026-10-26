// Everything in the film at time t: Tim and the Duo (src/rig.js) watching the
// big screen, the fold counter, Steve Jobs (the toy) walking on from the wing
// in the follow spot, the iPhone 4S at the end, the lights and the camera.
import * as T from "./timeline.js";
import { solve } from "./rig.js";
import { ARM_M } from "./figure.js";
import { TIM } from "./tim.js";
import { JOBS } from "./jobs.js";
import { grip, halfQ } from "./duo.js";
import { D as PHONE_D } from "./iphone.js";
import { qAxis, qMul, qFromBasis, qRot, trs, mulT, apply } from "./quat.js";

const { EV } = T;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
export const seg = (t, a, b) => clamp((t - a) / (b - a));
const mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const mm = (v) => v.map((x) => x * 0.001);
const yawQ = (y) => qAxis([0, 1, 0], y);
// stage space (src/timeline.js SET: +z to the house, +x to its right) ↔ world
const SC = Math.cos(T.SET.yaw), SS = Math.sin(T.SET.yaw);
export const fromStage = ([x, y, z]) => [x * SC + z * SS, y, -x * SS + z * SC];
const toStage = ([x, y, z]) => [x * SC - z * SS, y, x * SS + z * SC];

// ── the folds ──────────────────────────────────────────────────────────────
// count: an exponential ramp from 1.6 folds/s that reaches 491 at EV.portrait;
// the hands can only show so much, so the visible folding is capped at 4.2/s
// and rescaled to finish on an open phone at the portrait
const R0 = 1.6, TP = EV.portrait;
const K = (() => {
  let lo = 0.01, hi = 1;
  for (let i = 0; i < 60; i++) {
    const k = (lo + hi) / 2, n = (R0 * (Math.exp(k * TP) - 1)) / k;
    n > T.FOLDS_BEFORE ? (hi = k) : (lo = k);
  }
  return (lo + hi) / 2;
})();
const DT = 1 / 600;
const VIS = (() => {
  const a = [0];
  for (let t = DT; t <= TP + 1e-9; t += DT) a.push(a[a.length - 1] + Math.min(4.2, R0 * Math.exp(K * t)) * DT);
  const total = a[a.length - 1], k = Math.round(total) / total;
  return a.map((v) => v * k);
})();
const EIGHTH = (EV.done - EV.fold9) / 9;
// fold phase in cycles (an integer = open, half = shut) and the count shown
export function folds(t) {
  if (t < TP) {
    const n = (R0 * (Math.exp(K * Math.max(0, t)) - 1)) / K;
    const i = Math.max(0, t) / DT, j = Math.floor(i);
    const ph = VIS[j] + (VIS[Math.min(j + 1, VIS.length - 1)] - VIS[j]) * (i - j);
    return { phase: ph, count: Math.min(T.FOLDS_BEFORE, Math.floor(n + 1e-6)) };
  }
  if (t < EV.fold9) return { phase: 0, count: T.FOLDS_BEFORE };
  const c = (t - EV.fold9) / EIGHTH;
  if (c < 9) return { phase: c, count: T.FOLDS_BEFORE + Math.floor(c + 0.5) };
  return { phase: 0, count: T.FOLDS_TOTAL };
}
// fold angle from the phase: open → shut → open each cycle
const foldPhi = (ph) => 1.42 * (1 - Math.cos(2 * Math.PI * ph)) / 2;

// ── Tim ────────────────────────────────────────────────────────────────────
// turned to the big screen, he turns to Jobs as he walks on (a step round);
// after 500 he walks over to him (the big heads keep them a head apart)
const TURN = [EV.open, EV.open + 1.0];
const TIM_END = [0, 0, 0.09];
const TIM_ROOT = (t = 0) => {
  const k = smooth(seg(t, EV.timWalk0, EV.timWalk1));
  const yaw = T.TIM.yaw + T.TIM.watch * (1 - smooth(seg(t, TURN[0], TURN[1])));
  return trs(T.TIM.p.map((v, i) => lerp(v, TIM_END[i], k)), yawQ(yaw));
};
// the Duo in his hands: folding, shut after 500, held out to Jobs
function phoneHeld(t) {
  const f = folds(t);
  const shut = smooth(seg(t, EV.shut, EV.shut + 0.4));
  const out = smooth(seg(t, EV.give, EV.give + 0.6));
  const phi = lerp(foldPhi(f.phase), Math.PI / 2, shut);
  // then Jobs's alone: he draws it in to look at it
  const mine = smooth(seg(t, EV.lookDown - 0.3, EV.lookDown + 1.2));
  // held out, his hands slide back to his end to leave the far end to Jobs
  return { p: mm([0, lerp(54, 58, out) + 4 * mine, lerp(26, 36, out) + 14 * mine]), q: qAxis([1, 0, 0], lerp(-0.38, -0.08, shut)), phi, hold: ["L", "R"], gripZ: lerp(1.5, -4, out) };
}
// a hand's target between two (wrist, fingers F, palm N), N kept square to F
function blendHand(a, b, g) {
  const F = norm(a.F.map((v, i) => lerp(v, b.F[i], g)));
  const n = a.N.map((v, i) => lerp(v, b.N[i], g)), d = n[0] * F[0] + n[1] * F[1] + n[2] * F[2];
  return { wrist: a.wrist.map((v, i) => lerp(v, b.wrist[i], g)), F, N: norm(n.map((v, i) => v - d * F[i])) };
}
// a toy's hand hanging at its side (its rest pose), body space
const SIDE = { L: { wrist: mm([23, 36.6, 2.2]), F: [0, -1, 0], N: [-1, 0, 0] }, R: { wrist: mm([-23, 36.6, 2.2]), F: [0, -1, 0], N: [1, 0, 0] } };
// where the Duo puts Tim's hand on it (as src/rig.js solves the hold), body space
function gripTarget(ph, n) {
  const P = trs(ph.p, ph.q), g = grip(n, ph.along, ph.gripZ), hq = qMul(P.q, halfQ(n, ph.phi));
  const contact = apply(P, qRot(halfQ(n, ph.phi), g.contact));
  const F = qRot(hq, g.F), N = qRot(hq, g.N);
  return { wrist: contact.map((v, i) => v - N[i] * ARM_M.half - F[i] * ARM_M.palm), F, N };
}
const phoneFrame = (t) => { const ph = phoneHeld(t); return mulT(TIM_ROOT(t), trs(ph.p, ph.q)); };
// Jobs's hands on the shut Duo: one on each face of its far end, fingers toward
// Tim and a little up (world space). Phone -x faces his left hand.
function receiveTarget(t, side) {
  const P = phoneFrame(t), s = side === "L" ? -1 : 1;
  const contact = apply(P, mm([s * 2.75, 10, 15]));
  const N = qRot(P.q, [-s, 0, 0]), F = norm(qRot(P.q, [0, 0.45, -1]));
  return { wrist: contact.map((v, i) => v - N[i] * ARM_M.half - F[i] * ARM_M.palm), F, N };
}
// where he looks: up at the big screen, then at Steve Jobs walking on
const SCREEN_C = fromStage([0, T.SET.screen.y + T.SET.screen.h * 0.57, T.SET.screen.z]);
function lookTarget(t) {
  return mix3(SCREEN_C, jobsHead(t), smooth(seg(t, EV.open + 0.1, EV.open + 1.3)));
}
// head turn (yaw, pitch) in a toy's body space (root R) toward a world point
function headAim(R, target) {
  const eye = apply(R, mm([0, 112, 8]));
  const d = qRot([-R.q[0], -R.q[1], -R.q[2], R.q[3]], target.map((v, i) => v - eye[i]));
  return { yaw: clamp(Math.atan2(d[0], d[2]), -0.6, 0.6), pitch: clamp(-Math.atan2(d[1], Math.hypot(d[0], d[2])), -0.45, 0.45) };
}
function exprAt(t) {
  const keys = [
    [0, "calm"], [EV.d8 + 1.2, "focus"], [EV.news + 0.6, "surprised"], [EV.portrait + 0.4, "moved"],
    [EV.flicker, "surprised"], [EV.gone + 0.6, "moved"], [EV.open + 0.3, "surprised"], [EV.walk0 + 3.5, "moved"],
    [EV.remember, "surprised"], [EV.fold9 + 0.1, "strain"], [EV.done + 0.05, "happy"], [EV.timWalk0, "gentle"], [EV.take, "happy"],
  ];
  let e = keys[0][1];
  for (const [k, v] of keys) if (t >= k) e = v;
  return e;
}
export function timPose(t) {
  const f = folds(t);
  const phi = foldPhi(f.phase);
  const aim = headAim(TIM_ROOT(t), lookTarget(t));
  // a beat of looking down at the phone while it shuts on the last nine
  const down = t > EV.fold9 && t < EV.done ? 0.25 : 0;
  // nodding back to Jobs's nod
  const nod = 0.16 * Math.sin(Math.PI * seg(t, EV.nod + T.BEAT, EV.nod + T.BEAT + 1.0));
  const head = qMul(yawQ(aim.yaw), qAxis([1, 0, 0], aim.pitch + down + nod));
  const chest = qMul(qAxis([1, 0, 0], -0.05), yawQ(aim.yaw * 0.25));
  // walking over, or the step round to Jobs: the toy's walk below the waist
  // (his arms stay on the phone)
  const wk = seg(t, EV.timWalk0 - 0.1, EV.timWalk1 + 0.1), tn = seg(t, TURN[0], TURN[1]);
  const walk = wk > 0 && wk < 1
    ? toyWalk(smooth(seg(t, EV.timWalk0, EV.timWalk1)) * 2 * 2 * Math.PI, Math.sin(Math.PI * wk) ** 0.5)
    : toyWalk(smooth(tn) * 2 * Math.PI, tn > 0 && tn < 1 ? 0.5 * Math.sin(Math.PI * tn) : 0);
  void phi;
  const phone = phoneHeld(t);
  const pose = {
    expr: exprAt(t),
    joints: { legL: walk.legL, legR: walk.legR, hips: walk.hips, head: { q: head }, chest: { q: qMul(chest, walk.chest.q) } },
    phone,
  };
  // he lets go once it is in Jobs's hands, his own back down at his sides
  const r = smooth(seg(t, EV.release, EV.release + 0.9));
  if (r > 0) pose.reach = Object.fromEntries(["L", "R"].map((n) => [n, blendHand(gripTarget(phone, n), SIDE[n], r)]));
  return pose;
}
// where the Duo changes hands: its far end, between Jobs's hands (world)
function handoverPoint(t) {
  return apply(phoneFrame(t), mm([0, 13, 15]));
}

export { jobsRoot, TIM_ROOT, handoverPoint };
// ── Steve Jobs (the toy, src/jobs.js) ─────────────────────────────────────
// He walks on from the wing: from behind the left leg (SET.wing) along a curve
// to his mark facing Tim, past the leg's edge on "again" (EV.open), at a steady
// pace that eases onto the mark at EV.walk1. Stage space x, z.
const JOBS_STEP = 0.026; // his step in to meet Tim
const STRIDE = { swing: 0.55, cycle: 0.0586 }; // two steps of 2·28·sin(0.55) mm
const PATH = (() => {
  const m = toStage(T.JOBS.mark), h = toStage([Math.sin(T.JOBS.yaw), 0, Math.cos(T.JOBS.yaw)]);
  const [ax, az] = T.SET.wing.from, L = Math.hypot(m[0] - ax, m[2] - az);
  const p0 = [ax, az], m0 = [L, 0], p1 = [m[0], m[2]], m1 = [h[0] * L, h[2] * L];
  const pts = [], s = [0];
  for (let i = 0; i <= 400; i++) {
    const u = i / 400, u2 = u * u, u3 = u2 * u;
    const c = [2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2];
    pts.push([0, 1].map((k) => c[0] * p0[k] + c[1] * m0[k] + c[2] * p1[k] + c[3] * m1[k]));
    if (i) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, s, L: s[400] };
})();
// the point and the heading a distance d along it
function onPath(d) {
  const { pts, s } = PATH;
  let i = 1;
  while (i < 400 && s[i] < d) i++;
  const k = clamp((d - s[i - 1]) / (s[i] - s[i - 1])), a = pts[i - 1], b = pts[i];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { p: [lerp(a[0], b[0], k), lerp(a[1], b[1], k)], dir: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
}
// distance walked: the pace (0..1) eases up as he sets off, unseen behind the
// leg, and down onto the mark; he sets off (t0) so he passes the leg's edge on EV.open
const WALK = (() => {
  const DT = 1 / 300;
  const pace = (t, t0) => smooth(seg(t, t0, t0 + 0.7)) * (1 - smooth(seg(t, EV.walk1 - 1.4, EV.walk1)));
  const table = (t0) => {
    const v = [0];
    for (let t = t0; t < EV.walk1; t += DT) v.push(v[v.length - 1] + pace(t + DT / 2, t0) * DT);
    return v;
  };
  const edge = PATH.s[PATH.pts.findIndex((p) => p[0] >= T.SET.wing.edge)];
  let lo = EV.gone - 4, hi = EV.open - 0.8;
  for (let i = 0; i < 40; i++) {
    const t0 = (lo + hi) / 2, v = table(t0);
    v[Math.round((EV.open - t0) / DT)] / v[v.length - 1] * PATH.L > edge ? (lo = t0) : (hi = t0);
  }
  const t0 = (lo + hi) / 2, v = table(t0), k = PATH.L / v[v.length - 1];
  const dist = (t) => {
    const i = clamp((t - t0) / DT, 0, v.length - 1), j = Math.min(Math.floor(i), v.length - 2);
    return lerp(v[j], v[j + 1], i - j) * k;
  };
  return { t0, dist, pace: (t) => pace(t, t0) };
})();
export const jobsSetsOff = WALK.t0;
function jobsRoot(t) {
  const a = onPath(WALK.dist(t)), step = JOBS_STEP * smooth(seg(t, EV.jobsStep, EV.jobsStep + 0.6));
  const p = fromStage([a.p[0] + a.dir[0] * step, 0, a.p[1] + a.dir[1] * step]);
  const f = fromStage([a.dir[0], 0, a.dir[1]]);
  return trs(p, yawQ(Math.atan2(f[0], f[2])));
}
// a toy's walk: the legs swing from the hips, the arms against them, a bob and a sway
function toyWalk(ph, amt, swing = 0.42) {
  const sw = Math.sin(ph) * swing * amt;
  return {
    legL: { q: qAxis([1, 0, 0], -sw) },
    legR: { q: qAxis([1, 0, 0], sw) },
    armL: { q: qMul(qAxis([0, 0, 1], 0.08 * amt), qAxis([1, 0, 0], sw * 0.9)) },
    armR: { q: qMul(qAxis([0, 0, 1], -0.08 * amt), qAxis([1, 0, 0], -sw * 0.9)) },
    chest: { q: qAxis([0, 0, 1], 0.05 * Math.sin(ph) * amt) },
    hips: { t: mm([0, Math.abs(Math.sin(ph)) * 2.2 * amt, 0]) },
  };
}
export function jobsPose(t) {
  const walking = t > WALK.t0 && t < EV.walk1;
  // the one step in to meet Tim: half a stride
  const st = seg(t, EV.jobsStep, EV.jobsStep + 0.6);
  const joints = walking
    ? toyWalk((WALK.dist(t) / STRIDE.cycle) * 2 * Math.PI, WALK.pace(t) ** 0.5, STRIDE.swing)
    : toyWalk(smooth(st) * Math.PI, st > 0 && st < 1 ? Math.sin(Math.PI * st) * 0.6 : 0);
  // walking on, he looks over at Tim
  const aim = headAim(jobsRoot(t), apply(TIM_ROOT(t), mm([0, 112, 0])));
  joints.head = { q: yawQ(aim.yaw * smooth(seg(t, EV.open - 0.4, EV.open + 0.8))) };
  const looking = t > EV.lookDown + 0.3 && t < EV.lookUp + 0.4;
  const pose = { joints, expr: looking ? "gentle" : t > EV.take + 0.3 ? "happy" : t > EV.done ? "gentle" : "calm" };
  const c = smooth(seg(t, EV.chin, EV.chin + 1.0));
  if (c > 0) {
    // the right hand to the chin, as in the portrait
    const v = (a, b) => a.map((x, i) => lerp(x, b[i], c));
    pose.reach = { R: { wrist: mm(v([-23, 36.6, 2.2], [-6.5, 76, 26])), F: norm(v([0, -1, 0], [0.35, 0.55, 0.76])), N: norm(v([1, 0, 0], [0.25, -0.75, 0.6])), pole: [-0.6, -0.5, -0.3] } };
    pose.joints.head = { q: qAxis([1, 0, 0], -0.06 * c) };
  }
  // then both hands onto the Duo Tim holds out, the right from his chin, the
  // left from his side; his head comes up to Tim's face
  const g = smooth(seg(t, EV.take, EV.take + 0.6));
  if (g > 0) {
    const J = jobsRoot(t).p;
    const local = (h) => ({ ...h, wrist: h.wrist.map((v, i) => v - J[i]) });
    const chin = { wrist: mm([-6.5, 76, 26]), F: norm([0.35, 0.55, 0.76]), N: norm([0.25, -0.75, 0.6]) };
    pose.reach = {
      R: { ...blendHand(chin, local(receiveTarget(t, "R")), g), pole: [-0.6, -0.4, -0.2] },
      L: { ...blendHand(SIDE.L, local(receiveTarget(t, "L")), g), pole: [0.75, -0.45, -0.3] },
    };
    // down at the Duo in his hands, then up at Tim
    const look = smooth(seg(t, EV.lookDown, EV.lookDown + 0.9)) * (1 - smooth(seg(t, EV.lookUp, EV.lookUp + 0.9)));
    pose.joints.head = { q: qAxis([1, 0, 0], lerp(-0.06, -0.03, g) + 0.3 * look) };
    pose.joints.chest = { q: qMul(pose.joints.chest?.q ?? [0, 0, 0, 1], qAxis([1, 0, 0], 0.05 * look)) };
  }
  // a nod when Tim reaches 500
  const nod = Math.sin(Math.PI * seg(t, EV.done + 0.1, EV.done + 0.7)) + 0.9 * Math.sin(Math.PI * seg(t, EV.nod, EV.nod + 1.1));
  if (nod > 0) pose.joints.head = { q: qMul(pose.joints.head?.q ?? [0, 0, 0, 1], qAxis([1, 0, 0], 0.18 * nod)) };
  return pose;
}
export function jobsHead(t) {
  return apply(jobsRoot(t), mm([0, 112, 5]));
}

// ── lights ─────────────────────────────────────────────────────────────────
// the stage lights dim through the news and go out as the big screen dies:
// black. Then it comes up purple, the follow spot strikes, "iPhone Duo"; the stage
// comes back up a little once he is on, and full for the last pull out.
export function lightsAt(t) {
  const studio = lerp(1, 0.55, smooth(seg(t, EV.news, EV.portrait))) * lerp(1, 0.003, smooth(seg(t, EV.flicker, EV.gone + 0.6)))
    + 0.3 * smooth(seg(t, EV.walk0, EV.walk0 + 4)) + 0.4 * smooth(seg(t, EV.swell, EV.swell + 3));
  // the catchlights in the eyes go out with the screen and come back with it
  const glint = 1 - smooth(seg(t, EV.off, EV.gone + 0.3)) * (1 - smooth(seg(t, EV.light0, EV.light0 + 1.2)));
  // the big screen: its feed (build/tv) until it dies, then the slide; its rig
  // (the beams, the lamps overhead) dims with the news and goes out with it
  const screen = smooth(seg(t, EV.light0, EV.light0 + 1.2)) * lerp(1, 1.15, smooth(seg(t, EV.swell, EV.swell + 3)));
  const rig = lerp(1, 0.6, smooth(seg(t, EV.news, EV.portrait))) * (1 - smooth(seg(t, EV.flicker, EV.gone))) + screen;
  const feed = t < EV.gone ? 1 : 0;
  const word = smooth(seg(t, EV.walk0, EV.walk0 + 0.8));
  const spot = smooth(seg(t, EV.line, EV.line + 0.1));
  // the iPhone 4S: out of the dark after the cut; its screen on from the wake to the lock
  const phoneKey = smooth(seg(t, EV.black + 0.15, EV.black + 1.2));
  const phone = smooth(seg(t, EV.wake, EV.wake + 0.3)) * (1 - smooth(seg(t, EV.lock, EV.lock + 0.12)));
  return { studio, glint, rig, screen, feed, word, spot, phone, phoneKey };
}
// the follow spot at the back of the house: it strikes the empty stage at the
// leg's edge, he walks into it and it follows him (an operator's lag); when
// he and Tim meet it opens out to hold them both. → its transform, its cone (deg)
const SPOT_P = fromStage(T.SET.spot);
export function spotAt(t) {
  const jobs = apply(jobsRoot(Math.max(t - 0.25, EV.open + 2.0)), mm([0, 70, 0]));
  const both = mix3(jobs, apply(TIM_ROOT(t), mm([0, 70, 0])), 0.5);
  const k = smooth(seg(t, EV.timWalk0, EV.give));
  return { tr: lookAt(SPOT_P, mix3(jobs, both, k)), size: lerp(3.6, 6.4, k) };
}

// ── camera ─────────────────────────────────────────────────────────────────
function orbit(target, az, el, dist) {
  const a = az, e = el;
  const pos = [target[0] + dist * Math.sin(a) * Math.cos(e), target[1] + dist * Math.sin(e), target[2] + dist * Math.cos(a) * Math.cos(e)];
  return lookAt(pos, target);
}
export function lookAt(pos, target, roll = 0) {
  const z = norm(pos.map((v, i) => v - target[i]));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  let q = qFromBasis(x, y, z);
  if (roll) q = qMul(q, qAxis([0, 0, 1], roll));
  return trs(pos, q);
}
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const deg = Math.PI / 180;

// every shot is from the house's side of the line between them (world −x), so
// Tim is on the right, Jobs on the left. Framings in stage space: [position, target]
// a move between two framings
const glide = (a, b, e) => lookAt(fromStage(mix3(a[0], b[0], e)), fromStage(mix3(a[1], b[1], e)));
const focusOn = (tr, p) => Math.hypot(...tr.p.map((v, i) => v - p[i]));
// behind Tim, high, the big screen over his shoulder; behind him, lower, all
// of him and the count at his feet before the whole screen (creeping in as it dies)
const OPEN = [[0.1, 0.3, 1.45], [-0.1, 0.24, -0.5]];
const LOW = [[0.04, 0.24, 1.3], [-0.12, 0.2, -0.5]];
const LOW_IN = [[0.045, 0.235, 1.24], [-0.12, 0.2, -0.5]];
// the house's view of the whole stage, over the heads of the front rows
const HOUSE = [[0.03, 0.26, 1.7], [-0.08, 0.17, -0.25]];
// the big screen filling the frame square on, its subtitles in, a slow push while it plays
const SCREEN_MID = [0, T.SET.screen.y + T.SET.screen.h / 2, T.SET.screen.z];
const full = (k) => [[0, SCREEN_MID[1], SCREEN_MID[2] + lerp(1.22, 1.17, k)], SCREEN_MID];

// the last nine and the handing over, one move with no cuts: from the side as
// Tim folds the last nine; down and in as he walks over, onto the Duo between
// them as he holds it out; slowly in through their look and the nods; a
// breath, then back and round over the stage to the house as it comes up full,
// the two of them small under "iPhone Duo". [time, camera position and target
// (world), tangent: "hold" (at rest) | "on" (into the next key's pace)]
let LAST;
function lastKeys() {
  const tim = apply(TIM_ROOT(EV.timWalk0), mm([0, 80, 0])), jb = apply(jobsRoot(EV.remember), mm([0, 80, 0]));
  const side = mix3(tim, jb, 0.45).map((v, i) => v + (i === 1 ? 0.04 : 0));
  const hp = handoverPoint(EV.take + 0.6), duo = [hp[0], hp[1] + 0.018, hp[2]];
  const nine = (k) => [...orbit(side, lerp(-76, -70, k) * deg, 24 * deg, lerp(0.56, 0.52, k)).p, ...side];
  const hand = (k) => [...orbit(duo, -90 * deg, lerp(9, 6, k) * deg, lerp(0.38, 0.32, k)).p, ...duo];
  const house = [...fromStage([0.03, 0.27, 1.5]), ...fromStage([-0.01, 0.21, -0.2])];
  return [
    [EV.remember, nine(0)],
    [EV.timWalk0, nine(1)],
    [EV.give + 0.15, hand(0), "on"],
    [EV.lookUp - 0.6, hand(1)],
    [EV.nod + 0.5, hand(1.25), "hold"],
    [EV.black, house],
  ];
}
// cubic Hermite through [time, values, tangent] keys: at rest at the ends and
// at "hold", into the next key's pace at "on", else Catmull-Rom
function hermite(keys, t) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const slope = (j) => {
    const [, v, mode] = keys[j];
    if (j === 0 || j === n - 1 || mode === "hold") return v.map(() => 0);
    const [a, b] = mode === "on" ? [j, j + 1] : [j - 1, j + 1];
    return v.map((_, c) => (keys[b][1][c] - keys[a][1][c]) / (keys[b][0] - keys[a][0]));
  };
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0, u = (t - t0) / h;
  const m0 = slope(i), m1 = slope(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  return p0.map((v, c) => h00 * v + h10 * h * m0[c] + h01 * p1[c] + h11 * h * m1[c]);
}

// when the count over Tim has left the frame on the way down to the handing
// over (it goes then, unseen)
let COUNT_OFF;
export function countOff() {
  if (COUNT_OFF !== undefined) return COUNT_OFF;
  // the lettering turns to the camera: its extent about COUNTER.p (m, with a
  // margin) is the same in the camera's x and y
  const tan = Math.tan((26 * deg) / 2), X = [-0.05, 0.06], Y = [-0.015, 0.025];
  for (let t = EV.done; t < EV.give; t += 1 / T.FPS) {
    const { p, q } = cameraAt(t).tr;
    const [x, y, z] = qRot([-q[0], -q[1], -q[2], q[3]], T.COUNTER.p.map((v, i) => v - p[i]));
    const w = tan * -z, h = w * (16 / 9);
    const seen = -z > 0 && x + X[1] > -h && x + X[0] < h && y + Y[1] > -w && y + Y[0] < w;
    if (!seen) return (COUNT_OFF = t);
  }
  throw new Error("the count never leaves the frame before the handing over");
}

export function cameraAt(t) {
  const s = T.shotAt(t), k = (t - s.start) / (s.end - s.start);
  if (s.name === "main") {
    const { push, pull, back } = T.MOVE;
    const tim = apply(TIM_ROOT(t), mm([0, 100, 0])), scr = fromStage(SCREEN_MID);
    // sharp on the screen, Tim a little soft before it
    const between = (tr) => lerp(focusOn(tr, tim), focusOn(tr, scr), 0.6);
    let tr, focus, fstop = 8;
    if (t < push[1]) {
      // behind Tim, then in until the screen fills the frame
      const e = smooth(seg(t, push[0], push[1]));
      tr = glide(OPEN, full(0), e);
      focus = lerp(between(tr), focusOn(tr, scr), e);
    } else if (t < pull[0]) {
      tr = glide(full(0), full(1), seg(t, push[1], pull[0]));
      focus = focusOn(tr, scr);
      fstop = 5.6;
    } else if (t < pull[1]) {
      // the portrait: back out and down behind him
      const e = smooth(seg(t, pull[0], pull[1]));
      tr = glide(full(1), LOW, e);
      focus = lerp(focusOn(tr, scr), between(tr), e);
      fstop = 11;
    } else if (t < back[0]) {
      tr = glide(LOW, LOW_IN, smooth(seg(t, pull[1], back[0])));
      focus = between(tr);
      fstop = 11;
    } else {
      // out over the house to its view of the stage, the "stage" shot's first framing
      const e = smooth(seg(t, back[0], back[1]));
      tr = glide(LOW_IN, HOUSE, e);
      focus = lerp(between(tr), focusOn(tr, tim), e);
      fstop = lerp(11, 8, e);
    }
    return { tr, fov: 26, focus, fstop };
  }
  // a toy's eyes (the surface of its face), for the close-ups' focus
  const eyes = (R) => apply(R, mm([0, 108, 31]));
  if (s.name === "stage") {
    // the house's view as Jobs steps into the light (a breath after the pull
    // back), then in, slowly, over Tim's shoulder as he comes to him; the
    // focus passes from Tim to him
    const e = smooth(seg(t, s.start + 0.6, s.end));
    const tr = glide(HOUSE, [[0.32, 0.2, 0.9], [-0.12, 0.155, -0.2]], e);
    const f = smooth(seg(t, s.start, s.start + 1.5));
    return { tr, fov: 26, focus: lerp(focusOn(tr, apply(TIM_ROOT(t), mm([0, 100, 0]))), focusOn(tr, jobsHead(t)), f), fstop: 8 };
  }
  if (s.name === "timCU") {
    const R = TIM_ROOT(t), head = apply(R, mm([0, 112, 6]));
    const az = T.TIM.yaw + lerp(28, 18, k) * deg, dist = lerp(0.24, 0.2, smooth(k));
    const tr = orbit(head, az, 6 * deg, dist);
    return { tr, fov: 26, focus: focusOn(tr, eyes(R)), fstop: 11 };
  }
  if (s.name === "jobsCU") {
    // his face and the hand at his chin, the light behind him; a slow orbit
    const R = jobsRoot(t), c = apply(R, mm([0, 100, 8]));
    const facing = Math.atan2(qRot(R.q, [0, 0, 1])[0], qRot(R.q, [0, 0, 1])[2]);
    const dist = lerp(0.23, 0.2, smooth(k));
    const tr = orbit(c, facing + lerp(-16, -6, smooth(k)) * deg, lerp(7, 4, k) * deg, dist);
    return { tr, fov: 26, focus: focusOn(tr, eyes(R)), fstop: 11 };
  }
  if (s.name === "last") {
    const v = hermite((LAST ??= lastKeys()), t);
    const tr = lookAt(v.slice(0, 3), v.slice(3));
    const faces = mix3(apply(TIM_ROOT(t), mm([0, 100, 0])), jobsHead(t), 0.5);
    return { tr, fov: 26, focus: focusOn(tr, faces), fstop: lerp(11, 8, smooth(seg(t, EV.done, EV.give))) };
  }
  if (s.name === "phone") {
    // the iPhone 4S, a little from the right and above; in all the way, quickly
    // then slower and slower, from the whole phone to the words on its screen
    const P = T.PHONE.at, e = 1 - (1 - seg(t, EV.black, EV.end)) ** 2.2;
    const at = (v) => P.map((x, i) => x + v[i]);
    const face = PHONE_D / 2, words = at([0, 0.02, face]);
    const tr = lookAt(at(mix3([0.05, 0.03, 0.36], [0.016, 0.03, 0.16], e)), at(mix3([0, 0.002, face], [0, 0.02, face], e)));
    return { tr, fov: 26, focus: focusOn(tr, words), fstop: 8 };
  }
  throw new Error(`no camera for shot ${s.name}`);
}

// the count: at Tim's feet, or over him for the last nine; it turns to face
// the camera of the shot (held still through the moves)
export function counterFrame(t) {
  const s = T.shotAt(t).name, B = T.COUNTER.feet;
  const cam = s === "main" || s === "stage" ? fromStage(LOW[0]) : cameraAt(t).tr.p;
  const [p, size] = s === "last" ? [T.COUNTER.p, 1] : [fromStage(B.p), B.s];
  const d = cam.map((v, i) => v - p[i]);
  const yaw = Math.atan2(d[0], d[2]), pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
  return trs(p, qMul(yawQ(yaw), qAxis([1, 0, 0], -pitch * 0.55)), size);
}

// ── everything at t ────────────────────────────────────────────────────────
export function frameAt(t) {
  const tim = solve(timPose(t), TIM, "tim");
  const jobs = solve(jobsPose(t), JOBS, "jobs");
  return { tim, jobs, timRoot: TIM_ROOT(t), jobsRoot: jobsRoot(t), folds: folds(t), lights: lightsAt(t), spot: spotAt(t), camera: cameraAt(t), shot: T.shotAt(t).name };
}
