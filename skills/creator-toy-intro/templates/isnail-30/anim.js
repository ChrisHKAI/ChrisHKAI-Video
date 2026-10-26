// The isnail-30 story: every moving thing's state at film time t, as plain
// numbers. The engine's modules do the general work (the toy's rig, the
// camera, the sticker peel, the counter, torn-paper labels, particles); this
// file is the choreography. world.js samples it twice a frame. World space is
// Three.js-style: metres, +y up, +z toward the viewer's (south) edge of the
// page; 1 UI px = 1 mm, UI centre at the origin, slab tops at y = 0.
// Transforms are { p, q, s }.
import { film, readFilmJSON } from "../../engine/lib/film.js";
import * as T from "./timeline.js";
import { TOY, CENTER } from "../../engine/lib/toy.js";
import { clamp01, seg, smooth, lerp, easeOut, easeIn, easeInOut, backOut, TAU, v3, lerpAngle, yawTo } from "../../engine/lib/math.js";
import { basePose, squash, landSquash, crouch, hop, heroT, partsAt } from "../../engine/lib/rig.js";
import { makeCamera, smoothTracker } from "../../engine/lib/camera.js";
import { makeLabel, tear, labelT, rimT, letterT } from "../../engine/lib/labels.js";
import { ballistic } from "../../engine/lib/particles.js";
import { makePeel } from "../../engine/lib/peel.js";
import { counterLayout, countEase, counterGlyphs } from "../../engine/lib/counter.js";
import { mulberry32 } from "../../engine/lib/rng.js";
import { qId, qMul, qAxis, qEuler, qRot, trs, apply, mulT } from "../../engine/lib/quat.js";

export const MM = 0.001;
export const SLAB_T = 0.008;
export const HIDDEN = 1e-4;
export const wx = (px) => (px - T.UI_W / 2) * MM;
export const wz = (py) => (py - T.UI_H / 2) * MM;
const P = (spot, h = 0) => [wx(spot[0]), h, wz(spot[1])];

const hidden = (p) => trs(p.slice(), qId(), HIDDEN);
const E = T.EV;

// ── The cover pieces (scripts/cover.py) ─────────────────────────────────────
export const COVER = readFilmJSON("build/cover.json", null) ?? { w: 1028, h: 411, pieces: [] };
export const WALL_W = T.COVER_MM * MM;
export const WALL_H = WALL_W * COVER.h / COVER.w;
export const coverToWall = ([u, v]) => [(u - 0.5) * WALL_W, (1 - v) * WALL_H];
const pieceOf = (name) => COVER.pieces.find((p) => p.name === name);
// the top edge of a box face (its first two corners) at wall x, in mm
function topAt(name, xmm) {
  const ring = pieceOf(name).rings[0].map(coverToWall);
  const [a, b] = ring;
  return lerp(a[1], b[1], clamp01((xmm * MM - a[0]) / (b[0] - a[0]))) / MM;
}

// ── Slabs ───────────────────────────────────────────────────────────────────
const rectCentre = (r) => [wx(r[0] + r[2] / 2), 0, wz(r[1] + r[3] / 2)];
const SINK = { nav: 0.0, header: 0.05, banner: 0.07, info: 0.04, tabs: 0.09, retro: 0.03, side: 0.02 };
export const PINNED_LIFT = 0.03;
function pinnedY(t) {
  const press = t >= E.click - 0.04 && t < E.click + 0.14 ? -0.0025 * Math.sin(seg(t, E.click - 0.04, E.click + 0.14) * Math.PI) : 0;
  return press + PINNED_LIFT * easeInOut(seg(t, E.focus[0] + 0.05, E.focus[1])) - 1.3 * easeIn(seg(t, E.sink2[0], E.sink2[1]));
}
export function panelAt(name, t) {
  const b = rectCentre(T.PANELS[name]);
  if (name === "pinned") return trs([b[0], pinnedY(t), b[2]]);
  const d = SINK[name] ?? 0;
  const s = easeIn(seg(t, E.focus[0] + d, E.focus[1] + d + 0.15));
  const out = [b[0], -1.3 * s, b[2] + 0.06 * s]; // down under the floor, out of every later shot
  return trs(out, qEuler(0.12 * s * (b[2] > 0 ? 1 : -1), 0, 0.05 * s * Math.sign(b[0] || 1)));
}
export const RETRO_Y = PINNED_LIFT;
export function retroAt(t) {
  const b = rectCentre(T.RETRO_RECT);
  const s = seg(t, E.retroIn[0], E.retroIn[1]);
  const y = t < E.retroIn[0] ? -0.6 : lerp(-0.6, RETRO_Y, backOut(s, 0.9));
  return trs([b[0], y, b[2]], qEuler(0.25 * (1 - smooth(s)), 0, 0));
}

// ── The profile picture sticker: strips that peel up off the far edge ──────
const AV = T.AVATAR;
const D = AV.d * MM;
const HINGE = [wx(AV.c[0]), 0.0006, wz(AV.c[1]) + D / 2]; // near edge (camera side)
export const { stripAt, STRIPS, STRIP_W, STRIP_H } = makePeel({ hinge: HINGE, size: D, strips: 24, peel: E.peel, pop: E.pop });

// ── The pinned cover as a wall (act 2) ──────────────────────────────────────
export const COVER2 = readFilmJSON("build/cover2.json", null) ?? { w: 1983, h: 793, pieces: [] };
export const WALL2_H = WALL_W * COVER2.h / COVER2.w;
export const coverToWall2 = ([u, v]) => [(u - 0.5) * WALL_W, (1 - v) * WALL2_H];
const WALL2_HINGE = [wx(T.PINNED_COVER[0] + T.PINNED_COVER[2] / 2), 0, wz(T.PINNED_COVER[1] + T.PINNED_COVER[3])];
export function wall2At(t) {
  const s = seg(t, E.stand2[0], E.stand2[1]);
  const th = lerp(-Math.PI / 2, 0, backOut(s, 1.2));
  const k = lerp(T.PINNED_COVER[2] / T.COVER_MM, 1, easeInOut(s));
  return trs([WALL2_HINGE[0], pinnedY(t) + 0.0005, WALL2_HINGE[2]], qAxis([1, 0, 0], th), k);
}
export const piece2Depth = (p) => T.WALL2[p.name][1] * MM;
export function piece2At(p, t) {
  const [at, depth] = T.WALL2[p.name];
  const out = 0.3 + (depth - 0.3) * backOut(seg(t, at, at + 0.2), 1.7);
  return trs([0, 0, (out - depth / 2) * MM]);
}
export const wall2Centre = (t) => apply(wall2At(Math.max(t, E.stand2[1])), [0, WALL2_H / 2, 0]);

