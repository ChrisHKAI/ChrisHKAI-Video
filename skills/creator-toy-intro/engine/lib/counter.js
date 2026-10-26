// A count that lifts out of the spot where the page shows it, as 3D
// lettering: one slot per digit (each slot holds the ten digits, only one
// shows, so a change never smears), the unit (万), a smaller two-character
// label (阅读) and a bar that fills with the count. Group space in mm, origin at
// the middle of the baseline, +z out of the type.
import { qId, trs, mulT } from "./quat.js";

const MM = 0.001, HIDDEN = 1e-4;

// value: the final count in display units (304 for 304万); adv(key): glyph
// advance in em; em: { digit, wan, label } sizes in mm; keys: { unit, label: [a, b] }
export function counterLayout({ value, adv, em, keys }) {
  const n = String(value).length;
  const dw = adv("latin:0") * em.digit;
  let x = 0;
  const slots = Array.from({ length: n }, () => { const p = x; x += dw; return p; });
  const wan = x + 3;
  x = wan + adv(keys.unit) * em.wan + 10;
  const label = [x, x + adv(keys.label[0]) * em.label];
  x = label[1] + adv(keys.label[1]) * em.label;
  const off = -x / 2;
  return { slots: slots.map((v) => v + off), wan: wan + off, label: label.map((v) => v + off), width: x, left: off, bar: -11 };
}

// the count shown at s (0 → 1 across the count): fast, then easing into the lock
export const countEase = (value, s) => Math.round(value * (1 - Math.pow(1 - s, 3)));

// every glyph's transform for the count v: group is the counter's transform;
// names: { digit: (i, d) → name, unit, label: [a, b], bar }
export function counterGlyphs(v, value, layout, group, names) {
  const n = layout.slots.length;
  const dig = layout.slots.map((_, i) => (i === 0 ? Math.floor(v / 10 ** (n - 1)) : Math.floor(v / 10 ** (n - 1 - i)) % 10));
  const on = layout.slots.map((_, i) => i === n - 1 || v >= 10 ** (n - 1 - i));
  const L = (tr) => mulT(group, tr);
  const glyphs = {};
  layout.slots.forEach((x, i) => {
    for (let d = 0; d <= 9; d++) glyphs[names.digit(i, d)] = L(trs([x * MM, 0, 0], qId(), on[i] && dig[i] === d ? 1 : HIDDEN));
  });
  glyphs[names.unit] = L(trs([layout.wan * MM, 0, 0]));
  glyphs[names.label[0]] = L(trs([layout.label[0] * MM, 0, 0]));
  glyphs[names.label[1]] = L(trs([layout.label[1] * MM, 0, 0]));
  const p = Math.max(v / value, 1e-4);
  glyphs[names.bar] = L(trs([(layout.left + layout.width * p / 2) * MM, layout.bar * MM, 0], qId(), [p, 1, 1]));
  return glyphs;
}
