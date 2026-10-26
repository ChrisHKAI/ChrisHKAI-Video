// Steve Jobs in the toy line (src/figure.js), as the world knew him: short
// receding grey hair, a short grey beard, round thin silver glasses, the black
// mock turtleneck with its sleeves to the wrists, blue jeans, grey sneakers.
import { qAxis, qMul, qRot } from "../../engine/lib/quat.js";
import { SIDES, buildFigure, faceZ, temple, blob, layer } from "./figure.js";

export const COLORS = {
  skin: "#EDBF9F",
  blush: "#E9B396",
  hair: "#9A9894",
  stubble: "#9A918A",
  beardLight: "#B3A69C",
  shirt: "#141417",
  jeans: "#48688F",
  shoe: "#A2A5AA",
  sole: "#EFEFEB",
  frame: "#CDD0D4",
  lens: "#FFFFFF",
  eyeWhite: "#FBFAF7",
  pupil: "#18120F",
  glint: "#FFFFFF",
  brow: "#77716C",
  mouth: "#5E2023",
  tongue: "#E27E76",
  teeth: "#FBF9F4",
  line: "#4A302A",
};
export const FINISH = { frame: "metal", lens: "glass", glint: "emit" };

// round glasses: thin silver rims, a high thin bridge, thin temples
const LENS = { r: 7.4, y: 107.4, x: 11.3, gap: 3.4, yaw: 0.18 };
function glasses() {
  const parts = [], hinge = {};
  for (const [s, n] of SIDES) {
    const cx = s * LENS.x, z = faceZ(cx, LENS.y) + LENS.gap;
    const q = qAxis([0, 1, 0], s * LENS.yaw);
    const C = [cx, LENS.y, z];
    const P = ([x, y]) => { const r = qRot(q, [x, y, 0]); return [C[0] + r[0], C[1] + r[1], C[2] + r[2]]; };
    const ring = Array.from({ length: 28 }, (_, i) => [LENS.r * Math.cos((2 * Math.PI * i) / 28), LENS.r * Math.sin((2 * Math.PI * i) / 28)]);
    parts.push({ name: `rim${n}`, shape: "loop", pts: ring.map(P), radii: ring.map(() => 0.42), mat: "frame" });
    const disc = Array.from({ length: 32 }, (_, i) => [(LENS.r - 0.35) * Math.cos((2 * Math.PI * i) / 32), -(LENS.r - 0.35) * Math.sin((2 * Math.PI * i) / 32)]);
    parts.push({ name: `lens${n}`, shape: "plate", outline: disc, t: 0.35, bevel: 0.1, pos: C, q: qMul(q, qAxis([1, 0, 0], Math.PI / 2)), mat: "lens" });
    const a = (s > 0 ? 0 : Math.PI) + s * 0.35;
    hinge[n] = { inner: P([-s * LENS.r * 0.93, LENS.r * 0.36]), outer: P([LENS.r * Math.cos(a), LENS.r * Math.sin(a)]) };
    parts.push({ name: `temple${n}`, ...temple(s, hinge[n].outer, LENS.y + 3.2, [0.45, 0.42, 0.42, 0.4, 0.38]), mat: "frame" });
  }
  const a = hinge.R.inner, b = hinge.L.inner;
  parts.push({ name: "bridge", shape: "tube", pts: [a, [0, (a[1] + b[1]) / 2 + 1.2, a[2] + 0.3], b], radii: [0.42, 0.4, 0.42], mat: "frame" });
  return parts;
}

// short receding grey hair: a shell set back on the head (its edge the hairline)
const hair = () => [{ name: "hairCap", shape: "blob", r: [27.2, 30.4, 27.6], p: 2.4, taper: 0.12, pos: [0, 116, -5.5], mat: "hair", group: "head" }];

export const JOBS = buildFigure({
  sleeves: "long",
  collar: "mock",
  hair: hair(),
  glasses: glasses(),
  browRadii: [1.2, 1.3, 1.15, 0.85],
  headPaint: [
    layer("blush", [blob([-15.5, 99, 19], [5, 3.2, 6]), blob([15.5, 99, 19], [5, 3.2, 6])], { soft: 0.6, noise: 0 }),
    // the short beard: chin and jaw, up the cheeks to the sideburns, the moustache
    layer("stubble", [
      blob([0, 87.5, 14], [23.5, 11.5, 16]), blob([-20.5, 95.5, 7], [8, 11, 10]), blob([20.5, 95.5, 7], [8, 11, 10]),
      blob([-25, 104, 2], [4.4, 9, 6]), blob([25, 104, 2], [4.4, 9, 6]), blob([0, 97.3, 21.5], [7.4, 2.0, 4]),
    ], { soft: 0.1, noise: 0.16, speckle: 0.6, speckleWith: "beardLight" }),
    layer("hair", [blob([-25.2, 111, 2.5], [4.0, 5, 4.4]), blob([25.2, 111, 2.5], [4.0, 5, 4.4])], { soft: 0.1, noise: 0.05 }),
  ],
});
