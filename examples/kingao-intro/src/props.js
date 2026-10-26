// Small toys beside the calico, as part lists in the same format as
// src/cat.js (scripts/toy.py builds them): the ambassador's medal.
// Origin = the medal's centre; +z = its face.
const mm = 0.001;
const M = (v) => v.map((x) => x * mm);

export const PROP_COLORS = {
  gold: "#E9B949",
  goldDeep: "#C98F22",
  ribbon: "#D8382D",
  ribbonDark: "#A82720",
};

export const MEDAL_PARTS = [
  // the lanyard up to the neck and the two tails below
  ...[-1, 1].flatMap((s) => [
    { name: `strap${s}`, shape: "roundBox", size: M([3.4, 17, 1]), radius: 0.45 * mm, pos: M([s * 4.6, 9.5, -1.2]), rot: [0, 0, -s * 0.3], mat: "ribbon" },
    { name: `tail${s}`, shape: "roundBox", size: M([4.6, 11, 1]), radius: 0.45 * mm, pos: M([s * 3.2, -8, -1.6]), rot: [0, 0, s * 0.32], mat: "ribbonDark" },
  ]),
  { name: "disc", shape: "blob", r: M([8, 8, 2]), p: 3, pos: M([0, 0, 0]), mat: "gold" },
  { name: "boss", shape: "blob", r: M([5.2, 5.2, 2.3]), p: 2.2, pos: M([0, 0, 0.3]), mat: "goldDeep" },
];

// The Grok bots from Kin's banner stickers, as toys: an orange ball, a black
// ball (Grok bot himself) and a purple hexagon, each with two white capsule
// eyes. Origin = between its feet on the ground; +z = the face.
const eyes = (tilt, dy = 0, z = 13.8) => [-1, 1].map((s) => ({
  name: `eye${s}`, shape: "blob", r: M([3.3, 6.6, 2.2]), p: 2, pos: M([s * 6.6, 22 + (s > 0 ? dy : 0), z]), rot: [0, 0, tilt], mat: "botEye",
}));
export const BOTS = {
  orange: [{ name: "body", shape: "blob", r: M([22, 21, 15]), p: 2.3, pos: M([0, 21, 0]), mat: "botOrange" }, ...eyes(0, -1.6)],
  black: [{ name: "body", shape: "blob", r: M([22, 21, 15]), p: 2.3, pos: M([0, 21, 0]), mat: "botBlack" }, ...eyes(-0.55)],
  purple: [{ name: "body", shape: "prism", sides: 6, r: 23 * mm, depth: 17 * mm, bevel: 5 * mm, pos: M([0, 21, 0]), mat: "botPurple" }, ...eyes(0, 0, 8.9)],
};
export const BOT_H = 0.042;
Object.assign(PROP_COLORS, { botOrange: "#E8573C", botBlack: "#18181B", botPurple: "#8A5BD8", botEye: "#FFFFFF" });
