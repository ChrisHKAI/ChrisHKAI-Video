// One layout, three readers: the UI builder, the Three.js scene and the sound
// script (through build/timeline.json) all read this file. Layout is in UI
// pixels on a 1920x1080 workspace; 1 UI px = 1 mm in the 3D world. Every time
// is film seconds; at 120 BPM a beat is 0.5 s and every landing sits on one.

export const FPS = 30;
export const DURATION = 12;
export const BPM = 120;
export const BEAT = 60 / BPM;

export const UI_W = 1920;
export const UI_H = 1080;
export const UI_SCALE = 2; // ui.png is rendered at 3840x2160

// ── Panels [x, y, w, h] ─────────────────────────────────────────────────────
export const PANELS = {
  menubar: [0, 0, 1920, 86],
  project: [4, 90, 360, 510],
  comp: [368, 90, 900, 510],
  info: [1272, 90, 644, 124],
  preview: [1272, 218, 644, 134],
  effects: [1272, 356, 644, 244],
  timeline: [4, 604, 1912, 472],
};

// The comp image inside the Composition panel (16:9)
export const COMP = [452, 145, 732, 412];
export const COMP_CENTER = [COMP[0] + COMP[2] / 2, COMP[1] + COMP[3] / 2];

// Timecode boxes redrawn every frame on top of the static UI
export const TC_COMP = [600, 566, 132, 30];
export const TC_TIMELINE = [14, 638, 210, 40];

// ── Toolbar ─────────────────────────────────────────────────────────────────
export const TOOLS = [
  "home", "selection", "hand", "zoom", "orbit", "anchor", "rect",
  "pen", "type", "brush", "stamp", "eraser", "roto", "puppet",
];
export const TOOL_SIZE = 46;
export const toolRect = (name) => {
  const i = TOOLS.indexOf(name);
  return [20 + i * 58 + (i > 0 ? 14 : 0), 35, TOOL_SIZE, TOOL_SIZE];
};
export const rectCenter = ([x, y, w, h]) => [x + w / 2, y + h / 2];

// ── Preview transport ───────────────────────────────────────────────────────
export const PREVIEW_BUTTONS = ["first", "prev", "play", "next", "last"];
export const previewRect = (name) => {
  const i = PREVIEW_BUTTONS.indexOf(name);
  return [1330 + i * 70, 244, 50, 40];
};

// ── Effects & Presets rows ──────────────────────────────────────────────────
export const EFFECTS_SEARCH = [1288, 392, 612, 30];
export const EFFECTS_ROWS = [
  { y: 430, depth: 0, text: "Stylize", folder: true, open: true },
  { y: 456, depth: 1, text: "Glow", fx: true, selected: true },
  { y: 482, depth: 0, text: "Animation Presets", folder: true, open: true },
  { y: 508, depth: 1, text: "Image - Special Effects", folder: true, open: true },
  { y: 534, depth: 2, text: "Glow - Neon.ffx", preset: true },
  { y: 560, depth: 2, text: "Glow Pulse.ffx", preset: true },
];
export const GLOW_CHIP = [1316, 456, 104, 26]; // the "fx Glow" label that pops out

// ── Timeline ────────────────────────────────────────────────────────────────
export const TL = {
  rowsTop: 706,
  rowH: 28,
  trackX0: 720, // comp time 0
  trackX1: 1880, // comp time COMP_DURATION
  rulerY: 672,
  bottom: 1040,
};
export const COMP_DURATION = 10;
export const compTimeToX = (ct) => TL.trackX0 + (ct / COMP_DURATION) * (TL.trackX1 - TL.trackX0);
export const xToCompTime = (x) => ((x - TL.trackX0) / (TL.trackX1 - TL.trackX0)) * COMP_DURATION;

export const LAYERS = [
  { name: "MADE WITH CLAUDE", kind: "text", color: "#d5524b" },
  { name: "Spark", kind: "shape", color: "#e0c447" },
  { name: "Swoosh", kind: "shape", color: "#5ec3bd" },
  { name: "OPUS 5.5", kind: "text", color: "#a58bd8" },
  { name: "clawd.png", kind: "image", color: "#d9a676" },
];
// Row order: layer 1 open with Position and Scale under it
export const TL_ROWS = [
  { type: "layer", layer: 0 },
  { type: "prop", name: "Position", value: "960.0,540.0", keyed: true },
  { type: "prop", name: "Scale", value: "100.0,100.0%" },
  { type: "layer", layer: 1 },
  { type: "layer", layer: 2 },
  { type: "layer", layer: 3 },
  { type: "layer", layer: 4 },
];
export const rowCenterY = (i) => TL.rowsTop + i * TL.rowH + TL.rowH / 2;
export const POSITION_ROW_Y = rowCenterY(1);

