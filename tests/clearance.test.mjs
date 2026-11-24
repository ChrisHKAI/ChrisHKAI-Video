import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { solidClashes, describeClashes, labelOverlaps, describeLabelOverlaps, lineOverlaps, describeLineOverlaps, edgeCrops, describeEdgeCrops, fastReveal, floatingSmallLetters, describeFloatingLetters, armLiftLimit, offStageHero, describeOffStageHero, offStageObjects, describeOffStageObjects, oversizedUiBoxes, describeOversizedUiBoxes, movieWraps, describeMovieWraps, cardScreenOverlaps, describeCardScreenOverlaps, heroFaceOcclusions, describeHeroFaceOcclusions, confettiOverText, describeConfettiOverText, lineBackdropClashes, describeLineBackdropClashes, propCoversToyBody, describePropCoversToyBody, heroStreaksOverText, describeHeroStreaksOverText } from "../skills/creator-toy-intro/engine/lib/clearance.js";
import { qEuler, qFlat, qRot } from "../skills/creator-toy-intro/engine/lib/quat.js";
import { line, declareLine, putLine } from "../skills/creator-toy-intro/engine/lib/lettering.js";
import { readout, formatCount } from "../skills/creator-toy-intro/engine/lib/counter.js";
import { unexpectedTools, isPlaceholderAnswer } from "../skills/creator-toy-intro/engine/scripts/grok-search.mjs";
import { makeLabel, paperOf, tear } from "../skills/creator-toy-intro/engine/lib/labels.js";
import { pageless } from "../skills/creator-toy-intro/templates/isnail-30/ui.js";
import { places } from "../skills/creator-toy-intro/templates/isnail-30/places.js";
import { buildFigure } from "../skills/creator-toy-intro/characters/tim-line/figure.js";
import { blenderCandidates } from "../skills/creator-toy-intro/engine/lib/tools.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const clearanceCli = join(root, "skills/creator-toy-intro/engine/scripts/clearance.mjs");

const QID = [0, 0, 0, 1];
const qAxis = ([ax, ay, az], ang) => {
  const s = Math.sin(ang / 2);
  return [ax * s, ay * s, az * s, Math.cos(ang / 2)];
};
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const UPRIGHT = qAxis([1, 0, 0], Math.PI / 2);
const pack = (p, q = QID, s = [1, 1, 1]) => [...p, ...q, ...s];

function makeAnim(objects, tracks, { fps = 30, frames = 90, sub = 1 } = {}) {
  return { fps, frames, sub, objects, tracks };
}

function makeGateScene({ hingeX, doorW, swingDeg, cardZ0, cardZ1, cardDelay = 0 }) {
  const fps = 30;
  const frames = 90;
  const doorGeo = { type: "roundBox", size: [0.014, 0.34, 0.014], radius: 0.003 };
  const barPos = [doorW - 0.02, 0.17, 0];
  const cardGeo = { type: "uiBox", rect: [-107.5, -107.5, 215, 215], uvRect: [0, 0, 215, 215], thickness: 0.002 };

  const objects = [
    { name: "beat1_ld", geo: null, anim: true, tr: pack([0, 0, 0]) },
    { name: "beat1_ld_top", parent: "beat1_ld", geo: { type: "roundBox", size: [doorW, 0.018, 0.018], radius: 0.004 }, tr: pack([doorW / 2, 0.33, 0]) },
    { name: "beat1_ld_r1", parent: "beat1_ld", geo: { type: "roundBox", size: [doorW, 0.014, 0.014], radius: 0.003 }, tr: pack([doorW / 2, 0.12, 0]) },
    { name: "beat1_ld_inn", parent: "beat1_ld", geo: doorGeo, tr: pack(barPos) },
    { name: "beat1_cardL", geo: cardGeo, mat: { type: "ui" }, anim: true, tr: pack([-0.28, 0.13, cardZ0], UPRIGHT) },
  ];

  const ldTrack = [];
  const cardTrack = [];
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const sw = Math.max(0, Math.min(1, t / 0.5));
    const yaw = sw * (swingDeg * Math.PI) / 180;
    ldTrack.push([f, ...pack([-hingeX, 0, -0.14], qAxis([0, 1, 0], yaw))]);
    const su = Math.max(0, Math.min(1, (t - cardDelay) / 1.5));
    const cz = cardZ0 + (cardZ1 - cardZ0) * su;
    cardTrack.push([f, ...pack([-0.28, 0.13, cz], UPRIGHT)]);
  }
  return makeAnim(objects, { beat1_ld: ldTrack, beat1_cardL: cardTrack }, { fps, frames });
}

test("detects swinging iron gate piercing a uiBox picture card and clears fixed geometry", () => {
  const broken = makeGateScene({ hingeX: 0.355, doorW: 0.345, swingDeg: 76, cardZ0: -0.35, cardZ1: -0.21, cardDelay: 0 });
  const raw = solidClashes(broken, { every: 1 });
  const described = describeClashes(raw);
  assert.equal(described.length, 1);
  assert.equal(described[0].mode, "through");
  assert.deepEqual(described[0].groups, ["beat1_cardL", "beat1_ld"]);
  assert.ok(described[0].depth >= 0.02, `expected >= 20 mm pierce depth, got ${described[0].depth}`);

  const fixed = makeGateScene({ hingeX: 0.42, doorW: 0.41, swingDeg: 104, cardZ0: -0.58, cardZ1: -0.24, cardDelay: 0.36 });
  assert.deepEqual(solidClashes(fixed, { every: 1 }), []);
});

test("detects intersecting angled uiBox picture cards and clears spaced cards", () => {
  const cardGeo = { type: "uiBox", rect: [-110, -100, 220, 200], uvRect: [0, 0, 220, 200], thickness: 0.002 };
  const crossing = makeAnim(
    [
      { name: "beat2_card0", geo: cardGeo, mat: { type: "ui" }, tr: pack([-0.06, 0.25, -0.35], qMul(qAxis([0, 1, 0], 0.35), UPRIGHT)) },
      { name: "beat2_card1", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.06, 0.25, -0.35], qMul(qAxis([0, 1, 0], -0.35), UPRIGHT)) },
    ],
    {},
    { frames: 12 },
  );
  const clashes = describeClashes(solidClashes(crossing, { every: 1 }));
  assert.equal(clashes.length, 1);
  assert.deepEqual(clashes[0].groups, ["beat2_card0", "beat2_card1"]);

  const separated = makeAnim(
    [
      { name: "beat2_card0", geo: cardGeo, mat: { type: "ui" }, tr: pack([-0.14, 0.25, -0.35], qMul(qAxis([0, 1, 0], 0.2), UPRIGHT)) },
      { name: "beat2_card1", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.14, 0.25, -0.38], qMul(qAxis([0, 1, 0], -0.2), UPRIGHT)) },
    ],
    {},
    { frames: 12 },
  );
  assert.deepEqual(solidClashes(separated, { every: 1 }), []);
});

test("detects moving solid roundBox embedding deeply into another roundBox", () => {
  const boxA = { type: "roundBox", size: [0.20, 0.20, 0.20], radius: 0.005 };
  const boxB = { type: "roundBox", size: [0.16, 0.16, 0.16], radius: 0.005 };
  const anim = makeAnim(
    [
      { name: "blockA", geo: boxA, anim: true, tr: pack([0, 0.10, 0]) },
      { name: "blockB", geo: boxB, anim: true, tr: pack([0.24, 0.18, 0.08]) },
    ],
    {
      blockB: Array.from({ length: 30 }, (_, f) => [f, ...pack([0.24 - 0.14 * (f / 29), 0.18, 0.08])]),
    },
    { frames: 30 },
  );
  const clashes = describeClashes(solidClashes(anim, { every: 1 }));
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].mode, "embed");
  assert.deepEqual(clashes[0].groups, ["blockA", "blockB"]);
  assert.ok(clashes[0].pen >= 0.012);
});

test("zero false positives for same-group corners, mounted phone screen, welded prop, paper labels, and cover slab", () => {
  const anim = makeAnim(
    [
      // Same-group gate rails meeting at corners
      { name: "beat1_ld_top", geo: { type: "roundBox", size: [0.40, 0.018, 0.018], radius: 0.004 }, tr: pack([0, 0.33, 0]) },
      { name: "beat1_ld_out", geo: { type: "roundBox", size: [0.020, 0.34, 0.020], radius: 0.004 }, tr: pack([-0.19, 0.17, 0]) },
      // Phone body + flush/mounted uiBox screen even across distinct group prefixes
      { name: "phone_body", geo: { type: "roundBox", size: [0.16, 0.275, 0.012], radius: 0.01 }, tr: pack([0, 0.15, 0]) },
      { name: "screen", geo: { type: "uiBox", rect: [-73, -125, 146, 250], uvRect: [0, 0, 146, 250], thickness: 0.002 }, mat: { type: "ui" }, tr: pack([0, 0.15, 0.007], UPRIGHT) },
      // Static welded prop (base + overlapping band rising rigidly together from hidden)
      { name: "cal_base", geo: { type: "roundBox", size: [0.18, 0.03, 0.08], radius: 0.003 }, anim: true, tr: pack([1, 0, 0]) },
      { name: "cal_band", geo: { type: "roundBox", size: [0.181, 0.05, 0.04], radius: 0.003 }, anim: true, tr: pack([1, 0.02, 0]) },
      // Paper label overlapping a torn rim
      { name: "label0_sheet", geo: { type: "roundBox", size: [0.3, 0.1, 0.004], radius: 0.001 }, mat: { type: "paper", color: "#EFE6D4" }, tr: pack([2, 0.1, 0]) },
      { name: "other_card", geo: { type: "uiBox", rect: [-100, -50, 200, 100], uvRect: [0, 0, 200, 100], thickness: 0.002 }, mat: { type: "ui" }, tr: pack([2, 0.1, 0], UPRIGHT) },
      // Template cover wallSlab riding hinged panel_pinned
      { name: "panel_pinned", geo: { type: "uiBox", rect: [-300, -100, 600, 200], uvRect: [0, 0, 600, 200], thickness: 0.008 }, mat: { type: "ui" }, tr: pack([3, 0, 0]) },
      { name: "wall2_slab", geo: { type: "wallSlab", w: 0.64, h: 0.25, d: 0.01 }, mat: { type: "cover2" }, tr: pack([3, 0, 0]) },
    ],
    {
      cal_base: Array.from({ length: 20 }, (_, f) => [f, ...pack([1, f < 5 ? -0.3 : 0, 0], QID, f < 5 ? [1e-4, 1e-4, 1e-4] : [0.5 + 0.5 * ((f - 5) / 14), 0.5 + 0.5 * ((f - 5) / 14), 0.5 + 0.5 * ((f - 5) / 14)])]),
      cal_band: Array.from({ length: 20 }, (_, f) => [f, ...pack([1, (f < 5 ? -0.3 : 0) + 0.02 * (f < 5 ? 1e-4 : 0.5 + 0.5 * ((f - 5) / 14)), 0], QID, f < 5 ? [1e-4, 1e-4, 1e-4] : [0.5 + 0.5 * ((f - 5) / 14), 0.5 + 0.5 * ((f - 5) / 14), 0.5 + 0.5 * ((f - 5) / 14)])]),
    },
    { frames: 20 },
  );
  assert.deepEqual(solidClashes(anim, { every: 1 }), []);
});

