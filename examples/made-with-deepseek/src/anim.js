// Every moving thing's state at film time t, as plain numbers. The Three.js
// preview (src/scene.js) applies it to meshes; scripts/export-anim.mjs writes
// it per frame for Blender. Coordinates are the Three.js world: metres, +y up,
// +z toward the viewer's side of the desk; 1 UI px = 1 mm, UI centre at 0,0.
import * as T from "./timeline.js";
import { U, HERO_CENTER, REST_TURN } from "./hero.js";
import { mulberry32 } from "./rng.js";

export const MM = 0.001;
export const SLAB_T = 0.008;
export const BUTTON_T = 0.003;
export const wx = (px) => (px - T.UI_W / 2) * MM;
export const wz = (py) => (py - T.UI_H / 2) * MM;

const clamp01 = (a) => Math.min(1, Math.max(0, a));
const smooth = (a) => a * a * (3 - 2 * a);
const lerp = (a, b, s) => a + (b - a) * s;
const easeOut = (a) => 1 - Math.pow(1 - a, 3);
const easeInOut = (a) => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
const DEG = Math.PI / 180;
export const lerpAngle = (a, b, s) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * s;
};
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  lerp: (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)],
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};
export { v3 };

// Euler (order YXZ, as Three.js applies it) applied to a vector
function rotateYXZ([x, y, z], [rx, ry, rz]) {
  // R = Ry * Rx * Rz
  const cz = Math.cos(rz), sz = Math.sin(rz);
  let x1 = x * cz - y * sz, y1 = x * sz + y * cz, z1 = z;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const y2 = y1 * cx - z1 * sx, z2 = y1 * sx + z1 * cx;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  return [x1 * cy + z2 * sy, y2, -x1 * sy + z2 * cy];
}

// ── Panels ──────────────────────────────────────────────────────────────────
export const PANEL_BASE = Object.fromEntries(
  Object.entries(T.PANELS).map(([n, r]) => [n, [wx(r[0] + r[2] / 2), 0, wz(r[1] + r[3] / 2)]]),
);
export function panelLocal(name, px, py, y = 0) {
  const b = PANEL_BASE[name];
  return [wx(px) - b[0], y, wz(py) - b[2]];
}

// ── The whale's path ────────────────────────────────────────────────────────
export function spotWorld(name, t) {
  if (name === "cti") {
    const x = T.compTimeToX(T.ctiTime(t));
    return [wx(x), T.SURF.ctiHead * MM, wz(T.TL.rulerY)];
  }
  const s = T.SPOTS[name];
  return [wx(s.p[0]), s.h * MM, wz(s.p[1])];
}

export function heroPath(t) {
  if (t < T.HOPS[0].t0) return { pos: spotWorld("comp", t), hop: null, stand: { since: T.EV.pop, at: "comp" } };
  for (let i = 0; i < T.HOPS.length; i++) {
    const h = T.HOPS[i];
    if (t < h.t0) {
      const prev = T.HOPS[i - 1];
      return { pos: spotWorld(h.from, t), hop: null, stand: { since: prev ? prev.t1 : T.EV.pop, at: h.from, prev } };
    }
    if (t < h.t1) {
      const s = (t - h.t0) / (h.t1 - h.t0);
      const a = spotWorld(h.from, h.t0), b = spotWorld(h.to, h.t1);
      const pos = v3.lerp(a, b, s);
      pos[1] += h.apex * 4 * s * (1 - s);
      return { pos, hop: h, s, a, b };
    }
  }
  const last = T.HOPS[T.HOPS.length - 1];
  return { pos: spotWorld(last.to, t), hop: null, stand: { since: last.t1, at: last.to, prev: last } };
}

