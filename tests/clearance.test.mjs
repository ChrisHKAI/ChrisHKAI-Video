import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { clearance, describe, solidClashes, describeClashes, labelOverlaps, describeLabelOverlaps, lineOverlaps, describeLineOverlaps, edgeCrops, describeEdgeCrops, fastReveal, floatingSmallLetters, describeFloatingLetters, armLiftLimit, offStageHero, describeOffStageHero, offStageObjects, describeOffStageObjects, oversizedUiBoxes, describeOversizedUiBoxes, movieWraps, describeMovieWraps, cardScreenOverlaps, describeCardScreenOverlaps, heroFaceOcclusions, describeHeroFaceOcclusions, confettiOverText, describeConfettiOverText, lineBackdropClashes, describeLineBackdropClashes, propCoversToyBody, describePropCoversToyBody, heroStreaksOverText, describeHeroStreaksOverText, edgeOnCards, describeEdgeOnCards, pedestalSideClashes, describePedestalSideClashes, cardBezelMismatches, describeCardBezelMismatches, frameSlicesCard, describeFrameSlicesCard, sparksOverHeroFace, describeSparksOverHeroFace, plaqueInControlsZone, describePlaqueInControlsZone, preCutHeroGap, describePreCutHeroGap, propBlocksCard, describePropBlocksCard, floatingCtaBase, describeFloatingCtaBase, ctaPropBlocksLabels, describeCtaPropBlocksLabels, emptyCutFrames, describeEmptyCutFrames, coplanarCards, describeCoplanarCards, restBounds } from "../skills/creator-toy-intro/engine/lib/clearance.js";
import { qEuler, qFlat, qRot } from "../skills/creator-toy-intro/engine/lib/quat.js";
import { line, declareLine, putLine, facing, eyePoint } from "../skills/creator-toy-intro/engine/lib/lettering.js";
import * as xDesktop from "../skills/creator-toy-intro/themes/x-desktop/page.js";
import * as xMobile from "../skills/creator-toy-intro/themes/x-mobile/page.js";
import * as xDesktopLayout from "../skills/creator-toy-intro/themes/x-desktop/layout.js";
import * as xMobileLayout from "../skills/creator-toy-intro/themes/x-mobile/layout.js";
import { readout, formatCount, resolveReadoutFmt } from "../skills/creator-toy-intro/engine/lib/counter.js";
import { unexpectedTools, isPlaceholderAnswer, retrySearchPrompt } from "../skills/creator-toy-intro/engine/scripts/grok-search.mjs";
import { makeLabel, paperOf, tear } from "../skills/creator-toy-intro/engine/lib/labels.js";
import { pageless } from "../skills/creator-toy-intro/templates/isnail-30/ui.js";
import { places } from "../skills/creator-toy-intro/templates/isnail-30/places.js";
import { buildFigure } from "../skills/creator-toy-intro/characters/tim-line/figure.js";
import { blenderCandidates, isRemoteBlenderWrapper } from "../skills/creator-toy-intro/engine/lib/tools.js";

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

test("bannerLine and readoutBadge { level: true } stay horizontal on X-offset custom beat stages, and readout accepts object/string fmt", async () => {
  const adv = (k) => (k.endsWith("万") ? 1.0 : 0.6);
  const rObj = readout({ fmt: { decimals: 1, unit: "万" }, from: 0, to: 9.4, em: 0.05, adv });
  assert.ok(Math.abs(rObj.width(9.4) - 0.14) < 1e-9);
  const rStr = readout({ fmt: "万", from: 1, to: 12, em: 0.05, adv });
  assert.ok(rStr.width(12) > 0.10);
  const rDef = readout({ from: 0, to: 27, em: 0.05, adv });
  assert.ok(rDef.width(27) > 0.05);

  const dir = mkdtempSync(join(tmpdir(), "ctoy-offstage-lvl-"));
  try {
    writeFileSync(join(dir, "film.json"), JSON.stringify({ format: { fps: 30, duration: 4, size: [1920, 1080] }, toy: "toy.json" }));
    writeFileSync(join(dir, "toy.json"), JSON.stringify({ height: 0.12, colors: { body: "#2F61EB" }, joints: {}, parts: [] }));
    const kitUrl = new URL("../skills/creator-toy-intro/engine/lib/beatkit.js", import.meta.url).href;
    const probe = `
      import * as kit from ${JSON.stringify(kitUrl)};
      const glyph = {
        has: () => true,
        adv: () => 0.9,
        geo: (_k, em, depth, bevel) => ({ type: "curve", rings: [[[0, 0], [em * 0.8, 0], [em * 0.8, em * 0.85], [0, em * 0.85]]], depth, bevel }),
      };
      const ban = kit.bannerLine(glyph, "一镜出片", { em: 0.03 });
      const badge = kit.readoutBadge(glyph, { from: 0, to: 9.4, fmt: { decimals: 1, unit: "万" }, label: "查看", em: 0.04 });
      const placed = {};
      // Stage offset at X = 50 m (as in beat 1): level: true must aim from eyeWorld[0] = 50, NOT world X = 0!
      ban.put((n, tr) => { placed[n] = tr; }, "beat1_ban", [49.82, 0.04, 0.14], [50.0, 0.20, 0.88], 1, { level: true });
      badge.put((n, tr) => { placed[n] = tr; }, "beat1_bdg", 9.4, [50.18, 0.05, 0.14], [50.0, 0.20, 0.88], 1, { level: true });
      console.log(JSON.stringify(placed));
    `;
    const sub = spawnSync("node", ["--input-type=module", "-e", probe], { env: { ...process.env, FILM: dir }, encoding: "utf8" });
    assert.equal(sub.status, 0, sub.stderr);
    const placed = JSON.parse(sub.stdout.trim().split(/\r?\n/).pop());
    assert.ok(Math.abs(placed.beat1_ban_plate.q[1]) < 1e-9, `expected zero yaw on beat1_ban_plate, got q=${JSON.stringify(placed.beat1_ban_plate.q)}`);
    assert.ok(Math.abs(placed.beat1_ban_plate.q[2]) < 1e-9);
    assert.ok(Math.abs(placed.beat1_bdg_plate.q[1]) < 1e-9, `expected zero yaw on beat1_bdg_plate, got q=${JSON.stringify(placed.beat1_bdg_plate.q)}`);
    assert.ok(Math.abs(placed.beat1_bdg_plate.q[2]) < 1e-9);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("edgeOnCards flags sideways plaques and showcase cards while clearing desk mats, spins, and 6+ card corridors", () => {
  const plaqueGeo = { type: "roundBox", size: [0.24, 0.045, 0.006], radius: 0.005 };
  const cardGeo = { type: "uiBox", rect: [-200, -120, 400, 240], uvRect: [0, 0, 400, 240], thickness: 0.004, unitScale: 0.6 };
  const sidewaysPlaqueQ = qAxis([0, 1, 0], Math.PI * 0.46); // ~83° sideways
  const sidewaysCardQ = qMul(qAxis([0, 1, 0], Math.PI * 0.45), UPRIGHT); // ~81° sideways
  const wingCardQ = qMul(qAxis([0, 1, 0], -0.45), UPRIGHT); // ~26° wing card (clean)
  const flatDeskMatQ = QID; // uiBox without UPRIGHT lies flat on desk (normal = +Y, skipped)

  const spinTrack = Array.from({ length: 24 }, (_, f) => [f, ...pack([50.25, 0.22, 0], qMul(qAxis([0, 1, 0], f * 0.12), UPRIGHT), [0.6, 0.6, 0.6])]);
  const anim = {
    ...makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([50, 0.20, 1.1]) },
        { name: "beat1_bad_plate", parent: "root", geo: plaqueGeo, mat: { type: "paper" }, tr: pack([49.85, 0.06, 0.10], sidewaysPlaqueQ) },
        { name: "beat1_ok_plate", parent: "root", geo: plaqueGeo, mat: { type: "paper" }, tr: pack([50.15, 0.06, 0.10], QID) },
        { name: "beat1_bad_card", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([49.80, 0.24, 0], sidewaysCardQ, [0.6, 0.6, 0.6]) },
        { name: "beat1_wing_card", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([50.10, 0.24, 0], wingCardQ, [0.6, 0.6, 0.6]) },
        { name: "beat1_desk_mat", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([50.0, 0.01, 0.10], flatDeskMatQ, [0.6, 0.6, 0.6]) },
        { name: "beat1_spin_card", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([50.25, 0.22, 0], sidewaysCardQ, [0.6, 0.6, 0.6]) },
      ],
      { beat1_spin_card: spinTrack },
      { frames: 24 },
    ),
    scalars: { fov: Array(24).fill(30) },
  };
  const hits = edgeOnCards(anim, { aspect: 16 / 9 });
  assert.deepEqual(hits.map((h) => h.name).sort(), ["beat1_bad_card", "beat1_bad_plate"]);
  assert.match(describeEdgeOnCards(hits)[0].text, /edge-on to the camera/);

  // 6+ active cards on one beat (layout.corridor) skip showcase card edge-on warnings
  const corridorObjs = [
    { name: "camera", parent: "root", camera: true, tr: pack([0, 0.2, 1.2]) },
    ...Array.from({ length: 6 }, (_, i) => ({
      name: `beat2_cor_${i}`,
      parent: "root",
      geo: cardGeo,
      mat: { type: "ui" },
      tr: pack([i % 2 ? 0.22 : -0.22, 0.22, -0.1 * i], sidewaysCardQ, [0.6, 0.6, 0.6]),
    })),
  ];
  assert.deepEqual(edgeOnCards({ ...makeAnim(corridorObjs, {}, { frames: 24 }), scalars: { fov: Array(24).fill(30) } }), []);
});

