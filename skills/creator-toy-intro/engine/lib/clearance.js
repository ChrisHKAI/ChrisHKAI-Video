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
const SKIP_NAME = /^(flake|spark|bit|glow|confetti|burst|strip|floor|cta_floor|fx|camera)/;
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
    case "plate": { const m = Math.max(p.w ?? 0, p.d ?? 0) / 2 || 0.01; return sym([m, m, m]); }
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
    case "plate": return [[[0, 0, 0], 0.9 * (g.t ?? 0) / 2]];
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
      const hz = g.depth / 2 + (g.bevel ?? 0.0005);
      const radius = Math.hypot(Math.max(...xs.map(Math.abs)), Math.max(...ys.map(Math.abs)), hz);
      return {
        o, radius, depth: (p, s) => {
          const x = p[0] / s[0], y = p[1] / s[1];
          if (!inRings(x, y, rings)) return -1;
          return Math.min(edgeDistance(x, y, rings) * Math.min(Math.abs(s[0]), Math.abs(s[1])), hz * Math.abs(s[2]) - Math.abs(p[2]));
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
