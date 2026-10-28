// film-local (cgnot996-intro): the two beats that open the film now (film.json story.segments),
// each on its own stage, out of every other shot:
//   O  the opening, Kin's (videos/kingao-intro) mirrored, as the user asked ("開頭果幕改做用 kin 開頭
//      果幕，不過係由右至左"): his X page fills the frame flat like a screen; it turns right and backs
//      off to the left while its columns part into floating slabs; his own picture bulges and, on the
//      2.0 s downbeat, he puffs out of it as the toy and leaps to the floor; his glasses; off the top
//   W  the follower count, from the date he started to the day he reached 10,000 ("从 7 月 10 号到
//      10 月 24 号達成萬粉"): a desk flip calendar rises showing 7月10日; its pages flip ever faster
//      while the count beside it climbs; on the 10.0 s downbeat it stops at 10月24日, the count locks
//      on 10,000 关注者 and a red 万粉 stamp slams onto the page
// Times are seconds into each beat (T.OB, T.WB); the page is 0.5 mm a UI px, as Kin's.
import { film } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/film.js";
import * as T from "./timeline.js";
import * as A from "./anim.js";
import { CENTER } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/toy.js";
import { basePose, squash, landSquash, crouch, hop } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/rig.js";
import { seg, smooth, lerp, easeOut, easeIn, easeInOut, backOut, TAU, v3 } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/math.js";
import { mulberry32 } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/rng.js";
import { qId, qMul, qAxis, qEuler, qRot, trs, apply, mulT } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/quat.js";

const HIDDEN = A.HIDDEN;
const OB = T.OB, WB = T.WB;
const SEG_O = T.SEGMENTS.find((g) => g.beat === "O"), SEG_W = T.SEGMENTS.find((g) => g.beat === "W");
export const HAS_O = !!SEG_O, HAS_W = !!SEG_W;
const SO = [-150, 0, 0], SW = [-200, 0, 0];
const at = (s, x, y, z) => [s[0] + x, s[1] + y, s[2] + z];
const hiddenAt = (p) => trs(p, qId(), HIDDEN);
const adv = (k) => (A.GLYPHS[k] ? A.GLYPHS[k].advance : 0.3);

function fallIn(o, g, g0, g1, spot) {
  const u = seg(g, g0, g1);
  o.pos = v3.add(spot, [0, 0.9 * Math.pow(1 - u, 2), 0]);
  o.ground = spot[1];
  o.armR = [0, 0, -2.0]; o.armL = [0, 0, 2.0];
  o.legR = [-0.4, 0, 0]; o.legL = [-0.4, 0, 0];
  return o;
}
function leapUp(o, g, g0, g1, spot) {
  const s = seg(g, g0, g1);
  o.pos = v3.add(spot, [0, 0.85 * Math.pow(s, 0.8), 0]);
  o.ground = spot[1];
  squash(o, crouch(g, g0, 0.16));
  o.armR = [0, 0, -2.4 * smooth(s)]; o.armL = [0, 0, 2.4 * smooth(s)];
  o.legR = [0.5 * s, 0, 0]; o.legL = [0.5 * s, 0, 0];
  return o;
}