// Four Position keyframes, one per beat from 6.0 s, at these comp times
export const KEY_COMP_TIMES = [2, 4, 6, 8];
export const KEY_STAMP_TIMES = [6.0, 6.5, 7.0, 7.5];

// Comp poses for each keyframe: offset (comp px of a 1920x1080 comp),
// rotation (deg) and scale. The last one is the finished, centred lockup.
export const COMP_POSES = [
  { x: -330, y: 170, rot: -6, scale: 0.72 },
  { x: 260, y: -150, rot: 7, scale: 0.86 },
  { x: 190, y: 90, rot: -3, scale: 1.0 },
  { x: 0, y: 0, rot: 0, scale: 1.0 },
];

// ── Story events ────────────────────────────────────────────────────────────
export const EV = {
  knocks: [1.0, 1.25],
  peel: [1.5, 1.9],
  pop: 2.0,
  typeAt: 2.5,
  typeLetters: "MADE WITH CLAUDE",
  typeDur: 0.45,
  sparkAt: 3.0,
  swooshAt: 3.5,
  swooshDur: 0.45,
  chipUp: 4.56,
  kick: 5.0,
  chipLand: 5.45,
  glowOn: 5.5,
  rewind: [8.0, 8.4],
  surf: [8.5, 9.6],
  play: 10.0,
  panelsFall: [10.45, 10.6, 10.75, 10.9, 11.05, 11.2],
  wave: [11.2, 12.0],
  fadeOut: [11.5, 12.0],
};

// Panels that power down and fall at EV.panelsFall, in order
export const FALL_ORDER = ["preview", "info", "effects", "menubar", "project", "timeline"];

// ── Clawd ───────────────────────────────────────────────────────────────────
// Body 12x8x6 units; 1 unit = 4.5 mm.
export const CLAWD_UNIT = 4.5;
export const CLAWD_COLOR = "#D97757";

// Surface heights (mm above the slab top plane)
export const SURF = {
  slab: 0,
  button: 3,
  comp: 0.6,
  ctiHead: 12,
};

const tool = (n) => rectCenter(toolRect(n));
const play = rectCenter(previewRect("play"));
export const SPOTS = {
  comp: { p: COMP_CENTER, h: SURF.comp },
  type: { p: tool("type"), h: SURF.button },
  rect: { p: tool("rect"), h: SURF.button },
  pen: { p: tool("pen"), h: SURF.button },
  glow: { p: [GLOW_CHIP[0] + GLOW_CHIP[2] + 62, GLOW_CHIP[1] + 13], h: SURF.slab },
  compEdge: { p: [1226, 300], h: SURF.slab },
  key1: { p: [compTimeToX(2), POSITION_ROW_Y], h: SURF.slab },
  key2: { p: [compTimeToX(4), POSITION_ROW_Y], h: SURF.slab },
  key3: { p: [compTimeToX(6), POSITION_ROW_Y], h: SURF.slab },
  key4: { p: [compTimeToX(8), POSITION_ROW_Y], h: SURF.slab },
  cti: { p: [compTimeToX(8), TL.rulerY], h: SURF.ctiHead },
  play: { p: play, h: SURF.button },
  final: { p: [1136, 566], h: SURF.slab },
};

// Every hop: take-off t0 → landing t1 (on a beat), apex in metres above the
// higher end, optional front flip. Between hops Clawd stands; 8.0–9.6 he rides
// the playhead head instead (see riding()).
export const HOPS = [
  { from: "comp", to: "type", t0: 2.1, t1: 2.5, apex: 0.12 },
  { from: "type", to: "rect", t0: 2.68, t1: 3.0, apex: 0.05 },
  { from: "rect", to: "pen", t0: 3.18, t1: 3.5, apex: 0.045 },
  { from: "pen", to: "glow", t0: 3.66, t1: 4.5, apex: 0.14, flip: true },
  { from: "glow", to: "compEdge", t0: 5.12, t1: 5.5, apex: 0.09 },
  { from: "compEdge", to: "key1", t0: 5.64, t1: 6.0, apex: 0.08 },
  { from: "key1", to: "key2", t0: 6.18, t1: 6.5, apex: 0.06 },
  { from: "key2", to: "key3", t0: 6.68, t1: 7.0, apex: 0.06 },
  { from: "key3", to: "key4", t0: 7.18, t1: 7.5, apex: 0.06 },
  { from: "key4", to: "cti", t0: 7.7, t1: 8.0, apex: 0.05 },
  { from: "cti", to: "play", t0: 9.62, t1: 10.0, apex: 0.09 },
  { from: "play", to: "final", t0: 10.12, t1: 10.5, apex: 0.1 },
];

