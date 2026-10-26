// Every moving thing's state at film time t, as plain numbers.
// scripts/export-anim.mjs samples it twice a frame for Blender. World space is
// Three.js-style: metres, +y up, floor at y = 0; each act has its own stage
// (T.STAGE) far from the others. Transforms are { p, q, s }.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "./timeline.js";
import { CAT_PARTS, JOINTS, CENTER } from "./cat.js";
import { BOTS, BOT_H } from "./props.js";
import { mulberry32 } from "./rng.js";
import { qId, qMul, qAxis, qEuler, qRot, qFromBasis, qConj, trs, apply, mulT } from "./quat.js";

export const MM = 0.001;
export const SLAB_T = 0.006;
export const HIDDEN = 1e-4;

export const clamp01 = (a) => Math.min(1, Math.max(0, a));
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
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
const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]);
export const hidden = (p) => trs(p.slice(), qId(), HIDDEN);
const E = T.EV;
const ST = (k, p) => v3.add(T.STAGE[k], p);

// ── Act 0: the page ─────────────────────────────────────────────────────────
// page-local: x right, y up, z out of the screen; origin = the page centre
export const ui = (u, v) => [(u - T.UI_W / 2) * T.PX, (T.UI_H / 2 - v) * T.PX];
const PAGE0 = [0, 0.3, 0], PAGE1 = [0.16, 0.3, -0.12];
export const PAGE_YAW = -62 * Math.PI / 180;
export function pageAt(t) {
  const s = easeInOut(seg(t, E.turn[0], E.turn[1]));
  // a little overshoot on the turn, settling by the pop
  const over = 0.05 * Math.sin(Math.PI * seg(t, E.turn[1] - 0.3, E.turn[1] + 0.5)) * (t > E.turn[1] - 0.3 ? 1 : 0);
  const p = v3.lerp(PAGE0, PAGE1, s);
  // the page sinks away once the calico has left for the next stage
  const gone = easeIn(seg(t, 7.7, 8.2));
  p[1] -= 0.6 * gone;
  return trs(ST("a", p), qAxis([0, 1, 0], PAGE_YAW * s - over * 0.3));
}
// the screen's black margins: a card behind the columns, pushed back into the dark
export function backingAt(t) {
  const d = easeIn(seg(t, E.turn[0], E.turn[0] + 0.55));
  const tr = mulT(pageAt(t), trs([0, 0, -0.008 - 0.9 * d]));
  return t > E.turn[0] + 0.6 ? hidden(tr.p) : tr;
}
// slabs part in depth (page-local z, m); nav and sidebar drift off behind
const DEPTH = { header: 0.012, banner: 0.006, info: 0.02, tabs: 0.01, pinned: 0.015 };
export function panelAt(name, t) {
  const [x, y, w, h] = T.PANELS[name];
  const c = ui(x + w / 2, y + h / 2);
  const s = easeInOut(seg(t, E.split[0], E.split[1]));
  let local;
  if (name === "nav" || name === "side") {
    const k = name === "nav" ? -1 : 1;
    const d = easeIn(seg(t, E.split[0], E.split[1] + 0.2));
    local = trs([c[0] + k * 0.25 * d, c[1] - 0.05 * d, -0.55 * d], qAxis([0, 1, 0], k * 0.5 * d));
    if (t > E.split[1] + 0.25) local = hidden(local.p);
  } else {
    local = trs([c[0], c[1], DEPTH[name] * s]);
  }
  return mulT(pageAt(t), local);
}
// the avatar photo: a round sticker card on the info slab (page-local)
export const AV_R = (T.AVATAR.d / 2) * T.PX;
const AV_LOCAL = [...ui(...T.AVATAR.c), 0];
export function avatarAt(t) {
  const s = easeInOut(seg(t, E.split[0], E.split[1]));
  const b = seg(t, E.bulge[0], E.bulge[1]);
  const e = easeIn(b);
  const wob = 0.04 * Math.sin(b * 26) * b;
  const local = trs([AV_LOCAL[0], AV_LOCAL[1], DEPTH.info * s + 0.0008 + 0.012 * e], qEuler(0, 0, wob), [1 + 0.1 * e, 1 + 0.1 * e + wob, 1]);
  const tr = mulT(pageAt(t), local);
  return t >= E.pop ? hidden(tr.p) : tr;
}
const pageNormal = (t) => qRot(pageAt(t).q, [0, 0, 1]);
const avatarWorld = (t) => apply(pageAt(t), [AV_LOCAL[0], AV_LOCAL[1], DEPTH.info + 0.002]);

// ── The calico ──────────────────────────────────────────────────────────────
function basePose(pos) {
  return {
    pos: pos.slice(), yaw: 0, pitch: 0, roll: 0, sy: 1, sxz: 1, flat: 1, pop: 1, show: true, ground: pos[1],
    body: [0, 0, 0], head: [0, 0, 0], earL: [0, 0, 0], earR: [0, 0, 0],
    legL: [0, 0, 0], legR: [0, 0, 0], hindL: [0, 0, 0], hindR: [0, 0, 0], tail1: [0, 0, 0], tail2: [0, 0, 0],
    reachR: 1,
  };
}
const squash = (o, q) => { o.sy -= q; o.sxz += q * 0.5; };
function landSquash(t, tl, k = 0.22) {
  const l = t - tl;
  if (l < 0 || l > 0.3) return 0;
  const u = l / 0.3;
  return k * Math.exp(-4 * u) * Math.cos(u * Math.PI * 1.6);
}
function crouch(t, t0, k = 0.14) { // anticipation before a take-off at t0
  const a = t - (t0 - 0.14);
  return a >= 0 && a < 0.14 ? Math.sin((a / 0.14) * Math.PI * 0.5) * k : 0;
}
// a ballistic hop: feet from a to b, apex above the higher end
function hop(o, t, a, b, t0, t1, apex, opts = {}) {
  const s = seg(t, t0, t1);
  o.pos = v3.lerp(a, b, s);
  o.pos[1] += apex * 4 * s * (1 - s);
  o.yaw = opts.yaw ?? yawTo(a, b);
  const air = Math.sin(Math.PI * s);
  o.sy = 1 + 0.1 * air; o.sxz = 1 - 0.05 * air;
  // legs tuck and stretch like a jumping cat
  o.legL = o.legR = [-0.7 * air, 0, 0];
  o.hindL = o.hindR = [0.5 * air, 0, 0];
  o.tail1 = [0.5 * air, 0, 0]; o.tail2 = [0.3 * air, 0, 0];
  o.earL = [-0.25 * air, 0, 0]; o.earR = [-0.25 * air, 0, 0];
  o.ground = Math.min(a[1], b[1]);
  return s;
}
// always: breathing, a lazy tail, ears that flick now and then
function idle(o, t) {
  o.sy *= 1 + 0.008 * Math.sin(t * 3.1);
  o.tail1 = v3.add(o.tail1, [0.05 * Math.sin(t * 1.7), 0.22 * Math.sin(t * 2.1), 0]);
  o.tail2 = v3.add(o.tail2, [0.06 * Math.sin(t * 1.7 - 0.6), 0.3 * Math.sin(t * 2.1 - 0.9), 0.1 * Math.sin(t * 2.1 - 1.2)]);
  const flick = (at) => Math.exp(-Math.pow((t - at) / 0.05, 2));
  o.earL = v3.add(o.earL, [0, 0, -0.25 * flick(3.35) - 0.2 * flick(6.9)]);
  o.earR = v3.add(o.earR, [0, 0, 0.25 * flick(5.2)]);
}
// the photo's pose: chin up, head turned a little to its right
const CONTENT = { head: [-0.24, -0.28, 0.08], earL: [-0.12, 0, -0.06], earR: [-0.12, 0, 0.06] };
const blend = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));