// ── O: the page ─────────────────────────────────────────────────────────────
const PX = 0.0005;
const ui = (u, v) => [(u - T.UI_W / 2) * PX, (T.UI_H / 2 - v) * PX];
const PAGE_C = (T.UI_H / 2) * PX + 0.004; // its bottom just above the floor
const PAGE0 = [0, PAGE_C, 0], PAGE1 = [-0.16, PAGE_C, -0.12];
const PAGE_YAW = (62 * Math.PI) / 180; // Kin's turned left (-62°): this one turns right
const UPRIGHT = qAxis([1, 0, 0], Math.PI / 2); // a page slab (lying face up) stood up, facing you
function pageAt(g) {
  const s = easeInOut(seg(g, OB.turn[0], OB.turn[1]));
  const over = g > OB.turn[1] - 0.3 ? 0.05 * Math.sin(Math.PI * seg(g, OB.turn[1] - 0.3, OB.turn[1] + 0.5)) : 0;
  return trs(at(SO, ...v3.lerp(PAGE0, PAGE1, s)), qAxis([0, 1, 0], PAGE_YAW * s + over * 0.3));
}
const DEPTH = { header: 0.012, banner: 0.006, info: 0.02, tabs: 0.01, pinned: 0.015, retro: 0.008 };
export const O_PANELS = Object.keys(T.PANELS);
function oPanelAt(name, g) {
  const [x, y, w, h] = T.PANELS[name];
  const c = ui(x + w / 2, y + h / 2);
  const s = easeInOut(seg(g, OB.split[0], OB.split[1]));
  let local;
  if (name === "nav" || name === "side") {
    const k = name === "nav" ? -1 : 1;
    const d = easeIn(seg(g, OB.split[0], OB.split[1] + 0.2));
    local = trs([c[0] + k * 0.25 * d, c[1] - 0.05 * d, -0.55 * d], qMul(qAxis([0, 1, 0], k * 0.5 * d), UPRIGHT), 0.5);
    if (g > OB.split[1] + 0.25) local = trs(local.p, local.q, HIDDEN);
  } else local = trs([c[0], c[1], (DEPTH[name] ?? 0.01) * s], UPRIGHT, 0.5);
  return mulT(pageAt(g), local);
}
// the page's own white behind the columns: pushed back into the dark as they part
function backingAt(g) {
  const d = easeIn(seg(g, OB.turn[0], OB.turn[0] + 0.55));
  const tr = mulT(pageAt(g), trs([0, 0, -0.006 - 0.9 * d], UPRIGHT, 0.5));
  return g > OB.turn[0] + 0.6 ? trs(tr.p, tr.q, HIDDEN) : tr;
}
// his picture: a round card over the banner and the info slab
const AV = T.AVATAR;
export const AV_D = AV.d * PX;
const AV_LOCAL = [...ui(...AV.c), 0];
function avatarLocalZ(g) { return 0.0015 + (DEPTH.info + 0.004) * easeInOut(seg(g, OB.split[0], OB.split[1])); }
function oAvatarAt(g) {
  const b = seg(g, OB.bulge[0], OB.bulge[1]), e = easeIn(b);
  const wob = 0.04 * Math.sin(b * 26) * b;
  const tr = mulT(pageAt(g), trs([AV_LOCAL[0], AV_LOCAL[1], avatarLocalZ(g) + 0.012 * e], qEuler(0, 0, wob), [1 + 0.1 * e, 1 + 0.1 * e + wob, 1]));
  return g >= OB.pop ? trs(tr.p, tr.q, HIDDEN) : tr;
}
const avatarWorld = (g) => apply(pageAt(g), [AV_LOCAL[0], AV_LOCAL[1], avatarLocalZ(g) + 0.012]);
const LAND_O = at(SO, 0.13, 0, 0.09);
function poseO(g) {
  const o = basePose(LAND_O);
  if (g < OB.pop) { o.show = false; o.pos = v3.sub(avatarWorld(OB.pop), [0, CENTER[1], 0]); return o; }
  if (g < OB.land) {
    const start = v3.sub(avatarWorld(OB.pop), [0, CENTER[1], 0]);
    hop(o, g, start, LAND_O, OB.pop, OB.land, 0.05);
    const s = seg(g, OB.pop, OB.land);
    const n = qRot(pageAt(OB.pop).q, [0, 0, 1]);
    o.yaw = lerp(Math.atan2(n[0], n[2]), -0.1, smooth(seg(g, OB.pop + 0.08, OB.land - 0.05)));
    const inflate = seg(g, OB.pop, OB.pop + 0.18);
    o.flat = lerp(0.05, 1, backOut(inflate, 2.4));
    o.pop = lerp(0.72, 1, smooth(inflate));
    o.pitch = -0.35 * Math.sin(Math.PI * s);
    o.legL = o.legR = [-1.1 * Math.sin(Math.PI * s), 0, 0];
    o.ground = 0;
    return o;
  }
  if (g >= OB.leap[0]) return leapUp(o, g, OB.leap[0], OB.leap[1], LAND_O);
  o.yaw = -0.1;
  const k = seg(g, OB.sig[0], OB.sig[0] + 0.25) * (1 - seg(g, OB.sig[1] - 0.2, OB.sig[1]));
  A.signature(o, g, OB.sig[0], k);
  o.head = [-0.12 * k, -0.1 * k, -0.08 * k];
  o.glint = Math.exp(-Math.pow((g - (OB.sig[0] + 0.4)) / 0.09, 2));
  squash(o, landSquash(g, OB.land, 0.26) + crouch(g, OB.leap[0], 0.16));
  return o;
}