// Comp time under the playhead (CTI) at film time t.
// Starts parked at 0;00;06;15, follows Clawd while he stamps keys, rides back
// to 0 with him, then he surfs it to the end while the comp plays.
const smooth = (a) => a * a * (3 - 2 * a);
const clamp01 = (a) => Math.min(1, Math.max(0, a));
export function ctiTime(t) {
  const parked = 6.5;
  if (t < HOPS[5].t0) return parked;
  if (t < KEY_STAMP_TIMES[0]) {
    const a = smooth(clamp01((t - HOPS[5].t0) / (KEY_STAMP_TIMES[0] - HOPS[5].t0)));
    return parked + (KEY_COMP_TIMES[0] - parked) * a;
  }
  for (let k = 1; k < 4; k++) {
    const h = HOPS[5 + k];
    if (t < h.t0) return KEY_COMP_TIMES[k - 1];
    if (t < h.t1) {
      const a = (t - h.t0) / (h.t1 - h.t0);
      return KEY_COMP_TIMES[k - 1] + (KEY_COMP_TIMES[k] - KEY_COMP_TIMES[k - 1]) * a;
    }
  }
  if (t < EV.rewind[0]) return KEY_COMP_TIMES[3];
  if (t < EV.rewind[1]) {
    const a = (t - EV.rewind[0]) / (EV.rewind[1] - EV.rewind[0]);
    return KEY_COMP_TIMES[3] * (1 - a * a * (3 - 2 * a));
  }
  if (t < EV.surf[0]) return 0;
  if (t < EV.surf[1]) {
    const a = (t - EV.surf[0]) / (EV.surf[1] - EV.surf[0]);
    return COMP_DURATION * (a * a * (1.6 - 0.6 * a)); // push off, then cruise
  }
  return COMP_DURATION;
}

// Clawd stands on the playhead head between landing on it and leaping off
export function riding(t) {
  return t >= HOPS[9].t1 && t < HOPS[10].t0;
}

// ── Camera keys ─────────────────────────────────────────────────────────────
// target: UI px + height (mm); dist (m), elev / az (deg, az 0 = looking north
// from the south edge), follow: 0 = keyed target, 1 = smoothed Clawd.
export const CAMERA = [
  { t: 0.0, target: [930, 560, 0], dist: 2.75, elev: 40, az: -14, follow: 0, fov: 30, focusAt: "target", fstop: 9 },
  { t: 0.95, target: [840, 380, 0], dist: 1.35, elev: 33, az: -9, follow: 0, fov: 30, fstop: 7 },
  { t: 1.6, target: [818, 352, 18], dist: 0.62, elev: 25, az: -5, follow: 0.2, fov: 30, fstop: 4 },
  { t: 2.0, target: [818, 352, 30], dist: 0.5, elev: 22, az: -2, follow: 0.7, fov: 30, fstop: 3.2 },
  { t: 2.55, dist: 0.42, elev: 17, az: 18, follow: 1, fov: 30, fstop: 2.8 },
  { t: 3.45, dist: 0.4, elev: 16, az: 24, follow: 1, fov: 30, fstop: 2.8 },
  { t: 4.05, dist: 0.62, elev: 24, az: 8, follow: 1, fov: 30, fstop: 3.5 },
  { t: 4.6, dist: 0.42, elev: 24, az: -22, follow: 1, fov: 30, fstop: 2.8 },
  { t: 5.2, target: [1020, 420, 20], dist: 0.66, elev: 23, az: -12, follow: 0.35, fov: 30, fstop: 3.5 },
  { t: 5.6, dist: 0.48, elev: 20, az: -6, follow: 1, fov: 30, fstop: 3.2 },
  { t: 6.1, dist: 0.4, elev: 16, az: -28, follow: 1, fov: 30, fstop: 2.8 },
  { t: 7.6, dist: 0.4, elev: 16, az: -24, follow: 1, fov: 30, fstop: 2.8 },
  { t: 8.1, dist: 0.4, elev: 15, az: -14, follow: 1, fov: 30, fstop: 2.8 },
  { t: 8.45, dist: 0.38, elev: 15, az: 22, follow: 1, fov: 30, fstop: 2.8 },
  { t: 9.1, dist: 0.36, elev: 14, az: 2, follow: 1, fov: 30, fstop: 2.6 },
  { t: 9.6, dist: 0.56, elev: 22, az: -4, follow: 1, fov: 30, fstop: 3.5 },
  { t: 10.05, dist: 0.46, elev: 26, az: -2, follow: 1, fov: 30, fstop: 3.2 },
  { t: 10.55, target: [900, 400, 0], dist: 0.95, elev: 33, az: -4, follow: 0.35, fov: 30, fstop: 5 },
  { t: 11.25, target: [812, 366, 0], dist: 1.05, elev: 38, az: 2, follow: 0, fov: 30, fstop: 7 },
  { t: 12.0, target: [812, 364, 0], dist: 0.99, elev: 38, az: 3, follow: 0, fov: 30, fstop: 7 },
];

