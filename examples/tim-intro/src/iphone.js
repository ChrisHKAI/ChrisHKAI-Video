// The iPhone 4S (2011), true to size (m): black glass front on a polished
// stainless band, the 3.5-inch Retina screen (640 x 960, scripts/imessage.py
// draws it), the home button with its square, the earpiece and the FaceTime
// camera. Parts in the phone's own frame (x right, y up, the screen to +z),
// for scripts/export-anim.mjs; curves are extruded about their plane.
export const W = 0.0586, H = 0.1152, D = 0.0093, R = 0.0088;
export const SCREEN = { w: 0.04932, h: 0.07398, y: 0.0026 };
const GLASS = 0.0007, FACE = D / 2; // the front of the glass

const fix = (pts) => pts.map(([x, y]) => [+x.toFixed(6), +y.toFixed(6)]);
function roundRect(w, h, r, n = 24) {
  const pts = [];
  for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]]) {
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return fix(pts);
}
const circle = (r, n = 64) => fix(Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]));
// an extruded outline `depth` thick overall, its rounded edge `bevel`
const slab = (rings, depth, bevel) => ({ type: "curve", rings, depth: depth - 2 * bevel, bevel });

const HOME = -0.0461, EAR = 0.048;
export const PARTS = [
  { name: "band", geo: slab([roundRect(W - 0.0008, H - 0.0008, R - 0.0004)], D - 2 * GLASS + 0.0004, 0.0004), mat: { type: "steel" }, p: [0, 0, 0] },
  { name: "front", geo: slab([roundRect(W - 0.0007, H - 0.0007, R - 0.00035)], GLASS, 0.00012), mat: { type: "phoneGlass" }, p: [0, 0, FACE - GLASS / 2] },
  { name: "back", geo: slab([roundRect(W - 0.0007, H - 0.0007, R - 0.00035)], GLASS, 0.00012), mat: { type: "phoneGlass" }, p: [0, 0, -FACE + GLASS / 2] },
  { name: "screen", geo: { type: "plane", w: SCREEN.w, h: SCREEN.h }, mat: { type: "phoneScreen" }, p: [0, SCREEN.y, FACE + 0.00002] },
  { name: "home", geo: slab([circle(0.0054)], 0.0002, 0.00006), mat: { type: "phoneButton" }, p: [0, HOME, FACE + 0.00002] },
  { name: "home_icon", geo: slab([roundRect(0.0037, 0.0037, 0.0008, 6), roundRect(0.0031, 0.0031, 0.0005, 6)], 0.00006, 0.00001), mat: { type: "phoneGrey" }, p: [0, HOME, FACE + 0.00014] },
  { name: "earpiece", geo: slab([roundRect(0.0102, 0.0015, 0.00074, 8)], 0.0001, 0.00002), mat: { type: "phoneGrille" }, p: [0, EAR, FACE + 0.00001] },
  { name: "facetime", geo: slab([circle(0.00105, 32)], 0.0001, 0.00002), mat: { type: "phoneLens" }, p: [-0.0098, EAR + 0.0002, FACE + 0.00001] },
  // the volume buttons and the ring/silent switch down the left of the band,
  // the sleep button on top (turned so they stand out of the band: axis, deg)
  { name: "vol_up", geo: slab([circle(0.0029, 32)], 0.0008, 0.0002), mat: { type: "steel" }, p: [-W / 2, 0.0285, 0], turn: [[0, 1, 0], -90] },
  { name: "vol_down", geo: slab([circle(0.0029, 32)], 0.0008, 0.0002), mat: { type: "steel" }, p: [-W / 2, 0.0185, 0], turn: [[0, 1, 0], -90] },
  { name: "silent", geo: slab([roundRect(0.0022, 0.0052, 0.0006, 6)], 0.0008, 0.0002), mat: { type: "steel" }, p: [-W / 2, 0.0405, 0], turn: [[0, 1, 0], -90] },
  { name: "sleep", geo: slab([roundRect(0.0094, 0.0026, 0.0011, 8)], 0.0008, 0.0002), mat: { type: "steel" }, p: [0.0155, H / 2, 0], turn: [[1, 0, 0], -90] },
];
