// Every moving thing's state at film time t, as plain numbers.
// scripts/export-anim.mjs samples it twice a frame for Blender. World space is
// Three.js-style: metres, +y up, +z toward the viewer's (south) edge of the
// desk; 1 UI px = 1 mm, UI centre at the origin. Transforms are { p, q, s }.
import * as T from "./timeline.js";
import { CLAWD_PARTS, WHALE_PARTS, CLAWD_BEADS, WHALE_BEADS, PIVOTS, CENTER, TOP, FRONT, MOUTH, BLOWHOLE, COLORS, SPLIT_NONE, TITLE_TEXT } from "./hero.js";
import { GLYPHS } from "./glyphs.js";
import { mulberry32 } from "./rng.js";
import { qId, qMul, qAxis, qEuler, qRot, qSlerp, qFromTo, qFromBasis, trs, apply, mulT, relT } from "./quat.js";

export const MM = 0.001;
export const SLAB_T = 0.008;
export const HIDDEN = 1e-4;
export const wx = (px) => (px - T.UI_W / 2) * MM;
export const wz = (py) => (py - T.UI_H / 2) * MM;
export const P = (spot, h = 0) => {
  const s = typeof spot === "string" ? T.SPOT[spot] : spot;
  return [wx(s[0]), h * MM, wz(s[1])];
};

const clamp01 = (a) => Math.min(1, Math.max(0, a));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (a) => a * a * (3 - 2 * a);
const lerp = (a, b, s) => a + (b - a) * s;
const easeOut = (a) => 1 - Math.pow(1 - a, 3);
const easeInOut = (a) => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
const TAU = Math.PI * 2;
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  lerp: (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};
export { v3 };
export const lerpAngle = (a, b, s) => {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * s;
};
const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);
const hidden = (p) => trs(p.slice(), qId(), HIDDEN);

// ── Slow motion: the last 3 frames before the two big hits play at 0.3x ─────
const SLOWMO = [T.EV.hit, T.EV.contact];
export function tau(t) {
  for (const H of SLOWMO) {
    if (t > H - 0.3 && t < H) {
      if (t < H - 0.1) return lerp(H - 0.3, H - 0.03, (t - (H - 0.3)) / 0.2);
      return lerp(H - 0.03, H, (t - (H - 0.1)) / 0.1);
    }
  }
  return t;
}

// ── Shared beats ────────────────────────────────────────────────────────────
const onBeat = (t, w = 0.14) => {
  const d = ((t % T.BEAT) + T.BEAT) % T.BEAT;
  return d < w ? Math.sin((d / w) * Math.PI) : 0;
};
function landSquash(t, tl, k = 0.24) {
  const l = t - tl;
  if (l < 0 || l > 0.24) return 0;
  const u = l / 0.24;
  return k * Math.exp(-4 * u) * Math.cos(u * Math.PI * 1.6);
}
function takeoff(t, t0, k = 0.16) {
  const a = t - (t0 - 0.09);
  return a >= 0 && a < 0.09 ? Math.sin((a / 0.09) * Math.PI) * k : 0;
}
function hopIn(hops, t) {
  for (const h of hops) {
    if (t >= h.t0 && t < h.t1) {
      const s = (t - h.t0) / (h.t1 - h.t0);
      const a = P(h.from, h.fromH || 0), b = P(h.to, h.toH || 0);
      const pos = v3.lerp(a, b, s);
      pos[1] += h.apex * 4 * s * (1 - s);
      return { h, s, pos, a, b, travel: yawTo(a, b) };
    }
  }
  return null;
}
// hop in place (happy bounces)
const bounce = (t, at, dur = 0.18, apex = 0.022) => {
  const s = (t - (at - dur)) / dur;
  return s > 0 && s < 1 ? apex * 4 * s * (1 - s) : 0;
};

// ── Places ──────────────────────────────────────────────────────────────────
const C0 = P("clawd0"), W0 = P("whale0"), CT = P("contact"), REC = P("clawdRecoil");
const K = P("term"), W2 = P("whale2");
const DIR = v3.norm([W2[0] - K[0], 0, W2[2] - K[2]]); // Clawd → whale for the clash
const MID = v3.lerp(K, W2, 0.5);
export const MH = [MID[0], T.CONTACT_H * MM, MID[2]]; // the mid-air collision
const CC = v3.add(MH, [-DIR[0] * FRONT.clawd, -CENTER.clawd[1], -DIR[2] * FRONT.clawd]);
const WC = v3.add(MH, [DIR[0] * FRONT.whale, -CENTER.whale[1], DIR[2] * FRONT.whale]);
const CR = P("clawdR"), WR = P("whaleR");
const CB = P("clawdBtn"), WB = P("whaleBtn"), CBUMP = P("clawdBump"), WBUMP = P("whaleBump");
const FACE = {
  c0: yawTo(C0, W0), w0: yawTo(W0, C0),
  cK: yawTo(K, W2), wK: yawTo(W2, K),
  cR: lerpAngle(yawTo(CR, WR), 0, 0.35), wR: lerpAngle(yawTo(WR, CR), 0, 0.35),
};

// The Accept Both button: proud, pressed, then sunk flush (mm)
export function buttonTop(t) {
  if (t < T.EV.acceptHop[1]) return T.BUTTON_H;
  const press = smooth(seg(t, 15.6, 15.66));
  const sink = smooth(seg(t, 15.75, 16.0));
  return lerp(lerp(T.BUTTON_H, 1.8, press), 0, sink);
}

// ── Clawd ───────────────────────────────────────────────────────────────────
function basePose(pos) {
  return { pos: pos.slice(), yaw: 0, pitch: 0, roll: 0, sy: 1, sxz: 1, armL: 0, armR: 0, finL: 0, finR: 0, tail: 0, blink: 1, dizzy: 0, glow: 0, rigid: false, pop: 1, happy: false };
}
const squashBy = (o, q) => { o.sy -= q; o.sxz += q * 0.5; };

