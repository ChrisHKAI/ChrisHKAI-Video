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
// what is not a solid: particles, flat pictures, floor strips/lanes/carpets, the floor, the camera
// (a beat's objects carry its prefix, beat<k>_: its sparks and glows are no more solid than the story's)
const SKIP_NAME = /^(beat\d+_)?(flake|spark|bit|glow|confetti|burst|strip|route|lane|carpet|runway|floor|cta_floor|fx|camera)/;
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
      const t = p.t ?? 0.004;
      if (p.outline?.length) { // a slab of any outline (a logo's pieces): its own bounds, x and z, t thick along y
        const xs = p.outline.map((q) => q[0]), zs = p.outline.map((q) => q[1]);
        return [[Math.min(...xs), -t / 2, Math.min(...zs)], [Math.max(...xs), t / 2, Math.max(...zs)]];
      }
      const hx = (p.w ?? 0.02) / 2, hz = (p.d ?? p.w ?? 0.02) / 2;
      return [[-hx, -t / 2, -hz], [hx, t / 2, hz]];
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
    case "box": case "roundBox": return box(g.size.map((v) => v / 2), 0.8);
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
const SKIP_PROP_MATS = new Set(["flake", "glow", "paper", "bubble"]);

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

/** Bounding-box spec for screen-space framing/occlusion checks, including plate, arc, curve, ellipsoid, tube, and card2d props. */
function propBoundsSpec(o) {
  const b = boxSpec(o);
  if (b) return b;
  const g = o.geo;
  if (!g) return null;
  if (g.type === "plate") {
    const t = g.t ?? 0.004, bev = g.bevel ?? 0;
    if (g.outline?.length) {
      const xs = g.outline.map((q) => q[0]), zs = g.outline.map((q) => q[1]);
      return {
        c: [(Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2],
        h: [(Math.max(...xs) - Math.min(...xs)) / 2 + bev, t / 2 + bev, (Math.max(...zs) - Math.min(...zs)) / 2 + bev],
        card: false,
      };
    }
    return { c: [0, 0, 0], h: [(g.w ?? 0.02) / 2 + bev, t / 2 + bev, (g.d ?? g.w ?? 0.02) / 2 + bev], card: false };
  }
  if (g.type === "arc" && g.radius != null) {
    const tube = Math.abs(g.tube ?? 0.003), r = Math.abs(g.radius) + tube;
    return { c: [0, 0, 0], h: [r, r, tube], card: false };
  }
  if (g.type === "plane" && (o.mat?.type === "card2d" || o.mat?.type === "sticker") && g.w && g.h) {
    return g.flat
      ? { c: [0, 0, 0], h: [g.w / 2, 0.001, g.h / 2], card: true }
      : { c: [0, 0, 0], h: [g.w / 2, g.h / 2, 0.001], card: true };
  }
  if (g.type === "curve" && g.rings?.length) {
    const pts = g.rings.flat();
    if (!pts.length) return null;
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const bev = g.bevel ?? 0, dep = (g.depth ?? 0.004) / 2 + bev;
    return {
      c: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 0],
      h: [(Math.max(...xs) - Math.min(...xs)) / 2 + bev, (Math.max(...ys) - Math.min(...ys)) / 2 + bev, dep],
      card: false,
    };
  }
  if ((g.type === "ellipsoid" || g.type === "blob") && g.r != null) {
    const r = Array.isArray(g.r) ? g.r : [g.r, g.r, g.r];
    return { c: [0, 0, 0], h: [Math.abs(r[0]), Math.abs(r[1] ?? r[0]), Math.abs(r[2] ?? r[0])], card: false };
  }
  if ((g.type === "tube" || g.type === "loop") && g.pts?.length) {
    const rad = Math.max(...(g.radii ?? [0.003]));
    const xs = g.pts.map((q) => q[0]), ys = g.pts.map((q) => q[1]), zs = g.pts.map((q) => q[2]);
    return {
      c: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
      h: [(Math.max(...xs) - Math.min(...xs)) / 2 + rad, (Math.max(...ys) - Math.min(...ys)) / 2 + rad, (Math.max(...zs) - Math.min(...zs)) / 2 + rad],
      card: false,
    };
  }
  return null;
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
          && !/^label\d+_/.test(o.name) && o.name !== "crown" && propBoundsSpec(o))
        .map((o) => ({ o, spec: propBoundsSpec(o) }))
    : [];

  // Custom beat prop groups (e.g. beat1_clap), showcase picture cards (1–5 uiBox cards on a beat), and 3D headline
  // lines (e.g. beat0_rl1): exclude wide backdrops, floor rails/routes/pools, full-bleed walls, and profile-page slabs.
  const SKIP_BEAT_CROP = /^beat\d+_(p_|back$|avatar$|cyc|bg|rail|route|lane|carpet|runway|strip|pool|floor|desk_platform|desk_trim|rostrum|wall|bleed)/;
  const peakScale = (o) => {
    const rows = anim.tracks?.[o.name];
    if (!rows?.length) return Math.max(...unpack(o.tr).s.map(Math.abs));
    return Math.max(...rows.map((r) => Math.max(Math.abs(r[8]), Math.abs(r[9]), Math.abs(r[10]))));
  };
  const beatPropGroups = new Map();
  const beatCardsByBeat = new Map();
  for (const o of anim.objects) {
    if (!/^beat\d+_/.test(o.name) || SKIP_BEAT_CROP.test(o.name) || SKIP_NAME.test(o.name)) continue;
    if (!o.geo || under(o, toy) || o.letter || o.mat?.outline) continue;
    const spec = propBoundsSpec(o);
    if (!spec) continue;
    if (spec.card) {
      const unit = o.geo.unitScale ?? peakScale(o);
      if (unit <= 1e-3 || Math.max(...spec.h) * 2 * unit > 0.95) continue;
      const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
      if (!beatCardsByBeat.has(beat)) beatCardsByBeat.set(beat, []);
      beatCardsByBeat.get(beat).push({ o, spec, unit });
      continue;
    }
    if (Math.max(...spec.h) * 2 > 0.55) continue;
    const grp = groupOf(o.name);
    if (!beatPropGroups.has(grp)) beatPropGroups.set(grp, []);
    beatPropGroups.get(grp).push({ o, spec });
  }
  const beatLineGroups = new Map();
  for (const o of anim.objects) {
    if (!/^beat\d+_/.test(o.name) || !o.letter || o.mat?.outline || o.geo?.type !== "curve" || !o.geo.rings?.length) continue;
    const pts = o.geo.rings.flat();
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const corners = [
      [Math.min(...xs), Math.min(...ys), 0],
      [Math.max(...xs), Math.min(...ys), 0],
      [Math.min(...xs), Math.max(...ys), 0],
      [Math.max(...xs), Math.max(...ys), 0],
    ];
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.step ? `${beat}readout` : (o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, ""));
    if (!beatLineGroups.has(key)) beatLineGroups.set(key, []);
    beatLineGroups.get(key).push({ o, corners });
  }

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
  const beatEdgeMargin = Math.min(margin, 0.008);

  const checkTarget = (name, pts, f, t, camW, tanX, tanY, edgeTol = margin) => {
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
      if (v > edgeTol) { edges.push(edge); if (v > past) past = v; }
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

    // 3) custom beat prop groups & 3D headline lines (within 5 m of active beat camera)
    for (const [grp, parts] of beatPropGroups) {
      const pts = [];
      let maxSpan = 0;
      for (const { o, spec } of parts) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
        if (Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) continue;
        const obb = worldOBB(spec, w);
        maxSpan = Math.max(maxSpan, obb.h[0] * 2, obb.h[1] * 2, obb.h[2] * 2);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          pts.push([
            obb.c[0] + sx * obb.h[0] * obb.axes[0][0] + sy * obb.h[1] * obb.axes[1][0] + sz * obb.h[2] * obb.axes[2][0],
            obb.c[1] + sx * obb.h[0] * obb.axes[0][1] + sy * obb.h[1] * obb.axes[1][1] + sz * obb.h[2] * obb.axes[2][1],
            obb.c[2] + sx * obb.h[0] * obb.axes[0][2] + sy * obb.h[1] * obb.axes[1][2] + sz * obb.h[2] * obb.axes[2][2],
          ]);
        }
      }
      checkTarget(grp, maxSpan <= 0.55 ? pts : [], f, t, camW, tanX, tanY, beatEdgeMargin);
    }
    for (const [, cards] of beatCardsByBeat) {
      const vis = [];
      for (const item of cards) {
        const w = worldOf(item.o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.05 * item.unit || Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) {
          vis.push({ name: item.o.name, pts: [], active: false });
          continue;
        }
        const obb = worldOBB(item.spec, w);
        if (Math.max(obb.h[0] * 2, obb.h[1] * 2, obb.h[2] * 2) > 0.95) {
          vis.push({ name: item.o.name, pts: [], active: false });
          continue;
        }
        const pts = [];
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          pts.push([
            obb.c[0] + sx * obb.h[0] * obb.axes[0][0] + sy * obb.h[1] * obb.axes[1][0] + sz * obb.h[2] * obb.axes[2][0],
            obb.c[1] + sx * obb.h[0] * obb.axes[0][1] + sy * obb.h[1] * obb.axes[1][1] + sz * obb.h[2] * obb.axes[2][1],
            obb.c[2] + sx * obb.h[0] * obb.axes[0][2] + sy * obb.h[1] * obb.axes[1][2] + sz * obb.h[2] * obb.axes[2][2],
          ]);
        }
        vis.push({ name: item.o.name, pts, active: true });
      }
      // 6+ simultaneous picture cards on one beat (layout.wall / corridor / dense grid) are intentional montages
      const montage = vis.filter((x) => x.active).length > 5;
      for (const x of vis) checkTarget(x.name, montage ? [] : x.pts, f, t, camW, tanX, tanY);
    }
    for (const [key, ls] of beatLineGroups) {
      const pts = [];
      for (const { o, corners } of ls) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.3) continue;
        if (Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) continue;
        for (const c of corners) pts.push(apply(w, c));
      }
      checkTarget(key, pts, f, t, camW, tanX, tanY, beatEdgeMargin);
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

/**
 * Detect small 3D extruded lettering (height <= maxH) floating 4–35 mm in front of a solid backing
 * plaque/box, where directional lighting casts offset dark shadows behind every stroke and smears the line.
 * Small lettering on a plaque should be printed flat via kit.picture() or mounted flush (< 3 mm).
 */