// ── The 2D mascot sticker on the 《自媒体很苦》 cover (scripts/sticker2d.py) ────
// He becomes it at the end of act 3 and peels back off it at 24 s, so the toy
// and the drawing are never on screen together. Wall-local metres.
const STK = readFilmJSON("build/sticker2d.json", null)?.uv ?? [0.531, 0.02, 0.705, 0.52];
export const STICKER = (() => {
  const [u0, v0, u1, v1] = STK;
  const w = (u1 - u0) * T.COVER_MM * MM, h = (v1 - v0) * (T.COVER_MM * COVER.h / COVER.w) * MM;
  const cx = ((u0 + u1) / 2 - 0.5) * T.COVER_MM * MM;
  const bottom = (1 - v1) * (T.COVER_MM * COVER.h / COVER.w) * MM;
  return { w, h, cx, cy: bottom + h / 2, feet: bottom + 0.003 };
})();

// ── The mascot (poses; engine/lib/rig.js turns them into parts) ────────────
// places
const POP = P(T.SPOT.pop), LAND = P(T.SPOT.land), HOP1 = P(T.SPOT.hop1);
const onPinned = (spot, t) => { const p = P(spot); p[1] = pinnedY(t); return p; };

// the wall (act 3): world transform and wall-local → world
export const WALL_HINGE = [wx(T.RETRO_COVER[0] + T.RETRO_COVER[2] / 2), 0, wz(T.RETRO_COVER[1] + T.RETRO_COVER[3])];
const FLAT_SCALE = T.RETRO_COVER[2] / T.COVER_MM;
export function wallAt(t) {
  const r = retroAt(t);
  const base = [WALL_HINGE[0], r.p[1] + 0.0005, WALL_HINGE[2] + (r.p[2] - rectCentre(T.RETRO_RECT)[2])];
  const s = seg(t, E.stand[0], E.stand[1]);
  const up = backOut(s, 1.2);
  const th = lerp(-Math.PI / 2, 0, up);
  const k = lerp(FLAT_SCALE, 1, easeInOut(s));
  // the retro slab tips back a little while it rises: the wall rides it
  return { tr: trs(base, qMul(r.q, qAxis([1, 0, 0], th)), k), stood: s };
}
const onWall = (t, x, y, z) => apply(wallAt(t).tr, [x * MM, y * MM, z * MM]);
// how far each piece stands out of the wall (mm, the front face)
export function protrudeAt(name, t) {
  const W = T.WALL;
  const back = 1 - easeInOut(seg(t, E.flat[0], E.flat[0] + 0.45));
  const f = (v) => 0.3 + (v - 0.3) * back;
  switch (name) {
    case "tag": return f(0.3 + W.ledge.depth * backOut(seg(t, 12.35, 12.65), 1.1));
    case "box9": {
      let k = 0;
      for (let i = 1; i <= 9; i++) k += easeOut(seg(t, E.rise9[0] + (i - 1) * 0.175, E.rise9[0] + (i - 1) * 0.175 + 0.09));
      return f(0.3 + W.box9.depth * k / 9);
    }
    case "box46": return f(0.3 + W.box46.depth * easeInOut(seg(t, E.rise46[0], E.rise46[1])));
    case "box7": return f(0.3 + W.box7.depth * backOut(seg(t, E.rise7[0], E.rise7[1]), 2.2));
    case "arrow": return f(0.3 + W.arrow.depth * backOut(seg(t, E.arrow[0], E.arrow[1]), 2.5));
    case "title": {
      const out = easeOut(seg(t, 12.72, 12.9)), slam = easeIn(seg(t, 12.9, E.slam));
      const rest = W.title.depth;
      let z = t < 12.9 ? lerp(0.3, 150, out) : lerp(150, rest, slam);
      if (t > E.slam) z = rest - 6 * Math.exp(-(t - E.slam) * 12) * Math.cos((t - E.slam) * 40);
      return f(z);
    }
    default: return 0.3;
  }
}
// a piece's wall-local transform: pushed out along z, the title swinging
// about its own middle as it flies out and slams back
const PIECE_DEPTH = Object.fromEntries(Object.values(T.WALL).map((w) => [w.piece, w.depth]));
export const pieceDepth = (p) => (p.kind === "ink" ? PIECE_DEPTH[p.of] + 5 : PIECE_DEPTH[p.name]) * MM;
const centroid = (p) => {
  const pts = p.rings.flat().map(coverToWall);
  return [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length, 0];
};
const PIVOT = Object.fromEntries(COVER.pieces.map((p) => [p.name, centroid(p)]));
export function pieceAt(p, t) {
  const base = p.kind === "ink" ? p.of : p.name;
  const out = protrudeAt(base, t);
  const z = (p.kind === "ink" ? out + 5 * Math.min(1, out / 10) : out) * MM - pieceDepth(p) / 2;
  if (base !== "title") return trs([0, 0, z]);
  const c = PIVOT.title;
  const q = titleTilt(t);
  const rc = qRot(q, c);
  return trs([c[0] - rc[0], c[1] - rc[1], z], q);
}
// the title also swings as it flies out and slams back
export function titleTilt(t) {
  const out = Math.sin(seg(t, 12.72, E.slam) * Math.PI);
  return qEuler(-0.25 * out, 0.12 * out, 0.06 * out);
}

