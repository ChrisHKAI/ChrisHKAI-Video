// Paints what changes per frame for the Blender build: the code area, the
// terminal and the status bar (all at 2x UI size), plus the static glyph sheet
// and the Ctrl+Z keycap. Runs in headless Chrome (scripts/atlas.html).
import * as T from "./timeline.js";
import { SYN, BLOCK, rowColors, layoutRows, mergeAt, terminalAt } from "./code.js";
import { GLYPHS, glyphAway, glyphSlot, GLYPH_SLOT, GLYPH_SHEET } from "./glyphs.js";
import { ATLAS_SCALE as S } from "./atlas-layout.js";

const MONO = "Menlo, monospace";
const SANS = '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif';
const clamp01 = (a) => Math.min(1, Math.max(0, a));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

function rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function round(ctx, x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
}
function glowText(ctx, text, x, y, color, blur) {
  ctx.fillStyle = color;
  if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.fillText(text, x, y); }
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y);
}

// conflict markers pulse on the beat through the first bar, then simmer
function markerGlow(t) {
  if (t < T.EV.markerPulse[1]) {
    const d = (t % T.BEAT) / T.BEAT;
    return 0.45 + 0.55 * Math.exp(-d * 4);
  }
  return 0.35 + 0.1 * Math.sin(t * 6);
}

// ── Code area ───────────────────────────────────────────────────────────────
export function drawCode(ctx, t) {
  const [X0, Y0] = T.CODE;
  const W = T.CODE[2] * S, H = T.CODE[3] * S;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  rect(ctx, 0, 0, W, H, "#1f1f1f");
  ctx.scale(S, S);
  ctx.translate(-X0, -Y0);
  const m = mergeAt(t);
  const mg = markerGlow(t);
  const rows = layoutRows(t);
  ctx.textBaseline = "middle";

  // block backgrounds
  for (const r of rows) {
    const k = r.row.kind;
    const h = T.ROW_H * r.h;
    if (h < 0.3) continue;
    let fill = null;
    if (k === "markOurs") fill = BLOCK.ours.head;
    else if (k === "ours") fill = BLOCK.ours.bg;
    else if (k === "markTheirs") fill = BLOCK.theirs.head;
    else if (k === "theirs") fill = BLOCK.theirs.bg;
    else if (k === "markMid") fill = "rgba(140,140,140,0.18)";
    if (!fill) continue;
    ctx.globalAlpha = (k.startsWith("mark") ? r.alpha * (0.7 + 0.5 * mg) : 1 - m);
    rect(ctx, X0, r.top, T.CODE[2], h, fill);
    ctx.globalAlpha = 1;
  }
  // added-line bars after the merge
  if (m > 0) {
    for (const r of rows) {
      if (r.row.kind !== "ours" && r.row.kind !== "theirs") continue;
      ctx.globalAlpha = m;
      rect(ctx, 452, r.top + 4, 5, T.ROW_H - 8, "#3fb950");
      ctx.globalAlpha = 1;
    }
  }
  // merge flash sweeping down the old conflict
  const fl = t - T.EV.merge[0];
  if (fl > 0 && fl < 0.45) {
    const a = 1 - fl / 0.45;
    const g = ctx.createLinearGradient(X0, 0, X0 + T.CODE[2], 0);
    g.addColorStop(0, `rgba(217,119,87,${0.35 * a})`);
    g.addColorStop(1, `rgba(77,107,254,${0.35 * a})`);
    const top = rows[6].top, bot = rows[10].top + T.ROW_H * rows[10].h;
    rect(ctx, X0, top - 4, T.CODE[2], Math.max(T.ROW_H, bot - top) + 8, g);
  }

  for (const r of rows) {
    const h = T.ROW_H * r.h;
    if (h < 1) continue;
    const cy = r.top + h / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(X0, r.top, T.CODE[2], h); ctx.clip();
    ctx.globalAlpha = r.alpha;
    // line numbers
    if (r.num !== null) {
      const lit = T.LINE_LIGHTS.find((l) => l.row === r.i && t >= l.t && t < l.t + 1.2);
      ctx.font = `${T.CODE_FONT - 2}px ${MONO}`;
      ctx.textAlign = "right";
      if (lit) {
        const a = 1 - (t - lit.t) / 1.2;
        round(ctx, 384, r.top + 3, 64, T.ROW_H - 6, 6, `rgba(217,119,87,${0.55 * a})`);
        glowText(ctx, String(r.num), T.GUTTER_X, cy + 1, `rgba(255,214,196,${0.5 + 0.5 * a})`, 18 * a);
      } else {
        ctx.fillStyle = r.row.kind === "ours" ? "#C8C8C8" : SYN.num;
        ctx.fillText(String(r.num), T.GUTTER_X, cy + 1);
      }
      ctx.textAlign = "left";
    }
    if (r.row.kind === "lens") drawLens(ctx, cy, t);
    else if (r.row.text) {
      ctx.font = `${T.CODE_FONT}px ${MONO}`;
      const cols = rowColors(r.row);
      const mark = r.row.kind && r.row.kind.startsWith("mark");
      const isMid = r.row.kind === "markMid";
      [...r.row.text].forEach((ch, c) => {
        if (ch === " ") return;
        if (GLYPHS.some((g) => g.row === r.i && g.col === c && glyphAway(g, t))) return;
        const blur = mark && !isMid ? 14 * mg : 0;
        glowText(ctx, ch, T.colX(c), cy + 1, cols[c], blur);
      });
      if (mark && !isMid) {
        ctx.font = `italic ${T.CODE_FONT - 6}px ${SANS}`;
        ctx.fillStyle = "rgba(200,200,200,0.55)";
        const note = r.row.kind === "markOurs" ? "(Current Change)" : "(Incoming Change)";
        ctx.fillText(note, T.colX(r.row.text.length + 2), cy + 1);
      }
    }
    ctx.restore();
  }
  // caret on the return line
  const ret = rows[11];
  if (Math.floor(t * 1.6) % 2 === 0) rect(ctx, T.colX(ret.row.text.length) + 2, ret.top + 7, 2.5, T.ROW_H - 14, "#AEAFAD");
  // "Resolve in Merge Editor" until the merge
  if (m < 1) {
    ctx.globalAlpha = 1 - m;
    round(ctx, 1384, 676, 252, 40, 5, "#0078D4");
    ctx.font = `500 18px ${SANS}`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText("Resolve in Merge Editor", 1510, 697);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }
  // a hairline where the editor meets the gutter
  rect(ctx, 468, T.CODE[1], 1, T.CODE[3], "rgba(255,255,255,0.04)");
  ctx.restore();
}