export function floatingSmallLetters(anim, { maxH = 0.045, minGap = 0.004, maxGap = 0.035, minSecs = 0.25, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const groups = new Map();
  for (const o of anim.objects) {
    if (!o.letter || o.geo?.type !== "curve" || !o.geo.rings?.length || o.mat?.outline || /^label\d+_/.test(o.name)) continue;
    const pts = o.geo.rings.flat();
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const h = Math.max(...ys) - Math.min(...ys);
    const backZ = (o.geo.depth ?? 0) / 2 + (o.geo.bevel ?? 0);
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ o, cx, cy, h, backZ });
  }
  if (!groups.size) return [];

  const hexLum = (hex) => {
    if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) return 0.5;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Include all non-hero solid boxes so a dark signboard occludes bright trim behind it;
  // only warn when the NEAREST surface behind the line is light/mid (lum > 0.08) and shows double shadows.
  const backings = anim.objects
    .filter((o) => o.geo && !under(o, "hero") && !o.letter && !o.mat?.outline && !SKIP_NAME.test(o.name) && boxSpec(o))
    .map((o) => ({ o, spec: boxSpec(o), lum: hexLum(o.mat?.color) }));
  if (!backings.length) return [];

  const hasCamera = objects.has("camera") && !!anim.tracks?.camera?.length;
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
    const camP = hasCamera ? worldOf("camera", s, memo).p : null;
    const activeBackings = [];
    for (const b of backings) {
      const ws = worldOf(b.o.name, s, memo);
      if (Math.min(...ws.s.map(Math.abs)) < 1e-3) continue;
      if (camP && Math.hypot(ws.p[0] - camP[0], ws.p[1] - camP[1], ws.p[2] - camP[2]) > 45) continue;
      activeBackings.push({ ...b, ws });
    }
    const seenNow = new Set();
    for (const [key, ls] of groups) {
      const vis = [];
      for (const item of ls) {
        const w = worldOf(item.o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
        const hW = item.h * Math.abs(w.s[1]);
        vis.push({ item, w, hW });
      }
      if (!vis.length) continue;
      const hs = vis.map((v) => v.hW).sort((a, b) => a - b);
      const medH = hs[hs.length >> 1];
      if (medH > maxH) continue;

      // Sample center of visible letters + letter backward normal
      const mid = vis[vis.length >> 1];
      const backDir = rot(mid.w.q, [0, 0, -1]);
      const pCenter = vis.reduce((acc, v) => {
        const p = apply(v.w, [v.item.cx, v.item.cy, -v.item.backZ]);
        return [acc[0] + p[0] / vis.length, acc[1] + p[1] / vis.length, acc[2] + p[2] / vis.length];
      }, [0, 0, 0]);

      let nearest = null;
      for (const b of activeBackings) {
        if (Math.hypot(pCenter[0] - b.ws.p[0], pCenter[1] - b.ws.p[1], pCenter[2] - b.ws.p[2]) > 1.5) continue;
        const lp = toLocal(b.ws, pCenter);
        const ld = rot([-b.ws.q[0], -b.ws.q[1], -b.ws.q[2], b.ws.q[3]], backDir);
        const absD = ld.map(Math.abs);
        const ax = absD[0] >= absD[1] && absD[0] >= absD[2] ? 0 : absD[1] >= absD[2] ? 1 : 2;
        if (absD[ax] < 0.7) continue;
        const H = b.spec.h.map((v, i) => v * Math.abs(b.ws.s[i]));
        const C = b.spec.c.map((v, i) => v * Math.abs(b.ws.s[i]));
        const o1 = (ax + 1) % 3, o2 = (ax + 2) % 3;
        if (Math.abs(lp[o1] - C[o1]) > H[o1] || Math.abs(lp[o2] - C[o2]) > H[o2]) continue;
        const gap = ld[ax] < 0 ? (lp[ax] - (C[ax] + H[ax])) / -ld[ax] : ((C[ax] - H[ax]) - lp[ax]) / ld[ax];
        if (gap < -0.005 || gap > maxGap) continue;
        if (!nearest || gap < nearest.gap) nearest = { backing: b.o.name, gap, lum: b.lum };
      }
      const hit = nearest && nearest.gap >= minGap && nearest.lum > 0.08 ? nearest : null;
      if (!hit) continue;
      const pk = `${key}|${hit.backing}`;
      seenNow.add(pk);
      const cur = open.get(pk);
      if (!cur) {
        const idxOf = (o) => o.letterIndex ?? +(o.name.match(/(\d+)$/)?.[1] ?? 0);
        const text = ls.slice().sort((a, b) => idxOf(a.o) - idxOf(b.o)).map((x) => x.o.letter).join("");
        open.set(pk, { name: key, text, backing: hit.backing, from: t, to: t, peak: t, gap: hit.gap, height: medH });
      } else {
        cur.to = t;
        if (hit.gap > cur.gap) Object.assign(cur, { gap: hit.gap, peak: t, height: medH });
      }
    }
    for (const [pk, c] of open) if (!seenNow.has(pk)) { out.push(c); open.delete(pk); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.gap - a.gap);
}

export function describeFloatingLetters(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: small 3D line "${m.text}" (${(m.height / MM).toFixed(0)} mm tall) floats ${(m.gap / MM).toFixed(0)} mm in front of ${m.backing} (casts double shadow)`,
  }));
}

/**
 * Detect stretches where the visible hero toy sits far away from the active camera (> maxDist m),
 * typically caused by writing bare `[x, y, z]` instead of `at(x, y, z)` in a beat's pose(), which
 * teleports the toy back to world origin while the camera films another stage offset.
 */
export function offStageHero(anim, { toy = "hero", maxDist = 5.0, minSecs = 0.2, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  if (!objects.has(toy) || !objects.has("camera") || !anim.tracks?.camera?.length) return [];
  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  let cur = null;
  const out = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const hw = worldOf(toy, s, memo);
    const visible = Math.min(...hw.s.map(Math.abs)) >= 1e-3;
    const cw = worldOf("camera", s, memo);
    const dist = visible ? Math.hypot(hw.p[0] - cw.p[0], hw.p[1] - cw.p[1], hw.p[2] - cw.p[2]) : 0;
    if (visible && dist > maxDist) {
      if (!cur) cur = { from: t, to: t, peak: t, dist };
      else { cur.to = t; if (dist > cur.dist) { cur.dist = dist; cur.peak = t; } }
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6);
}

export function describeOffStageHero(items) {
  return items.map((m) => ({
    kind: "bad",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: the toy is ${m.dist.toFixed(1)} m from the camera (worst at ${m.peak.toFixed(2)} s): likely missing at(...) on o.pos`,
  }));
}

/**
 * Detect custom beat or end-card objects that are visible for >= minSecs yet NEVER come within maxDist m
 * of the active camera across their entire visible lifetime—catching both missing `at(...)` (placed at
 * world origin ~150 m away) and double `at(POS[0], POS[1], POS[2])` (shifted to 2× stage offset ~200 m away).
 */
export function offStageObjects(anim, { maxDist = 8.0, minSecs = 0.2, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  if (!objects.has("camera") || !anim.tracks?.camera?.length) return [];
  const SKIP_OFF = /_(floor|conf\d+|flake\d+|spark\d+|bit\d+)$|^cta_floor$/i;
  const targets = anim.objects.filter((o) => {
    if (!o.geo || (o.parent && o.parent !== "root")) return false;
    if (!/^(beat\d+_|cta_)/.test(o.name) || SKIP_OFF.test(o.name)) return false;
    if (o.mat?.outline) return false;
    if (o.letter && (o.letterIndex ?? 0) > 0) return false;
    return true;
  });
  if (!targets.length) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const stats = new Map();
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const cw = worldOf("camera", s, memo);
    for (const o of targets) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.01) continue;
      const d = Math.hypot(w.p[0] - cw.p[0], w.p[1] - cw.p[1], w.p[2] - cw.p[2]);
      const st = stats.get(o.name);
      if (!st) stats.set(o.name, { name: o.name, from: t, to: t, minDist: d, sampleX: w.p[0], camX: cw.p[0], count: 1 });
      else {
        st.to = t;
        st.count++;
        if (d < st.minDist) { st.minDist = d; st.sampleX = w.p[0]; st.camX = cw.p[0]; }
      }
    }
  }
  const out = [];
  for (const st of stats.values()) {
    if (st.count >= 2 && st.to - st.from >= minSecs - 1e-6 && st.minDist > maxDist) {
      const doubleAt = Math.abs(st.camX) > 50 && Math.abs(st.sampleX) > Math.abs(st.camX) * 1.6;
      out.push({
        name: st.name,
        from: st.from,
        to: st.to,
        dist: st.minDist,
        cause: doubleAt ? "double-at" : "off-stage",
      });
    }
  }
  return out.sort((a, b) => a.from - b.from || b.dist - a.dist);
}

