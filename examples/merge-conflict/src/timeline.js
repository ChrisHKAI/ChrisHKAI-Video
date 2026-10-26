// One layout, three readers: the UI builder, the atlas painter, the motion
// (src/anim.js → Blender) and the sound script (through build/timeline.json)
// all read this file. Layout is in UI pixels on a 1920x1080 workspace;
// 1 UI px = 1 mm in the 3D world. Every time is film seconds. 150 BPM: a beat
// is 0.4 s, a bar 1.6 s, 12 bars = 19.2 s; every big hit sits on a downbeat.

export const FPS = 30;
export const BPM = 150;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = BAR * 12;
export const bar = (n, beat = 0) => +(n * BAR + beat * BEAT).toFixed(4);

export const UI_W = 1920;
export const UI_H = 1080;
export const UI_SCALE = 2; // ui.png is rendered at 3840x2160

// ── Panels [x, y, w, h] (floating glass slabs) ──────────────────────────────
export const PANELS = {
  titlebar: [0, 0, 1920, 40],
  explorer: [4, 44, 356, 692],
  editor: [364, 44, 1300, 692],
  minimap: [1668, 44, 248, 692],
  scm: [4, 740, 356, 296],
  terminal: [364, 740, 1552, 296],
  statusbar: [0, 1040, 1920, 40],
};

// ── Editor ──────────────────────────────────────────────────────────────────
// The code area is painted per frame into the atlas (scripts/atlas.html)
export const CODE = [364, 112, 1300, 624];
export const ROW_H = 42;
export const ROW_TOP = 124;
export const GUTTER_X = 440; // line numbers are right-aligned here
export const CODE_X = 480;
export const CODE_FONT = 25;
export const CHAR_W = CODE_FONT * 0.602; // Menlo advance
export const rowCenterY = (r) => ROW_TOP + r * ROW_H + ROW_H / 2;
export const colX = (c) => CODE_X + c * CHAR_W;

// kind: code | lens | ours | theirs | mark (marker lines). n = line number
export const ROWS = [
  { n: 1, text: "import random" },
  { n: 2, text: "from agents import claude, deepseek" },
  { n: 3, text: "" },
  { n: 4, text: "def build_team():" },
  { n: 5, text: "    team = []" },
  { kind: "lens" },
  { n: 6, text: "<<<<<<< HEAD (Claude)", kind: "markOurs" },
  { n: 7, text: "    team.append(claude)", kind: "ours" },
  { n: 8, text: "=======", kind: "markMid" },
  { n: 9, text: "    team.append(deepseek)", kind: "theirs" },
  { n: 10, text: ">>>>>>> deepseek", kind: "markTheirs" },
  { n: 11, text: "    return team" },
  { n: 12, text: "" },
  { n: 13, text: "print(build_team())" },
];
// The codelens row: plain links and the raised "Accept Both" button
export const LENS_ROW = 5;
export const ACCEPT_BOTH = [968, 336, 254, 38];
export const LENS_FONT = 19;

// ── Terminal and status bar (also painted per frame) ────────────────────────
export const TERM = [368, 772, 1544, 260];
export const TERM_FONT = 22;
export const TERM_LINE = 30;
export const TERM_CHAR_W = TERM_FONT * 0.602;
export const PROMPT = "~/team-project (main|MERGING) $ ";
export const STATUS = PANELS.statusbar;

// ── Explorer file rows (static) ─────────────────────────────────────────────
export const FILES = [
  { name: "TEAM-PROJECT", depth: 0, folder: true, open: true },
  { name: "agents", depth: 1, folder: true, open: true },
  { name: "claude.py", depth: 2 },
  { name: "deepseek.py", depth: 2 },
  { name: "main.py", depth: 1, conflict: true, selected: true },
  { name: "tests", depth: 1, folder: true },
  { name: "README.md", depth: 1 },
  { name: "requirements.txt", depth: 1 },
];
export const FILE_ROW_TOP = 128;
export const FILE_ROW_H = 40;
export const fileRowY = (i) => FILE_ROW_TOP + i * FILE_ROW_H + FILE_ROW_H / 2;