export function clawdPose(t) {
  const E = T.EV;
  const o = basePose(C0);
  if (t < E.dash[0]) {
    const c = smooth(seg(t, 1.6, 2.7));
    o.yaw = lerpAngle(FACE.c0, 0, 0.45 - 0.4 * c);
    squashBy(o, 0.06 * onBeat(t) * (1 - c) + 0.18 * c + 0.08 * Math.sin(seg(t, 2.62, 2.8) * Math.PI * 0.5));
    o.pos[0] += 0.0007 * c * Math.sin(t * 95);
    o.pos[2] += 0.0005 * c * Math.sin(t * 77);
    o.glow = 0.55 * c * (0.75 + 0.25 * Math.sin(t * 30));
    o.armL = o.armR = -0.35 * c;
    if (t > 0.9 && t < 0.99) o.blink = 0.15;
  } else if (t < E.hit) {
    const s = seg(t, E.dash[0], E.hit);
    o.pos = v3.lerp(C0, CT, Math.pow(s, 1.7));
    o.pos[1] += 0.012 * Math.sin(Math.PI * s);
    o.yaw = lerpAngle(lerpAngle(FACE.c0, 0, 0.05), FACE.c0, smooth(clamp01(s * 3)));
    o.pitch = 0.4 * smooth(seg(s, 0, 0.6));
    o.sy = 0.86 + 0.06 * s; o.sxz = 1.08;
    o.glow = 0.6 + 0.4 * s;
    o.armL = o.armR = -0.6;
  } else if (t < 3.6) {
    const h = hopIn(T.CLAWD_HOPS.slice(0, 1), t);
    o.pos = h.pos;
    o.yaw = FACE.c0;
    o.pitch = -0.45 * Math.sin(Math.PI * h.s);
    o.glow = 1.2 * Math.exp(-(t - E.hit) * 8);
    squashBy(o, 0.18 * Math.exp(-(t - E.hit) * 20));
    o.armL = o.armR = 0.9 * Math.sin(Math.PI * h.s);
  } else if (t < E.swipe) {
    o.pos = REC.slice();
    o.yaw = FACE.c0 + 0.3 * Math.sin((t - 3.6) * 30) * Math.exp(-(t - 3.6) * 6);
    squashBy(o, landSquash(t, 3.6) + 0.1 * smooth(seg(t, 3.85, 4.0)));
  } else if (t < E.clawdFly[1]) {
    const h = hopIn(T.CLAWD_HOPS.slice(1, 2), t);
    o.pos = h.pos;
    const e = 1 - Math.pow(1 - h.s, 1.5);
    o.pitch = -4 * Math.PI * e;
    o.roll = 0.5 * Math.sin(Math.PI * h.s);
    o.yaw = lerpAngle(FACE.c0, 0.3, smooth(seg(h.s, 0.6, 1)));
    o.armL = o.armR = 1.2 * Math.sin(Math.PI * Math.min(1, h.s * 1.4));
    o.sy = 1 + 0.12 * Math.sin(Math.PI * h.s); o.sxz = 1 - 0.05 * Math.sin(Math.PI * h.s);
  } else if (t < CLAWD_TERM_LAND) {
    hopsPose(o, t, T.CLAWD_HOPS.slice(2), 0.3);
    squashBy(o, landSquash(t, T.EV.clawdFly[1], 0.3));
  } else if (t < E.enter) {
    o.pos = K.slice();
    o.yaw = lerpAngle(0.25, FACE.cK, smooth(seg(t, 6.95, 7.15)));
    let q = landSquash(t, CLAWD_TERM_LAND, 0.3);
    for (const tk of E.typeKeys) {
      const a = (t - (tk - 0.05)) / 0.1;
      if (a > 0 && a < 1) { o.pos[1] += 0.004 * Math.sin(a * Math.PI); }
      q += landSquash(t, tk, 0.1);
    }
    o.pos[1] += bounce(t, E.enter, 0.18, 0.025);
    squashBy(o, q + takeoff(t, E.enter - 0.18, 0.12));
    o.armL = 0.3 * Math.sin(t * 40); o.armR = -o.armL;
    if (t > 6.5 && t < 6.58) o.blink = 0.15;
  } else if (t < E.clashEnd) {
    o.pos = K.slice();
    const j = t < E.spout ? 0.0004 : 0.0009;
    o.pos[0] += j * Math.sin(t * 83) - DIR[0] * 0.004 * Math.exp(-(t - E.enter) * 9);
    o.pos[2] += j * Math.sin(t * 67) - DIR[2] * 0.004 * Math.exp(-(t - E.enter) * 9);
    o.yaw = FACE.cK;
    o.pitch = -0.12 * smooth(seg(t, E.enter, E.enter + 0.1));
    o.sy = 0.94; o.sxz = 1.03;
    squashBy(o, landSquash(t, E.enter, 0.3));
    o.glow = 0.7 + 0.2 * Math.sin(t * 37);
    o.armL = o.armR = 0.5;
  } else if (t < E.leap) {
    const c = smooth(seg(t, E.clashEnd, E.leap - 0.05));
    o.pos = K.slice();
    o.yaw = FACE.cK;
    o.pitch = -0.12 * (1 - c);
    o.sy = 0.94 - 0.18 * c; o.sxz = 1.03 + 0.08 * c;
    o.glow = 0.4 + 0.3 * c;
    o.armL = o.armR = 0.5 - 1.0 * c;
  } else if (t < E.contact) {
    leapPose(o, t, K, CC, FACE.cK);
  } else if (t < E.explode) {
    freezePose(o, t, CC, DIR, FACE.cK);
  } else {
    afterExplosion(o, t, "clawd");
  }
  return o;
}
const CLAWD_TERM_LAND = T.CLAWD_HOPS[5].t1;

// hop chain: stand facing the next hop, take off, land with a squash
function hopsPose(o, t, hops, toCam) {
  const h = hopIn(hops, t);
  const standYaw = (i) => {
    const n = hops[Math.min(i, hops.length - 1)];
    return lerpAngle(yawTo(P(n.from), P(n.to)), 0, toCam);
  };
  if (h) {
    const i = hops.indexOf(h.h);
    o.pos = h.pos;
    o.yaw = lerpAngle(standYaw(i), lerpAngle(h.travel, 0, 0.2), smooth(clamp01(h.s * 3)));
    if (h.h.flip) o.pitch = TAU * easeInOut(seg(h.s, 0.1, 0.9));
    const st = 0.14 * Math.max(0, 1 - h.s / 0.35) - 0.06 * Math.max(0, (h.s - 0.8) / 0.2);
    o.sy = 1 + st; o.sxz = 1 - st * 0.45;
    o.armL = o.armR = 0.7 * Math.sin(Math.PI * h.s);
    o.finL = o.finR = 0.8 * Math.sin(Math.PI * h.s);
    o.tail = 0.3 * Math.sin(Math.PI * h.s);
  } else {
    let i = hops.findIndex((x) => t < x.t0);
    if (i < 0) i = hops.length;
    const prev = hops[i - 1];
    o.pos = P(prev ? prev.to : hops[0].from);
    o.yaw = standYaw(i);
  }
  let q = 0;
  for (const x of hops) q += takeoff(t, x.t0) + landSquash(t, x.t1);
  squashBy(o, q);
}

function leapPose(o, t, from, to, yaw) {
  const s = seg(t, T.EV.leap, T.EV.contact);
  o.pos = v3.lerp(from, to, smooth(s) * 0.5 + s * 0.5);
  o.pos[1] = to[1] * (1 - Math.pow(1 - s, 2)) + 0.05 * Math.sin(Math.PI * s);
  o.yaw = yaw;
  o.pitch = 0.35 * smooth(seg(s, 0.4, 1));
  o.sy = 1 + 0.14 * (1 - seg(s, 0, 0.35)); o.sxz = 1 - 0.05 * (1 - seg(s, 0, 0.35));
  squashBy(o, takeoff(t, T.EV.leap, 0.2));
  o.glow = 0.7 + 0.5 * s;
  o.armL = o.armR = -0.5; o.finL = o.finR = -0.4; o.tail = 0.3;
}
function freezePose(o, t, at, dir, yaw) {
  const creep = seg(t, T.EV.contact, T.EV.explode);
  o.pos = v3.add(at, v3.scale(dir, 0.002 * creep));
  o.yaw = yaw; o.pitch = 0.35;
  o.sy = 0.9; o.sxz = 1.06;
  o.glow = 1.4 + 0.3 * creep;
  o.armL = o.armR = -0.5; o.finL = o.finR = -0.4; o.tail = 0.3;
}