// Smoothing of Clawd's path for the follow camera (seconds, Gaussian sigma)
export const CAMERA_SMOOTH = 0.14;
export const SHUTTER = 0.5; // fraction of a frame the shutter is open
export const BLUR_SAMPLES = 12;

// ── Sound cues derived from the same numbers ────────────────────────────────
export function soundCues() {
  const cues = [];
  const add = (t, kind, extra = {}) => cues.push({ t: +t.toFixed(4), kind, ...extra });
  EV.knocks.forEach((t) => add(t, "knock"));
  add(EV.peel[0], "peel", { dur: EV.peel[1] - EV.peel[0] });
  add(EV.pop, "pop");
  HOPS.forEach((h) => {
    add(h.t0, "boing", { long: h.flip || h.t1 - h.t0 > 0.45 });
    add(h.t1, "pomf");
    if (h.flip || h.t1 - h.t0 > 0.45 || h.to === "play") add(h.t0 + 0.04, "whoosh", { dur: h.t1 - h.t0 });
  });
  ["type", "rect", "pen"].forEach((n, i) => add([EV.typeAt, EV.sparkAt, EV.swooshAt][i], "toolClick"));
  [...EV.typeLetters].forEach((c, i) => {
    if (c !== " ") add(EV.typeAt + 0.03 + (i * EV.typeDur) / EV.typeLetters.length, "keyTap");
  });
  add(EV.sparkAt + 0.02, "bloop");
  add(EV.swooshAt + 0.02, "scribble", { dur: EV.swooshDur });
  add(EV.chipUp, "blip");
  add(EV.kick, "thwack");
  add(EV.kick + 0.02, "whoosh", { dur: EV.chipLand - EV.kick });
  add(EV.glowOn, "shimmer");
  KEY_STAMP_TIMES.forEach((t, i) => add(t, "ding", { note: ["C6", "E6", "G6", "C7"][i] }));
  add(EV.rewind[0], "rewind", { dur: EV.rewind[1] - EV.rewind[0] });
  add(EV.surf[0], "skate", { dur: EV.surf[1] - EV.surf[0] });
  for (let s = 0; s <= 10; s++) {
    // scrub ticks each comp second the playhead crosses during the surf
    const a = s / COMP_DURATION;
    // invert ctiTime's surf curve numerically
    let lo = 0, hi = 1;
    for (let it = 0; it < 30; it++) {
      const m = (lo + hi) / 2;
      if (m * m * (1.6 - 0.6 * m) < a) lo = m; else hi = m;
    }
    add(EV.surf[0] + lo * (EV.surf[1] - EV.surf[0]), "tick");
  }
  add(EV.play, "playClick");
  add(EV.play, "brass");
  add(EV.play + 0.03, "shimmer");
  EV.panelsFall.forEach((t) => {
    add(t, "powerDown");
    add(t + 0.12, "whoosh", { dur: 0.5, soft: true });
  });
  add(EV.wave[0] + 0.05, "yay");
  add(EV.wave[0] + 0.3, "sparkle");
  return cues.sort((a, b) => a.t - b.t);
}
