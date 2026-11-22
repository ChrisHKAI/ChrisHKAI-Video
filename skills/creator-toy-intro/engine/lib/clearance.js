// Where the toy goes into something solid: a wall and its pieces, the
// lettering, the counter, the end card's labels and prop. It reads what
// export-anim wrote (build/anim.json, before Blender), places every object at
// each frame the way scene.py does, and tests points on the toy's parts
// against every solid. A contact is a stretch of frames where some part of the
// toy is deeper inside one solid than the tolerance: { solid, part, from, to,
// peak (s), depth (m) }.
//
// Axes as in anim.json: +y up, metres; a track row is [sample, px, py, pz,
// qx, qy, qz, qw, sx, sy, sz] and holds linearly between rows.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const MM = 0.001;
// what is not a solid: particles, flat pictures, the floor, the camera
// (a beat's objects carry its prefix, beat<k>_: its sparks and glows are no more solid than the story's)
const SKIP_NAME = /^(beat\d+_)?(flake|spark|bit|glow|confetti|burst|strip|floor|cta_floor|fx|camera)/;
const SKIP_GEO = new Set(["plane", "octa", "arc"]);

export function clearance(anim, { toy = "hero", tol = null, every = 1, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const toyParts = anim.objects.filter((o) => o.geo && o.name !== toy && under(o, toy));
  if (!toyParts.length) return { contacts: [], tol: 0, height: 0 };
  const solids = anim.objects.filter((o) => o.geo && !under(o, toy) && !SKIP_NAME.test(o.name) && !SKIP_GEO.has(o.geo.type) && o.mat?.type !== "flake").map(solid).filter(Boolean);
  const probes = toyParts.map((o) => ({ o, pts: probesOf(o.geo, file) })).filter((p) => p.pts.length);

  const sampleAt = trackReader(anim);
  const SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    let w = { p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1] };
    if (o) {
      const local = sampleAt(name, s) ?? unpack(o.tr);
      w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    }
    memo.set(name, w);
    return w;
  };

  let height = 0;
  const open = new Map(); // solid → the contact being followed
  const contacts = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    // the toy's points this frame, in the world (a hidden part, scaled to nothing, has none)
    const pts = [];
    for (const { o, pts: local } of probes) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      for (const [lp, pad] of local) pts.push({ p: apply(w, lp), pad: pad * Math.min(...w.s.map(Math.abs)), part: o.name });
    }
    if (pts.length) {
      const ys = pts.map((x) => x.p[1]);
      height = Math.max(height, Math.max(...ys) - Math.min(...ys));
    }
    const lo = [0, 1, 2].map((i) => Math.min(...pts.map((x) => x.p[i])) - 0.05), hi = [0, 1, 2].map((i) => Math.max(...pts.map((x) => x.p[i])) + 0.05);
    const deep = new Map();
    for (const sd of solids) {
      const w = worldOf(sd.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      const r = sd.radius * Math.max(...w.s.map(Math.abs));
      if (w.p.some((v, i) => v + r < lo[i] || v - r > hi[i])) continue;
      let worst = null, inside = 0;
      for (const x of pts) {
        const d = sd.depth(toLocal(w, x.p), w.s) + x.pad;
        if (d <= 0) continue;
        inside++;
        if (!worst || d > worst.depth) worst = { depth: d, part: x.part };
      }
      // share: how much of the toy is in it (an arm's tip, or the whole body)
      if (worst) deep.set(sd.o.name, { ...worst, share: inside / pts.length });
    }
    for (const [name, c] of open) if (!deep.has(name)) { contacts.push(c); open.delete(name); }
    for (const [name, d] of deep) {
      const c = open.get(name);
      if (!c) open.set(name, { solid: name, part: d.part, from: t, to: t, peak: t, depth: d.depth, share: d.share });
      else { c.to = t; c.share = Math.max(c.share, d.share); if (d.depth > c.depth) Object.assign(c, { depth: d.depth, peak: t, part: d.part }); }
    }
  }
  contacts.push(...open.values());
  // a small dent where the toy lands or leans is not worth a word; a part of the toy a few per cent of its height inside is
  const limit = tol ?? Math.max(2 * MM, 0.04 * height);
  return { contacts: contacts.filter((c) => c.depth > limit).sort((a, b) => a.from - b.from), tol: limit, height };
}

// the contacts of one film, a moment each: "6.6–7.9 s: half the toy is inside piece2_grid, 38 mm deep".
// kind "into" (a good share of the toy, or deep: the viewer sees it go through) or "touch" (a hand, a
// heel or an ear a few mm in, which the eye forgives)
// the objects that are lettering: each letter kit.line made says so ("letter"), and its edge is named after it
// (name + "o" + i); a prop shaped from a curve in the type material (a sun, a logo) is not. Motion written before
// letters said so: the type material's curves and the edges grown round them
export function letterObjects(anim) {
  const named = new Set(anim.objects.filter((o) => o.letter).map((o) => o.name));
  if (!named.size) return anim.objects.filter((o) => (o.mat?.type === "type" && !o.mat.outline) || (o.mat?.outline && o.geo?.grow));
  return anim.objects.filter((o) => named.has(o.name) || (o.mat?.outline && named.has(o.name.replace(/o(\d+)$/, "$1"))));
}