// ── Stage b: the phone, its bubbles, Grok bot, the article ──────────────────
const PH = T.PHONE;
const phoneLocal = (u, v) => [(u - PH.w / 2) * PH.px, (PH.h / 2 - v) * PH.px];
export function phoneAt(t) {
  const s = seg(t, E.phone[0], E.phone[1]);
  const y = lerp(-0.62, 0, backOut(s, 1.1));
  return trs(ST("b", v3.add(PH.c, [0, y, 0])), qMul(qAxis([0, 1, 0], PH.yaw), qAxis([1, 0, 0], -0.25 * (1 - smooth(s)))));
}
export const PHONE_W = PH.w * PH.px, PHONE_H = PH.h * PH.px;
export const phoneScreenAt = (t) => mulT(phoneAt(t), trs([0, 0, PH.depth / 2 + 0.0004]));
// the chat: messages stack down the screen and scroll up once it is full; a
// message that scrolls past the title bar shrinks away
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CHAT_SIZE = existsSync(join(ROOT_DIR, "build/chat.json")) ? JSON.parse(readFileSync(join(ROOT_DIR, "build/chat.json"), "utf8")) : {};
const CHAT_ROWS = (() => {
  const rows = {};
  let y = T.CHAT_AREA[0] + 14;
  for (const m of T.CHAT) {
    if (m.typing) continue;
    const [w, h] = CHAT_SIZE[m.id] ?? [200, 58];
    rows[m.id] = { y, w, h, x: m.side === "me" ? PH.w - T.BUBBLE.margin - w : T.BUBBLE.margin };
    y += h + T.BUBBLE.gap;
  }
  const [w, h] = CHAT_SIZE.typing ?? [96, 58];
  rows.typing = { y: rows.bot1.y, w, h, x: T.BUBBLE.margin };
  return rows;
})();
function chatScroll(t) {
  let base = 0, cur = 0;
  for (const m of T.CHAT) {
    if (m.typing || t < m.at) continue;
    const r = CHAT_ROWS[m.id];
    const tgt = Math.max(base, r.y + r.h - (T.CHAT_AREA[1] - 12));
    cur = lerp(base, tgt, easeInOut(seg(t, m.at, m.at + 0.22)));
    base = tgt;
  }
  return cur;
}
export function bubbleAt(i, t) {
  const m = T.CHAT[i];
  const r = CHAT_ROWS[m.id];
  const top = r.y - chatScroll(t);
  const c = phoneLocal(r.x + r.w / 2, top + r.h / 2);
  const s = seg(t, m.at, m.at + 0.22);
  const out = m.until ? 1 - smooth(seg(t, m.until, m.until + 0.08)) : 1;
  const vis = clamp01((top - (T.CHAT_AREA[0] - r.h * 0.5)) / (r.h * 0.5));
  const k = backOut(s, 2.2) * out * vis;
  const local = trs([c[0], c[1], PH.depth / 2 + 0.0035 + 0.006 * Math.sin(Math.PI * s)], qEuler(0.3 * (1 - s), 0, 0), k < 0.01 || t < m.at ? HIDDEN : [k, k, 1]);
  return mulT(phoneAt(t), local);
}
// Grok bot hops out of the screen beside its first reply and down to the floor
const BOT_B = ST("b", [-0.22, 0, 0.05]);
function botSlotWorld(t) {
  const r = CHAT_ROWS.bot1;
  return apply(phoneAt(t), [...phoneLocal(6, r.y + 34 - chatScroll(t)), PH.depth / 2 + 0.002]);
}
// a bot's pose: feet, yaw, squash; show = false parks it
function botT(pos, yaw, sq = 0, k = 1) {
  return trs(pos, qAxis([0, 1, 0], yaw), [(1 + sq * 0.5) * k, (1 - sq) * k, (1 + sq * 0.5) * k]);
}
const bounce = (t, t0, k = 0.2) => { const l = t - t0; return l < 0 || l > 0.35 ? 0 : k * Math.exp(-5 * l / 0.35) * Math.cos(l / 0.35 * Math.PI * 1.8); };
export function botBAt(t) {
  const slot = v3.sub(botSlotWorld(Math.max(t, E.bubble2)), [0, BOT_H / 2, 0]);
  if (t < E.bubble2) return hidden(slot);
  const out = seg(t, E.bubble2, E.bubble2 + 0.14);
  if (t < E.bubble2 + 0.14) return botT(v3.add(slot, [0, 0, 0.03 * out]), 0, 0, lerp(0.35, 1, backOut(out, 2)));
  const h = seg(t, E.bubble2 + 0.14, E.bubble2 + 0.5);
  const a = v3.add(slot, [0, 0, 0.03]);
  if (h < 1) {
    const p = v3.lerp(a, BOT_B, h);
    p[1] = lerp(a[1], 0, h) + 0.06 * 4 * h * (1 - h);
    return botT(p, lerp(0, 0.5, h), -0.1 * Math.sin(Math.PI * h));
  }
  // lands, then bounces with the caption and the count
  const hopUp = (t0) => { const l = seg(t, t0, t0 + 0.3); return 0.025 * 4 * l * (1 - l); };
  const y = hopUp(E.first) + hopUp(E.lock1);
  return botT(v3.add(BOT_B, [0, y, 0]), 0.5 - 0.3 * smooth(seg(t, E.first - 0.2, E.first)), bounce(t, E.bubble2 + 0.5, 0.25) + bounce(t, E.first + 0.3) + bounce(t, E.lock1 + 0.3));
}
const AR = T.ARTICLE_SLAB;
const articleLocal = (u, v) => [(u - AR.w / 2) * AR.px, (AR.h / 2 - v) * AR.px];
export const ARTICLE_W = AR.w * AR.px, ARTICLE_H = AR.h * AR.px;
export function articleAt(t) {
  const s = seg(t, E.article[0], E.article[1]);
  return trs(ST("b", v3.add(AR.c, [0, lerp(-0.5, 0, backOut(s, 1.2)), 0])), qMul(qAxis([0, 1, 0], AR.yaw), qAxis([1, 0, 0], 0.3 * (1 - smooth(s)))));
}