// After the explosion both bodies share one choreography, mirrored
function afterExplosion(o, t, who) {
  const E = T.EV;
  const isC = who === "clawd";
  const at = isC ? CC : WC, home = isC ? CR : WR, faceAt = isC ? FACE.cK : FACE.wK, faceHome = isC ? FACE.cR : FACE.wR;
  const btn = isC ? CB : WB, bump = isC ? CBUMP : WBUMP, other = isC ? WB : CB;
  const camYaw = isC ? 0.3 : -0.75;
  o.happy = t >= E.buildPassed - 0.05;
  const arm = (v) => { if (isC) { o.armL = o.armR = v; } else { o.finL = o.finR = v; o.tail = Math.max(0, v) * 0.35; } };
  if (t < E.reassemble[0]) {
    const k = smooth(seg(t, 11.6, 12.6));
    o.pos = v3.lerp(at, home, k);
    o.yaw = lerpAngle(faceAt, faceHome, k);
    o.pitch = 0.35 * (1 - k);
    o.rigid = true;
  } else if (t < E.shrug[0]) {
    o.pos = home.slice();
    o.yaw = faceHome;
    o.rigid = t < 13.5;
    const d = t - E.dizzy[0];
    if (d > 0) {
      const env = 1 - 0.6 * seg(t, 13.6, 14.4);
      o.roll = 0.16 * Math.sin(TAU * 1.5 * d + (isC ? 0 : 1.3)) * env;
      o.yaw += 0.25 * Math.sin(TAU * 0.75 * d) * env;
      o.dizzy = 9 * Math.PI * smooth(seg(t, E.dizzy[0], E.dizzy[1]));
    }
  } else if (t < E.acceptHop[0]) {
    o.pos = home.slice();
    const turn = smooth(seg(t, E.shrug[0], E.shrug[0] + 0.15));
    o.yaw = lerpAngle(faceHome, isC ? 0.15 : -0.2, turn);
    const up = smooth(seg(t, 14.42, 14.56)) * (1 - smooth(seg(t, 14.8, 14.95)));
    arm(1.15 * up);
    o.roll = (isC ? 0.13 : -0.13) * up;
    squashBy(o, -0.06 * Math.sin(seg(t, 14.42, 14.6) * Math.PI) + landSquash(t, 14.95, 0.1));
    o.pitch = 0.15 * Math.sin(seg(t, 14.98, 15.15) * TAU);
    o.yaw = lerpAngle(o.yaw, faceHome, smooth(seg(t, 14.95, 15.1)));
  } else if (t < E.acceptHop[1]) {
    const s = seg(t, E.acceptHop[0], E.acceptHop[1]);
    o.pos = v3.lerp(home, btn, s);
    o.pos[1] = lerp(0, T.BUTTON_H * MM, s) + 0.06 * 4 * s * (1 - s);
    o.yaw = lerpAngle(faceHome, lerpAngle(yawTo(home, btn), 0, 0.2), smooth(clamp01(s * 3)));
    const st = 0.14 * Math.max(0, 1 - s / 0.35);
    o.sy = 1 + st; o.sxz = 1 - st * 0.45;
    arm(0.6 * Math.sin(Math.PI * s));
    squashBy(o, takeoff(t, E.acceptHop[0]));
  } else if (t < E.bumpHop[0]) {
    o.pos = btn.slice();
    o.pos[1] = buttonTop(t) * MM;
    o.yaw = lerpAngle(lerpAngle(yawTo(home, btn), 0, 0.2), camYaw, smooth(seg(t, 15.6, 15.9)));
    o.yaw = lerpAngle(o.yaw, yawTo(btn, other), smooth(seg(t, 17.55, 17.72)));
    let q = landSquash(t, E.acceptHop[1], 0.3);
    for (const th of E.happy) { o.pos[1] += bounce(t, th + (isC ? 0 : 0.2)); q += landSquash(t, th + (isC ? 0 : 0.2), 0.14); }
    squashBy(o, q);
    const party = seg(t, 16.3, 16.45) * (1 - seg(t, 17.4, 17.6));
    arm(party * (0.9 + 0.25 * Math.sin(t * 18)));
  } else {
    const s = seg(t, E.bumpHop[0], E.bumpHop[1]);
    const back = v3.add(bump, v3.scale(v3.norm(v3.sub(btn, other)), 0.012));
    o.pos = t < E.bumpHop[1] ? v3.lerp(btn, bump, s) : v3.lerp(bump, back, easeOut(seg(t, E.bumpHop[1], E.bumpHop[1] + 0.25)));
    if (t < E.bumpHop[1]) o.pos[1] += 0.02 * 4 * s * (1 - s);
    o.yaw = lerpAngle(yawTo(btn, other), camYaw, smooth(seg(t, 18.3, 18.6)));
    o.pitch = t < E.bumpHop[1] ? 0.2 * s : 0.2 * (1 - seg(t, 18.0, 18.2));
    squashBy(o, takeoff(t, E.bumpHop[0], 0.12) + landSquash(t, E.bumpHop[1], 0.26));
    const party = seg(t, 18.05, 18.2);
    arm(party * (1.0 + 0.25 * Math.sin(t * 16)));
    squashBy(o, 0.04 * onBeat(t) * seg(t, 18.6, 18.8));
  }
}

// ── The whale ───────────────────────────────────────────────────────────────
export function whalePose(t) {
  const E = T.EV;
  const o = basePose(W0);
  o.finL = 0.25 * Math.sin(TAU * 1.25 * t);
  o.finR = 0.25 * Math.sin(TAU * 1.25 * t + 1);
  o.tail = 0.12 * Math.sin(TAU * 0.625 * t);
  if (t < E.dash[0]) {
    const c = smooth(seg(t, 1.6, 2.7));
    o.yaw = lerpAngle(FACE.w0, 0, 0.3 - 0.25 * c);
    squashBy(o, 0.06 * onBeat(t) * (1 - c) + 0.15 * c);
    o.pos[0] += 0.0006 * c * Math.sin(t * 88);
    o.glow = 0.5 * c * (0.75 + 0.25 * Math.sin(t * 27));
    o.tail += 0.35 * c;
    if (t > 1.15 && t < 1.24) o.blink = 0.15;
  } else if (t < E.hit) {
    o.yaw = lerpAngle(lerpAngle(FACE.w0, 0, 0.05), FACE.w0, smooth(seg(t, E.dash[0], E.dash[0] + 0.15)));
    o.sy = 0.84; o.sxz = 1.1;
    o.tail = 0.4; o.finL = o.finR = -0.3;
    o.glow = 0.5;
  } else if (t < 3.85) {
    o.pos[1] = 0.045 * easeOut(seg(t, E.hit, 3.5));
    o.yaw = FACE.w0;
    o.rigid = true;
  } else if (t < 4.22) {
    o.pos[1] = 0.045 * (1 - Math.pow(seg(t, 3.85, E.swipe), 2));
    o.yaw = FACE.w0 + TAU * easeInOut(seg(t, 3.82, 4.22));
    o.tail = 0.5 * Math.sin(Math.PI * seg(t, 3.85, 4.15));
    o.rigid = t < 3.9;
    squashBy(o, landSquash(t, E.swipe));
  } else if (t < T.WHALE_HOPS[0].t0) {
    const tree = P("tree");
    o.yaw = lerpAngle(FACE.w0, lerpAngle(yawTo(W0, tree), 0, 0.3), smooth(seg(t, 4.22, 4.5)));
    o.pos[1] += bounce(t, 4.4, 0.16, 0.015) + bounce(t, 4.8, 0.16, 0.015);
    squashBy(o, landSquash(t, 4.4, 0.14) + landSquash(t, 4.8, 0.14));
    o.finL = o.finR = 0.5 + 0.3 * Math.sin(t * 20);
  } else if (t < T.WHALE_HOPS[1].t1 + 0.01) {
    hopsPose(o, t, T.WHALE_HOPS, 0.2);
  } else if (t < E.enter) {
    o.pos = W2.slice();
    o.yaw = lerpAngle(lerpAngle(yawTo(P("whale1"), W2), 0, 0.2), lerpAngle(FACE.wK, 0, 0.15), smooth(seg(t, 5.6, 6.1)));
    squashBy(o, landSquash(t, 5.6) + 0.05 * onBeat(t));
    o.roll = 0.1 * Math.sin(TAU * 1.25 * t) * seg(t, 6.5, 6.7);
    if (t > 6.2 && t < 6.29) o.blink = 0.15;
  } else if (t < E.spout) {
    o.pos = W2.slice();
    o.yaw = lerpAngle(lerpAngle(FACE.wK, 0, 0.15), FACE.wK, smooth(seg(t, E.enter, E.enter + 0.2)));
    o.sy = 1 + 0.12 * smooth(seg(t, 7.5, 7.88)) - 0.25 * smooth(seg(t, 7.9, 8.0));
    o.sxz = 1 - 0.04 * smooth(seg(t, 7.5, 7.88)) + 0.12 * smooth(seg(t, 7.9, 8.0));
    o.finL = o.finR = 0.6;
    o.glow = 0.4 * seg(t, 7.5, 8.0);
  } else if (t < E.clashEnd) {
    o.pos = W2.slice();
    o.pos[0] += 0.0008 * Math.sin(t * 71); o.pos[2] += 0.0008 * Math.sin(t * 59);
    o.yaw = FACE.wK;
    o.sy = 0.88 + 0.02 * Math.sin(t * 25); o.sxz = 1.06;
    o.tail = 0.3; o.finL = o.finR = 0.6;
    o.glow = 0.6 + 0.15 * Math.sin(t * 31);
  } else if (t < E.leap) {
    const c = smooth(seg(t, E.clashEnd, E.leap - 0.05));
    o.pos = W2.slice();
    o.yaw = FACE.wK;
    o.sy = 0.88 - 0.12 * c; o.sxz = 1.06 + 0.06 * c;
    o.glow = 0.5;
    o.tail = 0.3 + 0.2 * c; o.finL = o.finR = 0.6 - 1.0 * c;
  } else if (t < E.contact) {
    leapPose(o, t, W2, WC, FACE.wK);
  } else if (t < E.explode) {
    freezePose(o, t, WC, v3.scale(DIR, -1), FACE.wK);
  } else {
    afterExplosion(o, t, "whale");
  }
  return o;
}