export function mascotPose(t) {
  const o = basePose(POP);
  if (t < E.pop) { o.show = false; return o; }
  // ── act 1: pop, land, the glasses, down the profile ──
  if (t < E.land) {
    const s = seg(t, E.pop, E.land);
    const a = [POP[0], 0.0, POP[2]], b = LAND;
    o.pos = v3.lerp(a, b, easeOut(s));
    o.pos[1] = 0.075 * Math.sin(Math.PI * Math.min(1, s * 1.15));
    const inflate = seg(t, E.pop, E.pop + 0.16);
    o.flat = lerp(0.04, 1, backOut(inflate, 2.4));
    o.pop = lerp(1.18, 1, smooth(inflate));
    o.yaw = lerp(0, 0.35, smooth(s));
    o.armR = [0, 0, -1.2 * Math.sin(Math.PI * s)]; o.armL = [0, 0, 1.2 * Math.sin(Math.PI * s)];
    o.legR = [-0.3 * Math.sin(Math.PI * s), 0, 0]; o.legL = [0.3 * Math.sin(Math.PI * s), 0, 0];
    o.ears = [0, 0, 0.25 * Math.sin(s * 9) * (1 - s)];
    return o;
  }
  if (t < E.hops[0][0]) {
    o.pos = LAND.slice();
    squash(o, landSquash(t, E.land, 0.26) + crouch(t, E.hops[0][0]));
    const look = seg(t, 2.45, 2.75);
    o.yaw = lerp(0.35, -0.15, smooth(look));
    o.head = [0, 0.35 * Math.sin(look * Math.PI), 0];
    const g = seg(t, E.push[0], E.push[0] + 0.25) * (1 - seg(t, E.push[1] - 0.2, E.push[1]));
    o.aimL = { target: [27, 63, 13], k: smooth(g) }; // fingers to the temple of his glasses
    o.head = v3.add(o.head, [-0.12 * g, -0.1 * g, -0.1 * g]);
    o.body = [-0.06 * g, 0.12 * g, 0];
    o.armR = [0.1 * g, 0, -0.25 - 0.1 * g];
    o.glint = Math.exp(-Math.pow((t - E.lensGlint) / 0.09, 2));
    o.ears = [0, 0, 0.08 * Math.sin(t * 7) * g];
    return o;
  }
  const [h1, h2] = E.hops;
  if (t < h1[1]) { hop(o, t, LAND, HOP1, h1[0], h1[1], 0.05); return o; }
  if (t < h2[0]) { o.pos = HOP1.slice(); o.yaw = yawTo(HOP1, P(T.SPOT.post)); squash(o, landSquash(t, h1[1], 0.2) + crouch(t, h2[0], 0.12)); return o; }
  if (t < h2[1]) { hop(o, t, HOP1, P(T.SPOT.post), h2[0], h2[1], 0.08); o.pitch = -0.2 * Math.sin(seg(t, h2[0], h2[1]) * Math.PI); return o; }
  // ── act 2: the click, the views ──
  const F2 = (t2) => onPinned(T.SPOT.front2, t2);
  if (t >= E.hopOff[0] && t < E.hopOff[1]) { hop(o, t, onPinned(T.SPOT.post, t), F2(t), E.hopOff[0], E.hopOff[1], 0.06, { yaw: 0.2 }); return o; }
  if (t >= E.hopOff[1] && t < E.walk[0]) {
    // in front of the cover as it stands up behind him: he turns round to watch
    o.pos = F2(t);
    o.ground = o.pos[1];
    o.yaw = lerp(0.2, Math.PI - 0.5, smooth(seg(t, 6.45, 6.75)));
    o.head = [-0.3 * smooth(seg(t, 6.5, 6.8)), 0, 0];
    squash(o, landSquash(t, E.hopOff[1], 0.24) + crouch(t, E.walk[0], 0.12));
    return o;
  }
  if (t < E.walk[0]) {
    o.pos = onPinned(T.SPOT.post, t);
    o.yaw = lerp(yawTo(HOP1, P(T.SPOT.post)), 0.2, smooth(seg(t, h2[1], h2[1] + 0.3)));
    let q = landSquash(t, h2[1], 0.24);
    // a little jump, then the stomp that clicks the post
    const j = seg(t, E.click - 0.32, E.click);
    o.pos[1] += 0.03 * Math.sin(Math.PI * j);
    q += crouch(t, E.click - 0.32, 0.1) + landSquash(t, E.click, 0.32);
    o.legR = [-0.5 * Math.sin(Math.PI * j), 0, 0];
    o.head = [0.25 * smooth(seg(t, 5.3, 5.6)), 0, 0];
    squash(o, q);
    if (t > E.click) { o.head = [0.1, 0, 0]; o.ears = [0, 0, 0.3 * Math.exp(-(t - E.click) * 6) * Math.sin((t - E.click) * 30)]; }
    o.ground = pinnedY(t);
    return o;
  }
  const H2 = T.SPOT.hop2, V = T.SPOT.views;
  if (t < 7.2) { hop(o, t, F2(t), onPinned(H2, t), E.walk[0], 7.2, 0.035); return o; }
  if (t < E.walk[1]) { hop(o, t, onPinned(H2, t), onPinned(V, t), 7.2, E.walk[1], 0.035); return o; }
  if (t < E.retroIn[1]) {
    o.pos = onPinned(V, t);
    o.ground = o.pos[1];
    const c = statCentre(t);
    o.yaw = lerp(yawTo(onPinned(H2, t), onPinned(V, t)), -0.75, smooth(seg(t, E.walk[1], E.point)));
    let q = landSquash(t, E.walk[1], 0.2);
    if (t < E.lock + 0.05) {
      const k = smooth(seg(t, E.point - 0.15, E.point + 0.1));
      o.aimL = { world: v3.add(c, [0, 0.02, 0]), k, len: 1.15 };
      o.pointL = k;
      o.head = [-0.15 * k, 0.4 * k, 0];
      o.body = [0, 0.2 * k, 0];
      o.legL = [-0.25 * k, 0, 0]; o.legR = [0.2 * k, 0, 0];
    } else {
      // cheer: hop with both arms up
      const s = seg(t, E.cheer[0], E.cheer[1]);
      const up = Math.sin(Math.PI * seg(t, 10.15, 10.55));
      o.pos[1] += 0.045 * up;
      o.armR = [0, 0, -2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
      o.armL = [0, 0, 2.5 * Math.sin(Math.PI * Math.min(1, s * 1.3))];
      o.legR = [-0.5 * up, 0, 0]; o.legL = [-0.5 * up, 0, 0];
      q += crouch(t, 10.15, 0.12) + landSquash(t, 10.55, 0.22);
      o.ears = [0, 0, 0.2 * Math.sin(t * 20) * Math.sin(Math.PI * s)];
      o.yaw = lerp(o.yaw, yawTo(o.pos, P(T.SPOT.front, RETRO_Y)), smooth(seg(t, 10.8, 11.3)));
    }
    q += crouch(t, E.leap[0], 0.16);
    squash(o, q);
    return o;
  }
  if (t < E.leap[0]) { o.pos = onPinned(V, t); o.yaw = yawTo(o.pos, P(T.SPOT.front, RETRO_Y)); squash(o, crouch(t, E.leap[0], 0.16)); return o; }
  // ── act 3: the wall ──
  const FRONT = P(T.SPOT.front, RETRO_Y);
  if (t < E.stand[0] + 0.05) {
    hop(o, t, onPinned(V, E.leap[0]), FRONT, E.leap[0], E.stand[0] + 0.05, 0.12, { flip: true });
    o.yaw = lerpAngle(yawTo(onPinned(V, E.leap[0]), FRONT), Math.PI, seg(t, E.leap[0] + 0.3, E.stand[0]));
    return o;
  }
  const W = T.WALL;
  const ledge = (t2) => { const x = W.ledge.at[0]; return onWall(t2, x, topAt("tag", x), protrudeAt("tag", t2) * 0.5); };
  if (t < 12.7) {
    o.pos = FRONT.slice();
    o.yaw = Math.PI - 0.5 * smooth(seg(t, 12.1, 12.5)); // watches the wall go up behind him… then turns to it
    o.head = [-0.35 * Math.sin(Math.PI * seg(t, 12.05, 12.65)), 0, 0];
    squash(o, landSquash(t, E.stand[0] + 0.05, 0.28) + crouch(t, 12.7, 0.14));
    o.ground = RETRO_Y;
    return o;
  }
  if (t < 12.95) { hop(o, t, FRONT, ledge(12.95), 12.7, 12.95, 0.05); o.yaw = lerpAngle(Math.PI - 0.5, 0.5, seg(t, 12.7, 12.95)); return o; }
  const box9 = (t2) => { const x = W.box9.at[0]; return onWall(t2, x, topAt("box9", x), protrudeAt("box9", t2) * 0.5); };
  const box46 = (t2) => { const x = W.box46.at[0]; return onWall(t2, x, topAt("box46", x), protrudeAt("box46", t2) * 0.5); };
  if (t < E.climb9[0]) {
    o.pos = ledge(t);
    o.ground = o.pos[1];
    // the slam throws him into a crouch; he shakes it off and watches the 9 rise
    const hit = t - E.slam;
    let q = landSquash(t, 12.95, 0.22);
    if (hit > 0) q += 0.42 * Math.exp(-hit * 5) * (hit < 0.5 ? 1 : 1);
    o.pos[0] += hit > 0 ? 0.012 * Math.exp(-hit * 6) * Math.sin(hit * 50) : 0;
    o.yaw = lerp(0.5, -0.6, smooth(seg(t, 13.6, 14.0)));
    o.head = [hit > 0 ? 0.3 * Math.exp(-hit * 4) : 0, hit > 0.45 && hit < 0.9 ? 0.35 * Math.sin((hit - 0.45) * 28) : 0, 0];
    o.armR = [0, 0, hit > 0 ? -0.9 * Math.exp(-hit * 4) - 0.12 : -0.12];
    o.armL = [0, 0, hit > 0 ? 0.9 * Math.exp(-hit * 4) + 0.12 : 0.12];
    for (let i = 1; i <= 9; i++) q += landSquash(t, E.rise9[0] + (i - 1) * 0.175 + 0.09, 0.05);
    q += crouch(t, E.climb9[0], 0.14);
    squash(o, q);
    return o;
  }
  if (t < E.climb9[1]) { hop(o, t, ledge(t), box9(t), E.climb9[0], E.climb9[1], 0.025); return o; }
  if (t < E.climb46[0]) {
    o.pos = box9(t);
    o.ground = o.pos[1];
    o.yaw = lerp(yawTo(ledge(E.climb9[0]), box9(E.climb9[1])), 0.7, smooth(seg(t, 16.0, 16.4)));
    o.head = [-0.2 * smooth(seg(t, 16.0, 16.3)), 0.3 * smooth(seg(t, 16.0, 16.3)), 0];
    squash(o, landSquash(t, E.climb9[1], 0.24) + crouch(t, E.climb46[0], 0.15));
    return o;
  }
  if (t < E.climb46[1]) { hop(o, t, box9(t), box46(t), E.climb46[0], E.climb46[1], 0.03); return o; }
  if (t >= E.repop) return ctaPose(o, t);
  if (t >= E.flat[0] + 0.08) { o.show = false; return o; } // he is the sticker card now
  const sx = STICKER.cx / MM;
  const onSticker = (t2) => onWall(t2, sx, topAt("box46", sx), protrudeAt("box46", t2) * 0.5);
  if (t >= E.toSticker[0] && t < E.toSticker[1]) {
    hop(o, t, box46(t), onSticker(t), E.toSticker[0], E.toSticker[1], 0.03, { yaw: 0.5 });
    return o;
  }
  const there = t >= E.toSticker[1];
  // the cover's own pose: lunge on 46K粉, pointing up at 变现7W; then the
  // sticker's: the same lunge facing you, pointing right
  o.pos = there ? onSticker(t) : box46(t);
  o.ground = o.pos[1];
  const k = smooth(seg(t, E.point7 - 0.25, E.point7));
  const f = smooth(seg(t, E.toSticker[1], E.toSticker[1] + 0.12));
  o.yaw = there ? lerp(0.5, 0.12, f) : lerp(1.0, 0.75, k);
  squash(o, (there ? landSquash(t, E.toSticker[1], 0.2) : landSquash(t, E.climb46[1], 0.24)) - 0.06 * k + (there ? 0 : crouch(t, E.toSticker[0], 0.12)));
  o.legL = [-0.55 * k, 0, 0.15 * k]; o.legR = [0.6 * k, 0, -0.1 * k];
  o.body = [0.08 * k, -0.2 * k, 0];
  const aim = there ? onWall(t, sx + 220, topAt("box46", sx) + 75, 40) : onWall(t, 200, 185, 60);
  o.aimL = { world: aim, k, len: 1.1 };
  o.pointL = k;
  o.armR = [0.6 * k, 0, -0.35 * k];
  o.head = [-0.1 * k, there ? 0.1 : 0.25 * k, 0];
  o.glint = Math.exp(-Math.pow((t - (E.peak + 0.15)) / 0.1, 2));
  if (t > E.peak && !there) { const b = t - E.peak; o.pos[1] += 0.006 * Math.exp(-b * 8) * Math.abs(Math.sin(b * 18)); }
  // poof: squashed flat into the card that takes his place
  const p = seg(t, E.flat[0], E.flat[0] + 0.08);
  if (p > 0) { o.flat = lerp(1, 0.04, easeIn(p)); o.pop = lerp(1, 1.1, p); }
  return o;
}

// the sticker card, wall-local: poof → pressed flush with the boxes; peel → pop
export function sticker2dAt(t) {
  const S = STICKER;
  const home = [S.cx, S.cy, 0.0006];
  const sx = S.cx / MM;
  if (t >= E.flat[0] && t < E.flatLand + 0.07) {
    // stands where his feet were, then sinks into its own place in the picture
    const start = [S.cx, topAt("box46", sx) * MM + S.h / 2 - 0.003, protrudeAt("box46", t) * 0.5 * MM];
    const s = easeInOut(seg(t, E.flat[0] + 0.05, E.flatLand));
    const pos = v3.lerp(start, home, s);
    const grow = backOut(seg(t, E.flat[0], E.flat[0] + 0.1), 1.8);
    const k = lerp(0.55, 0.92, grow) * lerp(1, 1 / 0.92, s);
    const wob = 0.12 * Math.sin(seg(t, E.flat[0], E.flatLand) * Math.PI * 2) * (1 - s);
    return trs(pos, qEuler(0, wob, 0), k);
  }
  if (t >= E.peel2[0] - 0.07 && t < E.repop) {
    // peels off the wall top first, then stands out in front of it
    const s = seg(t, E.peel2[0], E.peel2[1]);
    const ang = 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.3));
    const out = 0.0006 + 0.03 * easeIn(s);
    const q = qAxis([1, 0, 0], ang); // the top comes off towards you
    const c = qRot(q, [0, S.h / 2, 0]);
    return trs([S.cx, S.cy - S.h / 2 + c[1], out + c[2]], q, 1 + 0.06 * s);
  }
  return trs(home, qId(), HIDDEN);
}

