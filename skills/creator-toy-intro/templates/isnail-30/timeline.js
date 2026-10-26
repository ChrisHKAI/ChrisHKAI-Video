// One layout, three readers: the UI builder (scripts/build-ui.mjs), the motion
// (src/anim.js → Blender) and the sound script (through build/timeline.json).
// Layout is in UI pixels on a 1920x1440 X (dark mode) workspace; 1 UI px =
// 1 mm in the 3D world. Every time is film seconds. 120 BPM: a beat is 0.5 s,
// a bar 2 s; 12 bars of story, then the call to action to 30 s; every big hit
// sits on a downbeat.

export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = 30.0;
export const bar = (n, beat = 0) => +(n * BAR + beat * BEAT).toFixed(4);

export const UI_W = 1920;
export const UI_H = 1440;
export const UI_SCALE = 2; // ui.png is rendered at 3840x2880

// ── Slabs [x, y, w, h]: X's three columns, the main one cut into its parts ─
const MX = 600, MW = 600;
export const PANELS = {
  nav: [340, 0, 250, 1440],
  header: [MX, 0, MW, 56],
  banner: [MX, 56, MW, 200],
  info: [MX, 256, MW, 330],
  tabs: [MX, 586, MW, 54],
  pinned: [MX, 640, MW, 424],
  retro: [MX, 1064, MW, 376],
  side: [1230, 0, 350, 1440],
};
// the profile picture: a sticker over the banner / info seam
export const AVATAR = { c: [MX + 16 + 67, 256], d: 134, ring: 4 };

// ── Posts ───────────────────────────────────────────────────────────────────
// article card inside a post slab (relative to the slab), cover 5:2
export const CARD = { x: 68, y: 66, w: 516, coverH: 206 };
export const ACTIONS_Y = 396; // action bar row (relative to the slab)
export const ACTION_X = [0, 132, 264, 384]; // replies, reposts, likes, views
export const PINNED = {
  date: "5月31日",
  title: "公众号新号从0到1起号保姆级全阶教程（附SOP、提示词）",
  counts: ["163", "914", "5,018", "304万"],
};
export const RETRO = {
  date: "10月3日",
  title: "9个月，46K粉，变现7W，自媒体很苦，但它是最适合普通人尝试的道路之一",
  counts: ["62", "83", "243", "7.5万"],
};
// the views stat: 304万 lifts out of the action bar as 3D lettering
export const VIEWS = [MX + CARD.x + ACTION_X[3] + 52, PANELS.pinned[1] + ACTIONS_Y];
export const VIEWS_COUNT = 304; // 万
// the pinned post's cover: it stands up as a wall in act 2 (hinge = bottom edge)
export const PINNED_COVER = [MX + CARD.x, PANELS.pinned[1] + CARD.y, CARD.w, CARD.coverH];
// the retrospective post rises below the pinned one in act 3 (assets/retro.png)
export const RETRO_RECT = [MX, PANELS.pinned[1] + PANELS.pinned[3] + 24, MW, PANELS.pinned[3]];
// its cover: the wall's hinge is the cover's bottom edge
export const RETRO_COVER = [MX + CARD.x, RETRO_RECT[1] + CARD.y, CARD.w, CARD.coverH];

