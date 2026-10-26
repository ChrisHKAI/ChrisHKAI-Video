// 蜗牛's mascot as a smooth vinyl toy: a white rounded-block head with a "V"
// of ears, red/blue 3D glasses, a red jacket over a white hoodie, grey
// trousers and white sneakers. One part list, read by src/anim.js (motion)
// and, through build/anim.json, by scripts/scene.py.
// Local axes follow Three.js: +y up, +z = the face. Origin = between the
// feet on the ground. Units: metres (modelled in mm).
// Sides are the mascot's own: R = his right = -x (the pointing hand, as on
// the banner), L = his left = +x (the hand that pushes the glasses).

const mm = 0.001;
const M = (v) => v.map((x) => x * mm);

export const COLORS = {
  white: "#F3F1EC",
  hoodie: "#E6E3DD",
  red: "#D5322A",
  redDark: "#A3241D",
  grey: "#77706A",
  sole: "#2C2C31",
  black: "#141416",
  blue: "#2F6BFF",
  lensRed: "#E8352B",
  string: "#5C5C62",
  gold: "#F2C14E",
};

// shape: roundBox (size, radius) | ellipsoid (r) | arc (torus segment)
// rot: Euler XYZ (radians). group: the joint that carries the part.
// mat: a COLORS key; "shine" = the white lens stripes (slightly emissive)
const EAR = 0.6;
const SMILE = Math.PI * 0.75;
export const MASCOT_PARTS = [
  // feet and legs
  ...[-1, 1].flatMap((s) => {
    const g = s < 0 ? "legR" : "legL";
    return [
      { name: `sole${g}`, shape: "roundBox", size: M([13.6, 2.6, 20.6]), radius: 1.2 * mm, pos: M([s * 7.5, 1.3, 2.5]), mat: "sole", group: g },
      { name: `shoe${g}`, shape: "roundBox", size: M([13, 7.4, 20]), radius: 3.4 * mm, pos: M([s * 7.5, 5.2, 2.5]), mat: "white", group: g },
      { name: `lace${g}`, shape: "roundBox", size: M([6.5, 1.2, 5]), radius: 0.5 * mm, pos: M([s * 7.5, 8.8, 7]), mat: "sole", group: g },
      { name: `trouser${g}`, shape: "roundBox", size: M([10.5, 12.5, 10.5]), radius: 3.5 * mm, pos: M([s * 7, 13.8, 0]), mat: "grey", group: g },
    ];
  }),
  // jacket and hoodie
  { name: "jacket", shape: "roundBox", size: M([32, 24, 22]), radius: 6.5 * mm, pos: M([0, 31, 0]), mat: "red", group: "body" },
  { name: "hem", shape: "roundBox", size: M([32.6, 3.6, 22.6]), radius: 1.6 * mm, pos: M([0, 20.6, 0]), mat: "redDark", group: "body" },
  { name: "hoodie", shape: "roundBox", size: M([13, 11, 2.4]), radius: 1.2 * mm, pos: M([0, 38.6, 10.4]), mat: "hoodie", group: "body" },
  { name: "zip", shape: "roundBox", size: M([1.2, 12.5, 1]), radius: 0.4 * mm, pos: M([0, 27.4, 11.1]), mat: "redDark", group: "body" },
  { name: "stringR", shape: "roundBox", size: M([1.0, 5, 1.0]), radius: 0.45 * mm, pos: M([-2.6, 38.6, 11.75]), mat: "string", group: "body" },
  { name: "stringL", shape: "roundBox", size: M([1.0, 5, 1.0]), radius: 0.45 * mm, pos: M([2.6, 38.6, 11.75]), mat: "string", group: "body" },
  { name: "badge", shape: "roundBox", size: M([7, 2.6, 1]), radius: 0.4 * mm, pos: M([9.5, 37.5, 11.1]), mat: "white", group: "body" },
  { name: "collar", shape: "roundBox", size: M([25, 4.6, 19]), radius: 2.2 * mm, pos: M([0, 44.2, -0.5]), mat: "red", group: "body" },
  { name: "hood", shape: "roundBox", size: M([20, 9, 7]), radius: 3.4 * mm, pos: M([0, 44, -10.5]), mat: "hoodie", group: "body" },
  // arms: a sleeve and a mitten hand; the right hand has a pointing finger
  ...[-1, 1].flatMap((s) => {
    const g = s < 0 ? "armR" : "armL";
    const parts = [
      { name: `sleeve${g}`, shape: "roundBox", size: M([9, 19, 9]), radius: 4.3 * mm, pos: M([s * 18.5, 32, 0]), mat: "red", group: g },
      { name: `cuff${g}`, shape: "roundBox", size: M([9.6, 2.6, 9.6]), radius: 1.2 * mm, pos: M([s * 18.5, 23.6, 0]), mat: "redDark", group: g },
      { name: `hand${g}`, shape: "ellipsoid", r: M([5.3, 5.6, 5.3]), pos: M([s * 18.5, 19.6, 0.4]), mat: "white", group: g },
    ];
    parts.push({ name: s < 0 ? "finger" : "fingerL", shape: "roundBox", size: M([2.8, 7.5, 2.8]), radius: 1.3 * mm, pos: M([s * 18.5, 14.4, 2.2]), mat: "white", group: s < 0 ? "finger" : "fingerL" });
    return parts;
  }),
  // head, glasses, smile, ears
  { name: "head", shape: "roundBox", size: M([50, 41, 40]), radius: 11 * mm, pos: M([0, 66.5, 0]), mat: "white", group: "head" },
  { name: "frame", shape: "roundBox", size: M([36, 13, 3.4]), radius: 1.6 * mm, pos: M([0, 69, 20.6]), mat: "black", group: "head" },
  { name: "frameR", shape: "roundBox", size: M([10, 13, 3.4]), radius: 1.4 * mm, pos: M([-21.3, 69, 16.9]), rot: [0, -0.85, 0], mat: "black", group: "head" },
  { name: "frameL", shape: "roundBox", size: M([10, 13, 3.4]), radius: 1.4 * mm, pos: M([21.3, 69, 16.9]), rot: [0, 0.85, 0], mat: "black", group: "head" },
  { name: "templeR", shape: "roundBox", size: M([1.6, 2.6, 20]), radius: 0.6 * mm, pos: M([-25.3, 71, 3]), mat: "black", group: "head" },
  { name: "templeL", shape: "roundBox", size: M([1.6, 2.6, 20]), radius: 0.6 * mm, pos: M([25.3, 71, 3]), mat: "black", group: "head" },
  { name: "lensBlue", shape: "roundBox", size: M([15.4, 9, 1.0]), radius: 0.45 * mm, pos: M([-9, 69, 22.4]), mat: "blue", group: "head" },
  { name: "lensRed", shape: "roundBox", size: M([15.4, 9, 1.0]), radius: 0.45 * mm, pos: M([9, 69, 22.4]), mat: "lensRed", group: "head" },
  ...[-9, 9].flatMap((x) => [
    { name: `shineA${x}`, shape: "roundBox", size: M([1.7, 8.2, 0.4]), radius: 0.2 * mm, pos: M([x - 2.2, 69, 22.95]), rot: [0, 0, -0.55], mat: "shine", group: "head" },
    { name: `shineB${x}`, shape: "roundBox", size: M([0.9, 6.4, 0.4]), radius: 0.2 * mm, pos: M([x + 1.4, 69, 22.95]), rot: [0, 0, -0.55], mat: "shine", group: "head" },
  ]),
  { name: "smile", shape: "arc", radius: 2.9 * mm, tube: 0.7 * mm, arc: SMILE, pos: M([0, 56.5, 20.2]), rot: [0, 0, -Math.PI / 2 - SMILE / 2], mat: "black", group: "head" },
  { name: "stem", shape: "roundBox", size: M([13, 7, 9.5]), radius: 3.8 * mm, pos: M([0, 88, 0]), mat: "white", group: "ears" },
  { name: "earR", shape: "roundBox", size: M([12.5, 27, 9]), radius: 5.2 * mm, pos: M([-11.5 * Math.sin(EAR), 89.5 + 11.5 * Math.cos(EAR), 0]), rot: [0, 0, EAR], mat: "white", group: "ears" },
  { name: "earL", shape: "roundBox", size: M([12.5, 27, 9]), radius: 5.2 * mm, pos: M([11.5 * Math.sin(EAR), 89.5 + 11.5 * Math.cos(EAR), 0]), rot: [0, 0, -EAR], mat: "white", group: "ears" },
];

// joints: where each group turns (hero-local) and its parent joint
export const JOINTS = {
  body: { p: M([0, 20, 0]), parent: null },
  head: { p: M([0, 46, 0]), parent: "body" },
  ears: { p: M([0, 87, 0]), parent: "head" },
  armR: { p: M([-17, 40, 0]), parent: "body" },
  armL: { p: M([17, 40, 0]), parent: "body" },
  finger: { p: M([-18.5, 18.2, 2.2]), parent: "armR" }, // folds into the mitten unless pointing
  fingerL: { p: M([18.5, 18.2, 2.2]), parent: "armL" },
  legR: { p: M([-7, 19, 0]), parent: null },
  legL: { p: M([7, 19, 0]), parent: null },
};

export const HEIGHT = 0.113;
export const CENTER = M([0, 50, 0]); // flips and squashes turn around here