// the call to action: out of the cover, onto the snail's shell, point at you
function ctaPose(o, t) {
  if (t < E.cut) {
    const p0 = onWall(E.repop, STICKER.cx / MM, STICKER.feet / MM, 30);
    const s = seg(t, E.repop + 0.06, E.cut);
    o.pos = v3.add(p0, [0, 0.2 * Math.sin(s * Math.PI * 0.6) + 0.05 * s, 0.5 * s * s]);
    const inflate = seg(t, E.repop, E.repop + 0.12);
    o.flat = lerp(0.03, 1, backOut(inflate, 2.4));
    o.pop = lerp(1.15, 1, smooth(inflate));
    o.yaw = 0;
    o.armR = [0, 0, -2.2 * smooth(s)]; o.armL = [0, 0, 2.2 * smooth(s)];
    o.legR = [-0.6 * s, 0, 0]; o.legL = [0.5 * s, 0, 0];
    o.ground = p0[1];
    return o;
  }
  o.noBlob = true;
  o.pop = 1.3;
  const top = shellTop(t);
  if (t < E.ride) {
    const u = seg(t, E.ride - 0.32, E.ride);
    o.pos = v3.add(top, [0, 0.9 * Math.pow(1 - u, 2), 0]);
    o.yaw = 0.4;
    o.armR = [0, 0, -2.0]; o.armL = [0, 0, 2.0];
    o.legR = [-0.4, 0, 0]; o.legL = [-0.4, 0, 0];
    return o;
  }
  o.pos = top;
  o.yaw = 0.45;
  let q = landSquash(t, E.ride, 0.3);
  const g = seg(t, E.push2[0], E.push2[0] + 0.2) * (1 - seg(t, E.push2[1] - 0.15, E.push2[1]));
  o.aimL = { target: [27, 63, 13], k: smooth(g) };
  o.head = [-0.1 * g, -0.1 * g, -0.08 * g];
  o.glint = Math.exp(-Math.pow((t - E.glint2) / 0.09, 2)) + Math.exp(-Math.pow((t - (E.final + 0.15)) / 0.1, 2));
  if (t > E.glide[0] && t < E.glide[1]) {
    o.pos = v3.add(o.pos, [0, 0.004 * Math.abs(Math.sin((t - E.glide[0]) * TAU * 3)), 0]);
    o.armR = [0, 0, -0.5]; o.armL = [0, 0, 0.5];
    o.ears = [0, 0, 0.12 * Math.sin((t - E.glide[0]) * TAU * 3)];
  }
  // the end: turn to you and point
  const k = smooth(seg(t, E.final - 0.2, E.final));
  if (k > 0) {
    o.yaw = lerp(0.45, 0.1, k);
    o.aimR = { world: CTA_CAM, k, len: 1.15 };
    o.pointR = k;
    o.head = [0.05 * k, -0.15 * k, 0];
    o.legR = [-0.2 * k, 0, 0];
  }
  q += crouch(t, E.final - 0.05, 0.1) + landSquash(t, E.final, 0.15);
  squash(o, q);
  return o;
}