// ── Story (film seconds) ────────────────────────────────────────────────────
export const EV = {
  glint: 0.6, // the flat avatar's glasses flash
  peel: [1.0, 1.9],
  pop: bar(1), // 2.0 the sticker puffs into the toy
  land: 2.4,
  push: [2.75, 3.7], // pushes his 3D glasses, lens glint at 3.25
  lensGlint: 3.25,
  hops: [[4.0, 4.5], [4.55, 5.2]], // down the profile onto the pinned post
  click: bar(3), // 6.0 stomps the post = click
  focus: [6.0, 6.8], // the post lifts and lights up, the rest sinks away
  stand2: [6.05, 6.75], // its cover stands up as a wall; the pieces push out (WALL2)
  hopOff: [6.08, 6.45], // he bounces off the cover before it stands
  walk: [6.9, 7.45], // along the action bar to the views
  point: 7.5,
  count: [bar(4), 9.75], // 8.0 304万 lifts out of the post and counts up
  lock: bar(5), // 10.0 304万
  cheer: [10.1, 10.8],
  retroIn: [10.6, 11.4], // the retrospective post rises beside it
  leap: [11.45, 12.25], // onto its cover
  sink2: [11.6, 12.3], // the pinned post and its wall go down behind him
  stand: [12.0, 12.8], // the cover stands up as a wall, 1.2x
  slam: 13.0, // 自媒体很苦 punches out of the wall
  rise9: [14.0, 15.6], // nine clunks, one a month
  climb9: [15.55, 15.95],
  rise46: [16.0, 17.2],
  climb46: [17.45, 17.95],
  point7: 18.4,
  rise7: [18.5, 19.0],
  arrow: [19.0, 19.35],
  peak: bar(10), // 20.0
  settle: [20.0, 21.8], // camera squares up to the cover's own framing
  tagGlint: 20.6,
  toSticker: [21.35, 21.7], // he steps onto the 2D sticker's spot and takes its pose
  flat: [22.0, 22.6], // poof: he is the flat sticker card, pressed back in with the boxes
  flatLand: 22.45, // the card is flush: the cover shows the drawing again, the card goes
  peel2: [23.8, 24.0], // the sticker peels back off the same spot…
  // the call to action: 公众号变现找蜗牛
  repop: bar(12), // 24.0 …and pops into the toy on the downbeat
  cut: 24.4 - 1 / 60, // between two frames: no frame's shutter spans the cut
  logo: [24.39, 24.7], // the 公众号 mark drops in, spinning
  snail: [24.7, 25.0], // …and grows a snail under it: it is the shell
  eyes: [24.9, 25.1],
  ride: 25.15, // he lands on the shell
  push2: [25.25, 25.75],
  glint2: 25.5,
  glide: [25.9, 27.9], // the snail crawls; its trail spells the line
  letters: 26.0, // first letter, then one per 8th note
  final: bar(14), // 28.0 he points at you
  name: 28.0, // 蜗牛King 👑 / @isnail pop up in the space above the line, then hold
  crown: [28.36, 28.62],
};
export const SLOGAN = "公众号变现找蜗牛";
export const SLOGAN_RED = 5; // 找蜗牛 in red
export const CTA = [100, 0, 0]; // the CTA stage: far beyond every other shot's clip distance

// ── Places (UI px) ──────────────────────────────────────────────────────────
export const SPOT = {
  pop: [AVATAR.c[0], AVATAR.c[1] + 58],
  land: [AVATAR.c[0] + 122, 312],
  hop1: [870, 540],
  post: [900, 800],
  hop2: [1060, 960],
  views: [1184, 1042], // right of the post: the stat floats below it
  front: [RETRO_COVER[0] + 250, RETRO_COVER[1] + RETRO_COVER[3] + 112],
  front2: [PINNED_COVER[0] + 232, PINNED_COVER[1] + PINNED_COVER[3] + 52],
};
// act 2, the pinned cover's pieces (scripts/cover-pinned.py): [push-out time, depth mm].
// The stage first, then the title one character per 16th, the 1 on the downbeat.
export const WALL2 = {
  stage: [6.75, 70], boards: [6.875, 14], stairs0: [6.9, 50], stairs1: [6.95, 50],
  t0: [7.0, 40], t1: [7.125, 40], t2: [7.25, 40], t3: [7.375, 40], t4: [7.5, 40], cong: [7.625, 42],
  zero: [7.75, 75], dao: [7.875, 40], one: [8.0, 80],
  qihao: [8.25, 30], quanjie: [8.375, 30], tag: [8.5, 16], rinei: [8.625, 20],
  notebook: [8.75, 34], card: [8.875, 34], phone: [9.0, 40], board: [9.125, 42], board_ink: [9.125, 46],
  seat: [9.25, 26], stand: [9.375, 26],
};
// act 3, on the wall (wall mm: x from the centre, y up from the bottom edge,
// z out of the picture). Box tops are where he can stand.
export const WALL = {
  ledge: { piece: "tag", depth: 70, at: [40, 59.5] },
  box9: { piece: "box9", depth: 60, at: [-150, 109] },
  box46: { piece: "box46", depth: 75, at: [8, 143.5] },
  box7: { piece: "box7", depth: 95 },
  title: { piece: "title", depth: 30 },
  arrow: { piece: "arrow", depth: 18 },
};