// ── Pose → transforms ───────────────────────────────────────────────────────
export function heroT(o, center) {
  const q = qEuler(o.pitch, o.yaw, o.roll, "YXZ");
  const k = o.pop;
  const s = o.rigid ? [k, k, k] : [o.sxz * k, o.sy * k, o.sxz * k];
  const rc = qRot(q, center);
  return trs([o.pos[0] + center[0] - rc[0], o.pos[1] + center[1] - rc[1], o.pos[2] + center[2] - rc[2]], q, s);
}

const HEROES = { clawd: { parts: CLAWD_PARTS, beads: CLAWD_BEADS, pose: clawdPose }, whale: { parts: WHALE_PARTS, beads: WHALE_BEADS, pose: whalePose } };

// The solid toy is away while its beads fly: the whale after the headbutt
// until the Ctrl+Z puts it back, both from the explosion until they reassemble
const WHALE_BACK = T.EV.rewind[1] + 0.01;
const BOOM_BACK = T.EV.reassemble[1] + 0.05;
const backAt = (who, tt) => {
  if (who === "whale" && tt >= T.EV.hit && tt < WHALE_BACK + 0.4) return WHALE_BACK;
  if (tt >= T.EV.explode) return BOOM_BACK;
  return null;
};
export function bodyShown(who, tt) {
  if (who === "whale" && tt >= T.EV.hit && tt < WHALE_BACK) return false;
  return !(tt >= T.EV.explode && tt < BOOM_BACK);
}
// the snap when the toy comes back together: a little swell and a flash
function snapBack(who, tt) {
  const b = backAt(who, tt);
  const d = b === null ? -1 : tt - b;
  return d >= 0 && d < 0.2 ? { pop: 1 + 0.12 * Math.sin((Math.min(d, 0.16) / 0.16) * Math.PI), flash: 0.9 * (1 - d / 0.2) } : { pop: 1, flash: 0 };
}

function partLocal(who, part, o, shown) {
  const g = part.group || "";
  if (g === "happy") shown = shown && o.happy;
  if (g.startsWith("eye")) shown = shown && !o.happy;
  const q0 = qEuler(...(part.rot || [0, 0, 0]), part.order || "XYZ");
  const pv = PIVOTS[who][g];
  if (!pv) return trs(part.pos, q0, shown ? 1 : HIDDEN);
  const isEye = g.startsWith("eye");
  const R = qAxis(pv.axis, (isEye ? o.dizzy : o[g] || 0) * pv.sign);
  const d = qRot(R, v3.sub(part.pos, pv.p));
  const s = shown ? (isEye ? [1, o.blink, 1] : [1, 1, 1]) : [HIDDEN, HIDDEN, HIDDEN];
  return trs(v3.add(pv.p, d), qMul(R, q0), s);
}
export const poseAt = (who, t) => {
  const tt = tau(t);
  const o = HEROES[who].pose(tt);
  o.pop = snapBack(who, tt).pop;
  return o;
};
export const heroCenter = (who, t) => apply(heroT(poseAt(who, t), CENTER[who]), CENTER[who]);
// every part of the toy, relative to the hero
export function heroParts(who, t) {
  const tt = tau(t);
  const o = poseAt(who, t);
  const shown = bodyShown(who, tt);
  return HEROES[who].parts.map((p) => partLocal(who, p, o, shown));
}

// ── Colours: the beads swap mid-air, the body splits ────────────────────────
const SWAP = {};
for (const who of ["clawd", "whale"]) {
  const r = mulberry32(who === "clawd" ? 11 : 12);
  SWAP[who] = HEROES[who].beads.map(() => 11.3 + r() * 0.3);
}
const flash = (d, len = 0.15) => (d >= 0 && d < len ? 1 - d / len : 0);
function beadColor(who, i, t) {
  const b = HEROES[who].beads[i];
  const own = COLORS[b.color];
  if (!b.swap) return { color: own, glow: 0 };
  const out = SWAP[who][i];
  return { color: t >= out && t < T.EV.swapBack[0] ? (who === "clawd" ? COLORS.blue : COLORS.orange) : own, glow: 1.2 * flash(t - out) };
}
// split threshold along the hero's own axis (x for Clawd, z for the whale)
export function splitAt(who, t) {
  if (t < 11.3) return SPLIT_NONE;
  return lerp(0, SPLIT_NONE, smooth(seg(t, T.EV.swapBack[0], T.EV.swapBack[1])));
}