export function mascotAt(t) {
  const o = mascotPose(t);
  if (!o.show) return { hero: hidden(POP), o };
  return { hero: heroT(o, CENTER), o };
}
export function mascotParts(t) {
  const { hero, o } = mascotAt(t);
  return partsAt(hero, o, TOY);
}
export const heroCentre = (t) => {
  const { hero } = mascotAt(t);
  return apply(hero, CENTER);
};

// ── The views stat (act 2): 304万 阅读 lifts out of the action bar ──────────
// 3D lettering from scripts/glyphs.py: three digit slots, 万 and a smaller
// 阅读, a blue bar that fills with the count. Group space mm, origin at the
// middle of the baseline, +z out of the type.
export const GLYPHS = readFilmJSON("build/glyphs.json", null) ?? {};
const adv = (k) => (GLYPHS[k] ? GLYPHS[k].advance : 0.6);
export const STAT_EM = { digit: 70, wan: 62, label: 30 };
// glyph keys of the counter's unit (万) and its two-character label (阅读)
export const STAT_KEYS = { unit: `cjk:${film.counter.unit}`, label: [...film.counter.label].map((c) => `cjk:${c}`) };
export const STAT = counterLayout({ value: T.VIEWS_COUNT, adv, em: STAT_EM, keys: STAT_KEYS });
// it floats just past the post's bottom edge, so the post's title stays clear above it
const STAT_HOME = [wx(T.VIEWS[0] - 40), 0, wz(T.PANELS.pinned[1] + T.PANELS.pinned[3]) + 0.016];
function statGroup(t) {
  const s = seg(t, E.count[0], E.count[0] + 0.38);
  if (t < E.count[0]) return trs([STAT_HOME[0], pinnedY(t), STAT_HOME[2]], qId(), HIDDEN);
  const k = lerp(0.22, 1, backOut(s, 1.3));
  const punch = t > E.lock ? 0.09 * Math.exp(-(t - E.lock) * 9) * Math.cos((t - E.lock) * 30) : 0;
  const bob = 0.0015 * Math.sin((t - E.count[0]) * 3) * smooth(s);
  const tilt = lerp(-Math.PI / 2, -0.28, easeOut(s));
  return trs([STAT_HOME[0], pinnedY(t) + 0.003 + 0.004 * smooth(s) + bob, STAT_HOME[2]], qEuler(tilt, 0, 0), k * (1 + punch));
}
export function countAt(t) {
  if (t < E.count[0] + 0.12) return 0;
  return countEase(T.VIEWS_COUNT, seg(t, E.count[0] + 0.12, E.count[1]));
}
// every glyph of the stat, group-local; digits not showing are parked
const STAT_NAMES = { digit: (i, d) => `stat_${i}_${d}`, unit: "stat_wan", label: ["stat_yue", "stat_du"], bar: "stat_bar" };
export const statAt = (t) => counterGlyphs(countAt(t), T.VIEWS_COUNT, STAT, statGroup(t), STAT_NAMES);
export function statCentre(t) {
  return apply(statGroup(Math.max(t, E.count[0] + 0.38)), [0, 0.03, 0]);
}
// a dark patch over the flat "304万" once the 3D one has left it
export function lidAt(t) {
  const k = t < E.count[0] ? HIDDEN : 1;
  return trs([wx(T.VIEWS[0] + 4), pinnedY(t) + 0.0004, wz(T.VIEWS[1])], qId(), k);
}
// the selected post's blue outline: four thin bars round the pinned slab
const PR = T.PANELS.pinned;
export const GLOW_BARS = [
  { pos: [PR[0] + PR[2] / 2, PR[1] + 3], size: [PR[2] - 6, 2.4, 2.4] },
  { pos: [PR[0] + PR[2] / 2, PR[1] + PR[3] - 3], size: [PR[2] - 6, 2.4, 2.4] },
  { pos: [PR[0] + 3, PR[1] + PR[3] / 2], size: [2.4, 2.4, PR[3] - 6] },
  { pos: [PR[0] + PR[2] - 3, PR[1] + PR[3] / 2], size: [2.4, 2.4, PR[3] - 6] },
];
export function glowBarAt(i, t) {
  const b = GLOW_BARS[i];
  const k = backOut(seg(t, E.click, E.click + 0.25), 1.5) * (1 - smooth(seg(t, 10.6, 11.0)));
  const pulse = 1 + 0.6 * Math.exp(-Math.max(0, t - E.click) * 5);
  return trs([wx(b.pos[0]), pinnedY(t) + 0.0012, wz(b.pos[1])], qId(), k < 0.01 ? HIDDEN : [i < 2 ? k : pulse, pulse, i < 2 ? pulse : k]);
}