// ── The cover wall (act 3): cover px of build/cover.png → mm on the wall ────
export const COVER_MM = 640; // wall width once it stands up (1.24x the card)

// ── Camera keys ─────────────────────────────────────────────────────────────
// target: [UI x, UI y, height mm] or a tracker name (hero, counter, wall).
// dist m, elev / az deg (az 0 = from the south edge), fstop.
export const CAMERA = [
  { t: 0.0, target: [880, 560, 0], dist: 1.55, elev: 44, az: -24, fstop: 8 },
  { t: 1.0, target: [AVATAR.c[0] + 10, AVATAR.c[1] + 20, 20], dist: 0.75, elev: 28, az: -10, fstop: 5 },
  { t: 1.9, target: [AVATAR.c[0] + 10, AVATAR.c[1] + 10, 50], dist: 0.55, elev: 16, az: -4, fstop: 4 },
  { t: 2.4, target: "hero", dist: 0.5, elev: 14, az: 6, fstop: 3.5 },
  { t: 3.5, target: "hero", dist: 0.38, elev: 12, az: 14, fstop: 3.2 },
  { t: 4.0, target: "hero", dist: 0.5, elev: 24, az: 4, fstop: 4 },
  { t: 5.2, target: "hero", dist: 0.6, elev: 32, az: -14, fstop: 4.5 },
  { t: 6.0, target: "hero", dist: 0.52, elev: 30, az: -18, fstop: 4.5 },
  { t: 6.8, target: [926, 912, 140], dist: 1.0, elev: 12, az: -34, fstop: 7 },
  { t: 7.6, target: [926, 912, 140], dist: 0.88, elev: 10, az: -26, fstop: 7 },
  { t: 8.3, target: [940, 950, 120], dist: 0.95, elev: 13, az: -12, fstop: 7.5 },
  { t: 9.2, target: [945, 970, 110], dist: 0.95, elev: 15, az: 6, fstop: 7.5 },
  { t: 9.8, target: [945, 970, 110], dist: 0.95, elev: 16, az: 13, fstop: 7.5 },
  { t: 10.2, target: [945, 970, 110], dist: 0.98, elev: 16, az: 16, fstop: 7.5 },
  { t: 10.9, target: [960, 1120, 40], dist: 0.9, elev: 30, az: 10, fstop: 6 },
  { t: 11.7, target: "wall", dist: 0.95, elev: 22, az: 14, fstop: 6 },
  { t: 12.8, target: "wall", dist: 0.82, elev: 12, az: 18, fstop: 5.6 },
  { t: 13.4, target: "hero", dist: 0.5, elev: 10, az: 20, fstop: 4 },
  { t: 14.2, target: "hero", dist: 0.56, elev: 12, az: 28, fstop: 4 },
  { t: 16.0, target: "hero", dist: 0.62, elev: 14, az: 16, fstop: 4.5 },
  { t: 17.7, target: "hero", dist: 0.82, elev: 8, az: 8, fstop: 5 },
  { t: 18.4, target: "hero", dist: 0.62, elev: 12, az: 4, fstop: 4.5 },
  { t: 19.2, target: "wall", dist: 0.82, elev: 10, az: -16, fstop: 5.6 },
  { t: 20.4, target: "wall", dist: 0.92, elev: 4, az: -6, fstop: 8 },
  { t: 21.8, target: "wallFront", dist: 0.8, elev: 0, az: 0, fstop: 11 },
  { t: 22.6, target: "wallFront", dist: 0.8, elev: 0, az: 0, fstop: 11 },
  { t: 24.0, target: "wallFront", dist: 0.92, elev: 3, az: 0, fstop: 11 },
  { t: 24.4, target: "wallFront", dist: 0.86, elev: 4, az: 0, fstop: 11 },
];
// after the cut: the CTA stage (target in metres from CTA)
export const CAMERA2 = [
  { t: 24.3833, target: [-0.4, 0.16, 0], dist: 1.05, elev: 9, az: 8, fstop: 9 },
  { t: 25.2, target: [-0.4, 0.21, 0], dist: 0.78, elev: 8, az: 12, fstop: 7 },
  { t: 25.8, target: [-0.36, 0.21, 0], dist: 0.72, elev: 8, az: 10, fstop: 7 },
  { t: 26.9, target: [-0.08, 0.15, 0], dist: 1.2, elev: 9, az: 4, fstop: 9 },
  { t: 28.0, target: [0.07, 0.15, 0.02], dist: 1.45, elev: 9, az: 0, fstop: 10 },
  { t: 29.0, target: [0.05, 0.16, 0.02], dist: 1.45, elev: 9, az: 0, fstop: 10 },
  { t: 30.0, target: [0.05, 0.16, 0.02], dist: 1.45, elev: 9, az: 0, fstop: 10 },
];
export const FOV = 30;
// 2–3 frame shakes on hits: [t, strength]
export const SHAKES = [[2.0, 0.4], [6.0, 0.35], [10.0, 0.7], [13.0, 1.2], [17.95, 0.3], [20.0, 0.6], [24.7, 0.4], [28.0, 0.5]];

