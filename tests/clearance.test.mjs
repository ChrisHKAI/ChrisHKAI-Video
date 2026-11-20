import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { solidClashes, describeClashes } from "../skills/creator-toy-intro/engine/lib/clearance.js";

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