// ── Whale burst at the headbutt and the Ctrl+Z rewind ───────────────────────
const beadHome = (b) => trs(b.pos, qId(), b.r);
let BURST = null;
function burst() {
  if (BURST) return BURST;
  const r = mulberry32(31);
  const o = whalePose(T.EV.hit);
  o.rigid = true; o.pop = 1;
  const H = heroT(o, CENTER.whale);
  const ct = apply(H, CENTER.whale);
  const away = v3.norm([W0[0] - C0[0], 0, W0[2] - C0[2]]);
  BURST = WHALE_BEADS.map((b) => {
    const W = mulT(H, beadHome(b));
    const rad = v3.norm(v3.sub(W.p, ct));
    const sp = 0.25 + 0.35 * r();
    return {
      W,
      v: v3.add(v3.add(v3.scale(rad, sp), v3.scale(away, 0.3 + 0.25 * r())), [0, 0.15 + 0.25 * r(), 0]),
      spin: [r() * 16 - 8, r() * 16 - 8, r() * 16 - 8],
      back: T.EV.rewind[0] + (r() - 0.5) * 0.06,
    };
  });
  return BURST;
}
const DRAG = 5.5;
function burstWorld(b, t) {
  const f = (1 - Math.exp(-DRAG * Math.max(0, t - T.EV.hit))) / DRAG;
  return trs(v3.add(b.W.p, v3.scale(b.v, f)), qMul(qEuler(b.spin[0] * f, b.spin[1] * f, b.spin[2] * f), b.W.q), b.W.s);
}

// ── The explosion: every bead flies, bounces on the slabs, rolls to a stop,
// then flies home. Simulated once at 240 Hz (deterministic). ─────────────────
const SIM_RATE = 240;
function onSlab(x, z) {
  const px = x / MM + T.UI_W / 2, py = z / MM + T.UI_H / 2;
  return Object.values(T.PANELS).some((r) => px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3]);
}
let BOOM = null;
function boom() {
  if (BOOM) return BOOM;
  const r = mulberry32(4242);
  const E = T.EV;
  const steps = Math.round((E.reassemble[0] - E.explode) * SIM_RATE);
  const dt = 1 / SIM_RATE, g = 2.6;
  BOOM = {};
  for (const who of ["clawd", "whale"]) {
    const o = HEROES[who].pose(E.explode);
    o.pop = 1;
    const H = heroT(o, CENTER[who]);
    BOOM[who] = HEROES[who].beads.map((bd) => {
      const W = mulT(H, beadHome(bd));
      const out = v3.norm(v3.sub(W.p, MH));
      const sp = 0.22 + 0.4 * r();
      let v = [out[0] * sp, 0.3 + 0.45 * r() + out[1] * 0.3, out[2] * sp * 0.75];
      let p = W.p.slice();
      let e = [r() * 6, r() * 6, r() * 6], w = [r() * 24 - 12, r() * 24 - 12, r() * 24 - 12];
      let grounded = false;
      const track = [];
      for (let k = 0; k <= steps; k++) {
        track.push([...p, ...qEuler(e[0], e[1], e[2])]);
        v[1] -= g * dt;
        p = v3.add(p, v3.scale(v, dt));
        const floor = onSlab(p[0], p[2]) ? bd.r : -0.6;
        if (p[1] < floor && (floor > 0 ? p[1] > -0.004 : true)) {
          p[1] = floor;
          if (floor < 0) { v = [0, 0, 0]; w = [0, 0, 0]; }
          else if (Math.abs(v[1]) > 0.09) { v = [v[0] * 0.72, -v[1] * 0.42, v[2] * 0.72]; }
          else { v[1] = 0; grounded = true; }
        }
        if (grounded) {
          const k2 = Math.exp(-3.5 * dt); // beads roll a little further than cubes slid
          v = [v[0] * k2, 0, v[2] * k2];
          w = [v[2] / bd.r, 0, -v[0] / bd.r]; // rolling
        }
        e = [e[0] + w[0] * dt, e[1] + w[1] * dt, e[2] + w[2] * dt];
      }
      return { track, r: bd.r, delay: 0.27 * Math.pow(r(), 0.8), apex: 0.05 + 0.06 * r(), phase: r() * TAU };
    });
  }
  return BOOM;
}
const REASSEMBLE_DUR = 0.42;
function boomWorld(b, t) {
  const f = (t - T.EV.explode) * SIM_RATE;
  const i = Math.max(0, Math.min(b.track.length - 2, Math.floor(f)));
  const s = clamp01(f - i);
  const a = b.track[i], c = b.track[i + 1];
  return trs([lerp(a[0], c[0], s), lerp(a[1], c[1], s), lerp(a[2], c[2], s)], qSlerp(a.slice(3), c.slice(3), s), b.r);
}

// every bead of a hero: { local, color, glow } (local = relative to the hero).
// Hidden at its home spot on the body except while the body is away.
export function heroBeads(who, t) {
  const tt = tau(t);
  const o = poseAt(who, t);
  const H = heroT(o, CENTER[who]);
  const E = T.EV;
  const back = backAt(who, tt);
  const fade = back === null ? 0 : 1 - seg(tt, back, back + 0.06);
  return HEROES[who].beads.map((bd, i) => {
    const col = beadColor(who, i, t);
    const home = beadHome(bd);
    let local = trs(bd.pos, qId(), HIDDEN);
    let W = null;
    if (who === "whale" && tt >= E.hit && tt < WHALE_BACK + 0.06) {
      const b = burst()[i];
      W = burstWorld(b, Math.min(tt, b.back));
      if (tt > b.back) {
        const e = easeInOut(seg(tt, b.back, b.back + 0.27));
        const hw = mulT(H, home);
        W = trs(v3.lerp(W.p, hw.p, e), qSlerp(W.q, hw.q, e), hw.s);
      }
    } else if (tt >= E.explode && tt < BOOM_BACK + 0.06) {
      const b = boom()[who][i];
      const ra = E.reassemble[0] + b.delay;
      W = boomWorld(b, Math.min(tt, E.reassemble[0]));
      if (tt > 12.55 && tt < ra) {
        const k = seg(tt, 12.55, 12.8) * 0.0007;
        W.p = v3.add(W.p, [k * Math.sin(tt * 90 + b.phase), Math.abs(k * Math.sin(tt * 70 + b.phase)), k * Math.sin(tt * 80 + b.phase * 2)]);
      }
      if (tt > ra) {
        const s = seg(tt, ra, ra + REASSEMBLE_DUR), e = easeInOut(s);
        const hw = mulT(H, home);
        const apex = b.apex + Math.max(0, -W.p[1]) * 0.3;
        const p = v3.lerp(W.p, hw.p, e);
        p[1] += apex * 4 * s * (1 - s);
        W = trs(p, qSlerp(W.q, hw.q, e), hw.s);
      }
    }
    if (W) {
      local = relT(H, W);
      local.s = local.s.map((v) => Math.max(HIDDEN, v * fade));
    }
    return { local, color: col.color, glow: col.glow };
  });
}

// ── The beam, the spout and the clash ───────────────────────────────────────
const mouth = (t) => apply(heroT(clawdPose(t), CENTER.clawd), MOUTH);
const blowhole = (t) => apply(heroT(whalePose(t), CENTER.whale), BLOWHOLE);
const whaleMid = (t) => apply(heroT(whalePose(t), CENTER.whale), [0, CENTER.whale[1], 0]);
// how far along mouth → whale the beam front / clash point is
export function clashU(t) {
  const E = T.EV;
  if (t < E.enter) return 0;
  if (t < E.spout) return 0.85 * easeOut(seg(t, E.enter, E.spout - 0.05));
  const back = smooth(seg(t, E.spout, E.spout + 0.45));
  return lerp(0.85, 0.5 + 0.05 * Math.sin(TAU * 1.25 * (t - E.spout - 0.45)) * seg(t, 8.45, 8.7), back);
}
export function clashPoint(t) {
  const S = mouth(t);
  return v3.lerp(S, whaleMid(t), clashU(t));
}
const beamOn = (t) => t >= T.EV.enter && t < T.EV.clashEnd;