// smoothed path for the follow camera (precomputed once, deterministic)
const SM_RATE = 240;
const smoothPath = (() => {
  const n = Math.ceil(T.DURATION * SM_RATE) + 1;
  const raw = [];
  for (let i = 0; i < n; i++) {
    const t = i / SM_RATE;
    raw.push(t < T.EV.pop ? spotWorld("comp", t) : heroPath(t).pos);
  }
  const sigma = T.CAMERA_SMOOTH * SM_RATE;
  const rad = Math.ceil(sigma * 3);
  const kernel = [];
  for (let k = -rad; k <= rad; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const out = [];
  for (let i = 0; i < n; i++) {
    let acc = [0, 0, 0], wsum = 0;
    for (let k = -rad; k <= rad; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      acc = v3.add(acc, v3.scale(raw[j], kernel[k + rad]));
      wsum += kernel[k + rad];
    }
    out.push(v3.scale(acc, 1 / wsum));
  }
  return out;
})();
function smoothHero(t) {
  const f = clamp01(t / T.DURATION) * (smoothPath.length - 1);
  const i = Math.floor(f), s = f - i;
  return v3.lerp(smoothPath[i], smoothPath[Math.min(i + 1, smoothPath.length - 1)], s);
}

// ── Camera ──────────────────────────────────────────────────────────────────
// Monotone cubic interpolation over the keyed scalars (no overshoot).
function monotone(ts, ys) {
  const n = ts.length;
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}
const CAM = (() => {
  const ts = T.CAMERA.map((k) => k.t);
  const tgt = T.CAMERA.map((k) => {
    if (k.target) return [wx(k.target[0]), k.target[2] * MM, wz(k.target[1])];
    return v3.add(smoothHero(k.t), [0, 0.024, 0]);
  });
  const f = (key) => monotone(ts, T.CAMERA.map((k) => k[key]));
  return {
    tx: monotone(ts, tgt.map((v) => v[0])), ty: monotone(ts, tgt.map((v) => v[1])), tz: monotone(ts, tgt.map((v) => v[2])),
    dist: f("dist"), elev: f("elev"), az: f("az"), follow: f("follow"), fov: f("fov"), fstop: f("fstop"),
  };
})();
export function cameraAt(t) {
  const keyT = [CAM.tx(t), CAM.ty(t), CAM.tz(t)];
  // follow the whale sideways fully but only partly up, so a leap never loses the UI
  const fol = smoothHero(t + 0.03);
  fol[1] = fol[1] * 0.45 + 0.024;
  const follow = clamp01(CAM.follow(t));
  const target = v3.lerp(keyT, fol, follow);
  const el = CAM.elev(t) * DEG, az = CAM.az(t) * DEG, d = CAM.dist(t);
  const pos = [
    target[0] + d * Math.sin(az) * Math.cos(el),
    target[1] + d * Math.sin(el),
    target[2] + d * Math.cos(az) * Math.cos(el),
  ];
  return { pos, target, fov: CAM.fov(t), fstop: CAM.fstop(t), az, follow };
}

// ── The whale's pose ────────────────────────────────────────────────────────
function yawAtRest(t, faceCam) {
  const P = heroPath(t);
  const prev = P.stand && P.stand.prev;
  const rest = faceCam + REST_TURN;
  if (!prev) return rest;
  const a = spotWorld(prev.from, prev.t0), b = spotWorld(prev.to, prev.t1);
  const travel = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const s = smooth(clamp01((t - prev.t1) / 0.35));
  return lerpAngle(travel, rest, 0.4 + 0.6 * s);
}

export function heroPose(t, cam = cameraAt(t)) {
  const P = heroPath(t);
  let yaw, pitch = 0, roll = 0, sy = 1, sxz = 1;
  const faceCam = cam.az;
  const pos = P.pos.slice();

  // pop out of the card
  const dp = t - T.EV.pop;
  let pop = 1;
  if (dp >= 0 && dp < 0.2) pop = 0.55 + 0.45 * easeOut(dp / 0.2) + 0.18 * Math.sin((dp / 0.2) * Math.PI);

  if (P.hop) {
    const h = P.hop, s = P.s;
    const travel = Math.atan2(P.b[0] - P.a[0], P.b[2] - P.a[2]);
    const prevYaw = yawAtRest(h.t0 - 0.001, cameraAt(h.t0 - 0.001).az);
    yaw = lerpAngle(prevYaw, lerpAngle(travel, faceCam + REST_TURN, 0.25), smooth(clamp01(s * 3)));
    if (h.flip) pitch = Math.PI * 2 * easeInOut(clamp01((s - 0.12) / 0.76));
    else pitch = -0.28 * Math.sin(s * Math.PI * 2); // nose up, then down: a little dive
    const stretch = 0.14 * Math.max(0, 1 - s / 0.35) - 0.06 * Math.max(0, (s - 0.8) / 0.2);
    sy = 1 + stretch;
    sxz = 1 - stretch * 0.45;
  } else {
    yaw = yawAtRest(t, faceCam);
  }

  // take-off anticipation and landing squash
  for (const h of T.HOPS) {
    const a = t - (h.t0 - 0.09);
    if (a >= 0 && a < 0.09) {
      const q = Math.sin((a / 0.09) * Math.PI) * 0.16;
      sy = 1 - q; sxz = 1 + q * 0.5;
    }
    const l = t - h.t1;
    if (l >= 0 && l < 0.22) {
      const u = l / 0.22;
      const q = 0.24 * Math.exp(-4 * u) * Math.cos(u * Math.PI * 1.6);
      sy = 1 - q; sxz = 1 + q * 0.5;
    }
  }

  // kick the chip with the tail: turn away from it, flick
  if (t > T.EV.chipUp + 0.1 && t < T.HOPS[4].t0) {
    const s = smooth(clamp01((t - (T.EV.chipUp + 0.1)) / 0.2));
    yaw = lerpAngle(yaw, Math.PI / 2, s); // head to +x, tail toward the chip
    const l = t - (T.EV.kick - 0.08);
    if (l >= 0 && l < 0.22) {
      const k = Math.sin((l / 0.22) * Math.PI);
      pos[0] += 0.006 * k;
      pitch = 0.35 * k; // nose down, tail up and over
    }
  }

  // riding the playhead: lean into the rewind, surf the play
  if (T.riding(t)) {
    if (t < T.EV.rewind[1] + 0.05) {
      roll = -0.18 * Math.sin(clamp01((t - T.EV.rewind[0]) / 0.45) * Math.PI);
    } else {
      const s = clamp01((t - T.EV.surf[0]) / (T.EV.surf[1] - T.EV.surf[0]));
      yaw = lerpAngle(yaw, lerpAngle(Math.PI / 2, faceCam, 0.35), smooth(clamp01((t - T.EV.surf[0] + 0.1) / 0.25)));
      pitch = -0.14 * Math.sin(Math.min(1, s * 1.3) * Math.PI);
      pos[1] += 0.003 * Math.abs(Math.sin((t - T.EV.surf[0]) * Math.PI * 4));
    }
  }

  // wave at the end with the right fin; idle fin paddle otherwise
  let finR = 0.12 * Math.sin(t * Math.PI * 4), finL = -finR;
  if (t >= T.EV.wave[0]) {
    const d = t - T.EV.wave[0];
    finR = -Math.min(1, d / 0.12) * (1.05 + 0.45 * Math.sin(d * Math.PI * 2 * 3.2));
    roll += 0.06 * Math.sin(d * Math.PI * 2 * 1.6);
  }
  if (P.hop) { finR = -0.5 * Math.sin(P.s * Math.PI); finL = -finR; }
  const happy = t >= T.EV.wave[0] - 0.05;
  const blink = [6.95, 9.05, 10.7].some((b) => t > b && t < b + 0.09);

  // flips and dives turn around the body centre, not the belly
  const rot = [pitch, yaw, roll];
  let root = pos;
  if (pitch !== 0 || roll !== 0) {
    const c = HERO_CENTER.map((v) => v * U);
    root = v3.add(pos, v3.sub(c, rotateYXZ(c, rot)));
  }
  return { pos: root, ground: pos, rot, order: "YXZ", scale: [sxz * pop, sy * pop, sxz * pop], finL, finR, happy, blink, yaw };
}

// ── Contact shadow under the whale ──────────────────────────────────────────
export function groundUnder(x, z, t, panelState) {
  const px = x / MM + T.UI_W / 2, py = z / MM + T.UI_H / 2;
  if (T.riding(t)) return T.SURF.ctiHead * MM;
  for (const n of ["type", "rect", "pen"]) {
    const r = T.toolRect(n);
    if (px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3]) return T.SURF.button * MM;
  }
  const pr = T.previewRect("play");
  if (px > pr[0] && px < pr[0] + pr[2] && py > pr[1] && py < pr[1] + pr[3]) return T.SURF.button * MM;
  for (const [name, r] of Object.entries(T.PANELS)) {
    if (px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3]) {
      return panelState[name].pos[1] + (name === "comp" ? 0.0006 : 0);
    }
  }
  return null;
}