test("propCoversToyBody also catches custom end-card prop towers occluding the toy while skipping built-in snail/plinth", () => {
  const mkEndCard = (propName, towerY) => ({
    ...makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([120.02, 0.30, 1.26]) },
        { name: "hero", parent: "root", tr: pack([119.66, 0.06, 0.07]) },
        { name: "hero_legs", parent: "hero", geo: { type: "box", size: [0.08, 0.08, 0.06] }, tr: pack([0, 0.04, 0]) },
        { name: "hero_torso", parent: "hero", geo: { type: "box", size: [0.09, 0.09, 0.06] }, tr: pack([0, 0.12, 0]) },
        { name: propName, parent: "root", geo: { type: "roundBox", size: [0.11, 0.14, 0.06], radius: 0.004 }, mat: { type: "toy" }, tr: pack([119.67, towerY, 0.22]) },
      ],
      {},
      { frames: 24 },
    ),
    scalars: { fov: Array(24).fill(30) },
  });

  // Custom end-card prop block standing in front of toy on CTA stage -> caught!
  const hits = propCoversToyBody(mkEndCard("studiokit_towerL", 0.13), { aspect: 16 / 9 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].card, "studiokit");

  // Built-in snail/plinth names are never flagged
  assert.deepEqual(propCoversToyBody(mkEndCard("snail_body", 0.13), { aspect: 16 / 9 }), []);
  assert.deepEqual(propCoversToyBody(mkEndCard("plinth_body", 0.13), { aspect: 16 / 9 }), []);
});

test("isRemoteBlenderWrapper skips colab-blender in BLENDER env for local steps and retrySearchPrompt strengthens retries", () => {
  assert.equal(isRemoteBlenderWrapper("/Users/alice/.local/bin/colab-blender"), true);
  assert.equal(isRemoteBlenderWrapper("/Applications/Blender.app/Contents/MacOS/Blender"), false);

  const prevBlender = process.env.BLENDER;
  const prevLocal = process.env.COLAB_LOCAL;
  const prevAll = process.env.COLAB_ALL;
  try {
    process.env.BLENDER = "/Users/alice/.local/bin/colab-blender";
    delete process.env.COLAB_LOCAL;
    delete process.env.COLAB_ALL;
    assert.equal(blenderCandidates({ local: false })[0], "/Users/alice/.local/bin/colab-blender");
    assert.ok(!blenderCandidates({ local: true }).some((p) => p.includes("colab-blender")));
  } finally {
    if (prevBlender === undefined) delete process.env.BLENDER; else process.env.BLENDER = prevBlender;
    if (prevLocal === undefined) delete process.env.COLAB_LOCAL; else process.env.COLAB_LOCAL = prevLocal;
    if (prevAll === undefined) delete process.env.COLAB_ALL; else process.env.COLAB_ALL = prevAll;
  }

  assert.equal(retrySearchPrompt("find @alice", 0), "find @alice");
  assert.match(retrySearchPrompt("find @alice", 1), /IMPORTANT \(retry 1\): Call X search tools/);
});