export function beamCore(t) {
  const E = T.EV;
  const S = mouth(t);
  if (!beamOn(t) && t < E.clashEnd + 0.06) return hidden(S);
  const C = clashPoint(Math.min(t, E.clashEnd));
  const d = v3.sub(C, S), len = Math.max(1e-4, v3.len(d));
  const k = t >= E.clashEnd ? 1 - seg(t, E.clashEnd, E.clashEnd + 0.06) : 1;
  if (k <= 0) return hidden(S);
  const th = (0.0028 + 0.0008 * Math.sin(t * 61)) * k * seg(t, E.enter, E.enter + 0.05);
  return trs(v3.lerp(S, C, 0.5), qFromTo([0, 0, 1], v3.scale(d, 1 / len)), [Math.max(HIDDEN, th), Math.max(HIDDEN, th), len]);
}

const perpBasis = (d) => {
  const a = v3.norm(v3.cross(d, [0, 1, 0]));
  return [a, v3.cross(a, d)];
};
// particle pools: pool slot j shows particles j, j+N, j+2N … (one at a time)
function pool(N, j, t, t0, t1, rate, life) {
  let k = Math.floor((t - t0) * rate);
  k -= ((k - j) % N + N) % N;
  for (; k >= 0; k -= N) {
    const te = t0 + k / rate;
    if (te > t1) continue;
    const age = t - te;
    if (age < 0) continue;
    return age < life ? { k, te, age } : null;
  }
  return null;
}
const rnd = (k, salt) => { const r = mulberry32(k * 977 + salt); r(); return r; };

export const BEAM_N = 44;
export function beamVoxel(j, t) {
  const E = T.EV;
  const S = mouth(t);
  const P0 = pool(BEAM_N, j, t, E.enter, E.clashEnd, 90, 0.6);
  if (!P0) return { tr: hidden(S) };
  const C = clashPoint(t);
  const d = v3.sub(C, S), L = v3.len(d), dir = v3.scale(d, 1 / Math.max(1e-4, L));
  const dist = 1.7 * P0.age;
  if (dist > L || !beamOn(t)) return { tr: hidden(S) };
  const r = rnd(P0.k, 1);
  const [a, b] = perpBasis(dir);
  const ph = r() * TAU, rad = 0.001 + 0.0045 * r();
  const off = v3.add(v3.scale(a, Math.cos(ph + t * 18) * rad), v3.scale(b, Math.sin(ph + t * 18) * rad));
  const size = (0.0045 + 0.003 * r()) * Math.min(1, P0.age / 0.03) * Math.min(1, (L - dist) / 0.02);
  return { tr: trs(v3.add(v3.add(S, v3.scale(dir, dist)), off), qEuler(t * 9 + ph, t * 7, ph), Math.max(HIDDEN, size)), color: r() < 0.2 ? "#FFD2BF" : r() < 0.6 ? "#FF8A5C" : "#D97757" };
}

export const SPOUT_N = 32;
const spoutPath = (B, C, p) => {
  const Q = v3.add(v3.lerp(B, C, 0.25), [0, 0.2, 0]);
  const a = v3.lerp(B, Q, p), b = v3.lerp(Q, C, p);
  return v3.lerp(a, b, p);
};
export function spoutVoxel(j, t) {
  const E = T.EV;
  const B = blowhole(t);
  const t0 = E.spout - 0.25;
  const P0 = pool(SPOUT_N, j, t, t0, E.clashEnd, 80, 0.5);
  if (!P0) return { tr: hidden(B) };
  const C = clashPoint(t < E.spout ? E.spout : t);
  const p = P0.age / 0.32;
  const front = (t - t0) / 0.25;
  if (p > Math.min(1, front) || t >= E.clashEnd) return { tr: hidden(B) };
  const r = rnd(P0.k, 2);
  const pos = spoutPath(B, C, p);
  const ph = r() * TAU, rad = (0.002 + 0.007 * r()) * (0.4 + p);
  pos[0] += Math.cos(ph + t * 11) * rad; pos[2] += Math.sin(ph + t * 11) * rad; pos[1] += Math.sin(ph * 3 + t * 9) * rad * 0.6;
  const size = (0.004 + 0.003 * r()) * Math.min(1, P0.age / 0.03) * Math.min(1, (1 - p) / 0.08);
  return { tr: trs(pos, qEuler(t * 6 + ph, t * 5, ph), Math.max(HIDDEN, size)), color: r() < 0.35 ? "#D6E0FF" : r() < 0.6 ? "#4D6BFE" : "#7F97FF" };
}

export const SPARK_N = 36;
export function sparkVoxel(j, t) {
  const E = T.EV;
  const P0 = pool(SPARK_N, j, t, E.spout, E.clashEnd, 110, 0.32);
  const C0p = clashPoint(E.spout);
  if (!P0) return { tr: hidden(C0p) };
  const r = rnd(P0.k, 3);
  const origin = clashPoint(P0.te);
  const ang = r() * TAU, up = 0.25 + 0.6 * r(), sp = 0.3 + 0.6 * r();
  const a = P0.age;
  const pos = v3.add(origin, [Math.cos(ang) * sp * a, up * a - 1.6 * a * a, Math.sin(ang) * sp * a]);
  const size = (0.0015 + 0.0015 * r()) * (1 - a / 0.32);
  return { tr: trs(pos, qEuler(a * 30, a * 20, ang), Math.max(HIDDEN, size)), color: ["#FFF4D6", "#FF9A72", "#9FB2FF"][Math.floor(r() * 3)] };
}

// one-shot sparks at the hits; at the mid-air contact they hang in bullet time
export const IMPACT_N = 30;
const IMPACTS = [
  { t: T.EV.hit, at: () => apply(heroT(clawdPose(T.EV.hit), CENTER.clawd), [0, CENTER.clawd[1], FRONT.clawd + 0.003]) },
  { t: T.EV.swipe, at: () => apply(heroT(clawdPose(T.EV.swipe), CENTER.clawd), [0.03, CENTER.clawd[1], 0]) },
  { t: T.EV.contact, at: () => MH },
];
export function impactVoxel(j, t) {
  let cur = null;
  for (const im of IMPACTS) if (t >= im.t) cur = im;
  const first = IMPACTS[0].at();
  if (!cur) return { tr: hidden(first) };
  let a = t - cur.t;
  if (cur.t === T.EV.contact) a = Math.min(0.05, a) + Math.max(0, Math.min(a, 0.4) - 0.05) * 0.1 + Math.max(0, a - 0.4);
  const life = 0.38;
  const origin = cur.at();
  if (a > life) return { tr: hidden(origin) };
  const r = rnd(j + IMPACTS.indexOf(cur) * 100, 4);
  const dir = v3.norm([r() * 2 - 1, r() * 1.4 - 0.2, r() * 2 - 1]);
  const sp = 0.4 + 0.7 * r();
  const pos = v3.add(origin, [dir[0] * sp * a, dir[1] * sp * a - 1.2 * a * a, dir[2] * sp * a]);
  const big = cur.t === T.EV.contact ? 0.85 : 1;
  const size = big * (0.0018 + 0.0018 * r()) * (1 - a / life) * Math.min(1, a / 0.01 + 0.5);
  return { tr: trs(pos, qEuler(a * 25, a * 31, r() * 6), Math.max(HIDDEN, size)), color: ["#FFF4D6", "#FFD27A", "#FFFFFF"][Math.floor(r() * 3)] };
}

