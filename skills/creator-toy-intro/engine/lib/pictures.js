// The creator's own pictures as cards a beat lays out (references/beats.md, "Their pictures, many at once"):
// any picture in the film (assets/work/…) becomes a thin card with the picture on its face, standing and facing
// the camera, as wide as asked; layouts place many at once (a grid, a wall past the frame, an arc round the toy,
// a deck), and stagger spreads their arrivals over the beat. The pictures light themselves, like the page's
// panels: the light stays on the toy.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { fromFilm } from "./film.js";
import { seg } from "./math.js";
import { trs, qId, qMul, qAxis, apply } from "./quat.js";

// a picture's size in pixels, from its header (PNG or JPEG)
export function imageSize(file) {
  const b = readFileSync(fromFilm(file));
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error(`${file}: not a PNG or JPEG picture`);
}

// the pictures in a folder of the film ("assets/work"), in name order: film-relative paths for picture()
export const pictureFiles = (dir) => readdirSync(fromFilm(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort().map((f) => `${dir.replace(/\/$/, "")}/${f}`);

// a card's face turned to the camera, as the page's panels are (beats/page-stand.js)
const UPRIGHT = qAxis([1, 0, 0], Math.PI / 2);
// an alpha-cutout RGBA PNG (an icon, a badge, a transparent layer) standing vertical and facing +z, with the same
// .geo / .mat / .at(p, q, k) interface as picture() so transparent outsides never render as black rectangles
export function cutout(file, w) {
  const [W, H] = imageSize(file);
  const h = (w * H) / W;
  return {
    file, w, h, t: 0.001,
    geo: { type: "plane", w, h },
    mat: { type: "sticker", image: file },
    at: (p, q = qId(), k = 1) => trs(p, q, Math.max(1e-4, k)),
  };
}
// file: a picture in the film; w: the card's width (m). Declare it with its geo and mat, place it with at(p, q, k):
// centred at p (world), turned by q (qId() faces the camera's +z), k its size (0 hides it).
// movie: a film (mp4) on the card instead, file its first frame (for the size): it plays its frames from the film's
// frame start, round and round (or holds its final frame when cyclic is false). cutout: true delegates to cutout().
// antiglare: true damps white-background web/article screenshots below finish.py's 0.85 bloom ceiling so body copy stays crisp.
export function picture(file, w, { thickness = 0.002, movie, frames, start = 1, cyclic = true, cutout: isCutout = false, antiglare = false, emission } = {}) {
  if (isCutout) return cutout(file, w);
  const [W, H] = imageSize(file);
  const s = w / (W * 0.001); // built at a millimetre a pixel, then scaled to w
  const glareExtras = antiglare
    ? { emission: emission ?? 0.78, coat: 0.06, rough: 0.62, sampled: false }
    : (emission !== undefined ? { emission } : {});
  return {
    file, w, h: (w * H) / W, t: thickness,
    geo: { type: "uiBox", rect: [-W / 2, -H / 2, W, H], uvRect: [0, 0, W, H], img: { image: file, w: W, h: H }, thickness: thickness / s, unitScale: +s.toFixed(6) },
    mat: movie
      ? { type: "ui", image: file, movie, frames, start, ...(cyclic === false ? { cyclic: false } : {}), ...glareExtras }
      : { type: "ui", image: file, ...glareExtras },
    at: (p, q = qId(), k = 1) => trs(p, qMul(q, UPRIGHT), Math.max(1e-4, s * k)),
  };
}

// a picture card paired with an auto-sized 4-sided 3D bezel matching the image's exact aspect ratio (never crops top/bottom
// or leaves side rails too short, and exposes standY(stageY) so its bottom bezel sits cleanly above the plinth/floor)
export function framedPicture(file, w, { border = 0.006, frameDepth = 0.006, radius = 0.005, frameColor = "#586E94", frameEmit = 0.16, frameRough = 0.28, frameMat = null, ...picOpts } = {}) {
  const pic = picture(file, w, picOpts);
  const frameSize = [+(pic.w + border * 2).toFixed(6), +(pic.h + border * 2).toFixed(6), frameDepth];
  const backDist = +(frameDepth / 2 + pic.t / 2 + 0.0006).toFixed(6);
  const mat = frameMat ?? { type: "type", color: frameColor, emit: frameEmit, rough: frameRough };
  return {
    file, w: pic.w, h: pic.h, border, frameSize, pic,
    frameGeo: { type: "roundBox", size: frameSize, radius },
    frameMat: mat,
    standY: (stageY = 0, gap = 0.003) => +(stageY + gap + frameSize[1] / 2).toFixed(6),
    declare(add, prefix = "fpic") {
      add({ name: `${prefix}_frame`, geo: { type: "roundBox", size: frameSize, radius }, mat, anim: true });
      add({ name: `${prefix}_pic`, geo: pic.geo, mat: pic.mat, anim: true });
    },
    put(put, prefix, p, q = qId(), k = 1) {
      if (k <= 0.01) {
        const park = trs([p[0], p[1], p[2]], qId(), 1e-4);
        put(`${prefix}_frame`, park);
        put(`${prefix}_pic`, pic.at(p, qId(), 1e-4));
        return;
      }
      const back = apply(trs([0, 0, 0], q, 1), [0, 0, -backDist * k]);
      put(`${prefix}_frame`, trs([p[0] + back[0], p[1] + back[1], p[2] + back[2]], q, k));
      put(`${prefix}_pic`, pic.at(p, q, k));
    },
  };
}

// a before/after framed picture pair (e.g. blueprint -> finished poster) that flips cleanly when a foreground wipe bar
// crosses the card's centre (`revealed` boolean or progress >= 0.5), with zero UV stretching or simultaneous overlap
export function wipePicture(beforeFile, afterFile, w, { beforeFrameColor, afterFrameColor, beforeOpts = {}, afterOpts = {}, ...sharedOpts } = {}) {
  const before = framedPicture(beforeFile, w, { ...sharedOpts, ...(beforeFrameColor ? { frameColor: beforeFrameColor } : {}), ...beforeOpts });
  const after = framedPicture(afterFile, w, { ...sharedOpts, ...(afterFrameColor ? { frameColor: afterFrameColor } : {}), ...afterOpts });
  return {
    beforeFile, afterFile, w: after.w, h: after.h, frameSize: after.frameSize, before, after,
    standY: (stageY = 0, gap = 0.003) => Math.max(before.standY(stageY, gap), after.standY(stageY, gap)),
    declare(add, prefix = "wpic") {
      before.declare(add, `${prefix}_before`);
      after.declare(add, `${prefix}_after`);
    },
    put(put, prefix, p, q = qId(), revealed = false, k = 1) {
      const showAfter = typeof revealed === "number" ? revealed >= 0.5 : Boolean(revealed);
      before.put(put, `${prefix}_before`, p, q, showAfter ? 0 : k);
      after.put(put, `${prefix}_after`, p, q, showAfter ? k : 0);
    },
  };
}

// a 3-part display assembly (outer lid/housing + recessed dark off-screen glass + active 1 mm picture slab) for laptops,
// monitors, tablets and phones: matches the screenshot's exact aspect ratio and keeps a 1.5 mm air gap in front of the
// dark glass so the lit screen never z-fights or cuts in half in Cycles (`put` places by screen centre; `putHinge`
// rotates a laptop lid around its bottom hinge edge).
export function screenPicture(file, w, {
  border = 0.004,
  innerRim = 0.001,
  lidDepth = 0.0034,
  lidRadius = 0.0014,
  lidColor = "#EBE2CE",
  lidRough = 0.34,
  lidMat = null,
  offColor = "#18241E",
  offRough = 0.42,
  offMat = null,
  antiglare = true,
  ...picOpts
} = {}) {
  const pic = picture(file, w, { thickness: 0.001, antiglare, ...picOpts });
  const lidSize = [+(pic.w + border * 2).toFixed(6), +(pic.h + border * 2).toFixed(6), lidDepth];
  const offSize = [+(pic.w + innerRim * 2).toFixed(6), +(pic.h + innerRim * 2).toFixed(6), 0.001];
  const lidCy = +(lidSize[1] / 2).toFixed(6);
  const zOff = +(lidDepth / 2 + 0.0003).toFixed(6);
  const zPic = +(lidDepth / 2 + 0.0023).toFixed(6);
  const lMat = lidMat ?? { type: "type", color: lidColor, emit: 0.0, rough: lidRough };
  const oMat = offMat ?? { type: "type", color: offColor, emit: 0.0, rough: offRough };
  return {
    file, w: pic.w, h: pic.h, border, lidSize, offSize, lidCy, zOff, zPic, pic,
    standY: (stageY = 0, gap = 0.003) => +(stageY + gap + lidSize[1] / 2).toFixed(6),
    declare(add, prefix = "scr") {
      add({ name: `${prefix}_lid`, geo: { type: "roundBox", size: lidSize, radius: lidRadius }, mat: lMat, anim: true });
      add({ name: `${prefix}_off`, geo: { type: "roundBox", size: offSize, radius: 0.0003 }, mat: oMat, anim: true });
      add({ name: `${prefix}_pic`, geo: pic.geo, mat: pic.mat, anim: true });
    },
    put(put, prefix, p, q = qId(), k = 1, { lit = 1 } = {}) {
      if (k <= 0.01) {
        const park = trs([p[0], p[1], p[2]], qId(), 1e-4);
        put(`${prefix}_lid`, park);
        put(`${prefix}_off`, park);
        put(`${prefix}_pic`, pic.at(p, qId(), 1e-4));
        return;
      }
      const root = trs(p, q, k);
      put(`${prefix}_lid`, trs(apply(root, [0, 0, -zPic]), q, k));
      put(`${prefix}_off`, trs(apply(root, [0, 0, zOff - zPic]), q, k));
      put(`${prefix}_pic`, lit > 0.02 ? pic.at(p, q, k * lit) : pic.at([p[0], -2, p[2]], qId(), 1e-4));
    },
    putHinge(put, prefix, hingeTr, { lit = 1 } = {}) {
      const k = Math.min(...hingeTr.s.map(Math.abs));
      if (k <= 0.01) {
        const park = trs([hingeTr.p[0], -2, hingeTr.p[2]], qId(), 1e-4);
        put(`${prefix}_lid`, park);
        put(`${prefix}_off`, park);
        put(`${prefix}_pic`, pic.at([hingeTr.p[0], -2, hingeTr.p[2]], qId(), 1e-4));
        return;
      }
      put(`${prefix}_lid`, trs(apply(hingeTr, [0, lidCy, 0]), hingeTr.q, k));
      put(`${prefix}_off`, trs(apply(hingeTr, [0, lidCy, zOff]), hingeTr.q, k));
      put(`${prefix}_pic`, lit > 0.02 ? pic.at(apply(hingeTr, [0, lidCy, zPic]), hingeTr.q, k * lit) : pic.at([hingeTr.p[0], -2, hingeTr.p[2]], qId(), 1e-4));
    },
  };
}

// two cards back to back (a badge's front and back): [front's transform, back's], the back turned round. A card's
// body runs its thickness behind its face, so two cards whose faces are nearer than both thicknesses lie inside
// each other and both render black: each face stands its own thickness (and a hair) out from p, along q's +z
export function backToBack(front, back, p, q = qId(), k = 1) {
  const n = apply(trs([0, 0, 0], q, 1), [0, 0, 1]);
  const out = (c, sign) => p.map((v, i) => v + sign * n[i] * (c.t + 0.0003) * k);
  return [front.at(out(front, 1), q, k), back.at(out(back, -1), qMul(q, qAxis([0, 1, 0], Math.PI)), k)];
}

// where n cards go, in stage metres (x right, y up, z towards the camera): [{ p, q }], q their turn
export const layout = {
  // every card at once, in rows filling a block `width` wide whose middle is c; aspect: the cards' width / height
  grid(n, { width = 1.2, aspect = 16 / 9, gap = 0.06, c = [0, 0.45, 0], cols } = {}) {
    cols = cols ?? Math.max(1, Math.ceil(Math.sqrt((n * 16) / 9 / aspect))); // about as many rows as fill a 16:9 frame
    while (cols * Math.ceil(n / cols) < n) cols++;
    const rows = Math.ceil(n / cols), cw = width / cols, ch = (cw * (1 - gap)) / aspect + cw * gap;
    return Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols), k = i % cols;
      return { p: [c[0] + (k - (cols - 1) / 2) * cw, c[1] + ((rows - 1) / 2 - r) * ch, c[2]], q: qId(), w: cw * (1 - gap) };
    });
  },
  // the same, bigger than the frame: a wall of them, more than fits
  wall(n, opts = {}) { return layout.grid(n, { width: 2.2, ...opts }); },
  // an arc round a point (the toy), each card facing it: r the radius, span the arc (deg), y their height
  arc(n, { r = 0.55, span = 150, c = [0, 0, 0], y = 0.18 } = {}) {
    return Array.from({ length: n }, (_, i) => {
      const a = ((-span / 2 + (span * (i + 0.5)) / n) * Math.PI) / 180;
      return { p: [c[0] + r * Math.sin(a), c[1] + y, c[2] - r * Math.cos(a) + r * 0.35], q: qAxis([0, 1, 0], -a), w: Math.min(0.24, (2 * r * Math.sin((span * Math.PI) / 360)) / Math.max(n, 2)) };
    });
  },
  // a corridor: two walls along a path the toy walks (a red carpet's nominees), each wall's cards facing in across
  // it, rows high; half = the path's half width, length its length from z0 away from the camera (-z), y the
  // lowest row's middle. Cards alternate left and right, so the first pairs face each other as the toy walks in
  corridor(n, { half = 0.32, length = 2.4, z0 = 0.2, rows = 2, y = 0.2, aspect = 16 / 9, gap = 0.08, c = [0, 0, 0] } = {}) {
    const perWall = Math.ceil(n / 2), cols = Math.ceil(perWall / rows), cw = length / cols, w = cw * (1 - gap), ch = w / aspect + cw * gap;
    return Array.from({ length: n }, (_, i) => {
      const side = i % 2 ? 1 : -1, j = Math.floor(i / 2), k = j % cols, r = Math.floor(j / cols);
      return { p: [c[0] + side * half, c[1] + y + r * ch, c[2] + z0 - (k + 0.5) * cw], q: qAxis([0, 1, 0], -side * Math.PI / 2), w };
    });
  },
  // a deck going away from the camera, each card a step behind the last
  stack(n, { step = [0.012, 0.01, -0.035], c = [0, 0.3, 0] } = {}) {
    return Array.from({ length: n }, (_, i) => ({ p: [c[0] + step[0] * i, c[1] + step[1] * i, c[2] + step[2] * i], q: qId() }));
  },
};