test("v0.8.14: shimmer-free bannerLine/readoutBadge defaults, skyPoint/raiseArms, antiglare picture(), and off-stage aim.world guard", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ctoy-v0814-"));
  try {
    writeFileSync(join(dir, "film.json"), JSON.stringify({ format: { fps: 30, duration: 4, size: [1920, 1080] }, toy: "toy.json" }));
    writeFileSync(join(dir, "toy.json"), JSON.stringify({
      height: 0.12,
      center: [0, 0.05, 0],
      colors: { body: "#F4B626" },
      joints: {
        body: { p: [0, 0.03, 0], parent: null },
        head: { p: [0, 0.06, 0], parent: "body" },
        armR: { p: [-0.015, 0.052, 0], parent: "body" },
        armL: { p: [0.015, 0.052, 0], parent: "body" },
      },
      parts: [
        { name: "head", group: "head", shape: "ellipsoid", pos: [0, 0.085, 0], r: [0.032, 0.034, 0.03] },
        { name: "armR", group: "armR", shape: "roundBox", pos: [-0.018, 0.036, 0], size: [0.009, 0.026, 0.009], radius: 0.003 },
        { name: "armL", group: "armL", shape: "roundBox", pos: [0.018, 0.036, 0], size: [0.009, 0.026, 0.009], radius: 0.003 },
      ],
    }));
    // Minimal valid 2x2 PNG header + IDAT + IEND
    const png1x1 = Buffer.from(
      "89504e470d0a1a0a0000000d494844520000000400000002080200000090fd61250000000c49444154789c63f8ffff3f0005fe02fea73581840000000049454e44ae426082",
      "hex",
    );
    writeFileSync(join(dir, "shot.png"), png1x1);
    const kitUrl = new URL("../skills/creator-toy-intro/engine/lib/beatkit.js", import.meta.url).href;
    const probe = `
      import * as kit from ${JSON.stringify(kitUrl)};
      const glyph = {
        has: () => true,
        adv: () => 0.92,
        geo: (_k, em, depth, bevel) => ({ type: "curve", rings: [[[0, 0], [em * 0.8, 0], [em * 0.8, em * 0.85], [0, em * 0.85]]], depth, bevel }),
      };
      const ban = kit.bannerLine(glyph, "手搓实战库", { em: 0.032 });
      const badge = kit.readoutBadge(glyph, { from: 18, to: 132, fmt: "万", label: "阅读", em: 0.036 });
      const declared = [];
      ban.declare((o) => declared.push(o), "beat1_ban", { plateColor: "#FAF4E6", color: "#18120B", outline: "#12071A" });
      badge.declare((o) => declared.push(o), "beat1_bdg", { plateColor: "#F4B626", numColor: "#18120B", labelColor: "#18120B", outline: "#18120B" });

      // Default put() without { level: true } still locks zero yaw across orbiting camera azimuths!
      const pA = {}, pB = {};
      ban.put((n, tr) => { pA[n] = tr; }, "beat1_ban", [50.14, 0.03, 0.12], [49.96, 0.18, 0.88], 1);
      ban.put((n, tr) => { pB[n] = tr; }, "beat1_ban", [50.14, 0.03, 0.12], [50.04, 0.18, 0.88], 1);
      badge.put((n, tr) => { pA[n] = tr; }, "beat1_bdg", 132, [49.86, 0.03, 0.12], [49.96, 0.18, 0.88], 1);

      const picDefault = kit.picture("shot.png", 0.28);
      const picAnti = kit.picture("shot.png", 0.28, { antiglare: true });

      const spot = [50.02, 0.04, -0.02];
      const oSky = kit.skyPoint(kit.stand(spot), 1.0, 0.2, 1.8, "R");
      const skyBuilt = kit.toyFrom(oSky, spot);
      const oRaise = kit.raiseArms(kit.stand(spot), 1.0, 0.2, 1.8);
      const raiseBuilt = kit.toyFrom(oRaise, spot);

      let doubleAtErr = "";
      try {
        const bad = kit.stand(spot);
        bad.aimR = { world: [spot[0] + 50, 0.2, 0], k: 1, len: 1.2 };
        kit.toyFrom(bad, spot);
      } catch (e) {
        doubleAtErr = e.message;
      }

      let missingAtErr = "";
      try {
        const bad2 = kit.stand(spot);
        bad2.aimL = { world: [0.1, 0.2, 0], k: 1, len: 1.2 };
        kit.toyFrom(bad2, spot);
      } catch (e) {
        missingAtErr = e.message;
      }

      console.log(JSON.stringify({
        declared,
        pA,
        pB,
        picDefaultMat: picDefault.mat,
        picAntiMat: picAnti.mat,
        skyAim: oSky.aimR,
        raiseAimR: oRaise.aimR,
        raiseAimL: oRaise.aimL,
        skyParts: skyBuilt.parts.length,
        raiseParts: raiseBuilt.parts.length,
        doubleAtErr,
        missingAtErr,
      }));
    `;
    const sub = spawnSync("node", ["--input-type=module", "-e", probe], { env: { ...process.env, FILM: dir }, encoding: "utf8" });
    assert.equal(sub.status, 0, sub.stderr);
    const res = JSON.parse(sub.stdout.trim().split(/\r?\n/).pop());

    // 1) Zero outline grown_plate meshes emitted by default on plated banners & badges
    assert.ok(!res.declared.some((o) => o.mat?.outline), "expected zero outline meshes on plated bannerLine/readoutBadge");
    const banPlate = res.declared.find((o) => o.name === "beat1_ban_plate");
    const bdgPlate = res.declared.find((o) => o.name === "beat1_bdg_plate");
    assert.equal(banPlate.mat.type, "paper");
    assert.equal(bdgPlate.mat.type, "paper");
    const banLetter = res.declared.find((o) => o.name === "beat1_ban_ln_0");
    assert.equal(banLetter.mat.on, "#FAF4E6");
    assert.equal(banLetter.mat.coat, 0.12);

    // 2) Default level=true locks zero yaw across camera azimuth drift (zero horizontal stroke crawl!)
    assert.ok(Math.abs(res.pA.beat1_ban_plate.q[1]) < 1e-9);
    assert.ok(Math.abs(res.pB.beat1_ban_plate.q[1]) < 1e-9);
    assert.deepEqual(res.pA.beat1_ban_plate.q, res.pB.beat1_ban_plate.q);

    // 3) antiglare picture() damps white blowout while keeping default picture() untouched
    assert.equal(res.picDefaultMat.emission, undefined);
    assert.equal(res.picAntiMat.emission, 0.78);
    assert.equal(res.picAntiMat.coat, 0.06);
    assert.equal(res.picAntiMat.sampled, false);

    // 4) skyPoint & raiseArms clear wide chibi heads directly in world space, and rig catches double/missing at()
    assert.ok(res.skyAim.world[0] < 50.02 - 0.11 && res.skyAim.world[1] > 0.19);
    assert.ok(res.raiseAimR.world[0] < 50.02 - 0.11 && res.raiseAimL.world[0] > 50.02 + 0.11);
    assert.equal(res.skyParts, 3);
    assert.equal(res.raiseParts, 3);
    assert.match(res.doubleAtErr, /called at\(\.\.\.\) a second time/);
    assert.match(res.missingAtErr, /missing at\(\.\.\.\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v0.8.15: plate/arc/card2d bounds, fast face-flyover occlusions, pedestalSideClashes, eyePoint unwrap, and text-only X posts", () => {
  // 1) plate without outline uses [w, t, d] instead of an inflated cube
  const { lo, hi } = restBounds([{ name: "tray", shape: "plate", w: 0.20, d: 0.08, t: 0.006 }], [{ p: [0, 0, 0], q: QID, s: [1, 1, 1] }]);
  assert.ok(Math.abs((hi[1] - lo[1]) - 0.006) < 1e-6);
  assert.ok(Math.abs((hi[0] - lo[0]) - 0.20) < 1e-6);
  assert.ok(Math.abs((hi[2] - lo[2]) - 0.08) < 1e-6);

  // 2) Fast 4-frame (0.133 s) paper-plane `plate` crossing in front of hero_head triggers heroFaceOcclusions,
  //    while background `beat0_banner_win` does not trigger false occlusions.
  const faceAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([0, 0.16, 0.85]) },
      { name: "hero", parent: "root", tr: pack([0, 0, 0]) },
      { name: "hero_head", parent: "hero", geo: { type: "ellipsoid", r: [0.04, 0.04, 0.04] }, tr: pack([0, 0.12, 0]) },
      {
        name: "beat0_plane_wing",
        parent: "root",
        geo: { type: "plate", t: 0.004, outline: [[-0.08, -0.04], [0.08, 0], [-0.08, 0.04]] },
        mat: { type: "paper", color: "#F7A8C4" },
        tr: pack([0, 0.12, 0.08], qEuler(0.65, 0, 0)),
      },
      {
        name: "beat0_banner_win",
        parent: "root",
        geo: { type: "plane", w: 0.50, h: 0.28 },
        mat: { type: "card2d", image: "assets/banner.jpg" },
        tr: pack([0, 0.22, -0.15]),
      },
    ],
    {
      camera: [[0, ...pack([0, 0.16, 0.85])], [20, ...pack([0, 0.16, 0.85])]],
      beat0_plane_wing: [
        [0, ...pack([-0.35, 0.12, 0.08], qEuler(0.65, 0, 0))],
        [4, ...pack([-0.02, 0.12, 0.08], qEuler(0.65, 0, 0))],
        [8, ...pack([0.02, 0.12, 0.08], qEuler(0.65, 0, 0))],
        [9, ...pack([0.35, 0.12, 0.08], qEuler(0.65, 0, 0))],
        [20, ...pack([0.35, 0.12, 0.08], qEuler(0.65, 0, 0))],
      ],
    },
    { frames: 21, fps: 30, sub: 1 },
  );
  faceAnim.scalars = { fov: Array(21).fill(35) };
  const faceHits = heroFaceOcclusions(faceAnim, { aspect: 16 / 9 });
  assert.equal(faceHits.length, 1);
  assert.equal(faceHits[0].prop, "beat0_plane");
  assert.match(describeHeroFaceOcclusions(faceHits)[0].text, /crosses in front of the toy's face/);

  // 3) pedestalSideClashes catches side-standing sub-props (`pod_globe_*`) biting into `pod_base` while ignoring
  //    coaxial upper tiers (`pod_deck`) and clean side placement.
  const pedAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([250, 0.18, 1.0]) },
      { name: "pod_base", parent: "root", geo: { type: "plate", t: 0.048, outline: [[-0.145, -0.145], [0.145, -0.145], [0.145, 0.145], [-0.145, 0.145]] }, mat: { type: "paper", color: "#FAF0E2" }, tr: pack([249.75, 0.024, 0.04]) },
      { name: "pod_deck", parent: "root", geo: { type: "plate", t: 0.026, outline: [[-0.11, -0.11], [0.11, -0.11], [0.11, 0.11], [-0.11, 0.11]] }, mat: { type: "type", color: "#E25241" }, tr: pack([249.75, 0.06, 0.04]) },
      { name: "pod_globe_foot", parent: "root", geo: { type: "plate", t: 0.010, outline: [[-0.04, -0.04], [0.04, -0.04], [0.04, 0.04], [-0.04, 0.04]] }, mat: { type: "paper", color: "#F5E5CF" }, tr: pack([249.59, 0.005, 0.04]) },
      { name: "pod_globe_ocean", parent: "root", geo: { type: "ellipsoid", r: [0.052, 0.052, 0.052] }, mat: { type: "type", color: "#5BBCE0" }, tr: pack([249.59, 0.08, 0.04]) },
    ],
    {
      camera: [[0, ...pack([250, 0.18, 1.0])], [29, ...pack([250, 0.18, 1.0])]],
      pod_globe_foot: [[0, ...pack([249.59, 0.005, 0.04])], [14, ...pack([249.59, 0.005, 0.04])], [15, ...pack([249.52, 0.005, 0.04])], [29, ...pack([249.52, 0.005, 0.04])]],
      pod_globe_ocean: [[0, ...pack([249.59, 0.08, 0.04])], [14, ...pack([249.59, 0.08, 0.04])], [15, ...pack([249.52, 0.08, 0.04])], [29, ...pack([249.52, 0.08, 0.04])]],
    },
    { frames: 30, fps: 30, sub: 1 },
  );
  const pedHits = pedestalSideClashes(pedAnim);
  assert.equal(pedHits.length, 1);
  assert.equal(pedHits[0].sat, "pod_globe");
  assert.equal(pedHits[0].base, "pod_base");
  assert.ok(pedHits[0].to < 0.6);
  assert.match(describePedestalSideClashes(pedHits)[0].text, /pod_globe overlaps pedestal pod_base/);

  // 4) eyePoint unwraps bare vectors, camera samples ({ pos }), and legacy ({ tr: { p } }) uniformly
  assert.deepEqual(eyePoint([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(eyePoint({ pos: [4, 5, 6] }), [4, 5, 6]);
  assert.deepEqual(eyePoint({ tr: { p: [7, 8, 9] } }), [7, 8, 9]);
  assert.throws(() => facing(undefined, [0, 0, 0]), /camera eye position must be/i);

  // 5) Text-only pinned/featured X posts (no cover path, or pinned=null) render cleanly in both desktop & mobile themes
  const textFilm = {
    language: "zh-Hans",
    profile: { name: "夏林果", handle: "momo_peggy", banner: "assets/banner.jpg", avatar: "assets/avatar.jpg", bio: ["Web出海"], following: "100", followers: "7,820", postsCount: "100" },
    branding: { logo: "", badge: "" },
  };
  const asset = (p) => `'assets/${p}'`;
  assert.equal(xDesktop.pictureCover(asset, undefined), "");
  assert.equal(xMobile.pictureCover(asset, ""), "");
  const textPinned = { post: { date: "9月29日", title: "纯文字置顶帖测试", counts: ["1", "2", "3", "4"] }, cover: "" };
  const htmlD = xDesktop.profilePage({ film: textFilm, L: xDesktopLayout, asset, pinned: textPinned });
  const htmlM = xMobile.profilePage({ film: textFilm, L: xMobileLayout, asset, pinned: textPinned });
  assert.match(htmlD, /class="txt"[^>]*>纯文字置顶帖测试/);
  assert.match(htmlM, /class="txt"[^>]*>纯文字置顶帖测试/);
  assert.ok(xDesktop.profilePage({ film: textFilm, L: xDesktopLayout, asset, pinned: null }).includes("<!doctype html>"));
  assert.ok(xMobile.profilePage({ film: textFilm, L: xMobileLayout, asset, pinned: null }).includes("<!doctype html>"));
});

test("v0.8.16: cardBezelMismatches, frameSlicesCard, sparksOverHeroFace, framedPicture, and anti-glare light plates", () => {
  // 1) cardBezelMismatches catches 9:16 portrait (0.124 x 0.220 m) protruding past 0.136 x 0.170 m bezel AND poking below y=0
  const sPort = 0.124 / 0.676;
  const badBezelAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([50, 0.11, 0.62]) },
      { name: "beat1_p_frame", parent: "root", geo: { type: "roundBox", size: [0.136, 0.170, 0.005], radius: 0.004 }, mat: { type: "type", color: "#586E94" }, tr: pack([49.964, 0.100, -0.053]) },
      { name: "beat1_p_port", parent: "root", geo: { type: "uiBox", rect: [-338, -600, 676, 1200], thickness: 0.002 / sPort, unitScale: +sPort.toFixed(6) }, mat: { type: "ui", image: "assets/p.jpg" }, tr: pack([49.964, 0.100, -0.048], UPRIGHT, [sPort, sPort, sPort]) },
    ],
    { camera: [[0, ...pack([50, 0.11, 0.62])], [29, ...pack([50, 0.11, 0.62])]] },
    { frames: 30, fps: 30, sub: 1 },
  );
  badBezelAnim.scalars = { fov: Array(30).fill(32) };
  const bzHits = cardBezelMismatches(badBezelAnim, { aspect: 16 / 9 });
  assert.equal(bzHits.length, 2);
  assert.ok(bzHits.some((h) => h.kind === "bezel" && h.card === "beat1_p_port" && h.bezel === "beat1_p_frame" && h.over > 0.02));
  assert.ok(bzHits.some((h) => h.kind === "floor" && h.card === "beat1_p_port" && h.over > 0.008));
  assert.match(describeCardBezelMismatches(bzHits)[0].text, /protrudes|pokes/);

  // Properly sized 4-sided bezel seated above stageY reports 0 mismatches
  const sGood = 0.106 / 0.676;
  const goodBezelAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([50, 0.11, 0.62]) },
      { name: "beat1_p_frame", parent: "root", geo: { type: "roundBox", size: [0.118, 0.200, 0.006], radius: 0.005 }, mat: { type: "type", color: "#586E94" }, tr: pack([49.968, 0.120, -0.052]) },
      { name: "beat1_p_port", parent: "root", geo: { type: "uiBox", rect: [-338, -600, 676, 1200], thickness: 0.002 / sGood, unitScale: +sGood.toFixed(6) }, mat: { type: "ui", image: "assets/p.jpg" }, tr: pack([49.968, 0.120, -0.047], UPRIGHT, [sGood, sGood, sGood]) },
    ],
    { camera: [[0, ...pack([50, 0.11, 0.62])], [29, ...pack([50, 0.11, 0.62])]] },
    { frames: 30, fps: 30, sub: 1 },
  );
  goodBezelAnim.scalars = { fov: Array(30).fill(32) };
  assert.equal(cardBezelMismatches(goodBezelAnim, { aspect: 16 / 9 }).length, 0);

  // 2) frameSlicesCard catches a hollow viewfinder top bar slicing across desk_art while ignoring clean bottom scrubbers
  const sArt = 0.165 / 1.636;
  const sliceAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([250, 0.12, 0.70]) },
      { name: "desk_art", parent: "root", geo: { type: "uiBox", rect: [-818, -318, 1636, 636], thickness: 0.002 / sArt, unitScale: +sArt.toFixed(6) }, mat: { type: "ui", image: "assets/b.png" }, tr: pack([249.83, 0.186, -0.086], UPRIGHT, [sArt, sArt, sArt]) },
      { name: "cta_vf_top", parent: "root", geo: { type: "roundBox", size: [0.118, 0.006, 0.006], radius: 0.002 }, mat: { type: "type", color: "#F5A623" }, tr: pack([249.81, 0.179, -0.028]) },
      { name: "desk_scrub", parent: "root", geo: { type: "roundBox", size: [0.15, 0.005, 0.005], radius: 0.002 }, mat: { type: "glow", color: "#F5A623" }, tr: pack([249.83, 0.155, -0.078]) },
    ],
    { camera: [[0, ...pack([250, 0.12, 0.70])], [29, ...pack([250, 0.12, 0.70])]] },
    { frames: 30, fps: 30, sub: 1 },
  );
  sliceAnim.scalars = { fov: Array(30).fill(32) };
  const sliceHits = frameSlicesCard(sliceAnim, { aspect: 16 / 9 });
  assert.equal(sliceHits.length, 1);
  assert.equal(sliceHits[0].part, "cta_vf_top");
  assert.equal(sliceHits[0].card, "desk_art");
  assert.match(describeFrameSlicesCard(sliceHits)[0].text, /slices across picture card desk_art/);

  // 3) sparksOverHeroFace catches front spark streaks over hero_head eyes while ignoring sparks behind the head (vz < 0)
  const makeSparkAnim = (sparkZ) => {
    const a = makeAnim(
      [
        { name: "camera", parent: "root", tr: pack([250, 0.11, 0.68]) },
        { name: "hero", parent: "root", tr: pack([249.88, 0.045, 0.026]) },
        { name: "hero_head", parent: "hero", geo: { type: "ellipsoid", r: [0.038, 0.036, 0.036] }, tr: pack([0, 0.068, 0]) },
        { name: "spark_0", parent: "root", geo: { type: "plane", w: 0.01, h: 0.01 }, mat: { type: "flake" }, tr: pack([249.88, 0.113, sparkZ]) },
      ],
      {
        camera: [[0, ...pack([250, 0.11, 0.68])], [10, ...pack([250, 0.11, 0.68])]],
        spark_0: [[0, ...pack([249.88, 0.116, sparkZ])], [4, ...pack([249.88, 0.110, sparkZ])], [5, ...pack([249.88, 0.110, sparkZ], QID, [1e-4, 1e-4, 1e-4])], [10, ...pack([249.88, 0.110, sparkZ], QID, [1e-4, 1e-4, 1e-4])]],
      },
      { frames: 11, fps: 30, sub: 1 },
    );
    a.scalars = { fov: Array(11).fill(32) };
    return a;
  };
  const frontSparks = sparksOverHeroFace(makeSparkAnim(0.10), { aspect: 16 / 9 });
  assert.equal(frontSparks.length, 1);
  assert.equal(frontSparks[0].spark, "spark_0");
  assert.match(describeSparksOverHeroFace(frontSparks)[0].text, /streaks across the toy's face\/eyes/);
  assert.equal(sparksOverHeroFace(makeSparkAnim(-0.16), { aspect: 16 / 9 }).length, 0);

  // 4) Subprocess check for framedPicture() + anti-glare light-plate clamping in beatkit.js
  const tmp = mkdtempSync(join(tmpdir(), "fpic-"));
  try {
    writeFileSync(join(tmp, "film.json"), JSON.stringify({ id: "t", toy: "toy.json", format: { fps: 30, duration: 4, size: [1920, 1080] } }));
    writeFileSync(join(tmp, "toy.json"), JSON.stringify({ height: 0.1, center: [0, 0.05, 0], colors: {}, joints: { body: { p: [0, 0.03, 0] } }, parts: [] }));
    // Minimal valid 24-byte PNG header reporting 676x1200
    const pngHdr = Buffer.alloc(32);
    pngHdr.writeUInt32BE(0x89504e47, 0);
    pngHdr.writeUInt32BE(0x0d0a1a0a, 4);
    pngHdr.writeUInt32BE(13, 8);
    pngHdr.write("IHDR", 12);
    pngHdr.writeUInt32BE(676, 16);
    pngHdr.writeUInt32BE(1200, 20);
    writeFileSync(join(tmp, "p.png"), pngHdr);
    const probe = spawnSync(
      process.execPath,
      [
        "-e",
        `import(${JSON.stringify(join(root, "skills/creator-toy-intro/engine/lib/beatkit.js"))}).then((kit) => {
          const fp = kit.framedPicture("p.png", 0.106, { border: 0.006 });
          const stubGlyph = { adv: () => 0.6, has: () => true, geo: () => ({ type: "curve", rings: [[[0,0],[1,0],[1,1]]], depth: 0.004, bevel: 0 }) };
          const added = [];
          const bv = kit.readoutBadge(stubGlyph, { from: 0, to: 23.1, fmt: (v) => v.toFixed(1), label: "查看" });
          bv.declare((o) => added.push(o), "bv", { plateColor: "#F5EFE6", numColor: "#111827", labelColor: "#111827" });
          const darkBan = kit.bannerLine(stubGlyph, "测试");
          darkBan.declare((o) => added.push(o), "db", { plateColor: "#241232", color: "#FFFFFF" });
          console.log(JSON.stringify({
            frameSize: fp.frameSize,
            standY: fp.standY(0.014),
            bvPlate: added.find((o) => o.name === "bv_plate").mat.color,
            dbPlate: added.find((o) => o.name === "db_plate").mat.color,
          }));
        });`,
      ],
      { env: { ...process.env, FILM: tmp }, encoding: "utf8" },
    );
    assert.equal(probe.status, 0, probe.stderr);
    const res = JSON.parse(probe.stdout.trim());
    assert.ok(Math.abs(res.frameSize[0] - 0.118) < 1e-6);
    assert.ok(Math.abs(res.frameSize[1] - (0.106 * 1200 / 676 + 0.012)) < 1e-5);
    assert.ok(res.standY - res.frameSize[1] / 2 >= 0.0169);
    // #F5EFE6 (max channel 245) clamped to max channel 234 (#EAE4DB) when paired with dark ink; dark #241232 untouched
    const maxCh = Math.max(...[1, 3, 5].map((i) => parseInt(res.bvPlate.slice(i, i + 2), 16)));
    assert.equal(maxCh, 234);
    assert.equal(res.dbPlate, "#241232");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("v0.8.17: prism pedestal 3D clearance, readoutBadge fastReveal immunity, cutout/badge overlaps, plaqueInControlsZone, and preCutHeroGap", () => {
  // 1) fastReveal ignores rolling counter digit pools (`step: true`) while still catching fast typed words
  const glyphSq = { type: "curve", rings: [[[0, 0], [0.03, 0], [0.03, 0.05], [0, 0.05]]], depth: 0.004 };
  const counterObjs = Array.from({ length: 10 }, (_, d) => ({
    name: `beat1_cnt_d0_${d}`,
    letter: String(d),
    step: true,
    anim: true,
    geo: glyphSq,
    tr: pack([0, -2, 0], QID, [1e-4, 1e-4, 1e-4]),
  }));
  const counterTracks = Object.fromEntries(counterObjs.map((o, d) => [
    o.name,
    [
      [0, ...pack([0, -2, 0], QID, [1e-4, 1e-4, 1e-4])],
      [d + 1, ...pack([0, 0.2, 0], QID, [1, 1, 1])],
      [25, ...pack([0, 0.2, 0], QID, [1, 1, 1])],
    ],
  ]));
  assert.deepEqual(fastReveal({ fps: 30, frames: 26, sub: 1, objects: counterObjs, tracks: counterTracks }), []);

  // 2) prism solid catches upright un-flattened cylinder swallowing hero legs, while clearing qFlat horizontal cylinder
  const QFLAT = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  const makePlinthAnim = (plinthQ, plinthY, heroY) => makeAnim(
    [
      { name: "hero", parent: "root", tr: pack([0, heroY, 0]) },
      { name: "hero_legL", parent: "hero", geo: { type: "roundBox", size: [0.018, 0.04, 0.018] }, tr: pack([-0.012, 0.02, 0]) },
      { name: "hero_torso", parent: "hero", geo: { type: "roundBox", size: [0.042, 0.045, 0.028] }, tr: pack([0, 0.058, 0]) },
      { name: "hero_head", parent: "hero", geo: { type: "ellipsoid", r: [0.036, 0.034, 0.034] }, tr: pack([0, 0.095, 0]) },
      { name: "plinth_base", parent: "root", geo: { type: "prism", sides: 36, r: 0.085, depth: 0.048, bevel: 0.004 }, tr: pack([0, plinthY, 0], plinthQ) },
    ],
    { hero: [[0, ...pack([0, heroY, 0])], [20, ...pack([0, heroY, 0])]] },
    { frames: 21, fps: 30, sub: 1 },
  );
  const badPlinth = clearance(makePlinthAnim(QID, 0.024, 0.048));
  assert.ok(describe(badPlinth.contacts, badPlinth.height).some((m) => m.kind === "into" && m.solids.includes("plinth_base")));
  const goodPlinth = clearance(makePlinthAnim(QFLAT, 0.024, 0.054));
  assert.equal(describe(goodPlinth.contacts, goodPlinth.height).filter((m) => m.kind === "into").length, 0);

  // 3) cardScreenOverlaps catches RGBA cutout tucked ~35% behind monitor corner AND readoutBadge plate covering a card
  const cardGeo = { type: "uiBox", rect: [-150, -85, 300, 170], uvRect: [0, 0, 300, 170], thickness: 0.004 };
  const moonAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([0, 0.14, 0.85]) },
      { name: "beat2_webgl_card", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([-0.14, 0.15, -0.10], UPRIGHT, [1, 1, 1]) },
      { name: "beat2_moon", parent: "root", geo: { type: "plane", w: 0.10, h: 0.10 }, mat: { type: "sticker", image: "assets/moon.png" }, tr: pack([-0.01, 0.21, -0.13]) },
      { name: "beat2_cnt_plate", parent: "root", geo: { type: "roundBox", size: [0.16, 0.055, 0.006] }, mat: { type: "paper", color: "#F4D58D" }, tr: pack([-0.22, 0.21, 0.02]) },
    ],
    { camera: [[0, ...pack([0, 0.14, 0.85])], [24, ...pack([0, 0.14, 0.85])]] },
    { frames: 25, fps: 30, sub: 1 },
  );
  moonAnim.scalars = { fov: Array(25).fill(32) };
  const ovHits = cardScreenOverlaps(moonAnim, { aspect: 16 / 9 });
  assert.equal(ovHits.length, 2);
  assert.ok(ovHits.some((h) => h.front === "beat2_webgl_card" && h.back === "beat2_moon" && h.share >= 0.25));
  assert.ok(ovHits.some((h) => h.front === "beat2_cnt_plate" && h.back === "beat2_webgl_card" && h.share >= 0.25));

  // 4) plaqueInControlsZone catches a settled foreground plaque dipping into the bottom scrub-bar zone (ny < -0.86)
  const makeCtrlAnim = (plateY, plateZ) => {
    const a = makeAnim(
      [
        { name: "camera", parent: "root", tr: pack([0, 0.10, 0.68]) },
        { name: "beat1_trn_plate", parent: "root", geo: { type: "roundBox", size: [0.34, 0.038, 0.006] }, mat: { type: "paper", color: "#1D2638" }, tr: pack([0, plateY, plateZ]) },
      ],
      { camera: [[0, ...pack([0, 0.10, 0.68])], [24, ...pack([0, 0.10, 0.68])]] },
      { frames: 25, fps: 30, sub: 1 },
    );
    a.scalars = { fov: Array(25).fill(38) };
    return a;
  };
  const dipHits = plaqueInControlsZone(makeCtrlAnim(-0.026, 0.24), { aspect: 16 / 9 });
  assert.equal(dipHits.length, 1);
  assert.equal(dipHits[0].target, "beat1_trn_plate");
  assert.match(describePlaqueInControlsZone(dipHits)[0].text, /dips into the platform player controls zone/);
  assert.equal(plaqueInControlsZone(makeCtrlAnim(0.032, 0.18), { aspect: 16 / 9 }).length, 0);

  // 5) preCutHeroGap flags a 0.50 s premature hero disappearance before a stage cut while passing a crisp 0.23 s exit
  const makeCutAnim = (hideFromFrame) => {
    const heroTrack = [];
    const camTrack = [];
    for (let f = 0; f < 40; f++) {
      const onCta = f >= 30;
      camTrack.push([f, ...pack([onCta ? 250 : 100, 0.10, 0.70])]);
      const hidden = !onCta && f >= hideFromFrame;
      heroTrack.push([f, ...pack([onCta ? 250 : 100, 0, 0], QID, hidden ? [1e-4, 1e-4, 1e-4] : [1, 1, 1])]);
    }
    const a = makeAnim(
      [
        { name: "camera", parent: "root", tr: pack([100, 0.10, 0.70]) },
        { name: "hero", parent: "root", tr: pack([100, 0, 0]) },
        { name: "hero_head", parent: "hero", geo: { type: "ellipsoid", r: [0.035, 0.035, 0.035] }, tr: pack([0, 0.08, 0]) },
      ],
      { camera: camTrack, hero: heroTrack },
      { frames: 40, fps: 30, sub: 1 },
    );
    a.scalars = { fov: Array(40).fill(35) };
    return a;
  };
  const gapHits = preCutHeroGap(makeCutAnim(14), { aspect: 16 / 9 });
  assert.equal(gapHits.length, 1);
  assert.equal(gapHits[0].cutAt, 1.0);
  assert.ok(gapHits[0].gap >= 0.50);
  assert.match(describePreCutHeroGap(gapHits)[0].text, /leaves the frame .* early before the 1\.00 s cut/);
  assert.equal(preCutHeroGap(makeCutAnim(23), { aspect: 16 / 9 }).length, 0);
});

