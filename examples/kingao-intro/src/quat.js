// Small quaternion / transform kit (Three.js conventions: q = [x, y, z, w],
// Euler YXZ = qy·qx·qz). A transform is { p, q, s }: T · R · S.

export const qId = () => [0, 0, 0, 1];
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qConj = (q) => [-q[0], -q[1], -q[2], q[3]];
export function qAxis(axis, ang) {
  const s = Math.sin(ang / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(ang / 2)];
}
export function qEuler(rx, ry, rz, order = "XYZ") {
  const qx = qAxis([1, 0, 0], rx), qy = qAxis([0, 1, 0], ry), qz = qAxis([0, 0, 1], rz);
  return order === "YXZ" ? qMul(qMul(qy, qx), qz) : qMul(qMul(qx, qy), qz);
}
export function qRot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}
export function qSlerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = b.map((v) => -v); }
  if (d > 0.9995) {
    const r = a.map((v, i) => v + (bb[i] - v) * t);
    const l = Math.hypot(...r);
    return r.map((v) => v / l);
  }
  const th = Math.acos(d), s = Math.sin(th);
  const ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
  return a.map((v, i) => v * ka + bb[i] * kb);
}
// rotation taking unit vector a onto unit vector b
export function qFromTo(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d < -0.999999) return qAxis(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], Math.PI);
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
}
// from an orthonormal basis (columns x, y, z)
export function qFromBasis(x, y, z) {
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    return [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

// ── transforms ──────────────────────────────────────────────────────────────
export const trs = (p, q = qId(), s = [1, 1, 1]) => ({ p, q, s: typeof s === "number" ? [s, s, s] : s });
export const apply = (T, v) => {
  const r = qRot(T.q, [v[0] * T.s[0], v[1] * T.s[1], v[2] * T.s[2]]);
  return [T.p[0] + r[0], T.p[1] + r[1], T.p[2] + r[2]];
};
// parent · child (exact when the parent's scale is uniform)
export const mulT = (A, B) => ({ p: apply(A, B.p), q: qMul(A.q, B.q), s: [A.s[0] * B.s[0], A.s[1] * B.s[1], A.s[2] * B.s[2]] });
// the child transform that puts an object at world W under parent A
export function relT(A, W) {
  const ci = qConj(A.q);
  const d = qRot(ci, [W.p[0] - A.p[0], W.p[1] - A.p[1], W.p[2] - A.p[2]]);
  return { p: [d[0] / A.s[0], d[1] / A.s[1], d[2] / A.s[2]], q: qMul(ci, W.q), s: [W.s[0] / A.s[0], W.s[1] / A.s[1], W.s[2] / A.s[2]] };
}