// a line whose letters come one by one faster than they can be read as they come: under `each` seconds a letter
// from the first to the last (a beat's own typing, a frame a letter, is over before the eye starts on it). The end
// card's labels say "pop": their letters pop up together as the paper lands, a flourish, not typing.
// {name, text, n, secs, need}: the line's letters, how long they took to come, how long they should
export function fastReveal(anim, { each = 0.05 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const sizeOf = (name, s) => Math.min(...(sampleAt(name, s) ?? unpack(objects.get(name).tr)).s.map(Math.abs));
  const lines = new Map();
  for (const o of anim.objects) if (o.letter && o.anim && !o.pop && !/^label\d+_l\d+$/.test(o.name)) {
    // Prefer explicit `line` tag from kit.declareLine (scoped by beat prefix) so lines like slo1 / slo2 stay separate.
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, "");
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(o);
  }
  const out = [];
  for (const [name, ls] of lines) {
    if (ls.length < 3) continue;
    const sizes = ls.map((o) => Array.from({ length: anim.frames }, (_, f) => sizeOf(o.name, f * SUB)));
    const full = sizes.map((z) => Math.max(...z));
    // each time the line comes: the first frame each letter is at half its size, after a frame it was not
    for (let f = 1; f < anim.frames; f++) {
      const first = sizes.findIndex((z, i) => z[f] >= full[i] / 2 && z[f - 1] < full[i] / 2);
      if (first < 0 || sizes.some((z, i) => z[f - 1] >= full[i] / 2)) continue;
      const came = sizes.map((z, i) => { for (let g = f; g < Math.min(anim.frames, f + anim.fps * 4); g++) if (z[g] >= full[i] / 2) return g; return null; });
      if (came.some((g) => g == null)) continue;
      const spread = (Math.max(...came) - Math.min(...came)) / anim.fps;
      const idxOf = (o) => o.letterIndex ?? +(o.name.match(/(\d+)$/)?.[1] ?? 0);
      const order = ls.map((o, i) => [idxOf(o), o.letter, came[i]]).sort((a, b) => a[0] - b[0]);
      const need = each * (ls.length - 1);
      // all at once is a line that arrives whole, not typed
      if (spread > 0 && spread < need) out.push({ name, text: order.map((x) => x[1]).join(""), n: ls.length, at: f / anim.fps, secs: +spread.toFixed(2), need: +need.toFixed(2) });
    }
  }
  return out;
}

