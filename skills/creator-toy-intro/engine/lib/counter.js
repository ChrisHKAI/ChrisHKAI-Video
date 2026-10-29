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


// The digit slots write whole digits, a one-character unit and a two-character
// label (304万 阅读). Anything else is set as text, as the platform writes it:
// a decimal point (6.5万, 51.3万), thousands commas (7,253), no unit, a latin
// one (46K, 2.3M, 380+), a label of any length or script (star).
// display: the platform's own writing; label: its word.
export const slotCount = (display, label) =>
  /^\d+[㐀-鿿]$/.test(String(display).trim()) && [...String(label)].length === 2;

// what the text counter writes for v: the display's own decimals, separators and unit
export function countFormat(display) {
  const s = String(display).trim();
  const m = s.match(/^\+?([\d,]+)(?:\.(\d+))?\s*(.*)$/);
  if (!m) throw new Error(`can't read "${display}" as a count`);
  return { decimals: m[2]?.length ?? 0, sep: m[1].includes(",") ? "," : "", unit: m[3] };
}

// the text counter: the number right-aligned on x = numRight, its label after it, a bar
// under both that fills with the count. em: { digit, label } sizes in metres; key(c) the
// glyph for a character; names: what to call the objects (prefix)
export function counterText({ display, label, adv, em, key, prefix = "stat_", gap = 0.01 }) {
  const fmt = countFormat(display);
  const to = Number(String(display).trim().replace(/^\+/, "").replace(/,/g, "").match(/^[\d.]+/)[0]);
  const NUM = readout({ fmt: (v) => formatCount(v, fmt), from: 0, to, em: em.digit, adv, key });
  const LABEL = [...String(label ?? "")].filter((c) => !/\s/.test(c));
  const numW = NUM.width(to);
  const labW = LABEL.reduce((w, c) => w + adv(key(c)) * em.label, 0);
  const width = numW + (LABEL.length ? gap + labW : 0);
  const left = -width / 2, numRight = left + numW;
  const shown = (v) => (v >= to ? to : fmt.decimals ? Math.floor(v * 10 ** fmt.decimals) / 10 ** fmt.decimals : Math.floor(v));
  return {
    to, fmt, width,
    // the objects to declare: { name, key, em }
    names: [
      ...NUM.names.map((n) => ({ name: prefix + n.name, key: n.key, em: em.digit })),
      ...LABEL.map((c, i) => ({ name: `${prefix}l${i}`, key: key(c), em: em.label, label: true })),
    ],
    // every object's transform for the count v (0 … to), group-local; bar: the bar's name
    at(v, group, bar) {
      const out = {};
      for (const [k, tr] of Object.entries(NUM.at(shown(v), mulT(group, trs([numRight, 0, 0]))))) out[prefix + k] = tr;
      let x = numRight + gap;
      LABEL.forEach((c, i) => { out[`${prefix}l${i}`] = mulT(group, trs([x, 0, 0])); x += adv(key(c)) * em.label; });
      const p = Math.max(v / to, 1e-4);
      if (bar) out[bar] = mulT(group, trs([left + (width * p) / 2, -0.011, 0], qId(), [p, 1, 1]));
      return out;
    },
  };
}