// ── The call to action (CTA stage, metres from T.CTA) ───────────────────────
export const LOGO = readFilmJSON("build/logo.json", null) ?? { rings: [], aspect: 1 };
export const SHELL_H = 0.19;
export const SHELL_D = 0.032;
const cta = (x, y, z) => [T.CTA[0] + x, T.CTA[1] + y, T.CTA[2] + z];
// the snail: x forward (it crawls to +x), y up, z to the camera
const SN = (shape, name, a, b, c = null, extra = {}) => ({ name, shape, ...(shape === "ellipsoid" ? { r: a } : { size: a, radius: extra.radius }), pos: b, rot: c, mat: extra.mat || "body" });
export const SNAIL_PARTS = [
  SN("ellipsoid", "body", [0.13, 0.03, 0.05], [0, 0.03, 0]),
  SN("ellipsoid", "tail", [0.07, 0.017, 0.032], [-0.12, 0.017, 0]),
  SN("ellipsoid", "neck", [0.06, 0.036, 0.043], [0.085, 0.046, 0]),
  SN("ellipsoid", "head", [0.043, 0.046, 0.043], [0.125, 0.078, 0]),
  ...[-1, 1].flatMap((k) => [
    SN("roundBox", `stalk${k}`, [0.008, 0.05, 0.008], [0.135, 0.125, k * 0.017], [k * 0.25, 0, -0.22], { radius: 0.0038 }),
    SN("ellipsoid", `eye${k}`, [0.011, 0.011, 0.011], [0.146, 0.151, k * 0.023], null, { mat: "eye" }),
    SN("ellipsoid", `pupil${k}`, [0.0048, 0.0048, 0.003], [0.15, 0.152, k * 0.023 + 0.0095], null, { mat: "pupil" }),
  ]),
  { name: "smile", shape: "arc", radius: 0.007, tube: 0.0016, arc: Math.PI * 0.75, pos: [0.14, 0.07, 0.04], rot: [0, 0.35, -Math.PI / 2 - Math.PI * 0.375], mat: "pupil" },
];
export const snailX = (t) => lerp(T.CTA_LAYOUT.path[0], T.CTA_LAYOUT.path[1], easeInOut(seg(t, E.glide[0], E.glide[1])));
function snailT(t) {
  const x = snailX(t);
  const grow = t < E.snail[0] ? 0 : backOut(seg(t, E.snail[0], E.snail[1]), 1.4);
  const crawl = t > E.glide[0] && t < E.glide[1] + 0.2 ? Math.sin((t - E.glide[0]) * TAU * 3) : 0;
  return trs(cta(x, 0, 0.07), qId(), grow < 0.01 ? HIDDEN : [grow * (1 + 0.05 * crawl), grow * (1 - 0.04 * crawl), grow]);
}
export function snailPartsAt(t) {
  const sT = snailT(t);
  const eyes = backOut(seg(t, E.eyes[0], E.eyes[1]), 2.2);
  return SNAIL_PARTS.map((p) => {
    let pos = p.pos, s = [1, 1, 1];
    if (/stalk|eye|pupil/.test(p.name)) {
      const wob = 0.05 * Math.sin(t * 9 + (p.name.endsWith("-1") ? 0 : 1.3));
      pos = [pos[0], 0.1 + (pos[1] - 0.1) * Math.max(eyes, 1e-3), pos[2]];
      s = eyes < 0.01 ? [HIDDEN, HIDDEN, HIDDEN] : [1, 1, 1];
      return mulT(sT, trs(pos, p.rot ? qEuler(p.rot[0], p.rot[1], p.rot[2] + wob) : qEuler(0, 0, wob), s));
    }
    return mulT(sT, trs(pos, p.rot ? qEuler(...p.rot) : qId(), s));
  });
}
// the 公众号 mark: drops in spinning, then rides the snail as its shell
const SHELL_REST = [-0.015, 0.042 + SHELL_H / 2, 0];
export function logoAt(t) {
  const sT = snailT(Math.max(t, E.snail[1]));
  const rest = apply(trs(sT.p, qId(), 1), SHELL_REST);
  if (t < E.logo[0]) return trs(v3.add(rest, [0, 0.9, 0]), qId(), HIDDEN);
  const d = seg(t, E.logo[0], E.logo[1]);
  const floorY = SHELL_H / 2;
  const lift = smooth(seg(t, E.snail[0], E.snail[1]));
  const base = [rest[0], lerp(floorY, rest[1], lift), rest[2]];
  if (t < E.logo[1]) {
    const p = v3.add(base, [0, 0.3 * (1 - d * d), 0]);
    return trs(p, qEuler(0, -TAU * 2 * (1 - easeOut(d)), 0));
  }
  const b = t - E.logo[1];
  const sq = 0.18 * Math.exp(-b * 9) * Math.cos(b * 32);
  const sway = t > E.glide[0] ? 0.05 * Math.sin((t - E.glide[0]) * TAU * 1.5) * (1 - seg(t, E.glide[1], E.glide[1] + 0.4)) : 0;
  const x = t >= E.snail[0] ? snailT(t).p[0] + SHELL_REST[0] : base[0];
  return trs([x, base[1] - SHELL_H / 2 * sq, base[2]], qEuler(0, 0, sway), [1 + sq * 0.5, 1 - sq, 1]);
}
// where his feet go on top of the shell (logo rings are in units of its height)
const SHELL_TOP = (() => {
  let best = 0.5;
  for (const r of LOGO.rings) for (const [x, y] of r) if (Math.abs(x) < 0.12 && y > (best === 0.5 ? -1 : best)) best = y;
  return best;
})();
const shellTop = (t) => apply(logoAt(t), [0.0, SHELL_TOP * SHELL_H + 0.002, 0]);
// ── The sign-off on torn paper, like the 《自媒体很苦》 cover ────────────────
// Each label is a sheet of coloured paper with a white torn rim behind it and
// raised Lantinghei Heavy letters on it. The line 公众号变现 | 找蜗牛 stands on
// the floor where the snail has crawled, a letter per 8th note; 蜗牛King (with a
// gold crown) and @isnail are slapped up in the empty space above at 28 s.
const BEAT8 = T.BEAT / 2;
// label: text, em (m), paper, centre (m from CTA), tilt, when it lands, letter times
const label = (id, text, em, paper, cx, cy, cz, tilt, at, letterAt) => makeLabel({ id, text, em, paper, c: [cx, cy, cz], tilt, at, letterAt, adv });
export const SLOGAN_LETTER = (i) => E.letters + i * BEAT8;
// the slogan's labels run on from one another, a letter per 8th note; the name
// and the handle are slapped up together at E.name
const CTA_TEXT = film.cta;
let sloganAt = 0;
const sloganLabels = CTA_TEXT.slogan.map((p, k) => {
  const first = sloganAt;
  sloganAt += [...p.text].length;
  const d = T.CTA_LAYOUT.slogan[k] ?? { ...T.CTA_LAYOUT.slogan.at(-1), at: T.CTA_LAYOUT.slogan.at(-1).at.map((v, j) => v + T.CTA_LAYOUT.sloganStep[j] * (k - T.CTA_LAYOUT.slogan.length + 1)) };
  return label(`slogan${k}`, p.text, p.em ?? d.em, p.paper, ...(p.at ?? d.at), p.tilt ?? d.tilt, SLOGAN_LETTER(first) - 0.06, (i) => SLOGAN_LETTER(first + i));
});
const N = { ...T.CTA_LAYOUT.name, ...CTA_TEXT.name }, HD = { ...T.CTA_LAYOUT.handle, ...CTA_TEXT.handle };
export const LABELS = [
  ...sloganLabels,
  label("name", N.text, N.em, N.paper, ...N.at, N.tilt, E.name, (i) => E.name + 0.05 + 0.05 * i),
  label("handle", HD.text, HD.em, HD.paper, ...HD.at, HD.tilt, E.name + 0.18, (i) => E.name + 0.22 + 0.025 * i),
];
LABELS.forEach(tear);
const labelAt = (L, t) => labelT(L, t, cta);
export const labelSheetAt = (i, t) => labelAt(LABELS[i], t);
export const labelRimAt = (i, t) => rimT(LABELS[i], t, cta);
export const labelLetterAt = (i, j, t) => letterT(LABELS[i], j, t, cta);
// the crown lands on the name label's top right corner
export const CROWN_W = 0.07;
export const CROWN = [[0, 0], [1, 0], [1, 0.68], [0.76, 0.44], [0.5, 0.92], [0.24, 0.44], [0, 0.68]];
export function crownAt(t) {
  const L = LABELS.find((l) => l.id === "name");
  const rest = mulT(labelAt(L, Math.max(t, E.crown[1])), trs([L.W / 2 - 0.05, L.H / 2 - 0.022, 0.006], qEuler(0, 0, 0.32)));
  if (t < E.crown[0]) return trs(v3.add(rest.p, [0, 0.25, 0]), qId(), HIDDEN);
  const d = seg(t, E.crown[0], E.crown[1]);
  const b = t - E.crown[1];
  const bounce = b > 0 ? 0.01 * Math.exp(-b * 9) * Math.abs(Math.sin(b * 22)) : 0;
  return trs(v3.add(rest.p, [0, 0.25 * (1 - easeIn(d)) + bounce, 0]), qMul(rest.q, qEuler(0, TAU * (1 - easeOut(d)), 0)), 1);
}
const CTA_CAM = cta(...T.CTA_LAYOUT.pointAt); // where the camera ends up: he points at you

