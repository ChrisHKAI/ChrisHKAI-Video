// The comp is a canvas: everything the whale builds inside After Effects is
// drawn here per frame from film time, so keyframes and the playhead ride
// follow real AE logic (the comp shows the pose at the playhead's comp time).
import { EV, KEY_STAMP_TIMES, KEY_COMP_TIMES, COMP_POSES, HERO_UNIT, BRAND, ctiTime } from "./timeline.js";
import { mulberry32 } from "./rng.js";

export const COMP_W = 1920;
export const COMP_H = 1080;
// The whale's flat PNG matches the 3D card: 17 units wide at HERO_UNIT mm per
// unit, and the comp (1920 wide) is shown COMP[2] = 732 mm wide on the panel.
const SPRITE_W = 17 * HERO_UNIT * (1920 / 732);

const clamp01 = (a) => Math.min(1, Math.max(0, a));
const smooth = (a) => a * a * (3 - 2 * a);
const easeOut = (a) => 1 - Math.pow(1 - a, 3);
const easeInOut = (a) => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
const lerp = (a, b, s) => a + (b - a) * s;


const ACCENT = BRAND.color;
const ACCENT_HOT = "#a9b9ff";
const GLOW = (a) => `rgba(77,107,254,${a})`;
const TITLE_MAX_W = 1400;
const titleFont = (px) => `900 ${px}px Montserrat, 'Arial Black', sans-serif`;
const SUB_FONT = "900 62px Montserrat, 'Arial Black', sans-serif";

// ── The whale, side view, facing left ───────────────────────────────────────
// Drawn in a unit box x in [-1, 1], y in [-0.64, 0.48] (y down), scaled by k.
function whalePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-1.0, 0.08);
  ctx.bezierCurveTo(-1.0, -0.3, -0.62, -0.46, -0.18, -0.42);
  ctx.bezierCurveTo(0.18, -0.38, 0.4, -0.22, 0.52, -0.05);
  ctx.quadraticCurveTo(0.66, -0.1, 0.7, -0.38);
  ctx.bezierCurveTo(0.6, -0.5, 0.52, -0.62, 0.62, -0.64);
  ctx.bezierCurveTo(0.7, -0.62, 0.76, -0.54, 0.8, -0.47);
  ctx.bezierCurveTo(0.86, -0.6, 0.98, -0.62, 1.0, -0.56);
  ctx.bezierCurveTo(0.98, -0.46, 0.9, -0.4, 0.84, -0.36);
  ctx.bezierCurveTo(0.8, -0.12, 0.7, 0.18, 0.4, 0.3);
  ctx.bezierCurveTo(0.05, 0.46, -0.55, 0.48, -0.85, 0.32);
  ctx.bezierCurveTo(-0.97, 0.26, -1.0, 0.18, -1.0, 0.08);
  ctx.closePath();
}