// ── Story (film seconds) ────────────────────────────────────────────────────
export const EV = {
  termLines: [0.15, 0.45, 0.75], // Auto-merging / CONFLICT / Automatic merge failed
  markerPulse: [0.0, 1.6],
  charge: [1.6, 2.8],
  dash: [2.8, bar(2)],
  hit: bar(2), // 3.2 headbutt, whale bursts
  burstHang: [3.2, 3.5],
  ctrlZ: [3.45, 3.95],
  rewind: [3.55, 3.85],
  whaleLand: 3.85,
  swipe: bar(2, 2), // 4.0 tail swipe
  clawdFly: [bar(2, 2), bar(3)], // 4.0 → 4.8 into the file tree
  typeKeys: [6.6, 6.7, 6.8, 6.9, 7.0, 7.1],
  typed: "rm -rf deepseek/",
  enter: bar(4, 2), // 7.2 beam fires
  spout: bar(5), // 8.0 spout meets the beam
  clashEnd: bar(6), // 9.6 both cut out
  leap: bar(6, 1), // 10.0
  contact: bar(6, 3), // 10.8 mid-air, freeze
  explode: bar(7), // 11.2
  settle: 12.35,
  reassemble: [bar(8), 13.45],
  dizzy: [13.3, 14.4],
  shrug: [bar(9), 14.95],
  acceptHop: [bar(9, 2), bar(9, 3)], // 15.2 → 15.6 land on Accept Both
  merge: [15.6, 16.0],
  swapBack: [bar(10), 16.4],
  commit: [16.0, 16.35],
  buildPassed: bar(10, 1), // 16.4
  happy: [bar(10, 1), bar(10, 2), bar(10, 3)],
  bumpHop: [17.75, bar(11, 1)], // bump at 18.0
  title: [18.0, 18.7],
};
export const LINE_LIGHTS = [
  { row: 3, t: 5.2 },
  { row: 7, t: 5.6 },
  { row: 10, t: 6.0 },
];

// ── Places (UI px, height mm) ───────────────────────────────────────────────
export const SPOT = {
  clawd0: [600, rowCenterY(7)],
  whale0: [930, rowCenterY(9) - 6],
  contact: [890, rowCenterY(7) + 8],
  clawdRecoil: [848, rowCenterY(7) - 2],
  tree: [196, fileRowY(4)],
  l4: [436, rowCenterY(3)],
  l7: [436, rowCenterY(7)],
  l10: [436, rowCenterY(10)],
  term: [736, 772 + 3.5 * TERM_LINE + 4],
  whale1: [1170, 548],
  whale2: [1400, 566],
  clawdR: [960, 610],
  whaleR: [1200, 610],
  clawdBtn: [1034, 352],
  whaleBtn: [1150, 352],
  clawdBump: [1060, 350],
  whaleBump: [1124, 350],
};
export const BUTTON_H = 3; // mm the Accept Both button stands proud
export const CONTACT_H = 150; // mm above the slab where they collide

// Hops: from → to, take-off t0 → landing t1, apex (m above the higher end)
export const CLAWD_HOPS = [
  { from: "contact", to: "clawdRecoil", t0: 3.2, t1: 3.6, apex: 0.03 },
  { from: "clawdRecoil", to: "tree", t0: 4.0, t1: 4.8, apex: 0.2, tumble: true },
  { from: "tree", to: "l4", t0: 4.9, t1: 5.2, apex: 0.07 },
  { from: "l4", to: "l7", t0: 5.32, t1: 5.6, apex: 0.06 },
  { from: "l7", to: "l10", t0: 5.72, t1: 6.0, apex: 0.06 },
  { from: "l10", to: "term", t0: 6.06, t1: 6.4, apex: 0.11, flip: true },
];
export const WHALE_HOPS = [
  { from: "whale0", to: "whale1", t0: 4.9, t1: 5.2, apex: 0.06 },
  { from: "whale1", to: "whale2", t0: 5.3, t1: 5.6, apex: 0.07 },
];

