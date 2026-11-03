// Lemomo's lemon (the X avatar): one round lemon with nubs at both ends, a brown
// stem, one dark leaf to its right, two black eyes with a glint, a small smile,
// orange cheeks with three freckles each. An object toy: no arms, no legs.
// node toy.mjs → toy.json
import { writeFileSync } from "node:fs";

const R = [0.035, 0.042, 0.035];            // the lemon: round about y, so the face turns on its skin
const C = [0, 0.046, 0];                     // its centre
// a point on the lemon's skin at (x, y), pushed out (+) or in (−) by d
const skin = (x, y, d = 0) => {
  const zz = 1 - (x / R[0]) ** 2 - ((y - C[1]) / R[1]) ** 2;
  const z = R[2] * Math.sqrt(Math.max(zz, 0));
  const n = [x / R[0] ** 2, (y - C[1]) / R[1] ** 2, z / R[2] ** 2];
  const l = Math.hypot(...n);
  return [x + (n[0] / l) * d, y + (n[1] / l) * d, z + (n[2] / l) * d];
};
// Euler XYZ that turns a part's +z to the skin's normal at (x, y)
const facing = (x, y) => {
  const [px, py, pz] = skin(x, y);
  const n = [px / R[0] ** 2, (py - C[1]) / R[1] ** 2, pz / R[2] ** 2];
  return [-Math.atan2(n[1], Math.hypot(n[0], n[2])), Math.atan2(n[0], n[2]), 0];
};
const r3 = (v) => v.map((a) => +a.toFixed(5));

const smile = [];
for (let i = 0; i <= 8; i++) {
  const t = i / 8, x = -0.0045 + 0.009 * t, y = 0.0425 - 0.0024 * Math.sin(Math.PI * t);
  smile.push(r3(skin(x, y, 0.0002)));
}
const freckles = [];
for (const s of [1, -1]) for (const [dx, dy] of [[-0.0028, -0.0016], [0.0002, -0.0026], [0.0030, -0.0014]]) {
  const x = s * 0.0205 + dx, y = 0.0432 + dy;
  freckles.push({ name: `freckle${freckles.length}`, shape: "ellipsoid", r: [0.0008, 0.0008, 0.0005], pos: r3(skin(x, y, 0.0004)), mat: "freckle", group: "head" });
}

const toy = {
  name: "Lemomo's lemon (@lemomo_ai)",
  body: "object",
  kit: "parts",
  height: 0.106,
  center: [0, 0.05, 0],
  colors: { lemon: "#F6C814", nub: "#ECB40F", leaf: "#1F2A16", rib: "#33402A", stem: "#4A3A1C", eye: "#0B0D10", glint: "#FFFFFF", cheek: "#EE8F2A", freckle: "#C8661E", line: "#3B2410" },
  finish: { eye: "gloss", glint: "emit", line: "gloss", leaf: "matte", rib: "matte", cheek: "soft" },
  joints: {
    body: { p: [0, 0.012, 0], parent: null },
    head: { p: C, parent: "body" },
  },
  signature: { move: "wobble" },
  parts: [
    { name: "lemon", shape: "ellipsoid", r: R, pos: C, mat: "lemon", group: "body" },
    { name: "nubBottom", shape: "tube", pts: [[0, 0.009, 0], [0, 0.0042, 0.0003], [0, 0.0022, 0.0004]], radii: [0.0105, 0.0068, 0.0052], mat: "nub", group: "body" },
    { name: "nubTop", shape: "tube", pts: [[0, 0.082, 0], [0, 0.0895, -0.0004]], radii: [0.0105, 0.0052], mat: "nub", group: "head" },
    { name: "stem", shape: "tube", pts: [[0, 0.0885, -0.0004], [0.0004, 0.0945, -0.0008], [0.0016, 0.0985, -0.0012]], radii: [0.0021, 0.0017, 0.0015], mat: "stem", group: "head" },
    { name: "leaf", shape: "blob", r: [0.0235, 0.0108, 0.0022], p: 1.7, taper: 0, pos: [-0.0205, 0.1075, 0.0035], rot: [0, 0.22, -0.62], mat: "leaf", group: "head" },
    { name: "rib", shape: "tube", pts: [[-0.0012, 0.0950, 0.0050], [-0.0205, 0.1075, 0.0072], [-0.0385, 0.1205, 0.0090]], radii: [0.00075, 0.0006, 0.0003], mat: "rib", group: "head" },
    ...[1, -1].flatMap((s) => {
      const x = s * 0.0135, y = 0.0515;
      return [
        { name: `eye${s > 0 ? "L" : "R"}`, shape: "ellipsoid", r: [0.0049, 0.0066, 0.0024], pos: r3(skin(x, y, -0.0007)), rot: r3(facing(x, y)), mat: "eye", group: "head" },
        { name: `glint${s > 0 ? "L" : "R"}`, shape: "ellipsoid", r: [0.0014, 0.0017, 0.0006], pos: r3(skin(x + 0.0015, y + 0.0026, 0.0012)), mat: "glint", group: "head" },
        { name: `cheek${s > 0 ? "L" : "R"}`, shape: "ellipsoid", r: [0.0058, 0.0036, 0.0007], pos: r3(skin(s * 0.0205, 0.0432, 0.0001)), rot: r3(facing(s * 0.0205, 0.0432)), mat: "cheek", group: "head" },
      ];
    }),
    { name: "mouth", shape: "tube", pts: smile, radii: smile.map(() => 0.00072), mat: "line", group: "head" },
    ...freckles,
  ],
};
writeFileSync(new URL("./toy.json", import.meta.url), JSON.stringify(toy, null, 1) + "\n");
console.log(`toy.json: ${toy.parts.length} parts`);