export function describeOffStageObjects(items) {
  return items.map((m) => ({
    kind: "bad",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.name} is visible but stays ${m.dist.toFixed(1)} m from the camera (${m.cause === "double-at" ? "likely called at(...) twice on a point already in world space" : "likely missing at(...) on its position"})`,
  }));
}

/**
 * Detect two distinct 3D lettering lines overlapping in XY at the same depth (e.g. a headline fading out too
 * late while the next headline pops onto the same coordinates).
 */
export function lineOverlaps(anim, { tol = 0.008, zTol = 0.08, minSecs = 0.15, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const groups = new Map();
  for (const o of anim.objects) {
    if (!o.letter || o.pop || o.mat?.outline || /^label\d+_/.test(o.name) || o.geo?.type !== "curve" || !o.geo.rings?.length) continue;
    const pts = o.geo.rings.flat();
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const corners = [
      [Math.min(...xs), Math.min(...ys), 0],
      [Math.max(...xs), Math.min(...ys), 0],
      [Math.min(...xs), Math.max(...ys), 0],
      [Math.max(...xs), Math.max(...ys), 0],
    ];
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.step ? `${beat}_readout` : (o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, ""));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ o, corners });
  }
  if (groups.size < 2) return [];

  const hasCamera = objects.has("camera") && !!anim.tracks?.camera?.length;
  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const idxOf = (o) => o.letterIndex ?? +(o.name.match(/(\d+)$/)?.[1] ?? 0);
  const open = new Map(), out = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camP = hasCamera ? worldOf("camera", s, memo).p : null;
    const active = [];
    for (const [key, ls] of groups) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zSum = 0, zN = 0;
      const chars = [];
      for (const item of ls) {
        const w = worldOf(item.o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.2) continue;
        if (camP && Math.hypot(w.p[0] - camP[0], w.p[1] - camP[1], w.p[2] - camP[2]) > 45) continue;
        for (const c of item.corners) {
          const wp = apply(w, c);
          if (wp[0] < x0) x0 = wp[0];
          if (wp[0] > x1) x1 = wp[0];
          if (wp[1] < y0) y0 = wp[1];
          if (wp[1] > y1) y1 = wp[1];
          zSum += wp[2];
          zN++;
        }
        chars.push(item.o);
      }
      if (!zN) continue;
      const text = chars.sort((a, b) => idxOf(a) - idxOf(b)).map((o) => o.letter).join("");
      active.push({ key, text, x0, x1, y0, y1, h: y1 - y0, z: zSum / zN });
    }
    const seenNow = new Set();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const A = active[i], B = active[j];
        if (Math.abs(A.z - B.z) > zTol) continue;
        const ovX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const ovY = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        const minH = Math.max(1e-4, Math.min(A.h, B.h));
        if (ovX <= tol || ovY <= tol || ovY < 0.25 * minH) continue;
        const depth = Math.min(ovX, ovY);
        const pk = [A.key, B.key].sort().join("|");
        seenNow.add(pk);
        const cur = open.get(pk);
        if (!cur) open.set(pk, { a: A.key, b: B.key, textA: A.text, textB: B.text, from: t, to: t, peak: t, depth });
        else {
          cur.to = t;
          if (depth > cur.depth) Object.assign(cur, { depth, peak: t, textA: A.text, textB: B.text });
        }
      }
    }
    for (const [pk, c] of open) if (!seenNow.has(pk)) { out.push(c); open.delete(pk); }
  }
  out.push(...open.values());
  return out.filter((o) => o.to - o.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.depth - a.depth);
}

export function describeLineOverlaps(items) {
  return items.map((m) => ({
    kind: "bad",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: 3D lines "${m.textA}" (${m.a}) and "${m.textB}" (${m.b}) overlap on screen (${(m.depth / MM).toFixed(0)} mm overlap at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect uiBox picture cards placed with raw `trs(...)` instead of `pic.at(...)`, which omits the
 * pixel-to-metre scale factor (`unitScale`) and UPRIGHT turn, inflating cards and laying them flat.
 */
export function oversizedUiBoxes(anim, { maxSpan = 2.5, every = 4 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const cards = anim.objects.filter((o) => o.geo?.type === "uiBox" && Array.isArray(o.geo.rect) && o.geo.rect.length >= 4);
  if (!cards.length) return [];
  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  const found = new Map();
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    for (const o of cards) {
      const w = worldOf(o.name, s, memo);
      const minS = Math.min(...w.s.map(Math.abs));
      if (minS < 0.02) continue;
      const span = Math.max(Math.abs(o.geo.rect[2] * MM * w.s[0]), Math.abs(o.geo.rect[3] * MM * w.s[1]));
      const uScale = o.geo.unitScale;
      const missedUnitScale = Number.isFinite(uScale) && uScale < 0.65 && Math.abs(w.s[0]) > uScale * 2.2 && span > 0.35;
      if (span <= maxSpan && !missedUnitScale) continue;
      const cur = found.get(o.name);
      if (!cur) found.set(o.name, { name: o.name, from: t, to: t, span });
      else { cur.to = t; if (span > cur.span) cur.span = span; }
    }
  }
  return [...found.values()].sort((a, b) => a.from - b.from || b.span - a.span);
}

export function describeOversizedUiBoxes(items) {
  return items.map((m) => ({
    kind: "bad",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.name} is ${m.span.toFixed(1)} m wide (likely placed with trs(...) instead of pic.at(...))`,
  }));
}

/**
 * Detect video picture cards (`mat.movie` with `cyclic !== false`) whose frame count runs out while the card
 * is still visible in front of the active camera, causing Blender's cyclic playback to snap back to frame 1.
 */
export function movieWraps(anim) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const vids = anim.objects.filter((o) => o.mat?.movie && Number.isFinite(o.mat?.frames) && o.mat.frames > 0 && o.mat.cyclic !== false);
  if (!vids.length) return [];
  const hasCamera = objects.has("camera") && !!anim.tracks?.camera?.length;
  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  const out = [];
  for (const o of vids) {
    const start = o.mat.start ?? 1, dur = o.mat.frames, wrapFrame = start + dur;
    let spanStart = null, spanEnd = null;
    const flush = () => {
      if (spanStart === null) return;
      const len = spanEnd - spanStart + 1;
      const intentionalShortLoop = dur <= 45 && len >= dur * 2;
      if (!intentionalShortLoop && spanStart < wrapFrame && spanEnd >= wrapFrame + 2) {
        out.push({
          name: o.name,
          movie: o.mat.movie,
          frames: dur,
          start,
          wrapFrame,
          wrapAt: (wrapFrame - 1) / anim.fps,
          to: spanEnd / anim.fps,
        });
      }
      spanStart = spanEnd = null;
    };
    for (let f = 0; f < anim.frames; f++) {
      const s = f * SUB, bf = f + 1, memo = new Map();
      const w = worldOf(o.name, s, memo);
      const camP = hasCamera ? worldOf("camera", s, memo).p : null;
      const vis = Math.min(...w.s.map(Math.abs)) >= 0.01 && (!camP || Math.hypot(w.p[0] - camP[0], w.p[1] - camP[1], w.p[2] - camP[2]) <= 45);
      if (vis) {
        if (spanStart === null) spanStart = bf;
        spanEnd = bf;
      } else flush();
    }
    flush();
  }
  return out.sort((a, b) => a.wrapAt - b.wrapAt);
}