// ── W: the flip calendar ───────────────────────────────────────────────────
const W_SPOT = at(SW, -0.175, 0, 0.05);
const CAL = { x: 0, z: 0, w: 0.16, h: 0.19, d: 0.035, base: 0.025, band: 0.05 };
const DAYS = (() => { const a = Date.UTC(2026, 6, 10), b = Date.UTC(2026, 9, 24); return Math.round((b - a) / 864e5); })(); // 106
const dateOf = (n) => { const d = new Date(Date.UTC(2026, 6, 10) + n * 864e5); return { m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const flipS = (g) => easeInOut(seg(g, WB.flip[0], WB.flip[1]));
const nAt = (g) => flipS(g) * DAYS;
const countAt = (g) => (g < WB.flip[0] ? 0 : Math.round(10000 * Math.pow(flipS(g), 1.8)));
function calAt(g) {
  const u = seg(g, WB.cal[0], WB.cal[1]);
  if (g < WB.cal[0]) return trs(at(SW, CAL.x, -0.3, CAL.z), qId(), HIDDEN);
  const hit = g - WB.lock;
  const jolt = hit > 0 ? 0.04 * Math.exp(-hit * 10) * Math.cos(hit * 35) : 0;
  return trs(at(SW, CAL.x, lerp(-0.25, 0, Math.min(1, backOut(u, 1.4))), CAL.z), qEuler(0, -0.12, 0), [1 + jolt, 1 - jolt, 1 + jolt]);
}
const M_EM = 0.034, D_EM = 0.085;
const PAGE_FRONT = CAL.d / 2 + 0.0004;
// the digits of a number in a row centred on x0 (calendar-local), as { key: x }
function rowOf(text, em, x0) {
  const w = [...text].reduce((s, c) => s + adv(`latin:${c}`) * em, 0);
  let x = x0 - w / 2;
  return [...text].map((c, i) => { const a = x; x += adv(`latin:${c}`) * em; return { slot: text.length - 1 - i, c, x: a }; });
}
// the calendar's lettering: month digits + 月 on the red band, the day's big digits on the page
function calGlyphs(g, cal) {
  const out = {};
  const { m, d } = dateOf(Math.round(Math.min(DAYS, nAt(g))));
  const mText = String(m), dText = String(d);
  const wm = [...mText].reduce((s, c) => s + adv(`latin:${c}`) * M_EM, 0) + adv("heavy:月") * M_EM;
  const mx0 = -wm / 2;
  const yb = CAL.base + CAL.h - CAL.band / 2 - 0.36 * M_EM;
  for (let i = 0; i < 2; i++) for (let k = 0; k <= 9; k++) out[`cal_m${i}_${k}`] = mulT(cal, trs([0, 0, 0], qId(), HIDDEN));
  let x = mx0;
  [...mText].forEach((c, i) => { out[`cal_m${mText.length - 1 - i}_${c}`] = mulT(cal, trs([x, yb, PAGE_FRONT + 0.0012])); x += adv(`latin:${c}`) * M_EM; });
  out.cal_yue = mulT(cal, trs([x, yb, PAGE_FRONT + 0.0012]));
  for (let i = 0; i < 2; i++) for (let k = 0; k <= 9; k++) out[`cal_d${i}_${k}`] = mulT(cal, trs([0, 0, 0], qId(), HIDDEN));
  const yd = CAL.base + 0.06; // the day's baseline: the stamp goes below it
  rowOf(dText, D_EM, 0).forEach(({ slot, c, x: xx }) => { out[`cal_d${slot}_${c}`] = mulT(cal, trs([xx, yd, PAGE_FRONT + 0.0006])); });
  return out;
}
// the pages that flip away: hinged at the rings on top, over the top to the back
export const FLIPS = 2;
function flipAt(i, g, cal) {
  const top = CAL.base + CAL.h - CAL.band; // under the red band: only the day's sheet flips
  const hidden = mulT(cal, trs([0, top, 0], qId(), HIDDEN));
  if (g < WB.flip[0] || g >= WB.flip[1]) return hidden;
  const n = nAt(g), rate = (nAt(g + 0.01) - n) / 0.01;
  if (i > 0 && rate < 6) return hidden; // slow: one page at a time
  const p = ((n + i / FLIPS) % 1 + 1) % 1;
  const a = -Math.PI * easeOut(Math.min(1, p * 1.6));
  if (p > 0.62) return hidden;
  return mulT(cal, mulT(trs([0, top, PAGE_FRONT + 0.0015], qAxis([1, 0, 0], a)), trs([0, -(CAL.h - CAL.band) / 2, 0])));
}
// the stamp: 万粉, slammed onto the page on the lock
function stampAt(g, cal) {
  const home = mulT(cal, trs([0.004, CAL.base + 0.03, PAGE_FRONT + 0.004], qEuler(0, 0, -0.12), 0.85));
  if (g < WB.lock - 0.25) return trs(home.p, home.q, HIDDEN);
  if (g < WB.lock) {
    const u = easeIn(seg(g, WB.lock - 0.25, WB.lock));
    return trs(v3.lerp(v3.add(home.p, [0.05, 0.2, 0.3]), home.p, u), qMul(home.q, qEuler(0.6 * (1 - u), 0, 0.5 * (1 - u))), home.s.map((v) => v * lerp(2.0, 1, u)));
  }
  const b = g - WB.lock, sq = 0.22 * Math.exp(-b * 14) * Math.cos(b * 40);
  return trs(home.p, home.q, [home.s[0] * (1 + sq), home.s[1] * (1 - sq), home.s[2]]);
}
const STAMP = [..."万粉"], S_EM = 0.036;
// the follower count (the act 2 counter's own digits): to the right of the calendar
function countGroup(g) {
  const u = seg(g, WB.label - 0.2, WB.label + 0.2);
  const punch = g > WB.lock ? 0.09 * Math.exp(-(g - WB.lock) * 9) * Math.cos((g - WB.lock) * 30) : 0;
  return trs(at(SW, 0.205, 0.115, 0.03), qEuler(-0.05, -0.18, 0), Math.max(HIDDEN, 0.5 * backOut(u, 1.6) * (1 + punch)));
}
export function statW(t) {
  if (!HAS_W) return null;
  const g = t - SEG_W.f0;
  if (g < 0 || g >= SEG_W.len) return null;
  return A.followGlyphs(countAt(g), countGroup(g));
}
export const countCentre = (t) => apply(countGroup(t - SEG_W.f0), [0, 0.02, 0]);
export const CONFETTI = 16;
function confettiAt(i, g) {
  const r = mulberry32(900 + i);
  const p0 = at(SW, 0.0, 0.11, 0.05);
  const dt = g - WB.lock;
  if (dt < 0 || dt > 1.6) return hiddenAt(p0);
  const a = r() * TAU, sp = 0.25 + r() * 0.35;
  const v0 = [Math.cos(a) * sp * 0.9, 0.5 + r() * 0.5, Math.abs(Math.sin(a)) * sp * 0.6 + 0.05];
  const p = [p0[0] + v0[0] * dt, Math.max(0.0007, p0[1] + v0[1] * dt - 1.2 * dt * dt), p0[2] + v0[2] * dt];
  return trs(p, qEuler(dt * (4 + r() * 8), dt * (3 + r() * 6), dt * 5), 1 - seg(dt, 1.3, 1.6));
}
function poseW(g) {
  const o = basePose(W_SPOT);
  if (g < WB.drop[1]) return fallIn(o, g, WB.drop[0], WB.drop[1], W_SPOT);
  if (g >= WB.leap[0]) return leapUp(o, g, WB.leap[0], WB.leap[1], W_SPOT);
  let q = landSquash(g, WB.drop[1], 0.26) + crouch(g, WB.leap[0], 0.16);
  // he turns to the calendar as it rises and points at it while the pages fly
  const turn = smooth(seg(g, WB.cal[0], WB.cal[0] + 0.4));
  o.yaw = lerp(0, 0.75, turn);
  const k = smooth(seg(g, WB.flip[0] - 0.3, WB.flip[0])) * (1 - smooth(seg(g, WB.lock - 0.1, WB.lock + 0.1)));
  if (k > 0) { o.aimR = { world: apply(calAt(g), [0, CAL.base + 0.1, PAGE_FRONT]), k, len: 1.1 }; o.pointR = k; o.head = [-0.1 * k, 0.15 * k, 0]; }
  if (g >= WB.cheer[0] && g < WB.cheer[1] + 0.1) {
    const s = seg(g, WB.cheer[0], WB.cheer[1]), up = Math.sin(Math.PI * s);
    o.pos[1] += 0.05 * up;
    o.armR = [0, 0, -2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))]; o.armL = [0, 0, 2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
    o.legR = [-0.5 * up, 0, 0]; o.legL = [-0.5 * up, 0, 0];
    q += crouch(g, WB.cheer[0], 0.12) + landSquash(g, WB.cheer[1], 0.22);
  }
  squash(o, q);
  return o;
}

// ── For beats.js ────────────────────────────────────────────────────────────
export function poseAt(name, g) { return name === "O" ? poseO(g) : poseW(g); }
export function declare(add, glyphGeo, pack) {
  if (HAS_O) {
    // the light-mode page lit from inside at less than 1: at 1 its white blooms over the grey text (the user: "睇唔到")
    const O_GLOW = 0.75;
    add({ name: "o_stage", geo: { type: "plane", w: 10, h: 10 }, mat: { type: "stage" }, tr: pack(trs(SO, qEuler(-Math.PI / 2, 0, 0))) });
    const UI = { image: "assets/ui.png", w: T.UI_W, h: T.UI_H };
    for (const name of O_PANELS) {
      const r = T.PANELS[name];
      add({ name: `o_${name}`, geo: { type: "uiBox", rect: [-r[2] / 2, -r[3] / 2, r[2], r[3]], uvRect: r, img: UI, thickness: A.SLAB_T }, mat: { type: "ui", image: UI.image, strength: O_GLOW }, anim: true });
    }
    add({ name: "o_back", geo: { type: "uiBox", rect: [-T.UI_W / 2, -T.UI_H / 2, T.UI_W, T.UI_H], uvRect: [20, 20, 200, 200], img: UI, thickness: 0.002 }, mat: { type: "ui", image: UI.image, strength: O_GLOW }, anim: true });
    add({ name: "o_avatar", geo: { type: "plane", w: AV_D, h: AV_D }, mat: { type: "card2d", image: "assets/avatar.png" }, anim: true });
  }
  if (HAS_W) {
    add({ name: "w_stage", geo: { type: "plane", w: 10, h: 10 }, mat: { type: "stage" }, tr: pack(trs(SW, qEuler(-Math.PI / 2, 0, 0))) });
    add({ name: "cal_base", geo: { type: "roundBox", size: [CAL.w + 0.02, CAL.base, CAL.d + 0.05], radius: 0.004 }, mat: { type: "type", color: "#2B2E35", emit: 0 }, anim: true });
    add({ name: "cal_page", geo: { type: "roundBox", size: [CAL.w, CAL.h - CAL.band, CAL.d], radius: 0.003 }, mat: { type: "paper", color: "#F7F4EE" }, anim: true });
    add({ name: "cal_band", geo: { type: "roundBox", size: [CAL.w + 0.001, CAL.band, CAL.d + 0.001], radius: 0.003 }, mat: { type: "type", color: "#D93A2B", emit: 0.06 }, anim: true });
    [-1, 1].forEach((k) => add({ name: `cal_ring${k}`, geo: { type: "roundBox", size: [0.012, 0.022, 0.012], radius: 0.004 }, mat: { type: "type", color: "#C9CDD3", emit: 0 }, anim: true }));
    for (let i = 0; i < 2; i++) for (let k = 0; k <= 9; k++) {
      add({ name: `cal_m${i}_${k}`, geo: glyphGeo(`latin:${k}`, M_EM, 0.002, 0.0003), mat: { type: "type", color: "#FFF6E8", emit: 0.25 }, anim: true, step: true });
      add({ name: `cal_d${i}_${k}`, geo: glyphGeo(`latin:${k}`, D_EM, 0.004, 0.0005), mat: { type: "type", color: "#1B1C20", emit: 0 }, anim: true, step: true });
    }
    add({ name: "cal_yue", geo: glyphGeo("heavy:月", M_EM, 0.002, 0.0003), mat: { type: "type", color: "#FFF6E8", emit: 0.25 }, anim: true });
    for (let i = 0; i < FLIPS; i++) {
      add({ name: `cal_flip${i}`, geo: { type: "roundBox", size: [CAL.w - 0.002, CAL.h - CAL.band, 0.0008], radius: 0.001 }, mat: { type: "paper", color: "#F7F4EE" }, anim: true });
      add({ name: `cal_flipband${i}`, geo: { type: "roundBox", size: [CAL.w - 0.002, CAL.band, 0.0009], radius: 0.001 }, mat: { type: "type", color: "#D93A2B", emit: 0.06 }, anim: true });
    }
    add({ name: "cal_stamp", geo: { type: "roundBox", size: [0.115, 0.052, 0.006], radius: 0.006 }, mat: { type: "type", color: "#D93A2B", emit: 0.12 }, anim: true });
    STAMP.forEach((c, i) => add({ name: `cal_s${i}`, geo: glyphGeo(`heavy:${c}`, S_EM, 0.002, 0.0003), mat: { type: "type", color: "#FFF6E8", emit: 0.25 }, anim: true }));
    const cols = film.pop.confetti;
    for (let i = 0; i < CONFETTI; i++) add({ name: `w_conf${i}`, geo: { type: "box", size: [0.008, 0.0008, 0.006] }, mat: { type: "type", color: cols[i % cols.length], emit: 0.1 }, anim: true });
  }
}
export function sample(put, t) {
  if (HAS_O) {
    const g = t - SEG_O.f0, on = g >= 0 && g < SEG_O.len;
    const gg = on ? g : SEG_O.len; // after the beat the page stands where it ended, out of every other shot
    for (const name of O_PANELS) put(`o_${name}`, on ? oPanelAt(name, gg) : hiddenAt(at(SO, 0, -1, 0)));
    put("o_back", on ? backingAt(gg) : hiddenAt(at(SO, 0, -1, 0)));
    put("o_avatar", on ? oAvatarAt(gg) : hiddenAt(at(SO, 0, -1, 0)));
  }
  if (HAS_W) {
    const g = t - SEG_W.f0, on = g >= 0 && g < SEG_W.len;
    const cal = calAt(on ? g : -1);
    const hide = (name) => put(name, hiddenAt(at(SW, 0, -1, 0)));
    if (!on) {
      ["cal_base", "cal_page", "cal_band", "cal_ring-1", "cal_ring1", "cal_yue", "cal_stamp", ...STAMP.map((_, i) => `cal_s${i}`)].forEach(hide);
      for (let i = 0; i < 2; i++) for (let k = 0; k <= 9; k++) { hide(`cal_m${i}_${k}`); hide(`cal_d${i}_${k}`); }
      for (let i = 0; i < FLIPS; i++) { hide(`cal_flip${i}`); hide(`cal_flipband${i}`); }
      for (let i = 0; i < CONFETTI; i++) hide(`w_conf${i}`);
      return;
    }
    put("cal_base", mulT(cal, trs([0, CAL.base / 2, 0])));
    put("cal_page", mulT(cal, trs([0, CAL.base + (CAL.h - CAL.band) / 2, 0])));
    put("cal_band", mulT(cal, trs([0, CAL.base + CAL.h - CAL.band / 2, 0])));
    [-1, 1].forEach((k) => put(`cal_ring${k}`, mulT(cal, trs([k * 0.045, CAL.base + CAL.h + 0.006, 0]))));
    for (const [n, tr] of Object.entries(calGlyphs(g, cal))) put(n, tr);
    for (let i = 0; i < FLIPS; i++) {
      const f = flipAt(i, g, cal);
      put(`cal_flip${i}`, f);
      put(`cal_flipband${i}`, trs(f.p, f.q, HIDDEN));
    }
    const st = stampAt(g, cal);
    put("cal_stamp", st);
    const w = STAMP.reduce((s, c) => s + adv(`heavy:${c}`) * S_EM, 0);
    let x = -w / 2;
    STAMP.forEach((c, i) => { put(`cal_s${i}`, mulT(st, trs([x, -0.36 * S_EM, 0.0032]))); x += adv(`heavy:${c}`) * S_EM; });
    for (let i = 0; i < CONFETTI; i++) put(`w_conf${i}`, confettiAt(i, g));
  }
}
// the beats' cameras (film time) and lights
const kO = (g, x, y, z, dist, elev, az, fstop) => ({ t: +(SEG_O.f0 + g).toFixed(4), target: at(SO, x, y, z), dist, elev, az, fstop });
const kW = (g, x, y, z, dist, elev, az, fstop = 6) => ({ t: +(SEG_W.f0 + g).toFixed(4), target: at(SW, x, y, z), dist, elev, az, fstop });
const TOP_Y = PAGE_C + ui(0, 394)[1]; // the page's upper part (UI y 0–788) fills the frame
export const KEYS_O = HAS_O ? [kO(0, 0, TOP_Y, 0, 0.735, 0, 0, 32), kO(OB.turn[0], 0, TOP_Y, 0, 0.735, 0, 0, 32), kO(OB.turn[1], -0.16, 0.55, -0.02, 0.85, 3, 20, 7),
  kO(OB.pop + 0.05, -0.14, 0.52, 0.03, 0.82, 4, 18, 6), kO(OB.pop + 0.35, -0.02, 0.3, 0.06, 0.85, 5, 14, 6), kO(OB.land + 0.25, 0.12, 0.08, 0.08, 0.6, 7, 6, 4.5), kO(OB.sig[1], 0.13, 0.085, 0.09, 0.46, 7, 0, 4), kO(SEG_O.len, 0.13, 0.12, 0.09, 0.5, 8, 0, 4.5)] : [];
export const KEYS_W = HAS_W ? [kW(0, -0.02, 0.12, 0, 0.82, 9, 0), kW(WB.flip[0], 0.02, 0.12, 0, 0.76, 8, 0), kW(WB.lock - 0.1, 0.03, 0.12, 0, 0.7, 8, 2), kW(WB.cheer[1], 0.02, 0.12, 0, 0.74, 8, 0), kW(SEG_W.len, 0.0, 0.14, 0, 0.78, 9, 0)] : [];
export const SHAKES = [...(HAS_O ? [[SEG_O.f0 + OB.pop, 0.4]] : []), ...(HAS_W ? [[SEG_W.f0 + WB.lock, 0.7]] : [])];
export function fxAt(name, g) {
  const pulse = (a, k, d = 0.2) => (g >= a ? k * Math.exp(-(g - a) / d) : 0);
  if (name === "O") return { p: at(SO, 0.05, 0.3, 0.2), energy: 0.2 + pulse(OB.pop, 1.2, 0.18), color: "#FFE9E0" };
  return { p: at(SW, 0.05, 0.2, 0.18), energy: 0.25 + pulse(WB.lock, 1.6, 0.22), color: "#FFE6CC" };
}
