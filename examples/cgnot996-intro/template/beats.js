// film-local (cgnot996-intro): the three beats inserted between act 3's exit and the end card
// (film.json story.insert; the clocks are in timeline.js), each on its own little stage with its
// own camera, joined by the toy leaping out of the top and dropping into the next (Kin's cut).
// From the user's own words (2026-10-26) and research/materials-v2.html:
//   D  「由野生嘅 xAI 大使變做官方認證嘅 xAI 大使」: he drops in wearing a torn-paper 「野生大使」;
//      the invitation flies in as an envelope, opens, the card slides up; a red 「官方认证」 seal
//      slaps onto his badge and 「野生」 bursts off; Ben Lang's post pops up like a notification
//   E  「佢之前成日話自己係『老馬得唔到嘅男人』，而家老馬就得到佢喇」: 「马斯克得不到的男人」
//      rises letter by letter; he kicks the 「不」 out at the camera and the line closes up
//   C  「官方俾咗兩個官網佢，佢仲寫咗其中一個…Grok 嘅新手教學」: Grok Bot 新手指南's orange
//      stepping stones pop up; he hops along them and leaps out to the end card
// The badge stays on him from D to the end. Times are seconds into the gap (T.GB).
import { film } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/film.js";
import * as T from "./timeline.js";
import * as A from "./anim.js";
import { TOY, CENTER, MASCOT_PARTS } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/toy.js";
import { basePose, squash, landSquash, crouch, hop, heroT, partsAt } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/rig.js";
import { makeCamera } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/camera.js";
import { clamp01, seg, smooth, lerp, easeOut, easeIn, easeInOut, backOut, TAU, v3 } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/math.js";
import { mulberry32 } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/rng.js";
import { qId, qMul, qEuler, qRot, qSlerp, trs, apply, mulT } from "/Users/chris/Developer/ChrisHKAI-Video/skills/creator-toy-intro/engine/lib/quat.js";
import * as OW from "./opening.js"; // film-local: the opening (O) and the calendar (W)

const MM = A.MM, HIDDEN = A.HIDDEN, G = T.GB;
export const ON = T.SEGMENTS.some((g) => g.beat);
const T0 = T.T_INS;
const gOf = (t) => t - T0;
// the stages: far apart (beyond the camera's clip distance) and from the end card's
const SD = [150, 0, 0], SE = [200, 0, 0], SC = [250, 0, 0];
const at = (s, x, y, z) => [s[0] + x, s[1] + y, s[2] + z];
const hiddenAt = (p) => trs(p, qId(), HIDDEN);
const POP = 1.3; // the toy's size on the small stages, as on the end card
// the film's hard cuts: every segment's start, and inside G into E and into C
export const CUTS = ON ? [...T.SEGMENTS.slice(1).map((g) => g.f0), ...(T.INSERT ? [T0 + G.eIn, ...(G.cIn < T.GAP ? [T0 + G.cIn] : [])] : [])].sort((a, b) => a - b) : [];
const glyph = (k) => A.GLYPHS[k];
const adv = (k) => (glyph(k) ? glyph(k).advance : 0.3);