// ── Panels powering down and falling away ───────────────────────────────────
export function panelsAt(t) {
  const out = {};
  for (const name of Object.keys(T.PANELS)) {
    const base = PANEL_BASE[name];
    const i = T.FALL_ORDER.indexOf(name);
    if (i < 0) { out[name] = { pos: base.slice(), rot: [0, 0, 0], emit: 1, visible: true }; continue; }
    const tf = T.EV.panelsFall[i];
    const d = t - tf;
    let k = 1;
    if (d > -0.01) {
      const flick = d < 0.14 ? 0.55 + 0.45 * Math.cos(d * 90) : 0;
      k = d < 0.14 ? (1 - d / 0.14) * flick : Math.max(0, 0.06 * (1 - (d - 0.14) / 0.3));
    }
    const fd = Math.max(0, d - 0.06);
    let dir = [base[0] - wx(T.COMP_CENTER[0]), 0, base[2] - wz(T.COMP_CENTER[1])];
    const len = Math.hypot(dir[0], dir[2]) || 1;
    dir = [dir[0] / len, 0, dir[2] / len];
    out[name] = {
      pos: [base[0] + dir[0] * 0.25 * fd * fd, -2.6 * fd * fd, base[2] + dir[2] * 0.25 * fd * fd],
      rot: [dir[2] * 1.6 * fd * fd, 0, -dir[0] * 1.6 * fd * fd],
      emit: k,
      visible: fd < 1.2,
    };
  }
  return out;
}