// ── Camera keys ─────────────────────────────────────────────────────────────
// target: [UI x, UI y, height mm] or a tracker name (clawd, whale, pair,
// clash, contact). dist m, elev / az deg (az 0 = from the south edge).
export const CAMERA = [
  { t: 0.0, target: [1000, 520, 0], dist: 2.0, elev: 46, az: -18, fstop: 8 },
  { t: 1.5, target: "pair", dist: 0.82, elev: 34, az: -8, fstop: 5 },
  { t: 2.2, target: "pair", dist: 0.64, elev: 24, az: 12, fstop: 4.5 },
  { t: 2.95, target: "pair", dist: 0.48, elev: 16, az: 28, fstop: 3.5 },
  { t: 3.2, target: "contact", dist: 0.42, elev: 18, az: 30, fstop: 3.2 },
  { t: 3.7, target: "whale", dist: 0.5, elev: 20, az: 14, fstop: 3.5 },
  { t: 4.05, target: "pair", dist: 0.55, elev: 26, az: 0, fstop: 4 },
  { t: 4.5, target: "clawd", dist: 0.6, elev: 34, az: -18, fstop: 4 },
  { t: 4.9, target: "clawd", dist: 0.46, elev: 32, az: -24, fstop: 3.5 },
  { t: 5.8, target: "clawd", dist: 0.46, elev: 30, az: -8, fstop: 3.5 },
  { t: 6.45, target: "clawd", dist: 0.4, elev: 26, az: 8, fstop: 3.2 },
  { t: 7.05, target: "clawd", dist: 0.36, elev: 22, az: 16, fstop: 3.2 },
  { t: 7.55, target: "clash", dist: 0.98, elev: 34, az: 20, fstop: 6 },
  { t: 8.05, target: "clash", dist: 0.86, elev: 30, az: 24, fstop: 5.6 },
  { t: 9.0, target: "clash", dist: 0.78, elev: 27, az: 30, fstop: 5 },
  { t: 9.6, target: "pair", dist: 1.0, elev: 30, az: 16, fstop: 5.6 },
  { t: 10.3, target: "pair", dist: 0.66, elev: 16, az: -40, fstop: 4 },
  { t: 10.8, target: "contact", dist: 0.42, elev: 8, az: -92, fstop: 3.2 },
  { t: 11.2, target: "contact", dist: 0.44, elev: 12, az: 88, fstop: 3.2 },
  { t: 11.75, target: [1068, 730, 15], dist: 0.64, elev: 48, az: 36, fstop: 5 },
  { t: 12.7, target: [1068, 700, 0], dist: 0.6, elev: 50, az: 18, fstop: 5 },
  { t: 13.3, target: "pair", dist: 0.6, elev: 30, az: 6, fstop: 4.5 },
  { t: 14.3, target: "pair", dist: 0.5, elev: 22, az: -4, fstop: 4 },
  { t: 15.1, target: "pair", dist: 0.52, elev: 26, az: -2, fstop: 4 },
  { t: 15.65, target: "pair", dist: 0.56, elev: 30, az: 4, fstop: 4.5 },
  { t: 16.35, target: [1010, 690, 0], dist: 1.3, elev: 50, az: -4, fstop: 7 },
  { t: 17.2, target: [1020, 690, 0], dist: 1.32, elev: 50, az: 2, fstop: 7 },
  { t: 17.75, target: "pair", dist: 0.52, elev: 22, az: 0, fstop: 4.5 },
  { t: 18.1, target: "pair", dist: 0.48, elev: 20, az: 2, fstop: 4.5 },
  { t: 19.2, target: [1092, 290, 48], dist: 0.84, elev: 19, az: 0, fstop: 5.6 },
];
export const FOV = 30;
// 2–3 frame shakes on hits: [t, strength]
export const SHAKES = [
  [3.2, 1.0], [4.0, 0.6], [7.2, 0.5], [8.0, 0.9], [10.8, 0.5], [11.2, 1.3], [15.6, 0.35], [18.0, 0.3],
];

