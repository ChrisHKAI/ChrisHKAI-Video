// Code characters the headbutt knocks off the conflict lines. They tear off
// their cells at the hit, hang in the air, and the Ctrl+Z puts them back.
// The atlas blanks each cell while its glyph is away.
import * as T from "./timeline.js";
import { mulberry32 } from "./rng.js";

const rng = mulberry32(77);
const [cx, cy] = T.SPOT.contact;

export const GLYPHS = [];
for (const r of [6, 7, 9]) {
  const text = T.ROWS[r].text;
  [...text].forEach((ch, c) => {
    if (ch === " ") return;
    const x = T.colX(c) + T.CHAR_W / 2, y = T.rowCenterY(r);
    if (x < 650 || x > 900) return;
    const d = Math.hypot(x - cx, y - cy) / 1000;
    const ang = Math.atan2(y - cy, x - cx) + (rng() - 0.5) * 0.9;
    const sp = 0.4 + rng() * 0.5;
    GLYPHS.push({
      row: r, col: c, ch, x, y,
      popAt: T.EV.hit + d / 2.2,
      backAt: T.EV.rewind[1] + (rng() - 0.5) * 0.06,
      v: [Math.cos(ang) * sp, 0.45 + rng() * 0.5, Math.sin(ang) * sp * 0.8],
      spin: [rng() * 12 - 6, rng() * 12 - 6, rng() * 12 - 6],
    });
  });
}
export const GLYPH_SLOT = [64, 96]; // sheet cell size (px)
export const GLYPH_COLS = 8;
export const glyphSlot = (i) => [(i % GLYPH_COLS) * GLYPH_SLOT[0], Math.floor(i / GLYPH_COLS) * GLYPH_SLOT[1]];
export const GLYPH_SHEET = [GLYPH_COLS * GLYPH_SLOT[0], Math.ceil(GLYPHS.length / GLYPH_COLS) * GLYPH_SLOT[1]];

// is the glyph off its cell at t?
export const glyphAway = (g, t) => t >= g.popAt && t < g.backAt;