test("clearance.mjs CLI exits 1 on prop-card clash and 0 when clear, writing clashes to build/clearance.json", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "clearance-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "build"), { recursive: true });
  writeFileSync(join(dir, "film.json"), JSON.stringify({ id: "test", toy: "toy.json", profile: { name: "Test" } }));

  const broken = makeGateScene({ hingeX: 0.355, doorW: 0.345, swingDeg: 76, cardZ0: -0.35, cardZ1: -0.21, cardDelay: 0 });
  writeFileSync(join(dir, "build/anim.json"), JSON.stringify(broken));
  const bad = spawnSync(process.execPath, [clearanceCli, dir], { encoding: "utf8", cwd: root });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /beat1_cardL.*beat1_ld/);
  const report = JSON.parse(readFileSync(join(dir, "build/clearance.json"), "utf8"));
  assert.equal(report.clashes.length, 1);

  const fixed = makeGateScene({ hingeX: 0.42, doorW: 0.41, swingDeg: 104, cardZ0: -0.58, cardZ1: -0.24, cardDelay: 0.36 });
  writeFileSync(join(dir, "build/anim.json"), JSON.stringify(fixed));
  const good = spawnSync(process.execPath, [clearanceCli, dir], { encoding: "utf8", cwd: root });
  assert.equal(good.status, 0, good.stderr + good.stdout);
  assert.match(good.stdout, /go through nothing/);
  const cleanReport = JSON.parse(readFileSync(join(dir, "build/clearance.json"), "utf8"));
  assert.deepEqual(cleanReport.clashes, []);
});

test("detects settled overlapping end-card torn-paper labels while ignoring separated labels and 1-frame pop-in", () => {
  const rectRing = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const overlapping = makeAnim(
    [
      { name: "label0_rim", geo: { type: "curve", rings: [rectRing(0.50, 0.12)], depth: 0.002 }, mat: { type: "paper" }, tr: pack([-0.20, 0.07, -0.06]) },
      { name: "label1_rim", geo: { type: "curve", rings: [rectRing(0.36, 0.12)], depth: 0.002 }, mat: { type: "paper" }, tr: pack([0.16, 0.07, -0.058]) },
    ],
    {},
    { frames: 30 },
  );
  const found = describeLabelOverlaps(labelOverlaps(overlapping, { every: 1 }));
  assert.equal(found.length, 1);
  assert.equal(found[0].a, "label0");
  assert.equal(found[0].b, "label1");
  assert.ok(found[0].depth >= 0.06);

  const separated = makeAnim(
    [
      { name: "label0_rim", geo: { type: "curve", rings: [rectRing(0.46, 0.11)], depth: 0.002 }, mat: { type: "paper" }, tr: pack([-0.295, 0.07, -0.06]) },
      { name: "label1_rim", geo: { type: "curve", rings: [rectRing(0.32, 0.11)], depth: 0.002 }, mat: { type: "paper" }, tr: pack([0.208, 0.07, -0.058]) },
    ],
    {},
    { frames: 30 },
  );
  assert.deepEqual(labelOverlaps(separated, { every: 1 }), []);

  // Transient 1-frame fly-by (0.03 s < 0.25 s) must not trigger
  const transient = makeAnim(
    [
      { name: "label0_rim", geo: { type: "curve", rings: [rectRing(0.46, 0.11)], depth: 0.002 }, anim: true, tr: pack([-0.295, 0.07, -0.06]) },
      { name: "label1_rim", geo: { type: "curve", rings: [rectRing(0.32, 0.11)], depth: 0.002 }, anim: true, tr: pack([0.208, 0.07, -0.058]) },
    ],
    {
      label1_rim: Array.from({ length: 30 }, (_, f) => [f, ...pack([f === 5 ? 0.05 : 0.208, 0.07, -0.058])]),
    },
    { frames: 30 },
  );
  assert.deepEqual(labelOverlaps(transient, { every: 1 }), []);
});

test("detects settled hero/prop edge crop and stays silent when cleanly framed or jumping fast", () => {
  const mkScene = (propPos, propYVel = 0) => ({
    fps: 30,
    frames: 30,
    sub: 1,
    scalars: { fov: Array(30).fill(30) },
    objects: [
      { name: "camera", geo: null, camera: true, tr: pack([0, 0.2, 1.5]) },
      { name: "cta_floor", geo: { type: "plane", w: 10, h: 10 }, tr: pack([0, 0, 0]) },
      { name: "cta_prop", geo: { type: "roundBox", size: [0.24, 0.12, 0.20], radius: 0.01 }, anim: true, tr: pack(propPos) },
    ],
    tracks: propYVel
      ? { cta_prop: Array.from({ length: 30 }, (_, f) => [f, ...pack([propPos[0], propPos[1] + (f / 30) * propYVel, propPos[2]])]) }
      : {},
  });

  // Settled at x = 0.72 -> right edge past frustum (~0.715 at z=0, dist=1.5, fov=30, 16:9)
  const cropped = describeEdgeCrops(edgeCrops(mkScene([0.70, 0.06, 0]), { every: 1 }));
  assert.equal(cropped.length, 1);
  assert.equal(cropped[0].target, "cta_prop");
  assert.ok(cropped[0].edges.includes("right"));

  // Cleanly inside two-column left position
  assert.deepEqual(edgeCrops(mkScene([-0.34, 0.06, 0]), { every: 1 }), []);

  // Fast vertical jump out of frame (vy = 1.2 m/s) is intentionally ignored
  assert.deepEqual(edgeCrops(mkScene([0.70, 0.06, 0], 1.2), { every: 1 }), []);
});

test("pageless respects story.profilePage and custom beats referencing assets/ui.png", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ui-pageless-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "beats"), { recursive: true });
  writeFileSync(join(dir, "beats/custom-open.js"), 'const img = "assets/ui.png";\n');
  writeFileSync(join(dir, "beats/blank-open.js"), 'const img = "assets/other.png";\n');

  const base = { format: { bpm: 120 }, story: { segments: [{ beat: "beats/blank-open.js", bars: 2 }, { story: [24, "end"] }] } };
  assert.equal(pageless(base, dir), true);
  assert.equal(pageless({ ...base, story: { ...base.story, profilePage: true } }, dir), false);
  assert.equal(pageless({ format: { bpm: 120 }, story: { segments: [{ beat: "beats/custom-open.js", bars: 2 }, { story: [24, "end"] }] } }, dir), false);
});

test("places supports two-column steady end-card layout without changing default sweep", () => {
  const L = {
    UI_W: 1280, UI_H: 720,
    AVATAR: { c: [200, 200], d: 120 },
    PANELS: { pinned: [100, 300, 600, 200] },
    ANCHORS: { pinnedCover: [120, 340, 560, 140], count: [500, 480], second: [100, 520, 600, 180], secondCover: [120, 540, 560, 120] },
  };
  const sweep = places(L, { portrait: false, aspect: 16 / 9, safe: [0.05, 0.05, 0.95, 0.9] }, { w: 0.4, h2: 0.16, h3: 0.16 });
  assert.deepEqual(sweep.cta.path, [-0.4, 0.47]);

  const twoCol = places(L, { portrait: false, aspect: 16 / 9, safe: [0.05, 0.05, 0.95, 0.9], ctaLayout: "two-column" }, { w: 0.4, h2: 0.16, h3: 0.16 });
  assert.deepEqual(twoCol.cta.path, [-0.34, -0.34]);
  assert.equal(twoCol.cta.sloganWidth, 0.62);
  assert.ok(twoCol.camera2.every((k) => k.az === 0 && k.target[0] === 0.02));
});

test("tim-line finish() converts roundBox size and radius from mm to metres", () => {
  const { parts } = buildFigure({
    sleeves: "long",
    hair: [],
    glasses: [],
    extra: [{ name: "pocket", group: "chest", shape: "roundBox", pos: [10, 50, 15], size: [12, 14, 4], radius: 2, mat: "shirt" }],
  });
  const pocket = parts.find((p) => p.name === "pocket");
  assert.ok(pocket);
  assert.deepEqual(pocket.size.map((v) => +v.toFixed(6)), [0.012, 0.014, 0.004]);
  assert.equal(+pocket.radius.toFixed(6), 0.002);
});

