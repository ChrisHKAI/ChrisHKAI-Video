// What a beat needs to move the toy and frame it (references/beats.md): the
// toy's pose on the beat's own stage, its moves between beats (it drops in,
// cheers, leaps out of the top of the frame), the toy and its contact shadow
// from a pose, and a camera from keys in the beat's own seconds.
import { TOY, CENTER, JOINTS } from "./toy.js";
import { basePose, squash, landSquash, crouch, hop, heroT, partsAt } from "./rig.js";
import { makeCamera } from "./camera.js";
import { clamp01, seg, smooth, easeInOut, lerp, lerpAngle, yawTo, TAU, v3 } from "./math.js";
import { trs, qId, qEuler, mulT } from "./quat.js";

export const HIDDEN = 1e-4;
export const POP = 1.3; // the toy's size on a beat's small stage, as on the end card
export { squash, landSquash, crouch, hop, CENTER };

// the toy standing at spot (world metres), at the stage size
export function stand(spot) {
  const o = basePose(spot);
  o.pop = POP;
  return o;
}
// falls from above the frame onto spot over g0–g1, arms up
export function dropIn(o, g, g0, g1, spot) {
  const u = seg(g, g0, g1);
  o.pos = v3.add(spot, [0, 0.9 * Math.pow(1 - u, 2), 0]);
  o.ground = spot[1];
  o.armR = [0, 0, -2.0]; o.armL = [0, 0, 2.0];
  o.legR = [-0.4, 0, 0]; o.legL = [-0.4, 0, 0];
  return o;
}
// crouches and leaps straight up out of the frame over g0–g1 (the cut to the next beat follows)
export function leapOut(o, g, g0, g1, spot) {
  const s = seg(g, g0, g1);
  o.pos = v3.add(spot, [0, 0.85 * Math.pow(s, 0.8), 0]);
  o.ground = spot[1];
  squash(o, crouch(g, g0, 0.16));
  o.armR = [0, 0, -2.4 * smooth(s)]; o.armL = [0, 0, 2.4 * smooth(s)];
  o.legR = [0.5 * s, 0, 0]; o.legL = [0.5 * s, 0, 0];
  return o;
}
// a jump for joy over g0–g1; returns the squash to add (crouch before, landing after)
export function cheer(o, g, g0, g1) {
  const s = seg(g, g0, g1), up = Math.sin(Math.PI * s);
  o.pos[1] += 0.05 * up;
  o.armR = [0, 0, -2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
  o.armL = [0, 0, 2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
  o.legR = [-0.5 * up, 0, 0]; o.legL = [-0.5 * up, 0, 0];
  return crouch(g, g0, 0.12) + landSquash(g, g1, 0.22);
}

// ── everyday moves, so a beat does not write them again. Each eases in and out
// over g0–g1 on a pose from stand() and works on any toy: a toy with no arms
// plays an arm move with its whole body (the rig leans it, wobbles it).
// in and out: 0 → 1 → 0 across g0–g1, over `edge` seconds at each end
const held = (g, g0, g1, edge = 0.18) => smooth(seg(g, g0, g0 + edge)) * (1 - smooth(seg(g, g1 - edge, g1)));
// one arm up, waving ("L" its left, "R" its right)
export function wave(o, g, g0, g1, side = "L") {
  const k = held(g, g0, g1), w = 0.35 * Math.sin((g - g0) * TAU * 2.5);
  if (side === "L") o.armL = [0, 0, lerp(o.armL[2], 2.3 + w, k)];
  else o.armR = [0, 0, lerp(o.armR[2], -2.3 - w, k)];
  o.head = [o.head[0], o.head[1], o.head[2] + 0.12 * k * (side === "L" ? -1 : 1)];
  return o;
}
// nods `times` times: yes, thanks, agreed
export function nod(o, g, g0, g1, times = 2) {
  const k = held(g, g0, g1, 0.1);
  o.head = [o.head[0] + 0.3 * k * Math.abs(Math.sin(Math.PI * times * seg(g, g0, g1))), o.head[1], o.head[2]];
  return o;
}
// points at a world point with one arm ("R" or "L"), the head and body turned to it
export function point(o, g, g0, g1, world, side = "R") {
  const k = held(g, g0, g1, 0.22);
  if (side === "R") { o.aimR = { world, k, len: 1.15 }; o.pointR = k; } else { o.aimL = { world, k, len: 1.15 }; o.pointL = k; }
  o.yaw = lerpAngle(o.yaw, yawTo(o.pos, world), 0.35 * k);
  o.head = [o.head[0] - 0.15 * k, o.head[1] + 0.25 * k * (side === "R" ? -1 : 1), o.head[2]];
  return o;
}
// turns to face a world point (yaw), looking up or down at it with the head
export function lookAt(o, world, k = 1) {
  o.yaw = lerpAngle(o.yaw, yawTo(o.pos, world), k);
  const d = v3.sub(world, o.pos), up = Math.atan2(d[1] - 0.06, Math.hypot(d[0], d[2]) || 1);
  o.head = [o.head[0] - 0.5 * up * k, o.head[1], o.head[2]];
  return o;
}
// spins round `turns` times with a little hop; returns the squash to add
export function spin(o, g, g0, g1, turns = 1) {
  const s = seg(g, g0, g1);
  o.yaw += turns * TAU * easeInOut(s);
  o.pos[1] += 0.03 * Math.sin(Math.PI * s);
  o.armR = [0, 0, lerp(o.armR[2], -1.2, Math.sin(Math.PI * s))]; o.armL = [0, 0, lerp(o.armL[2], 1.2, Math.sin(Math.PI * s))];
  return crouch(g, g0, 0.1) + landSquash(g, g1, 0.18);
}
// a bow from the waist (a thank-you, a goodbye)
export function bow(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.25);
  o.pitch += 0.45 * k;
  o.head = [o.head[0] + 0.2 * k, o.head[1], o.head[2]];
  o.armR = [0.3 * k, 0, o.armR[2]]; o.armL = [0.3 * k, 0, o.armL[2]];
  return o;
}
// sits down on the floor (legs forward) and gets up again at g1; a toy with no legs settles lower
export function sit(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.3);
  const hip = JOINTS.legR?.p?.[1] ?? JOINTS.legL?.p?.[1] ?? 0;
  if (hip > 0) {
    o.legR = [-1.45 * k, 0, 0.1 * k]; o.legL = [-1.45 * k, 0, -0.1 * k];
    o.pos[1] -= 0.75 * hip * o.pop * k;
    o.armR = [0, 0, lerp(o.armR[2], -0.5, k)]; o.armL = [0, 0, lerp(o.armL[2], 0.5, k)];
  } else squash(o, 0.18 * k);
  return o;
}