// style "logo": flat brand blue with a white eye; "mascot": the toy, with a
// lighter belly and a black eye slit (or ^ when happy)
export function drawWhale(ctx, cx, cy, k, { style = "logo", glow = 0, happy = false } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  if (glow > 0) {
    ctx.shadowColor = GLOW(0.95 * glow);
    ctx.shadowBlur = 34 * glow;
  }
  whalePath(ctx);
  ctx.fillStyle = style === "logo" && glow > 0 ? "#6f88ff" : ACCENT;
  ctx.fill();
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0;
  if (style === "mascot") {
    ctx.save();
    whalePath(ctx);
    ctx.clip();
    ctx.fillStyle = "#b9c6ff";
    ctx.beginPath();
    ctx.ellipse(-0.28, 0.46, 0.78, 0.22, 0.04, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, -0.5, 0, 0.5);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-1.1, -0.7, 2.2, 1.3);
    ctx.restore();
  }
  // pectoral fin (the toy only; the logo is a clean silhouette)
  if (style === "mascot") {
    ctx.fillStyle = "#3a55dc";
    ctx.beginPath();
    ctx.ellipse(-0.16, 0.28, 0.18, 0.065, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // eye
  if (style === "logo") {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-0.62, -0.06, 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else if (happy) {
    ctx.strokeStyle = "#0b0d1a";
    ctx.lineWidth = 0.05;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(-0.6, -0.02, 0.07, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#0b0d1a";
    roundRect(ctx, -0.63, -0.13, 0.06, 0.16, 0.03);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Pose of the title group at film time t ──────────────────────────────────
function lerpPose(a, b, s) {
  return { x: lerp(a.x, b.x, s), y: lerp(a.y, b.y, s), rot: lerp(a.rot, b.rot, s), scale: lerp(a.scale, b.scale, s) };
}
export function titlePose(t) {
  const centred = COMP_POSES[3];
  if (t < KEY_STAMP_TIMES[0]) return centred;
  if (t < KEY_STAMP_TIMES[3] + 0.2) {
    // stamping: the comp jumps to the pose of the newest keyframe
    let k = 0;
    for (let i = 0; i < 4; i++) if (t >= KEY_STAMP_TIMES[i]) k = i;
    return COMP_POSES[k];
  }
  const ct = ctiTime(t);
  if (ct <= KEY_COMP_TIMES[0]) return COMP_POSES[0];
  for (let i = 1; i < 4; i++) {
    if (ct <= KEY_COMP_TIMES[i]) {
      const s = (ct - KEY_COMP_TIMES[i - 1]) / (KEY_COMP_TIMES[i] - KEY_COMP_TIMES[i - 1]);
      return lerpPose(COMP_POSES[i - 1], COMP_POSES[i], easeInOut(s));
    }
  }
  return COMP_POSES[3];
}

// ── Pieces of the lockup ────────────────────────────────────────────────────
function swooshPoint(s) {
  // gentle wave under the title, left to right
  const x = lerp(610, 1300, s);
  const y = 640 + Math.sin(s * Math.PI * 1.15 + 0.2) * -18 + s * 8;
  return [x, y];
}
function drawSwoosh(ctx, progress, glow) {
  if (progress <= 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = glow > 0 ? ACCENT_HOT : ACCENT;
  if (glow > 0) {
    ctx.shadowColor = GLOW(0.9 * glow);
    ctx.shadowBlur = 26 * glow;
  }
  const n = 80;
  const end = Math.max(1, Math.floor(n * progress));
  // tapered stroke: draw short segments with growing then shrinking width
  for (let i = 0; i < end; i++) {
    const a = swooshPoint(i / n), b = swooshPoint((i + 1) / n);
    const s = i / n;
    ctx.lineWidth = 3 + 11 * Math.sin(Math.PI * Math.min(1, s * 1.05));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  // pen nib dot while drawing
  if (progress < 1) {
    const p = swooshPoint(progress);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function spacedText(ctx, text, x, y, spacing) {
  // canvas letterSpacing exists, but measure by hand so typing never shifts
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - spacing - x;
}
function spacedWidth(ctx, text, spacing) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

// Seeded data
const rngP = mulberry32(510);
const PARTICLES = Array.from({ length: 70 }, () => ({
  a: rngP() * Math.PI * 2,
  v: 260 + rngP() * 620,
  life: 0.6 + rngP() * 0.8,
  size: 2 + rngP() * 5,
  hot: rngP() < 0.4,
  dy: (rngP() - 0.5) * 160,
}));
const rngC = mulberry32(77);
const CRACKS = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * Math.PI * 2 + rngC() * 0.4;
  const pts = [[0, 0]];
  let r = 0, ang = a;
  const segs = 3 + Math.floor(rngC() * 3);
  for (let s = 0; s < segs; s++) {
    r += 18 + rngC() * 42;
    ang += (rngC() - 0.5) * 0.5;
    pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
  }
  return pts;
});
const TWINKLES = Array.from({ length: 18 }, () => ({
  x: 560 + rngP() * 800, y: 330 + rngP() * 420, ph: rngP(), s: 4 + rngP() * 7,
}));

// ── The whole comp at film time t ───────────────────────────────────────────
export function drawComp(ctx, t) {
  const W = COMP_W, H = COMP_H;
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  const glow = smooth(clamp01((t - (EV.glowOn - 0.05)) / 0.35));

  // background: black, warming once the glow is on
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, W, H);
  if (glow > 0) {
    const g = ctx.createRadialGradient(960, 520, 40, 960, 520, 900);
    g.addColorStop(0, `rgba(30,48,150,${0.5 * glow})`);
    g.addColorStop(0.45, `rgba(10,16,60,${0.5 * glow})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 0 – 1.5 s: the whale as a flat PNG layer, selected, knocking from inside
  if (t < EV.peel[0]) {
    let bump = 0;
    for (const k of EV.knocks) {
      const d = t - k;
      if (d >= 0 && d < 0.22) bump = Math.max(bump, Math.sin((d / 0.22) * Math.PI) * (1 - d / 0.22));
    }
    const k = (SPRITE_W / 2) * (1 + 0.16 * bump);
    const cx = 960, cy = 540;
    drawWhale(ctx, cx, cy + 0.08 * k, k, { style: "mascot" });
    // selection box with handles + anchor point
    const hw = SPRITE_W / 2 + 14, hh = 0.56 * (SPRITE_W / 2) + 14;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.fillStyle = "#ffffff";
    for (const [hx, hy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      ctx.fillRect(cx + hx * hw - 6, cy + hy * hh - 6, 12, 12);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
    ctx.stroke();
    // knock ripples on the glass
    for (const k of EV.knocks) {
      const d = t - k;
      if (d >= 0 && d < 0.5) {
        const a = 1 - d / 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * a})`;
        ctx.lineWidth = 4 * a + 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 90 + d * 700, 60 + d * 470, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (t < EV.pop) {
    // the layer is empty while he peels off as a card (the card lives in 3D)
    const s = clamp01((t - EV.peel[0]) / 0.12);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - s)})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(960 - SPRITE_W / 2 - 14, 540 - 0.56 * (SPRITE_W / 2) - 14, SPRITE_W + 28, 1.12 * (SPRITE_W / 2) + 28);
  }

  // cracks where he broke out
  if (t >= EV.pop && t < EV.pop + 1.0) {
    const a = 1 - smooth(clamp01((t - EV.pop - 0.15) / 0.4));
    const grow = easeOut(clamp01((t - EV.pop) / 0.1));
    ctx.save();
    ctx.translate(960, 540);
    ctx.strokeStyle = `rgba(230,240,255,${0.7 * a})`;
    ctx.lineWidth = 2;
    for (const pts of CRACKS) {
      ctx.beginPath();
      const n = Math.max(2, Math.ceil(pts.length * grow));
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${0.25 * a})`;
    ctx.beginPath();
    ctx.arc(0, 0, 46 * grow, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // the lockup
  const pose = titlePose(t);
  ctx.save();
  ctx.translate(960 + pose.x, 540 + pose.y);
  ctx.rotate((pose.rot * Math.PI) / 180);
  ctx.scale(pose.scale, pose.scale);
  ctx.translate(-960, -540);

  if (glow > 0) {
    const g = ctx.createRadialGradient(960, 520, 10, 960, 520, 620);
    g.addColorStop(0, GLOW(0.24 * glow));
    g.addColorStop(1, GLOW(0));
    ctx.fillStyle = g;
    ctx.fillRect(-1000, -1000, 3920, 3080); // past the frame: no visible box edge
  }

  // whale logo (Rectangle tool): pops with overshoot and a wiggle
  if (t >= EV.sparkAt) {
    const s = clamp01((t - EV.sparkAt) / 0.32);
    const over = s < 1 ? easeOut(s) * (1 + 0.25 * Math.sin(s * Math.PI)) : 1;
    const wiggle = (1 - easeOut(s)) * -0.35;
    ctx.save();
    ctx.translate(960, 350);
    ctx.rotate(wiggle);
    drawWhale(ctx, 0, 0, 132 * over, { style: "logo", glow });
    ctx.restore();
  }

  // title (Type tool): one letter per key tap
  const typed = EV.typeLetters;
  const n = t < EV.typeAt ? 0 : Math.min(typed.length, Math.floor(((t - EV.typeAt - 0.03) / EV.typeDur) * typed.length) + 1);
  if (n > 0) {
    ctx.font = titleFont(134);
    ctx.textBaseline = "alphabetic";
    const spacing = 4;
    const fit = Math.min(1, TITLE_MAX_W / spacedWidth(ctx, typed, spacing));
    ctx.font = titleFont(Math.floor(134 * fit));
    const full = spacedWidth(ctx, typed, spacing);
    const x0 = 960 - full / 2, y0 = 580;
    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = GLOW(glow);
      ctx.shadowBlur = 44 * glow;
      ctx.fillStyle = "#eef1ff";
      spacedText(ctx, typed.slice(0, n), x0, y0, spacing);
      ctx.shadowBlur = 14 * glow;
      ctx.shadowColor = `rgba(150,170,255,${glow})`;
    }
    ctx.fillStyle = glow > 0 ? "#f7f8ff" : "#f1f2f6";
    const w = spacedText(ctx, typed.slice(0, n), x0, y0, spacing);
    ctx.restore();
    if (t < EV.sparkAt) {
      // type cursor
      ctx.fillStyle = "#4ea3ff";
      ctx.fillRect(x0 + w + 8, y0 - 86, 6, 100);
    }
  }

  // swoosh (Pen tool)
  if (t >= EV.swooshAt) {
    drawSwoosh(ctx, easeInOut(clamp01((t - EV.swooshAt) / EV.swooshDur)), glow);
  }

  // subtitle on Play
  if (t >= EV.play) {
    const s = easeOut(clamp01((t - EV.play - 0.04) / 0.45));
    ctx.save();
    ctx.font = SUB_FONT;
    ctx.globalAlpha = s;
    ctx.fillStyle = "#9fb1ff";
    ctx.shadowColor = GLOW(0.95);
    ctx.shadowBlur = 22;
    const spacing = lerp(42, 20, s);
    const w = spacedWidth(ctx, BRAND.subtitle, spacing);
    spacedText(ctx, BRAND.subtitle, 960 - w / 2, 742 + (1 - s) * 24, spacing);
    ctx.restore();
  }
  ctx.restore();

  // glow-on shimmer twinkles
  if (t >= EV.glowOn - 0.05) {
    for (const tw of TWINKLES) {
      const d = t - EV.glowOn - tw.ph * 0.6;
      if (d < 0 || d > 0.7) continue;
      const a = Math.sin((d / 0.7) * Math.PI);
      drawTwinkle(ctx, tw.x, tw.y, tw.s * (0.6 + a), a);
    }
  }

  // chip lands in the comp: ring
  {
    const d = t - EV.chipLand;
    if (d >= 0 && d < 0.4) {
      const a = 1 - d / 0.4;
      ctx.strokeStyle = `rgba(110,180,255,${0.8 * a})`;
      ctx.lineWidth = 8 * a + 1;
      ctx.beginPath();
      ctx.arc(960, 540, 60 + d * 1400, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Play: flash, particles, a glint across the title
  if (t >= EV.play) {
    const d = t - EV.play;
    for (const p of PARTICLES) {
      if (d > p.life) continue;
      const k = d / p.life;
      const r = p.v * easeOut(Math.min(1, d * 1.6)) * 0.9;
      const x = 960 + Math.cos(p.a) * r * 1.4;
      const y = 520 + Math.sin(p.a) * r * 0.75 + p.dy * k + 120 * k * k;
      ctx.fillStyle = p.hot ? `rgba(235,240,255,${1 - k})` : `rgba(110,140,255,${1 - k})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (1 - 0.5 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    const gl = clamp01((d - 0.1) / 0.55);
    if (gl > 0 && gl < 1) {
      const gx = lerp(420, 1500, easeInOut(gl));
      const g = ctx.createLinearGradient(gx - 90, 0, gx + 90, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(235,240,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.transform(1, 0, -0.35, 1, 0, 0);
      ctx.fillRect(gx - 90 + 180, 400, 180, 260);
      ctx.restore();
    }
    const flash = Math.max(0, 1 - d / 0.32);
    if (flash > 0) {
      ctx.fillStyle = `rgba(225,232,255,${0.75 * flash * flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

function drawTwinkle(ctx, x, y, s, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(220,230,255,${a})`;
  ctx.beginPath();
  ctx.moveTo(0, -s * 2);
  ctx.quadraticCurveTo(0, 0, s * 2, 0);
  ctx.quadraticCurveTo(0, 0, 0, s * 2);
  ctx.quadraticCurveTo(0, 0, -s * 2, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s * 2);
  ctx.fill();
  ctx.restore();
}

// ── The "fx Glow" chip (416x104) ─────────────────────────────────────────────
export function drawChip(ctx) {
  ctx.fillStyle = "#2f6fbf";
  ctx.beginPath();
  ctx.roundRect(0, 0, 416, 104, 14);
  ctx.fill();
  ctx.fillStyle = "#1f4f8f";
  ctx.beginPath();
  ctx.roundRect(22, 26, 70, 52, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px -apple-system, 'Helvetica Neue', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("fx", 36, 54);
  ctx.font = "700 52px -apple-system, 'Helvetica Neue', sans-serif";
  ctx.fillText("Glow", 118, 56);
}
// ── Timecode as AE draws it: 0;00;06;15 ─────────────────────────────────────
export function timecode(compSeconds) {
  const f = Math.round(compSeconds * 30);
  const ff = f % 30, ss = Math.floor(f / 30) % 60, mm = Math.floor(f / 1800);
  return `0;${String(mm).padStart(2, "0")};${String(ss).padStart(2, "0")};${String(ff).padStart(2, "0")}`;
}