function drawLens(ctx, cy, t) {
  const [bx, by, bw, bh] = T.ACCEPT_BOTH;
  ctx.font = `${T.LENS_FONT}px ${SANS}`;
  ctx.fillStyle = SYN.lens;
  const left = "Accept Current Change  |  Accept Incoming Change  |";
  const w = ctx.measureText(left).width;
  const k = Math.min(1, (bx - 12 - T.CODE_X) / w);
  ctx.save();
  ctx.translate(T.CODE_X, cy + 1);
  ctx.scale(k, 1);
  ctx.fillText(left, 0, 0);
  ctx.restore();
  ctx.fillText("|  Compare Changes", bx + bw + 12, cy + 1);
  // the slot the raised button stands in
  round(ctx, bx - 2, by - 2, bw + 4, bh + 4, 9, "#141414");
}

// ── Terminal ────────────────────────────────────────────────────────────────
export function drawTerm(ctx, t) {
  const [X0, Y0, w, h] = T.TERM;
  ctx.save();
  ctx.clearRect(0, 0, w * S, h * S);
  rect(ctx, 0, 0, w * S, h * S, "#181818");
  ctx.scale(S, S);
  ctx.textBaseline = "middle";
  ctx.font = `${T.TERM_FONT}px ${MONO}`;
  const lines = terminalAt(t);
  lines.forEach((l, i) => {
    const y = 12 + i * T.TERM_LINE + T.TERM_LINE / 2;
    let x = 12;
    if (l.prefix) {
      const at = l.prefix.indexOf("$");
      glowText(ctx, l.prefix.slice(0, at), x, y, "#4EC9B0", 0);
      x += at * T.TERM_CHAR_W;
      glowText(ctx, l.prefix.slice(at), x, y, "#D4D4D4", 0);
      x += (l.prefix.length - at) * T.TERM_CHAR_W;
    }
    const fresh = l.glow ? Math.max(0.4, 1 - l.age * 0.6) : 0;
    glowText(ctx, l.text, x, y, l.color, 16 * fresh);
    x += l.text.length * T.TERM_CHAR_W;
    if (l.progress !== null) {
      const n = 24, on = Math.round(l.progress * n);
      for (let k = 0; k < n; k++) rect(ctx, x + k * 13, y - 9, 11, 18, k < on ? "#FF8A5C" : "#3a3a3a");
      ctx.fillStyle = "#B0B0B0";
      ctx.fillText(`${Math.round(l.progress * 100)}%`, x + n * 13 + 12, y);
    }
    if (l.caret && Math.floor(t * 1.6) % 2 === 0) rect(ctx, x + 2, y - 12, T.TERM_CHAR_W, 24, "#CCCCCC");
  });
  ctx.restore();
}