// lettering standing on a floor, sunk into it (a descender, a stroke under the baseline set on the floor): at rest
// and at full size, its lowest point more than tol below the floor it stands over (kit.line's stand keeps it up)
export function sunkLetters(anim, { tol = 0.0015, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  const floors = anim.objects.filter((o) => o.geo?.type === "plane" && /(^|_)floor$/.test(o.name));
  // a letter's edge (geo.grow) reaches below the letter by its grow
  const letters = letterObjects(anim).filter((o) => o.geo?.type === "curve" && o.geo.rings?.length)
    .map((o) => ({ o, pts: o.geo.rings.flatMap((r) => r.filter((_, i) => i % 3 === 0)).map(([x, y]) => [x, y, 0]), bevel: o.geo.grow ?? o.geo.bevel ?? 0 }));
  if (!floors.length || !letters.length) return [];
  const frames = [];
  for (let f = 0; f < anim.frames; f += every) frames.push(f);
  const at = frames.map((f) => { const memo = new Map(); return { f, memo }; });
  // full size: the letter's largest size over the film
  const full = new Map(letters.map(({ o }) => [o.name, Math.max(...at.map(({ f, memo }) => Math.min(...worldOf(o.name, f * SUB, memo).s.map(Math.abs))))]));
  const open = new Map(), out = [];
  const close = (name) => { const c = open.get(name); if (c) { out.push(c); open.delete(name); } };
  for (const [k, { f, memo }] of at.entries()) {
    for (const { o, pts, bevel } of letters) {
      const w = worldOf(o.name, f * SUB, memo), size = Math.min(...w.s.map(Math.abs));
      const prev = k ? worldOf(o.name, at[k - 1].f * SUB, at[k - 1].memo) : w;
      if (size < 0.98 * full.get(o.name) || Math.abs(w.p[1] - prev.p[1]) > 3e-4) { close(o.name); continue; }
      const low = Math.min(...pts.map((p) => apply(w, p)[1])) - bevel * size;
      let depth = 0;
      for (const fl of floors) {
        const fw = worldOf(fl.name, f * SUB, memo);
        if (Math.abs(w.p[0] - fw.p[0]) > (fl.geo.w / 2) * fw.s[0] || Math.abs(w.p[2] - fw.p[2]) > (fl.geo.h / 2) * fw.s[2]) continue;
        const d = fw.p[1] - low;
        if (d > tol && d < 0.05) depth = Math.max(depth, d);
      }
      if (!depth) { close(o.name); continue; }
      const t = f / anim.fps, c = open.get(o.name);
      if (c) { c.to = t; c.mm = Math.max(c.mm, depth / MM); } else open.set(o.name, { name: o.name, from: t, to: t, mm: depth / MM });
    }
  }
  for (const name of [...open.keys()]) close(name);
  // a moment in passing (a line rising past the floor, still for a sample) is not standing on it: a fifth of a second at least
  out.splice(0, out.length, ...out.filter((c) => c.to - c.from >= 0.13));
  // one line a word: letters named alike (count0, count1 …) and sunk at the same time go together
  const words = new Map();
  for (const c of out) {
    const key = `${c.name.replace(/\d+$/, "")}|${c.from.toFixed(1)}`;
    const w = words.get(key) ?? { names: [], from: c.from, to: c.to, mm: 0 };
    w.names.push(c.name); w.to = Math.max(w.to, c.to); w.mm = Math.max(w.mm, c.mm);
    words.set(key, w);
  }
  return [...words.values()].map((w) => ({ ...w, mm: +w.mm.toFixed(1), text: `${w.names.length > 1 ? `${w.names[0]}… (${w.names.length} letters)` : w.names[0]} ${w.mm.toFixed(0)} mm into the floor at ${w.from.toFixed(1)}–${w.to.toFixed(1)} s` }));
}

export function describe(contacts, height) {
  const merged = [];
  for (const c of contacts) {
    const m = merged.find((x) => c.from <= x.to + 0.2 && c.to >= x.from - 0.2);
    if (m) { m.from = Math.min(m.from, c.from); m.to = Math.max(m.to, c.to); m.list.push(c); }
    else merged.push({ from: c.from, to: c.to, list: [c] });
  }
  return merged.map((m) => {
    const worst = m.list.toSorted((a, b) => b.depth - a.depth);
    const share = Math.max(...m.list.map((c) => c.share));
    const names = [...new Set(worst.map((c) => c.solid))];
    const kind = share >= 0.15 || worst[0].depth >= 0.25 * height ? "into" : "touch";
    const how = share >= 0.5 ? "most of the toy is" : share >= 0.15 ? `${Math.round(share * 100)}% of the toy is` : `its ${worst[0].part.replace(/^hero_/, "")} is`;
    return { kind, from: m.from, to: m.to, peak: worst[0].peak, depth: worst[0].depth, share, solids: names,
      text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${how} inside ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}, ${(worst[0].depth / MM).toFixed(0)} mm deep (worst at ${worst[0].peak.toFixed(2)} s)` };
  });
}

// the toy's size at rest, from its parts where the rig puts them (transforms: partsAt's, hero space:
// origin between the feet, +y up): { lo, hi } in metres. A sculpted part reads its own vertices.
export function restBounds(parts, transforms, file = (p) => p) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  parts.forEach((p, i) => {
    const [a, b] = partBox(p, file);
    if (!a) return;
    for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) {
      const w = apply(transforms[i], [x, y, z]);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); }
    }
  });
  return { lo, hi };
}
function partBox(p, file) {
  const r3 = (r) => (Array.isArray(r) ? r : [r, r, r]);
  const sym = (h) => [h.map((v) => -v), h];
  const path = (pts, radii) => { const m = Math.max(...radii); return [[0, 1, 2].map((i) => Math.min(...pts.map((q) => q[i])) - m), [0, 1, 2].map((i) => Math.max(...pts.map((q) => q[i])) + m)]; };
  switch (p.shape) {
    case "roundBox": return sym(p.size.map((v) => v / 2));
    case "ellipsoid": case "blob": return sym(r3(p.r));
    case "arc": return sym([p.radius + p.tube, p.radius + p.tube, p.tube]);
    case "tube": case "loop": return path(p.pts, p.radii);
    case "prism": { const m = Math.max(p.r, p.depth / 2); return sym([m, m, m]); }
    case "plate": {
      if (p.outline) { // a slab of any outline (a logo's pieces): its own bounds, x and z, t thick along y
        const xs = p.outline.map((q) => q[0]), zs = p.outline.map((q) => q[1]);
        return [[Math.min(...xs), -p.t / 2, Math.min(...zs)], [Math.max(...xs), p.t / 2, Math.max(...zs)]];
      }
      const m = Math.max(p.w ?? 0, p.d ?? 0) / 2 || 0.01; return sym([m, m, m]);
    }
    case "mesh": {
      const v = npy(file(p.file), "verts.npy");
      if (!v.length) return [null, null];
      const a = [Infinity, Infinity, Infinity], b = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { a[k] = Math.min(a[k], v[i + k]); b[k] = Math.max(b[k], v[i + k]); }
      return [a, b];
    }
    default: return [null, null];
  }
}

// ── the toy: points on each part's surface (local), with how far the part reaches past each ──
function probesOf(g, file) {
  const box = (h, k) => {
    const out = [[[0, 0, 0], 0]];
    for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) { const p = [0, 0, 0]; p[i] = sg * 0.9 * h[i]; out.push([p, 0]); }
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push([[x * k * h[0], y * k * h[1], z * k * h[2]], 0]);
    return out;
  };
  const r3 = (r) => (Array.isArray(r) ? r : [r, r, r]);
  switch (g.type) {
    case "roundBox": return box(g.size.map((v) => v / 2), 0.8);
    case "ellipsoid": case "blob": return box(r3(g.r), 0.5);
    case "tube": case "loop": return g.pts.map((p, i) => [p, (g.radii[i] ?? g.radii.at(-1)) * 0.9]);
    case "prism": return [[[0, 0, 0], 0.9 * Math.min(g.r, g.depth / 2)]];
    case "plate": {
      if (!g.outline) return [[[0, 0, 0], 0.9 * (g.t ?? 0) / 2]];
      // a slab of any outline: its middle, and points two thirds of the way out to each corner, each reaching
      // half its thickness (its origin may sit anywhere: a logo's pieces keep the logo's own coordinates)
      // (each reaches no further than the outline's nearest edge either: a sphere half a thick slab wide would
      // poke out of a thin piece's edge, into whatever it stands on)
      const n = g.outline.length, c = g.outline.reduce((a, q) => [a[0] + q[0] / n, a[1] + q[1] / n], [0, 0]);
      const edge = (x, z) => Math.min(...g.outline.map((a, i) => {
        const b = g.outline[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1];
        const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(x - a[0] - k * dx, z - a[1] - k * dz);
      }));
      const probe = (x, z) => [[x, 0, z], 0.9 * Math.min(g.t / 2, edge(x, z))];
      return [probe(c[0], c[1]), ...g.outline.map((q) => probe(c[0] + (q[0] - c[0]) * 0.66, c[1] + (q[1] - c[1]) * 0.66))];
    }
    case "mesh": { // a sculpted part: some of its own vertices
      const v = npy(file(g.file), "verts.npy"), n = v.length / 3, step = Math.max(1, Math.floor(n / 120));
      const out = [];
      for (let i = 0; i < n; i += step) out.push([[v[3 * i], v[3 * i + 1], v[3 * i + 2]], 0]);
      return out;
    }
    default: return [];
  }
}

// one float32 array from a .npz (a zip of .npy files), read without numpy
function npy(path, name) {
  let buf;
  try { buf = readFileSync(path); } catch { return new Float32Array(0); }
  for (let o = 0; o + 30 < buf.length;) {
    if (buf.readUInt32LE(o) !== 0x04034b50) break;
    const method = buf.readUInt16LE(o + 8), size = buf.readUInt32LE(o + 18), nl = buf.readUInt16LE(o + 26), xl = buf.readUInt16LE(o + 28);
    const fname = buf.toString("utf8", o + 30, o + 30 + nl), start = o + 30 + nl + xl;
    if (fname === name) {
      const raw = method === 8 ? inflateRawSync(buf.subarray(start, start + size)) : buf.subarray(start, start + size);
      const hl = raw.readUInt16LE(8), data = raw.subarray(10 + hl);
      return new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
    }
    o = start + size;
  }
  return new Float32Array(0);
}

// ── the solids: how deep a local point is inside (m, > 0 inside) ──
function solid(o) {
  const g = o.geo;
  const boxDepth = (h, c = [0, 0, 0]) => (p, s) => Math.min(...[0, 1, 2].map((i) => h[i] * Math.abs(s[i]) - Math.abs(p[i] - c[i] * Math.abs(s[i]))));
  const R = (h, c = [0, 0, 0]) => Math.hypot(...h.map((v, i) => Math.abs(v) + Math.abs(c[i])));
  switch (g.type) {
    case "curve": {
      const rings = g.rings;
      const xs = rings.flat().map((q) => q[0]), ys = rings.flat().map((q) => q[1]);
      // a letter's edge (grow) is the letter grown all round, a flat plate: inside within grow of its outline too
      const grow = g.grow ?? 0, hz = g.depth / 2 + (grow ? 0 : g.bevel ?? 0.0005);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const radius = Math.hypot(Math.max(...xs.map(Math.abs)) + grow, Math.max(...ys.map(Math.abs)) + grow, hz);
      return {
        o, radius, depth: (p, s) => {
          const x = p[0] / s[0], y = p[1] / s[1];
          if (x < x0 - grow || x > x1 + grow || y < y0 - grow || y > y1 + grow) return -1;
          const inside = inRings(x, y, rings);
          if (!inside && !grow) return -1;
          const e = edgeDistance(x, y, rings);
          if (!inside && e >= grow) return -1;
          return Math.min((inside ? e + grow : grow - e) * Math.min(Math.abs(s[0]), Math.abs(s[1])), hz * Math.abs(s[2]) - Math.abs(p[2]));
        },
      };
    }
    case "wallSlab": { const h = [g.w / 2, g.h / 2, g.d / 2], c = [0, g.h / 2, -g.d / 2]; return { o, radius: R(h, c), depth: boxDepth(h, c) }; }
    case "uiBox": {
      const [x0, y0, w, h] = g.rect;
      const half = [w * MM / 2, g.thickness / 2, h * MM / 2], c = [(x0 + w / 2) * MM, -g.thickness / 2, (y0 + h / 2) * MM];
      return { o, radius: R(half, c), depth: boxDepth(half, c) };
    }
    case "box": case "roundBox": { const h = g.size.map((v) => v / 2); return { o, radius: R(h), depth: boxDepth(h) }; }
    case "ellipsoid": case "blob": {
      const r = Array.isArray(g.r) ? g.r : [g.r, g.r, g.r];
      return { o, radius: Math.max(...r), depth: (p, s) => { const a = r.map((v, i) => v * Math.abs(s[i])); const q = Math.hypot(...p.map((v, i) => v / a[i])); return (1 - q) * Math.min(...a); } };
    }
    case "drum": return { o, radius: Math.hypot(g.r, g.w / 2), depth: (p, s) => Math.min(g.r * Math.abs(s[1]) - Math.hypot(p[1], p[2]), (g.w / 2) * Math.abs(s[0]) - Math.abs(p[0])) };
    case "tube": case "loop": {
      const pts = g.pts, radii = g.radii;
      const radius = Math.max(...pts.map((q) => Math.hypot(...q))) + Math.max(...radii);
      return {
        o, radius, depth: (p, s) => {
          const k = Math.min(...s.map(Math.abs)), q = p.map((v, i) => v / s[i]);
          let best = -1;
          for (let i = 0; i + 1 < pts.length; i++) {
            const [d, u] = segDist(q, pts[i], pts[i + 1]);
            const r = (radii[i] ?? radii.at(-1)) * (1 - u) + (radii[i + 1] ?? radii.at(-1)) * u;
            best = Math.max(best, (r - d) * k);
          }
          return best;
        },
      };
    }
    default: return null; // prism, plate, mesh: a prop's detail; its main parts are tested
  }
}

function inRings(x, y, rings) {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function edgeDistance(x, y, rings) {
  let best = Infinity;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) best = Math.min(best, segDist([x, y], r[j], r[i])[0]);
  return best;
}
function segDist(p, a, b) {
  const ab = a.map((v, i) => b[i] - v), ap = a.map((v, i) => p[i] - v);
  const L = ab.reduce((s, v) => s + v * v, 0);
  const u = L ? Math.max(0, Math.min(1, ab.reduce((s, v, i) => s + v * ap[i], 0) / L)) : 0;
  return [Math.hypot(...a.map((v, i) => p[i] - (v + u * ab[i]))), u];
}

// ── prop-vs-prop & prop-vs-card 3D clearance (OBB SAT) ──
const BOX_GEOS = new Set(["box", "roundBox", "uiBox", "wallSlab"]);
const SKIP_PROP_MATS = new Set(["flake", "glow", "paper"]);

function boxSpec(o) {
  const g = o.geo;
  if (!g || !BOX_GEOS.has(g.type)) return null;
  if (g.type === "box" || g.type === "roundBox") return { c: [0, 0, 0], h: g.size.map((v) => v / 2), card: false };
  if (g.type === "uiBox") {
    const [x0, y0, w, h] = g.rect;
    return { c: [(x0 + w / 2) * MM, -g.thickness / 2, (y0 + h / 2) * MM], h: [(w * MM) / 2, g.thickness / 2, (h * MM) / 2], card: true };
  }
  return { c: [0, g.h / 2, -g.d / 2], h: [g.w / 2, g.h / 2, g.d / 2], card: false };
}

function groupOf(name) {
  const beat = name.match(/^(beat\d+_)/)?.[1] ?? "";
  const rest = name.slice(beat.length);
  const i = rest.indexOf("_");
  return beat + (i >= 0 ? rest.slice(0, i) : rest);
}

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];

function worldOBB(spec, w) {
  const c = apply(w, spec.c);
  const h = spec.h.map((v, i) => Math.abs(v * w.s[i]));
  const axes = [rot(w.q, [1, 0, 0]), rot(w.q, [0, 1, 0]), rot(w.q, [0, 0, 1])];
  return { c, h, axes, r: Math.hypot(...h), card: spec.card };
}

function pierceDepth(X, Y, faceTol) {
  const rel = [Y.c[0] - X.c[0], Y.c[1] - X.c[1], Y.c[2] - X.c[2]];
  const ov = [0, 0, 0], out = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const ax = X.axes[i];
    const center = dot3(rel, ax);
    const ext = Y.h[0] * Math.abs(dot3(Y.axes[0], ax)) + Y.h[1] * Math.abs(dot3(Y.axes[1], ax)) + Y.h[2] * Math.abs(dot3(Y.axes[2], ax));
    const lo = center - ext, hi = center + ext;
    ov[i] = Math.min(X.h[i], hi) - Math.max(-X.h[i], lo);
    out[i] = Math.min(Math.max(0, -X.h[i] - lo), Math.max(0, hi - X.h[i]));
  }
  let best = 0;
  for (let i = 0; i < 3; i++) {
    if (Math.min(ov[(i + 1) % 3], ov[(i + 2) % 3]) >= faceTol && out[i] > best) best = out[i];
  }
  return best;
}

function satOverlap(A, B, faceTol) {
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  if (dot3(d, d) >= (A.r + B.r) ** 2) return null;
  let minPen = Infinity;
  const test = (ax) => {
    const len = Math.hypot(...ax);
    if (len < 1e-6) return true;
    const u = ax.map((v) => v / len);
    const ra = A.h[0] * Math.abs(dot3(A.axes[0], u)) + A.h[1] * Math.abs(dot3(A.axes[1], u)) + A.h[2] * Math.abs(dot3(A.axes[2], u));
    const rb = B.h[0] * Math.abs(dot3(B.axes[0], u)) + B.h[1] * Math.abs(dot3(B.axes[1], u)) + B.h[2] * Math.abs(dot3(B.axes[2], u));
    const ov = ra + rb - Math.abs(dot3(d, u));
    if (ov <= 0) return false;
    if (ov < minPen) minPen = ov;
    return true;
  };
  for (let i = 0; i < 3; i++) if (!test(A.axes[i]) || !test(B.axes[i])) return null;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!test(cross3(A.axes[i], B.axes[j]))) return null;
  return { pen: minPen, through: Math.max(pierceDepth(A, B, faceTol), pierceDepth(B, A, faceTol)) };
}

/**
 * Detect 3D intersections between non-toy box props and picture cards across `anim.json`.
 * Catches hinged/moving doors, panels, props, or cards piercing or embedding into each other.
 */
export function solidClashes(anim, { toy = "hero", pierceTol = 0.008, embedTol = 0.012, faceTol = 0.006, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const items = anim.objects
    .filter((o) => o.geo && !under(o, toy) && !o.letter && !o.mat?.outline && !SKIP_NAME.test(o.name) && !SKIP_PROP_MATS.has(o.mat?.type))
    .map((o) => ({ o, spec: boxSpec(o), group: groupOf(o.name), card: o.geo.type === "uiBox" }))
    .filter((x) => x.spec);
  if (items.length < 2) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const skipPair = (a, b) =>
    a.group === b.group ||
    (a.o.parent && a.o.parent !== "root" && a.o.parent === b.o.parent) ||
    (a.o.geo.type === "wallSlab" && b.o.name.startsWith("panel_")) ||
    (b.o.geo.type === "wallSlab" && a.o.name.startsWith("panel_"));

  const relState = new Map();
  const open = new Map();
  const raw = [];
  const stepDt = every / anim.fps;

  const relPos = (a, b) => toLocal(a, b.p).map((v, k) => v / Math.max(1e-3, Math.abs(a.s[k])));

  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const active = [];
    for (const it of items) {
      const w = worldOf(it.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      active.push({ it, w, obb: worldOBB(it.spec, w) });
    }
    const seenNow = new Set();
    for (let i = 0; i < active.length; i++) {
      const A = active[i];
      for (let j = i + 1; j < active.length; j++) {
        const B = active[j];
        if (skipPair(A.it, B.it)) continue;
        const pk = `${A.it.o.name}|${B.it.o.name}`;
        let rs = relState.get(pk);
        if (!rs) {
          rs = {
            firstFrame: f,
            moved: false,
            p0: relPos(A.w, B.w),
            q0: qmul(qconj(A.w.q), B.w.q),
          };
          relState.set(pk, rs);
        } else if (!A.it.card && !B.it.card && !rs.moved) {
          const dp = relPos(A.w, B.w);
          const dq = qmul(qconj(A.w.q), B.w.q);
          const dist = Math.hypot(dp[0] - rs.p0[0], dp[1] - rs.p0[1], dp[2] - rs.p0[2]);
          const qdot = Math.abs(dq[0] * rs.q0[0] + dq[1] * rs.q0[1] + dq[2] * rs.q0[2] + dq[3] * rs.q0[3]);
          if (dist > 0.0015 || 1 - qdot > 1e-4) rs.moved = true;
        }

        const r = satOverlap(A.obb, B.obb, faceTol);
        if (!r || (r.through < pierceTol && r.pen < embedTol)) continue;
        seenNow.add(pk);
        const mode = r.through >= pierceTol ? "through" : "embed";
        const depth = Math.max(r.pen, r.through);
        const cur = open.get(pk);
        if (!cur) {
          open.set(pk, {
            pk, a: A.it.o.name, b: B.it.o.name, groupA: A.it.group, groupB: B.it.group,
            mode, from: t, to: t, peak: t, depth, pen: r.pen, through: r.through,
            card: A.it.card || B.it.card, startedOnFirst: f === rs.firstFrame,
          });
        } else {
          cur.to = t;
          if (mode === "through") cur.mode = "through";
          cur.pen = Math.max(cur.pen, r.pen);
          cur.through = Math.max(cur.through, r.through);
          if (depth > cur.depth) Object.assign(cur, { depth, peak: t });
        }
      }
    }
    for (const [pk, c] of open) {
      if (!seenNow.has(pk)) { raw.push(c); open.delete(pk); }
    }
  }
  raw.push(...open.values());

  return raw
    .filter((c) => {
      const rs = relState.get(c.pk);
      if (!c.card && c.startedOnFirst && rs && !rs.moved) return false;
      if (c.to - c.from < stepDt - 1e-6 && c.depth < 0.025) return false;
      return true;
    })
    .map(({ pk, startedOnFirst, ...rest }) => rest)
    .sort((a, b) => a.from - b.from || b.depth - a.depth);
}

/** Group raw prop/card clashes by unordered object groups within 0.2 s windows. */
export function describeClashes(clashes) {
  const merged = [];
  for (const c of clashes) {
    const pair = [c.groupA, c.groupB].sort();
    const m = merged.find((x) => x.groups[0] === pair[0] && x.groups[1] === pair[1] && c.from <= x.to + 0.2 && c.to >= x.from - 0.2);
    if (m) { m.from = Math.min(m.from, c.from); m.to = Math.max(m.to, c.to); m.list.push(c); }
    else merged.push({ groups: pair, from: c.from, to: c.to, list: [c] });
  }
  return merged
    .map((m) => {
      const worst = m.list.toSorted((a, b) => b.depth - a.depth)[0];
      const mode = m.list.some((x) => x.mode === "through") ? "through" : "embed";
      const verb = mode === "through" ? "passes through" : "intersects";
      return {
        kind: "into",
        mode,
        from: m.from,
        to: m.to,
        peak: worst.peak,
        depth: worst.depth,
        pen: Math.max(...m.list.map((x) => x.pen)),
        through: Math.max(...m.list.map((x) => x.through)),
        groups: m.groups,
        parts: [worst.a, worst.b],
        count: m.list.length,
        text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.groups[0]} ${verb} ${m.groups[1]} (${(worst.depth / MM).toFixed(0)} mm deep, worst at ${worst.peak.toFixed(2)} s)`,
      };
    })
    .sort((a, b) => a.from - b.from || b.depth - a.depth);
}