test("declareLine tags line/letterIndex so fastReveal keeps slo1 and slo2 separate", () => {
  const fakeGlyph = {
    has: () => true,
    adv: () => 0.9,
    geo: () => ({ type: "curve", rings: [[[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]]], depth: 0.002, bevel: 0 }),
  };
  const objects = [];
  const add = (o) => objects.push({ parent: "root", tr: pack([0, 0, 0]), ...o, name: `beat3_${o.name}` });
  declareLine(add, "slo1", line(fakeGlyph, "把想法做出来", 0.03));
  declareLine(add, "slo2", line(fakeGlyph, "开源工具找", 0.03));

  // slo1 arrives whole at frame 10; slo2 arrives whole 6 frames (0.2s) later at frame 16.
  // Previously stripping trailing digits merged slo1 + slo2 into one 11-char line arriving in 0.2s.
  const tracks = {};
  for (const o of objects) {
    const start = o.line === "slo1" ? 10 : 16;
    tracks[o.name] = Array.from({ length: 30 }, (_, f) => [f, ...pack([0, 0, 0], [0, 0, 0, 1], f >= start ? [1, 1, 1] : [1e-4, 1e-4, 1e-4])]);
  }
  const anim = { fps: 30, frames: 30, sub: 1, objects, tracks };
  assert.deepEqual(fastReveal(anim), []);

  // A single line typed too quickly (1 frame = 0.033s per letter across 6 letters = 0.17s < 0.25s) IS still caught.
  const fastObjs = [];
  declareLine((o) => fastObjs.push({ parent: "root", tr: pack([0, 0, 0]), ...o, name: `beat3_${o.name}` }), "fast", line(fakeGlyph, "把想法做出来", 0.03));
  const fastTracks = {};
  for (const o of fastObjs) {
    const start = 5 + o.letterIndex;
    fastTracks[o.name] = Array.from({ length: 30 }, (_, f) => [f, ...pack([0, 0, 0], [0, 0, 0, 1], f >= start ? [1, 1, 1] : [1e-4, 1e-4, 1e-4])]);
  }
  const hits = fastReveal({ fps: 30, frames: 30, sub: 1, objects: fastObjs, tracks: fastTracks });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].text, "把想法做出来");
});

test("places two-column default label coordinates pass labelOverlaps with zero manual overrides", () => {
  const L = {
    UI_W: 1280, UI_H: 720,
    AVATAR: { c: [200, 200], d: 120 },
    PANELS: { pinned: [100, 300, 600, 200] },
    ANCHORS: { pinnedCover: [120, 340, 560, 140], count: [500, 480], second: [100, 520, 600, 180], secondCover: [120, 540, 560, 120] },
  };
  const { cta } = places(L, { portrait: false, aspect: 16 / 9, safe: [0.05, 0.05, 0.95, 0.9], ctaLayout: "two-column" }, { w: 0.4, h2: 0.16, h3: 0.16 });
  const adv = (k) => (k.split(":")[1].codePointAt(0) >= 0x2e80 ? 1.0 : 0.62);
  const defs = [
    { id: "s0", text: "AI 视觉工作流", em: cta.slogan[0].em, paper: "cream", c: cta.slogan[0].at, tilt: cta.slogan[0].tilt },
    { id: "s1", text: "开源找卧云", em: cta.slogan[1].em, paper: "red", c: cta.slogan[1].at, tilt: cta.slogan[1].tilt },
    { id: "nm", text: "Levi 卧云", em: cta.name.em, paper: "cream", c: cta.name.at, tilt: cta.name.tilt },
    { id: "hd", text: "@Leviwoyun", em: cta.handle.em, paper: "blue", c: cta.handle.at, tilt: cta.handle.tilt },
  ];
  const objects = [], tracks = {};
  defs.forEach((d, i) => {
    const lb = makeLabel({ ...d, at: 0, letterAt: () => 0, adv });
    tear(lb, i);
    const name = `label${i}_rim`;
    objects.push({ name, parent: "root", geo: { type: "curve", rings: [lb.rim], depth: 0.002 }, tr: pack(d.c, qAxis([0, 0, 1], d.tilt)) });
    tracks[name] = [[0, ...pack(d.c, qAxis([0, 0, 1], d.tilt))], [30, ...pack(d.c, qAxis([0, 0, 1], d.tilt))]];
  });
  const overlaps = labelOverlaps(makeAnim(objects, tracks, { frames: 30 }));
  assert.deepEqual(overlaps, [], `expected zero two-column overlaps, got: ${JSON.stringify(describeLabelOverlaps(overlaps))}`);
});

test("floatingSmallLetters flags small 3D text floating in front of a plaque and ignores flush, large, or open-air text", () => {
  const mkGlyph = (h) => ({
    has: () => true,
    adv: () => 0.85,
    geo: () => ({ type: "curve", rings: [[[0, 0], [h * 0.8, 0], [h * 0.8, h], [0, h]]], depth: 0.0028, bevel: 0.0003 }),
  });
  const objects = [
    // Warm-cream plaque at z = 0, thickness 0.012 -> front face at z = +0.006 (light surface shows double shadows!)
    { name: "beat2_arch_subPlaque", parent: "root", geo: { type: "roundBox", size: [0.52, 0.07, 0.012], radius: 0.003 }, mat: { type: "type", color: "#F6E4C8" }, tr: pack([0, 0.35, 0]) },
    // Near-black navy scoreboard at y = 0.50 with bright gold trim directly behind it (dark board occludes trim -> no false alarm!)
    { name: "beat2_arch_board", parent: "root", geo: { type: "roundBox", size: [0.52, 0.12, 0.012], radius: 0.003 }, mat: { type: "type", color: "#0F244B" }, tr: pack([0, 0.50, 0]) },
    { name: "beat2_arch_goldTrim", parent: "root", geo: { type: "roundBox", size: [0.54, 0.13, 0.010], radius: 0.003 }, mat: { type: "type", color: "#FBBF24" }, tr: pack([0, 0.50, -0.006]) },
  ];
  const tracks = {
    beat2_arch_subPlaque: [[0, ...pack([0, 0.35, 0])], [30, ...pack([0, 0.35, 0])]],
    beat2_arch_board: [[0, ...pack([0, 0.50, 0])], [30, ...pack([0, 0.50, 0])]],
    beat2_arch_goldTrim: [[0, ...pack([0, 0.50, -0.006])], [30, ...pack([0, 0.50, -0.006])]],
  };
  const addLine = (key, text, em, y, z) => {
    const g = mkGlyph(em);
    const ln = line(g, text, em);
    declareLine((o) => {
      const name = `beat2_${o.name}`;
      const pos = [o.letterIndex * em * 0.9 - 0.1, y, z];
      objects.push({ parent: "root", tr: pack(pos), ...o, name });
      tracks[name] = [[0, ...pack(pos)], [30, ...pack(pos)]];
    }, key, ln);
  };
  // 1) Small 34 mm 3D text floating 10 mm off cream plaque (z = 0.018 -> ~10 mm gap): CAUGHT
  addLine("floatSub", "开源16天", 0.034, 0.335, 0.018);
  // 2) Small 34 mm 3D text mounted flush (z = 0.0085 -> gap ~0.8 mm < 4 mm): NOT flagged
  addLine("flushSub", "贴面文字", 0.034, 0.335, 0.0085);
  // 3) Large 65 mm display title 12 mm off plaque: NOT flagged (> 45 mm maxH)
  addLine("bigTitle", "2071", 0.065, 0.33, 0.020);
  // 4) Small 34 mm 3D text floating in front of near-black navy scoreboard: NOT flagged
  addLine("navyUnit", "Stars", 0.030, 0.485, 0.018);
  // 5) Small 34 mm 3D text over open air (y = 0.80, nowhere near plaque): NOT flagged
  addLine("airText", "浮空大字", 0.034, 0.80, 0.018);

  const hits = floatingSmallLetters(makeAnim(objects, tracks, { frames: 30 }));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].text, "开源16天");
  assert.equal(hits[0].backing, "beat2_arch_subPlaque");
  assert.match(describeFloatingLetters(hits)[0].text, /casts double shadow/);
});

test("armLiftLimit preserves 2.5 rad on slender toys (isnail) and clamps wide-headed chibi toys outward", () => {
  const isnailDir = join(root, "skills/creator-toy-intro/example/isnail");
  const isnail = JSON.parse(readFileSync(join(isnailDir, "toy.json"), "utf8"));
  assert.equal(armLiftLimit(isnail, (p) => join(isnailDir, p), 2.5), 2.5);

  const chibi = {
    joints: {
      body: { p: [0, 0.026, 0], parent: null },
      head: { p: [0, 0.053, 0], parent: "body" },
      armR: { p: [-0.0128, 0.0495, 0], parent: "body" },
      armL: { p: [0.0128, 0.0495, 0], parent: "body" },
    },
    parts: [
      { name: "head", group: "head", shape: "ellipsoid", pos: [0, 0.080, 0], r: [0.032, 0.036, 0.030] },
      { name: "armR", group: "armR", shape: "roundBox", pos: [-0.015, 0.035, 0], size: [0.009, 0.028, 0.009], radius: 0.003 },
      { name: "armL", group: "armL", shape: "roundBox", pos: [0.015, 0.035, 0], size: [0.009, 0.028, 0.009], radius: 0.003 },
    ],
  };
  const lim = armLiftLimit(chibi, (p) => p, 2.5);
  assert.ok(lim >= 1.57 && lim <= 1.9, `expected wide-headed chibi arm lift clamp in [1.57, 1.9], got ${lim}`);
});

test("putLine passes (it, idx) cleanly and throws on NaN scale or position instead of silently hiding text", () => {
  const glyph = {
    has: () => true,
    adv: () => 0.8,
    geo: () => ({ type: "curve", rings: [[[0, 0], [0.02, 0], [0.02, 0.03], [0, 0.03]]], depth: 0.002, bevel: 0.0003 }),
  };
  const ln = line(glyph, "AB CD", 0.04);
  const placed = new Map();
  const seenIdx = [];
  putLine(
    (name, tr) => placed.set(name, tr),
    "sub",
    ln,
    (it, idx) => { seenIdx.push(idx); return [it.x, ln.stand, 0]; },
    QID,
    (_it, idx) => 0.5 + idx * 0.1,
    { outline: true },
  );
  assert.deepEqual(seenIdx, [0, 1, 2, 3]);
  assert.equal(placed.get("sub0").s[0], 0.5);
  assert.ok(Math.abs(placed.get("sub4").s[0] - 0.8) < 1e-6);

  assert.throws(
    () => putLine(() => {}, "bad", ln, (it) => [it.x, 0, 0], QID, () => Number.NaN),
    /scale.*not a finite number/i,
  );
  assert.throws(
    () => putLine(() => {}, "badPos", ln, () => [Number.NaN, 0, 0], QID, () => 1),
    /position.*not finite/i,
  );
});

