// The film's toy (film.json "toy" → a toy.json in the workspace): one part
// list read by the motion (anim.js) and, through build/anim.json, by Blender.
// Local axes follow Three.js: +y up, +z = the face; origin between the feet on
// the ground; metres. Sides are the toy's own: R = its right = -x.
//   parts:  { name, shape, pos, rot? (Euler XYZ, radians) or q? ([x, y, z, w]), mat (a colours key, "shine", or
//             "paint" for a sculpted part's own colours), group (its joint), paint? (layers) }
//   shapes by kit: every kit roundBox (size, radius) | ellipsoid (r) | arc (radius, tube, arc);
//             the pet kit blob (r, p, taper) | tube (pts, radii) | prism (sides, r, depth, bevel)
//             | loop (pts, radii: a closed tube) | plate (w, d, t, corner, bevel, or an outline);
//             the sculpt kit mesh (file: build/toy/<part>.npz from engine/scripts/sculpt.py)
//   joints: { name: { p (where it turns), parent, t?, s? (a nudge and a scale kept for good) } }
//   center: where flips and squashes turn round; height: overall height (m)
import { readFileSync } from "node:fs";
import { film, fromFilm } from "./film.js";

export const TOY = JSON.parse(readFileSync(fromFilm(film.toy), "utf8"));
// a part without "pos" sits at the toy's origin (a tube's points already say where it goes)
for (const p of TOY.parts ?? []) p.pos ??= [0, 0, 0];
export const MASCOT_PARTS = TOY.parts;
export const JOINTS = TOY.joints;
export const COLORS = TOY.colors;
export const HEIGHT = TOY.height;
export const CENTER = TOY.center;

// the geometry Blender builds for a part (scene.py, lib/toyblend.py)
export function toyGeo(p) {
  switch (p.shape) {
    case "roundBox": return { type: "roundBox", size: p.size, radius: p.radius };
    case "ellipsoid": return { type: "ellipsoid", r: p.r };
    case "arc": return { type: "arc", radius: p.radius, tube: p.tube, arc: p.arc };
    case "blob": return { type: "blob", r: p.r, p: p.p ?? 2, taper: p.taper ?? 0 };
    case "tube": return { type: "tube", pts: p.pts, radii: p.radii };
    case "prism": return { type: "prism", sides: p.sides, r: p.r, depth: p.depth, bevel: p.bevel };
    case "loop": return { type: "loop", pts: p.pts, radii: p.radii };
    case "plate": return { type: "plate", ...Object.fromEntries(["w", "d", "t", "corner", "bevel", "outline"].filter((k) => p[k] !== undefined).map((k) => [k, p[k]])) };
    case "mesh": return { type: "mesh", file: p.file };
    default: throw new Error(`toy part ${p.name}: unknown shape ${p.shape}`);
  }
}
