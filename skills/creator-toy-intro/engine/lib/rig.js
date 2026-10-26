// The toy's rig: a pose (where its feet are, which way it faces, squash and
// joint angles) → the toy's transform and each part's. The joints are the toy
// line's action contract: body, head, armR / armL (each with a finger /
// fingerL that points), legR / legL, and optional ears. A story only writes
// poses; every toy that keeps the contract can play it.
import { qId, qEuler, qRot, qConj, qFromTo, trs, mulT } from "./quat.js";
import { seg, lerp, easeInOut, TAU, v3, yawTo } from "./math.js";

const MM = 0.001;

// pose: where the feet are, which way it faces, squash, and joint angles
export function basePose(pos) {
  return {
    pos: pos.slice(), yaw: 0, pitch: 0, roll: 0, sy: 1, sxz: 1, flat: 1, pop: 1, show: true, ground: pos[1],
    head: [0, 0, 0], ears: [0, 0, 0], body: [0, 0, 0],
    armR: [0, 0, -0.12], armL: [0, 0, 0.12], aimR: null, aimL: null, reachR: 1, reachL: 1,
    legR: [0, 0, 0], legL: [0, 0, 0], pointR: 0, pointL: 0, glint: 0,
  };
}
export const squash = (o, q) => { o.sy -= q; o.sxz += q * 0.5; };
export function landSquash(t, tl, k = 0.22) {
  const l = t - tl;
  if (l < 0 || l > 0.26) return 0;
  const u = l / 0.26;
  return k * Math.exp(-4 * u) * Math.cos(u * Math.PI * 1.6);
}
export function crouch(t, t0, k = 0.14) { // anticipation before a take-off at t0
  const a = t - (t0 - 0.12);
  return a >= 0 && a < 0.12 ? Math.sin((a / 0.12) * Math.PI * 0.5) * k : 0;
}
// a ballistic hop: feet from a to b, apex above the higher end
export function hop(o, t, a, b, t0, t1, apex, opts = {}) {
  const s = seg(t, t0, t1);
  o.pos = v3.lerp(a, b, s);
  o.pos[1] += apex * 4 * s * (1 - s);
  o.yaw = opts.yaw ?? yawTo(a, b);
  const air = Math.sin(Math.PI * s);
  o.sy = 1 + 0.1 * air; o.sxz = 1 - 0.05 * air;
  o.legR = [-0.6 * air, 0, 0]; o.legL = [0.5 * air, 0, 0];
  o.armR = [0.5 * air, 0, -0.5 * air]; o.armL = [0.5 * air, 0, 0.5 * air];
  if (opts.flip) o.pitch = -TAU * easeInOut(s);
  o.ground = Math.min(a[1], b[1]);
  return s;
}

