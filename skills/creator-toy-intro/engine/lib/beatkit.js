// What a beat needs to move the toy and frame it (references/beats.md): the
// toy's pose on the beat's own stage, its moves between beats (it drops in,
// cheers, leaps out of the top of the frame), the toy and its contact shadow
// from a pose, and a camera from keys in the beat's own seconds.
import { fromFilm } from "./film.js";
import { TOY, CENTER, JOINTS, COLORS } from "./toy.js";
import { armLiftLimit } from "./clearance.js";
import { basePose, squash, landSquash, crouch, hop, heroT, partsAt } from "./rig.js";
import { makeCamera } from "./camera.js";
import { readout, formatCount } from "./counter.js";
import { line as makeLine, declareLine as declLine, putLine as placeLine, facing as faceCam, eyePoint } from "./lettering.js";
import { clamp01, seg, smooth, easeIn, easeOut, easeInOut, lerp, lerpAngle, yawTo, TAU, v3 } from "./math.js";
import { trs, qId, qEuler, mulT, apply } from "./quat.js";

// Wide-headed chibi/sculpt toys tuck short arms behind the cheeks past ~1.7 rad; slender toys keep the full 2.5 rad.
const ARM_MAX = armLiftLimit(TOY, fromFilm, 2.5);
const lift = (a) => Math.min(a, ARM_MAX);
const cheerForward = ARM_MAX < 2.2 ? -0.22 : 0;

// the creator's own pictures as cards, and layouts for many at once (pictures.js)
export { picture, framedPicture, wipePicture, cutout, pictureFiles, layout, stagger, imageSize, backToBack } from "./pictures.js";
// a line of 3D lettering: laid out, edged, standing by its lowest point, facing the camera (lettering.js)
export { line, declareLine, putLine, facing, eyePoint, shade } from "./lettering.js";

export const HIDDEN = 1e-4;
export const POP = 1.3; // the toy's size on a beat's small stage, as on the end card
export { squash, landSquash, crouch, hop, CENTER };