// ── Code glyphs knocked off the lines ───────────────────────────────────────
export const GLYPH_W = T.CHAR_W * MM;
export const GLYPH_H = T.CHAR_W * 2 * MM;
const FLAT = qEuler(-Math.PI / 2, 0, 0);
export function glyphAt(g, t) {
  const cell = [wx(g.x), 0.0006, wz(g.y)];
  if (t < g.popAt || t >= g.backAt) return hidden(cell);
  const fly = (u) => {
    const f = (1 - Math.exp(-DRAG * u)) / DRAG;
    return trs(v3.add(cell, v3.scale(g.v, f)), qMul(qEuler(g.spin[0] * f * 1.6, g.spin[1] * f * 1.6, g.spin[2] * f * 1.6), FLAT), 1);
  };
  const r0 = T.EV.rewind[0];
  if (t < r0) return fly(t - g.popAt);
  const A = fly(r0 - g.popAt);
  const e = easeInOut(seg(t, r0, g.backAt));
  return trs(v3.lerp(A.p, cell, e), qSlerp(A.q, FLAT, e), 1);
}

// ── The Ctrl+Z keycap ───────────────────────────────────────────────────────
export const KEYCAP = [0.054, 0.012, 0.027];
export function keycapAt(t, camAz) {
  const [t0, t1] = T.EV.ctrlZ;
  const base = v3.add(apply(heroT(poseAt("whale", 3.5), CENTER.whale), CENTER.whale), [0, 0.085, 0]);
  if (t < t0 || t >= t1) return hidden(base);
  const pop = easeOut(seg(t, t0, t0 + 0.08)) * (1 + 0.25 * Math.sin(seg(t, t0, t0 + 0.14) * Math.PI));
  const out = 1 - smooth(seg(t, t1 - 0.07, t1));
  const press = Math.sin(Math.PI * seg(t, T.EV.rewind[0] - 0.02, T.EV.rewind[0] + 0.08));
  const p = v3.add(base, [0, -0.004 * press + 0.003 * Math.sin((t - t0) * 9), 0]);
  return trs(p, qEuler(0.95, camAz, 0, "YXZ"), Math.max(HIDDEN, pop * out));
}

// ── Dizzy stars and the bump's sparkles ─────────────────────────────────────
export function starAt(who, k, t) {
  const [d0, d1] = T.EV.dizzy;
  const o = poseAt(who, t);
  const top = apply(heroT(o, CENTER[who]), [0, TOP[who] + 0.008, who === "whale" ? 0.009 : 0]);
  if (t < d0 || t >= d1) return hidden(top);
  const a = TAU * 1.3 * (t - d0) + (k * TAU) / 3;
  const R = who === "clawd" ? 0.022 : 0.026;
  const s = 0.9 * easeOut(seg(t, d0, d0 + 0.15)) * (1 - smooth(seg(t, d1 - 0.15, d1)));
  return trs(v3.add(top, [Math.cos(a) * R, 0.004 * Math.sin(a * 2), Math.sin(a) * R]), qEuler(0, a * 2, 0.4), Math.max(HIDDEN, s));
}
export const SPARKLE_N = 18;
export function sparkleAt(k, t) {
  const at = T.EV.bumpHop[1];
  const base = v3.add(v3.lerp(CBUMP, WBUMP, 0.5), [0, 0.035, 0]);
  const d = t - at - (k % 6) * 0.02;
  if (d < 0 || d > 0.9) return { tr: hidden(base) };
  const r = rnd(k, 5);
  const ang = r() * TAU, sp = 0.06 + 0.08 * r(), up = 0.08 + 0.12 * r();
  const e = easeOut(d / 0.9);
  const pos = v3.add(base, [Math.cos(ang) * sp * e, up * e - 0.05 * d * d, Math.sin(ang) * sp * e * 0.6]);
  return { tr: trs(pos, qEuler(d * 6, d * 4, ang), Math.max(HIDDEN, Math.sin((d / 0.9) * Math.PI) * 1.3)), color: ["#FF9A72", "#8FA6FF", "#FFFFFF"][k % 3] };
}

// ── The title: solid letters dropping in one by one ─────────────────────────
// Each letter's offset from its slot (Blender lays the slots out by width)
export const TITLE_AT = [1092, 196];
export function titleLetter(i, t) {
  const r = rnd(i, 6);
  const t0 = T.EV.title[0] + 0.08 * i + 0.03 * r();
  const fall = 0.26, top = 0.32;
  if (t < t0) return trs([0, top, 0], qId(), HIDDEN);
  const s = seg(t, t0, t0 + fall);
  const tilt = (1 - s) * (r() - 0.5) * 1.6;
  const l = t - (t0 + fall);
  const q = l > 0 ? 0.2 * Math.exp(-l * 12) * Math.cos(l * 34) : 0;
  return trs([0, top * (1 - s * s), 0], qEuler(tilt * 0.5, tilt * 0.3, -tilt), [1 + q * 0.5, 1 - q, 1 + q * 0.5]);
}
export { TITLE_TEXT };

// ── Panels: still, with jolts on the hits and a rattling minimap ────────────
export const PANEL_BASE = Object.fromEntries(
  Object.entries(T.PANELS).map(([n, r]) => [n, [wx(r[0] + r[2] / 2), 0, wz(r[1] + r[3] / 2)]]),
);
export function panelLocal(name, px, py, y = 0) {
  const b = PANEL_BASE[name];
  return [wx(px) - b[0], y, wz(py) - b[2]];
}
export function panelAt(name, t) {
  const b = PANEL_BASE[name].slice();
  let rx = 0, rz = 0;
  const jolt = (at, k) => {
    const d = t - at;
    if (d < 0 || d > 0.25) return;
    const a = k * Math.exp(-d * 18) * Math.sin(d * 70 + name.length);
    b[1] += a * 0.002; rx += a * 0.002; rz += a * 0.0015;
  };
  jolt(T.EV.hit, name === "editor" ? 1 : 0.3);
  jolt(T.EV.explode, 1);
  jolt(T.EV.spout, 0.4);
  if (name === "minimap" && t > T.EV.spout - 0.05 && t < T.EV.clashEnd + 0.2) {
    const env = seg(t, T.EV.spout - 0.05, T.EV.spout + 0.05) * (1 - seg(t, T.EV.clashEnd, T.EV.clashEnd + 0.2));
    b[0] += env * 0.0018 * Math.sin(t * 97);
    b[1] += env * 0.0012 * Math.abs(Math.sin(t * 61));
    b[2] += env * 0.0015 * Math.sin(t * 83);
    rz += env * 0.006 * Math.sin(t * 71);
    rx += env * 0.004 * Math.sin(t * 53);
  }
  return trs(b, qEuler(rx, 0, rz));
}
export function buttonAt(t) {
  const [x, y, w, h] = T.ACCEPT_BOTH;
  const p = panelLocal("editor", x + w / 2, y + h / 2, buttonTop(t) * MM);
  return trs(p, qId(), t > 16.05 ? HIDDEN : 1);
}

// ── Blob shadows under the fighters ─────────────────────────────────────────
export function blobAt(who, t) {
  const o = poseAt(who, t);
  const E = T.EV;
  const ground = t >= E.acceptHop[1] && t < 16.1 ? buttonTop(t) * MM : 0;
  const hgt = Math.max(0, o.pos[1] - ground);
  let k = clamp01(1 - hgt / 0.16);
  if (t >= E.explode - 0.02 && t < 13.2) k *= seg(t, 12.95, 13.2);
  if (who === "whale" && t >= E.hit && t < 3.9) k *= 1 - seg(t, E.hit, E.hit + 0.05) + seg(t, 3.8, 3.9);
  const [sx, sz] = who === "clawd" ? [0.08, 0.05] : [0.06, 0.1];
  const pos = [o.pos[0], ground + 0.0009, o.pos[2]];
  const s = 1.2 - 0.4 * k;
  return { tr: trs(pos, qEuler(-Math.PI / 2, 0, o.yaw), k > 0.001 ? [sx * s, sz * s, 1] : HIDDEN), opacity: 0.8 * k * k };
}