// ── Particles ───────────────────────────────────────────────────────────────
export const FLAKES = 18;
const FLAKE_COLS = film.pop.confetti; // the avatar's confetti; the first two flakes are its leaves
export function flakeAt(i, t) {
  const r = mulberry32(100 + i);
  const a = r() * TAU, sp = 0.25 + r() * 0.35;
  const v0 = [Math.cos(a) * sp * 0.8, 0.45 + r() * 0.5, Math.abs(Math.sin(a)) * sp * 0.6 + 0.05];
  const p0 = [POP[0], 0.06, POP[2] - 0.01];
  const dt = t - E.pop;
  const life = 1.6 + r() * 0.5;
  const color = i < 2 ? film.pop.leaf : FLAKE_COLS[i % FLAKE_COLS.length];
  if (dt < 0 || dt > life) return { tr: hidden(p0), color };
  const p = ballistic(p0, v0, dt, 0.0006);
  const spin = qEuler(dt * (4 + r() * 8), dt * (3 + r() * 6), dt * 5);
  const fade = 1 - seg(dt, life - 0.3, life);
  const settled = p[1] <= 0.0007;
  return { tr: trs(p, settled ? qEuler(0, r() * TAU, 0) : spin, i < 2 ? [1.6 * fade, 1.6 * fade, 1.6 * fade] : fade), color };
}
export const SPARKS = 22;
export function sparkAt(i, t) {
  const stk = () => onWall(t, STICKER.cx / MM, STICKER.cy / MM, 40);
  const bursts = [[E.lock, () => statCentre(t), "#FFFFFF"], [E.peak, () => onWall(t, 190, 210, 100), "#FFD25A"], [E.flat[0], stk, "#FFF4E0"], [E.repop, stk, "#FFF4E0"], [E.final, () => heroCentre(t), "#FFFFFF"]];
  for (const [t0, at, color] of bursts) {
    const dt = t - t0;
    if (dt < 0 || dt > 0.7) continue;
    const r = mulberry32(300 + i + Math.round(t0 * 10));
    const a = r() * TAU, b = (r() - 0.3) * 1.2;
    const v = [Math.cos(a) * Math.cos(b), Math.sin(b) + 0.4, Math.sin(a) * Math.cos(b)].map((x) => x * (0.3 + r() * 0.4));
    const c = at();
    const p = ballistic(c, v, dt);
    return { tr: trs(p, qEuler(dt * 9, dt * 7, 0), (1 - dt / 0.7) * (0.8 + r() * 0.6)), color };
  }
  return { tr: hidden(statCentre(E.lock)), color: "#FFFFFF" };
}
export const BITS = 16;
export function bitAt(i, t) {
  const dt = t - E.slam;
  const r = mulberry32(500 + i);
  const u = r(), side = r() < 0.5 ? -1 : 1;
  const p0 = onWall(E.slam + 0.01, lerp(-300, 0, u), lerp(140, 250, r()), 35);
  const color = r() < 0.6 ? "#E9DFCF" : "#D8382D";
  if (dt < 0 || dt > 1.2) return { tr: hidden(p0), color };
  const v = [side * (0.1 + r() * 0.25), 0.2 + r() * 0.4, 0.15 + r() * 0.3];
  const p = ballistic(p0, v, dt);
  return { tr: trs(p, qEuler(dt * (5 + r() * 9), dt * 6, dt * 4), 1 - seg(dt, 0.9, 1.2)), color };
}