test("offStageHero catches a visible toy teleported to world origin (missing at(...)) and ignores normal or hidden stretches", () => {
  const objects = [
    { name: "camera", parent: "root", tr: pack([18, 0.2, 1.0]) },
    { name: "hero", parent: "root", tr: pack([18, 0.02, 0]) },
  ];
  // 0..1 s normal on beat stage (x=18), 1..2 s teleported to origin (x=0, ~18 m away), 2..3 s hidden at origin
  const tracks = {
    camera: [[0, ...pack([18, 0.2, 1.0])], [90, ...pack([18, 0.2, 1.0])]],
    hero: [
      [0, ...pack([18, 0.02, 0])],
      [29, ...pack([18, 0.02, 0])],
      [30, ...pack([0, 0.02, 0])],
      [59, ...pack([0, 0.02, 0])],
      [60, ...pack([0, -1, 0], QID, [1e-4, 1e-4, 1e-4])],
      [90, ...pack([0, -1, 0], QID, [1e-4, 1e-4, 1e-4])],
    ],
  };
  const hits = offStageHero(makeAnim(objects, tracks, { frames: 90 }));
  assert.equal(hits.length, 1);
  assert.ok(hits[0].from >= 0.9 && hits[0].to <= 2.1);
  assert.ok(hits[0].dist > 17);
  assert.match(describeOffStageHero(hits)[0].text, /missing at\(\.\.\.\)/);
});

test("grok-search allows Web Search and X Search across Grok versions and rejects placeholder stubs", () => {
  assert.deepEqual(unexpectedTools({ WebSearch: 5 }), []);
  assert.deepEqual(unexpectedTools({ "Web Search": 3, "X Search": 22 }), []);
  assert.deepEqual(unexpectedTools({ "Web Search": 2, "X Search": 10, run_terminal_command: 1 }), ["run_terminal_command"]);

  // Turn-1 stub must be rejected
  assert.equal(isPlaceholderAnswer({ pinned: { url: "pending", first_line: "searching" }, top: [], milestones: [], ideas: [] }, 1), true);
  assert.equal(isPlaceholderAnswer({ top: [], milestones: [], ideas: [] }, 1), true);
  // Real search output must pass
  assert.equal(
    isPlaceholderAnswer({
      pinned: { url: "https://x.com/Lonely__MH/status/123456", first_line: "自媒体创作不完全指南" },
      top: [],
      milestones: [],
      ideas: [{ idea: "demo", from: "pinned" }],
    }, 6),
    false,
  );
});

test("qFlat keeps XY rings strictly horizontal in XZ across arbitrary yaw spins", () => {
  const ringPts = [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]];
  for (const yaw of [0, 0.7, Math.PI / 2, -1.3]) {
    const q = qFlat(yaw);
    for (const p of ringPts) {
      const r = qRot(q, p);
      assert.ok(Math.abs(r[1]) < 1e-12, `expected y=0 for yaw=${yaw}, got ${r[1]}`);
      assert.ok(Math.abs(Math.hypot(r[0], r[2]) - 1) < 1e-12);
    }
  }
  // Confirm intrinsic qEuler(-PI/2, 0.7, 0) tilts vertically (why qFlat exists)
  assert.ok(Math.abs(qRot(qEuler(-Math.PI / 2, 0.7, 0), [1, 0, 0])[1]) > 0.5);
});

test("cutout() and picture({ cyclic: false, cutout: true }) preserve orientation and cyclic flags", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ctoy-pic-"));
  try {
    // Minimal valid 200x100 PNG header (24+ bytes)
    const png = Buffer.alloc(32);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(0x0d0a1a0a, 4);
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12);
    png.writeUInt32BE(200, 16);
    png.writeUInt32BE(100, 20);
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "film.json"), JSON.stringify({ format: { fps: 30, duration: 10, size: [1920, 1080] } }));
    writeFileSync(join(dir, "assets/icon.png"), png);
    const prevFilm = process.env.FILM;
    process.env.FILM = dir;
    try {
      const { picture, cutout } = await import("../skills/creator-toy-intro/engine/lib/pictures.js");
      const c = cutout("assets/icon.png", 0.12);
      assert.equal(c.geo.type, "plane");
      assert.equal(c.mat.type, "sticker");
      assert.ok(Math.abs(c.h - 0.06) < 1e-9);
      const tr = c.at([1, 2, 3], QID, 0.5);
      assert.deepEqual(tr.q, QID);
      assert.deepEqual(tr.s, [0.5, 0.5, 0.5]);

      const c2 = picture("assets/icon.png", 0.12, { cutout: true });
      assert.equal(c2.geo.type, "plane");

      const vidHold = picture("assets/icon.png", 0.4, { movie: "assets/clip.mp4", frames: 180, start: 61, cyclic: false });
      assert.equal(vidHold.mat.cyclic, false);
      assert.ok(Math.abs(vidHold.geo.unitScale - 2.0) < 1e-6);

      const vidLoop = picture("assets/icon.png", 0.4, { movie: "assets/clip.mp4", frames: 180, start: 61 });
      assert.equal("cyclic" in vidLoop.mat, false);
    } finally {
      if (prevFilm === undefined) delete process.env.FILM;
      else process.env.FILM = prevFilm;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("offStageObjects catches double-at() and missing-at() props without false positives on multi-beat stages", () => {
  const box = { type: "roundBox", size: [0.2, 0.04, 0.01], radius: 0.004 };
  const objects = [
    { name: "camera", parent: "root", tr: pack([200, 0.2, 0.8]) },
    { name: "beat1_good", parent: "root", geo: box, tr: pack([200, 0.2, 0]) },
    { name: "beat1_doubleAt", parent: "root", geo: box, tr: pack([400, 0.2, 0]) },
    { name: "beat1_missingAt", parent: "root", geo: box, tr: pack([0, 0.2, 0]) },
  ];
  const tracks = {
    // 0..1.5 s on Beat 1 (x=200), 1.5..3.0 s on Beat 2 (x=250) while beat1_good stays unparked at x=200
    camera: [
      [0, ...pack([200, 0.2, 0.8])],
      [44, ...pack([200, 0.2, 0.8])],
      [45, ...pack([250, 0.2, 0.8])],
      [89, ...pack([250, 0.2, 0.8])],
    ],
    beat1_good: [[0, ...pack([200, 0.2, 0])], [89, ...pack([200, 0.2, 0])]],
    beat1_doubleAt: [[0, ...pack([400, 0.2, 0])], [44, ...pack([400, 0.2, 0])], [45, ...pack([0, -1, 0], QID, [1e-4, 1e-4, 1e-4])]],
    beat1_missingAt: [[0, ...pack([0, 0.2, 0])], [44, ...pack([0, 0.2, 0])], [45, ...pack([0, -1, 0], QID, [1e-4, 1e-4, 1e-4])]],
  };
  const hits = offStageObjects(makeAnim(objects, tracks, { frames: 90 }));
  assert.equal(hits.length, 2);
  const byName = Object.fromEntries(hits.map((h) => [h.name, h]));
  assert.equal(byName.beat1_doubleAt.cause, "double-at");
  assert.equal(byName.beat1_missingAt.cause, "off-stage");
  assert.match(describeOffStageObjects([byName.beat1_doubleAt])[0].text, /called at\(\.\.\.\) twice/);
});

test("lineOverlaps flags colliding 3D headlines while clearing stacked lines and counter digits", () => {
  const glyphSq = { type: "curve", rings: [[[0, 0], [0.04, 0], [0.04, 0.04], [0, 0.04]]], depth: 0.003 };
  const objects = [
    { name: "camera", parent: "root", tr: pack([0, 0.2, 1.0]) },
    { name: "beat1_stuck0", letter: "困", line: "stuck", letterIndex: 0, geo: glyphSq, tr: pack([-0.02, 0.25, 0]) },
    { name: "beat1_dir0", letter: "换", line: "dir", letterIndex: 0, geo: glyphSq, tr: pack([-0.01, 0.25, 0]) },
    { name: "beat1_sub0", letter: "开", line: "sub", letterIndex: 0, geo: glyphSq, tr: pack([-0.01, 0.18, 0]) },
    { name: "beat1_r0_7", letter: "7", step: true, geo: glyphSq, tr: pack([-0.20, 0.25, 0]) },
    { name: "beat1_r1_4", letter: "4", step: true, geo: glyphSq, tr: pack([-0.19, 0.25, 0]) },
  ];
  const tracks = {
    camera: [[0, ...pack([0, 0.2, 1.0])], [30, ...pack([0, 0.2, 1.0])]],
    beat1_stuck0: [[0, ...pack([-0.02, 0.25, 0])], [15, ...pack([-0.02, 0.25, 0])], [16, ...pack([0, -1, 0], QID, [1e-4, 1e-4, 1e-4])]],
    beat1_dir0: [[0, ...pack([0, -1, 0], QID, [1e-4, 1e-4, 1e-4])], [5, ...pack([-0.01, 0.25, 0])], [30, ...pack([-0.01, 0.25, 0])]],
    beat1_sub0: [[0, ...pack([-0.01, 0.18, 0])], [30, ...pack([-0.01, 0.18, 0])]],
    beat1_r0_7: [[0, ...pack([-0.20, 0.25, 0])], [30, ...pack([-0.20, 0.25, 0])]],
    beat1_r1_4: [[0, ...pack([-0.19, 0.25, 0])], [30, ...pack([-0.19, 0.25, 0])]],
  };
  const hits = lineOverlaps(makeAnim(objects, tracks, { frames: 31 }));
  assert.equal(hits.length, 1);
  assert.match(describeLineOverlaps(hits)[0].text, /beat1_dir.*beat1_stuck|beat1_stuck.*beat1_dir/);
});

test("oversizedUiBoxes catches raw trs() on kit.picture() while clearing pic.at() and UI panels", () => {
  const picGeo = { type: "uiBox", rect: [-300, -200, 600, 400], uvRect: [0, 0, 600, 400], thickness: 0.01, unitScale: 0.4 };
  const panelGeo = { type: "uiBox", rect: [-720, -450, 1440, 900], uvRect: [0, 0, 1440, 900], thickness: 0.008 };
  const objects = [
    { name: "panel_nav", geo: panelGeo, tr: pack([0, 0, 0], QID, [1, 1, 1]) },
    { name: "beat1_okPic", geo: picGeo, tr: pack([0, 0.2, 0], UPRIGHT, [0.4, 0.4, 0.4]) },
    { name: "beat1_rawTrs", geo: picGeo, tr: pack([0, 0.2, 0], QID, [1, 1, 1]) },
  ];
  const hits = oversizedUiBoxes(makeAnim(objects, {}, { frames: 12 }));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "beat1_rawTrs");
  assert.match(describeOversizedUiBoxes(hits)[0].text, /pic\.at/);
});