// the toy for a pose: its transform, its parts and its contact shadow on the
// floor under it (null: the toy is not in this beat)
export function toyFrom(o, park) {
  if (!o || o.show === false) {
    const p = o ? o.pos : park;
    const hero = trs(p.slice(), qId(), HIDDEN);
    return { hero, parts: partsAt(hero, basePose(p), TOY), blob: { tr: trs(p.slice(), qId(), HIDDEN), opacity: 0 }, glint: 0 };
  }
  const hero = heroT(o, CENTER);
  const h = Math.max(0, o.pos[1] - o.ground), k = clamp01(1 - h / 0.12), s = 1.15 - 0.35 * k;
  const blob = { tr: trs([o.pos[0], o.ground + 0.0007, o.pos[2]], qEuler(-Math.PI / 2, 0, 0), k > 0.01 ? [0.07 * s * o.pop, 0.05 * s * o.pop, 1] : HIDDEN), opacity: 0.7 * k * k };
  return { hero, parts: partsAt(hero, o, TOY), blob, glint: o.glint ?? 0 };
}

// a camera from keys in the beat's seconds: [{ t, target: world point, dist m,
// elev deg, az deg, fstop? }] (one key holds still); shakes [[t, strength]]
export function cameraFrom(keys, { fov, aspect, shakes = [] }) {
  const ks = (keys.length === 1 ? [keys[0], { ...keys[0], t: keys[0].t + 1 }] : keys).map((k) => ({ fstop: 5.6, ...k }));
  return makeCamera({ shots: [{ start: -Infinity, keys: ks, target: (k) => k.target }], fov, shakes, aspect });
}

// a number as the platform writes it, and text that changes as it counts (engine/lib/counter.js)
export { formatCount, readout } from "./counter.js";

// one confetti flake bursting from p0 (world) at t0: { tr, color } at g
export function confetti(i, g, t0, p0, colors, rand) {
  const a = rand() * Math.PI * 2, sp = 0.25 + rand() * 0.35;
  const v0 = [Math.cos(a) * sp * 0.9, 0.5 + rand() * 0.5, Math.abs(Math.sin(a)) * sp * 0.6 + 0.05];
  const spin = [4 + rand() * 8, 3 + rand() * 6];
  const color = colors[i % colors.length];
  const dt = g - t0;
  if (dt < 0 || dt > 1.6) return { tr: trs(p0.slice(), qId(), HIDDEN), color };
  const p = [p0[0] + v0[0] * dt, Math.max(0.0007, p0[1] + v0[1] * dt - 1.2 * dt * dt), p0[2] + v0[2] * dt];
  return { tr: trs(p, qEuler(dt * spin[0], dt * spin[1], dt * 5), 1 - seg(dt, 1.3, 1.6)), color };
}