// ── Stage c: the bar chart it climbs ────────────────────────────────────────
export const COL_W = 0.085;
export const COLS = [0.03, 0.065, 0.1, 0.135, 0.17, 0.215].map((h, i) => ({ h, x: -0.36 + i * 0.12, z: 0.02 }));
function colRise(i, t) {
  if (i === 0) return 1;
  const [h0] = E.hops[i - 1];
  return backOut(seg(t, h0 - 0.34, h0 + 0.02), 1.3);
}
export function columnAt(i, t) {
  const c = COLS[i];
  return trs(ST("c", [c.x, c.h / 2 - c.h * (1 - colRise(i, t)) - 0.002, c.z]));
}
const colTop = (i) => ST("c", [COLS[i].x, COLS[i].h, COLS[i].z]);

// ── Stage d: the Grok bots join it ──────────────────────────────────────────
export const BOTS_D = {
  orange: { p: ST("d", [0.0, 0, 0.1]), yaw: 0.35, at: E.bots[0] },
  purple: { p: ST("d", [0.17, 0, 0.09]), yaw: -0.1, at: E.bots[0] + 0.15 },
  black: { p: ST("d", [0.24, 0, 0.1]), yaw: -0.35, at: E.bots[0] + 0.3 },
};
export function botDAt(name, t) {
  const b = BOTS_D[name];
  if (t < b.at) return hidden(v3.add(b.p, [0, 0.3, 0]));
  const d = seg(t, b.at, b.at + 0.25);
  const y = 0.3 * (1 - easeIn(d));
  const hopUp = (t0) => { const l = seg(t, t0, t0 + 0.32); return 0.03 * 4 * l * (1 - l); };
  const order = Object.keys(BOTS_D).indexOf(name);
  const hops = hopUp(E.name + 0.1 * order) + hopUp(E.final + 0.1 * order);
  const sq = bounce(t, b.at + 0.25, 0.3) + bounce(t, E.name + 0.1 * order + 0.32) + bounce(t, E.final + 0.1 * order + 0.32);
  return botT(v3.add(b.p, [0, y + hops, 0]), b.yaw + 0.15 * Math.sin(t * 2 + order), sq);
}

