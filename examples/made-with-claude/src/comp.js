// The comp is a canvas: everything Clawd builds inside After Effects is drawn
// here per frame from film time, so keyframes and the playhead ride follow
// real AE logic (the comp shows the pose at the playhead's comp time).
import {
  EV, HOPS, KEY_STAMP_TIMES, KEY_COMP_TIMES, COMP_POSES, CLAWD_UNIT, CLAWD_COLOR, ctiTime,
} from "./timeline.js";

export const COMP_W = 1920;
export const COMP_H = 1080;
// Clawd's flat PNG matches his 3D size: CLAWD_UNIT mm per unit, and the comp
// (1920 wide) is shown COMP[2] mm wide on the panel.
const SPRITE_U = CLAWD_UNIT * (1920 / 732);

const clamp01 = (a) => Math.min(1, Math.max(0, a));
const smooth = (a) => a * a * (3 - 2 * a);
const easeOut = (a) => 1 - Math.pow(1 - a, 3);
const easeInOut = (a) => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
const lerp = (a, b, s) => a + (b - a) * s;

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ORANGE = "#f08a4e";
const ORANGE_HOT = "#ffb27a";
const TITLE_FONT = "900 134px Montserrat, 'Arial Black', sans-serif";
const SUB_FONT = "800 86px Montserrat, 'Arial Black', sans-serif";

