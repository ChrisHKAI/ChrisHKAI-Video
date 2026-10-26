// Torn-paper labels: a sheet of coloured paper with a white torn rim behind it
// and raised letters on it (the end card's lettering). A label slaps on a
// little big and twisted, then lies flat; its letters pop up one by one.
import { mulberry32 } from "./rng.js";
import { qId, qEuler, trs, mulT } from "./quat.js";
import { seg, smooth, lerp, easeOut, backOut } from "./math.js";

const HIDDEN = 1e-4;
// paper colour and ink colour for each paper
export const PAPER = { cream: ["#EFE6D4", "#161514"], red: ["#D8382D", "#FBF3E6"], blue: ["#2F5D9E", "#F3EEE4"] };

// layout: text set in em (m) with glyph advances adv(key); centre c, tilt,
// the time it lands and each letter's time letterAt(i)
export function makeLabel({ id, text, em, paper, c, tilt, at, letterAt, adv, font = "heavy" }) {
  const keys = [...text].map((ch) => `${font}:${ch}`);
  const w = keys.reduce((sum, k) => sum + adv(k) * em, 0);
  const padX = 0.2 * em, padY = 0.2 * em;
  const W = w + 2 * padX, H = 0.93 * em + 2 * padY;
  let x = -w / 2;
  const letters = keys.map((k, i) => { const o = { key: k, x, y: -0.36 * em, at: letterAt(i) }; x += adv(k) * em; return o; });
  return { id, text, em, paper, c, tilt, at, W, H, letters };
}

// a torn outline round a w x h sheet: little bites on the long edges, ragged ends
export function torn(w, h, seed, grow = 0) {
  const r = mulberry32(seed);
  const pts = [];
  const edge = (x0, y0, x1, y1, n, amp, nx, ny) => {
    for (let i = 0; i < n; i++) {
      const s = i / n, j = (r() - 0.35) * amp;
      pts.push([x0 + (x1 - x0) * s + nx * (j + grow), y0 + (y1 - y0) * s + ny * (j + grow)]);
    }
  };
  const nx = Math.max(6, Math.round(w / 0.008)), ny = Math.max(4, Math.round(h / 0.008));
  edge(-w / 2, h / 2, w / 2, h / 2, nx, 0.0022, 0, 1);
  edge(w / 2, h / 2, w / 2, -h / 2, ny, 0.006, 1, 0);
  edge(w / 2, -h / 2, -w / 2, -h / 2, nx, 0.0022, 0, -1);
  edge(-w / 2, -h / 2, -w / 2, h / 2, ny, 0.006, -1, 0);
  return pts.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]);
}
// cut the i-th label's sheet and rim (seeded by its place in the list)
export function tear(L, i) {
  L.sheet = torn(L.W, L.H, 900 + i);
  L.rim = torn(L.W, L.H, 950 + i, 0.0028);
}

// the label slaps on: a little big and twisted, then flat and still; place
// turns its centre into world space
export function labelT(L, t, place) {
  const s = seg(t, L.at, L.at + 0.18);
  if (t < L.at) return trs(place(...L.c), qId(), HIDDEN);
  const k = lerp(1.25, 1, easeOut(s));
  const tw = L.tilt + 0.12 * (1 - easeOut(s));
  return trs(place(L.c[0], L.c[1], L.c[2] + 0.02 * (1 - easeOut(s))), qEuler(-0.15 * (1 - s), 0, tw), k);
}
export const rimT = (L, t, place) => mulT(labelT(L, t, place), trs([0, 0, -0.0012]));
export function letterT(L, j, t, place) {
  const g = L.letters[j];
  const s = seg(t, g.at, g.at + 0.16);
  const k = t < g.at ? 0 : backOut(s, 2.0);
  return mulT(labelT(L, t, place), trs([g.x, g.y, 0.0012 + 0.002 * (1 - smooth(s))], qId(), k < 0.01 ? HIDDEN : [k, k, 1]));
}