export function describeMovieWraps(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.name} ("${m.movie}", ${m.frames} frames from frame ${m.start}) wraps back to frame 1 at ${m.wrapAt.toFixed(2)} s while still visible until ${m.to.toFixed(2)} s`,
  }));
}

/**
 * Detect when one visible uiBox picture card occludes >= minShare of another picture card in 2D camera screen space
 * for >= minSecs, even when separated in Z depth so 3D solidClashes reports zero physical intersection.
 */
export function cardScreenOverlaps(anim, { aspect = 16 / 9, minShare = 0.45, minSecs = 0.6, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !fovs?.length) return [];
  const SKIP_CARD_SCREEN = /^(beat\d+_)?(p_|back$|cyc|bg|floor)/;
  const cards = anim.objects
    .filter((o) => o.geo?.type === "uiBox" && !SKIP_CARD_SCREEN.test(o.name) && !SKIP_NAME.test(o.name) && boxSpec(o))
    .map((o) => ({ o, spec: boxSpec(o), group: groupOf(o.name) }));
  if (cards.length < 2) return [];

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
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;
    const proj = [];
    for (const c of cards) {
      const w = worldOf(c.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      if (Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 8) continue;
      const obb = worldOBB(c.spec, w);
      if (Math.max(obb.h[0], obb.h[1], obb.h[2]) * 2 > 0.9) continue;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, depthSum = 0, ok = true;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const wp = [
          obb.c[0] + sx * obb.h[0] * obb.axes[0][0] + sy * obb.h[1] * obb.axes[1][0] + sz * obb.h[2] * obb.axes[2][0],
          obb.c[1] + sx * obb.h[0] * obb.axes[0][1] + sy * obb.h[1] * obb.axes[1][1] + sz * obb.h[2] * obb.axes[2][1],
          obb.c[2] + sx * obb.h[0] * obb.axes[0][2] + sy * obb.h[1] * obb.axes[1][2] + sz * obb.h[2] * obb.axes[2][2],
        ];
        const lp = toLocal(camW, wp);
        if (lp[2] >= -0.05) { ok = false; break; }
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
        if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
        depthSum += -lp[2];
      }
      if (!ok || x1 <= -1 || x0 >= 1 || y1 <= -1 || y0 >= 1) continue;
      const area = Math.max(1e-6, (x1 - x0) * (y1 - y0));
      proj.push({ c, x0, x1, y0, y1, area, depth: depthSum / 8 });
    }
    const seenNow = new Set();
    for (let i = 0; i < proj.length; i++) {
      for (let j = i + 1; j < proj.length; j++) {
        const A = proj[i], B = proj[j];
        if (A.c.group === B.c.group) continue;
        const ix = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
        const iy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        if (ix <= 0 || iy <= 0) continue;
        const share = (ix * iy) / Math.min(A.area, B.area);
        if (share < minShare) continue;
        const [front, back] = A.depth <= B.depth ? [A, B] : [B, A];
        const pk = [A.c.o.name, B.c.o.name].sort().join("|");
        seenNow.add(pk);
        const cur = open.get(pk);
        if (!cur) open.set(pk, { front: front.c.o.name, back: back.c.o.name, from: t, to: t, peak: t, share });
        else {
          cur.to = t;
          if (share > cur.share) Object.assign(cur, { front: front.c.o.name, back: back.c.o.name, share, peak: t });
        }
      }
    }
    for (const [pk, cur] of open) if (!seenNow.has(pk)) { out.push(cur); open.delete(pk); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.share - a.share);
}

export function describeCardScreenOverlaps(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.front} covers ${Math.round(m.share * 100)}% of ${m.back} on camera (worst at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect foreground props/cards passing between the active camera and the toy's head (`hero_head*` or upper toy bounds),
 * catching props that block the character's face/eyes on screen without physically colliding in 3D.
 */
export function heroFaceOcclusions(anim, { aspect = 16 / 9, toy = "hero", minShare = 0.28, minSecs = 0.10, every = 1, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has(toy) || !objects.has("camera") || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const headRoot = objects.has(`${toy}_head`) ? `${toy}_head` : toy;
  const headProbes = anim.objects
    .filter((o) => o.geo && o.name !== toy && under(o, headRoot))
    .map((o) => ({ o, pts: probesOf(o.geo, file) }))
    .filter((p) => p.pts.length);
  if (!headProbes.length) return [];

  const SKIP_FACE_PROP = /^(beat\d+_)?(p_|back$|avatar$|banner|cyc|bg|rail|pool|floor)|^(panel_|piece|wall|label\d+_)/;
  const peakScale = (o) => {
    const rows = anim.tracks?.[o.name];
    if (!rows?.length) return Math.max(...unpack(o.tr).s.map(Math.abs));
    return Math.max(...rows.map((r) => Math.max(Math.abs(r[8]), Math.abs(r[9]), Math.abs(r[10]))));
  };
  const fgGroups = new Map();
  for (const o of anim.objects) {
    if (!o.geo || under(o, toy) || o.letter || o.mat?.outline || SKIP_NAME.test(o.name) || SKIP_FACE_PROP.test(o.name)) continue;
    if (o.mat?.type === "flake" || o.mat?.type === "glow") continue;
    const spec = propBoundsSpec(o);
    if (!spec) continue;
    const unit = spec.card ? (o.geo.unitScale ?? peakScale(o)) : 1;
    if (unit <= 1e-3 || Math.max(...spec.h) * 2 * unit > 0.65) continue;
    const grp = spec.card ? o.name : groupOf(o.name);
    if (!fgGroups.has(grp)) fgGroups.set(grp, []);
    fgGroups.get(grp).push({ o, spec, unit });
  }
  if (!fgGroups.size) return [];

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
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;

    let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hDepth = 0, hn = 0;
    for (const { o, pts } of headProbes) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      for (const [lp0] of pts) {
        const lp = toLocal(camW, apply(w, lp0));
        if (lp[2] >= -0.05) continue;
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        if (nx < hx0) hx0 = nx; if (nx > hx1) hx1 = nx;
        if (ny < hy0) hy0 = ny; if (ny > hy1) hy1 = ny;
        hDepth += -lp[2];
        hn++;
      }
    }
    if (!hn || hx1 <= -1 || hx0 >= 1 || hy1 <= -1 || hy0 >= 1) {
      for (const [k, c] of open) { out.push(c); open.delete(k); }
      continue;
    }
    if (headRoot === toy) hy0 = hy0 + (hy1 - hy0) * 0.55;
    const hArea = Math.max(1e-6, (hx1 - hx0) * (hy1 - hy0));
    const meanHDepth = hDepth / hn;

    const seenNow = new Set();
    for (const [grp, parts] of fgGroups) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, pDepth = 0, pn = 0;
      for (const { o, spec, unit } of parts) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.05 * unit) continue;
        if (Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) continue;
        const obb = worldOBB(spec, w);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
          const wp = [
            obb.c[0] + sx * obb.h[0] * obb.axes[0][0] + sy * obb.h[1] * obb.axes[1][0] + sz * obb.h[2] * obb.axes[2][0],
            obb.c[1] + sx * obb.h[0] * obb.axes[0][1] + sy * obb.h[1] * obb.axes[1][1] + sz * obb.h[2] * obb.axes[2][1],
            obb.c[2] + sx * obb.h[0] * obb.axes[0][2] + sy * obb.h[1] * obb.axes[1][2] + sz * obb.h[2] * obb.axes[2][2],
          ];
          const lp = toLocal(camW, wp);
          if (lp[2] >= -0.05) continue;
          const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
          if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
          if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
          pDepth += -lp[2];
          pn++;
        }
      }
      if (!pn || pDepth / pn >= meanHDepth - 0.015) continue;
      const ix = Math.min(hx1, x1) - Math.max(hx0, x0);
      const iy = Math.min(hy1, y1) - Math.max(hy0, y0);
      if (ix <= 0 || iy <= 0) continue;
      const share = (ix * iy) / hArea;
      if (share < minShare) continue;
      seenNow.add(grp);
      const cur = open.get(grp);
      if (!cur) open.set(grp, { prop: grp, from: t, to: t, peak: t, share });
      else {
        cur.to = t;
        if (share > cur.share) Object.assign(cur, { share, peak: t });
      }
    }
    for (const [grp, cur] of open) if (!seenNow.has(grp)) { out.push(cur); open.delete(grp); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.share - a.share);
}

export function describeHeroFaceOcclusions(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.prop} crosses in front of the toy's face (${Math.round(m.share * 100)}% of head covered at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect confetti/flake bursts shooting across active 3D lettering lines or numeric readouts in camera space,
 * which breaks phone-size OCR and muddies key numbers on downbeat locks.
 */
export function confettiOverText(anim, { aspect = 16 / 9, minFlakes = 3, minDensity = 0.75, minSecs = 0.30, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !fovs?.length) return [];
  const flakes = anim.objects.filter((o) => o.mat?.type === "flake" || /(^|_)conf\d+$/.test(o.name));
  if (flakes.length < minFlakes) return [];

  const lineGroups = new Map();
  for (const o of anim.objects) {
    if (!o.letter || o.pop || o.mat?.outline || /^label\d+_/.test(o.name) || o.geo?.type !== "curve" || !o.geo.rings?.length) continue;
    const pts = o.geo.rings.flat();
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const corners = [
      [Math.min(...xs), Math.min(...ys), 0],
      [Math.max(...xs), Math.min(...ys), 0],
      [Math.min(...xs), Math.max(...ys), 0],
      [Math.max(...xs), Math.max(...ys), 0],
    ];
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.step ? `${beat}readout` : (o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, ""));
    if (!lineGroups.has(key)) lineGroups.set(key, []);
    lineGroups.get(key).push({ o, corners });
  }
  if (!lineGroups.size) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  const idxOf = (o) => o.letterIndex ?? +(o.name.match(/(\d+)$/)?.[1] ?? 0);
  const open = new Map(), out = [];

  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;

    const flakePts = [];
    for (const fl of flakes) {
      const w = worldOf(fl.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      const lp = toLocal(camW, w.p);
      if (lp[2] >= -0.05 || -lp[2] > 8) continue;
      const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
      if (nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1) flakePts.push([nx, ny, -lp[2]]);
    }
    if (flakePts.length < minFlakes) {
      for (const [k, c] of open) { out.push(c); open.delete(k); }
      continue;
    }

    const seenNow = new Set();
    for (const [key, ls] of lineGroups) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, dSum = 0, dn = 0;
      const chars = [];
      for (const { o, corners } of ls) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.3) continue;
        let vis = false;
        for (const c of corners) {
          const lp = toLocal(camW, apply(w, c));
          if (lp[2] >= -0.05 || -lp[2] > 8) continue;
          const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
          if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
          if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
          dSum += -lp[2]; dn++; vis = true;
        }
        if (vis) chars.push(o);
      }
      if (!dn) continue;
      const lineDepth = dSum / dn;
      const hits = flakePts.filter(([fx, fy, fd]) => fx >= x0 && fx <= x1 && fy >= y0 && fy <= y1 && fd <= lineDepth + 0.12).length;
      if (hits < Math.max(minFlakes, Math.ceil(chars.length * minDensity))) continue;
      seenNow.add(key);
      const text = chars.sort((a, b) => idxOf(a) - idxOf(b)).map((o) => o.letter).join("");
      const cur = open.get(key);
      if (!cur) open.set(key, { line: key, text, from: t, to: t, peak: t, flakes: hits });
      else {
        cur.to = t;
        if (hits > cur.flakes) Object.assign(cur, { flakes: hits, peak: t, text });
      }
    }
    for (const [k, c] of open) if (!seenNow.has(k)) { out.push(c); open.delete(k); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.flakes - a.flakes);
}

export function describeConfettiOverText(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: confetti crosses 3D lettering "${m.text}" (${m.line}, ${m.flakes} flakes over text at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect custom-beat 3D lettering lines (`kit.declareLine` / `kit.readout`) that project in 2D camera space
 * directly across the visible hero toy (e.g. bright sandals/legs) or a custom-beat showcase picture card behind
 * them, which fuses character strokes with background edges and drops phone-size OCR confidence.
 */
export function lineBackdropClashes(anim, { aspect = 16 / 9, toy = "hero", minShare = 0.30, minSecs = 0.40, every = 2, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };

  const lineGroups = new Map();
  for (const o of anim.objects) {
    if (!/^beat\d+_/.test(o.name) || !o.letter || o.pop || o.mat?.outline || o.geo?.type !== "curve" || !o.geo.rings?.length) continue;
    const pts = o.geo.rings.flat();
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const corners = [
      [Math.min(...xs), Math.min(...ys), 0],
      [Math.max(...xs), Math.min(...ys), 0],
      [Math.min(...xs), Math.max(...ys), 0],
      [Math.max(...xs), Math.max(...ys), 0],
    ];
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.step ? `${beat}readout` : (o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, ""));
    if (!lineGroups.has(key)) lineGroups.set(key, []);
    lineGroups.get(key).push({ o, corners });
  }
  if (!lineGroups.size) return [];

  const heroProbes = objects.has(toy)
    ? anim.objects.filter((o) => o.geo && o.name !== toy && under(o, toy)).map((o) => ({ o, pts: probesOf(o.geo, file) })).filter((p) => p.pts.length)
    : [];
  const SKIP_CARD = /^beat\d+_(p_|back$|avatar$|cyc|bg|floor)/;
  const cardTargets = anim.objects
    .filter((o) => /^beat\d+_/.test(o.name) && !SKIP_CARD.test(o.name) && o.geo?.type === "uiBox" && Array.isArray(o.geo.rect) && o.geo.rect.length >= 4)
    .map((o) => ({ o, spec: boxSpec(o) }))
    .filter((x) => x.spec);
  if (!heroProbes.length && !cardTargets.length) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  const idxOf = (o) => o.letterIndex ?? +(o.name.match(/(\d+)$/)?.[1] ?? 0);
  const open = new Map(), out = [];

  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;

    const backdrops = [];
    if (heroProbes.length) {
      let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hDepth = 0, hn = 0;
      for (const { o, pts } of heroProbes) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
        for (const [lp0] of pts) {
          const lp = toLocal(camW, apply(w, lp0));
          if (lp[2] >= -0.05 || -lp[2] > 8) continue;
          const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
          if (nx < hx0) hx0 = nx; if (nx > hx1) hx1 = nx;
          if (ny < hy0) hy0 = ny; if (ny > hy1) hy1 = ny;
          hDepth += -lp[2]; hn++;
        }
      }
      if (hn && hx1 > -1 && hx0 < 1 && hy1 > -1 && hy0 < 1) backdrops.push({ name: toy, x0: hx0, x1: hx1, y0: hy0, y1: hy1, depth: hDepth / hn });
    }
    for (const { o, spec } of cardTargets) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      let cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity, cDepth = 0, cn = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const lp = toLocal(camW, apply(w, [spec.c[0] + sx * spec.h[0], spec.c[1] + sy * spec.h[1], spec.c[2] + sz * spec.h[2]]));
        if (lp[2] >= -0.05 || -lp[2] > 8) continue;
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        if (nx < cx0) cx0 = nx; if (nx > cx1) cx1 = nx;
        if (ny < cy0) cy0 = ny; if (ny > cy1) cy1 = ny;
        cDepth += -lp[2]; cn++;
      }
      if (cn && cx1 > -1 && cx0 < 1 && cy1 > -1 && cy0 < 1) backdrops.push({ name: o.name, x0: cx0, x1: cx1, y0: cy0, y1: cy1, depth: cDepth / cn });
    }
    if (!backdrops.length) {
      for (const [k, c] of open) { out.push(c); open.delete(k); }
      continue;
    }

    const seenNow = new Set();
    for (const [key, ls] of lineGroups) {
      const charBoxes = [];
      let dSum = 0;
      for (const { o, corners } of ls) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.35) continue;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, cd = 0, cn = 0;
        for (const c of corners) {
          const lp = toLocal(camW, apply(w, c));
          if (lp[2] >= -0.05 || -lp[2] > 8) continue;
          const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
          if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
          if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
          cd += -lp[2]; cn++;
        }
        if (cn === 4 && x1 > x0 && y1 > y0) {
          charBoxes.push({ o, x0, x1, y0, y1 });
          dSum += cd / cn;
        }
      }
      if (!charBoxes.length) continue;
      const lineDepth = dSum / charBoxes.length;
      const text = charBoxes.slice().sort((a, b) => idxOf(a.o) - idxOf(b.o)).map((x) => x.o.letter).join("");

      for (const bd of backdrops) {
        if (lineDepth > bd.depth + 0.04) continue;
        let worstShare = 0, hitChars = 0;
        for (const cb of charBoxes) {
          const ovX = Math.min(cb.x1, bd.x1) - Math.max(cb.x0, bd.x0);
          const ovY = Math.min(cb.y1, bd.y1) - Math.max(cb.y0, bd.y0);
          if (ovX <= 0 || ovY <= 0) continue;
          const wFrac = ovX / Math.max(1e-5, cb.x1 - cb.x0);
          const hFrac = ovY / Math.max(1e-5, cb.y1 - cb.y0);
          if (wFrac >= 0.45 && hFrac >= minShare) {
            hitChars++;
            if (hFrac > worstShare) worstShare = hFrac;
          }
        }
        if (!hitChars) continue;
        const pk = `${key}|${bd.name}`;
        seenNow.add(pk);
        const cur = open.get(pk);
        if (!cur) open.set(pk, { line: key, text, backdrop: bd.name, from: t, to: t, peak: t, share: worstShare, chars: hitChars });
        else {
          cur.to = t;
          if (worstShare > cur.share) Object.assign(cur, { share: worstShare, peak: t, text, chars: hitChars });
        }
      }
    }
    for (const [pk, c] of open) if (!seenNow.has(pk)) { out.push(c); open.delete(pk); }
  }
  out.push(...open.values());
  const toyMinSecs = Math.min(minSecs, 0.16);
  return out
    .filter((c) => c.to - c.from >= (c.backdrop === toy ? toyMinSecs : minSecs) - 1e-6)
    .sort((a, b) => a.from - b.from || b.share - a.share);
}

export function describeLineBackdropClashes(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: 3D lettering "${m.text}" (${m.line}) crosses over ${m.backdrop} on camera (${Math.round(m.share * 100)}% of letter height at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect foreground custom-beat picture cards (`uiBox`) or 3D prop groups (`curve`, `roundBox`, `ellipsoid`, `tube`)
 * placed between the camera and the standing toy that slice off >= 25% of the toy's visible body/legs for >= 0.40 s
 * (which `heroFaceOcclusions` misses when the prop stays below the chin). Lift the prop above the toy's hands or
 * mount plaques lower on the pedestal step so the full vinyl figure reads cleanly.
 */
export function propCoversToyBody(anim, { aspect = 16 / 9, toy = "hero", minHeightShare = 0.25, minWidthShare = 0.40, minSecs = 0.40, every = 2, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !objects.has(toy) || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };

  const heroProbes = anim.objects
    .filter((o) => o.geo && o.name !== toy && under(o, toy))
    .map((o) => ({ o, pts: probesOf(o.geo, file) }))
    .filter((p) => p.pts.length);
  if (!heroProbes.length) return [];

  const SKIP_FG = /^(?:beat\d+_)?(p_|back$|avatar$|cyc|bg|floor|desk|pad|stage|rostrum|plinth|wall|bleed)/;
  const BUILTIN_SCENE_OBJ = /^(panel_|strip_|glow_|stat_|wall|piece|sticker2d$|flake_|spark_|bit_|label\d+_|crown$|cta_floor$|floor$|blob$|plinth_|snail_|logo$)/;
  const isFgCandidate = (name) => !BUILTIN_SCENE_OBJ.test(name) && !SKIP_FG.test(name) && !SKIP_NAME.test(name);
  const fgCards = anim.objects
    .filter((o) => isFgCandidate(o.name) && o.geo?.type === "uiBox" && Array.isArray(o.geo.rect) && o.geo.rect.length >= 4)
    .map((o) => ({ o, spec: boxSpec(o) }))
    .filter((x) => x.spec);

  const fgPropGroups = new Map();
  for (const o of anim.objects) {
    if (!isFgCandidate(o.name)) continue;
    if (!o.geo || o.geo.type === "uiBox" || under(o, toy) || o.letter || o.mat?.outline) continue;
    const spec = propBoundsSpec(o);
    if (!spec || Math.max(...spec.h) * 2 > 0.55) continue;
    const grp = groupOf(o.name);
    if (!fgPropGroups.has(grp)) fgPropGroups.set(grp, []);
    fgPropGroups.get(grp).push({ o, spec });
  }
  if (!fgCards.length && !fgPropGroups.size) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  // 2D Andrew monotone-chain convex hull & point-in-convex-polygon for exact angled-prop screen coverage
  const hull2D = (pts) => {
    if (pts.length <= 2) return pts;
    const sorted = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of sorted) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
      lo.push(p);
    }
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop();
      hi.push(p);
    }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  };
  const inHull = (poly, x, y) => {
    if (poly.length < 3) return false;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false;
    }
    return true;
  };

  const COLS = 5, ROWS = 10;
  const open = new Map(), out = [];
  const evalGroupPolys = (name, polys, maxY, hx0, hW, hy0, hH, t, seenNow) => {
    if (!polys.length || maxY <= hy0 + 0.16 * hH) return;
    const by0 = hy0, by1 = hy0 + hH;
    let hits = 0, colsHit = 0;
    for (let c = 0; c < COLS; c++) {
      const sx = hx0 + ((c + 0.5) / COLS) * hW;
      let colAny = false;
      for (let r = 0; r < ROWS; r++) {
        const sy = by0 + ((r + 0.5) / ROWS) * (by1 - by0);
        if (polys.some((poly) => sx >= poly.x0 && sx <= poly.x1 && sy >= poly.y0 && sy <= poly.y1 && inHull(poly.pts, sx, sy))) {
          hits++;
          colAny = true;
        }
      }
      if (colAny) colsHit++;
    }
    const wShare = colsHit / COLS;
    const bodyShare = hits / (COLS * ROWS);
    if (wShare < minWidthShare || bodyShare < minHeightShare) return;
    seenNow.add(name);
    const cur = open.get(name);
    if (!cur) open.set(name, { card: name, from: t, to: t, peak: t, share: bodyShare });
    else {
      cur.to = t;
      if (bodyShare > cur.share) Object.assign(cur, { share: bodyShare, peak: t });
    }
  };

  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;

    let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hDepth = 0, hn = 0;
    for (const { o, pts } of heroProbes) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      for (const [lp0] of pts) {
        const lp = toLocal(camW, apply(w, lp0));
        if (lp[2] >= -0.05 || -lp[2] > 6) continue;
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        if (nx < hx0) hx0 = nx; if (nx > hx1) hx1 = nx;
        if (ny < hy0) hy0 = ny; if (ny > hy1) hy1 = ny;
        hDepth += -lp[2]; hn++;
      }
    }
    if (!hn || hx1 <= hx0 || hy1 <= hy0 || hx1 < -1 || hx0 > 1 || hy1 < -1 || hy0 > 1) {
      for (const [k, c] of open) { out.push(c); open.delete(k); }
      continue;
    }
    const meanHDepth = hDepth / hn;
    const hW = Math.max(1e-5, hx1 - hx0), hH = Math.max(1e-5, hy1 - hy0);

    const projectOBB = (obb) => {
      const raw = [];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, dSum = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const wp = [
          obb.c[0] + sx * obb.h[0] * obb.axes[0][0] + sy * obb.h[1] * obb.axes[1][0] + sz * obb.h[2] * obb.axes[2][0],
          obb.c[1] + sx * obb.h[0] * obb.axes[0][1] + sy * obb.h[1] * obb.axes[1][1] + sz * obb.h[2] * obb.axes[2][1],
          obb.c[2] + sx * obb.h[0] * obb.axes[0][2] + sy * obb.h[1] * obb.axes[1][2] + sz * obb.h[2] * obb.axes[2][2],
        ];
        const lp = toLocal(camW, wp);
        if (lp[2] >= -0.05 || -lp[2] > 6) return null;
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        raw.push([nx, ny]);
        if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
        if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
        dSum += -lp[2];
      }
      if (dSum / 8 >= meanHDepth - 0.025) return null;
      return { pts: hull2D(raw), x0, x1, y0, y1 };
    };

    const seenNow = new Set();
    for (const { o, spec } of fgCards) {
      const w = worldOf(o.name, s, memo);
      const unit = o.geo.unitScale ?? 1;
      if (Math.min(...w.s.map(Math.abs)) < 0.05 * unit) continue;
      const poly = projectOBB(worldOBB(spec, w));
      if (!poly) continue;
      evalGroupPolys(o.name, [poly], poly.y1, hx0, hW, hy0, hH, t, seenNow);
    }
    for (const [grp, parts] of fgPropGroups) {
      const polys = [];
      let maxY = -Infinity, maxSpan = 0;
      for (const { o, spec } of parts) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
        const obb = worldOBB(spec, w);
        maxSpan = Math.max(maxSpan, obb.h[0] * 2, obb.h[1] * 2, obb.h[2] * 2);
        const poly = projectOBB(obb);
        if (poly) { polys.push(poly); if (poly.y1 > maxY) maxY = poly.y1; }
      }
      if (!polys.length || maxSpan > 0.55) continue;
      evalGroupPolys(grp, polys, maxY, hx0, hW, hy0, hH, t, seenNow);
    }
    for (const [k, c] of open) if (!seenNow.has(k)) { out.push(c); open.delete(k); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.share - a.share);
}

export function describePropCoversToyBody(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: foreground prop ${m.card} cuts across ${Math.round(m.share * 100)}% of the toy's standing body (worst at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect fast vertical sky-drops/leaps (`kit.dropIn` / `kit.leapOut`, >= 0.08 s) where the airborne toy streaks in
 * front of an active custom-beat 3D headline or numeric readout (too brief for `lineBackdropClashes` 0.40 s window,
 * yet visibly smears falling limbs over top banners). Prefer floor-level `kit.strideIn` / `kit.strideOut`.
 */
export function heroStreaksOverText(anim, { aspect = 16 / 9, toy = "hero", minShare = 0.35, minSecs = 0.06, every = 1, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !objects.has(toy) || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };

  const heroProbes = anim.objects
    .filter((o) => o.geo && o.name !== toy && under(o, toy))
    .map((o) => ({ o, pts: probesOf(o.geo, file) }))
    .filter((p) => p.pts.length);
  if (!heroProbes.length) return [];

  const lineGroups = new Map();
  for (const o of anim.objects) {
    if (!/^beat\d+_/.test(o.name) || !o.letter || o.pop || o.mat?.outline || o.geo?.type !== "curve" || !o.geo.rings?.length) continue;
    const pts = o.geo.rings.flat();
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const corners = [
      [Math.min(...xs), Math.min(...ys), 0],
      [Math.max(...xs), Math.min(...ys), 0],
      [Math.min(...xs), Math.max(...ys), 0],
      [Math.max(...xs), Math.max(...ys), 0],
    ];
    const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
    const key = o.step ? `${beat}readout` : (o.line ? `${beat}${o.line}` : o.name.replace(/\d+$/, ""));
    if (!lineGroups.has(key)) lineGroups.set(key, []);
    lineGroups.get(key).push({ o, corners });
  }
  if (!lineGroups.size) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };
  const idxOf = (o) => o.letterIndex ?? +(o.name.match(/(\d+)$/)?.[1] ?? 0);
  const open = new Map(), out = [];

  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const heroW = worldOf(toy, s, memo);
    const fAdj = f + 1 < anim.frames ? f + 1 : Math.max(0, f - 1);
    const adjW = fAdj !== f ? worldOf(toy, fAdj * SUB, new Map()) : heroW;
    const sameStage = Math.abs(adjW.p[0] - heroW.p[0]) < 2 && Math.min(...adjW.s.map(Math.abs)) >= 1e-3;
    const vy = sameStage && fAdj !== f ? Math.abs(adjW.p[1] - heroW.p[1]) * anim.fps : 0;
    if (Math.min(...heroW.s.map(Math.abs)) < 1e-3 || heroW.p[1] < 0.14 || vy < 0.45) {
      for (const [k, c] of open) { out.push(c); open.delete(k); }
      continue;
    }
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;

    let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hDepth = 0, hn = 0;
    for (const { o, pts } of heroProbes) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      for (const [lp0] of pts) {
        const lp = toLocal(camW, apply(w, lp0));
        if (lp[2] >= -0.05 || -lp[2] > 6) continue;
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        if (nx < hx0) hx0 = nx; if (nx > hx1) hx1 = nx;
        if (ny < hy0) hy0 = ny; if (ny > hy1) hy1 = ny;
        hDepth += -lp[2]; hn++;
      }
    }
    if (!hn || hx1 < -1 || hx0 > 1 || hy1 < -1 || hy0 > 1) {
      for (const [k, c] of open) { out.push(c); open.delete(k); }
      continue;
    }
    const meanHDepth = hDepth / hn;

    const seenNow = new Set();
    for (const [key, ls] of lineGroups) {
      let lx0 = Infinity, lx1 = -Infinity, ly0 = Infinity, ly1 = -Infinity, ld = 0, ln = 0;
      const shownChars = [];
      for (const { o, corners } of ls) {
        const w = worldOf(o.name, s, memo);
        if (Math.min(...w.s.map(Math.abs)) < 0.35) continue;
        let ok = 0;
        for (const c of corners) {
          const lp = toLocal(camW, apply(w, c));
          if (lp[2] >= -0.05 || -lp[2] > 6) continue;
          const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
          if (nx < lx0) lx0 = nx; if (nx > lx1) lx1 = nx;
          if (ny < ly0) ly0 = ny; if (ny > ly1) ly1 = ny;
          ld += -lp[2]; ln++; ok++;
        }
        if (ok === 4) shownChars.push(o);
      }
      if (!ln || ld / ln < meanHDepth - 0.02) continue;
      const ovX = Math.min(hx1, lx1) - Math.max(hx0, lx0);
      const ovY = Math.min(hy1, ly1) - Math.max(hy0, ly0);
      if (ovX <= 0 || ovY <= 0) continue;
      const hFrac = ovY / Math.max(1e-5, ly1 - ly0);
      if (hFrac < minShare) continue;
      const text = shownChars.sort((a, b) => idxOf(a) - idxOf(b)).map((x) => x.letter).join("");
      seenNow.add(key);
      const cur = open.get(key);
      if (!cur) open.set(key, { line: key, text, from: t, to: t, peak: t, share: hFrac });
      else {
        cur.to = t;
        if (hFrac > cur.share) Object.assign(cur, { share: hFrac, peak: t, text });
      }
    }
    for (const [k, c] of open) if (!seenNow.has(k)) { out.push(c); open.delete(k); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.share - a.share);
}

export function describeHeroStreaksOverText(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(2)}–${m.to.toFixed(2)} s: airborne toy streaks in front of 3D lettering "${m.text}" (${m.line}, ${Math.round(m.share * 100)}% covered at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect settled custom-beat banner/badge plaques (`*_plate`) and showcase `uiBox` cards (1–5 active cards on a beat)
 * whose face normal stays turned > `maxAngleDeg` away from the camera ray (nearly edge-on like a thin blade), e.g. from
 * aiming at world X = 0 instead of the beat's stage X or omitting UPRIGHT / camera yaw. Skips horizontal desk/floor
 * mats, actively spinning/flipping transitions, and 6+ card corridor/wall montages.
 */
export function edgeOnCards(anim, { aspect = 16 / 9, maxAngleDeg = 68, minSecs = 0.45, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !fovs?.length) return [];
  const SKIP_FG = /^beat\d+_(p_|back$|avatar$|cyc|bg|floor|desk|pad|stage|rostrum|plinth|wall|bleed)/;

  const plaques = [];
  const cardsByBeat = new Map();
  for (const o of anim.objects) {
    if (!/^beat\d+_/.test(o.name) || SKIP_FG.test(o.name) || SKIP_NAME.test(o.name) || !o.geo) continue;
    if (/_plate$/.test(o.name) && (o.geo.type === "roundBox" || o.geo.type === "box") && Array.isArray(o.geo.size)) {
      const [sx, sy, sz] = o.geo.size;
      if (Math.min(sx, sy, sz) < 0.025 && Math.max(sx, sy, sz) >= 0.08) {
        plaques.push({ o, spec: boxSpec(o), unit: 1 });
      }
    } else if (o.geo.type === "uiBox" && Array.isArray(o.geo.rect) && o.geo.rect.length >= 4) {
      const beat = o.name.match(/^(beat\d+_)/)?.[1] ?? "";
      if (!cardsByBeat.has(beat)) cardsByBeat.set(beat, []);
      cardsByBeat.get(beat).push({ o, spec: boxSpec(o), unit: o.geo.unitScale ?? 1 });
    }
  }
  if (!plaques.length && !cardsByBeat.size) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const prevQuat = new Map();
  const open = new Map(), out = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;
    const seenNow = new Set();

    const evalTarget = (item) => {
      const w = worldOf(item.o.name, s, memo);
      const pq = prevQuat.get(item.o.name);
      prevQuat.set(item.o.name, w.q);
      if (Math.min(...w.s.map(Math.abs)) < 0.05 * item.unit) return;
      if (pq) {
        const qdot = Math.abs(w.q[0] * pq[0] + w.q[1] * pq[1] + w.q[2] * pq[2] + w.q[3] * pq[3]);
        if (1 - qdot > 6e-4) return; // actively rotating/flipping transition
      }
      const obb = worldOBB(item.spec, w);
      const maxSpan = Math.max(obb.h[0] * 2, obb.h[1] * 2, obb.h[2] * 2);
      if (maxSpan > 0.95) return;
      const lp = toLocal(camW, obb.c);
      if (lp[2] >= -0.08 || -lp[2] > 5) return;
      const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
      if (Math.abs(nx) > 0.95 || Math.abs(ny) > 0.95) return;

      const minAx = obb.h[0] <= obb.h[1] && obb.h[0] <= obb.h[2] ? 0 : obb.h[1] <= obb.h[2] ? 1 : 2;
      const ax = obb.axes[minAx];
      const nLen = Math.hypot(...ax) || 1;
      const nW = [ax[0] / nLen, ax[1] / nLen, ax[2] / nLen];
      if (Math.abs(nW[1]) >= 0.70) return; // horizontal desk/floor mat

      const vx = camW.p[0] - obb.c[0], vy = camW.p[1] - obb.c[1], vz = camW.p[2] - obb.c[2];
      const vLen = Math.hypot(vx, vy, vz) || 1;
      const cosAng = Math.min(1, Math.abs((nW[0] * vx + nW[1] * vy + nW[2] * vz) / vLen));
      const angDeg = (Math.acos(cosAng) * 180) / Math.PI;
      if (angDeg <= maxAngleDeg) return;

      seenNow.add(item.o.name);
      const cur = open.get(item.o.name);
      if (!cur) open.set(item.o.name, { name: item.o.name, from: t, to: t, peak: t, angle: +angDeg.toFixed(1) });
      else {
        cur.to = t;
        if (angDeg > cur.angle) Object.assign(cur, { angle: +angDeg.toFixed(1), peak: t });
      }
    };

    for (const item of plaques) evalTarget(item);
    for (const [, cards] of cardsByBeat) {
      const active = cards.filter((item) => {
        const w = worldOf(item.o.name, s, memo);
        return Math.min(...w.s.map(Math.abs)) >= 0.05 * item.unit && Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) <= 5;
      });
      if (active.length > 5) continue; // 6+ card corridor/wall montage
      for (const item of active) evalTarget(item);
    }

    for (const [k, c] of open) if (!seenNow.has(k)) { out.push(c); open.delete(k); }
  }
  out.push(...open.values());
  return out.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.angle - a.angle);
}

/**
 * Detect side-standing compound sub-props (e.g. `pod_globe_*`) colliding laterally with their shared-prefix
 * pedestal (`pod_base`, `pod_deck`, `beat*_pad`, etc.), which `solidClashes` skips due to shared top group or
 * matte `paper` plinth materials. Coaxial tiers and parts resting above the pedestal top are ignored.
 */
export function pedestalSideClashes(anim, { toy = "hero", minPen = 0.010, minSecs = 0.25, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const BASE_RE = /^((?:beat\d+_)?[A-Za-z0-9]+)_(base|deck|pad|plinth|pedestal|tier\d*)$/;
  const SAT_RE = /^((?:beat\d+_)?[A-Za-z0-9]+)_([A-Za-z0-9]+)_.+$/;
  const NON_SAT = new Set(["base", "deck", "pad", "plinth", "pedestal", "ln", "lbl", "plate", "rim", "trim", "face", "ptr", "star"]);

  const bases = [];
  for (const o of anim.objects) {
    if (!o.geo || under(o, toy) || o.letter || o.mat?.outline || SKIP_NAME.test(o.name)) continue;
    const m = o.name.match(BASE_RE);
    if (!m) continue;
    const spec = propBoundsSpec(o);
    if (spec) bases.push({ o, spec, root: m[1] });
  }
  if (!bases.length) return [];
  const roots = new Set(bases.map((b) => b.root));
  const sats = [];
  for (const o of anim.objects) {
    if (!o.geo || under(o, toy) || o.letter || o.mat?.outline || SKIP_NAME.test(o.name)) continue;
    if (o.mat?.type === "flake" || o.mat?.type === "glow") continue;
    const m = o.name.match(SAT_RE);
    if (!m || !roots.has(m[1]) || NON_SAT.has(m[2])) continue;
    const spec = propBoundsSpec(o);
    if (spec) sats.push({ o, spec, root: m[1], satGroup: `${m[1]}_${m[2]}` });
  }
  if (!sats.length) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const hasCam = objects.has("camera");
  const open = new Map(), raw = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = hasCam ? worldOf("camera", s, memo) : null;
    const baseState = new Map();
    for (const b of bases) {
      const w = worldOf(b.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      if (camW && Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) continue;
      baseState.set(b.o.name, { b, obb: worldOBB(b.spec, w) });
    }
    const seenNow = new Set();
    for (const st of sats) {
      const w = worldOf(st.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      if (camW && Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) continue;
      const satOBB = worldOBB(st.spec, w);
      for (const { b, obb: baseOBB } of baseState.values()) {
        if (b.root !== st.root) continue;
        const baseR = Math.max(baseOBB.h[0], baseOBB.h[2]);
        const lat = Math.hypot(satOBB.c[0] - baseOBB.c[0], satOBB.c[2] - baseOBB.c[2]);
        if (lat < Math.max(baseR * 0.55, 0.045)) continue;
        if (satOBB.c[1] - satOBB.h[1] >= baseOBB.c[1] + baseOBB.h[1] - 0.005) continue;
        const ov = satOverlap(baseOBB, satOBB, 0.004);
        if (!ov || ov.pen < minPen) continue;
        const pk = `${st.satGroup}|${b.o.name}`;
        seenNow.add(pk);
        const cur = open.get(pk);
        if (!cur) open.set(pk, { sat: st.satGroup, base: b.o.name, from: t, to: t, peak: t, pen: ov.pen });
        else {
          cur.to = t;
          if (ov.pen > cur.pen) Object.assign(cur, { pen: ov.pen, peak: t });
        }
      }
    }
    for (const [pk, cur] of open) if (!seenNow.has(pk)) { raw.push(cur); open.delete(pk); }
  }
  raw.push(...open.values());
  return raw.filter((c) => c.to - c.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.pen - a.pen);
}

export function describePedestalSideClashes(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.sat} overlaps pedestal ${m.base} (${Math.round(m.pen * 1000)} mm deep at ${m.peak.toFixed(2)} s)`,
  }));
}