// ── Buttons ─────────────────────────────────────────────────────────────────
export function buttonsAt(t) {
  const selected = t < T.EV.typeAt ? "selection" : t < T.EV.sparkAt ? "type" : t < T.EV.swooshAt ? "rect" : "pen";
  const out = {};
  for (const name of ["selection", "rect", "pen", "type", "play"]) {
    const on = name === selected || (name === "play" && t >= T.EV.play && t < T.EV.play + 0.6);
    let press = 0;
    const at = { type: T.EV.typeAt, rect: T.EV.sparkAt, pen: T.EV.swooshAt, play: T.EV.play }[name];
    if (at !== undefined) {
      const d = t - at;
      if (d >= -0.02 && d < 0.2) press = Math.sin(clamp01((d + 0.02) / 0.22) * Math.PI);
    }
    out[name] = { on, press };
  }
  return out;
}

// ── Keyframe cubes ──────────────────────────────────────────────────────────
export function keysAt(t) {
  return T.KEY_STAMP_TIMES.map((ts) => {
    const d = t - ts;
    if (d < 0) return 0;
    return d < 0.18 ? easeOut(d / 0.18) * (1 + 0.35 * Math.sin((d / 0.18) * Math.PI)) : 1;
  });
}

// ── The Glow chip ───────────────────────────────────────────────────────────
export function chipAt(t) {
  const up = T.EV.chipUp, kick = T.EV.kick, land = T.EV.chipLand;
  const [cx0, cy0, cw, ch] = T.GLOW_CHIP;
  const rowP = [wx(cx0 + cw / 2), 0.0025, wz(cy0 + ch / 2)];
  if (t < up || t >= land) return { visible: false, pos: rowP, rot: [0, 0, 0], scale: 0.0001 };
  if (t < kick) {
    const s = clamp01((t - up) / 0.22);
    const hover = easeOut(s) * 0.022 + Math.sin((t - up) * 9) * 0.0015 * s;
    return { visible: true, pos: v3.add(rowP, [0, hover, 0]), rot: [-0.35 * easeOut(s), 0, Math.sin((t - up) * 7) * 0.05 * s], scale: 1 };
  }
  const s = (t - kick) / (land - kick);
  const start = v3.add(rowP, [0, 0.022, 0]);
  const end = [wx(T.COMP_CENTER[0]), 0.002, wz(T.COMP_CENTER[1])];
  const pos = v3.lerp(start, end, easeInOut(s));
  pos[1] += 0.16 * 4 * s * (1 - s);
  return { visible: true, pos, rot: [-0.35 + s * 7, s * 3, s * 2], scale: lerp(1, 0.35, s * s) };
}

// ── Glass shards ────────────────────────────────────────────────────────────
const rngS = mulberry32(2026);
export const SHARDS = Array.from({ length: 42 }, () => {
  const a = 0.004 + rngS() * 0.012;
  const tri = [0, 0, 0, a, rngS() * a * 0.6, 0, rngS() * a, a * (0.6 + rngS() * 0.8), 0];
  const ang = rngS() * Math.PI * 2;
  const sp = 0.25 + rngS() * 0.55;
  return {
    tri,
    v: [Math.cos(ang) * sp * 0.8, 0.35 + rngS() * 0.55, Math.sin(ang) * sp * 0.45 - 0.05],
    spin: [rngS() * 14 - 7, rngS() * 14 - 7, rngS() * 14 - 7],
    delay: rngS() * 0.04,
  };
});
export function shardsAt(t) {
  return SHARDS.map((sh) => {
    const d = t - T.EV.pop - sh.delay;
    const at = (d) => [wx(T.COMP_CENTER[0]) + sh.v[0] * d, 0.004 + sh.v[1] * d - 1.6 * d * d, wz(T.COMP_CENTER[1]) + sh.v[2] * d];
    if (d < 0) return { visible: false, pos: at(0), rot: [0, 0, 0], scale: 0.0001 };
    if (d > 0.6) return { visible: false, pos: at(0.6), rot: [sh.spin[0] * 0.6, sh.spin[1] * 0.6, sh.spin[2] * 0.6], scale: 0.0001 };
    return {
      visible: true,
      pos: at(d),
      rot: [sh.spin[0] * d, sh.spin[1] * d, sh.spin[2] * d],
      scale: 1 - smooth(clamp01((d - 0.35) / 0.25)) * 0.9999,
    };
  });
}