// ── The calico ──────────────────────────────────────────────────────────────
export const LAND_A = ST("a", [-0.12, 0, 0.06]);
const LAND_B = ST("b", [0.27, 0, 0.04]), LAND_B2 = ST("b", [0.37, 0, 0.13]);
const LAND_D = ST("d", [0.085, 0, 0.11]);
// over every cut: it springs straight up out of the shot, and drops into the next
function leapUp(o, t, from, t0, t1) {
  const s = seg(t, t0, t1);
  o.pos = v3.add(from, [0, 0.75 * Math.pow(s, 0.8), 0]);
  o.sy = 1 + 0.16 * Math.sin(Math.PI * Math.min(1, s * 1.6)); o.sxz = 1 - 0.06 * o.sy + 0.06;
  o.legL = o.legR = [0.5 * s, 0, 0];
  o.hindL = o.hindR = [0.6 * s, 0, 0];
  o.tail1 = [0.7 * s, 0, 0];
  o.ground = from[1];
}
function dropIn(o, t, to, t0, t1) {
  const s = seg(t, t0, t1);
  o.pos = v3.add(to, [0, 0.6 * (1 - s * s), 0]);
  o.sy = 1 + 0.12 * (1 - s); o.sxz = 1 - 0.05 * (1 - s);
  o.legL = o.legR = [-0.9 * (1 - s), 0, 0];
  o.hindL = o.hindR = [0.4 * (1 - s), 0, 0];
  o.earL = o.earR = [-0.3 * (1 - s), 0, 0];
  o.ground = to[1];
}
// the lucky-cat wave: right paw up beside its face, flopping on the beat
function beckon(o, t, t0, t1) {
  const k = smooth(seg(t, t0, t0 + 0.2)) * (1 - smooth(seg(t, t1 - 0.2, t1)));
  if (k <= 0) return;
  const wave = Math.sin((t - t0) * TAU * 2);
  o.legR = blend(o.legR, [-2.75 + 0.3 * wave, 0.15, -0.38], k);
  o.reachR = lerp(1, 1.8, k); // a toy's arm stretches to reach its cheek
  o.head = v3.add(o.head, [0, 0.12 * k, 0.1 * k]);
  o.body = v3.add(o.body, [0, 0, 0.06 * k]);
}
function catPoseA(o, t) {
  if (t < E.pop) {
    o.show = false;
    o.pos = v3.sub(avatarWorld(E.pop), [0, CENTER[1], 0]);
    return o;
  }
  // out of the photo, a leap to the floor
  if (t < E.land) {
    const n = pageNormal(E.pop);
    const start = v3.sub(avatarWorld(E.pop), [0, CENTER[1], 0]);
    const s = hop(o, t, start, LAND_A, E.leap[0], E.leap[1], 0.05);
    const face = Math.atan2(n[0], n[2]);
    o.yaw = lerp(face, 0.15, smooth(seg(t, E.pop + 0.08, E.land - 0.05)));
    const inflate = seg(t, E.pop, E.pop + 0.18);
    o.flat = lerp(0.05, 1, backOut(inflate, 2.4));
    o.pop = lerp(0.72, 1, smooth(inflate));
    o.pitch = -0.35 * Math.sin(Math.PI * s);
    o.legL = o.legR = [-1.1 * Math.sin(Math.PI * s), 0, 0];
    o.ground = 0;
    idle(o, t);
    return o;
  }
  // the photo's pose, then the medal
  o.pos = LAND_A.slice();
  o.yaw = 0.15;
  let q = landSquash(t, E.land, 0.26);
  const c = smooth(seg(t, E.content[0], E.content[0] + 0.35)) * (1 - smooth(seg(t, E.content[1], E.content[1] + 0.3)));
  o.head = blend([0, 0, 0], CONTENT.head, c);
  o.earL = blend([0, 0, 0], CONTENT.earL, c);
  o.earR = blend([0, 0, 0], CONTENT.earR, c);
  q += landSquash(t, E.medal[1], 0.12);
  const pr = smooth(seg(t, E.proud[0], E.proud[0] + 0.3)) * (1 - smooth(seg(t, E.proud[1], E.proud[1] + 0.2)));
  o.head = v3.add(o.head, [-0.28 * pr, 0.1 * pr * Math.sin(t * 2.4), 0]);
  o.body = [-0.06 * pr, 0, 0];
  // looks up at the title as it slaps on
  const look = smooth(seg(t, E.title - 0.1, E.title + 0.2)) * (1 - smooth(seg(t, E.stamp + 0.1, E.stamp + 0.4)));
  o.head = v3.add(o.head, [-0.3 * look, -0.45 * look, 0]);
  q += crouch(t, E.leap2[0], 0.14);
  squash(o, q);
  idle(o, t);
  if (t >= E.leap2[0]) leapUp(o, t, LAND_A, E.leap2[0], E.leap2[1]);
  return o;
}
function catPoseB(o, t) {
  if (t < 8.3) {
    dropIn(o, t, LAND_B, E.cut1, 8.3);
    o.yaw = -0.35;
    return o;
  }
  o.pos = LAND_B.slice();
  o.yaw = -0.35;
  let q = landSquash(t, 8.3, 0.26);
  // taps "send" for each of its messages
  const tap = T.CHAT.filter((m) => m.side === "me").reduce((a, m) => a + Math.exp(-Math.pow((t - (m.at - 0.08)) / 0.07, 2)), 0);
  o.legR = [-1.3 * tap, 0, -0.1 * tap];
  // looks at the bot, then at you for the caption
  const atBot = smooth(seg(t, E.bubble2 - 0.1, E.bubble2 + 0.25)) * (1 - smooth(seg(t, E.first - 0.2, E.first + 0.1)));
  o.head = [-0.08 * atBot, -0.55 * atBot, 0];
  // you for the caption, then back to the phone for the stickers
  const toYou = smooth(seg(t, E.first - 0.2, E.first + 0.1)) * (1 - smooth(seg(t, 11.1, 11.4)));
  o.yaw = lerp(-0.35, 0.05, toYou);
  q += landSquash(t, E.first, 0.12);
  // 封号还不退款: it shakes with laughter
  const g = seg(t, E.giggle, E.giggle + 0.6);
  if (g > 0 && g < 1) { o.roll = 0.07 * Math.sin(g * TAU * 4) * (1 - g); o.head = v3.add(o.head, [-0.15 * Math.sin(Math.PI * g), 0, 0]); q += 0.03 * Math.abs(Math.sin(g * TAU * 4)) * (1 - g); }
  idle(o, t);
  const [h1, h2] = [[13.8, 14.1], [14.15, 14.45]];
  const MID = ST("b", [0.32, 0, 0.09]);
  q += crouch(t, h1[0], 0.12);
  squash(o, q);
  if (t >= h1[0] && t < h1[1]) { hop(o, t, LAND_B, MID, h1[0], h1[1], 0.03); return o; }
  if (t >= h1[1] && t < h2[0]) { o.pos = MID.slice(); o.yaw = 0.6; squash(o, landSquash(t, h1[1], 0.15) + crouch(t, h2[0], 0.1)); return o; }
  if (t >= h2[0] && t < h2[1]) { hop(o, t, MID, LAND_B2, h2[0], h2[1], 0.03); return o; }
  if (t >= h2[1]) {
    o.pos = LAND_B2.slice();
    o.yaw = lerp(0.6, 0.25, smooth(seg(t, h2[1], h2[1] + 0.3)));
    let q2 = landSquash(t, h2[1], 0.15);
    // watches the count, cheers on the lock
    o.head = [-0.15, 0.45 * smooth(seg(t, 14.45, 14.65)) * (1 - smooth(seg(t, E.lock1, E.lock1 + 0.15))), 0];
    const ch = smooth(seg(t, E.cheer[0], E.cheer[0] + 0.1)) * (1 - smooth(seg(t, E.cheer[1] - 0.1, E.cheer[1])));
    const flap = Math.sin((t - E.cheer[0]) * TAU * 4);
    o.legL = [-2.3 * ch + 0.25 * flap * ch, 0, 0.25 * ch];
    o.legR = [-2.3 * ch - 0.25 * flap * ch, 0, -0.25 * ch];
    o.head = v3.add(o.head, [-0.25 * ch, 0, 0]);
    const jump = seg(t, E.lock1 + 0.02, E.lock1 + 0.32);
    o.pos[1] += 0.03 * 4 * jump * (1 - jump);
    q2 += landSquash(t, E.lock1 + 0.32, 0.18) + crouch(t, E.leap3[0], 0.14);
    squash(o, q2);
    idle(o, t);
    if (t >= E.leap3[0]) leapUp(o, t, LAND_B2, E.leap3[0], E.leap3[1]);
  }
  return o;
}
function catPoseC(o, t) {
  if (t < E.cut2 + 0.25) {
    dropIn(o, t, colTop(0), E.cut2, E.cut2 + 0.25);
    o.yaw = 0.5;
    return o;
  }
  let i = 0;
  for (let k = 0; k < E.hops.length; k++) if (t >= E.hops[k][1]) i = k + 1;
  const hk = E.hops.findIndex(([a, b]) => t >= a && t < b);
  if (hk >= 0) {
    hop(o, t, colTop(hk), colTop(hk + 1), E.hops[hk][0], E.hops[hk][1], 0.05);
    o.yaw = 1.0;
    o.ground = COLS[hk].h;
    return o;
  }
  o.pos = colTop(i);
  o.ground = COLS[i].h;
  const landedAt = i === 0 ? E.cut2 + 0.25 : E.hops[i - 1][1];
  let q = landSquash(t, landedAt, 0.22);
  if (i < E.hops.length) q += crouch(t, E.hops[i][0], 0.12);
  o.yaw = i < E.hops.length ? 0.5 : lerp(0.5, 0.1, smooth(seg(t, landedAt, landedAt + 0.3)));
  // on top: the photo's pose, proud of the count
  if (i === E.hops.length) {
    const c = smooth(seg(t, E.lock2 + 0.05, E.lock2 + 0.4)) * (1 - smooth(seg(t, E.leap4[0] - 0.4, E.leap4[0] - 0.1)));
    o.head = blend([0, 0, 0], v3.add(CONTENT.head, [-0.08, 0.1, 0]), c);
    o.earL = blend([0, 0, 0], CONTENT.earL, c);
    o.earR = blend([0, 0, 0], CONTENT.earR, c);
    q += landSquash(t, E.now + 0.6, 0.1) + crouch(t, E.leap4[0], 0.14);
  }
  squash(o, q);
  idle(o, t);
  if (t >= E.leap4[0]) leapUp(o, t, colTop(E.hops.length), E.leap4[0], E.leap4[1]);
  return o;
}
function catPoseD(o, t) {
  if (t < E.cut3 + 0.28) {
    dropIn(o, t, LAND_D, E.cut3, E.cut3 + 0.28);
    o.yaw = 0.3;
    return o;
  }
  o.pos = LAND_D.slice();
  o.yaw = lerp(0.3, -0.12, smooth(seg(t, E.cut3 + 0.28, E.cut3 + 0.6)));
  let q = landSquash(t, E.cut3 + 0.28, 0.26);
  // reads the line as it slaps on, then waves you in
  const read = smooth(seg(t, E.slogan - 0.1, E.slogan + 0.2)) * (1 - smooth(seg(t, E.slogan + 1.6, E.slogan + 1.9)));
  o.head = [-0.1 * read, -0.5 * read, 0];
  const up = smooth(seg(t, E.name - 0.05, E.name + 0.2)) * (1 - smooth(seg(t, E.name + 0.6, E.name + 0.9)));
  o.head = v3.add(o.head, [-0.25 * up, -0.35 * up, 0]);
  beckon(o, t, E.beckon[0], E.beckon[1]);
  beckon(o, t, E.final - 0.3, T.DURATION + 1);
  q += landSquash(t, E.final, 0.1);
  squash(o, q);
  idle(o, t);
  return o;
}
export function catPose(t) {
  const o = basePose(LAND_A);
  const st = stageOf(t);
  if (st === "a") return catPoseA(o, t);
  if (st === "b") return catPoseB(o, t);
  if (st === "c") return catPoseC(o, t);
  return catPoseD(o, t);
}

