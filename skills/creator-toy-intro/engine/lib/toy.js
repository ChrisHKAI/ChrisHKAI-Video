// The film's toy (film.json "toy" → a toy.json in the workspace): one part
// list read by the motion (anim.js) and, through build/anim.json, by Blender.
// Local axes follow Three.js: +y up, +z = the face; origin between the feet on
// the ground; metres. Sides are the toy's own: R = its right = -x.
//   parts:  { name, shape: roundBox (size, radius) | ellipsoid (r) | arc (radius, tube, arc),
//             pos, rot? (Euler XYZ, radians), mat (a colours key, or "shine"), group (its joint) }
//   joints: { name: { p (where it turns), parent } }
//   center: where flips and squashes turn round; height: overall height (m)
import { readFileSync } from "node:fs";
import { film, fromFilm } from "./film.js";

export const TOY = JSON.parse(readFileSync(fromFilm(film.toy), "utf8"));
export const MASCOT_PARTS = TOY.parts;
export const JOINTS = TOY.joints;
export const COLORS = TOY.colors;
export const HEIGHT = TOY.height;
export const CENTER = TOY.center;
