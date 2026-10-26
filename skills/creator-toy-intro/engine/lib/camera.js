// The camera: keyed shots that orbit a target. Each key gives a target (the
// story resolves it: a place, or a tracker that follows something), a
// distance, elevation and azimuth (degrees; az 0 = from the south edge) and an
// f-stop. Distances and angles run through monotone curves so they never
// overshoot; targets blend between keys with the same easing. A story can cut
// to a new set of keys (a shot) at a given time. A key's optional `frame`
// [x, y] puts its target that far from the frame's centre (fractions of the
// frame, x right, y up) instead of in the middle.
import { trs, qFromBasis } from "./quat.js";
import { clamp01, seg, smooth, v3 } from "./math.js";

// monotone cubic interpolation (Fritsch–Carlson) through (ts, ys)
export function monotone(ts, ys) {
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

// a world point that follows something, sampled at `rate` Hz over the film and
// Gaussian-smoothed (sigma s) so the camera never jerks with a hop
export function smoothTracker(raw, duration, rate = 120, sigma = 0.12) {
  let arr = null;
  return (t) => {
    if (!arr) {
      const n = Math.ceil(duration * rate) + 1;
      const pts = Array.from({ length: n }, (_, i) => raw(i / rate));
      const sig = sigma * rate, rad = Math.ceil(sig * 3);
      const ker = Array.from({ length: 2 * rad + 1 }, (_, k) => Math.exp(-((k - rad) ** 2) / (2 * sig * sig)));
      arr = pts.map((_, i) => {
        let acc = [0, 0, 0], ws = 0;
        for (let k = -rad; k <= rad; k++) {
          const j = Math.min(n - 1, Math.max(0, i + k));
          acc = v3.add(acc, v3.scale(pts[j], ker[k + rad])); ws += ker[k + rad];
        }
        return v3.scale(acc, 1 / ws);
      });
    }
    const f = clamp01(t / duration) * (arr.length - 1);
    const i = Math.floor(f);
    return v3.lerp(arr[i], arr[Math.min(i + 1, arr.length - 1)], f - i);
  };
}

// 2–3 frame shakes on hits: [[t, strength], …]
export function shakeAt(t, shakes) {
  let o = [0, 0, 0];
  for (const [ts, k] of shakes) {
    const d = t - ts;
    if (d < 0 || d > 0.12) continue;
    const a = k * (1 - d / 0.12) ** 2;
    o = v3.add(o, [0.004 * a * Math.sin(t * 173 + ts), 0.003 * a * Math.sin(t * 211 + 1), 0.004 * a * Math.sin(t * 157 + 2)]);
  }
  return o;
}

// shots: [{ start, keys, target: (key, t) → world point }], in time order;
// fov is vertical (deg), aspect the frame's width / height;
// returns t → { tr, pos, target, fov, fstop, focus, az }
export function makeCamera({ shots, fov, shakes, aspect = 16 / 9 }) {
  const curves = shots.map(({ keys }) => {
    const ts = keys.map((k) => k.t);
    const f = (key) => monotone(ts, keys.map((k) => k[key]));
    return { ts, dist: f("dist"), elev: f("elev"), az: f("az"), fstop: f("fstop") };
  });
  return function cameraAt(t) {
    let n = 0;
    while (n < shots.length - 1 && t >= shots[n + 1].start) n++;
    const ks = shots[n].keys, F = curves[n];
    const kt = (k) => shots[n].target(k, t);
    let i = 0;
    while (i < ks.length - 2 && t > ks[i + 1].t) i++;
    const a = ks[i], b = ks[i + 1];
    const s = smooth(seg(t, a.t, b.t));
    const target = v3.lerp(kt(a), kt(b), s);
    const el = (F.elev(t) * Math.PI) / 180, az = (F.az(t) * Math.PI) / 180, d = F.dist(t);
    const pos = [target[0] + d * Math.sin(az) * Math.cos(el), target[1] + d * Math.sin(el), target[2] + d * Math.cos(az) * Math.cos(el)];
    const sh = shakeAt(t, shakes);
    const eye = v3.add(pos, sh), look = v3.add(target, v3.scale(sh, 0.6));
    const z = v3.norm(v3.sub(eye, look));
    const x = v3.norm(v3.cross([0, 1, 0], z));
    const y = v3.cross(z, x);
    if (a.frame || b.frame) {
      // slide the camera sideways so the target lands off centre
      const [fa, fb] = [a.frame ?? [0, 0], b.frame ?? [0, 0]];
      const fh = 2 * d * Math.tan((fov * Math.PI) / 360);
      const off = v3.add(v3.scale(x, -(fa[0] + (fb[0] - fa[0]) * s) * fh * aspect), v3.scale(y, -(fa[1] + (fb[1] - fa[1]) * s) * fh));
      const e2 = v3.add(eye, off);
      return { tr: trs(e2, qFromBasis(x, y, z)), pos: e2, target, fov, fstop: F.fstop(t), focus: v3.len(v3.sub(pos, target)), az };
    }
    return { tr: trs(eye, qFromBasis(x, y, z)), pos: eye, target, fov, fstop: F.fstop(t), focus: v3.len(v3.sub(pos, target)), az };
  };
}