// joint transforms (cat-local) from the pose
const eul = (v) => qEuler(v[0], v[1], v[2]);
function catT(o) {
  const q = qEuler(o.pitch, o.yaw, o.roll, "YXZ");
  const s = [o.sxz * o.pop, o.sy * o.pop, o.sxz * o.pop * o.flat];
  // pitch / roll turn around the body centre, squash keeps the feet down
  const c = [CENTER[0] * s[0], CENTER[1] * s[1], CENTER[2] * s[2]];
  const rc = qRot(q, c);
  return trs([o.pos[0] + c[0] - rc[0], o.pos[1] + c[1] - rc[1], o.pos[2] + c[2] - rc[2]], q, s);
}
export function catAt(t) {
  const o = catPose(t);
  if (!o.show) return { cat: hidden(o.pos), o };
  return { cat: catT(o), o };
}
const ORDER = Object.keys(JOINTS);
export function catJoints(o) {
  const J = {};
  for (const j of ORDER) {
    const spec = JOINTS[j];
    const parent = spec.parent ? J[spec.parent] : trs([0, 0, 0]);
    const pp = spec.parent ? JOINTS[spec.parent].p : [0, 0, 0];
    J[j] = mulT(parent, trs(v3.sub(spec.p, pp), eul(o[j] ?? [0, 0, 0])));
  }
  return J;
}
export function catParts(t) {
  const { o } = catAt(t);
  const J = catJoints(o);
  return CAT_PARTS.map((p) => {
    let off = v3.sub(p.pos, JOINTS[p.group].p), s = [1, 1, 1];
    if (p.group === "legR" && o.reachR !== 1) {
      // stretch along the leg: the leg grows, the paw rides out to its end
      off = [off[0], off[1] * o.reachR, off[2]];
      if (p.name.startsWith("leg")) s = [1, o.reachR, 1];
    }
    return mulT(J[p.group], trs(off, p.rot ? qEuler(...p.rot) : qId(), s));
  });
}
export const catCentre = (t) => apply(catAt(t).cat, CENTER);

// ── The medal (act 1): drops round its neck, and stays ──────────────────────
export function medalAt(t) {
  const { cat, o } = catAt(t);
  const J = catJoints(o);
  const chest = mulT(cat, mulT(J.body, trs(v3.sub([0, 0.027, 0.0192], JOINTS.body.p), qEuler(-0.3, 0, 0))));
  if (t < E.medal[0]) return hidden(v3.add(chest.p, [0, 0.3, 0]));
  const d = seg(t, E.medal[0], E.medal[1]);
  const b = t - E.medal[1];
  const swing = b > 0 ? 0.35 * Math.exp(-b * 4) * Math.sin(b * 14) : 0;
  const fall = 0.3 * (1 - easeIn(d));
  return trs(v3.add(chest.p, [0, fall, 0]), qMul(chest.q, qEuler(swing, TAU * (1 - easeOut(d)) * 0.5, 0)), [cat.s[0], cat.s[1], cat.s[2]]);
}

