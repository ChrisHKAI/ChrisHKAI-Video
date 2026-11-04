// A line of 3D lettering for a beat or a prop (references/beats.md, "Lettering"): its letters laid out from the
// glyphs in the face the film chose (film.json "type"), each with an edge when it needs one, standing by its lowest
// point, never sunk into the floor by a descender.
//
//   const ln = kit.line(glyph, "66 种风格", 0.06);
//   declare: kit.declareLine(add, "count", ln, { color: "#F7F4EC", outline: "#141216" });
//   sample:  kit.putLine(put, "count", ln, (it) => at(it.x, ln.stand, 0), kit.facing(camera(g).pos, at(0, 0, 0)), (it) => 1, { outline: true });
//
// What keeps any face readable, whatever the film chose (the look is the film's own: colour, edge, finish):
// - its depth follows its size (0.08 em), never a fixed few millimetres that makes a small line a deep block;
// - its sides take a deeper shade of its face, so the top of each stroke, seen from above, does not thicken it;
// - its edge is a flat plate grown round each letter (geo.grow: the letter widened evenly, round at the corners),
//   one even band round the line where the letters' plates meet, never a domed copy that shows a dark crown;
// - it faces the camera while it is read (kit.facing), so the camera never looks down on the tops of its letters;
// - it does not glow: the finish's bloom fills a glowing letter's counters.
// The edge is not lettering of its own: its material says "outline", and the colour check reads the face by it.
// Every letter says it is one ("letter": the character), so the checks never take a print or a logo for words.
import { apply, trs, qMul, qEuler } from "./quat.js";

const blank = (c) => /\s/.test(c);
const cjk = (c) => c.codePointAt(0) >= 0x2e80;
const lowest = (geo) => Math.min(0, ...geo.rings.flatMap((r) => r.map((p) => p[1])));
export const DEPTH = 0.08; // em
export const TRACK = { cjk: 0.08, latin: 0.03 }; // em between letters: a CJK face's letters fill their whole em

// a deeper shade of a colour, the same hue: a letter's sides
export function shade(hex, k = 0.5) {
  const h = hex.replace("#", "");
  return "#" + [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// the turn that faces a line standing at `at` to the camera at `eye` (its +z towards it: turned, then leant back)
export function facing(eye, at) {
  const d = [eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]];
  return qMul(qEuler(0, Math.atan2(d[0], d[2]), 0), qEuler(-Math.atan2(d[1], Math.hypot(d[0], d[2])), 0, 0));
}

// the characters' keys and x offsets at em (metres), centred on 0; face "display" is the creator's own (film.json
// type.display), else the film's words' face ("heavy", whatever the film chose). track: em between letters (TRACK
// by script when not given); edge: the reach of the edge it will have (em, as declareLine's), so it stands on its
// edge. ln.low is the line's lowest point (a descender's, below the baseline); a line standing on a floor sets its
// baseline at ln.stand above it
export function line(glyph, text, em, { face = "heavy", track, edge = 0 } = {}) {
  const chars = [...String(text)];
  const key = (c) => (face === "display" && glyph.has(`display:${c}`) ? `display:${c}` : `${face === "display" ? "heavy" : face}:${c}`);
  const missing = chars.filter((c) => !blank(c) && !glyph.has(key(c)));
  if (missing.length) throw new Error(`no lettering for ${missing.join("")}: run the glyph step (run.mjs glyphs); a character only a beat or a prop shows goes in film.json "glyphs"`);
  const gap = (c) => track ?? (cjk(c) ? TRACK.cjk : TRACK.latin);
  const advs = chars.map((c) => (blank(c) ? 0.3 : glyph.adv(key(c)) + gap(c)) * em);
  const W = advs.reduce((a, b) => a + b, 0) - gap(chars[chars.length - 1] ?? "a") * em;
  let x = -W / 2;
  const items = [];
  chars.forEach((c, i) => { if (!blank(c)) items.push({ c, i, key: key(c), x, low: lowest(glyph.geo(key(c), em, 0, 0)) }); x += advs[i]; });
  const low = Math.min(0, ...items.map((it) => it.low));
  return { items, W, em, low, stand: -low + edge * em, edge, text: chars.join(""), geo: glyph.geo };
}

// its letters as objects, name + i (and name + "o" + i for the edge). outline: true for a dark glossy edge, or a
// colour (the logo's own grey, the creator's blue); edge: how far it reaches out round the letter, in em (the
// line's own, kit.line's edge, when it was laid out with one; else 0.05). depth in
// metres (DEPTH em when not given: give putLine the same); finish: the type material's own fields, its side
// ("side": a colour, or null for the face's own colour on its sides too; a deeper shade of the face by default)
export function declareLine(add, name, ln, { color = "#F7F4EC", emit = 0, depth, bevel, outline = false, edge, finish = {} } = {}) {
  const d = depth ?? ln.em * DEPTH, b = bevel ?? ln.em * 0.01;
  edge ??= ln.edge || 0.05;
  const rim = outline === true ? "#0B0C0F" : outline || null;
  const side = "side" in finish ? finish.side : shade(color);
  const fin = { ...finish, ...(side ? { side } : {}) };
  if (!side) delete fin.side;
  for (const it of ln.items) {
    add({ name: `${name}${it.i}`, letter: it.c, geo: ln.geo(it.key, ln.em, d, b), mat: { type: "type", color, emit, ...fin, ...(rim ? { edge: rim } : {}) }, anim: true });
    if (rim) add({ name: `${name}o${it.i}`, geo: { ...ln.geo(it.key, ln.em, d, 0), grow: ln.em * edge }, mat: outline === true ? { type: "glass", outline: true } : { type: "type", color: rim, emit: 0, outline: true }, anim: true });
  }
}

// places them: base(it) the letter's origin in the world (its baseline's left end: add ln.stand to stand the line
// on a floor), q its turn (kit.facing: towards the camera), k(it) its size (0 hides). The edge's plate sits behind
// the face by half its depth, so the face stands proud of it (depth: as declareLine was given)
export function putLine(put, name, ln, base, q, k, { outline = false, depth, back } = {}) {
  const d = depth ?? ln.em * DEPTH;
  // behind, as the line faces: the offset turned with it
  const off = apply(trs([0, 0, 0], q, 1), back ?? [0, 0, -(d / 2 + 0.0004)]);
  for (const it of ln.items) {
    const s = k(it), p = base(it), size = s > 0 ? s : 1e-4;
    put(`${name}${it.i}`, trs(p, q, size));
    if (outline) put(`${name}o${it.i}`, trs([p[0] + off[0] * s, p[1] + off[1] * s, p[2] + off[2] * s], q, size));
  }
}