export function describeEdgeOnCards(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: ${m.name} stands ${m.angle.toFixed(0)}° edge-on to the camera (worst at ${m.peak.toFixed(2)} s)`,
  }));
}

function obbExtrema(obb) {
  const [hx, hy, hz] = obb.h, [ax, ay, az] = obb.axes;
  const rx = Math.abs(ax[0]) * hx + Math.abs(ay[0]) * hy + Math.abs(az[0]) * hz;
  const ry = Math.abs(ax[1]) * hx + Math.abs(ay[1]) * hy + Math.abs(az[1]) * hz;
  const rz = Math.abs(ax[2]) * hx + Math.abs(ay[2]) * hy + Math.abs(az[2]) * hz;
  return {
    lo: [obb.c[0] - rx, obb.c[1] - ry, obb.c[2] - rz],
    hi: [obb.c[0] + rx, obb.c[1] + ry, obb.c[2] + rz],
  };
}

function obbCornersWorld(obb) {
  const out = [];
  const [hx, hy, hz] = obb.h, [ax, ay, az] = obb.axes;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    out.push([
      obb.c[0] + sx * ax[0] * hx + sy * ay[0] * hy + sz * az[0] * hz,
      obb.c[1] + sx * ax[1] * hx + sy * ay[1] * hy + sz * az[1] * hz,
      obb.c[2] + sx * ax[2] * hx + sy * ay[2] * hy + sz * az[2] * hz,
    ]);
  }
  return out;
}

/**
 * Detect upright `uiBox` picture cards that either:
 * 1) protrude past their paired backing bezel/chassis box (`kind: "bezel"`, e.g. a 9:16 portrait placed on a 4:3 frame), or
 * 2) poke down through the stage floor (`kind: "floor"`, bottom Y < -3 mm while settled upright on screen).
 */
export function cardBezelMismatches(anim, { aspect = 16 / 9, tol = 0.004, minSecs = 0.25, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const BUILTIN_CARD = /^(panel_|wall|piece|sticker2d$|beat\d+_(p_(?:nav|header|banner|info|tabs|pinned|retro|side)$|back$|avatar$|cyc|bg|bleed))/;
  const SKIP_BEZEL = /(?:_plate$|(?:^|_)(?:floor|base|trim|plinth|pedestal|pad|desk_base|desk_top|track|scrub|rail|stand)$)/;

  const cards = [];
  const bezels = [];
  for (const o of anim.objects) {
    if (!o.geo || under(o, "hero") || o.letter || o.mat?.outline || SKIP_NAME.test(o.name)) continue;
    if (o.geo.type === "uiBox" && Array.isArray(o.geo.rect) && o.geo.rect.length >= 4 && !BUILTIN_CARD.test(o.name)) {
      const spec = boxSpec(o);
      if (spec) cards.push({ o, spec, unit: o.geo.unitScale ?? 1 });
    } else if ((o.geo.type === "roundBox" || o.geo.type === "box" || o.geo.type === "plate") && !SKIP_BEZEL.test(o.name) && !/^panel_/.test(o.name)) {
      const spec = propBoundsSpec(o);
      if (spec) bezels.push({ o, spec });
    }
  }
  if (!cards.length) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const prevPos = new Map();
  const open = new Map(), out = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;
    const seenNow = new Set();

    const activeBezels = [];
    for (const bz of bezels) {
      const w = worldOf(bz.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      if (Math.hypot(w.p[0] - camW.p[0], w.p[1] - camW.p[1], w.p[2] - camW.p[2]) > 5) continue;
      const obb = worldOBB(bz.spec, w);
      activeBezels.push({ o: bz.o, obb, ext: obbExtrema(obb) });
    }

    for (const c of cards) {
      const w = worldOf(c.o.name, s, memo);
      const pp = prevPos.get(c.o.name);
      prevPos.set(c.o.name, w.p);
      if (Math.min(...w.s.map(Math.abs)) < 0.05 * c.unit) continue;
      if (pp && Math.hypot(w.p[0] - pp[0], w.p[1] - pp[1], w.p[2] - pp[2]) > 0.005) continue; // moving entrance/exit
      const obb = worldOBB(c.spec, w);
      const ext = obbExtrema(obb);
      const cW = ext.hi[0] - ext.lo[0], cH = ext.hi[1] - ext.lo[1];
      if (Math.max(cW, cH) > 0.65 || Math.min(cW, cH) < 0.035) continue;

      const minAx = obb.h[0] <= obb.h[1] && obb.h[0] <= obb.h[2] ? 0 : obb.h[1] <= obb.h[2] ? 1 : 2;
      const nAx = obb.axes[minAx], nLen = Math.hypot(...nAx) || 1;
      if (Math.abs(nAx[1] / nLen) >= 0.45) continue; // flat lying card

      const lp = toLocal(camW, obb.c);
      if (lp[2] >= -0.08 || -lp[2] > 5) continue;
      const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
      if (Math.abs(nx) > 0.96 || Math.abs(ny) > 0.96) continue;

      for (const bz of activeBezels) {
        if (Math.abs(bz.obb.c[0] - obb.c[0]) > 0.032 || Math.abs(bz.obb.c[1] - obb.c[1]) > 0.042) continue;
        const dz = obb.c[2] - bz.obb.c[2];
        if (dz < 0.0005 || dz > 0.030) continue;
        const bW = bz.ext.hi[0] - bz.ext.lo[0], bH = bz.ext.hi[1] - bz.ext.lo[1];
        if (bW < 0.55 * cW || bH < 0.55 * cH) continue;
        const over = Math.max(ext.hi[1] - bz.ext.hi[1], bz.ext.lo[1] - ext.lo[1], ext.hi[0] - bz.ext.hi[0], bz.ext.lo[0] - ext.lo[0]);
        if (over <= tol) continue;
        const key = `bezel:${c.o.name}:${bz.o.name}`;
        seenNow.add(key);
        const cur = open.get(key);
        if (!cur) open.set(key, { kind: "bezel", card: c.o.name, bezel: bz.o.name, from: t, to: t, peak: t, over });
        else { cur.to = t; if (over > cur.over) Object.assign(cur, { over, peak: t }); }
      }

      if (ext.lo[1] < -0.003 && obb.c[1] > 0.025) {
        const over = -ext.lo[1];
        const key = `floor:${c.o.name}`;
        seenNow.add(key);
        const cur = open.get(key);
        if (!cur) open.set(key, { kind: "floor", card: c.o.name, bezel: "floor", from: t, to: t, peak: t, over });
        else { cur.to = t; if (over > cur.over) Object.assign(cur, { over, peak: t }); }
      }
    }
    for (const [k, v] of open) if (!seenNow.has(k)) { out.push(v); open.delete(k); }
  }
  out.push(...open.values());
  return out.filter((m) => m.to - m.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.over - a.over);
}

export function describeCardBezelMismatches(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: m.kind === "floor"
      ? `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: picture card ${m.card} pokes ${Math.round(m.over * 1000)} mm below the stage floor (worst at ${m.peak.toFixed(2)} s)`
      : `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: picture card ${m.card} protrudes ${Math.round(m.over * 1000)} mm past its backing frame ${m.bezel} (worst at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect foreground prop bars or ornamental glyphs (e.g. hollow viewfinder frames `*_vf_*`) placed in front of a
 * `uiBox` picture card whose bars/glyphs slice across the inner 76% core of the picture on camera.
 */
export function frameSlicesCard(anim, { aspect = 16 / 9, minSecs = 0.25, every = 2 } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };
  const BUILTIN_CARD = /^(panel_|wall|piece|sticker2d$|beat\d+_(p_(?:nav|header|banner|info|tabs|pinned|retro|side)$|back$|avatar$|cyc|bg|bleed))/;
  const BUILTIN_OBJ = /^(panel_|strip_|glow_|stat_|wall|piece|sticker2d$|flake_|spark_|bit_|label\d+_|crown$|cta_floor$|floor$|blob$|plinth_|snail_|logo$)/;
  const SKIP_PART = /(?:_plate$|_bot_|(?:^|_)(?:floor|base|trim|plinth|pedestal|pad|desk_base|desk_top|track|scrub|rail|chassis|frame|stand)$)/;

  const cards = [];
  const fgParts = [];
  for (const o of anim.objects) {
    if (!o.geo || under(o, "hero") || o.letter || o.mat?.outline || SKIP_NAME.test(o.name)) continue;
    if (o.geo.type === "uiBox" && Array.isArray(o.geo.rect) && o.geo.rect.length >= 4 && !BUILTIN_CARD.test(o.name)) {
      const spec = boxSpec(o);
      if (spec) cards.push({ o, spec, unit: o.geo.unitScale ?? 1 });
    } else if (!BUILTIN_OBJ.test(o.name) && !SKIP_PART.test(o.name) && (o.geo.type === "roundBox" || o.geo.type === "box" || o.geo.type === "curve")) {
      const spec = propBoundsSpec(o);
      if (spec) fgParts.push({ o, spec, group: groupOf(o.name) });
    }
  }
  if (!cards.length || !fgParts.length) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  const projBox = (obb, camW, tanX, tanY) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, dSum = 0, n = 0;
    for (const p of obbCornersWorld(obb)) {
      const lp = toLocal(camW, p);
      if (lp[2] >= -0.05 || -lp[2] > 5.5) continue;
      const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
      if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
      if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
      dSum += -lp[2]; n++;
    }
    return n >= 4 ? { x0, x1, y0, y1, depth: dSum / n } : null;
  };

  const open = new Map(), out = [];
  for (let f = 0; f < anim.frames; f += every) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;
    const seenNow = new Set();

    const projFg = [];
    for (const fp of fgParts) {
      const w = worldOf(fp.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      const obb = worldOBB(fp.spec, w);
      const pr = projBox(obb, camW, tanX, tanY);
      if (pr && pr.x1 > -1 && pr.x0 < 1 && pr.y1 > -1 && pr.y0 < 1) projFg.push({ ...fp, pr });
    }
    if (!projFg.length) {
      for (const [k, v] of open) { out.push(v); open.delete(k); }
      continue;
    }

    for (const c of cards) {
      const w = worldOf(c.o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05 * c.unit) continue;
      const obb = worldOBB(c.spec, w);
      const ext = obbExtrema(obb);
      if (Math.max(ext.hi[0] - ext.lo[0], ext.hi[1] - ext.lo[1]) > 0.65) continue;
      const cp = projBox(obb, camW, tanX, tanY);
      if (!cp || cp.x1 <= cp.x0 || cp.y1 <= cp.y0) continue;
      const cw = cp.x1 - cp.x0, ch = cp.y1 - cp.y0;
      const ix0 = cp.x0 + 0.12 * cw, ix1 = cp.x1 - 0.12 * cw;
      const iy0 = cp.y0 + 0.12 * ch, iy1 = cp.y1 - 0.12 * ch;

      for (const fp of projFg) {
        const dz = cp.depth - fp.pr.depth;
        if (dz < 0.0015 || dz > 0.18) continue;
        const ovX = Math.min(ix1, fp.pr.x1) - Math.max(ix0, fp.pr.x0);
        const ovY = Math.min(iy1, fp.pr.y1) - Math.max(iy0, fp.pr.y0);
        if (ovX <= 0 || ovY <= 0) continue;
        const bw = Math.max(1e-5, fp.pr.x1 - fp.pr.x0), bh = Math.max(1e-5, fp.pr.y1 - fp.pr.y0);
        const isBarSlice = Math.max(bw, bh) / Math.min(bw, bh) >= 2.4 && (ovX / cw >= 0.30 || ovY / ch >= 0.30);
        const isCoreGlyph = fp.o.geo.type === "curve" && fp.pr.x0 >= cp.x0 && fp.pr.x1 <= cp.x1 && fp.pr.y0 >= cp.y0 && fp.pr.y1 <= cp.y1;
        if (!isBarSlice && !isCoreGlyph) continue;
        const span = Math.max(ovX / cw, ovY / ch);
        const key = `${fp.group}->${c.o.name}`;
        seenNow.add(key);
        const cur = open.get(key);
        if (!cur) open.set(key, { prop: fp.group, part: fp.o.name, card: c.o.name, from: t, to: t, peak: t, span });
        else { cur.to = t; if (span > cur.span) Object.assign(cur, { span, peak: t, part: fp.o.name }); }
      }
    }
    for (const [k, v] of open) if (!seenNow.has(k)) { out.push(v); open.delete(k); }
  }
  out.push(...open.values());
  return out.filter((m) => m.to - m.from >= minSecs - 1e-6).sort((a, b) => a.from - b.from || b.span - a.span);
}