// ── Lettering ───────────────────────────────────────────────────────────────
export const GLYPHS = existsSync(join(ROOT_DIR, "build/glyphs.json")) ? JSON.parse(readFileSync(join(ROOT_DIR, "build/glyphs.json"), "utf8")) : {};
const adv = (ch) => GLYPHS[`heavy:${ch}`]?.advance ?? 0.6;
// a line of glyphs: [{ key, x }] centred on 0, its width, and each glyph's beat (a Latin word is one)
function setLine(text, em) {
  const out = [];
  let x = 0, tok = 0;
  for (const m of text.matchAll(/[A-Za-z0-9@]+|\s|./gu)) {
    if (m[0] === " ") { x += adv(" ") * em; continue; }
    for (const ch of m[0]) { out.push({ key: `heavy:${ch}`, x, tok }); x += adv(ch) * em; }
    tok++;
  }
  out.forEach((g) => (g.x -= x / 2));
  return { glyphs: out, w: x, toks: tok };
}
// torn-paper labels: a sheet of coloured paper over a white torn rim, raised letters
export const PAPER = { cream: ["#EFE6D4", "#161514"], red: ["#D8382D", "#FBF3E6"], blue: ["#2F5D9E", "#F3EEE4"] };
function torn(w, h, seed, grow = 0) {
  const r = mulberry32(seed);
  const pts = [];
  const edge = (x0, y0, x1, y1, n, amp, nx, ny) => {
    for (let i = 0; i < n; i++) {
      const s = i / n, j = (r() - 0.35) * amp;
      pts.push([x0 + (x1 - x0) * s + nx * (j + grow), y0 + (y1 - y0) * s + ny * (j + grow)]);
    }
  };
  const nx = Math.max(6, Math.round(w / 0.006)), ny = Math.max(4, Math.round(h / 0.006));
  const a = Math.min(0.0018, h * 0.04);
  edge(-w / 2, h / 2, w / 2, h / 2, nx, a, 0, 1);
  edge(w / 2, h / 2, w / 2, -h / 2, ny, a * 2.6, 1, 0);
  edge(w / 2, -h / 2, -w / 2, -h / 2, nx, a, 0, -1);
  edge(-w / 2, -h / 2, -w / 2, h / 2, ny, a * 2.6, -1, 0);
  return pts.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]);
}
export const LABELS = T.LABELS.map((L, i) => {
  const line = setLine(L.text, L.em);
  const pad = 0.22 * L.em;
  const W = line.w + 2 * pad, H = 0.93 * L.em + 2 * pad;
  const first = L.first ?? L.at + 0.06;
  const letters = line.glyphs.map((g) => ({ key: g.key, x: g.x, y: -0.36 * L.em, at: L.step ? first + g.tok * L.step : L.at + 0.02 }));
  return { ...L, W, H, letters, sheet: torn(W, H, 900 + i), rim: torn(W, H, 950 + i, Math.min(0.0024, L.em * 0.05)) };
});
// the label slaps on (a little big and twisted, then flat); a stamp slams down from the camera
function labelT(L, t) {
  const rest = trs(ST(L.stage, L.c), qMul(qAxis([0, 1, 0], L.yaw), qAxis([0, 0, 1], L.tilt)));
  if (t < L.at) return trs(rest.p, rest.q, HIDDEN);
  if (L.stamp) {
    const s = seg(t, L.at - 0.0, L.at + 0.12);
    const b = t - (L.at + 0.12);
    const wob = b > 0 ? 0.05 * Math.exp(-b * 10) * Math.cos(b * 40) : 0;
    const k = lerp(2.2, 1, easeIn(s)) + wob;
    return mulT(rest, trs([0, 0, 0.12 * (1 - easeIn(s))], qAxis([0, 0, 1], 0.25 * (1 - easeIn(s))), k));
  }
  const s = seg(t, L.at, L.at + 0.18);
  return mulT(rest, trs([0, 0, 0.02 * (1 - easeOut(s))], qEuler(-0.15 * (1 - s), 0, 0.12 * (1 - easeOut(s))), lerp(1.25, 1, easeOut(s))));
}
export const labelSheetAt = (i, t) => labelT(LABELS[i], t);
export const labelRimAt = (i, t) => mulT(labelT(LABELS[i], t), trs([0, 0, -0.0012]));
export function labelLetterAt(i, j, t) {
  const L = LABELS[i], g = L.letters[j];
  const s = seg(t, g.at, g.at + 0.16);
  const k = t < g.at ? 0 : backOut(s, 2.0);
  return mulT(labelT(L, t), trs([g.x, g.y, 0.0012 + 0.002 * (1 - smooth(s))], qId(), k < 0.01 ? HIDDEN : [k, k, 1]));
}

// 3D counters: white lettering lit from inside, digits that swap on the frame
const DIGIT_W = Math.max(...[..."0123456789"].map(adv));
export const COUNTERS = Object.fromEntries(Object.entries(T.COUNTERS).map(([id, C]) => {
  const words = (list, em) => (list ?? []).map((w) => ({ w, line: setLine(w, em) }));
  const wem = id === "fans" ? C.em * 0.62 : C.em;
  return [id, { ...C, id, before: words(C.before, id === "days" ? C.em : wem), after: words(C.after, wem), wem, slotW: DIGIT_W * C.em }];
}));
function countValue(id, t) {
  const [a, b, v] = T.COUNTERS[id].value;
  const s = seg(t, a, b);
  if (id === "views") return Math.round(v * easeInOut(s));
  if (id === "days") return 1 + Math.round((v - 1) * s);
  const k = 3.2;
  let n = Math.round(v * (Math.exp(k * s) - 1) / (Math.exp(k) - 1));
  const [n0, n1, nv] = T.FANS_NOW;
  if (t >= n0) n = v + Math.round((nv - v) * smooth(seg(t, n0, n1)) / 50) * 50;
  return n;
}
// the group: where the counter stands, and how it arrives and locks
function counterGroup(id, t) {
  const C = COUNTERS[id];
  const rest = trs(ST(C.stage, C.c), qAxis([0, 1, 0], C.yaw));
  if (id === "views") {
    const lift = seg(t, E.article[1], E.article[1] + 0.3);
    const from = apply(articleAt(t), [...articleLocal(...T.VIEWS_AT), 0.004]);
    const lock = t > E.lock1 ? 0.12 * Math.exp(-(t - E.lock1) * 10) : 0;
    if (t < E.article[1]) return trs(from, rest.q, HIDDEN);
    return trs(v3.lerp(from, rest.p, easeInOut(lift)), qMul(rest.q, qAxis([1, 0, 0], -0.6 * (1 - easeOut(lift)))), lerp(0.22, 1, easeOut(lift)) + lock);
  }
  const s = seg(t, E.cut2, E.cut2 + 0.3);
  const lock = t > E.lock2 ? 0.14 * Math.exp(-(t - E.lock2) * 9) : 0;
  return trs(rest.p, rest.q, lerp(0.3, 1, backOut(s, 1.6)) + lock);
}
// every glyph of a counter: { name: local transform }
export function counterAt(id, t) {
  const C = COUNTERS[id];
  const G = counterGroup(id, t);
  const n = countValue(id, t);
  const digits = String(n).split("").map(Number);
  const out = {};
  const L = (tr) => mulT(G, tr);
  // the run: [before words] [digits] [after words], centred; days re-centres, the others keep the digits right-aligned
  const bw = C.before.reduce((a, w) => a + w.line.w, 0);
  const gap = 0.12 * C.em;
  const aw = C.after.reduce((a, w) => a + w.line.w + gap, 0);
  const plus = id === "fans" ? smooth(seg(t, T.FANS_NOW[1], T.FANS_NOW[1] + 0.15)) : 0;
  const plusW = adv("+") * C.em * 0.8;
  const nShown = id === "days" ? digits.length : C.slots;
  const total = bw + nShown * C.slotW + aw + plus * plusW;
  let x = -total / 2;
  C.before.forEach((w, i) => { w.line.glyphs.forEach((g, j) => (out[`${id}_b${i}_${j}`] = L(trs([x + w.line.w / 2 + g.x, 0, 0])))); x += w.line.w + gap * 0.5; });
  const x0 = x;
  for (let s = 0; s < C.slots; s++) {
    const di = id === "days" ? s : s - (C.slots - digits.length);
    const sx = x0 + (id === "days" ? s : s) * C.slotW;
    for (let d = 0; d <= 9; d++) {
      const on = di >= 0 && di < digits.length && digits[di] === d;
      out[`${id}_${s}_${d}`] = L(trs([sx + (C.slotW - adv(String(d)) * C.em) / 2, 0, 0], qId(), on ? 1 : HIDDEN));
    }
  }
  x = x0 + nShown * C.slotW + gap;
  if (id === "fans") {
    out.fans_plus = L(trs([x - gap * 0.6, C.em * 0.12, 0], qId(), plus > 0.01 ? [0.8 * backOut(plus, 2), 0.8 * backOut(plus, 2), 1] : HIDDEN));
    x += plus * plusW;
  }
  C.after.forEach((w, i) => { w.line.glyphs.forEach((g, j) => (out[`${id}_a${i}_${j}`] = L(trs([x + w.line.w / 2 + g.x, id === "views" ? 0 : 0.0, 0])))); x += w.line.w + gap; });
  return out;
}
export const counterCentre = (id, t) => counterGroup(id, Math.max(t, E.cut2 + 0.3)).p;