/**
 * Detect overlapping end-card torn-paper labels (e.g. two slogan strips touching or overlapping in XY).
 * Uses each label's outer rim (falling back to sheet) curve footprint in world space.
 */
export function labelOverlaps(anim, { tol = 0.008, zTol = 0.06, minSecs = 0.25, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const byIdx = new Map();
  for (const o of anim.objects) {
    const m = o.name.match(/^label(\d+)_(rim|sheet)$/);
    if (!m || o.geo?.type !== "curve" || !o.geo.rings?.length) continue;
    const idx = +m[1], kind = m[2];
    if (!byIdx.has(idx) || kind === "rim") byIdx.set(idx, o);
  }
  const labels = [...byIdx.entries()].sort((a, b) => a[0] - b[0]).map(([idx, o]) => {
    const pts = o.geo.rings.flat();
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return {
      idx,
      name: `label${idx}`,
      o,
      corners: [
        [Math.min(...xs), Math.min(...ys), 0],
        [Math.max(...xs), Math.min(...ys), 0],
        [Math.min(...xs), Math.max(...ys), 0],
        [Math.max(...xs), Math.max(...ys), 0],
      ],
    };
  });
  if (labels.length < 2) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const open = new Map(), out = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const active = [];
    for (const lb of labels) {
      const w = worldOf(lb.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      const wp = lb.corners.map((c) => apply(w, c));
      const xs = wp.map((p) => p[0]), ys = wp.map((p) => p[1]), zs = wp.map((p) => p[2]);
      active.push({
        lb,
        x0: Math.min(...xs), x1: Math.max(...xs),
        y0: Math.min(...ys), y1: Math.max(...ys),
        z: zs.reduce((a, b) => a + b, 0) / zs.length,
      });
    }
    const seenNow = new Set();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const A = active[i], B = active[j];
        if (Math.abs(A.z - B.z) > zTol) continue;
        const ovX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const ovY = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (ovX <= tol || ovY <= tol) continue;
        const depth = Math.min(ovX, ovY);
        const pk = `${A.lb.name}|${B.lb.name}`;
        seenNow.add(pk);
        const cur = open.get(pk);
        if (!cur) open.set(pk, { a: A.lb.name, b: B.lb.name, from: t, to: t, peak: t, ovX, ovY, depth });
        else {
          cur.to = t;
          if (depth > cur.depth) Object.assign(cur, { depth, ovX, ovY, peak: t });
        }
      }
    }
    for (const [pk, c] of open) if (!seenNow.has(pk)) { out.push(c); open.delete(pk); }
  }
  out.push(...open.values());
  // Ignore transient 1–2 frame slap-in / backOut scale-pop fly-bys; flag settled overlaps that persist on screen.
  return out.filter((o) => o.to - o.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.depth - a.depth);
}