// ── Lights for the hits ─────────────────────────────────────────────────────
export function fxAt(t) {
  const pulse = (at, k, d = 0.2) => (t >= at ? k * Math.exp(-(t - at) / d) : 0);
  if (t < 4) return { p: [POP[0], 0.08, POP[2] + 0.03], energy: pulse(E.pop, 1.2, 0.18), color: "#FFE9E0" };
  if (t < 12) return { p: v3.add(statCentre(t), [0, 0.06, 0.08]), energy: pulse(E.lock, 1.6, 0.22) + 0.15 * seg(t, E.count[0], E.count[0] + 0.3) * (1 - seg(t, 10.6, 11.2)), color: "#DCE8FF" };
  if (t < 17) return { p: onWall(t, -160, 190, 120), energy: pulse(E.slam, 2.2, 0.16), color: "#FFD8C8" };
  if (t < E.cut) return { p: onWall(t, 200, 215, 130), energy: pulse(E.peak, 2.0, 0.3) + pulse(E.rise7[1], 0.8, 0.2) + pulse(E.repop, 0.8, 0.15), color: "#FFE6B0" };
  if (t < 26) return { p: cta(-0.4, 0.25, 0.25), energy: pulse(E.logo[1], 1.2, 0.2) + pulse(E.ride, 0.6, 0.15) + pulse(E.glint2, 0.4, 0.1), color: "#E6FFEE" };
  return { p: v3.add(heroCentre(t), [0, 0.08, 0.15]), energy: pulse(E.final, 2.0, 0.3), color: "#FFF4E0" };
}
// the cover: 0 = without the 2D mascot (he is out), 1 = as published
export function coverMix(t) {
  if (t >= E.peel2[0]) return 0; // the sticker card is off the picture again
  if (t >= E.flatLand) return 1; // the card is flush: the drawing is back
  if (t < E.leap[0]) return 1;
  return 1 - seg(t, E.leap[0], E.leap[0] + 0.3);
}
// lit paper (0) → the flat picture (1) at the very end
export const coverFlat = (t) => smooth(seg(t, E.flat[0], E.flat[1] + 0.2));
// lens glint (both the flat avatar's at E.glint and the toy's)
export const glintAt = (t) => Math.exp(-Math.pow((t - E.glint) / 0.1, 2)) + mascotPose(t).glint;

// contact shadow under the toy
export function blobAt(t) {
  const { o } = mascotAt(t);
  if (!o.show || o.noBlob) return { tr: hidden(POP), opacity: 0 };
  const h = Math.max(0, o.pos[1] - o.ground);
  const k = clamp01(1 - h / 0.12);
  const inWall = t > 12.9 && t < E.flat[1];
  const q = inWall ? qMul(wallAt(t).tr.q, qEuler(-Math.PI / 2, 0, 0)) : qEuler(-Math.PI / 2, 0, 0);
  const s = 1.15 - 0.35 * k;
  return { tr: trs([o.pos[0], o.ground + 0.0007, o.pos[2]], q, k > 0.01 ? [0.07 * s, 0.05 * s, 1] : HIDDEN), opacity: 0.7 * k * k * o.flat };
}

// ── Camera (engine/lib/camera.js) ───────────────────────────────────────────
const wallCentre = (t) => onWall(t, 0, WALL_H / MM / 2, 0);
function trackerRaw(name, t) {
  if (name === "stat") return statCentre(t);
  if (name === "wall2") return wall2Centre(t);
  if (name === "duo") return v3.lerp(heroCentre(t), statCentre(t), 0.5);
  if (name === "wall" || name === "wallFront") return wallCentre(Math.max(t, E.stand[1]));
  const c = heroCentre(t);
  return c;
}
const TRACK = {};
function tracker(name, t) {
  if (name === "wallFront") return wallCentre(Math.max(t, E.stand[1])); // squared up to the cover: not smoothed
  TRACK[name] ??= smoothTracker((t2) => trackerRaw(name, t2), T.DURATION);
  return TRACK[name](t);
}
const keyTarget = (k, t) => (typeof k.target === "string" ? tracker(k.target, t) : [wx(k.target[0]), k.target[2] * MM, wz(k.target[1])]);
// the page shots, then (after the cut) the CTA stage, its targets in metres from the stage
export const cameraAt = makeCamera({
  shots: [
    { start: -Infinity, keys: T.CAMERA, target: keyTarget },
    { start: E.cut, keys: T.CAMERA2, target: (k) => cta(...k.target) },
  ],
  fov: T.FOV,
  shakes: T.SHAKES,
  aspect: T.ASPECT,
});