function eul(v) { return qEuler(v[0], v[1], v[2]); }
// the toy's transform from a pose
export function heroT(o, center) {
  const q = qEuler(o.pitch, o.yaw, o.roll, "YXZ");
  const s = [o.sxz * o.pop, o.sy * o.pop, o.sxz * o.pop * o.flat];
  // pitch / roll turn around the body centre, squash keeps the feet down
  const rc = qRot(q, [center[0] * s[0], center[1] * s[1], center[2] * s[2]]);
  const c = [center[0] * s[0], center[1] * s[1], center[2] * s[2]];
  return trs([o.pos[0] + c[0] - rc[0], o.pos[1] + c[1] - rc[1], o.pos[2] + c[2] - rc[2]], q, s);
}
// arm lengths for reaching (toy.json "rig"; defaults are isnail's toy)
const REACH = { shoulderGap: 0.004, armLength: 0.0205, maxReach: 1.25, handDrop: 0.0204 };
// aim an arm (hanging along -y) at a hero-local target; returns [q, reach]
function aimArm(side, o, hero, aim, joints, R) {
  const sh = joints[side].p;
  let local;
  if (aim.target) local = aim.target.map((v) => v * MM);
  else {
    // world → hero-local (undo the hero transform)
    const d = v3.sub(aim.world, hero.p);
    const r = qRot(qConj(hero.q), d);
    local = [r[0] / hero.s[0], r[1] / hero.s[1], r[2] / hero.s[2]];
  }
  const dir = v3.norm(v3.sub(local, sh));
  const len = v3.len(v3.sub(local, sh));
  const q = qFromTo([0, -1, 0], dir);
  const reach = aim.target ? Math.min(R.maxReach, Math.max(1, (len - R.shoulderGap) / R.armLength)) : aim.len || 1;
  return [q, reach];
}
function slerpBetween(a, b, k) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = b.map((v) => -v); }
  if (d > 0.9995) { const r = a.map((v, i) => v + (bb[i] - v) * k); const l = Math.hypot(...r); return r.map((v) => v / l); }
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => v * Math.sin((1 - k) * th) / s + bb[i] * Math.sin(k * th) / s);
}
const ORDER = ["body", "head", "ears", "armR", "armL", "finger", "fingerL", "legR", "legL"];
// every part's transform (hero-local) from the toy's transform and the pose
export function partsAt(hero, o, toy) {
  const JOINTS = toy.joints, R = { ...REACH, ...toy.rig };
  const J = {};
  const rot = {
    body: eul(o.body), head: eul(o.head), ears: eul(o.ears),
    armR: eul(o.armR), armL: eul(o.armL), legR: eul(o.legR), legL: eul(o.legL), finger: qId(), fingerL: qId(),
    ...Object.fromEntries(Object.keys(o.extra ?? {}).map((j) => [j, eul(o.extra[j])])),
  };
  const reach = { armR: o.reachR, armL: o.reachL };
  for (const side of ["armR", "armL"]) {
    const aim = side === "armL" ? o.aimL : o.aimR;
    if (aim && aim.k > 0) {
      const [q, r] = aimArm(side, o, hero, aim, JOINTS, R);
      // blend from the rest swing to the aim
      rot[side] = slerpBetween(rot[side], q, aim.k);
      reach[side] = lerp(1, r, aim.k);
    }
  }
  // the contract's joints first, then any others the toy has (a tail…), each after its parent
  const rest = Object.keys(JOINTS).filter((j) => !ORDER.includes(j));
  const order = [...ORDER];
  while (rest.length) {
    const k = rest.findIndex((j) => !JOINTS[j].parent || order.includes(JOINTS[j].parent));
    if (k < 0) throw new Error(`toy joints ${rest.join(", ")}: parent missing`);
    order.push(...rest.splice(k, 1));
  }
  for (const j of order) {
    const spec = JOINTS[j];
    if (!spec) continue; // ears and fingers are optional
    const parent = spec.parent ? J[spec.parent] : trs([0, 0, 0]);
    const pp = spec.parent ? JOINTS[spec.parent].p : [0, 0, 0];
    let off = v3.sub(spec.p, pp);
    if (spec.parent === "armR" || spec.parent === "armL") off = [off[0], off[1] * reach[spec.parent], off[2]];
    J[j] = mulT(parent, trs(off, rot[j] ?? qId())); // a joint the story does not pose stays at rest
  }
  const pointK = { finger: o.pointR, fingerL: o.pointL };
  return toy.parts.map((p) => {
    const g = p.group;
    let off = v3.sub(p.pos, JOINTS[g].p);
    let s = [1, 1, 1];
    if (g === "armR" || g === "armL") {
      // stretch the sleeve towards the hand, keep the mitten round
      if (p.name.startsWith("sleeve")) { off = [off[0], off[1] * reach[g], off[2]]; s = [1, reach[g], 1]; }
      else off = [off[0], off[1] + (reach[g] - 1) * -R.handDrop, off[2]];
    }
    if (g === "finger" || g === "fingerL") {
      const k = pointK[g];
      s = [lerp(0.55, 1, k), lerp(0.12, 1, k), lerp(0.55, 1, k)];
      off = [off[0], off[1] * lerp(0.1, 1, k), off[2] * lerp(0.4, 1, k)];
    }
    return mulT(J[g], trs(off, p.rot ? qEuler(...p.rot) : qId(), s));
  });
}
