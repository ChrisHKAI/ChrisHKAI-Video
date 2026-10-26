// Tim (Tim Pan, 影视飓风) in the toy line (src/figure.js), after
// reference/tim/tim-still.webp: short black hair (a rounded top, a short ragged
// fringe), thin dark frames with wide lenses cut at the outer bottom corner, a
// black crew-neck T-shirt, dark jeans, white sneakers and a watch with a grey
// band on his left wrist.
import { qAxis, qMul, qRot } from "../../engine/lib/quat.js";
import { SIDES, EYE_Y, buildFigure, faceZ, faceQ, onFace, roundPoly, temple, blob, layer } from "./figure.js";

export const COLORS = {
  skin: "#F0C4A2",
  blush: "#EEB89C",
  hair: "#16171A",
  shirt: "#1B1C20",
  jeans: "#2A3242",
  shoe: "#F3F2EE",
  sole: "#CBCDD1",
  frame: "#1F2024",
  lens: "#FFFFFF",
  eyeWhite: "#FBFAF7",
  pupil: "#18120F",
  glint: "#FFFFFF",
  brow: "#1A191B",
  mouth: "#5E2023",
  tongue: "#E27E76",
  teeth: "#FBF9F4",
  line: "#3B221E",
  watch: "#C8CBD0",
  watchFace: "#0D0E11",
  band: "#7D858E",
};
// how each colour is finished in Blender (default: vinyl)
export const FINISH = { frame: "gloss", lens: "glass", watch: "metal", watchFace: "blackGlass", glint: "emit" };

// ── glasses: thin dark frames, wide lenses with the outer bottom corner cut ─
const LENS = { w: 19.2, h: 12.4, r: 1.9, y: EYE_Y + 0.4, x: 11.7, gap: 3.6, yaw: 0.2 };
// the lens outline in lens space (x outward for side s, y up), scaled by k
const lensShape = (s, k = 1) => {
  const { w, h } = LENS;
  return [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2 + 3.4], [w / 2 - 4.2, -h / 2], [-w / 2, -h / 2]].map(([x, y]) => [s * x * k, y * k]);
};
function glasses() {
  const parts = [], hinge = {};
  for (const [s, n] of SIDES) {
    const cx = s * LENS.x, z = faceZ(cx, LENS.y) + LENS.gap;
    const q = qAxis([0, 1, 0], s * LENS.yaw);
    const C = [cx, LENS.y, z];
    const P = ([x, y]) => { const r = qRot(q, [x, y, 0]); return [C[0] + r[0], C[1] + r[1], C[2] + r[2]]; };
    const path = roundPoly(lensShape(s), LENS.r);
    // the rim: a little heavier along the top
    const radii = path.map(([, y]) => 0.78 + 0.3 * Math.max(0, y / (LENS.h / 2)) ** 2);
    parts.push({ name: `rim${n}`, shape: "loop", pts: path.map(P), radii, mat: "frame" });
    // the lens: the same outline a touch smaller (plate space: x, z = -y)
    const outline = roundPoly(lensShape(s, 0.955), LENS.r * 0.9).map(([x, y]) => [x, -y]);
    parts.push({ name: `lens${n}`, shape: "plate", outline, t: 0.4, bevel: 0.12, pos: C, q: qMul(q, qAxis([1, 0, 0], Math.PI / 2)), mat: "lens" });
    hinge[n] = { inner: P([-s * (LENS.w / 2 - 0.5), LENS.h / 2 - 2.4]), outer: P([s * (LENS.w / 2 - 0.3), LENS.h / 2 - 1.8]) };
    parts.push({ name: `temple${n}`, ...temple(s, hinge[n].outer, LENS.y + 4.2), mat: "frame" });
  }
  // the bridge: a low arch between the rims' inner tops
  const a = hinge.R.inner, b = hinge.L.inner;
  parts.push({ name: "bridge", shape: "tube", pts: [a, [0, (a[1] + b[1]) / 2 + 0.9, a[2] + 0.4], b], radii: [0.72, 0.68, 0.72], mat: "frame" });
  return parts;
}

// ── hair: a rounded shell over the head (thick on top, thin at the sides,
// its edge the hairline) and a short fringe of locks falling onto the forehead
function hair() {
  const locks = [];
  // [x, tip height, length, lean]: roots buried in the cap, tips ragged
  // [x, tip height, length, lean, width]: two staggered rows; the roots dip
  // under the cap, the tips lift off the brow
  const spec = [
    [-15.6, 123.4, 7.6, 0.12, 4.6], [-9.4, 122.6, 8.4, 0.04, 4.8], [-3.0, 122.8, 8.2, -0.04, 4.6], [3.4, 122.4, 8.6, -0.1, 4.8], [9.8, 123.0, 8.0, -0.18, 4.6], [15.8, 123.8, 7.2, -0.26, 4.4],
    [-18.8, 121.8, 7.6, 0.14, 3.8], [-12.6, 120.0, 9.4, 0.04, 4.1], [-6.4, 119.2, 10.4, -0.05, 4.0], [-0.2, 120.4, 9.6, -0.1, 4.2], [6.2, 119.4, 10.6, -0.16, 4.0], [12.4, 120.6, 9.4, -0.22, 4.1], [18.6, 122.2, 7.6, -0.3, 3.8],
  ];
  spec.forEach(([x, tip, len, lean, w], i) => {
    const y = tip + len * 0.5;
    // a flat tapered lock lying on the brow (its tip is local +y, turned to point down)
    const back = i < 6;
    const q = qMul(faceQ(x, y), qMul(qAxis([0, 0, 1], Math.PI + lean), qAxis([1, 0, 0], back ? 0.42 : 0.26)));
    locks.push({ name: `lock${i}`, shape: "blob", r: [w, len * 0.5 + 1.0, 1.6], p: 2.0, taper: -0.7, pos: onFace(x, y, back ? -0.3 : 0.5), q, mat: "hair", group: "head" });
  });
  return [
    { name: "hairCap", shape: "blob", r: [27.4, 31, 27.6], p: 2.6, taper: 0.12, pos: [0, 118, -2.6], mat: "hair", group: "head" },
    ...locks,
  ];
}

export const TIM = buildFigure({
  sleeves: "tee+watch",
  collar: "crew",
  hair: hair(),
  glasses: glasses(),
  headPaint: [
    layer("blush", [blob([-15.5, 98.5, 19], [5.2, 3.4, 6]), blob([15.5, 98.5, 19], [5.2, 3.4, 6])], { soft: 0.6, noise: 0 }),
    // short sideburns in front of the ears
    layer("hair", [blob([-25.2, 110, 3.2], [4.2, 6, 4.6]), blob([25.2, 110, 3.2], [4.2, 6, 4.6])], { soft: 0.08, noise: 0.04 }),
  ],
});