// the toy standing at spot (world metres), at the stage size
export function stand(spot) {
  const o = basePose(spot);
  o.pop = POP;
  return o;
}
// falls from above the frame onto spot over g0–g1, arms up
export function dropIn(o, g, g0, g1, spot) {
  const u = seg(g, g0, g1);
  o.pos = v3.add(spot, [0, 0.9 * Math.pow(1 - u, 2), 0]);
  o.ground = spot[1];
  const a = lift(2.0);
  o.armR = [0, 0, -a]; o.armL = [0, 0, a];
  o.legR = [-0.4, 0, 0]; o.legL = [-0.4, 0, 0];
  return o;
}
// crouches and leaps straight up out of the frame over g0–g1 (the cut to the next beat follows)
export function leapOut(o, g, g0, g1, spot) {
  const s = seg(g, g0, g1);
  o.pos = v3.add(spot, [0, 0.85 * Math.pow(s, 0.8), 0]);
  o.ground = spot[1];
  squash(o, crouch(g, g0, 0.16));
  const a = lift(2.4) * smooth(s);
  o.armR = [0, 0, -a]; o.armL = [0, 0, a];
  o.legR = [0.5 * s, 0, 0]; o.legL = [0.5 * s, 0, 0];
  return o;
}
// stage-level run-in from `fromSpot` onto `toSpot` over g0–g1 (keeps top banners & 3D readouts clear of sky-drops)
export function strideIn(o, g, g0, g1, fromSpot, toSpot, steps = 2) {
  const u = easeOut(seg(g, g0, g1));
  o.pos = v3.lerp(fromSpot, toSpot, u);
  o.pos[1] += 0.025 * Math.abs(Math.sin(u * Math.PI * steps));
  o.ground = lerp(fromSpot[1], toSpot[1], smooth(u));
  o.yaw = lerp(yawTo(fromSpot, toSpot), o.yaw ?? 0, smooth(seg(u, 0.65, 1)));
  const cyc = Math.sin(u * Math.PI * steps * 2) * (1 - smooth(seg(u, 0.8, 1)));
  o.legL = [0.6 * cyc, 0, 0]; o.legR = [-0.6 * cyc, 0, 0];
  o.armL = [-0.45 * cyc, 0, 0.25]; o.armR = [0.45 * cyc, 0, -0.25];
  return o;
}
// stage-level run-out from `fromSpot` to `toSpot` over g0–g1 (never slices the toy off at the top frame edge)
export function strideOut(o, g, g0, g1, fromSpot, toSpot, steps = 2) {
  const u = easeIn(seg(g, g0, g1));
  o.pos = v3.lerp(fromSpot, toSpot, u);
  o.pos[1] += 0.025 * Math.abs(Math.sin(u * Math.PI * steps));
  o.ground = lerp(fromSpot[1], toSpot[1], smooth(u));
  o.yaw = lerpAngle(o.yaw ?? 0, yawTo(fromSpot, toSpot), smooth(seg(u, 0, 0.35)));
  o.pitch = -0.12 * u;
  const cyc = Math.sin(u * Math.PI * steps * 2);
  o.legL = [0.65 * cyc, 0, 0]; o.legR = [-0.65 * cyc, 0, 0];
  o.armL = [-0.5 * cyc, 0, 0.3]; o.armR = [0.5 * cyc, 0, -0.3];
  return o;
}
// Tone stark-white/cream paper plates (`#FFFFFF`, `#F5EFE6`) just below finish.py's 0.85 bloom knee when paired with dark ink
// so post-bloom halation never blurs thin CJK or decimal strokes at 360p phone feed size.
function antiGlarePlate(plateHex, inkHex, raw = false) {
  if (raw || typeof plateHex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(plateHex)) return plateHex;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [pr, pg, pb] = rgb(plateHex);
  const maxC = Math.max(pr, pg, pb);
  if (maxC <= 234) return plateHex;
  if (typeof inkHex === "string" && /^#[0-9a-fA-F]{6}$/.test(inkHex)) {
    const [ir, ig, ib] = rgb(inkHex);
    const inkLuma = (0.2126 * ir + 0.7152 * ig + 0.0722 * ib) / 255;
    if (inkLuma > 0.35) return plateHex;
  }
  const k = 234 / maxC;
  return "#" + [pr, pg, pb].map((c) => Math.round(c * k).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// centred, flush-mounted 3D counter + label badge: outline-free solid letters rooted cleanly into a matte paper
// backing plate (< 3 mm flush threshold: zero double shadow, zero grown-plate stroke shimmer) and level by default
export function readoutBadge(glyph, { from = 1, to, fmt, label = "", em = 0.056, labelEm = em * 0.78, gap = em * 0.36, padX = em * 1.1, padY = em * 0.45, depth = 0.006 } = {}) {
  const num = readout({ fmt, from, to, em, adv: glyph.adv });
  const ln = label ? makeLine(glyph, label, labelEm, { edge: 0, track: 0.08 }) : null;
  const letterDepth = Math.max(em * 0.11, 0.0038);
  const letterBevel = Math.min(0.0005, em * 0.014);
  const numW = num.width(to), lblW = ln ? ln.W : 0;
  const textW = numW + (lblW > 0 ? gap + lblW : 0);
  const plateSize = [textW + padX, Math.max(em, labelEm) + padY, depth];
  let hasOutline = false;
  return {
    num, ln, numW, lblW, gap, textW, plateSize, em,
    declare(add, prefix = "badge", { plateColor = "#FF4500", numColor = "#FFFFFF", labelColor = "#FFD166", outline = false, withOutline = false, rawPlate = false } = {}) {
      hasOutline = Boolean(withOutline && outline);
      const safePlate = antiGlarePlate(plateColor, numColor, rawPlate);
      const inkFinish = { on: plateColor, side: null, rough: 0.42, coat: 0.12 };
      for (const n of num.names) {
        add({ name: `${prefix}_${n.name}`, letter: n.key.split(":")[1], geo: glyph.geo(n.key, em, letterDepth, letterBevel), mat: { type: "type", color: numColor, emit: 0.0, ...inkFinish }, anim: true, step: true, pop: true });
      }
      if (ln) declLine(add, `${prefix}_lbl`, ln, { color: labelColor, emit: 0.0, depth: letterDepth, bevel: letterBevel, outline: hasOutline ? outline : false, edge: 0.07, finish: inkFinish });
      add({ name: `${prefix}_plate`, geo: { type: "roundBox", size: plateSize, radius: plateSize[1] * 0.16 }, mat: { type: "paper", color: safePlate }, anim: true });
    },
    put(put, prefix, val, centerWorld, eyeWorld, scale = 1, { level = true } = {}) {
      const park = trs([centerWorld[0], -2, centerWorld[2]], qId(), HIDDEN);
      if (scale <= 0.01) {
        put(`${prefix}_plate`, park);
        for (const n of num.names) put(`${prefix}_${n.name}`, park);
        if (ln) placeLine(put, `${prefix}_lbl`, ln, () => [centerWorld[0], -2, centerWorld[2]], qId(), () => 0, { outline: hasOutline, depth: letterDepth });
        return;
      }
      const eye = eyePoint(eyeWorld);
      const aimFrom = level ? [eye[0], centerWorld[1], centerWorld[2]] : centerWorld;
      const q = faceCam(eye, aimFrom);
      const root = trs(centerWorld, q, 1);
      // Plate front face sits at z = -1.3 mm (inside solid letter depth [-halfD, +halfD], behind any optional outline)
      const frontBack = hasOutline ? letterDepth + 0.0014 : 0.0013;
      put(`${prefix}_plate`, trs(apply(root, [0, em * 0.36, -(depth / 2 + frontBack)]), q, scale));
      const grp = trs(centerWorld, q, scale);
      for (const [k, tr] of Object.entries(num.centerAt(val, grp, { afterWidth: lblW, gap }))) put(`${prefix}_${k}`, tr);
      if (ln) {
        const lp = apply(root, [textW / 2 - lblW / 2, em * 0.05, 0]);
        placeLine(put, `${prefix}_lbl`, ln, (it) => apply(trs(lp, q, 1), [it.x, 0, 0]), q, () => scale, { outline: hasOutline, depth: letterDepth });
      }
    },
  };
}
// centred, flush-mounted 3D text banner plaque: outline-free solid letters on a matte paper plate, level by default
// so gentle camera azimuth drifts never shimmer CJK strokes or tilt paired bottom bars into an inverted V
export function bannerLine(glyph, text, { em = 0.032, edge = 0.07, track = 0.08, padX = em * 1.15, padY = em * 0.52, depth = 0.006 } = {}) {
  const ln = makeLine(glyph, text, em, { edge: 0, track });
  const letterDepth = Math.max(em * 0.11, 0.0038);
  const letterBevel = Math.min(0.0005, em * 0.014);
  const plateSize = [ln.W + padX, em + padY, depth];
  let hasOutline = false;
  return {
    ln, em, plateSize,
    declare(add, prefix = "ban", { plateColor = "#241232", color = "#FFFFFF", outline = false, withOutline = false, emit = 0.0, rawPlate = false } = {}) {
      hasOutline = Boolean(withOutline && outline);
      const safePlate = antiGlarePlate(plateColor, color, rawPlate);
      declLine(add, `${prefix}_ln_`, ln, { color, emit, depth: letterDepth, bevel: letterBevel, outline: hasOutline ? outline : false, edge, finish: { on: plateColor, side: null, rough: 0.42, coat: 0.12 } });
      add({ name: `${prefix}_plate`, geo: { type: "roundBox", size: plateSize, radius: plateSize[1] * 0.16 }, mat: { type: "paper", color: safePlate }, anim: true });
    },
    put(put, prefix, centerWorld, eyeWorld, scale = 1, { level = true } = {}) {
      const park = trs([centerWorld[0], -2, centerWorld[2]], qId(), HIDDEN);
      if (scale <= 0.01) {
        put(`${prefix}_plate`, park);
        placeLine(put, `${prefix}_ln_`, ln, () => [centerWorld[0], -2, centerWorld[2]], qId(), () => HIDDEN, { outline: hasOutline, depth: letterDepth });
        return;
      }
      // Use eyeWorld[0] rather than world X=0 so custom beats on offset stages (x = 50, 100, 150 m) stay dead-level!
      const eye = eyePoint(eyeWorld);
      const aimFrom = level ? [eye[0], centerWorld[1], centerWorld[2]] : centerWorld;
      const q = faceCam(eye, aimFrom);
      const root = trs(centerWorld, q, 1);
      // Plate front face sits at z = -1.3 mm (inside solid letter depth [-halfD, +halfD]: zero gap, zero stroke shimmer)
      const frontBack = hasOutline ? letterDepth + 0.0014 : 0.0013;
      put(`${prefix}_plate`, trs(apply(root, [0, ln.stand + em * 0.36, -(depth / 2 + frontBack)]), q, scale));
      placeLine(put, `${prefix}_ln_`, ln, (it) => apply(root, [it.x, ln.stand, 0]), q, () => scale, { outline: hasOutline, depth: letterDepth });
    },
  };
}
// a jump for joy over g0–g1; returns the squash to add (crouch before, landing after)
export function cheer(o, g, g0, g1) {
  const s = seg(g, g0, g1), up = Math.sin(Math.PI * s);
  const k = Math.sin(Math.PI * Math.min(1, s * 1.3));
  const a = lift(2.5) * k;
  o.pos[1] += 0.05 * up;
  o.armR = [cheerForward * k, 0, -a];
  o.armL = [cheerForward * k, 0, a];
  o.legR = [-0.5 * up, 0, 0]; o.legL = [-0.5 * up, 0, 0];
  return crouch(g, g0, 0.12) + landSquash(g, g1, 0.22);
}

// ── everyday moves, so a beat does not write them again. Each eases in and out
// over g0–g1 on a pose from stand() and works on any toy: a toy with no arms
// plays an arm move with its whole body (the rig leans it, wobbles it).
// in and out: 0 → 1 → 0 across g0–g1, over `edge` seconds at each end
const held = (g, g0, g1, edge = 0.18) => smooth(seg(g, g0, g0 + edge)) * (1 - smooth(seg(g, g1 - edge, g1)));
// one arm up, waving ("L" its left, "R" its right)
export function wave(o, g, g0, g1, side = "L") {
  const k = held(g, g0, g1), w = (ARM_MAX < 2.2 ? 0.25 : 0.35) * Math.sin((g - g0) * TAU * 2.5);
  const base = lift(2.3);
  if (side === "L") o.armL = [cheerForward * k, 0, lerp(o.armL[2], base + w, k)];
  else o.armR = [cheerForward * k, 0, lerp(o.armR[2], -base - w, k)];
  o.head = [o.head[0], o.head[1], o.head[2] + 0.12 * k * (side === "L" ? -1 : 1)];
  return o;
}
// nods `times` times: yes, thanks, agreed
export function nod(o, g, g0, g1, times = 2) {
  const k = held(g, g0, g1, 0.1);
  o.head = [o.head[0] + 0.3 * k * Math.abs(Math.sin(Math.PI * times * seg(g, g0, g1))), o.head[1], o.head[2]];
  return o;
}
// points at a world point with one arm ("R" or "L"), the head and body turned to it
export function point(o, g, g0, g1, world, side = "R") {
  const k = held(g, g0, g1, 0.22);
  if (side === "R") { o.aimR = { world, k, len: 1.15 }; o.pointR = k; } else { o.aimL = { world, k, len: 1.15 }; o.pointL = k; }
  o.yaw = lerpAngle(o.yaw, yawTo(o.pos, world), 0.35 * k);
  o.head = [o.head[0] - 0.15 * k, o.head[1] + 0.25 * k * (side === "R" ? -1 : 1), o.head[2]];
  return o;
}
// points one arm high into the sky at ~42° outward so even wide-headed chibi/sculpt toys clear their cheeks in full silhouette
export function skyPoint(o, g, g0, g1, side = "R") {
  const k = held(g, g0, g1, 0.2);
  const sgn = side === "R" ? -1 : 1;
  const world = [o.pos[0] + sgn * 0.122, o.pos[1] + 0.166, o.pos[2] + 0.042];
  if (side === "R") {
    o.aimR = { world, k, len: 1.48 };
    o.pointR = k;
    o.armL = [0.18 * k, 0, lerp(o.armL[2], 0.42, k)];
  } else {
    o.aimL = { world, k, len: 1.48 };
    o.pointL = k;
    o.armR = [0.18 * k, 0, lerp(o.armR[2], -0.42, k)];
  }
  o.pitch -= 0.08 * k;
  o.head = [o.head[0] - 0.16 * k, o.head[1] + 0.12 * sgn * k, o.head[2]];
  return o;
}
// raises both arms wide and high in a triumphant V that clears wide chibi heads/ear-cups without double-wrapping at(...)
export function raiseArms(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.2);
  o.aimR = { world: [o.pos[0] - 0.122, o.pos[1] + 0.164, o.pos[2] + 0.04], k, len: 1.46 };
  o.aimL = { world: [o.pos[0] + 0.122, o.pos[1] + 0.164, o.pos[2] + 0.04], k, len: 1.46 };
  o.pointR = k;
  o.pointL = k;
  o.pitch -= 0.06 * k;
  o.head = [o.head[0] - 0.14 * k, o.head[1], o.head[2]];
  return o;
}
// turns to face a world point (yaw), looking up or down at it with the head
export function lookAt(o, world, k = 1) {
  o.yaw = lerpAngle(o.yaw, yawTo(o.pos, world), k);
  const d = v3.sub(world, o.pos), up = Math.atan2(d[1] - 0.06, Math.hypot(d[0], d[2]) || 1);
  o.head = [o.head[0] - 0.5 * up * k, o.head[1], o.head[2]];
  return o;
}
// spins round `turns` times with a little hop; returns the squash to add
export function spin(o, g, g0, g1, turns = 1) {
  const s = seg(g, g0, g1);
  o.yaw += turns * TAU * easeInOut(s);
  o.pos[1] += 0.03 * Math.sin(Math.PI * s);
  o.armR = [0, 0, lerp(o.armR[2], -1.2, Math.sin(Math.PI * s))]; o.armL = [0, 0, lerp(o.armL[2], 1.2, Math.sin(Math.PI * s))];
  return crouch(g, g0, 0.1) + landSquash(g, g1, 0.18);
}
// a bow from the waist (a thank-you, a goodbye)
export function bow(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.25);
  o.pitch += 0.45 * k;
  o.head = [o.head[0] + 0.2 * k, o.head[1], o.head[2]];
  o.armR = [0.3 * k, 0, o.armR[2]]; o.armL = [0.3 * k, 0, o.armL[2]];
  return o;
}
// sits down on the floor (legs forward) and gets up again at g1; a toy with no legs settles lower
export function sit(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.3);
  const hip = JOINTS.legR?.p?.[1] ?? JOINTS.legL?.p?.[1] ?? 0;
  if (hip > 0) {
    o.legR = [-1.45 * k, 0, 0.1 * k]; o.legL = [-1.45 * k, 0, -0.1 * k];
    o.pos[1] -= 0.75 * hip * o.pop * k;
    o.armR = [0, 0, lerp(o.armR[2], -0.5, k)]; o.armL = [0, 0, lerp(o.armL[2], 0.5, k)];
  } else squash(o, 0.18 * k);
  return o;
}