test("movieWraps warns when a cyclic video card runs out of frames while visible and clears cyclic:false or full-length clips", () => {
  const cardGeo = { type: "uiBox", rect: [-200, -112, 400, 224], uvRect: [0, 0, 400, 224], thickness: 0.005 };
  const objects = [
    { name: "camera", parent: "root", tr: pack([200, 0.2, 0.8]) },
    { name: "beat1_shortWrap", geo: cardGeo, mat: { type: "ui", movie: "assets/short.mp4", frames: 30, start: 11 }, tr: pack([200, 0.2, 0], UPRIGHT, [0.5, 0.5, 0.5]) },
    { name: "beat1_holdLast", geo: cardGeo, mat: { type: "ui", movie: "assets/short.mp4", frames: 30, start: 11, cyclic: false }, tr: pack([200, 0.2, 0], UPRIGHT, [0.5, 0.5, 0.5]) },
    { name: "beat1_longEnough", geo: cardGeo, mat: { type: "ui", movie: "assets/long.mp4", frames: 80, start: 11 }, tr: pack([200, 0.2, 0], UPRIGHT, [0.5, 0.5, 0.5]) },
    { name: "beat1_spinner", geo: cardGeo, mat: { type: "ui", movie: "assets/spin.mp4", frames: 20, start: 1 }, tr: pack([200, 0.2, 0], UPRIGHT, [0.5, 0.5, 0.5]) },
  ];
  // Frames 1..50 visible: shortWrap (start 11 + 30 = 41 <= 50, len=40 < 60) wraps once before cut -> flagged!
  // holdLast has cyclic:false -> clean! longEnough (11 + 80 = 91 > 50) -> clean! spinner (len=50 >= 2*20) -> clean!
  const park = pack([200, -2, 0], QID, [1e-4, 1e-4, 1e-4]);
  const show = pack([200, 0.2, 0], UPRIGHT, [0.5, 0.5, 0.5]);
  const tracks = {
    camera: [[0, ...pack([200, 0.2, 0.8])], [59, ...pack([200, 0.2, 0.8])]],
    beat1_shortWrap: [[0, ...park], [9, ...park], [10, ...show], [49, ...show], [50, ...park]],
    beat1_holdLast: [[0, ...park], [9, ...park], [10, ...show], [49, ...show], [50, ...park]],
    beat1_longEnough: [[0, ...park], [9, ...park], [10, ...show], [49, ...show], [50, ...park]],
    beat1_spinner: [[0, ...show], [49, ...show], [50, ...park]],
  };
  const hits = movieWraps(makeAnim(objects, tracks, { frames: 60 }));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "beat1_shortWrap");
  assert.match(describeMovieWraps(hits)[0].text, /wraps back to frame 1/);
});

test("edgeCrops catches custom beat props and 3D headlines clipped at frame edges while ignoring wide backdrops", () => {
  const clapGeo = { type: "roundBox", size: [0.12, 0.08, 0.02], radius: 0.003 };
  const bgGeo = { type: "box", size: [3.2, 1.5, 0.01] };
  const glyphSq = { type: "curve", rings: [[[0, 0], [0.18, 0], [0.18, 0.05], [0, 0.05]]], depth: 0.004 };
  // Camera at z=0.80, fov=30 deg -> tanY ≈ 0.268, tanX ≈ 0.476 -> half-width at z=0 is ~0.381 m
  const objects = [
    { name: "camera", parent: "root", tr: pack([0, 0.15, 0.80]) },
    { name: "beat1_bg_wall", parent: "root", geo: bgGeo, tr: pack([0, 0.2, -0.8]) },
    { name: "beat1_clap_slate", parent: "root", geo: clapGeo, tr: pack([-0.38, 0.08, 0]) },
    { name: "beat1_ok_slate", parent: "root", geo: clapGeo, tr: pack([-0.10, 0.08, 0]) },
    { name: "beat0_rl0", parent: "root", letter: "专", line: "rl", letterIndex: 0, geo: glyphSq, tr: pack([-0.46, 0.20, 0]) },
  ];
  const tracks = {
    camera: [[0, ...pack([0, 0.15, 0.80])], [30, ...pack([0, 0.15, 0.80])]],
  };
  const anim = { ...makeAnim(objects, tracks, { frames: 31 }), scalars: { fov: Array(31).fill(30) } };
  const hits = edgeCrops(anim, { aspect: 16 / 9 });
  const targets = hits.map((h) => h.target).sort();
  assert.deepEqual(targets, ["beat0_rl", "beat1_clap"]);
  assert.match(describeEdgeCrops(hits)[0].text, /left frame edge/);
});