// ── Particles ───────────────────────────────────────────────────────────────
const G = 2.4; // toy-scale gravity, m/s²
function ballistic(p0, v0, dt, floor) {
  const p = [p0[0] + v0[0] * dt, p0[1] + v0[1] * dt - 0.5 * G * dt * dt, p0[2] + v0[2] * dt];
  if (floor !== undefined && p[1] < floor) p[1] = floor;
  return p;
}
// puffs: the poof out of the photo, and Grok bot's out of the phone
export const PUFFS = 14;
export function puffAt(i, t) {
  const r = mulberry32(40 + i);
  const bursts = [[E.pop, avatarWorld(E.pop), pageNormal(E.pop), 1], [E.bubble2, botSlotWorld(E.bubble2), qRot(phoneAt(E.bubble2).q, [0, 0, 1]), 0.6]];
  for (const [t0, at, n, size] of bursts) {
    const dt = t - t0;
    if (dt < 0 || dt > 0.6) continue;
    const a = r() * TAU;
    const dir = v3.norm(v3.add(v3.scale(n, 0.6), [Math.cos(a), Math.sin(a) * 0.8 + 0.2, Math.sin(a) * 0.5]));
    const p = v3.add(at, v3.scale(dir, size * (0.03 + 0.09 * easeOut(dt / 0.6))));
    const k = size * (0.6 + r() * 0.6) * Math.sin(Math.PI * Math.min(1, dt / 0.6)) * (1 - dt / 0.6 * 0.5);
    return trs(p, qId(), k);
  }
  return hidden(avatarWorld(E.pop));
}
// paper flakes: the poof, then confetti when the count breaks 10000
export const FLAKES = 18;
export const CONFETTI = 46;
const FLAKE_COLS = ["#E8903A", "#FFFFFF", "#2A1F1B", "#F6C445", "#1D9BF0", "#D8382D"];
export function flakeAt(i, t) {
  const r = mulberry32(100 + i);
  const color = FLAKE_COLS[i % FLAKE_COLS.length];
  const at = avatarWorld(E.pop);
  const n = pageNormal(E.pop);
  const a = r() * TAU, sp = 0.25 + r() * 0.3;
  const v0 = v3.add(v3.scale(n, 0.35 + r() * 0.3), [Math.cos(a) * sp * 0.6, 0.3 + r() * 0.45, Math.sin(a) * sp * 0.4]);
  const dt = t - E.pop;
  const life = 1.5 + r() * 0.5;
  if (dt < 0 || dt > life) return { tr: hidden(at), color };
  const p = ballistic(at, v0, dt, 0.0006);
  const fade = 1 - seg(dt, life - 0.3, life);
  return { tr: trs(p, p[1] <= 0.0007 ? qEuler(0, r() * TAU, 0) : qEuler(dt * (4 + r() * 8), dt * (3 + r() * 6), dt * 5), fade), color };
}
export function confettiAt(i, t) {
  const r = mulberry32(700 + i);
  const color = FLAKE_COLS[i % FLAKE_COLS.length];
  // from above the count, falling through the shot
  const at = ST("c", [lerp(-0.55, 0.55, r()), 0.62 + r() * 0.12, lerp(-0.25, 0.1, r())]);
  const dt = t - (E.lock2 - 0.02 + r() * 0.08);
  if (dt < 0 || dt > 2.6) return { tr: hidden(at), color };
  const v0 = [(r() - 0.5) * 0.3, 0.35 + r() * 0.3, (r() - 0.3) * 0.2];
  const p = ballistic(at, v0, dt * 0.8, 0.0006);
  p[0] += 0.02 * Math.sin(dt * (5 + r() * 4));
  return { tr: trs(p, qEuler(dt * (5 + r() * 8), dt * (4 + r() * 6), dt * 6), 1.3 * (1 - seg(dt, 2.2, 2.6))), color };
}
export const SPARKS = 18;
export function sparkAt(i, t) {
  const bursts = [
    [E.pop, () => avatarWorld(E.pop), "#FFF4E0"],
    [E.medal[1], () => medalAt(t).p, "#FFE08A"],
    [E.stamp, () => labelSheetAt(LABELS.findIndex((l) => l.id === "cn"), t).p, "#FFFFFF"],
    [E.lock1, () => counterGroup("views", t).p, "#FFFFFF"],
    [E.lock2, () => counterGroup("fans", t).p, "#FFE08A"],
    [E.name, () => labelSheetAt(LABELS.findIndex((l) => l.id === "name"), t).p, "#FFF4E0"],
    [E.final, () => catCentre(t), "#FFFFFF"],
  ];
  for (const [t0, at, color] of bursts) {
    const dt = t - t0;
    if (dt < 0 || dt > 0.6) continue;
    const r = mulberry32(300 + i + Math.round(t0 * 10));
    const a = r() * TAU, b = (r() - 0.3) * 1.2;
    const v = [Math.cos(a) * Math.cos(b), Math.sin(b) + 0.4, Math.sin(a) * Math.cos(b)].map((x) => x * (0.22 + r() * 0.3));
    const p = ballistic(at(), v, dt);
    return { tr: trs(p, qEuler(dt * 9, dt * 7, 0), (1 - dt / 0.6) * (0.8 + r() * 0.6)), color };
  }
  return { tr: hidden(avatarWorld(E.pop)), color: "#FFFFFF" };
}