// ── when things do not go its way: a toy that only cheers has no story (references/story-directions.md, "A scene,
// not a list"). The same poses a story's frames use (engine/lib/poses.json), eased in and out over g0–g1 like the
// moves above, on a pose from stand(); a toy with no arms or legs plays them with its body and head.
// thrown back, arms flung up, a small start off the floor: a surprise, good or bad
export function startle(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.09);
  const a = lift(1.9);
  o.armR = [0.2 * k, 0, lerp(o.armR[2], -a, k)]; o.armL = [0.2 * k, 0, lerp(o.armL[2], a, k)];
  o.head = [o.head[0] - 0.28 * k, o.head[1], o.head[2]];
  o.pitch -= 0.16 * k;
  o.legR = [o.legR[0], 0, -0.18 * k]; o.legL = [o.legL[0], 0, 0.18 * k];
  o.pos[1] += 0.03 * Math.sin(Math.PI * seg(g, g0, g0 + 0.24));
  return o;
}
// head down, arms over it, low: something is coming down
export function duck(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.12);
  o.armR = [-0.9 * k, 0, lerp(o.armR[2], -2.0, k)]; o.armL = [-0.9 * k, 0, lerp(o.armL[2], 2.0, k)];
  o.head = [o.head[0] + 0.42 * k, o.head[1], o.head[2]];
  o.pitch += 0.26 * k;
  o.legR = [o.legR[0], 0, -0.15 * k]; o.legL = [o.legL[0], 0, 0.15 * k];
  squash(o, 0.1 * k);
  return o;
}
// head hanging, arms loose: at a loss, tired, let down
export function slump(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.3);
  o.armR = [0, 0, lerp(o.armR[2], -0.05, k)]; o.armL = [0, 0, lerp(o.armL[2], 0.05, k)];
  o.head = [o.head[0] + 0.38 * k, o.head[1], o.head[2]];
  o.pitch += 0.1 * k;
  squash(o, 0.04 * k);
  return o;
}
// arms out, head to one side: well, then
export function shrug(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.16);
  o.armR = [0, 0, lerp(o.armR[2], -0.95, k)]; o.armL = [0, 0, lerp(o.armL[2], 0.95, k)];
  o.head = [o.head[0] + 0.12 * k, o.head[1], o.head[2] + 0.14 * k];
  o.pos[1] += 0.012 * Math.sin(Math.PI * seg(g, g0, g0 + 0.3));
  return o;
}
// head back, arms a little out: looking up at something big
export function lookUp(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.25);
  o.armR = [0, 0, lerp(o.armR[2], -0.7, k)]; o.armL = [0, 0, lerp(o.armL[2], 0.7, k)];
  o.head = [o.head[0] - 0.5 * k, o.head[1], o.head[2]];
  o.pitch -= 0.08 * k;
  return o;
}
// leaning into a weight with both arms, its legs working: a thing that will not move by itself
export function push(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.2), step = Math.sin((g - g0) * TAU * 1.6);
  o.armR = [-1.45 * k, 0, lerp(o.armR[2], -0.12, k)]; o.armL = [-1.45 * k, 0, lerp(o.armL[2], 0.12, k)];
  o.pitch += 0.3 * k;
  o.legR = [0.55 * step * k, 0, 0]; o.legL = [-0.55 * step * k, 0, 0];
  return o;
}
// one leg out and back ("R" its right, "L" its left), the arms the other way: kicking a thing away. The foot is
// furthest at the middle of g0–g1: that is when what it kicks leaves
export function kick(o, g, g0, g1, side = "R") {
  const s = seg(g, g0, g1), k = Math.sin(Math.PI * s) ** 0.7, wind = -0.35 * Math.sin(Math.PI * Math.min(1, s * 3)) * (s < 1 / 3 ? 1 : 0);
  const leg = [-1.35 * k - wind, 0, 0], other = [0.15 * k, 0, 0];
  if (side === "R") { o.legR = leg; o.legL = other; } else { o.legL = leg; o.legR = other; }
  o.armR = [0.9 * k * (side === "R" ? 1 : -1), 0, lerp(o.armR[2], -0.5, k)]; o.armL = [-0.7 * k * (side === "R" ? 1 : -1), 0, lerp(o.armL[2], 0.7, k)];
  o.pitch -= 0.14 * k;
  return o;
}
// both arms up beside its head: holding a sign, a prize, a thing over it
export function holdUp(o, g, g0, g1) {
  const k = held(g, g0, g1, 0.2);
  o.armR = [0, 0, lerp(o.armR[2], -2.05, k)]; o.armL = [0, 0, lerp(o.armL[2], 2.05, k)];
  o.head = [o.head[0] - 0.08 * k, o.head[1], o.head[2]];
  return o;
}