test("cardScreenOverlaps flags stacked foreground/background picture cards and clears side-by-side monitors", () => {
  const cardGeo = { type: "uiBox", rect: [-160, -90, 320, 180], uvRect: [0, 0, 320, 180], thickness: 0.004 };
  const objects = [
    { name: "camera", parent: "root", tr: pack([0, 0.15, 1.0]) },
    // Stacked on left: scr2 at z=+0.05 covers scr1 at z=-0.12 (170 mm apart in Z so zero 3D collision, >70% 2D overlap)
    { name: "beat2_scr1_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([-0.20, 0.15, -0.12], UPRIGHT, [1, 1, 1]) },
    { name: "beat2_scr2_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([-0.18, 0.14, 0.05], UPRIGHT, [1, 1, 1]) },
    // Clean side-by-side card on right
    { name: "beat2_scr3_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.28, 0.15, 0.0], UPRIGHT, [1, 1, 1]) },
  ];
  const anim = { ...makeAnim(objects, { camera: [[0, ...pack([0, 0.15, 1.0])], [30, ...pack([0, 0.15, 1.0])]] }, { frames: 31 }), scalars: { fov: Array(31).fill(30) } };
  const hits = cardScreenOverlaps(anim, { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].front, "beat2_scr2_pic");
  assert.equal(hits[0].back, "beat2_scr1_pic");
  assert.ok(hits[0].share > 0.6);
  assert.match(describeCardScreenOverlaps(hits)[0].text, /covers \d+% of beat2_scr1_pic/);
});

test("heroFaceOcclusions catches foreground props crossing in front of hero_head and clears side/overhead props", () => {
  const objects = [
    { name: "camera", parent: "root", tr: pack([0, 0.15, 0.9]) },
    { name: "hero", parent: "root", tr: pack([0, 0, 0.10]) },
    { name: "hero_head", parent: "hero", tr: pack([0, 0.13, 0]) },
    { name: "hero_face", parent: "hero_head", geo: { type: "ellipsoid", r: [0.045, 0.042, 0.04] }, tr: pack([0, 0, 0]) },
    // Prop crossing right in front of face (z=0.22 > hero z=0.10)
    { name: "beat1_clap_slate", parent: "root", geo: { type: "roundBox", size: [0.10, 0.07, 0.015], radius: 0.003 }, tr: pack([0, 0.13, 0.22]) },
    // Prop held cleanly overhead (y=0.28)
    { name: "beat1_high_slate", parent: "root", geo: { type: "roundBox", size: [0.10, 0.07, 0.015], radius: 0.003 }, tr: pack([0, 0.28, 0.22]) },
  ];
  const anim = { ...makeAnim(objects, { camera: [[0, ...pack([0, 0.15, 0.9])], [20, ...pack([0, 0.15, 0.9])]] }, { frames: 21 }), scalars: { fov: Array(21).fill(30) } };
  const hits = heroFaceOcclusions(anim, { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].prop, "beat1_clap");
  assert.match(describeHeroFaceOcclusions(hits)[0].text, /crosses in front of the toy's face/);
});

test("confettiOverText flags dense confetti lingering across a 3D readout while clearing low bursts", () => {
  const glyphSq = { type: "curve", rings: [[[0, 0], [0.04, 0], [0.04, 0.06], [0, 0.06]]], depth: 0.004 };
  const flakeGeo = { type: "box", size: [0.008, 0.001, 0.006] };
  const objects = [
    { name: "camera", parent: "root", tr: pack([0, 0.2, 1.0]) },
    { name: "beat2_n0", letter: "5", step: true, geo: glyphSq, tr: pack([-0.06, 0.32, 0.04]) },
    { name: "beat2_n1", letter: ".", step: true, geo: glyphSq, tr: pack([-0.02, 0.32, 0.04]) },
    { name: "beat2_n2", letter: "6", step: true, geo: glyphSq, tr: pack([0.02, 0.32, 0.04]) },
    { name: "beat2_n3", letter: "万", step: true, geo: glyphSq, tr: pack([0.06, 0.32, 0.04]) },
    ...[0, 1, 2, 3].map((i) => ({ name: `beat2_conf${i}`, geo: flakeGeo, mat: { type: "flake" }, tr: pack([-0.03 + i * 0.02, 0.34, 0.08]) })),
  ];
  const anim = { ...makeAnim(objects, { camera: [[0, ...pack([0, 0.2, 1.0])], [20, ...pack([0, 0.2, 1.0])]] }, { frames: 21 }), scalars: { fov: Array(21).fill(30) } };
  const hits = confettiOverText(anim, { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, "beat2_readout");
  assert.match(describeConfettiOverText(hits)[0].text, /confetti crosses 3D lettering "5\.6万"/);

  // Move flakes down to y=0.14 -> zero overlap with readout at y=0.32
  const cleanObjs = objects.map((o) => (o.name.includes("conf") ? { ...o, tr: pack([0, 0.14, 0.08]) } : o));
  const cleanAnim = { ...makeAnim(cleanObjs, { camera: [[0, ...pack([0, 0.2, 1.0])], [20, ...pack([0, 0.2, 1.0])]] }, { frames: 21 }), scalars: { fov: Array(21).fill(30) } };
  assert.equal(confettiOverText(cleanAnim, { aspect: 16 / 9 }).length, 0);
});

test("pageless detects custom opening beats using page.image / page.panels and honors profilePage: false", () => {
  const dir = mkdtempSync(join(tmpdir(), "ctoy-ui-"));
  try {
    mkdirSync(join(dir, "beats"), { recursive: true });
    writeFileSync(join(dir, "beats/opening-slate.js"), "export function makeBeat({ page }) { const UI = { image: page.image, panels: page.panels }; return UI; }\n");
    const film = {
      format: { bpm: 120 },
      story: { segments: [{ beat: "beats/opening-slate.js", bars: 3 }, { story: "endCard" }] },
    };
    assert.equal(pageless(film, dir), false);
    assert.equal(pageless({ ...film, story: { ...film.story, profilePage: false } }, dir), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apply-research preserves hand-tuned custom beat bars when facts.json omits bars, and story-test flags noun-pile shorthand", () => {
  const applySrc = readFileSync(join(root, "skills/creator-toy-intro/engine/scripts/apply-research.mjs"), "utf8");
  assert.match(applySrc, /prevBeats\.get\(beatPath\)/);
  const storyTestSrc = readFileSync(join(root, "skills/creator-toy-intro/engine/scripts/story-test.mjs"), "utf8");
  assert.match(storyTestSrc, /telegraphic noun-pile or insider shorthand/);
});

test("edgeCrops catches clipped high-res uiBox wing cards, clears tucked cards, and skips 6+ card wall montages", () => {
  // 1440×900 screenshot placed at 0.36 m wide (unitScale = 0.25): unscaled rect is 1440 mm > 550 mm
  const hiResCard = {
    type: "uiBox",
    rect: [-720, -450, 1440, 900],
    uvRect: [0, 0, 1440, 900],
    thickness: 0.008,
    unitScale: 0.25,
  };
  const s = [0.25, 0.25, 0.25];
  const mkWingScene = (leftX, rightX, count = 3) => {
    const cards = count === 3
      ? [
          { name: "beat2_c_agy", geo: hiResCard, mat: { type: "ui" }, tr: pack([leftX, 0.22, 0], UPRIGHT, s) },
          { name: "beat2_c_cli", geo: hiResCard, mat: { type: "ui" }, tr: pack([0, 0.26, -0.05], UPRIGHT, s) },
          { name: "beat2_c_road", geo: hiResCard, mat: { type: "ui" }, tr: pack([rightX, 0.22, 0], UPRIGHT, s) },
        ]
      : Array.from({ length: count }, (_, i) => ({
          name: `beat2_c_${i}`,
          geo: hiResCard,
          mat: { type: "ui" },
          tr: pack([-0.75 + i * 0.3, 0.22, 0], UPRIGHT, s),
        }));
    return {
      fps: 30,
      frames: 24,
      sub: 1,
      scalars: { fov: Array(24).fill(30) },
      objects: [
        { name: "camera", geo: null, camera: true, tr: pack([0, 0.22, 1.4]) },
        ...cards,
      ],
      tracks: {},
    };
  };

  // Wing cards at ±0.56 with width 0.36 -> outer edges at ±0.74 past frustum (~0.668 at dist 1.4, fov 30, 16:9)
  const clipped = edgeCrops(mkWingScene(-0.56, 0.56), { every: 1 });
  assert.deepEqual(clipped.map((c) => c.target).sort(), ["beat2_c_agy", "beat2_c_road"]);
  assert.ok(clipped.find((c) => c.target === "beat2_c_agy").edges.includes("left"));
  assert.ok(clipped.find((c) => c.target === "beat2_c_road").edges.includes("right"));

  // Tucked cleanly inside 16:9 frustum (±0.42 -> outer edges ±0.60 < 0.668)
  assert.deepEqual(edgeCrops(mkWingScene(-0.42, 0.42), { every: 1 }), []);

  // 6+ card montage (layout.wall / corridor) intentionally bleeds past frame edges without false warnings
  assert.deepEqual(edgeCrops(mkWingScene(-0.56, 0.56, 6), { every: 1 }), []);
});

test("heroFaceOcclusions detects a high-res uiBox crossing the head and ignores separate left/right wing cards", () => {
  const hiResCard = {
    type: "uiBox",
    rect: [-720, -450, 1440, 900],
    uvRect: [0, 0, 1440, 900],
    thickness: 0.008,
    unitScale: 0.16,
  };
  const s = [0.16, 0.16, 0.16]; // 0.23 m × 0.144 m card
  const baseObjs = [
    { name: "camera", parent: "root", tr: pack([0, 0.16, 1.0]) },
    { name: "hero", parent: "root", tr: pack([0, 0, 0]) },
    { name: "hero_head", parent: "hero", tr: pack([0, 0.16, 0]) },
    { name: "hero_skull", parent: "hero_head", geo: { type: "ellipsoid", r: [0.045, 0.045, 0.045] }, tr: pack([0, 0, 0]) },
  ];

  // Two wing cards sharing prefix `beat2_c_*` on left and right of head: must NOT merge across the face!
  const flanked = {
    ...makeAnim(
      [
        ...baseObjs,
        { name: "beat2_c_left", parent: "root", geo: hiResCard, mat: { type: "ui" }, tr: pack([-0.24, 0.16, 0.20], UPRIGHT, s) },
        { name: "beat2_c_right", parent: "root", geo: hiResCard, mat: { type: "ui" }, tr: pack([0.24, 0.16, 0.20], UPRIGHT, s) },
      ],
      {},
      { frames: 18 },
    ),
    scalars: { fov: Array(18).fill(30) },
  };
  assert.deepEqual(heroFaceOcclusions(flanked, { aspect: 16 / 9 }), []);

  // Single high-res uiBox directly in front of head: caught cleanly
  const blocked = {
    ...makeAnim(
      [
        ...baseObjs,
        { name: "beat2_c_center", parent: "root", geo: hiResCard, mat: { type: "ui" }, tr: pack([0, 0.16, 0.20], UPRIGHT, s) },
      ],
      {},
      { frames: 18 },
    ),
    scalars: { fov: Array(18).fill(30) },
  };
  const hits = heroFaceOcclusions(blocked, { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].prop, "beat2_c_center");
});

test("blenderCandidates({ local: true }) skips ~/.local/bin/blender remote wrappers while preserving explicit BLENDER", () => {
  const prevBlender = process.env.BLENDER;
  const prevLocal = process.env.COLAB_LOCAL;
  const prevAll = process.env.COLAB_ALL;
  try {
    delete process.env.BLENDER;
    delete process.env.COLAB_LOCAL;
    delete process.env.COLAB_ALL;
    const localList = blenderCandidates({ local: true });
    assert.ok(localList.every((p) => !p.includes(".local/bin/blender") && !p.endsWith("/bin/blender")));

    process.env.BLENDER = "/custom/blender-bin";
    assert.equal(blenderCandidates({ local: true })[0], "/custom/blender-bin");

    // Default macOS app path in BLENDER does not preempt remote wrappers unless local/COLAB_LOCAL is set
    process.env.BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender";
    const remoteFirst = blenderCandidates({ local: false });
    assert.ok(remoteFirst[0].endsWith("/bin/blender") || remoteFirst[0].includes(".local/bin/blender"));
    assert.ok(remoteFirst.includes("/Applications/Blender.app/Contents/MacOS/Blender"));
  } finally {
    if (prevBlender === undefined) delete process.env.BLENDER; else process.env.BLENDER = prevBlender;
    if (prevLocal === undefined) delete process.env.COLAB_LOCAL; else process.env.COLAB_LOCAL = prevLocal;
    if (prevAll === undefined) delete process.env.COLAB_ALL; else process.env.COLAB_ALL = prevAll;
  }
});

test("lineBackdropClashes detects foreground 3D beat headlines projecting across hero sandals or showcase cards, and passes over clean floor", () => {
  const glyphGeo = {
    type: "curve",
    rings: [[[0, 0], [0.04, 0], [0.04, 0.045], [0, 0.045]]],
    depth: 0.004,
  };
  const hiResCard = {
    type: "uiBox",
    rect: [-720, -450, 1440, 900],
    uvRect: [0, 0, 1440, 900],
    thickness: 0.008,
    unitScale: 0.22,
  };
  const mkHeadline = (yPos) =>
    [..."专治痛点"].map((ch, i) => ({
      name: `beat1_title${i}`,
      parent: "root",
      letter: ch,
      letterIndex: i,
      line: "title",
      geo: glyphGeo,
      mat: { type: "type", color: "#FFFDF8" },
      tr: pack([-0.09 + i * 0.05, yPos, 0.25]),
    }));

  const mkScene = (yPos) => ({
    ...makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([0, 0.16, 1.2]) },
        { name: "hero", parent: "root", tr: pack([0, 0.04, -0.10]) },
        { name: "hero_shoes", parent: "hero", geo: { type: "box", size: [0.18, 0.06, 0.12] }, tr: pack([0, 0.03, 0]) },
        { name: "beat1_card", parent: "root", geo: hiResCard, mat: { type: "ui" }, tr: pack([0, 0.30, -0.20], UPRIGHT, [0.22, 0.22, 0.22]) },
        ...mkHeadline(yPos),
      ],
      {},
      { frames: 24 },
    ),
    scalars: { fov: Array(24).fill(30) },
  });

  // 1) Headline at y = 0.08 in front (z = 0.25) projects right over hero_shoes (z = -0.10)
  const overHero = lineBackdropClashes(mkScene(0.08), { aspect: 16 / 9 });
  assert.equal(overHero.length, 1);
  assert.equal(overHero[0].backdrop, "hero");
  const descHero = describeLineBackdropClashes(overHero);
  assert.equal(descHero.length, 1);
  assert.ok(descHero[0].text.includes("专治痛点"));
  assert.ok(descHero[0].text.includes("hero"));

  // 2) Headline raised to y = 0.25 in front projects right over beat1_card (z = -0.20)
  const overCard = lineBackdropClashes(mkScene(0.25), { aspect: 16 / 9 });
  assert.equal(overCard.length, 1);
  assert.equal(overCard[0].backdrop, "beat1_card");

  // 3) Headline lowered onto clean dark floor in front (y = -0.06) clears both hero_shoes and beat1_card
  assert.deepEqual(lineBackdropClashes(mkScene(-0.06), { aspect: 16 / 9 }), []);
});

test("paperOf picks cream ink on saturated orange/crimson/cobalt papers, dark ink on bright yellow, and honors explicit ink", () => {
  assert.deepEqual(paperOf("#FF4500"), ["#FF4500", "#FBF3E6"]);
  assert.deepEqual(paperOf("#E11D48"), ["#E11D48", "#FBF3E6"]);
  assert.deepEqual(paperOf("#0E62BE"), ["#0E62BE", "#FBF3E6"]);
  assert.deepEqual(paperOf("#FFD166"), ["#FFD166", "#161514"]);
  assert.deepEqual(paperOf("#FF4500", "#FFFFFF"), ["#FF4500", "#FFFFFF"]);
  assert.deepEqual(paperOf("cream", "#2F5D9E"), ["#EFE6D4", "#2F5D9E"]);
  const lbl = makeLabel({ id: "name", text: "左海", em: 0.04, paper: "#FF4500", ink: "#FFFDF8", c: [0, 0, 0], tilt: 0, at: 1, letterAt: () => 1.1, adv: () => 1 });
  assert.equal(lbl.ink, "#FFFDF8");
});

test("floor route/lane/carpet/runway props never trigger false clashes, edge crops, or face occlusions", () => {
  const objects = [
    { name: "camera", parent: "root", camera: true, tr: pack([0, 0.16, 1.0]) },
    { name: "hero", parent: "root", tr: pack([0, 0.01, 0]) },
    { name: "hero_head", parent: "hero", tr: pack([0, 0.12, 0]) },
    { name: "hero_face", parent: "hero_head", geo: { type: "ellipsoid", r: [0.045, 0.042, 0.04] }, tr: pack([0, 0, 0]) },
    { name: "beat0_route_dash_0", parent: "root", geo: { type: "box", size: [1.8, 0.004, 0.12] }, tr: pack([0, 0.01, 0.1]) },
    { name: "beat0_runway_strip", parent: "root", geo: { type: "roundBox", size: [0.4, 0.08, 0.02], radius: 0.003 }, tr: pack([0, 0.13, 0.25]) },
  ];
  const anim = { ...makeAnim(objects, {}, { frames: 24 }), scalars: { fov: Array(24).fill(30) } };
  assert.deepEqual(solidClashes(anim), []);
  assert.deepEqual(edgeCrops(anim, { aspect: 16 / 9 }), []);
  assert.deepEqual(heroFaceOcclusions(anim, { aspect: 16 / 9 }), []);
});

test("propCoversToyBody flags a waist-high foreground plaque cutting across the toy and clears a low ankle lip", () => {
  const plaqueGeo = { type: "uiBox", rect: [-160, -55, 320, 110], uvRect: [0, 0, 320, 110], thickness: 0.004, unitScale: 0.5 };
  const mkScene = (plaqueY) => ({
    ...makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([0, 0.16, 1.0]) },
        { name: "hero", parent: "root", tr: pack([0, 0, 0]) },
        { name: "hero_legs", parent: "hero", geo: { type: "box", size: [0.08, 0.08, 0.06] }, tr: pack([0, 0.04, 0]) },
        { name: "hero_torso", parent: "hero", geo: { type: "box", size: [0.09, 0.08, 0.06] }, tr: pack([0, 0.12, 0]) },
        { name: "hero_head_mesh", parent: "hero", geo: { type: "ellipsoid", r: [0.05, 0.05, 0.05] }, tr: pack([0, 0.20, 0]) },
        { name: "beat1_plaque24", parent: "root", geo: plaqueGeo, mat: { type: "ui" }, tr: pack([0, plaqueY, 0.22], UPRIGHT, [0.5, 0.5, 0.5]) },
      ],
      {},
      { frames: 24 },
    ),
    scalars: { fov: Array(24).fill(30) },
  });

  const hits = propCoversToyBody(mkScene(0.06), { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].card, "beat1_plaque24");
  assert.ok(hits[0].share >= 0.25);
  assert.match(describePropCoversToyBody(hits)[0].text, /cuts across \d+% of the toy's standing body/);

  // Lowered cleanly below the toy's feet
  assert.deepEqual(propCoversToyBody(mkScene(-0.08), { aspect: 16 / 9 }), []);
});

test("heroStreaksOverText flags vertical sky-drops across top readouts and clears stationary podiums or floor strides", () => {
  const glyphSq = { type: "curve", rings: [[[0, 0], [0.045, 0], [0.045, 0.065], [0, 0.065]]], depth: 0.004 };
  const baseObjs = [
    { name: "camera", parent: "root", camera: true, tr: pack([0, 0.20, 1.1]) },
    { name: "hero", parent: "root", tr: pack([0, 0.04, 0.10]) },
    { name: "hero_body", parent: "hero", geo: { type: "box", size: [0.10, 0.16, 0.08] }, tr: pack([0, 0.08, 0]) },
    { name: "beat2_r0", letter: "1", step: true, geo: glyphSq, tr: pack([-0.05, 0.30, -0.05]) },
    { name: "beat2_r1", letter: "8", step: true, geo: glyphSq, tr: pack([0.00, 0.30, -0.05]) },
    { name: "beat2_r2", letter: "万", step: true, geo: glyphSq, tr: pack([0.05, 0.30, -0.05]) },
  ];

  // 1) Fast vertical sky-drop from y=0.52 down to y=0.04 across readout at y=0.30 -> flagged!
  const dropHeroTrack = Array.from({ length: 15 }, (_, f) => {
    const u = f / 14;
    return [f, ...pack([0, 0.04 + 0.50 * (1 - u) * (1 - u), 0.10])];
  });
  const dropAnim = { ...makeAnim(baseObjs, { hero: dropHeroTrack }, { frames: 15 }), scalars: { fov: Array(15).fill(30) } };
  const dropHits = heroStreaksOverText(dropAnim, { aspect: 16 / 9 });
  assert.equal(dropHits.length, 1);
  assert.equal(dropHits[0].line, "beat2_readout");
  assert.match(describeHeroStreaksOverText(dropHits)[0].text, /airborne toy streaks in front of 3D lettering "18万"/);

  // 2) Stationary toy standing on a high podium (y=0.26, vy=0) -> NOT flagged as an airborne streak
  const podiumTrack = Array.from({ length: 15 }, (_, f) => [f, ...pack([0, 0.26, 0.10])]);
  const podiumAnim = { ...makeAnim(baseObjs, { hero: podiumTrack }, { frames: 15 }), scalars: { fov: Array(15).fill(30) } };
  assert.deepEqual(heroStreaksOverText(podiumAnim, { aspect: 16 / 9 }), []);

  // 3) Floor-level lateral strideIn (y stays near 0.04..0.065) -> completely clear of top readout!
  const strideTrack = Array.from({ length: 15 }, (_, f) => [f, ...pack([-0.35 + (0.35 * f) / 14, 0.05, 0.10])]);
  const strideAnim = { ...makeAnim(baseObjs, { hero: strideTrack }, { frames: 15 }), scalars: { fov: Array(15).fill(30) } };
  assert.deepEqual(heroStreaksOverText(strideAnim, { aspect: 16 / 9 }), []);
});

test("readout.centerAt, readoutBadge, strideIn, and strideOut keep badges symmetric/flush and entrances floor-level", async () => {
  const fmt = (v) => formatCount(v, { decimals: 0, unit: "万" });
  const r = readout({ fmt, from: 1, to: 18, em: 0.06, adv: (k) => (k.endsWith("万") ? 1.0 : 0.6) });
  const centered = r.centerAt(18, { p: [0, 0, 0], q: QID, s: [1, 1, 1] }, { afterWidth: 0.09, gap: 0.02 });
  // Total width = r.width(18) + 0.02 + 0.09: left edge of '1' sits at -totalW / 2
  const totalW = r.width(18) + 0.02 + 0.09;
  const shownPositions = Object.entries(centered).filter(([, tr]) => tr.s[0] > 0.5).map(([, tr]) => tr.p[0]).sort((a, b) => a - b);
  assert.equal(shownPositions.length, 3); // '1', '8', '万'
  assert.ok(Math.abs(shownPositions[0] - (-totalW / 2)) < 1e-6);

  const dir = mkdtempSync(join(tmpdir(), "ctoy-kit-"));
  try {
    writeFileSync(join(dir, "film.json"), JSON.stringify({ format: { fps: 30, duration: 6, size: [1920, 1080] }, toy: "toy.json" }));
    writeFileSync(join(dir, "toy.json"), JSON.stringify({
      height: 0.14,
      colors: { body: "#2F61EB" },
      joints: { head: { p: [0, 0.10, 0] }, armL: { p: [0.03, 0.08, 0] }, armR: { p: [-0.03, 0.08, 0] }, legL: { p: [0.015, 0.03, 0] }, legR: { p: [-0.015, 0.03, 0] } },
      parts: [{ name: "torso", group: "body", shape: "roundBox", size: [0.06, 0.08, 0.05], mat: "body" }],
    }));
    const kitUrl = new URL("../skills/creator-toy-intro/engine/lib/beatkit.js", import.meta.url).href;
    const probe = `
      import * as kit from ${JSON.stringify(kitUrl)};
      const fmt = (v) => kit.formatCount(v, { decimals: 0, unit: "万" });
      const glyph = {
        has: () => true,
        adv: (k) => (k.split(":")[1].codePointAt(0) >= 0x2e80 ? 1.0 : 0.62),
        geo: (_k, em, depth, bevel) => ({ type: "curve", rings: [[[0, 0], [em * 0.6, 0], [em * 0.6, em * 0.8], [0, em * 0.8]]], depth, bevel }),
      };
      const badge = kit.readoutBadge(glyph, { from: 1, to: 18, fmt, label: "阅读", em: 0.04 });
      const declared = [];
      badge.declare((o) => declared.push(o), "beat1_b");
      const placed = {};
      badge.put((name, tr) => { placed[name] = tr; }, "beat1_b", 18, [0, 0.32, 0], [0, 0.20, 1.0], 1);
      const ys = [];
      for (let k = 0; k <= 10; k++) {
        const g = k * 0.05;
        ys.push(kit.strideIn(kit.stand([0, 0, 0]), g, 0, 0.5, [-0.4, 0, 0], [0, 0, 0]).pos[1]);
        ys.push(kit.strideOut(kit.stand([0, 0, 0]), g, 0, 0.5, [0, 0, 0], [0.4, 0, 0]).pos[1]);
      }
      console.log(JSON.stringify({ declared, placed, ys }));
    `;
    const sub = spawnSync("node", ["--input-type=module", "-e", probe], { env: { ...process.env, FILM: dir }, encoding: "utf8" });
    assert.equal(sub.status, 0, sub.stderr);
    const { declared, placed, ys } = JSON.parse(sub.stdout.trim().split(/\r?\n/).pop());
    const animObjs = declared.map((o) => {
      const t = placed[o.name];
      return { ...o, parent: "root", tr: pack(t.p, t.q, t.s) };
    });
    // Flush plate mounting (< 3 mm gap) triggers zero floatingSmallLetters double-shadow warnings!
    assert.deepEqual(floatingSmallLetters(makeAnim(animObjs, {}, { frames: 18 })), []);
    for (const y of ys) assert.ok(y >= 0 && y <= 0.03);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("propCoversToyBody catches waist-high 3D curve/ellipsoid bow groups and clears overhead bow + angled side ribbons", () => {
  const wingL = { type: "curve", rings: [[[0, 0], [-0.075, 0.04], [-0.08, -0.03]]], depth: 0.012, bevel: 0.002 };
  const wingR = { type: "curve", rings: [[[0, 0], [0.075, 0.04], [0.08, -0.03]]], depth: 0.012, bevel: 0.002 };
  const qAngL = [0, 0, Math.sin(0.36 / 2), Math.cos(0.36 / 2)];
  const qAngR = [0, 0, Math.sin(-0.36 / 2), Math.cos(-0.36 / 2)];
  const mkBowScene = (bowY, withSideRibbons = false) => ({
    ...makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([0, 0.18, 0.95]) },
        { name: "hero", parent: "root", tr: pack([0, 0.05, 0]) },
        { name: "hero_legs", parent: "hero", geo: { type: "box", size: [0.07, 0.07, 0.05] }, tr: pack([0, 0.035, 0]) },
        { name: "hero_torso", parent: "hero", geo: { type: "box", size: [0.08, 0.07, 0.05] }, tr: pack([0, 0.10, 0]) },
        { name: "hero_head_mesh", parent: "hero", geo: { type: "ellipsoid", r: [0.05, 0.05, 0.05] }, tr: pack([0, 0.17, 0]) },
        { name: "beat1_bow_wingL", parent: "root", geo: wingL, mat: { type: "type" }, tr: pack([0, bowY, 0.12]) },
        { name: "beat1_bow_wingR", parent: "root", geo: wingR, mat: { type: "type" }, tr: pack([0, bowY, 0.12]) },
        { name: "beat1_bow_knot", parent: "root", geo: { type: "ellipsoid", r: [0.022, 0.022, 0.014] }, mat: { type: "type" }, tr: pack([0, bowY, 0.13]) },
        ...(withSideRibbons ? [
          { name: "beat1_rib_pull_L", parent: "root", geo: { type: "roundBox", size: [0.22, 0.014, 0.008], radius: 0.004 }, mat: { type: "glow" }, tr: pack([-0.12, 0.23, 0.04], qAngL) },
          { name: "beat1_rib_pull_R", parent: "root", geo: { type: "roundBox", size: [0.22, 0.014, 0.008], radius: 0.004 }, mat: { type: "glow" }, tr: pack([0.12, 0.23, 0.04], qAngR) },
        ] : []),
      ],
      {},
      { frames: 24 },
    ),
    scalars: { fov: Array(24).fill(36) },
  });

  // Waist-high 3D bow group (y=0.11) slices across the standing figure -> flagged!
  const hits = propCoversToyBody(mkBowScene(0.11), { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].card, "beat1_bow");
  assert.ok(hits[0].share >= 0.25);

  // Lifted overhead (y=0.30) with angled L/R side ribbons framing open air around hero -> 100% clear!
  assert.deepEqual(propCoversToyBody(mkBowScene(0.30, true), { aspect: 16 / 9 }), []);
});

test("lineBackdropClashes flags a 0.20 s grounded hop covering a 3D headline, and bannerLine({ level: true }) stays flush & level", async () => {
  const charGeo = { type: "curve", rings: [[[0, 0], [0.028, 0], [0.028, 0.036], [0, 0.036]]], depth: 0.003 };
  // 7-frame (0.20 s) grounded hop at frames 4..10 pushes hero_head_mesh onto beat0_ln_intro_0
  const hopTrack = Array.from({ length: 18 }, (_, f) => {
    const hop = f >= 4 && f <= 10 ? 0.035 * Math.sin(Math.PI * ((f - 4) / 6)) : 0;
    return [f * 2, ...pack([0, 0.05 + hop, 0.02])];
  });
  const hopAnim = {
    ...makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([0, 0.16, 0.70]) },
        { name: "hero", parent: "root", tr: pack([0, 0.05, 0.02]) },
        { name: "hero_head_mesh", parent: "hero", geo: { type: "ellipsoid", r: [0.048, 0.048, 0.045] }, tr: pack([0, 0.145, 0]) },
        { name: "beat0_ln_intro_0", parent: "root", letter: "央", line: "ln_intro_", letterIndex: 0, geo: charGeo, tr: pack([-0.014, 0.205, 0.01]) },
        { name: "beat0_ln_intro_1", parent: "root", letter: "企", line: "ln_intro_", letterIndex: 1, geo: charGeo, tr: pack([0.016, 0.205, 0.01]) },
      ],
      { hero: hopTrack },
      { frames: 18 },
    ),
    scalars: { fov: Array(35).fill(36) },
  };
  const clashes = lineBackdropClashes(hopAnim, { aspect: 16 / 9 });
  assert.equal(clashes.length, 1);
  assert.equal(clashes[0].backdrop, "hero");

  // Verify kit.bannerLine flush plate (< 3 mm) and level:true zero-yaw orientation for off-center bottom bars
  const dir = mkdtempSync(join(tmpdir(), "ctoy-ban-"));
  try {
    writeFileSync(join(dir, "film.json"), JSON.stringify({ format: { fps: 30, duration: 4, size: [1920, 1080] }, toy: "toy.json" }));
    writeFileSync(join(dir, "toy.json"), JSON.stringify({ height: 0.12, colors: { body: "#F4DCE7" }, joints: {}, parts: [] }));
    const kitUrl = new URL("../skills/creator-toy-intro/engine/lib/beatkit.js", import.meta.url).href;
    const probe = `
      import * as kit from ${JSON.stringify(kitUrl)};
      const glyph = {
        has: () => true,
        adv: () => 1.0,
        geo: (_k, em, depth, bevel) => ({ type: "curve", rings: [[[0, 0], [em * 0.8, 0], [em * 0.8, em * 0.85], [0, em * 0.85]]], depth, bevel }),
      };
      const ban = kit.bannerLine(glyph, "前助教公开", { em: 0.028 });
      const declared = [];
      ban.declare((o) => declared.push(o), "beat2_sub");
      const placed = {}, hidden = {};
      ban.put((n, tr) => { placed[n] = tr; }, "beat2_sub", [-0.16, 0.03, 0.17], [0, 0.18, 0.85], 1, { level: true });
      ban.put((n, tr) => { hidden[n] = tr; }, "beat2_sub", [-0.16, 0.03, 0.17], [0, 0.18, 0.85], 0, { level: true });
      console.log(JSON.stringify({ declared, placed, hidden }));
    `;
    const sub = spawnSync("node", ["--input-type=module", "-e", probe], { env: { ...process.env, FILM: dir }, encoding: "utf8" });
    assert.equal(sub.status, 0, sub.stderr);
    const { declared, placed, hidden } = JSON.parse(sub.stdout.trim().split(/\r?\n/).pop());
    // level: true keeps quaternion strictly pitch-only (qy === 0, qz === 0) even at x = -0.16!
    assert.ok(Math.abs(placed.beat2_sub_plate.q[1]) < 1e-9);
    assert.ok(Math.abs(placed.beat2_sub_plate.q[2]) < 1e-9);
    // scale=0 parks objects underground at y = -2
    assert.equal(hidden.beat2_sub_plate.p[1], -2);
    const animObjs = declared.map((o) => ({ ...o, parent: "root", tr: pack(placed[o.name].p, placed[o.name].q, placed[o.name].s) }));
    assert.deepEqual(floatingSmallLetters(makeAnim(animObjs, {}, { frames: 18 })), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