// ── Status bar ──────────────────────────────────────────────────────────────
export function drawStatus(ctx, t) {
  const [, , w, h] = T.STATUS;
  ctx.save();
  ctx.clearRect(0, 0, w * S, h * S);
  ctx.scale(S, S);
  const pass = seg(t, T.EV.buildPassed, T.EV.buildPassed + 0.25);
  rect(ctx, 0, 0, w, h, "#181818");
  if (pass > 0) rect(ctx, 0, 0, w * pass, h, "#1F8F4E");
  const hot = t >= T.EV.explode && t < T.EV.explode + 0.6 ? 1 - (t - T.EV.explode) / 0.6 : 0;
  if (hot > 0 && pass === 0) rect(ctx, 0, 0, w, h, `rgba(200,60,60,${0.5 * hot})`);
  ctx.textBaseline = "middle";
  ctx.font = `500 19px ${SANS}`;
  const done = pass > 0.5;
  const y = h / 2 + 1;
  ctx.fillStyle = done ? "#FFFFFF" : "#CCCCCC";
  round(ctx, 0, 0, 50, h, 0, done ? "#16723E" : "#0078D4");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("><", 13, y);
  ctx.fillStyle = done ? "#FFFFFF" : "#CCCCCC";
  ctx.fillText(done ? "⎇ main" : "⎇ main*", 70, y);
  if (!done) {
    round(ctx, 172, 8, 108, h - 16, 4, "rgba(255,255,255,0.08)");
    ctx.fillStyle = "#E2C08D";
    ctx.fillText("MERGING", 186, y);
    round(ctx, 296, 8, 132, h - 16, 4, "#C74E39");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("⊗ 1 conflict", 308, y);
  } else {
    ctx.font = `600 20px ${SANS}`;
    ctx.fillText("✓ Build passed", 186, y);
    ctx.font = `500 19px ${SANS}`;
    ctx.fillText("⊗ 0   ⚠ 0", 360, y);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = done ? "#FFFFFF" : "#CCCCCC";
  ctx.fillText(done ? "Ln 7, Col 28     Spaces: 4     UTF-8     LF     Python" : "Ln 7, Col 24     Spaces: 4     UTF-8     LF     Python", w - 30, y);
  ctx.restore();
}

// ── Glyph sheet and keycap ──────────────────────────────────────────────────
export function drawGlyphSheet(ctx) {
  ctx.clearRect(0, 0, GLYPH_SHEET[0], GLYPH_SHEET[1]);
  const px = GLYPH_SLOT[0] / T.CHAR_W; // sheet px per mm
  ctx.font = `${T.CODE_FONT * px}px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  GLYPHS.forEach((g, i) => {
    const [x, y] = glyphSlot(i);
    const col = rowColors(T.ROWS[g.row])[g.col];
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.fillStyle = col;
    ctx.fillText(g.ch, x + GLYPH_SLOT[0] / 2, y + GLYPH_SLOT[1] / 2 + 4);
  });
  ctx.shadowBlur = 0;
}
export function drawKeycap(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  round(ctx, 0, 0, w, h, 26, "#C9CBD3");
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#F7F8FB");
  g.addColorStop(1, "#E3E5EC");
  round(ctx, 14, 10, w - 28, h - 26, 20, g);
  ctx.fillStyle = "#1E2028";
  ctx.font = `700 ${h * 0.42}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Ctrl+Z", w / 2, h / 2 - 6);
}