// the toy for a pose: its transform, its parts and its contact shadow on the
// floor under it (null: the toy is not in this beat)
export function toyFrom(o, park) {
  if (!o || o.show === false) {
    const p = o ? o.pos : park;
    const hero = trs(p.slice(), qId(), HIDDEN);
    return { hero, parts: partsAt(hero, basePose(p), TOY), blob: { tr: trs(p.slice(), qId(), HIDDEN), opacity: 0 }, glint: 0 };
  }
  const hero = heroT(o, CENTER);
  const h = Math.max(0, o.pos[1] - o.ground), k = clamp01(1 - h / 0.12), s = 1.15 - 0.35 * k;
  const blob = { tr: trs([o.pos[0], o.ground + 0.0007, o.pos[2]], qEuler(-Math.PI / 2, 0, 0), k > 0.01 ? [0.07 * s * o.pop, 0.05 * s * o.pop, 1] : HIDDEN), opacity: 0.7 * k * k };
  return { hero, parts: partsAt(hero, o, TOY), blob, glint: o.glint ?? 0 };
}

// a camera from keys in the beat's seconds: [{ t, target: world point, dist m,
// elev deg, az deg, fstop? }] (one key holds still); shakes [[t, strength]]
export function cameraFrom(keys, { fov, aspect, shakes = [] }) {
  const ks = (keys.length === 1 ? [keys[0], { ...keys[0], t: keys[0].t + 1 }] : keys).map((k) => ({ fstop: 5.6, ...k }));
  return makeCamera({ shots: [{ start: -Infinity, keys: ks, target: (k) => k.target }], fov, shakes, aspect });
}