export function describeFrameSlicesCard(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(1)}–${m.to.toFixed(1)} s: foreground prop ${m.prop} (${m.part}) slices across picture card ${m.card} on camera (${Math.round(m.span * 100)}% span at ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Detect `spark*` / beat `confetti*` particles passing directly in front of the settled toy's face/eyes on camera.
 */
export function sparksOverHeroFace(anim, { aspect = 16 / 9, toy = "hero", minFrames = 2, file = (p) => p } = {}) {
  const objects = new Map(anim.objects.map((o) => [o.name, o]));
  const fovs = anim.scalars?.fov;
  if (!objects.has("camera") || !objects.has(toy) || !fovs?.length) return [];
  const under = (o, root) => { for (let p = o; p; p = objects.get(p.parent)) if (p.name === root) return true; return false; };

  let headParts = anim.objects.filter((o) => o.geo && o.name !== toy && under(o, toy) && /head|face|eye|brow|nose|cheek/i.test(o.name));
  if (!headParts.length) headParts = anim.objects.filter((o) => o.geo && o.name !== toy && under(o, toy));
  const headProbes = headParts.map((o) => ({ o, pts: probesOf(o.geo, file) })).filter((p) => p.pts.length);
  const sparks = anim.objects.filter((o) => /^(?:beat\d+_)?(spark|confetti)/.test(o.name));
  if (!headProbes.length || !sparks.length) return [];

  const sampleAt = trackReader(anim), SUB = anim.sub ?? 1;
  const worldOf = (name, s, memo) => {
    if (memo.has(name)) return memo.get(name);
    const o = objects.get(name);
    const local = sampleAt(name, s) ?? unpack(o.tr);
    const w = o.parent && o.parent !== "root" ? compose(worldOf(o.parent, s, memo), local) : local;
    memo.set(name, w);
    return w;
  };

  let prevHeadY = null, runStart = null, runEnd = null, runPeak = null, worstSpark = null, runCount = 0;
  const out = [];
  const flush = () => {
    if (runCount >= minFrames && runStart !== null) out.push({ spark: worstSpark, from: runStart, to: runEnd, peak: runPeak, frames: runCount });
    runStart = runEnd = runPeak = worstSpark = null; runCount = 0;
  };

  for (let f = 0; f < anim.frames; f++) {
    const s = f * SUB, t = f / anim.fps, memo = new Map();
    const camW = worldOf("camera", s, memo);
    const fovDeg = fovs[Math.min(s, fovs.length - 1)] ?? 30;
    const tanY = Math.tan((fovDeg * Math.PI) / 360), tanX = tanY * aspect;

    let hx0 = Infinity, hx1 = -Infinity, hy0 = Infinity, hy1 = -Infinity, hDepth = 0, hn = 0, worldY = 0;
    for (const { o, pts } of headProbes) {
      const w = worldOf(o.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 1e-3) continue;
      for (const [lp0] of pts) {
        const wp = apply(w, lp0);
        const lp = toLocal(camW, wp);
        if (lp[2] >= -0.05 || -lp[2] > 6) continue;
        const nx = lp[0] / (-lp[2] * tanX), ny = lp[1] / (-lp[2] * tanY);
        if (nx < hx0) hx0 = nx; if (nx > hx1) hx1 = nx;
        if (ny < hy0) hy0 = ny; if (ny > hy1) hy1 = ny;
        hDepth += -lp[2]; worldY += wp[1]; hn++;
      }
    }
    if (!hn || hx1 <= hx0 || hy1 <= hy0) { prevHeadY = null; flush(); continue; }
    const meanWorldY = worldY / hn;
    const settled = prevHeadY === null || Math.abs(meanWorldY - prevHeadY) * anim.fps < 0.25;
    prevHeadY = meanWorldY;
    if (!settled) { flush(); continue; }

    const meanDepth = hDepth / hn;
    const hw = hx1 - hx0, hh = hy1 - hy0;
    const fx0 = hx0 + 0.15 * hw, fx1 = hx1 - 0.15 * hw;
    const fy0 = hy0 + 0.12 * hh, fy1 = hy1 - 0.18 * hh;

    let hitName = null;
    for (const sp of sparks) {
      const w = worldOf(sp.name, s, memo);
      if (Math.min(...w.s.map(Math.abs)) < 0.05) continue;
      const lp = toLocal(camW, w.p);
      if (lp[2] >= -0.05) continue;
      const pDepth = -lp[2];
      if (meanDepth - pDepth < 0.005 || meanDepth - pDepth > 0.65) continue;
      const nx = lp[0] / (pDepth * tanX), ny = lp[1] / (pDepth * tanY);
      if (nx >= fx0 && nx <= fx1 && ny >= fy0 && ny <= fy1) { hitName = sp.name; break; }
    }
    if (hitName) {
      if (runStart === null) { runStart = t; runPeak = t; worstSpark = hitName; }
      runEnd = t;
      runCount++;
    } else flush();
  }
  flush();
  return out;
}

export function describeSparksOverHeroFace(items) {
  return items.map((m) => ({
    kind: "warn",
    ...m,
    text: `${m.from.toFixed(2)}–${m.to.toFixed(2)} s: particle ${m.spark} streaks across the toy's face/eyes on camera (${m.frames} frames around ${m.peak.toFixed(2)} s)`,
  }));
}

/**
 * Maximum outward Z arm-lift angle (radians) that keeps a toy's hands visible outside its head silhouette.
 * Slender-headed toys keep the full target angle (e.g. 2.5 rad); wide-headed chibi/sculpt toys clamp
 * toward an outward Victory-V (~1.6–1.8 rad) so short arms do not disappear behind the cheeks.
 */
export function armLiftLimit(toy, file = (p) => p, target = 2.5) {
  const joints = toy?.joints ?? {};
  const parts = toy?.parts ?? [];
  const sh = joints.armR?.p ?? joints.armL?.p;
  if (!sh || !parts.length) return target;
  const underJoint = (g, want) => {
    for (let cur = g; cur; cur = joints[cur]?.parent) if (cur === want) return true;
    return false;
  };
  let headHalfX = 0, headTopY = -Infinity, armReach = 0;
  for (const p of parts) {
    const [a, b] = partBox(p, file);
    if (!a) continue;
    const pos = p.pos ?? [0, 0, 0];
    const lo = [a[0] + pos[0], a[1] + pos[1], a[2] + pos[2]];
    const hi = [b[0] + pos[0], b[1] + pos[1], b[2] + pos[2]];
    if (underJoint(p.group, "head")) {
      headHalfX = Math.max(headHalfX, Math.abs(lo[0]), Math.abs(hi[0]));
      headTopY = Math.max(headTopY, hi[1]);
    } else if (p.group === "armR" || p.group === "armL") {
      const jp = joints[p.group]?.p ?? sh;
      for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) {
        armReach = Math.max(armReach, Math.hypot(x - jp[0], y - jp[1]));
      }
    }
  }
  const shX = Math.abs(sh[0]), shY = sh[1];
  if (headHalfX <= 0 || armReach <= 0) return target;
  const handReach = 0.85 * armReach;
  const outAtTarget = shX + handReach * Math.sin(target);
  const tipYAtTarget = shY - armReach * Math.cos(target);
  if (tipYAtTarget >= headTopY || outAtTarget >= headHalfX + 0.004) return target;
  const sinMin = Math.min(1, Math.max(0, (headHalfX + 0.006 - shX) / Math.max(1e-4, handReach)));
  return +Math.max(Math.PI / 2, Math.min(target, Math.PI - Math.asin(sinMin))).toFixed(3);
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