export function describeLabelOverlaps(overlaps) {
  return overlaps.map((o) => ({
    kind: "into",
    ...o,
    text: `${o.from.toFixed(1)}–${o.to.toFixed(1)} s: ${o.a} overlaps ${o.b} (${(o.depth / MM).toFixed(0)} mm overlap at ${o.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect when the toy or end-card prop is partially cropped by a camera frame edge during settled motion
 * (ignoring fast vertical jump entries/exits and completely off-screen frames).
 */
export function edgeCrops(anim, { aspect = 16 / 9, toy = "hero", margin = 0.025, minSecs = 0.25, every = 2, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const camObj = objects.get("camera");
  const fovs = anim.scalars?.fov;
  if (!camObj || !fovs?.length) return [];

  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const toyProbes = anim.objects
    .filter((o) => o.geo && o.name !== toy && under(o, toy))
    .map((o) => ({ o, pts: probesOf(o.geo, file) }))
    .filter((p) => p.pts.length);

  const ctaFloor = objects.get("cta_floor");
  const ctaCenter = ctaFloor ? unpack(ctaFloor.tr).p : null;
  const propSpecs = ctaCenter
    ? anim.objects
        .filter((o) => o.geo && !under(o, toy) && !o.letter && !o.mat?.outline && !SKIP_NAME.test(o.name)
          && !/^label\d+_/.test(o.name) && o.name !== "crown" && boxSpec(o))
        .map((o) => ({ o, spec: boxSpec(o) }))
    : [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    let w = { p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1] };
    if (o) {
      const local = sampleAt(name, s) ?? unpack(o.tr);
      w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    }
    memo.set(name, w);
    return w;
  };

  const dt = every / anim.fps;
  const prevCenter = new Map();
  const open = new Map();
  const out = [];

  const checkTarget = (name, pts, f, t, camW, tanX, tanY) => {
    if (!pts.length) {
      if (open.has(name)) { out.push(open.get(name)); open.delete(name); }
      prevCenter.delete(name);
      return;
    }
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    const cz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    const prev = prevCenter.get(name);
    prevCenter.set(name, [cx, cy, cz, f]);
    const fastMove = prev && f - prev[3] === every && (Math.abs(cy - prev[1]) / dt > 0.35 || Math.hypot(cx - prev[0], cz - prev[2]) / dt > 1.5);
    if (fastMove) {
      if (open.has(name)) { out.push(open.get(name)); open.delete(name); }
      return;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      const lp = toLocal(camW, p);
      if (lp[2] >= -0.05) {
        if (open.has(name)) { out.push(open.get(name)); open.delete(name); }
        return;
      }
      const nx = lp[0] / (-lp[2] * tanX);
      const ny = lp[1] / (-lp[2] * tanY);
      if (nx < minX) minX = nx; if (nx > maxX) maxX = nx;
      if (ny < minY) minY = ny; if (ny > maxY) maxY = ny;
    }
    // Completely off-screen: not a partial edge crop
    if (maxX < -1 || minX > 1 || maxY < -1 || minY > 1) {
      if (open.has(name)) { out.push(open.get(name)); open.delete(name); }
      return;
    }
    const edges = [];
    let past = 0;
    for (const [edge, v] of [["left", -minX - 1], ["right", maxX - 1], ["bottom", -minY - 1], ["top", maxY - 1]]) {
      if (v > margin) { edges.push(edge); if (v > past) past = v; }
    }
    if (!edges.length) {
      if (open.has(name)) { out.push(open.get(name)); open.delete(name); }
      return;
    }
    const cur = open.get(name);
    if (!cur) open.set(name, { target: name, edges: new Set(edges), from: t, to: t, peak: t, past });
    else {
      cur.to = t;
      for (const e of edges) cur.edges.add(e);
      if (past > cur.past) Object.assign(cur, { past, peak: t });
    }
  };

  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360);
    const tanX = tanY * aspect;

    // 1) hero points
    const heroPts = [];
    for (const { o, pts: local } of toyProbes) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      for (const [lp] of local) heroPts.push(apply(w, lp));
    }
    checkTarget("hero", heroPts, f, t, camW, tanX, tanY);

    // 2) end-card prop corners (only when camera is on the CTA stage, within 5 m of cta_floor)
    if (ctaCenter && Math.hypot(camW.p[0] - ctaCenter[0], camW.p[2] - ctaCenter[2]) < 5) {
      const propPts = [];
      for (const { o, spec } of propSpecs) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
        if (Math.hypot(w.p[0] - ctaCenter[0], w.p[2] - ctaCenter[2]) > 2.5) continue;
        const obb = worldOBB(spec, w);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          propPts.push([
            obb.c[0] + sx * obb.h[0] * obb.axes[0][0] + sy * obb.h[1] * obb.axes[1][0] + sz * obb.h[2] * obb.axes[2][0],
            obb.c[1] + sx * obb.h[0] * obb.axes[0][1] + sy * obb.h[1] * obb.axes[1][1] + sz * obb.h[2] * obb.axes[2][1],
            obb.c[2] + sx * obb.h[0] * obb.axes[0][2] + sy * obb.h[1] * obb.axes[1][2] + sz * obb.h[2] * obb.axes[2][2],
          ]);
        }
      }
      checkTarget("cta_prop", propPts, f, t, camW, tanX, tanY);
    } else if (open.has("cta_prop")) {
      out.push(open.get("cta_prop")); open.delete("cta_prop");
      prevCenter.delete("cta_prop");
    }
  }
  out.push(...open.values());
  return out
    .filter((c) => c.to - c.from >= minSecs - 1e-6)
    .map((c) => ({ ...c, edges: [...c.edges] }))
    .sort((a, b) => a.from - b.from);
}

export function describeEdgeCrops(crops) {
  return crops.map((c) => ({
    kind: "warn",
    ...c,
    text: `${c.from.toFixed(1)}–${c.to.toFixed(1)} s: ${c.target} is cropped at the ${c.edges.join("/")} frame edge (${Math.round(c.past * 50)}% past edge at ${c.peak.toFixed(2)} s)`,
  }));
}

// ── transforms ──
function trackReader(anim) {
  const T = anim.tracks ?? {};
  return (name, s) => {
    const rows = T[name];
    if (!rows?.length) return null;
    if (s <= rows[0][0]) return unpack(rows[0].slice(1));
    if (s >= rows.at(-1)[0]) return unpack(rows.at(-1).slice(1));
    let lo = 0, hi = rows.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m][0] <= s) lo = m; else hi = m; }
    const a = rows[lo], b = rows[hi], u = (s - a[0]) / (b[0] - a[0]);
    return unpack(a.slice(1).map((v, i) => v + (b[i + 1] - v) * u));
  };
}
function unpack(v) {
  const q = v.slice(3, 7), n = Math.hypot(...q) || 1;
  return { p: v.slice(0, 3), q: q.map((x) => x / n), s: v.slice(7, 10) };
}
function rot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
function qmul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
const apply = (w, v) => rot(w.q, v.map((x, i) => x * w.s[i])).map((x, i) => x + w.p[i]);
const compose = (parent, local) => ({ p: apply(parent, local.p), q: qmul(parent.q, local.q), s: parent.s.map((v, i) => v * local.s[i]) });
// a world point into the solid's frame, rotated and moved but not scaled (the depth tests scale the solid instead)
const toLocal = (w, p) => rot([-w.q[0], -w.q[1], -w.q[2], w.q[3]], p.map((v, i) => v - w.p[i]));