// card i of n arrives over `each` seconds, the arrivals spread across g0–g1: its progress 0 → 1 at beat time g
export const stagger = (g, i, n, g0, g1, each = 0.25) => {
  const t0 = g0 + ((g1 - g0 - each) * i) / Math.max(1, n - 1);
  return seg(g, t0, t0 + each);
};

// Remote multi-GPU render wrappers (e.g. colab-blender) skip .mp4/.mov files when bundling workspaces so raw reference
// reels and rendered exports are not uploaded. Losslessly stream-copy embedded .mp4/.mov card textures into
// build/movies/*.mkv (mtime-cached, zero re-encode) so local and cloud Cycles workers both load them cleanly.
const _movieRemuxCache = new Map();
export function ensureCloudSafeMovie(srcRel, resolveFile = fromFilm) {
  if (typeof srcRel !== "string" || !/\.(mp4|mov)$/i.test(srcRel)) return null;
  const srcAbs = resolveFile(srcRel);
  const cacheKey = srcAbs;
  if (_movieRemuxCache.has(cacheKey)) return _movieRemuxCache.get(cacheKey);
  if (!existsSync(srcAbs)) return null;
  const slug = srcRel.replace(/^[./\\]+/, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/\.(mp4|mov)$/i, "");
  const dstRel = `build/movies/${slug}.mkv`;
  const dstAbs = resolveFile(dstRel);
  const srcSt = statSync(srcAbs);
  if (!existsSync(dstAbs) || statSync(dstAbs).mtimeMs < srcSt.mtimeMs || statSync(dstAbs).size === 0) {
    mkdirSync(dirname(dstAbs), { recursive: true });
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", srcAbs, "-map", "0:v:0", "-c:v", "copy", "-an", dstAbs], { encoding: "utf8" });
    if (r.status !== 0) {
      rmSync(dstAbs, { force: true });
      _movieRemuxCache.set(cacheKey, null);
      return null;
    }
  }
  _movieRemuxCache.set(cacheKey, dstRel);
  return dstRel;
}