// a number as the platform writes it, and text that changes as it counts (engine/lib/counter.js)
export { formatCount, readout } from "./counter.js";

// one confetti flake bursting from p0 (world) at t0: { tr, color } at g
export function confetti(i, g, t0, p0, colors, rand) {
  const a = rand() * Math.PI * 2, sp = 0.25 + rand() * 0.35;
  const v0 = [Math.cos(a) * sp * 0.9, 0.5 + rand() * 0.5, Math.abs(Math.sin(a)) * sp * 0.6 + 0.05];
  const spin = [4 + rand() * 8, 3 + rand() * 6];
  const color = colors[i % colors.length];
  const dt = g - t0;
  if (dt < 0 || dt > 1.6) return { tr: trs(p0.slice(), qId(), HIDDEN), color };
  const p = [p0[0] + v0[0] * dt, Math.max(0.0007, p0[1] + v0[1] * dt - 1.2 * dt * dt), p0[2] + v0[2] * dt];
  return { tr: trs(p, qEuler(dt * spin[0], dt * spin[1], dt * 5), 1 - seg(dt, 1.3, 1.6)), color };
}

// ── colours beside the toy ──────────────────────────────────────────────────
// lettering in the toy's own colour melts into it when they stand side by side (a gold line beside a lemon):
// apart(candidates) is the first colour clear of the toy's main colours (those covering a quarter of it or more)
const oklab = (hex) => {
  const lin = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  const [l, m, s] = [[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]]
    .map((r) => Math.cbrt(r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2]));
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const partArea = (p) => {
  if (p.size) { const [x, y, z] = p.size; return 2 * (x * y + y * z + z * x); }
  if (Array.isArray(p.r)) { const [a, b = a, c = b] = p.r; return 4 * Math.PI * Math.pow((Math.pow(a * b, 1.6) + Math.pow(a * c, 1.6) + Math.pow(b * c, 1.6)) / 3, 1 / 1.6); }
  if (p.pts) { let L = 0; for (let i = 1; i < p.pts.length; i++) L += Math.hypot(...p.pts[i].map((v, k) => v - p.pts[i - 1][k])); return L * 2 * Math.PI * ((p.radii ?? [0.002]).reduce((a, b) => a + b, 0) / (p.radii?.length ?? 1)); }
  return 0;
};
export function toyMainColours(share = 0.25) {
  const area = {};
  for (const p of TOY.parts ?? []) if (p.mat && COLORS?.[p.mat]) area[p.mat] = (area[p.mat] ?? 0) + partArea(p);
  const total = Object.values(area).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(area).filter(([, a]) => a / total >= share).map(([k]) => COLORS[k]);
}
export const colourGap = (a, b) => { const p = oklab(a), q = oklab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export function apart(candidates, gap = 0.12) {
  const main = toyMainColours();
  return candidates.find((c) => main.every((m) => colourGap(c, m) >= gap)) ?? candidates[candidates.length - 1];
}