// ── Clawd as a flat PNG (front view), centred on cx, cy; u = px per unit ────
export function drawClawdSprite(ctx, cx, cy, u, { happy = false } = {}) {
  const bw = 12 * u, bh = 8 * u, legH = 1.6 * u;
  const top = cy - (bh + legH) / 2;
  ctx.save();
  ctx.fillStyle = "#b9583d";
  for (const lx of [-4.5, -1.5, 1.5, 4.5]) {
    ctx.fillRect(cx + lx * u - 0.7 * u, top + bh - 0.2 * u, 1.4 * u, legH + 0.2 * u);
  }
  ctx.fillStyle = "#c9654a";
  for (const s of [-1, 1]) {
    roundRect(ctx, cx + s * (6.6 * u) - 0.7 * u, top + 2.6 * u, 1.4 * u, 2.2 * u, 0.4 * u);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, top, 0, top + bh);
  g.addColorStop(0, "#e58a6b");
  g.addColorStop(1, CLAWD_COLOR);
  ctx.fillStyle = g;
  roundRect(ctx, cx - bw / 2, top, bw, bh, 1.2 * u);
  ctx.fill();
  ctx.fillStyle = "#141010";
  if (happy) {
    ctx.strokeStyle = "#141010";
    ctx.lineWidth = 0.55 * u;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * 2.8 * u, top + 3.9 * u, 0.9 * u, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      roundRect(ctx, cx + s * 2.8 * u - 0.45 * u, top + 2.4 * u, 0.9 * u, 2 * u, 0.3 * u);
      ctx.fill();
    }
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
function drawSpark(ctx, x, y, r, glow) {
  const rays = 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = glow > 0 ? ORANGE_HOT : ORANGE;
  if (glow > 0) {
    ctx.shadowColor = `rgba(255,120,50,${0.9 * glow})`;
    ctx.shadowBlur = 30 * glow;
  }
  for (let i = 0; i < rays; i++) {
    ctx.save();
    ctx.rotate((i / rays) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.12);
    ctx.quadraticCurveTo(r * 0.11, -r * 0.55, 0, -r);
    ctx.quadraticCurveTo(-r * 0.11, -r * 0.55, 0, -r * 0.12);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

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
  ctx.strokeStyle = glow > 0 ? ORANGE_HOT : ORANGE;
  if (glow > 0) {
    ctx.shadowColor = `rgba(255,120,50,${0.9 * glow})`;
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
  ctx.fillStyle = "#020101";
  ctx.fillRect(0, 0, W, H);
  if (glow > 0) {
    const g = ctx.createRadialGradient(960, 520, 40, 960, 520, 900);
    g.addColorStop(0, `rgba(120,46,18,${0.55 * glow})`);
    g.addColorStop(0.45, `rgba(50,16,6,${0.5 * glow})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // 0 – 1.5 s: Clawd as a flat PNG layer, selected, knocking from inside
  if (t < EV.peel[0]) {
    let bump = 0;
    for (const k of EV.knocks) {
      const d = t - k;
      if (d >= 0 && d < 0.22) bump = Math.max(bump, Math.sin((d / 0.22) * Math.PI) * (1 - d / 0.22));
    }
    const u = SPRITE_U * (1 + 0.16 * bump);
    const cx = 960, cy = 540;
    drawClawdSprite(ctx, cx, cy, u);
    // selection box with handles + anchor point
    const hw = 6.9 * SPRITE_U + 12, hh = 4.8 * SPRITE_U + 12;
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
    ctx.strokeRect(960 - 6.9 * SPRITE_U - 12, 540 - 4.8 * SPRITE_U - 12, 13.8 * SPRITE_U + 24, 9.6 * SPRITE_U + 24);
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
    g.addColorStop(0, `rgba(255,120,50,${0.22 * glow})`);
    g.addColorStop(1, "rgba(255,120,50,0)");
    ctx.fillStyle = g;
    ctx.fillRect(200, 100, 1520, 880);
  }

  // spark (Rectangle tool): pops with overshoot
  if (t >= EV.sparkAt) {
    const s = clamp01((t - EV.sparkAt) / 0.32);
    const over = s < 1 ? easeOut(s) * (1 + 0.25 * Math.sin(s * Math.PI)) : 1;
    const spin = (1 - easeOut(s)) * -0.8;
    ctx.save();
    ctx.translate(960, 350);
    ctx.rotate(spin);
    drawSpark(ctx, 0, 0, 78 * over, glow);
    ctx.restore();
  }

  // title (Type tool): one letter per key tap
  const typed = EV.typeLetters;
  const n = t < EV.typeAt ? 0 : Math.min(typed.length, Math.floor(((t - EV.typeAt - 0.03) / EV.typeDur) * typed.length) + 1);
  if (n > 0) {
    ctx.font = TITLE_FONT;
    ctx.textBaseline = "alphabetic";
    const spacing = 4;
    const full = spacedWidth(ctx, typed, spacing);
    const x0 = 960 - full / 2, y0 = 580;
    ctx.save();
    if (glow > 0) {
      ctx.shadowColor = `rgba(255,110,40,${glow})`;
      ctx.shadowBlur = 44 * glow;
      ctx.fillStyle = "#fff3ea";
      spacedText(ctx, typed.slice(0, n), x0, y0, spacing);
      ctx.shadowBlur = 14 * glow;
      ctx.shadowColor = `rgba(255,170,110,${glow})`;
    }
    ctx.fillStyle = glow > 0 ? "#fffaf5" : "#f4f1ee";
    const w = spacedText(ctx, typed.slice(0, n), x0, y0, spacing);
    ctx.restore();
    if (t < EV.sparkAt) {
      // type cursor
      ctx.fillStyle = "#4ea3ff";
      ctx.fillRect(x0 + w + 8, y0 - 96, 6, 112);
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
    ctx.fillStyle = "#ffa66e";
    ctx.shadowColor = "rgba(255,110,40,0.9)";
    ctx.shadowBlur = 22;
    const spacing = lerp(70, 34, s);
    const w = spacedWidth(ctx, "OPUS 5.5", spacing);
    spacedText(ctx, "OPUS 5.5", 960 - w / 2, 748 + (1 - s) * 24, spacing);
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
      ctx.fillStyle = p.hot ? `rgba(255,240,220,${1 - k})` : `rgba(255,150,80,${1 - k})`;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (1 - 0.5 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    const gl = clamp01((d - 0.1) / 0.55);
    if (gl > 0 && gl < 1) {
      const gx = lerp(420, 1500, easeInOut(gl));
      const g = ctx.createLinearGradient(gx - 90, 0, gx + 90, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,245,235,0.55)");
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
      ctx.fillStyle = `rgba(255,236,220,${0.75 * flash * flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

function drawTwinkle(ctx, x, y, s, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(255,236,210,${a})`;
  ctx.beginPath();
  ctx.moveTo(0, -s * 2);
  ctx.quadraticCurveTo(0, 0, s * 2, 0);
  ctx.quadraticCurveTo(0, 0, 0, s * 2);
  ctx.quadraticCurveTo(0, 0, -s * 2, 0);
  ctx.quadraticCurveTo(0, 0, 0, -s * 2);
  ctx.fill();
  ctx.restore();
}

// ── Timecode as AE draws it: 0;00;06;15 ─────────────────────────────────────
export function timecode(compSeconds) {
  const f = Math.round(compSeconds * 30);
  const ff = f % 30, ss = Math.floor(f / 30) % 60, mm = Math.floor(f / 1800);
  return `0;${String(mm).padStart(2, "0")};${String(ss).padStart(2, "0")};${String(ff).padStart(2, "0")}`;
}

export const HOP_LIST = HOPS;
export { CLAWD_UNIT };