// ── The toy ─────────────────────────────────────────────────────────────────
const D_SPOT = at(SD, 0.075, 0, 0);
const LINE = [..."马斯克得不到的男人"], BU = 4; // 不
const E_EM = 0.062;
const E_X = (() => { const w = LINE.reduce((s, c) => s + adv(`heavy:${c}`) * E_EM, 0); let x = -w / 2; return LINE.map((c) => { const a = x; x += adv(`heavy:${c}`) * E_EM; return a; }); })();
const E_SPOT = at(SE, E_X[BU] + adv("heavy:不") * E_EM / 2 + 0.01, 0, -0.075);
const STONES = [[-0.27, 0.035], [-0.12, 0.0], [0.03, -0.03], [0.18, -0.055]];
const STONE_TOP = 0.026;
const stoneTop = (i) => at(SC, STONES[i][0], STONE_TOP, STONES[i][1]);

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
function cheer(o, g, g0, g1) {
  const s = seg(g, g0, g1), up = Math.sin(Math.PI * s);
  o.pos[1] += 0.05 * up;
  o.armR = [0, 0, -2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
  o.armL = [0, 0, 2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
  o.legR = [-0.5 * up, 0, 0]; o.legL = [-0.5 * up, 0, 0];
  return crouch(g, g0, 0.12) + landSquash(g, g1, 0.22);
}

function poseD(g) {
  const o = basePose(D_SPOT);
  o.pop = POP;
  if (g < G.dLand) return fallIn(o, g, 0.0, G.dLand, D_SPOT);
  if (g >= G.dLeap[0]) return leapUp(o, g, G.dLeap[0], G.dLeap[1], D_SPOT);
  let q = landSquash(g, G.dLand, 0.28) + crouch(g, G.dLeap[0], 0.16);
  o.yaw = 0.15;
  // looks down at his badge, then turns to the envelope as it flies in
  const down = smooth(seg(g, 0.7, 0.9)) * (1 - smooth(seg(g, 1.15, 1.35)));
  o.head = [-0.3 * down, 0.12 * down, 0];
  o.armR = [0, 0, -0.12 - 1.4 * down];
  const turn = smooth(seg(g, 1.0, 1.5)) * (1 - smooth(seg(g, 3.1, 3.4)));
  o.yaw = lerp(0.15, -0.55, turn);
  o.head = v3.add(o.head, [0.15 * turn * smooth(seg(g, G.card[0], G.card[1])) - 0.1 * turn, 0, 0]);
  // the seal hits his chest: a jolt back
  const hit = g - G.seal[1];
  if (hit > 0 && hit < 0.4) { q += 0.35 * Math.exp(-hit * 8); o.pos[2] -= 0.008 * Math.exp(-hit * 6) * Math.sin(Math.min(1, hit * 6) * Math.PI); }
  if (g >= G.cheer[0] && g < G.cheer[1] + 0.1) q += cheer(o, g, G.cheer[0], G.cheer[1]);
  // looks up at Ben's post
  const up = smooth(seg(g, G.ben[0] + 0.1, G.ben[0] + 0.4));
  if (g > G.cheer[1]) { o.yaw = lerp(0.15, 0.35, up); o.head = [-0.35 * up, 0.15 * up, 0]; o.armL = [0, 0, 0.12 + 0.6 * up]; }
  squash(o, q);
  return o;
}

function poseE(g) {
  const o = basePose(E_SPOT);
  o.pop = POP;
  if (g < G.eLand) return fallIn(o, g, G.eIn, G.eLand, E_SPOT);
  if (g >= G.eLeap[0]) return leapUp(o, g, G.eLeap[0], G.eLeap[1], E_SPOT);
  let q = landSquash(g, G.eLand, 0.28) + crouch(g, G.eLeap[0], 0.16);
  o.yaw = 0.0;
  // watches the line rise, then winds up and kicks the 不 (his right leg, from behind the line)
  const wind = smooth(seg(g, G.kick - 0.45, G.kick - 0.1));
  const kick = seg(g, G.kick - 0.1, G.kick + 0.08);
  const back = smooth(seg(g, G.kick + 0.15, G.kick + 0.5));
  o.legR = [lerp(0.6 * wind, -1.3, easeOut(kick)) * (1 - back), 0, 0];
  o.body = [lerp(-0.15 * wind, 0.2, kick) * (1 - back), 0, 0];
  o.armR = [0, 0, -0.12 - 0.9 * wind * (1 - back)]; o.armL = [0, 0, 0.12 + 0.9 * wind * (1 - back)];
  q += crouch(g, G.kick - 0.1, 0.08 * wind);
  o.head = [0.25 * smooth(seg(g, G.eLand, G.eLand + 0.3)) * (1 - wind), 0, 0];
  // the line closes up: a glance at you, his own move
  const sg = seg(g, G.sig[0], G.sig[0] + 0.2) * (1 - seg(g, G.sig[1] - 0.15, G.sig[1]));
  A.signature(o, g, G.sig[0], sg);
  o.glint = Math.exp(-Math.pow((g - (G.sig[0] + 0.3)) / 0.09, 2));
  squash(o, q);
  return o;
}

function poseC(g) {
  const o = basePose(stoneTop(0));
  o.pop = POP;
  if (g < G.cLand) return fallIn(o, g, G.cIn, G.cLand, stoneTop(0));
  const H = G.hops;
  for (let i = 0; i < H.length; i++) {
    if (g >= H[i][0] && g < H[i][1]) { hop(o, g, stoneTop(i), stoneTop(i + 1), H[i][0], H[i][1], 0.05, { yaw: 0.35 }); o.pop = POP; return o; }
  }
  const i = H.filter(([, b]) => g >= b).length;
  if (g >= G.cLeap[0]) return leapUp(o, g, G.cLeap[0], G.cLeap[1], stoneTop(i));
  o.pos = stoneTop(i);
  o.ground = o.pos[1];
  o.yaw = 0.35;
  squash(o, (i ? landSquash(g, H[i - 1][1], 0.22) : landSquash(g, G.cLand, 0.26)) + (i < H.length ? crouch(g, H[i][0], 0.12) : crouch(g, G.cLeap[0], 0.16)));
  return o;
}

export function poseAt(t) {
  const b = T.beatAt(t);
  if (b && b.name !== "G") return OW.poseAt(b.name, b.g);
  const g = gOf(t);
  return g < G.eIn ? poseD(g) : g < G.cIn ? poseE(g) : poseC(g);
}
export function mascot(t) {
  const o = poseAt(t);
  const hero = o.show === false ? trs(o.pos, qId(), HIDDEN) : heroT(o, CENTER); // not out yet (O: before the pop)
  return { hero, o, parts: partsAt(hero, o, TOY) };
}
// his contact shadow on the stage floors
export function blobAt(t) {
  const { o } = mascot(t);
  const h = Math.max(0, o.pos[1] - o.ground), k = clamp01(1 - h / 0.12), s = 1.15 - 0.35 * k;
  return { tr: trs([o.pos[0], o.ground + 0.0007, o.pos[2]], qEuler(-Math.PI / 2, 0, 0), k > 0.01 ? [0.07 * s * o.pop, 0.05 * s * o.pop, 1] : HIDDEN), opacity: 0.7 * k * k };
}
export const glintAt = (t) => poseAt(t).glint ?? 0;

// ── The badge on his chest: 「野生大使」, then 「官方认证」 slapped over 「野生」 ─────
// Toy space (the torso part's own frame): the chest's front, a little below the collar.
const TORSO = MASCOT_PARTS.findIndex((p) => p.name === "head"); // film-local: on his head, over the fringe (the user: "野生大使改係佢個頭到")
// on top of his hair, standing, the letters near twice the size (the user: "野生大使移去頭頂，放大字體"); the hair tops out at y 0.1228
const BADGE = { c: [0, 0.131, 0.004], w: 0.058, h: 0.0205, em: 0.0128, tilt: [-0.12, 0, 0.06] };
const WILD = [..."野生大使"], SEAL = [..."官方认证"];
const WILD_X = (() => { let x = -WILD.length * BADGE.em / 2; return WILD.map((c) => { const a = x; x += adv(`heavy:${c}`) * BADGE.em; return a; }); })();
// the seal: 官方认证 in one line, its right edge on 生's, so the sign reads 官方认证大使
const SEAL_W = 4 * BADGE.em + 0.003, SEAL_H = BADGE.h + 0.0018;
const SEAL_C = [WILD_X[2] - SEAL_W / 2 + 0.0008, 0, 0.0016]; // badge-local
const badgeOn = (t) => ON && t >= T0 && t < T0 + G.eIn; // only in D (the user: "下一幕就消失")
// the toy's parts are hero-local (they hang under the hero object): the badge is hero × torso × its place
function badgeFrame(parts, hero) { return mulT(hero, mulT(parts[TORSO], trs(BADGE.c, qEuler(...BADGE.tilt)))); }
export function badgeParts(t, parts, hero) {
  const out = {};
  const on = badgeOn(t);
  const f = badgeFrame(parts, hero);
  const hide = (name) => { out[name] = mulT(f, trs([0, 0, 0], qId(), HIDDEN)); };
  if (!on) { ["badge_sheet", "badge_seal", ...WILD.map((_, i) => `badge_w${i}`), ...SEAL.map((_, i) => `badge_s${i}`)].forEach(hide); return out; }
  const g = gOf(t);
  out.badge_sheet = mulT(f, trs([0, 0, 0]));
  // 野 and 生 burst off when the seal hits; 大 and 使 stay
  WILD.forEach((c, i) => {
    const local = trs([WILD_X[i], -0.36 * BADGE.em, 0.0007]);
    if (i >= 2 || g < G.seal[1]) { out[`badge_w${i}`] = mulT(f, local); return; }
    const dt = g - G.seal[1];
    if (dt > 0.8) { out[`badge_w${i}`] = mulT(f, trs([0, 0, 0], qId(), HIDDEN)); return; }
    const w0 = apply(mulT(f, local), [0, 0, 0]);
    const v = [i ? 0.12 : -0.18, 0.35, 0.25];
    const p = [w0[0] + v[0] * dt, w0[1] + v[1] * dt - 1.2 * dt * dt, w0[2] + v[2] * dt];
    out[`badge_w${i}`] = trs(p, qMul(f.q, qEuler(dt * 7, dt * (i ? -5 : 5), dt * 6)), f.s.map((s) => s * (1 - seg(dt, 0.5, 0.8))));
  });
  // the seal flies in from the front right, spinning, and slaps on
  const sealLocal = trs(SEAL_C, qId());
  let seal;
  if (g < G.seal[0]) seal = mulT(f, trs(SEAL_C, qId(), HIDDEN));
  else if (g < G.seal[1]) {
    const u = easeIn(seg(g, G.seal[0], G.seal[1]));
    const home = mulT(f, sealLocal);
    const from = v3.add(home.p, [0.18, 0.14, 0.22]);
    seal = trs(v3.lerp(from, home.p, u), qMul(home.q, qEuler(0, 0, TAU * 1.5 * (1 - u))), home.s.map((s) => s * lerp(2.2, 1, u)));
  } else {
    const b = g - G.seal[1];
    const sq = 1 + 0.25 * Math.exp(-b * 14) * Math.cos(b * 40);
    seal = mulT(f, trs(SEAL_C, qId(), [sq, 2 - sq, 1]));
  }
  out.badge_seal = seal;
  SEAL.forEach((c, i) => {
    const em = BADGE.em * 0.92;
    out[`badge_s${i}`] = mulT(seal, trs([-2 * em + i * em, -0.36 * em, 0.001]));
  });
  return out;
}

// ── D: the envelope, the invitation, Ben's post ─────────────────────────────
const ENV = { w: 0.11, d: 0.072, t: 0.006, at: at(SD, -0.115, 0, 0.035) };
// both cards bigger than first built (the user: "兩個發光貼太細太光睇唔清")
const CARD = { w: 0.22, h: 0.22 * 600 / 1400 };
const BEN = { w: 0.25, h: 0.25 * 470 / 1400, at: at(SD, 0.0, 0.25, -0.06) };
function envelopeAt(g) {
  if (g < G.envFly[0]) return trs(at(SD, -0.6, 0.35, 0.1), qId(), HIDDEN);
  if (g < G.envFly[1]) {
    const u = seg(g, G.envFly[0], G.envFly[1]), e = easeOut(u);
    const p = v3.lerp(at(SD, -0.55, 0.3, 0.12), ENV.at, e);
    p[1] = lerp(0.3, ENV.t / 2, easeIn(u)) + 0.08 * Math.sin(Math.PI * u);
    return trs(p, qEuler(0.6 * (1 - u), TAU * 1.25 * (1 - e), 0.4 * (1 - u)));
  }
  const b = g - G.envFly[1];
  const sq = 0.25 * Math.exp(-b * 12) * Math.cos(b * 35);
  return trs([ENV.at[0], ENV.t / 2, ENV.at[2]], qId(), [1 + sq * 0.4, 1 - sq, 1 + sq * 0.4]);
}
// the flap: hinged on the envelope's back edge, folded over its top, swinging up and back
function flapAt(g) {
  const env = envelopeAt(g);
  const a = g < G.flap[0] ? 0 : backOut(seg(g, G.flap[0], G.flap[1]), 1.4) * 2.6;
  return mulT(env, trs([0, ENV.t / 2 + 0.0004, -ENV.d / 2], qEuler(-Math.PI / 2 - a, 0, 0)));
}
// Both cards, once up, fly to the camera — three quarters of the frame's width, square on, in the middle —
// hold there to be read, and go back to their places (the user: "放大到佔畫面3／4 show 下先，再縮返去")
const zoomW = (g, [a, b, c, d]) => (g < a || g > d ? 0 : g < b ? backOut(seg(g, a, b), 1.2) : g < c ? 1 : 1 - easeInOut(seg(g, c, d)));
function zoomed(g, home, width, span) {
  const w = zoomW(g, span);
  if (w <= 0) return home;
  const cam = baseCamera(T0 + g);
  const d = width / (0.75 * 2 * Math.tan((cam.fov * Math.PI) / 360) * T.ASPECT); // the distance where it is 3/4 of the frame wide
  const near = trs(v3.add(cam.pos, v3.scale(qRot(cam.tr.q, [0, 0, -1]), d)), cam.tr.q);
  return trs(v3.lerp(home.p, near.p, w), qSlerp(home.q, near.q, Math.min(1, w)), v3.lerp(home.s, near.s, w));
}
function inviteAt(g) {
  if (g < G.card[0]) return trs(v3.add(ENV.at, [0, 0.004, 0]), qId(), HIDDEN);
  const u = backOut(seg(g, G.card[0], G.card[1]), 1.3);
  const y = lerp(0.004, 0.012 + CARD.h / 2 + 0.04, u);
  const bob = g > G.card[1] ? 0.002 * Math.sin((g - G.card[1]) * 3) : 0;
  return zoomed(g, trs([ENV.at[0], y + bob, ENV.at[2] - 0.004], qEuler(-0.05, 0.18 * u, 0), lerp(0.3, 1, Math.min(1, u))), CARD.w, G.cardZoom);
}
// Ben's post pops up over him first
function benAt(g) {
  if (g < G.ben[0]) return trs(v3.add(BEN.at, [0, 0.12, 0]), qId(), HIDDEN);
  const u = seg(g, G.ben[0], G.ben[1]);
  const p = v3.add(BEN.at, [0, 0.08 * (1 - easeOut(u)) + 0.003 * Math.sin((g - G.ben[0]) * 2.5), 0]);
  return zoomed(g, trs(p, qEuler(0.04, -0.12, 0), lerp(0.4, 1, backOut(u, 1.8))), BEN.w, G.benZoom);
}

// ── E: the line, the kick ───────────────────────────────────────────────────
const E_BASE = 0.12 * E_EM; // the glyphs' lowest point sits on the floor
function letterAt(i, g) {
  const x0 = E_X[i];
  const g0 = G.letters + i * 0.125;
  if (g < g0) return trs(at(SE, x0, -E_EM, 0), qId(), HIDDEN);
  const u = backOut(seg(g, g0, g0 + 0.18), 1.6);
  let x = x0, y = lerp(-E_EM, E_BASE, Math.min(1, u)), z = 0;
  // the line closes the 不's gap: the left half moves right, the right half left
  const w = adv("heavy:不") * E_EM;
  const c = easeInOut(seg(g, G.close[0], G.close[1]));
  if (i < BU) x += (w / 2) * c;
  if (i > BU) x -= (w / 2) * c;
  if (i === BU && g >= G.kick) {
    // kicked: at the camera, tumbling, out of frame
    const dt = g - G.kick;
    if (dt > 0.7) return trs(at(SE, 0, -1, 0), qId(), HIDDEN);
    const v = [0.22, 0.55, 1.5];
    const p = at(SE, x0 + v[0] * dt, E_BASE + v[1] * dt - 1.2 * dt * dt, v[2] * dt);
    return trs(p, qEuler(dt * 9, dt * 4, dt * 6), 1 + 0.6 * dt);
  }
  const land = g > G.close[1] && i !== BU ? 0.12 * Math.exp(-(g - G.close[1]) * 12) * Math.cos((g - G.close[1]) * 35) : 0;
  return trs(at(SE, x, y, z), qId(), [1, Math.max(0.2, Math.min(1, u)) * (1 - land), 1]);
}

// ── C: the stones, the title ────────────────────────────────────────────────
const TITLE = [..."Grok Bot 新手指南"], T_EM = 0.034;
const TITLE_X = (() => { const w = TITLE.reduce((s, c) => s + (c === " " ? 0.3 : adv(`heavy:${c}`)) * T_EM, 0); let x = -w / 2; return TITLE.map((c) => { const a = x; x += (c === " " ? 0.3 : adv(`heavy:${c}`)) * T_EM; return a; }); })();
function stoneAt(i, g, cap) {
  const [x, z] = STONES[i];
  const g0 = G.stones + i * 0.08;
  const u = g < g0 ? 0 : backOut(seg(g, g0, g0 + 0.2), 1.8);
  const y = cap ? 0.023 : 0.01;
  if (g < g0) return trs(at(SC, x, -0.05, z), qId(), HIDDEN);
  const land = (H) => { const k = G.hops.findIndex(([, b]) => Math.abs(g - b) < 0.3 && g >= b); return k >= 0 && k + 1 === i ? 0.1 * Math.exp(-(g - G.hops[k][1]) * 14) : 0; };
  const sq = (i === 0 ? (g >= G.cLand ? 0.12 * Math.exp(-(g - G.cLand) * 14) : 0) : land());
  return trs(at(SC, x, lerp(-0.05, y, Math.min(1, u)) - sq * 0.01, z), qId(), [1, Math.max(0.1, 1 - sq), 1]);
}
function titleLetterAt(i, g) {
  const g0 = G.title + i * 0.03;
  if (g < g0 || TITLE[i] === " ") return trs(at(SC, TITLE_X[i], 0.2, -0.13), qId(), HIDDEN);
  const u = backOut(seg(g, g0, g0 + 0.15), 2);
  return trs(at(SC, TITLE_X[i] - 0.02, 0.135, -0.13), qEuler(-0.1, 0, 0), Math.max(HIDDEN, Math.min(1.2, u)));
}

// ── Objects ─────────────────────────────────────────────────────────────────
export function declare(add, glyphGeo, pack) {
  if (!ON) return;
  OW.declare(add, glyphGeo, pack);
  for (const s of [SD, SE, SC]) add({ name: `stage_${s[0]}`, geo: { type: "plane", w: 10, h: 10 }, mat: { type: "stage" }, tr: pack(trs(s, qEuler(-Math.PI / 2, 0, 0))) });
  // the badge
  const paper = { type: "paper", color: "#F3EBDC" };
  add({ name: "badge_sheet", geo: { type: "roundBox", size: [BADGE.w, BADGE.h, 0.0012], radius: 0.0006 }, mat: paper, anim: true });
  WILD.forEach((c, i) => add({ name: `badge_w${i}`, geo: glyphGeo(`heavy:${c}`, BADGE.em, 0.0007, 0.0001), mat: { type: "type", color: "#161514", emit: 0 }, anim: true }));
  add({ name: "badge_seal", geo: { type: "roundBox", size: [SEAL_W, SEAL_H, 0.0016], radius: 0.0007 }, mat: { type: "type", color: "#D93A2B", emit: 0.12 }, anim: true });
  SEAL.forEach((c, i) => add({ name: `badge_s${i}`, geo: glyphGeo(`heavy:${c}`, BADGE.em * 0.92, 0.0005, 0.0001), mat: { type: "type", color: "#FFF6E8", emit: 0.2 }, anim: true }));
  // D
  add({ name: "env_body", geo: { type: "roundBox", size: [ENV.w, ENV.t, ENV.d], radius: 0.0015 }, mat: { type: "paper", color: "#EFE6D6" }, anim: true });
  add({ name: "env_flap", geo: { type: "curve", rings: [[[-ENV.w / 2, 0], [ENV.w / 2, 0], [0, -ENV.d * 0.62]]], depth: 0.0008, bevel: 0.0002 }, mat: { type: "paper", color: "#E6DAC4" }, anim: true });
  add({ name: "env_seal", geo: { type: "ellipsoid", r: [0.008, 0.008, 0.0025] }, mat: { type: "type", color: "#1D9BF0", emit: 0.2 }, anim: true });
  add({ name: "invite", geo: { type: "plane", w: CARD.w, h: CARD.h }, mat: { type: "card2d", image: "assets/invite-card.png", glow: 0.08 }, anim: true });
  add({ name: "bencard", geo: { type: "plane", w: BEN.w, h: BEN.h }, mat: { type: "card2d", image: "assets/ben-card.png", glow: 0.08 }, anim: true });
  // E
  // the line's letters: cream faces over darker sides, barely lit from inside (the user: "睇唔清马斯克得到的男人 太光")
  const E_LOOK = { depth: 0.014, emit: 0.06, side: "#8A8378" };
  LINE.forEach((c, i) => add({ name: `eline_${i}`, geo: glyphGeo(`heavy:${c}`, E_EM, E_LOOK.depth, 0.0012), mat: { type: "type", color: i === BU ? "#E0392B" : "#F4F1EA", side: i === BU ? "#8E2219" : E_LOOK.side, emit: i === BU ? 0.25 : E_LOOK.emit }, anim: true }));
  // C
  STONES.forEach((_, i) => {
    add({ name: `stone_${i}`, geo: { type: "roundBox", size: [0.07, 0.02, 0.07], radius: 0.003 }, mat: { type: "type", color: "#F08A2C", emit: 0.06 }, anim: true });
    add({ name: `stonecap_${i}`, geo: { type: "roundBox", size: [0.07, 0.006, 0.07], radius: 0.002 }, mat: { type: "type", color: "#F4F1EA", emit: 0.06 }, anim: true });
  });
  TITLE.forEach((c, i) => { if (c !== " ") add({ name: `ctitle_${i}`, geo: glyphGeo(`heavy:${c}`, T_EM, 0.008, 0.0008), mat: { type: "type", color: i < 8 ? "#F4F1EA" : "#F08A2C", emit: 0.35 }, anim: true }); });
}

export function sample(put, t, parts, hero) {
  if (!ON) return;
  OW.sample(put, t);
  for (const [n, tr] of Object.entries(badgeParts(t, parts, hero))) put(n, tr);
  const g = gOf(t);
  const inD = T.inGap(t) && g < G.eIn, inE = T.inGap(t) && g >= G.eIn && g < G.cIn, inC = T.inGap(t) && g >= G.cIn;
  const hide = (name, p) => put(name, hiddenAt(p));
  // D
  if (inD) {
    const env = envelopeAt(g);
    put("env_body", env); put("env_flap", flapAt(g));
    put("env_seal", mulT(env, trs([0, ENV.t / 2 + 0.001, 0.008], qEuler(-Math.PI / 2, 0, 0), g < G.flap[0] ? 1 : HIDDEN)));
    put("invite", inviteAt(g)); put("bencard", benAt(g));
  } else ["env_body", "env_flap", "env_seal", "invite", "bencard"].forEach((n) => hide(n, at(SD, 0, -1, 0)));
  // E
  LINE.forEach((_, i) => (inE ? put(`eline_${i}`, letterAt(i, g)) : hide(`eline_${i}`, at(SE, E_X[i], -1, 0))));
  // C
  STONES.forEach((_, i) => {
    if (inC) { put(`stone_${i}`, stoneAt(i, g, false)); put(`stonecap_${i}`, stoneAt(i, g, true)); }
    else { hide(`stone_${i}`, at(SC, STONES[i][0], -1, 0)); hide(`stonecap_${i}`, at(SC, STONES[i][0], -1, 0)); }
  });
  TITLE.forEach((c, i) => { if (c !== " ") (inC ? put(`ctitle_${i}`, titleLetterAt(i, g)) : hide(`ctitle_${i}`, at(SC, 0, -1, 0))); });
}

// ── Camera and light ────────────────────────────────────────────────────────
const k = (g, s, x, y, z, dist, elev, az, fstop = 5.6) => ({ t: +(T0 + g).toFixed(4), target: at(s, x, y, z), dist, elev, az, fstop });
const KEYS_D = [k(0, SD, -0.02, 0.085, 0, 0.62, 9, 6), k(1.6, SD, -0.04, 0.075, 0.02, 0.58, 10, 2), k(2.95, SD, -0.08, 0.085, 0.02, 0.48, 8, -4), k(4.75, SD, -0.07, 0.085, 0.02, 0.46, 8, -2),
  k(5.4, SD, 0.08, 0.14, 0.0, 0.36, 6, 10, 4.5), k(6.0, SD, 0.07, 0.145, 0, 0.42, 7, 8, 4.5), k(7.0, SD, 0.07, 0.145, 0, 0.4, 7, 7, 4.5), k(7.7, SD, 0.0, 0.16, -0.02, 0.62, 8, 4), k(10.7, SD, 0.0, 0.162, -0.02, 0.63, 8, 4), k(11.6, SD, 0.0, 0.165, -0.02, 0.64, 8, 4)];
const KEYS_E = [k(G.eIn, SE, 0, 0.065, 0, 0.84, 7, 0), k(G.kick - 0.2, SE, 0, 0.06, 0, 0.78, 7, 0), k(G.close[1], SE, 0, 0.06, 0, 0.74, 7, 0), k(G.eLeap[1], SE, 0, 0.065, 0, 0.76, 7, 0)];
const KEYS_C = [k(G.cIn, SC, -0.12, 0.075, 0, 0.72, 14, 8), k(G.hops[1][0], SC, -0.02, 0.08, 0, 0.7, 13, 6), k(G.cLeap[1], SC, 0.08, 0.1, -0.03, 0.72, 12, 4)];
const baseCamera = ON ? makeCamera({
  shots: [
    ...(OW.HAS_O ? [{ start: -Infinity, keys: OW.KEYS_O, target: (kk) => kk.target }] : []),
    ...(OW.HAS_W ? [{ start: T.SEGMENTS.find((g) => g.beat === "W").f0, keys: OW.KEYS_W, target: (kk) => kk.target }] : []),
    { start: T0, keys: KEYS_D, target: (kk) => kk.target },
    { start: T0 + G.eIn, keys: KEYS_E, target: (kk) => kk.target },
    ...(G.cIn < T.GAP ? [{ start: T0 + G.cIn, keys: KEYS_C, target: (kk) => kk.target }] : []),
  ],
  fov: T.FOV,
  shakes: [...OW.SHAKES, [T0 + G.envFly[1], 0.25], [T0 + G.seal[1], 0.8], [T0 + G.kick, 1.0], [T0 + G.close[1], 0.35], [T0 + G.cLand, 0.25]],
  aspect: T.ASPECT,
}) : null;
// while a card is up at the camera the focus follows it there
export const cameraAt = ON ? (t) => {
  const c = baseCamera(t), g = gOf(t);
  for (const [span, at_] of [[G.cardZoom, inviteAt], [G.benZoom, benAt]]) {
    const w = zoomW(g, span);
    if (w > 0) c.focus = lerp(c.focus, v3.len(v3.sub(at_(g).p, c.pos)), Math.min(1, w));
  }
  return c;
} : null;
export function fxAt(t) {
  const b = T.beatAt(t);
  if (b && b.name !== "G") return OW.fxAt(b.name, b.g);
  const g = gOf(t);
  const pulse = (a, kk, d = 0.2) => (g >= a ? kk * Math.exp(-(g - a) / d) : 0);
  if (g < G.eIn) return { p: at(SD, 0.03, 0.12, 0.12), energy: 0.25 + pulse(G.seal[1], 1.8, 0.25) + pulse(G.card[1], 0.5, 0.2), color: "#FFE9D6" };
  if (g < G.cIn) return { p: at(SE, 0, 0.12, 0.15), energy: 0.25 + pulse(G.kick, 1.2, 0.2) + pulse(G.close[1], 1.0, 0.25), color: "#FFF1E6" };
  return { p: at(SC, 0, 0.14, 0.12), energy: 0.3 + pulse(G.cLand, 0.6, 0.2), color: "#FFE6CC" };
}

// the calendar drives the follower count's digits while it plays
export const statOverride = (t) => OW.statW(t);
