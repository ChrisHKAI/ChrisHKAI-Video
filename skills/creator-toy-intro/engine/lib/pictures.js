// The creator's own pictures as cards a beat lays out (references/beats.md, "Their pictures, many at once"):
// any picture in the film (assets/work/…) becomes a thin card with the picture on its face, standing and facing
// the camera, as wide as asked; layouts place many at once (a grid, a wall past the frame, an arc round the toy,
// a deck), and stagger spreads their arrivals over the beat. The pictures light themselves, like the page's
// panels: the light stays on the toy.
import { readFileSync, readdirSync } from "node:fs";
import { fromFilm } from "./film.js";
import { seg } from "./math.js";
import { trs, qId, qMul, qAxis } from "./quat.js";

// a picture's size in pixels, from its header (PNG or JPEG)
export function imageSize(file) {
  const b = readFileSync(fromFilm(file));
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error(`${file}: not a PNG or JPEG picture`);
}

// the pictures in a folder of the film ("assets/work"), in name order: film-relative paths for picture()
export const pictureFiles = (dir) => readdirSync(fromFilm(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort().map((f) => `${dir.replace(/\/$/, "")}/${f}`);

// a card's face turned to the camera, as the page's panels are (beats/page-stand.js)
const UPRIGHT = qAxis([1, 0, 0], Math.PI / 2);
// file: a picture in the film; w: the card's width (m). Declare it with its geo and mat, place it with at(p, q, k):
// centred at p (world), turned by q (qId() faces the camera's +z), k its size (0 hides it)
export function picture(file, w, { thickness = 0.002 } = {}) {
  const [W, H] = imageSize(file);
  const s = w / (W * 0.001); // built at a millimetre a pixel, then scaled to w
  return {
    file, w, h: (w * H) / W,
    geo: { type: "uiBox", rect: [-W / 2, -H / 2, W, H], uvRect: [0, 0, W, H], img: { image: file, w: W, h: H }, thickness: thickness / s },
    mat: { type: "ui", image: file },
    at: (p, q = qId(), k = 1) => trs(p, qMul(q, UPRIGHT), Math.max(1e-4, s * k)),
  };
}

// where n cards go, in stage metres (x right, y up, z towards the camera): [{ p, q }], q their turn
export const layout = {
  // every card at once, in rows filling a block `width` wide whose middle is c; aspect: the cards' width / height
  grid(n, { width = 1.2, aspect = 16 / 9, gap = 0.06, c = [0, 0.45, 0], cols } = {}) {
    cols = cols ?? Math.max(1, Math.ceil(Math.sqrt((n * 16) / 9 / aspect))); // about as many rows as fill a 16:9 frame
    while (cols * Math.ceil(n / cols) < n) cols++;
    const rows = Math.ceil(n / cols), cw = width / cols, ch = (cw * (1 - gap)) / aspect + cw * gap;
    return Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols), k = i % cols;
      return { p: [c[0] + (k - (cols - 1) / 2) * cw, c[1] + ((rows - 1) / 2 - r) * ch, c[2]], q: qId(), w: cw * (1 - gap) };
    });
  },
  // the same, bigger than the frame: a wall of them, more than fits
  wall(n, opts = {}) { return layout.grid(n, { width: 2.2, ...opts }); },
  // an arc round a point (the toy), each card facing it: r the radius, span the arc (deg), y their height
  arc(n, { r = 0.55, span = 150, c = [0, 0, 0], y = 0.18 } = {}) {
    return Array.from({ length: n }, (_, i) => {
      const a = ((-span / 2 + (span * (i + 0.5)) / n) * Math.PI) / 180;
      return { p: [c[0] + r * Math.sin(a), c[1] + y, c[2] - r * Math.cos(a) + r * 0.35], q: qAxis([0, 1, 0], -a), w: Math.min(0.24, (2 * r * Math.sin((span * Math.PI) / 360)) / Math.max(n, 2)) };
    });
  },
  // a deck going away from the camera, each card a step behind the last
  stack(n, { step = [0.012, 0.01, -0.035], c = [0, 0.3, 0] } = {}) {
    return Array.from({ length: n }, (_, i) => ({ p: [c[0] + step[0] * i, c[1] + step[1] * i, c[2] + step[2] * i], q: qId() }));
  },
};

// card i of n arrives over `each` seconds, the arrivals spread across g0–g1: its progress 0 → 1 at beat time g
export const stagger = (g, i, n, g0, g1, each = 0.25) => {
  const t0 = g0 + ((g1 - g0 - each) * i) / Math.max(1, n - 1);
  return seg(g, t0, t0 + each);
};