// ── Lights for the hits ─────────────────────────────────────────────────────
export function fxAt(t) {
  const pulse = (at, k, d = 0.2) => (t >= at ? k * Math.exp(-(t - at) / d) : 0);
  const st = stageOf(t);
  if (st === "a" && t < 3.5) return { p: v3.add(avatarWorld(E.pop), v3.scale(pageNormal(E.pop), 0.08)), energy: 0.6 * seg(t, E.bulge[0], E.pop) * (t < E.pop ? 1 : 0) + pulse(E.pop, 1.4, 0.18), color: "#FFE9E0" };
  if (st === "a") return { p: v3.add(catCentre(t), [-0.1, 0.12, 0.14]), energy: pulse(E.medal[1], 0.8, 0.2) + pulse(E.stamp, 1.4, 0.2), color: "#FFF1D6" };
  if (st === "b") return { p: t < E.article[0] ? ST("b", [0, 0.3, 0.2]) : v3.add(counterGroup("views", t).p, [0, 0.08, 0.12]), energy: pulse(E.bubble2, 0.6) + pulse(E.first, 0.8) + pulse(E.lock1, 1.8, 0.22), color: "#EAF2FF" };
  if (st === "c") return { p: v3.add(counterCentre("fans", t), [0, 0.1, 0.2]), energy: pulse(E.lock2, 2.4, 0.3) + pulse(T.FANS_NOW[1], 0.8), color: "#FFE6B0" };
  return { p: ST("d", [-0.2, 0.3, 0.3]), energy: pulse(E.name, 1.2, 0.25) + pulse(E.final, 1.6, 0.3), color: "#FFF4E0" };
}

// contact shadows: the cat, and the bots
export function blobAt(t) {
  const { o } = catAt(t);
  if (!o.show) return { tr: hidden(o.pos), opacity: 0 };
  const h = Math.max(0, o.pos[1] - o.ground);
  const k = clamp01(1 - h / 0.12);
  const s = 1.15 - 0.35 * k;
  return { tr: trs([o.pos[0], o.ground + 0.0007, o.pos[2] - 0.002], qEuler(-Math.PI / 2, 0, 0), k > 0.01 ? [0.085 * s, 0.075 * s, 1] : HIDDEN), opacity: 0.75 * k * k };
}
export function botBlobAt(tr) {
  const h = Math.max(0, tr.p[1] - ST("a", [0, 0, 0])[1]);
  const k = tr.s[0] < 0.01 ? 0 : clamp01(1 - h / 0.1);
  return trs([tr.p[0], 0.0007, tr.p[2]], qEuler(-Math.PI / 2, 0, 0), k > 0.01 ? [0.06 * (1.15 - 0.35 * k), 0.045 * (1.15 - 0.35 * k), 1] : HIDDEN);
}

// ── Camera ──────────────────────────────────────────────────────────────────
function monotone(ts, ys) {
  const n = ts.length;
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
    return (2 * s ** 3 - 3 * s ** 2 + 1) * ys[i] + (s ** 3 - 2 * s ** 2 + s) * h * m[i] + (-2 * s ** 3 + 3 * s ** 2) * ys[i + 1] + (s ** 3 - s ** 2) * h * m[i + 1];
  };
}
function trackerRaw(name, t) {
  const c = catCentre(t);
  if (name === "cat+") return v3.add(c, [-0.13, 0.065, 0]);
  if (name === "climb") return v3.lerp(c, counterCentre("fans", t), 0.45);
  return c;
}
// smoothed per stage, so no tracker drags across a cut
const SM_RATE = 120, SM_SIGMA = 0.12;
const TRACK = {};
function tracker(name, t) {
  const st = stageOf(t);
  const key = `${name}@${st}`;
  if (!TRACK[key]) {
    const n = Math.ceil(T.DURATION * SM_RATE) + 1;
    const raw = Array.from({ length: n }, (_, i) => i / SM_RATE).map((u) => (stageOf(u) === st ? trackerRaw(name, u) : null));
    const sig = SM_SIGMA * SM_RATE, rad = Math.ceil(sig * 3);
    TRACK[key] = raw.map((_, i) => {
      if (!raw[i]) return null;
      let acc = [0, 0, 0], ws = 0;
      for (let k = -rad; k <= rad; k++) {
        const j = Math.min(n - 1, Math.max(0, i + k));
        if (!raw[j]) continue;
        const w = Math.exp(-(k * k) / (2 * sig * sig));
        acc = v3.add(acc, v3.scale(raw[j], w)); ws += w;
      }
      return v3.scale(acc, 1 / ws);
    });
  }
  const arr = TRACK[key];
  const f = clamp01(t / T.DURATION) * (arr.length - 1);
  let i = Math.floor(f), j = Math.min(i + 1, arr.length - 1);
  if (!arr[i]) i = j;
  if (!arr[j]) j = i;
  return arr[i] && arr[j] ? v3.lerp(arr[i], arr[j], f - Math.floor(f)) : trackerRaw(name, t);
}
const CAMF = {};
for (const [stage, ks] of Object.entries(T.CAMERA)) {
  const ts = ks.map((k) => k.t);
  const f = (key) => monotone(ts, ks.map((k) => k[key]));
  CAMF[stage] = { ks, dist: f("dist"), elev: f("elev"), az: f("az"), fov: f("fov"), fstop: f("fstop") };
}
function shakeAt(t) {
  let o = [0, 0, 0];
  for (const [ts, k] of T.SHAKES) {
    const d = t - ts;
    if (d < 0 || d > 0.12) continue;
    const a = k * (1 - d / 0.12) ** 2;
    o = v3.add(o, [0.003 * a * Math.sin(t * 173 + ts), 0.0025 * a * Math.sin(t * 211 + 1), 0.003 * a * Math.sin(t * 157 + 2)]);
  }
  return o;
}
export function stageOf(t) { return t < E.cut1 ? "a" : t < E.cut2 ? "b" : t < E.cut3 ? "c" : "d"; }
export function cameraAt(t) {
  const stage = stageOf(t);
  const F = CAMF[stage];
  const kt = (k) => (typeof k.target === "string" ? tracker(k.target, t) : ST(stage, k.target));
  const ks = F.ks;
  let i = 0;
  while (i < ks.length - 2 && t > ks[i + 1].t) i++;
  const a = ks[i], b = ks[i + 1];
  const s = smooth(seg(t, a.t, b.t));
  const target = v3.lerp(kt(a), kt(b), s);
  const el = (F.elev(t) * Math.PI) / 180, az = (F.az(t) * Math.PI) / 180, d = F.dist(t);
  const pos = [target[0] + d * Math.sin(az) * Math.cos(el), target[1] + d * Math.sin(el), target[2] + d * Math.cos(az) * Math.cos(el)];
  const sh = shakeAt(t);
  const eye = v3.add(pos, sh), look = v3.add(target, v3.scale(sh, 0.6));
  const z = v3.norm(v3.sub(eye, look));
  const x = v3.norm(v3.cross([0, 1, 0], z));
  const y = v3.cross(z, x);
  return { tr: trs(eye, qFromBasis(x, y, z)), pos: eye, target, fov: F.fov(t), fstop: F.fstop(t), focus: v3.len(v3.sub(pos, target)) };
}