// ── Sound cues derived from the same numbers ────────────────────────────────
export function soundCues() {
  const cues = [];
  const add = (t, kind, extra = {}) => cues.push({ t: +t.toFixed(4), kind, ...extra });
  const E = EV;
  add(E.glint, "glint", { soft: true });
  add(E.peel[0], "peel", { dur: E.peel[1] - E.peel[0] + 0.1 });
  add(E.pop, "pop");
  add(E.pop + 0.05, "tinkles", { dur: 1.2 });
  add(E.land, "pomf");
  add(E.lensGlint, "glint");
  E.hops.forEach(([a, b]) => { add(a, "boing"); add(b, "pomf"); });
  add(E.click - 0.32, "boing", { soft: true });
  add(E.click, "click");
  add(E.focus[0] + 0.05, "sink", { dur: 0.9 });
  // act 2: the pinned cover stands, its pieces push out (the title as a rising line)
  add(E.hopOff[0], "boing", { soft: true }); add(E.hopOff[1], "pomf", { soft: true });
  add(E.stand2[0], "stand", { dur: E.stand2[1] - E.stand2[0] });
  const LINE = ["G4", "A4", "B4", "D5", "E5", "G5"];
  Object.entries(WALL2).forEach(([name, [at]]) => {
    const i = ["t0", "t1", "t2", "t3", "t4", "cong"].indexOf(name);
    if (i >= 0) add(at, "push", { note: LINE[i] });
    else if (name === "zero" || name === "one") add(at, "tower", { big: name === "one" });
    else if (name !== "board_ink") add(at, "push", { soft: true });
  });
  add(E.walk[0], "boing", { soft: true }); add(7.2, "pomf", { soft: true });
  add(7.2, "boing", { soft: true }); add(E.walk[1], "pomf", { soft: true });
  add(E.point, "ding", { note: "B5" });
  add(E.count[0] + 0.12, "ticker", { dur: E.count[1] - E.count[0] - 0.12 });
  add(E.lock, "lock");
  add(E.lock + 0.02, "sparkle");
  add(10.15, "boing"); add(10.55, "pomf");
  add(E.retroIn[0], "whooshUp", { dur: E.retroIn[1] - E.retroIn[0] });
  add(E.leap[0], "boing", { long: true });
  add(E.leap[0] + 0.1, "whoosh", { dur: 0.6 });
  add(E.sink2[0], "sink", { dur: 0.7 });
  // act 3: the retrospective cover
  add(E.stand[0] + 0.05, "pomf");
  add(E.stand[0], "stand", { dur: E.stand[1] - E.stand[0] });
  add(12.35, "slide", { dur: 0.3 });
  add(12.7, "boing", { soft: true }); add(12.95, "pomf", { soft: true });
  add(12.72, "whoosh", { dur: 0.28 });
  add(E.slam, "slam");
  add(E.slam + 0.03, "debris", { dur: 1.1 });
  for (let i = 0; i < 9; i++) add(E.rise9[0] + i * 0.175 + 0.07, "wood", { i });
  add(E.climb9[0], "boing"); add(E.climb9[1], "pomf");
  add(E.rise46[0], "slide", { dur: E.rise46[1] - E.rise46[0], long: true });
  add(E.climb46[0], "boing"); add(E.climb46[1], "pomf");
  add(E.point7, "ding", { note: "D6" });
  add(E.rise7[0], "whooshUp", { dur: E.rise7[1] - E.rise7[0], fast: true });
  add(E.rise7[1], "slam", { soft: true });
  add(E.arrow[0], "boing", { long: true });
  add(E.peak, "lock", { big: true });
  add(E.peak + 0.02, "coins", { dur: 0.9 });
  add(E.tagGlint, "glint");
  add(E.toSticker[0], "boing", { soft: true }); add(E.toSticker[1], "pomf", { soft: true });
  add(E.flat[0], "pop", { soft: true });
  add(E.flat[0] + 0.05, "suck", { dur: E.flatLand - E.flat[0] - 0.05 });
  add(E.flatLand, "slap", { i: 0 });
  add(E.flatLand + 0.05, "glint", { soft: true });
  add(E.peel2[0], "peel", { dur: E.peel2[1] - E.peel2[0] });
  // the call to action
  add(E.repop, "pop");
  add(E.repop + 0.06, "whoosh", { dur: E.cut - E.repop });
  add(E.logo[0], "whooshDown", { dur: E.logo[1] - E.logo[0] });
  add(E.logo[1], "land");
  add(E.snail[0], "squelch", { dur: E.snail[1] - E.snail[0] + 0.1 });
  add(E.eyes[0], "boing", { soft: true }); add(E.eyes[0] + 0.1, "boing", { soft: true });
  add(E.ride, "pomf");
  add(E.glint2, "glint");
  add(E.glide[0], "glide", { dur: E.glide[1] - E.glide[0] });
  const TUNE = ["G5", "A5", "B5", "D6", "E6", "G6", "A6", "B6"];
  [...SLOGAN].forEach((_, i) => add(EV.letters + i * BEAT / 2, "letter", { note: TUNE[i], red: i >= SLOGAN_RED }));
  add(E.final, "lock", { big: true });
  add(E.final + 0.02, "sparkle");
  add(E.final + 0.15, "glint");
  // the torn-paper labels slap on; the name's letters pop; the crown lands
  [EV.letters - 0.06, EV.letters + 5 * BEAT / 2 - 0.06, E.name, E.name + 0.18].forEach((at, i) => add(at, "slap", { i }));
  for (let i = 0; i < 6; i++) add(E.name + 0.05 + 0.05 * i, "namePop", { i });
  add(E.name + 0.22, "namePop", { i: 6, handle: true });
  add(E.crown[1], "crown");
  add(E.crown[1] + 0.05, "sparkle");
  return cues.sort((a, b) => a.t - b.t);
}