test("v0.8.18: propBlocksCard foreground mug-handle plaque occlusion and floatingCtaBase plinth levitation guard", () => {
  const QFLAT = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  // 1) propBlocksCard catches a foreground cylindrical mug + handle covering the left ~10% of a wide stat plaque,
  //    ignores the plaque's own backing frame, and clears once the mug moves left of the plaque
  const widePlaqueGeo = { type: "uiBox", rect: [-114, -16, 228, 32], uvRect: [0, 0, 960, 128], thickness: 0.004, unitScale: 1 };
  const makeMugPlaqueAnim = (mugX, mugZ, plaqueX) => {
    const a = makeAnim(
      [
        { name: "camera", parent: "root", tr: pack([100, 0.12, 0.62]) },
        { name: "beat2_sgh_frame", parent: "root", geo: { type: "roundBox", size: [0.235, 0.039, 0.005] }, tr: pack([100 + plaqueX, 0.038, 0.040]) },
        { name: "beat2_sgh_pic", parent: "root", geo: widePlaqueGeo, mat: { type: "ui", image: "build/cards/stat.png" }, tr: pack([100 + plaqueX, 0.038, 0.042], UPRIGHT, [1, 1, 1]) },
        { name: "beat2_dprop_mug", parent: "root", geo: { type: "prism", sides: 32, r: 0.018, depth: 0.038, bevel: 0.003 }, tr: pack([100 + mugX, 0.037, mugZ], QFLAT) },
        { name: "beat2_dprop_mhandle", parent: "root", geo: { type: "arc", radius: 0.011, tube: 0.0032, arc: Math.PI }, tr: pack([100 + mugX + 0.016, 0.037, mugZ]) },
      ],
      { camera: [[0, ...pack([100, 0.12, 0.62])], [24, ...pack([100, 0.12, 0.62])]] },
      { frames: 25, fps: 30, sub: 1 },
    );
    a.scalars = { fov: Array(25).fill(38) };
    return a;
  };
  const blocked = propBlocksCard(makeMugPlaqueAnim(0.008, 0.065, 0.118), { aspect: 16 / 9 });
  assert.equal(blocked.length, 1);
  assert.equal(blocked[0].prop, "beat2_dprop");
  assert.equal(blocked[0].card, "beat2_sgh_pic");
  assert.equal(blocked[0].wide, true);
  assert.match(describePropBlocksCard(blocked)[0].text, /foreground prop beat2_dprop blocks \d+% of plaque beat2_sgh_pic/);
  assert.equal(propBlocksCard(makeMugPlaqueAnim(-0.025, 0.012, 0.146), { aspect: 16 / 9 }).length, 0);

  // 2) floatingCtaBase catches a grounded CTA plinth base lifting 22 mm mid-hold, while passing a planted plinth
  const makeCtaHopAnim = (liftBase) => {
    const tierTrack = [];
    for (let f = 0; f < 90; f++) {
      const t = f / 30;
      let y = 0.016;
      if (t < 0.25) y = 0.016 + 0.35 * (1 - t / 0.25); // initial drop-in spin
      else if (liftBase && t >= 2.0 && t <= 2.5) y = 0.016 + 0.022 * Math.sin(((t - 2.0) / 0.5) * Math.PI);
      tierTrack.push([f, ...pack([249.87, y, 0.068])]);
    }
    return makeAnim(
      [
        { name: "cta_floor", parent: "root", geo: { type: "plane", w: 12, h: 12 }, tr: pack([250, 0, 0]) },
        { name: "prop_tier0", parent: "root", geo: { type: "roundBox", size: [0.216, 0.032, 0.146], radius: 0.012 }, tr: pack([249.87, 0.016, 0.068]) },
      ],
      { prop_tier0: tierTrack },
      { frames: 90, fps: 30, sub: 1 },
    );
  };
  const floatHits = floatingCtaBase(makeCtaHopAnim(true));
  assert.equal(floatHits.length, 1);
  assert.equal(floatHits[0].target, "prop_tier0");
  assert.ok(floatHits[0].lift >= 0.020);
  assert.match(describeFloatingCtaBase(floatHits)[0].text, /grounded end-card prop base prop_tier0 lifts 22 mm off the floor/);
  assert.equal(floatingCtaBase(makeCtaHopAnim(false)).length, 0);
});

