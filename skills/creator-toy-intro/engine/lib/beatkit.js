// What a beat needs to move the toy and frame it (references/beats.md): the
// toy's pose on the beat's own stage, its moves between beats (it drops in,
// cheers, leaps out of the top of the frame), the toy and its contact shadow
// from a pose, and a camera from keys in the beat's own seconds.
import { TOY, CENTER } from "./toy.js";
import { basePose, squash, landSquash, crouch, hop, heroT, partsAt } from "./rig.js";
import { makeCamera } from "./camera.js";
import { clamp01, seg, smooth, v3 } from "./math.js";
import { trs, qId, qEuler } from "./quat.js";

export const HIDDEN = 1e-4;
export const POP = 1.3; // the toy's size on a beat's small stage, as on the end card
export { squash, landSquash, crouch, hop };

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
