// A line of 3D lettering for a beat or a prop (references/beats.md): its letters laid out from the glyphs, each
// with an outline when it stands on a light or busy ground (a white number with a dark edge: the film's rule
// for numbers on screen), standing by its lowest point, never sunk into the floor by a descender.
//
//   const ln = kit.line(glyph, "66 种风格", 0.06, { face: "heavy" });
//   declare: kit.declareLine(add, "count", ln, { color: "#F7F4EC", outline: "#141216" });
//   sample:  kit.putLine(put, "count", ln, (it) => at(it.x, ln.stand, 0), qId(), (it) => 1, { outline: true });
//
// The outline is a second copy of each letter behind it, bevelled wide, so a rim of it shows round the face. It is
// not lettering of its own: its material says "outline", and the colour check reads the face by that edge.
import { apply, trs } from "./quat.js";

const blank = (c) => /\s/.test(c);
const lowest = (geo) => Math.min(0, ...geo.rings.flatMap((r) => r.map((p) => p[1])));

// the characters' keys and x offsets at em (metres), centred on 0; face "display" is the creator's own (film.json
// type.display), else the end card's heavy face. ln.low is the line's lowest point (a descender's, below the
// baseline); a line standing on a floor sets its baseline at ln.stand above it
export function line(glyph, text, em, { face = "heavy", track = 0.04 } = {}) {
  const chars = [...String(text)];
  const key = (c) => (face === "display" && glyph.has(`display:${c}`) ? `display:${c}` : `${face === "display" ? "heavy" : face}:${c}`);
  const missing = chars.filter((c) => !blank(c) && !glyph.has(key(c)));
  if (missing.length) throw new Error(`no lettering for ${missing.join("")}: run the glyph step (run.mjs glyphs); a character only a beat or a prop shows goes in film.json "glyphs"`);
  const advs = chars.map((c) => (blank(c) ? 0.3 : glyph.adv(key(c)) + track) * em);
  const W = advs.reduce((a, b) => a + b, 0) - track * em;
  let x = -W / 2;
  const items = [];
  chars.forEach((c, i) => { if (!blank(c)) items.push({ c, i, key: key(c), x, low: lowest(glyph.geo(key(c), em, 0, 0)) }); x += advs[i]; });
  const low = Math.min(0, ...items.map((it) => it.low));
  return { items, W, em, low, stand: -low, text: chars.join(""), geo: glyph.geo };
}

// its letters as objects, name + i (and name + "o" + i for the outline). outline: true for a dark glossy edge,
// or a colour ("#141216", the logo's own grey); edge: how far the outline's bevel reaches out, in em
export function declareLine(add, name, ln, { color = "#F7F4EC", emit = 0.35, depth = 0.012, bevel = 0.0006, outline = false, edge = 0.032, finish = {} } = {}) {
  const rim = outline === true ? "#0B0C0F" : outline || null;
  for (const it of ln.items) {
    add({ name: `${name}${it.i}`, geo: ln.geo(it.key, ln.em, depth, bevel), mat: { type: "type", color, emit, ...finish, ...(rim ? { edge: rim } : {}) }, anim: true });
    if (rim) add({ name: `${name}o${it.i}`, geo: ln.geo(it.key, ln.em, depth * 0.7, ln.em * edge), mat: outline === true ? { type: "glass", outline: true } : { type: "type", color: rim, emit: 0, outline: true }, anim: true });
  }
}

// places them: base(it) the letter's origin in the world (its baseline's left end: add ln.stand to stand the line
// on a floor), q its turn, k(it) its size (0 hides). The outline sits behind by its bevel, which grows forward too
export function putLine(put, name, ln, base, q, k, { outline = false, edge = 0.032, back } = {}) {
  // behind, as the line faces: the offset turned with it
  const off = apply(trs([0, 0, 0], q, 1), back ?? [0, 0, -(ln.em * edge + 0.003)]);
  for (const it of ln.items) {
    const s = k(it), p = base(it), size = s > 0 ? s : 1e-4;
    put(`${name}${it.i}`, trs(p, q, size));
    if (outline) put(`${name}o${it.i}`, trs([p[0] + off[0] * s, p[1] + off[1] * s, p[2] + off[2] * s], q, size));
  }
}