// ── The flat card he peels off the screen as ────────────────────────────────
// The card stands on its bottom edge (local origin), shows the side-view sprite.
export const CARD_SIZE = [17 * U, 11 * U];
export function cardAt(t) {
  const s = easeInOut(clamp01((t - T.EV.peel[0]) / (T.EV.peel[1] - T.EV.peel[0])));
  if (t < T.EV.peel[0] || t >= T.EV.pop + 0.05) {
    // hidden, but parked where it appears/vanishes so motion blur never streaks it in
    return { visible: false, pos: [wx(T.COMP_CENTER[0]), 0.0008 + s * 0.004, wz(T.COMP_CENTER[1]) + (CARD_SIZE[1] / 2) * (1 - s)], rot: [(-Math.PI / 2) * (1 - s), 0, 0], scale: 0.0001 };
  }
  const curl = Math.sin(s * Math.PI) * 0.15;
  const fade = t >= T.EV.pop ? 1 - (t - T.EV.pop) / 0.05 : 1;
  return {
    visible: true,
    pos: [wx(T.COMP_CENTER[0]), 0.0008 + s * 0.004, wz(T.COMP_CENTER[1]) + (CARD_SIZE[1] / 2) * (1 - s)],
    rot: [(-Math.PI / 2) * (1 - s) - curl, 0, 0],
    scale: Math.max(0.0001, fade),
  };
}

// ── "Yay" sparkles ──────────────────────────────────────────────────────────
const rngY = mulberry32(99);
const SPARKLES = Array.from({ length: 14 }, () => ({ a: rngY() * Math.PI * 2, v: 0.05 + rngY() * 0.07, up: 0.08 + rngY() * 0.1, d: rngY() * 0.25 }));
export function sparklesAt(t, heroGround) {
  return SPARKLES.map((p) => {
    const d = t - T.EV.wave[0] - 0.25 - p.d;
    if (d < 0 || d > 0.9) return { visible: false, pos: heroGround, rot: [0, 0, 0], scale: 0.0001 };
    const k = d / 0.9;
    return {
      visible: true,
      pos: [
        heroGround[0] + Math.cos(p.a) * p.v * easeOut(k),
        heroGround[1] + 0.05 + p.up * easeOut(k),
        heroGround[2] + Math.sin(p.a) * p.v * easeOut(k) * 0.6,
      ],
      rot: [d * 6, d * 4, 0],
      scale: Math.sin(k * Math.PI) * 1.4 + 0.0001,
    };
  });
}

// ── Everything at once ──────────────────────────────────────────────────────
export function stateAt(t) {
  t = Math.max(0, Math.min(T.DURATION, t));
  const cam = cameraAt(t);
  const panels = panelsAt(t);
  const hero = heroPose(t, cam);
  const visible = t >= T.EV.pop;

  let blob = { visible: false, pos: hero.ground.slice(), yaw: hero.yaw, sx: 0.0001, sz: 0.0001, opacity: 0 };
  if (visible) {
    const g = groundUnder(hero.ground[0], hero.ground[2], t, panels);
    if (g !== null) {
      const hgt = Math.max(0, hero.ground[1] - g);
      const k = clamp01(1 - hgt / 0.16);
      blob = { visible: true, pos: [hero.ground[0], g + 0.0009, hero.ground[2]], yaw: hero.yaw, sx: 0.055 * (1.2 - 0.4 * k), sz: 0.09 * (1.2 - 0.4 * k), opacity: 0.85 * k * k };
    }
  }

  const centre = v3.add(hero.ground, [0, HERO_CENTER[1] * U, 0]);
  const focusPoint = visible ? centre : cam.target;
  const focus = lerp(v3.dist(cam.pos, cam.target), v3.dist(cam.pos, focusPoint), cam.follow);

  return {
    t,
    cam: { ...cam, focus },
    hero: { ...hero, visible },
    blob,
    panels,
    buttons: buttonsAt(t),
    keys: keysAt(t),
    ctiX: T.compTimeToX(T.ctiTime(t)),
    compTime: T.ctiTime(t),
    chip: chipAt(t),
    shards: shardsAt(t),
    card: cardAt(t),
    sparkles: sparklesAt(t, hero.ground),
  };
}