test("v0.8.19: sep:true readout formatting, flat-mat & moving-wipe exemptions, ctaPropBlocksLabels, wipePicture, and bilingual CTA name auto-fit", () => {
  // 1) formatCount & resolveReadoutFmt treat boolean sep: true as "," instead of stringifying "true"
  assert.equal(formatCount(84714, { sep: true }), "84,714");
  assert.equal(formatCount(84714, { sep: false }), "84714");
  assert.equal(resolveReadoutFmt({ sep: true, unit: "次" }, 0, 84714)(84714), "84,714次");
  const ro = readout({ fmt: { sep: true }, from: 100, to: 84714, em: 0.05, adv: () => 0.6 });
  assert.ok(ro.names.some((n) => n.c === ","));
  assert.ok(!ro.names.some((n) => /[true]/.test(n.c)));

  // 2) frameSlicesCard & propBlocksCard skip flat floor-lying mats (qId()), and frameSlicesCard skips actively sweeping wipe bars
  const cardGeo = { type: "uiBox", rect: [-160, -100, 320, 200], uvRect: [0, 0, 320, 200], thickness: 0.004, unitScale: 1 };
  const barGeo = { type: "roundBox", size: [0.012, 0.24, 0.012], radius: 0.003 };
  // 2a) Flat floor-lying mat (qId() -> normal along +Y) under a standing bar: zero false slices or blocks
  const flatMatAnim = makeAnim(
    [
      { name: "camera", parent: "root", tr: pack([50, 0.22, 0.85]) },
      { name: "beat1_floor_mat", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([50, 0.002, 0], QID, [1, 1, 1]) },
      { name: "beat1_pillar_bar", parent: "root", geo: barGeo, tr: pack([50, 0.12, 0.05]) },
    ],
    { camera: [[0, ...pack([50, 0.22, 0.85])], [24, ...pack([50, 0.22, 0.85])]] },
    { frames: 25, fps: 30, sub: 1 },
  );
  flatMatAnim.scalars = { fov: Array(25).fill(32) };
  assert.equal(frameSlicesCard(flatMatAnim, { aspect: 16 / 9 }).length, 0);
  assert.equal(propBlocksCard(flatMatAnim, { aspect: 16 / 9 }).length, 0);

  // 2b) Upright poster card with a moving wipe bar sweeping from x = -0.35 to +0.35 in 1.0 s (0.70 m/s) -> exempt;
  //     same bar parked statically at x = 0 in front of the upright card -> flagged!
  const makeWipeAnim = (moving) => {
    const barTrack = [];
    for (let f = 0; f < 30; f++) {
      const x = moving ? -0.35 + (0.70 * f) / 29 : 0.0;
      barTrack.push([f, ...pack([50 + x, 0.16, 0.04])]);
    }
    const a = makeAnim(
      [
        { name: "camera", parent: "root", tr: pack([50, 0.16, 0.85]) },
        { name: "beat1_poster_pic", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([50, 0.16, 0.0], UPRIGHT, [1, 1, 1]) },
        { name: "beat1_wipe_bar", parent: "root", geo: barGeo, tr: pack([50, 0.16, 0.04]) },
      ],
      { camera: [[0, ...pack([50, 0.16, 0.85])], [29, ...pack([50, 0.16, 0.85])]], beat1_wipe_bar: barTrack },
      { frames: 30, fps: 30, sub: 1 },
    );
    a.scalars = { fov: Array(30).fill(32) };
    return a;
  };
  assert.equal(frameSlicesCard(makeWipeAnim(true), { aspect: 16 / 9 }).length, 0);
  assert.equal(frameSlicesCard(makeWipeAnim(false), { aspect: 16 / 9 }).length, 1);

  // 3) ctaPropBlocksLabels catches a misplaced x=0 pedestal/toy covering two-column right-side labels, and clears path[0]=-0.34
  const labelRings = [[[-0.26, -0.04], [0.26, -0.04], [0.26, 0.04], [-0.26, 0.04]]];
  const makeCtaBlockAnim = (propX) => {
    const a = makeAnim(
      [
        { name: "camera", parent: "root", tr: pack([200.02, 0.165, 1.26]) },
        { name: "cta_floor", parent: "root", geo: { type: "plane", w: 12, h: 12 }, tr: pack([200, 0, 0]) },
        { name: "label0_sheet", parent: "root", geo: { type: "curve", rings: labelRings, depth: 0.002 }, tr: pack([200.22, 0.148, -0.055]) },
        { name: "hero", parent: "root", tr: pack([200 + propX, 0.08, 0.05]) },
        { name: "hero_body", parent: "hero", geo: { type: "roundBox", size: [0.08, 0.12, 0.06] }, tr: pack([0, 0.06, 0]) },
        { name: "prop_pedestal", parent: "root", geo: { type: "roundBox", size: [0.18, 0.08, 0.14] }, tr: pack([200 + propX, 0.04, 0.05]) },
      ],
      { camera: [[0, ...pack([200.02, 0.165, 1.26])], [24, ...pack([200.02, 0.165, 1.26])]] },
      { frames: 25, fps: 30, sub: 1 },
    );
    a.scalars = { fov: Array(25).fill(30) };
    return a;
  };
  const ctaBlocked = ctaPropBlocksLabels(makeCtaBlockAnim(0.0), { aspect: 16 / 9 });
  assert.ok(ctaBlocked.length >= 1);
  assert.match(describeCtaPropBlocksLabels(ctaBlocked)[0].text, /covers \d+% of label0 on camera/);
  assert.equal(ctaPropBlocksLabels(makeCtaBlockAnim(-0.34), { aspect: 16 / 9 }).length, 0);

  // 4) wipePicture & isnail-30/anim.js fitHeaderLabel tested in an isolated temp FILM workspace
  const dir = mkdtempSync(join(tmpdir(), "ctoy-v0819-"));
  try {
    mkdirSync(join(dir, "assets"), { recursive: true });
    mkdirSync(join(dir, "build"), { recursive: true });
    // Minimal valid 1x1 PNG header + data
    const png1x1 = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c63f8cfc000000301010018dd8db00000000049454e44ae426082", "hex");
    writeFileSync(join(dir, "assets/before.png"), png1x1);
    writeFileSync(join(dir, "assets/after.png"), png1x1);
    writeFileSync(join(dir, "toy.json"), JSON.stringify({ height: 0.12, center: [0, 0.06, 0], colors: { body: "#2F61EB" }, joints: { body: { p: [0, 0, 0] } }, parts: [] }));
    const chars = [..."0123456789.万阅读楊哥 | Yang Onchain@YangOnchainAI视觉短片蜗牛King"];
    const gStub = { advance: 0.65, rings: [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]] };
    const glyphsObj = {};
    for (const r of ["cjk", "latin", "heavy", "display"]) for (const ch of chars) glyphsObj[`${r}:${ch}`] = { ...gStub, advance: ch.codePointAt(0) >= 0x2e80 ? 1.0 : 0.58 };
    writeFileSync(join(dir, "build/glyphs.json"), JSON.stringify(glyphsObj));
    writeFileSync(join(dir, "film.json"), JSON.stringify({
      id: "bilingual-fit",
      template: "isnail-30",
      theme: "x-desktop",
      format: { fps: 30, bpm: 120, duration: 30, size: [1920, 1080] },
      toy: "toy.json",
      profile: { name: "楊哥 | Yang Onchain", handle: "@YangOnchain", bio: ["AI"] },
      posts: {
        pinned: { date: "2026-03-01", title: "A", counts: { views: "1万" }, cover: "assets/before.png" },
        second: { date: "2026-03-02", title: "B", counts: { views: "1万" }, cover: "assets/after.png" },
      },
      counter: { value: 1, unit: "万", label: "阅读", display: "1万" },
      cta: {
        layout: "two-column",
        slogan: [{ text: "AI视觉", paper: "cream" }, { text: "短片", paper: "red" }],
        name: { text: "楊哥 | Yang Onchain", paper: "cream" },
        handle: { text: "@YangOnchain", paper: "blue" },
        prop: { kind: "plinth" },
      },
      story: { exit: "jump", segments: [{ story: "endCard" }] },
    }));
    const picUrl = new URL("../skills/creator-toy-intro/engine/lib/pictures.js", import.meta.url).href;
    const animUrl = new URL("../skills/creator-toy-intro/templates/isnail-30/anim.js", import.meta.url).href;
    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { wipePicture } from ${JSON.stringify(picUrl)};
         import { LABELS } from ${JSON.stringify(animUrl)};
         const wp = wipePicture("assets/before.png", "assets/after.png", 0.30, { beforeFrameColor: "#38BDF8", afterFrameColor: "#F59E0B" });
         const decl = [], s0 = {}, s1 = {};
         wp.declare((o) => decl.push(o.name), "w0");
         wp.put((n, t) => (s0[n] = t.s), "w0", [0, 0.2, 0], undefined, false, 1);
         wp.put((n, t) => (s1[n] = t.s), "w0", [0, 0.2, 0], undefined, true, 1);
         const nameL = LABELS.find((l) => l.id === "name");
         const handleL = LABELS.find((l) => l.id === "handle");
         console.log(JSON.stringify({ decl, b0: s0.w0_before_frame[0], a0: s0.w0_after_frame[0], b1: s1.w0_before_frame[0], a1: s1.w0_after_frame[0], nameW: nameL.W, nameFit: nameL.fit ?? null, handleFit: handleL.fit ?? null }));`,
      ],
      { env: { ...process.env, FILM: dir }, encoding: "utf8" },
    );
    assert.equal(probe.status, 0, probe.stderr);
    const res = JSON.parse(probe.stdout.trim().split("\n").at(-1));
    assert.equal(res.decl.length, 4);
    assert.equal(res.b0, 1);
    assert.ok(res.a0 <= 1e-3);
    assert.ok(res.b1 <= 1e-3);
    assert.equal(res.a1, 1);
    // 17-char bilingual name (> 0.62 m) gets auto-fitted so W * fit === 0.62 m; short @YangOnchain handle stays 1:1 (null)
    assert.ok(res.nameW > 0.62 && res.nameFit > 0.5 && res.nameFit < 1);
    assert.ok(res.nameW * res.nameFit <= 0.621);
    assert.equal(res.handleFit, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v0.8.20: shared-prefix partial cardScreenOverlaps, emptyCutFrames, end-card EV.logo[0] clamp, and chibi salute/palmBlock", () => {
  // 1) cardScreenOverlaps catches ~16% corner/edge overlap between shared-prefix framedPicture cards (`beat1_trap_fake_pic` &
  //    `beat1_trap_poison_pic`), ignores wipePicture pairs (`_before_pic`/`_after_pic`), and ignores flat floor-lying mats
  const cardGeo = { type: "uiBox", rect: [-150, -90, 300, 180], uvRect: [0, 0, 300, 180], thickness: 0.004, unitScale: 1 };
  const partialObjs = [
    { name: "camera", parent: "root", tr: pack([0, 0.16, 1.0]) },
    { name: "beat1_trap_poison_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.04, 0.16, -0.08], UPRIGHT, [1, 1, 1]) },
    { name: "beat1_trap_fake_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([-0.20, 0.14, 0.04], UPRIGHT, [1, 1, 1]) },
    // Flat floor mat directly below must not trigger screen-overlap warnings
    { name: "beat1_floor_mat_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.0, 0.002, 0.0], QID, [1, 1, 1]) },
    // Wipe pair sharing `beat1_w0` group must never trigger against itself
    { name: "beat1_w0_before_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.52, 0.16, 0.0], UPRIGHT, [1, 1, 1]) },
    { name: "beat1_w0_after_pic", geo: cardGeo, mat: { type: "ui" }, tr: pack([0.52, 0.16, 0.001], UPRIGHT, [1, 1, 1]) },
  ];
  const partialAnim = { ...makeAnim(partialObjs, { camera: [[0, ...pack([0, 0.16, 1.0])], [24, ...pack([0, 0.16, 1.0])]] }, { frames: 25 }), scalars: { fov: Array(25).fill(30) } };
  const cardHits = cardScreenOverlaps(partialAnim, { aspect: 16 / 9 });
  assert.equal(cardHits.length, 1);
  assert.equal(cardHits[0].front, "beat1_trap_fake_pic");
  assert.equal(cardHits[0].back, "beat1_trap_poison_pic");
  assert.ok(cardHits[0].share >= 0.10 && cardHits[0].share < 0.25, `expected 10–25% partial overlap, got ${cardHits[0].share}`);

  // 2) emptyCutFrames catches a hard stage cut opening on 1 dark empty frame before incoming prop appears, and clears immediate visibility
  const makeCutScene = (propStartFrame) => {
    const camTrack = [];
    const beatCardTrack = [];
    const ctaPropTrack = [];
    const hidden = pack([100, -2, 0], QID, [1e-4, 1e-4, 1e-4]);
    for (let f = 0; f < 40; f++) {
      const inCta = f >= 20;
      camTrack.push([f, ...pack(inCta ? [100, 0.16, 1.2] : [150, 0.16, 1.2])]);
      beatCardTrack.push([f, ...(inCta ? pack([150, -2, 0], QID, [1e-4, 1e-4, 1e-4]) : pack([150, 0.16, 0], UPRIGHT, [1, 1, 1]))]);
      ctaPropTrack.push([f, ...(f >= propStartFrame ? pack([99.66, 0.12, 0]) : hidden)]);
    }
    return makeAnim(
      [
        { name: "camera", parent: "root", camera: true, tr: pack([150, 0.16, 1.2]) },
        { name: "cta_floor", parent: "root", geo: { type: "plane", w: 12, h: 12 }, tr: pack([100, 0, 0]) },
        { name: "beat0_card_pic", parent: "root", geo: cardGeo, mat: { type: "ui" }, tr: pack([150, 0.16, 0], UPRIGHT, [1, 1, 1]) },
        { name: "prop_pedestal", parent: "root", geo: { type: "roundBox", size: [0.18, 0.10, 0.14] }, tr: hidden },
      ],
      { camera: camTrack, beat0_card_pic: beatCardTrack, prop_pedestal: ctaPropTrack },
      { frames: 40, fps: 30, sub: 1 },
    );
  };
  const emptyHits = emptyCutFrames(makeCutScene(21), {});
  assert.equal(emptyHits.length, 1);
  assert.equal(emptyHits[0].emptyFrames, 1);
  assert.match(describeEmptyCutFrames(emptyHits)[0].text, /opens on 1 empty dark frame/);
  assert.equal(emptyCutFrames(makeCutScene(20), {}).length, 0);

  // 3) timeline.js clamps EV.logo[0] <= EV.cut on { story: [24, "end"] } and beatkit.js salute/palmBlock use world-space aim targets
  const dir = mkdtempSync(join(tmpdir(), "ctoy-v0820-"));
  try {
    mkdirSync(join(dir, "build"), { recursive: true });
    writeFileSync(join(dir, "toy.json"), JSON.stringify({ height: 0.12, center: [0, 0.06, 0], colors: { body: "#2F61EB" }, joints: { body: { p: [0, 0, 0] }, armR: { p: [-0.02, 0.05, 0], parent: "body" }, armL: { p: [0.02, 0.05, 0], parent: "body" } }, parts: [] }));
    writeFileSync(join(dir, "build/glyphs.json"), "{}");
    writeFileSync(join(dir, "film.json"), JSON.stringify({
      id: "cut-clamp",
      template: "isnail-30",
      theme: "x-desktop",
      format: { fps: 30, bpm: 120, duration: 28, size: [1920, 1080] },
      toy: "toy.json",
      profile: { name: "司徒K", handle: "@situking", bio: ["AI"] },
      posts: { pinned: { date: "2026-03-01", title: "A", counts: { views: "16万" }, cover: "assets/a.png" }, second: { date: "2026-03-02", title: "B", counts: { views: "1万" }, cover: "assets/b.png" } },
      counter: { value: 16, unit: "万", label: "阅读", display: "16万" },
      cta: { layout: "two-column", slogan: [{ text: "真功夫", paper: "cream" }, { text: "找司徒", paper: "red" }], name: { text: "司徒K", paper: "cream" }, handle: { text: "@situking", paper: "blue" }, prop: { kind: "plinth" } },
      story: { exit: "jump", segments: [{ beat: "phrase", bars: 11, text: "测试" }, { story: [24, "end"] }] },
    }));
    const tlUrl = new URL("../skills/creator-toy-intro/templates/isnail-30/timeline.js", import.meta.url).href;
    const bkUrl = new URL("../skills/creator-toy-intro/engine/lib/beatkit.js", import.meta.url).href;
    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { EV } from ${JSON.stringify(tlUrl)};
         import { stand, salute, palmBlock } from ${JSON.stringify(bkUrl)};
         const p1 = salute(stand([150, 0, 0]), 1.0, 0.5, 1.5);
         const p2 = palmBlock(stand([150, 0, 0]), 1.0, 0.5, 1.5, [150, 0.08, 0.25]);
         console.log(JSON.stringify({ cut: EV.cut, logo0: EV.logo[0], logo1: EV.logo[1], salR: p1.aimR?.world, salL: p1.aimL?.world, salArmRz: p1.armR[2], blkR: p2.aimR?.world, blkL: p2.aimL?.world }));`,
      ],
      { env: { ...process.env, FILM: dir }, encoding: "utf8" },
    );
    assert.equal(probe.status, 0, probe.stderr);
    const got = JSON.parse(probe.stdout.trim().split("\n").at(-1));
    assert.equal(got.cut, 24);
    assert.equal(got.logo0, 24);
    assert.ok(got.logo1 > 24.2);
    assert.ok(Array.isArray(got.salR) && Array.isArray(got.salL) && got.salR[2] > 0.04);
    assert.ok(Math.abs(got.salArmRz) < 0.5, "salute must not flare armR.z into a horizontal T-pose");
    assert.ok(Array.isArray(got.blkR) && Array.isArray(got.blkL) && got.blkR[2] > 0.06);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("v0.8.21: coplanarCards catches same-group laptop screen z-fighting while screenPicture, cta.path & top-to-bottom two-column order pass", () => {
  const UPRIGHT = qAxis([1, 0, 0], Math.PI / 2);
  // 1) Coplanar laptop screen (`beat0_ndesk_lscr` front at z=0.0028 vs `beat0_ndesk_lscrOff` front at z=0.0020 + 0.0008 = 0.0028)
  const makeLaptopAnim = (scrZ) => ({
    fps: 30,
    sub: 1,
    frames: 15,
    samples: 15,
    scalars: { fov: Array(15).fill(30) },
    objects: [
      { name: "camera", parent: "root", camera: true, tr: [0, 0.14, 0.68, 0, 0, 0, 1, 1, 1, 1] },
      {
        name: "beat0_ndesk_llid",
        parent: "root",
        geo: { type: "roundBox", size: [0.074, 0.040, 0.0034], radius: 0.0014 },
        mat: { type: "type", color: "#EBE2CE" },
        tr: [0.18, 0.12, 0, 0, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "beat0_ndesk_lscrOff",
        parent: "root",
        geo: { type: "roundBox", size: [0.068, 0.034, 0.0016], radius: 0.0004 },
        mat: { type: "type", color: "#18241E" },
        tr: [0.18, 0.12, 0.0020, 0, 0, 0, 1, 1, 1, 1],
      },
      {
        name: "beat0_ndesk_lscr",
        parent: "root",
        geo: { type: "uiBox", rect: [-32, -16, 64, 32], thickness: 0.001, unitScale: 1 },
        mat: { type: "ui", image: "assets/site.jpg" },
        tr: [0.18, 0.12, scrZ, ...UPRIGHT, 1, 1, 1],
      },
    ],
    tracks: {},
  });

  const broken = coplanarCards(makeLaptopAnim(0.0028), { aspect: 16 / 9 });
  assert.equal(broken.length, 1, "coplanar 0.0 mm laptop off-screen must be flagged even in the same prop group");
  assert.equal(broken[0].card, "beat0_ndesk_lscr");
  assert.equal(broken[0].solid, "beat0_ndesk_lscrOff");
  assert.match(describeCoplanarCards(broken)[0].text, /coplanar\/flush with beat0_ndesk_lscrOff/);

  const buried = coplanarCards(makeLaptopAnim(0.0024), { aspect: 16 / 9 });
  assert.equal(buried.length, 1, "buried screen behind off-screen front face must be flagged");
  assert.match(describeCoplanarCards(buried)[0].text, /behind beat0_ndesk_lscrOff's front face/);

  assert.equal(coplanarCards(makeLaptopAnim(0.0040), { aspect: 16 / 9 }).length, 0, "1.2 mm air gap passes cleanly");

  // 2) kit.screenPicture() builds aspect-matched lid/off/pic with zero coplanar overlap on both put() and putHinge(),
  //    and timeline.js honors film.cta.path + brings name -> handle -> letters in top-to-bottom order on two-column CTA
  const dir = mkdtempSync(join(tmpdir(), "ctoy-v0821-"));
  try {
    mkdirSync(join(dir, "build"), { recursive: true });
    mkdirSync(join(dir, "assets"), { recursive: true });
    mkdirSync(join(dir, "recipes"), { recursive: true });
    // Minimal valid 200x100 PNG header for imageSize()
    const pngHdr = Buffer.alloc(32);
    pngHdr.writeUInt32BE(0x89504e47, 0);
    pngHdr.writeUInt32BE(0x0d0a1a0a, 4);
    pngHdr.writeUInt32BE(13, 8);
    pngHdr.write("IHDR", 12);
    pngHdr.writeUInt32BE(200, 16);
    pngHdr.writeUInt32BE(100, 20);
    writeFileSync(join(dir, "assets/screen.png"), pngHdr);
    writeFileSync(join(dir, "toy.json"), JSON.stringify({ height: 0.12, center: [0, 0.06, 0], colors: { body: "#2F61EB" }, joints: { body: { p: [0, 0, 0] } }, parts: [] }));
    writeFileSync(join(dir, "build/glyphs.json"), "{}");
    writeFileSync(join(dir, "recipes/prop.js"), `export function makeProp({ path, cta }) { return { gotPath: path, declare() {}, sample() {}, topAt: () => cta(path[0], 0.08, 0), cues() {} }; }\n`);
    writeFileSync(join(dir, "film.json"), JSON.stringify({
      id: "v0821-cta",
      template: "isnail-30",
      theme: "x-desktop",
      format: { fps: 30, bpm: 120, duration: 30, size: [1920, 1080] },
      toy: "toy.json",
      profile: { name: "想风", handle: "@xaiwind", bio: ["AI"] },
      posts: { pinned: { date: "2026-03-01", title: "A", counts: { views: "27万" }, cover: "assets/screen.png" }, retro: { date: "2026-03-02", title: "B", counts: { views: "21万" }, cover: "assets/screen.png" } },
      counter: { value: 27, unit: "万", label: "阅读", display: "27万" },
      cta: {
        layout: "two-column",
        path: [-0.28, -0.28],
        slogan: [{ text: "把 AI 和出海", paper: "cream" }, { text: "讲成新手能上手的事", paper: "red" }],
        name: { text: "想风", paper: "cream" },
        handle: { text: "@xaiwind", paper: "blue" },
        prop: { module: "recipes/prop.js" },
      },
      story: { exit: "jump", segments: [{ beat: "phrase", bars: 12, text: "测试" }, { story: [24, "end"] }] },
    }));

    const tlUrl = new URL("../skills/creator-toy-intro/templates/isnail-30/timeline.js", import.meta.url).href;
    const picUrl = new URL("../skills/creator-toy-intro/engine/lib/pictures.js", import.meta.url).href;
    const quatUrl = new URL("../skills/creator-toy-intro/engine/lib/quat.js", import.meta.url).href;
    const probe = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { EV, CTA_LAYOUT, PROP } from ${JSON.stringify(tlUrl)};
         import { screenPicture } from ${JSON.stringify(picUrl)};
         import { trs, qEuler } from ${JSON.stringify(quatUrl)};
         const sp = screenPicture("assets/screen.png", 0.066, { border: 0.004 });
         const decl = [], placed = {};
         sp.declare((o) => decl.push(o), "beat0_lap");
         sp.putHinge((n, tr) => { placed[n] = [...tr.p, ...tr.q, ...(Array.isArray(tr.s) ? tr.s : [tr.s, tr.s, tr.s])]; }, "beat0_lap", trs([0.16, 0.10, 0], qEuler(-0.20, -0.30, 0), 1), { lit: 1 });
         console.log(JSON.stringify({ ev: EV, layoutPath: CTA_LAYOUT.path, propPath: PROP.gotPath, w: sp.w, h: sp.h, lidSize: sp.lidSize, decl, placed }));`,
      ],
      { env: { ...process.env, FILM: dir }, encoding: "utf8" },
    );
    assert.equal(probe.status, 0, probe.stderr);
    const got = JSON.parse(probe.stdout.trim().split("\n").at(-1));
    assert.deepEqual(got.layoutPath, [-0.28, -0.28]);
    assert.deepEqual(got.propPath, [-0.28, -0.28]);
    assert.ok(got.ev.name < got.ev.letters, `two-column top name (${got.ev.name}) must arrive before bottom slogan (${got.ev.letters})`);
    assert.equal(got.h, 0.033);
    assert.deepEqual(got.lidSize, [0.074, 0.041, 0.0034]);

    const hingeAnim = {
      fps: 30,
      sub: 1,
      frames: 12,
      samples: 12,
      scalars: { fov: Array(12).fill(30) },
      objects: [
        { name: "camera", parent: "root", camera: true, tr: [0, 0.14, 0.68, 0, 0, 0, 1, 1, 1, 1] },
        ...got.decl.map((o) => ({ ...o, parent: "root", tr: got.placed[o.name] })),
      ],
      tracks: {},
    };
    assert.equal(coplanarCards(hingeAnim, { aspect: 16 / 9 }).length, 0, "screenPicture.putHinge must have zero coplanar overlap");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
