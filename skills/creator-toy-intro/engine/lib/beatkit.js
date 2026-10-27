// What a beat needs to move the toy and frame it (references/beats.md): the
// toy's pose on the beat's own stage, its moves between beats (it drops in,
// cheers, leaps out of the top of the frame), the toy and its contact shadow
// from a pose, and a camera from keys in the beat's own seconds.
import { TOY, CENTER } from "./toy.js";
import { basePose, squash, landSquash, crouch, hop, heroT, partsAt } from "./rig.js";
import { makeCamera } from "./camera.js";
import { clamp01, seg, smooth, v3 } from "./math.js";
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

// a number as the platform writes it: thousands separators, decimals, a unit after it
// (10,000 · 1.5万 · 380+)
export function formatCount(v, { decimals = 0, sep = ",", unit = "" } = {}) {
  const [i, d] = Math.abs(v).toFixed(decimals).split(".");
  return (v < 0 ? "-" : "") + (sep ? i.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : i) + (d ? `.${d}` : "") + unit;
}

// text that changes as something counts, as 3D lettering: every place from the
// right holds one object per character it shows on the way (only one shows at a
// time, so a change never smears). fmt(v) is the text for v; it is sampled
// `steps` times from `from` to `to` to learn each place's characters. Right-
// aligned on x = 0 of the group it is put in; em its size (m).
export function readout({ fmt, from, to, em, adv, key = (c) => `heavy:${c}`, steps = 400 }) {
  const places = [];
  for (let i = 0; i <= steps; i++) [...fmt(from + ((to - from) * i) / steps)].reverse().forEach((c, k) => (places[k] ??= new Set()).add(c));
  [...fmt(to)].reverse().forEach((c, k) => (places[k] ??= new Set()).add(c));
  // a place that shows a digit may show any of them on the way
  for (const set of places) if ([...set].some((c) => /\d/.test(c))) for (const d of "0123456789") set.add(d);
  const id = (k, c) => `n${k}_${c.codePointAt(0)}`;
  return {
    // the objects to declare: { name, key (the glyph), c }
    names: places.flatMap((set, k) => [...set].map((c) => ({ name: id(k, c), key: key(c), c }))),
    width: (v) => [...fmt(v)].reduce((w, c) => w + adv(key(c)) * em, 0),
    // every object's transform for v, in the group's frame
    at(v, group) {
      const out = {};
      places.forEach((set, k) => set.forEach((c) => (out[id(k, c)] = mulT(group, trs([0, 0, 0], qId(), HIDDEN)))));
      let x = 0;
      [...fmt(v)].reverse().forEach((c, k) => {
        x -= adv(key(c)) * em;
        if (out[id(k, c)]) out[id(k, c)] = mulT(group, trs([x, 0, 0]));
      });
      return out;
    },
  };
}

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