// ── Lights that the fight throws on the glass ───────────────────────────────
export function lightsAt(t) {
  const E = T.EV;
  const tt = tau(t);
  const cA = { p: MH, color: "#FF9A72", energy: 0 }, cB = { p: MH, color: "#7F97FF", energy: 0 };
  const pulse = (at, k, d = 0.18) => (t >= at ? k * Math.exp(-(t - at) / d) : 0);
  if (tt < E.hit + 0.5) {
    cA.p = v3.add(heroCenter("clawd", t), [0, 0.03, 0.02]);
    cA.energy = 0.12 * clawdPose(tt).glow;
    cB.p = v3.add(heroCenter("whale", t), [0, 0.035, 0.02]);
    cB.energy = 0.12 * whalePose(tt).glow;
    const hit = pulse(E.hit, 1.2, 0.12);
    if (hit > 0.01) { cA.p = v3.add(CT, [0, 0.03, 0.01]); cA.color = "#FFE6D8"; cA.energy = hit; }
  } else if (tt >= E.enter && tt < E.clashEnd + 0.3) {
    const C = clashPoint(Math.min(tt, E.clashEnd));
    const fade = 1 - seg(tt, E.clashEnd, E.clashEnd + 0.3);
    cA.p = v3.add(C, [0, 0.012, 0]);
    cA.energy = (0.35 + 0.12 * Math.sin(t * 53) + pulse(E.spout, 0.9, 0.15)) * fade;
    cA.color = tt < E.spout ? "#FF9A72" : "#FFE6D8";
    if (tt > E.spout - 0.2) {
      cB.p = v3.add(spoutPath(blowhole(tt), C, 0.45), [0, 0.01, 0]);
      cB.energy = 0.3 * seg(tt, E.spout - 0.2, E.spout) * fade;
    }
  } else if (t >= E.contact - 0.05 && t < E.explode + 1.0) {
    cA.p = v3.add(MH, [0, 0.01, 0]);
    cA.color = t < E.explode ? "#FFE6D8" : "#FFD8B8";
    cA.energy = t < E.explode ? 0.45 + pulse(E.contact, 0.6, 0.1) : pulse(E.explode, 3.0, 0.22);
    cB.p = v3.add(MH, [0, -0.02, 0.02]);
    cB.energy = t < E.explode ? 0.25 : pulse(E.explode, 1.2, 0.3);
  } else if (t >= E.bumpHop[1] - 0.05) {
    cA.p = v3.add(v3.lerp(CBUMP, WBUMP, 0.5), [0, 0.06, 0.02]);
    cA.color = "#FFF0E0";
    cA.energy = pulse(E.bumpHop[1], 0.35, 0.3);
  }
  return { fxA: cA, fxB: cB };
}

// ── Camera ──────────────────────────────────────────────────────────────────
function monotone(ts, ys) {
  const n = ts.length;
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
    return (2 * s ** 3 - 3 * s ** 2 + 1) * ys[i] + (s ** 3 - 2 * s ** 2 + s) * h * m[i] + (-2 * s ** 3 + 3 * s ** 2) * ys[i + 1] + (s ** 3 - s ** 2) * h * m[i + 1];
  };
}

function trackerRaw(name, t) {
  if (name === "contact") return MH;
  const c = heroCenter("clawd", t), w = heroCenter("whale", t);
  if (name === "clawd") return c;
  if (name === "whale") return w;
  const pair = v3.lerp(c, w, 0.5);
  if (name === "clash") {
    const tt = tau(t);
    if (tt >= T.EV.enter && tt < T.EV.clashEnd) return v3.lerp(pair, clashPoint(tt), 0.35);
    return pair;
  }
  return pair;
}
const SM_RATE = 120, SM_SIGMA = 0.1;
const TRACK = {};
function tracker(name, t) {
  if (name === "contact") return MH;
  if (!TRACK[name]) {
    const n = Math.ceil(T.DURATION * SM_RATE) + 1;
    const raw = Array.from({ length: n }, (_, i) => trackerRaw(name, i / SM_RATE));
    const sig = SM_SIGMA * SM_RATE, rad = Math.ceil(sig * 3);
    const ker = Array.from({ length: 2 * rad + 1 }, (_, k) => Math.exp(-((k - rad) ** 2) / (2 * sig * sig)));
    TRACK[name] = raw.map((_, i) => {
      let acc = [0, 0, 0], ws = 0;
      for (let k = -rad; k <= rad; k++) {
        const j = Math.min(n - 1, Math.max(0, i + k));
        acc = v3.add(acc, v3.scale(raw[j], ker[k + rad])); ws += ker[k + rad];
      }
      return v3.scale(acc, 1 / ws);
    });
  }
  const arr = TRACK[name];
  const f = clamp01(t / T.DURATION) * (arr.length - 1);
  const i = Math.floor(f);
  return v3.lerp(arr[i], arr[Math.min(i + 1, arr.length - 1)], f - i);
}
const keyTarget = (k, t) => (typeof k.target === "string" ? tracker(k.target, t) : [wx(k.target[0]), k.target[2] * MM, wz(k.target[1])]);
const CAMF = (() => {
  const ts = T.CAMERA.map((k) => k.t);
  const f = (key) => monotone(ts, T.CAMERA.map((k) => k[key]));
  return { ts, dist: f("dist"), elev: f("elev"), az: f("az"), fstop: f("fstop") };
})();
function shakeAt(t) {
  let o = [0, 0, 0];
  for (const [ts, k] of T.SHAKES) {
    const d = t - ts;
    if (d < 0 || d > 0.11) continue;
    const a = k * (1 - d / 0.11) ** 2;
    o = v3.add(o, [0.004 * a * Math.sin(t * 173 + ts), 0.003 * a * Math.sin(t * 211 + 1), 0.004 * a * Math.sin(t * 157 + 2)]);
  }
  return o;
}
export function cameraAt(t) {
  const keys = T.CAMERA.map((k) => keyTarget(k, t));
  const target = [0, 1, 2].map((c) => monotone(CAMF.ts, keys.map((v) => v[c]))(t));
  const el = (CAMF.elev(t) * Math.PI) / 180, az = (CAMF.az(t) * Math.PI) / 180, d = CAMF.dist(t);
  const pos = [target[0] + d * Math.sin(az) * Math.cos(el), target[1] + d * Math.sin(el), target[2] + d * Math.cos(az) * Math.cos(el)];
  const sh = shakeAt(t);
  const eye = v3.add(pos, sh), look = v3.add(target, v3.scale(sh, 0.6));
  const z = v3.norm(v3.sub(eye, look));
  const x = v3.norm(v3.cross([0, 1, 0], z));
  const y = v3.cross(z, x);
  return { tr: trs(eye, qFromBasis(x, y, z)), pos: eye, target, fov: T.FOV, fstop: CAMF.fstop(t), focus: v3.len(v3.sub(pos, target)), az };
}

// material-level glow per fighter (the voxel shader adds it to every cube)
export const glowAt = (who, t) => poseAt(who, t).glow + snapBack(who, tau(t)).flash;
export { GLYPHS };