// ── Sound cues derived from the same numbers ────────────────────────────────
export function soundCues() {
  const cues = [];
  const add = (t, kind, extra = {}) => cues.push({ t: +t.toFixed(4), kind, ...extra });
  EV.termLines.forEach((t, i) => add(t, i === 1 ? "error" : "tick"));
  add(EV.charge[0], "rumble", { dur: EV.dash[0] - EV.charge[0] + 0.4 });
  add(EV.dash[0], "whoosh", { dur: 0.4 });
  add(EV.hit, "impact", { big: true });
  add(EV.hit, "burst");
  add(EV.ctrlZ[0], "keyClick");
  add(EV.rewind[0], "rewind", { dur: EV.rewind[1] - EV.rewind[0] });
  add(EV.whaleLand, "pomf");
  add(EV.swipe - 0.12, "whoosh", { dur: 0.25 });
  add(EV.swipe, "impact");
  add(EV.swipe + 0.05, "whoosh", { dur: 0.75 });
  for (const h of [...CLAWD_HOPS.slice(2), ...WHALE_HOPS]) { add(h.t0, "boing"); add(h.t1, "pomf"); }
  add(CLAWD_HOPS[1].t1, "pomf");
  LINE_LIGHTS.forEach((l, i) => add(l.t, "ding", { note: ["E6", "G6", "B6"][i] }));
  EV.typeKeys.forEach((t) => add(t, "keyTap"));
  add(EV.enter, "enter");
  add(EV.enter, "laser", { dur: EV.clashEnd - EV.enter });
  add(EV.spout - 0.3, "spout", { dur: EV.clashEnd - EV.spout + 0.3 });
  add(EV.spout, "impact", { big: true });
  add(EV.spout, "sizzle", { dur: EV.clashEnd - EV.spout });
  add(EV.clashEnd, "cutoff");
  add(EV.leap, "boing", { long: true });
  add(EV.leap + 0.05, "whoosh", { dur: EV.contact - EV.leap });
  add(EV.contact, "impact");
  add(EV.contact, "freeze", { dur: EV.explode - EV.contact });
  add(EV.explode, "explosion");
  add(EV.explode + 0.35, "tinkles", { dur: EV.settle - EV.explode });
  add(EV.reassemble[0] - 0.05, "rewind", { dur: EV.reassemble[1] - EV.reassemble[0] + 0.05 });
  add(EV.dizzy[0] + 0.1, "dizzy", { dur: EV.dizzy[1] - EV.dizzy[0] - 0.2 });
  add(EV.shrug[0], "shrug");
  add(EV.acceptHop[0], "boing");
  add(EV.acceptHop[1], "click");
  add(EV.merge[0] + 0.05, "zip", { dur: EV.merge[1] - EV.merge[0] });
  add(EV.swapBack[0], "sparkle");
  for (let i = 0; i < 9; i++) add(EV.commit[0] + i * 0.04, "keyTap", { soft: true });
  add(EV.buildPassed, "chime");
  EV.happy.forEach((t) => add(t, "pomf", { soft: true }));
  add(EV.bumpHop[0], "boing");
  add(EV.bumpHop[1], "bump");
  add(EV.bumpHop[1] + 0.02, "sparkle");
  "MERGED.".split("").forEach((_, i) => add(EV.title[0] + 0.08 * i + 0.16, "tink", { i }));
  return cues.sort((a, b) => a.t - b.t);
}
