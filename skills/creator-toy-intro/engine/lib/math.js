// Easing and small vector helpers shared by every motion module.
export const clamp01 = (a) => Math.min(1, Math.max(0, a));
export const seg = (t, a, b) => clamp01((t - a) / (b - a)); // 0 → 1 across [a, b]
export const smooth = (a) => a * a * (3 - 2 * a);
export const lerp = (a, b, s) => a + (b - a) * s;
export const easeOut = (a) => 1 - Math.pow(1 - a, 3);
export const easeIn = (a) => a * a * a;
export const easeInOut = (a) => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
export const backOut = (a, k = 1.6) => 1 + (k + 1) * Math.pow(a - 1, 3) + k * Math.pow(a - 1, 2);
export const TAU = Math.PI * 2;
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  lerp: (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};
export const lerpAngle = (a, b, s) => {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * s;
};
export const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]); // heading from a to b (+z = 0)
