// The world: every After Effects panel is a floating slab of black glossy glass
// with the UI as emission, over a dark warm studio. Clawd hops across it.
// Rendered from HyperFrames time only: hf-seek → renderFrame(t).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import * as T from "./timeline.js";
import { drawComp, drawClawdSprite, timecode, mulberry32 } from "./comp.js";

const W = 1920, H = 1080;
const MM = 0.001;
const SLAB_T = 0.008;
const UI_EMIT = 1.0;
const COMP_EMIT = 1.05;
const EXPOSURE = 1.0;
const DOF_MAX_RADIUS = 26; // px
const SENSOR_H = 0.024; // full-frame height (m)

const wx = (px) => (px - T.UI_W / 2) * MM;
const wz = (py) => (py - T.UI_H / 2) * MM;
const clamp01 = (a) => Math.min(1, Math.max(0, a));
const smooth = (a) => a * a * (3 - 2 * a);
const lerp = (a, b, s) => a + (b - a) * s;
const easeOut = (a) => 1 - Math.pow(1 - a, 3);
const easeInOut = (a) => (a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2);
const DEG = Math.PI / 180;
const lerpAngle = (a, b, s) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * s;
};

// ── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // graded in gradePass
renderer.setClearColor(0x000000, 1);
const VOID = new THREE.Color("#2f231d"); // the studio beyond the floor pool

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.01, 30);

// ── Environment for reflections: dark room, soft warm box light, kept dim ──
function buildEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0.012, 0.009, 0.008);
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(6, 4, 0xffe2c8, 2.2, new THREE.Vector3(-3, 6, 3)); // key softbox
  panel(8, 1.2, 0xffd0b0, 0.5, new THREE.Vector3(6, 2, -4)); // warm strip
  panel(8, 1.0, 0xbfd8ff, 0.35, new THREE.Vector3(-6, 1.5, -5)); // cool rim strip
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  return rt.texture;
}
scene.environment = buildEnvironment();

// ── Lights (for Clawd and the lit props; the UI itself is emission) ────────
const hemi = new THREE.HemisphereLight(0xffe4d2, 0x2a3040, 1.7);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0e4, 2.4);
key.position.set(-1.2, 2.2, 1.6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xdbe8ff, 1.6);
rim.position.set(1.4, 1.1, -1.8);
scene.add(rim);

// ── Textures ────────────────────────────────────────────────────────────────
const loader = new THREE.TextureLoader();
let uiLoaded;
const uiReady = new Promise((res) => (uiLoaded = res));
const uiTex = loader.load("assets/ui.png", () => uiLoaded(), undefined, () => uiLoaded());
uiTex.colorSpace = THREE.SRGBColorSpace;
uiTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
uiTex.generateMipmaps = true;
uiTex.minFilter = THREE.LinearMipmapLinearFilter;

function canvasTexture(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { canvas: c, ctx: c.getContext("2d"), tex };
}

function radialTexture(stops, size = 256) {
  const { ctx, tex } = canvasTexture(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.needsUpdate = true;
  return tex;
}

// ── Studio floor far below: warm pool of light falling off to dark ─────────
{
  const tex = radialTexture([[0, "#5a4336"], [0.3, "#47352b"], [0.65, "#382a22"], [1, "#2f231d"]], 512);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-0.35, -1.1, -0.2);
  scene.add(floor);
}

// soft drop shadow under a slab
const slabShadowTex = (() => {
  const { ctx, tex } = canvasTexture(256, 256);
  ctx.filter = "blur(18px)";
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(40, 40, 176, 176);
  tex.needsUpdate = true;
  return tex;
})();

// ── Panels as slabs ─────────────────────────────────────────────────────────
const edgeMat = new THREE.MeshStandardMaterial({ color: 0x141212, roughness: 0.35, metalness: 0.3 });
function uiMaterial(intensity = UI_EMIT) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x030303,
    emissive: 0xffffff,
    emissiveMap: uiTex,
    emissiveIntensity: intensity,
    roughness: 0.32,
    metalness: 0,
    specularIntensity: 0.1,
    envMapIntensity: 0.14,
  });
}
// Box whose top face shows the UI rect r (UI px), top at local y = 0
function uiBox(r, thickness, mat) {
  const w = r[2] * MM, d = r[3] * MM;
  const geo = new THREE.BoxGeometry(w, thickness, d);
  geo.translate(0, -thickness / 2, 0);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const uiX = r[0] + (pos.getX(i) + w / 2) / MM;
    const uiY = r[1] + (pos.getZ(i) + d / 2) / MM;
    uv.setXY(i, uiX / T.UI_W, 1 - uiY / T.UI_H);
  }
  return new THREE.Mesh(geo, [edgeMat, edgeMat, mat, edgeMat, edgeMat, edgeMat]);
}

const panels = {};
for (const [name, r] of Object.entries(T.PANELS)) {
  const group = new THREE.Group();
  const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
  group.position.set(wx(cx), 0, wz(cy));
  scene.add(group);
  const mat = uiMaterial();
  const slab = uiBox(r, SLAB_T, mat);
  slab.position.set(0, 0, 0);
  // uiBox is built around the rect centre already (geometry centred)
  group.add(slab);
  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(r[2] * MM + 0.09, r[3] * MM + 0.09),
    new THREE.MeshBasicMaterial({ map: slabShadowTex, transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(0.012, -0.045, 0.018);
  group.add(sh);
  panels[name] = { group, rect: r, mats: [mat], base: group.position.clone() };
}
// local position (relative to a panel group) of a UI point
function local(panelName, px, py, y = 0) {
  const b = panels[panelName].base;
  return new THREE.Vector3(wx(px) - b.x, y, wz(py) - b.z);
}

// ── Buttons that press and light up ─────────────────────────────────────────
const BUTTON_T = 0.003;
const buttons = {};
function addButton(name, panelName, r) {
  const mat = uiMaterial();
  const mesh = uiBox(r, BUTTON_T, mat);
  const p = local(panelName, r[0] + r[2] / 2, r[1] + r[3] / 2, BUTTON_T);
  mesh.position.copy(p);
  panels[panelName].group.add(mesh);
  panels[panelName].mats.push(mat);
  buttons[name] = { mesh, mat, rest: p.clone() };
}
["selection", "rect", "pen", "type"].forEach((n) => addButton(n, "menubar", T.toolRect(n)));
addButton("play", "preview", T.previewRect("play"));

// ── Comp image + timecodes (canvases) ───────────────────────────────────────
const comp = canvasTexture(1600, 900);
{
  const [x, y, w, h] = T.COMP;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x020202, emissive: 0xffffff, emissiveMap: comp.tex, emissiveIntensity: COMP_EMIT,
    roughness: 0.3, specularIntensity: 0.1, envMapIntensity: 0.14,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.copy(local("comp", x + w / 2, y + h / 2, 0.0004));
  panels.comp.group.add(plane);
  panels.comp.mats.push(mat);
}
function timecodePlane(panelName, r, scale) {
  const tc = canvasTexture(r[2] * scale, r[3] * scale);
  const mat = new THREE.MeshBasicMaterial({ map: tc.tex, transparent: true, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(r[2] * MM, r[3] * MM), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.copy(local(panelName, r[0] + r[2] / 2, r[1] + r[3] / 2, 0.0003));
  panels[panelName].group.add(plane);
  return { ...tc, mat, last: "" };
}
const tcComp = timecodePlane("comp", T.TC_COMP, 4);
const tcTimeline = timecodePlane("timeline", T.TC_TIMELINE, 4);
function drawTimecode(tc, text, size) {
  if (tc.last === text) return;
  tc.last = text;
  const { ctx, canvas: c } = tc;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.font = `600 ${size}px -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif`;
  ctx.fillStyle = "#4ea3ff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 6, c.height / 2 + 2);
  tc.tex.needsUpdate = true;
}

// ── Timeline props: layer bars, keyframe cubes, the playhead ────────────────
const barMats = [];
T.TL_ROWS.forEach((row, i) => {
  if (row.type !== "layer") return;
  const L = T.LAYERS[row.layer];
  const len = (T.TL.trackX1 - T.TL.trackX0) * MM;
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(L.color), emissiveIntensity: 0.62, roughness: 0.62, metalness: 0, envMapIntensity: 0.2 });
  const bar = new THREE.Mesh(new RoundedBoxGeometry(len, 0.004, (T.TL.rowH - 10) * MM, 2, 0.0012), mat);
  bar.position.copy(local("timeline", (T.TL.trackX0 + T.TL.trackX1) / 2, T.rowCenterY(i), 0.002));
  panels.timeline.group.add(bar);
  panels.timeline.mats.push(mat);
  barMats.push(mat);
});
const keyMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.5, envMapIntensity: 0.4 });
panels.timeline.mats.push(keyMat);
const keyCubes = T.KEY_COMP_TIMES.map((ct) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.012, 0.012, 2, 0.0018), keyMat);
  m.rotation.y = Math.PI / 4;
  m.position.copy(local("timeline", T.compTimeToX(ct), T.POSITION_ROW_Y, 0.008));
  panels.timeline.group.add(m);
  return m;
});
const ctiHeadMat = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x7cc4ff, emissiveIntensity: 1.5, roughness: 0.3 });
const CTI_LINE = new THREE.Color(0x4ea3ff).multiplyScalar(3.2);
const ctiLineMat = new THREE.MeshBasicMaterial({ color: CTI_LINE.clone() });
panels.timeline.mats.push(ctiHeadMat);
const cti = new THREE.Group();
{
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.018, T.SURF.ctiHead * MM, 0.022, 2, 0.003), ctiHeadMat);
  head.position.y = (T.SURF.ctiHead * MM) / 2;
  cti.add(head);
  const len = (T.TL.bottom - T.TL.rulerY - 8) * MM;
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.0024, 0.0012, len), ctiLineMat);
  line.position.set(0, 0.0007, 0.008 + len / 2);
  cti.add(line);
  panels.timeline.group.add(cti);
}
function placeCti(t) {
  const x = T.compTimeToX(T.ctiTime(t));
  cti.position.copy(local("timeline", x, T.TL.rulerY, 0));
}

// ── Clawd ───────────────────────────────────────────────────────────────────
const U = T.CLAWD_UNIT * MM;
const clawdMat = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#d97757"), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
});
const clawdDark = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#b85a3f"), roughness: 0.5, envMapIntensity: 0.8 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b0909, roughness: 0.25, metalness: 0.1 });
const clawd = new THREE.Group(); // origin at feet, front = +z
const clawdBody = new THREE.Group(); // squash pivot
clawd.add(clawdBody);
const LEG_H = 1.6 * U;
{
  const body = new THREE.Mesh(new RoundedBoxGeometry(12 * U, 8 * U, 6 * U, 4, 0.95 * U), clawdMat);
  body.position.y = LEG_H + 4 * U;
  clawdBody.add(body);
  for (const lx of [-4.5, -1.5, 1.5, 4.5]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(1.4 * U, LEG_H + 0.6 * U, 2.8 * U, 2, 0.3 * U), clawdDark);
    leg.position.set(lx * U, (LEG_H + 0.6 * U) / 2, 0);
    clawdBody.add(leg);
  }
}
const nubs = [-1, 1].map((s) => {
  const pivot = new THREE.Group();
  pivot.position.set(s * 6 * U, LEG_H + 4.6 * U, 0);
  const nub = new THREE.Mesh(new RoundedBoxGeometry(1.5 * U, 2.2 * U, 2.4 * U, 2, 0.4 * U), clawdMat);
  nub.position.set(s * 0.65 * U, -0.9 * U, 0);
  pivot.add(nub);
  clawdBody.add(pivot);
  return pivot;
});
const eyes = [-1, 1].map((s) => {
  const e = new THREE.Mesh(new RoundedBoxGeometry(0.9 * U, 2.0 * U, 0.5 * U, 2, 0.2 * U), eyeMat);
  e.position.set(s * 2.8 * U, LEG_H + 4.6 * U, 3 * U + 0.05 * U);
  clawdBody.add(e);
  return e;
});
const happyEyes = [-1, 1].map((s) => {
  const e = new THREE.Mesh(new THREE.TorusGeometry(0.85 * U, 0.26 * U, 8, 16, Math.PI * 0.8), eyeMat);
  e.rotation.z = Math.PI * 0.1;
  e.position.set(s * 2.8 * U, LEG_H + 4.1 * U, 3 * U + 0.1 * U);
  e.visible = false;
  clawdBody.add(e);
  return e;
});
scene.add(clawd);

// contact shadow under Clawd (the UI is emission, so it can't take a real one)
const blobTex = radialTexture([[0, "rgba(0,0,0,0.75)"], [0.5, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"]]);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2;
scene.add(blob);

// the flat card he peels off the screen as
const spriteCard = (() => {
  const s = canvasTexture(256, 192);
  drawClawdSprite(s.ctx, 128, 96, 18);
  s.tex.needsUpdate = true;
  const w = 14.2 * U, h = 10.6 * U;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2 - 0.4 * U, 0); // hinge at its feet
  const mat = new THREE.MeshStandardMaterial({ map: s.tex, transparent: true, emissive: 0xffffff, emissiveMap: s.tex, emissiveIntensity: 0.55, roughness: 0.5, side: THREE.DoubleSide, alphaTest: 0.02 });
  const m = new THREE.Mesh(geo, mat);
  scene.add(m);
  return m;
})();

// ── Glass shards ────────────────────────────────────────────────────────────
const shardMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeaff, emissive: 0x9fbfff, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const rngS = mulberry32(2026);
const shards = Array.from({ length: 42 }, () => {
  const a = 0.004 + rngS() * 0.012;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, a, rngS() * a * 0.6, 0, rngS() * a, a * (0.6 + rngS() * 0.8), 0], 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, shardMat);
  const ang = rngS() * Math.PI * 2;
  const sp = 0.25 + rngS() * 0.55;
  m.userData = {
    v: new THREE.Vector3(Math.cos(ang) * sp * 0.8, 0.5 + rngS() * 0.9, Math.sin(ang) * sp * 0.6 + 0.12),
    spin: new THREE.Vector3(rngS() * 14 - 7, rngS() * 14 - 7, rngS() * 14 - 7),
    delay: rngS() * 0.04,
  };
  m.visible = false;
  scene.add(m);
  return m;
});

// ── The Glow chip ───────────────────────────────────────────────────────────
const chip = (() => {
  const c = canvasTexture(416, 104);
  const { ctx } = c;
  ctx.fillStyle = "#2f6fbf";
  ctx.beginPath();
  ctx.roundRect(0, 0, 416, 104, 14);
  ctx.fill();
  ctx.fillStyle = "#1f4f8f";
  ctx.beginPath();
  ctx.roundRect(22, 26, 70, 52, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 40px -apple-system, 'Helvetica Neue', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("fx", 36, 54);
  ctx.font = "700 52px -apple-system, 'Helvetica Neue', sans-serif";
  ctx.fillText("Glow", 118, 56);
  c.tex.needsUpdate = true;
  const [, , w, h] = T.GLOW_CHIP;
  const top = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffffff, emissiveMap: c.tex, emissiveIntensity: 1.3, roughness: 0.3 });
  const side = new THREE.MeshStandardMaterial({ color: 0x1d4f92, emissive: 0x2f6fbf, emissiveIntensity: 0.6, roughness: 0.3 });
  const geo = new THREE.BoxGeometry(w * MM, 0.005, h * MM);
  const m = new THREE.Mesh(geo, [side, side, top, side, side, side]);
  m.visible = false;
  scene.add(m);
  return m;
})();

// ── 3D sparkles for the "yay" at the end ───────────────────────────────────
const sparkleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.32).multiplyScalar(1.6) });
const rngY = mulberry32(99);
const sparkles = Array.from({ length: 14 }, () => {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.0025, 0), sparkleMat);
  m.userData = { a: rngY() * Math.PI * 2, v: 0.05 + rngY() * 0.07, up: 0.08 + rngY() * 0.1, d: rngY() * 0.25 };
  m.visible = false;
  scene.add(m);
  return m;
});

// ── Clawd's path ────────────────────────────────────────────────────────────
function spotWorld(name, t) {
  if (name === "cti") {
    const x = T.compTimeToX(T.ctiTime(t));
    return new THREE.Vector3(wx(x), T.SURF.ctiHead * MM, wz(T.TL.rulerY));
  }
  const s = T.SPOTS[name];
  return new THREE.Vector3(wx(s.p[0]), s.h * MM, wz(s.p[1]));
}

// where Clawd's feet are, and whether he's in the air
function clawdPath(t) {
  if (t < T.HOPS[0].t0) return { pos: spotWorld("comp", t), hop: null, stand: { since: T.EV.pop, at: "comp" } };
  for (let i = 0; i < T.HOPS.length; i++) {
    const h = T.HOPS[i];
    if (t < h.t0) {
      const prev = T.HOPS[i - 1];
      return { pos: spotWorld(h.from, t), hop: null, stand: { since: prev ? prev.t1 : T.EV.pop, at: h.from, prev } };
    }
    if (t < h.t1) {
      const s = (t - h.t0) / (h.t1 - h.t0);
      const a = spotWorld(h.from, h.t0), b = spotWorld(h.to, h.t1);
      const pos = new THREE.Vector3().lerpVectors(a, b, s);
      pos.y += h.apex * 4 * s * (1 - s);
      return { pos, hop: h, s, a, b };
    }
  }
  const last = T.HOPS[T.HOPS.length - 1];
  return { pos: spotWorld(last.to, t), hop: null, stand: { since: last.t1, at: last.to, prev: last } };
}

// smoothed path for the follow camera (precomputed once, deterministic)
const SM_RATE = 240;
const smoothPath = (() => {
  const n = Math.ceil(T.DURATION * SM_RATE) + 1;
  const raw = [];
  for (let i = 0; i < n; i++) {
    const t = i / SM_RATE;
    const p = t < T.EV.pop ? spotWorld("comp", t) : clawdPath(t).pos;
    raw.push(p);
  }
  const sigma = T.CAMERA_SMOOTH * SM_RATE;
  const rad = Math.ceil(sigma * 3);
  const kernel = [];
  for (let k = -rad; k <= rad; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const acc = new THREE.Vector3();
    let wsum = 0;
    for (let k = -rad; k <= rad; k++) {
      const j = Math.min(n - 1, Math.max(0, i + k));
      acc.addScaledVector(raw[j], kernel[k + rad]);
      wsum += kernel[k + rad];
    }
    out.push(acc.multiplyScalar(1 / wsum));
  }
  return out;
})();
function smoothClawd(t) {
  const f = clamp01(t / T.DURATION) * (smoothPath.length - 1);
  const i = Math.floor(f), s = f - i;
  return new THREE.Vector3().lerpVectors(smoothPath[i], smoothPath[Math.min(i + 1, smoothPath.length - 1)], s);
}

// ── Camera ──────────────────────────────────────────────────────────────────
// Monotone cubic interpolation over the keyed scalars (no overshoot).
function monotone(ts, ys) {
  const n = ts.length;
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (t) => {
    if (t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let i = 0;
    while (t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}
const CAM = (() => {
  const ts = T.CAMERA.map((k) => k.t);
  const tgt = T.CAMERA.map((k) => {
    if (k.target) return new THREE.Vector3(wx(k.target[0]), k.target[2] * MM, wz(k.target[1]));
    return smoothClawd(k.t).add(new THREE.Vector3(0, 0.024, 0));
  });
  const f = (key) => monotone(ts, T.CAMERA.map((k) => k[key]));
  return {
    tx: monotone(ts, tgt.map((v) => v.x)), ty: monotone(ts, tgt.map((v) => v.y)), tz: monotone(ts, tgt.map((v) => v.z)),
    dist: f("dist"), elev: f("elev"), az: f("az"), follow: f("follow"), fov: f("fov"), fstop: f("fstop"),
  };
})();
function cameraAt(t) {
  const keyT = new THREE.Vector3(CAM.tx(t), CAM.ty(t), CAM.tz(t));
  // follow Clawd sideways fully but only partly up, so a leap never loses the UI
  const fol = smoothClawd(t + 0.03);
  fol.y = fol.y * 0.45 + 0.024;
  const target = keyT.lerp(fol, clamp01(CAM.follow(t)));
  const el = CAM.elev(t) * DEG, az = CAM.az(t) * DEG, d = CAM.dist(t);
  const pos = new THREE.Vector3(
    target.x + d * Math.sin(az) * Math.cos(el),
    target.y + d * Math.sin(el),
    target.z + d * Math.cos(az) * Math.cos(el),
  );
  return { pos, target, fov: CAM.fov(t), fstop: CAM.fstop(t), az };
}

// ── Scene state at time t ───────────────────────────────────────────────────
function setState(t) {
  // camera
  const cam = cameraAt(t);
  camera.position.copy(cam.pos);
  camera.fov = cam.fov;
  camera.lookAt(cam.target);
  camera.updateProjectionMatrix();

  // playhead + keyframes
  placeCti(t);
  T.KEY_STAMP_TIMES.forEach((ts, i) => {
    const d = t - ts;
    const m = keyCubes[i];
    if (d < 0) { m.visible = false; return; }
    m.visible = true;
    const s = d < 0.18 ? easeOut(d / 0.18) * (1 + 0.35 * Math.sin((d / 0.18) * Math.PI)) : 1;
    m.scale.setScalar(Math.max(0.001, s));
  });

  // buttons: selected tool tint + press
  const selected = t < T.EV.typeAt ? "selection" : t < T.EV.sparkAt ? "type" : t < T.EV.swooshAt ? "rect" : "pen";
  for (const [name, b] of Object.entries(buttons)) {
    const on = name === selected || (name === "play" && t >= T.EV.play && t < T.EV.play + 0.6);
    b.mat.emissive.set(on ? 0x6fb4ff : 0xffffff);
    let press = 0;
    const pressAt = { type: T.EV.typeAt, rect: T.EV.sparkAt, pen: T.EV.swooshAt, play: T.EV.play }[name];
    if (pressAt !== undefined) {
      const d = t - pressAt;
      if (d >= -0.02 && d < 0.2) press = Math.sin(clamp01((d + 0.02) / 0.22) * Math.PI);
    }
    b.mesh.position.y = b.rest.y - press * 0.0022;
  }

  // panels power down and fall away
  T.FALL_ORDER.forEach((name, i) => {
    const P = panels[name];
    const tf = T.EV.panelsFall[i];
    const d = t - tf;
    let k = 1;
    if (d > -0.01) {
      const flick = d < 0.14 ? 0.55 + 0.45 * Math.cos(d * 90) : 0;
      k = d < 0.14 ? (1 - d / 0.14) * flick : Math.max(0, 0.06 * (1 - (d - 0.14) / 0.3));
    }
    P.mats.forEach((m) => {
      if (m.userData.base === undefined) m.userData.base = m.emissiveIntensity;
      m.emissiveIntensity = m.userData.base * k;
    });
    if (name === "timeline") {
      ctiLineMat.color.copy(CTI_LINE).multiplyScalar(k);
      tcTimeline.mat.opacity = k;
    }
    const fd = Math.max(0, d - 0.06);
    const dir = new THREE.Vector3(P.base.x - wx(T.COMP_CENTER[0]), 0, P.base.z - wz(T.COMP_CENTER[1])).normalize();
    P.group.position.set(
      P.base.x + dir.x * 0.25 * fd * fd,
      -2.6 * fd * fd,
      P.base.z + dir.z * 0.25 * fd * fd,
    );
    P.group.rotation.set(dir.z * 1.6 * fd * fd, 0, -dir.x * 1.6 * fd * fd);
    P.group.visible = fd < 1.2;
  });

  // glass shards
  shards.forEach((m) => {
    const d = t - T.EV.pop - m.userData.delay;
    if (d < 0 || d > 1.1) { m.visible = false; return; }
    m.visible = true;
    const v = m.userData.v, sp = m.userData.spin;
    m.position.set(wx(T.COMP_CENTER[0]) + v.x * d, 0.004 + v.y * d - 1.6 * d * d, wz(T.COMP_CENTER[1]) + v.z * d);
    m.rotation.set(sp.x * d, sp.y * d, sp.z * d);
  });

  // the flat card
  if (t >= T.EV.peel[0] && t < T.EV.pop + 0.05) {
    const s = easeInOut(clamp01((t - T.EV.peel[0]) / (T.EV.peel[1] - T.EV.peel[0])));
    spriteCard.visible = true;
    // hinge on the sprite's feet, sliding to his standing spot as he rises
    spriteCard.position.set(wx(T.COMP_CENTER[0]), 0.0008 + s * 0.004, wz(T.COMP_CENTER[1]) + 4.8 * U * (1 - s));
    spriteCard.rotation.set(-Math.PI / 2 * (1 - s), 0, 0);
    const curl = Math.sin(s * Math.PI) * 0.15;
    spriteCard.rotation.x -= curl;
    const fade = t >= T.EV.pop ? 1 - (t - T.EV.pop) / 0.05 : 1;
    spriteCard.scale.setScalar(Math.max(0.001, fade));
  } else spriteCard.visible = false;

  // Glow chip: pops out of its row, kicked into the comp
  {
    const up = T.EV.chipUp, kick = T.EV.kick, land = T.EV.chipLand;
    const [cx0, cy0, cw, ch] = T.GLOW_CHIP;
    const rowP = new THREE.Vector3(wx(cx0 + cw / 2), 0.0025, wz(cy0 + ch / 2));
    if (t >= up && t < land) {
      chip.visible = true;
      if (t < kick) {
        const s = clamp01((t - up) / 0.22);
        const hover = easeOut(s) * 0.022 + Math.sin((t - up) * 9) * 0.0015 * s;
        chip.position.copy(rowP).add(new THREE.Vector3(0, hover, 0));
        chip.rotation.set(-0.35 * easeOut(s), 0, Math.sin((t - up) * 7) * 0.05 * s);
        chip.scale.setScalar(1);
      } else {
        const s = (t - kick) / (land - kick);
        const start = rowP.clone().add(new THREE.Vector3(0, 0.022, 0));
        const end = new THREE.Vector3(wx(T.COMP_CENTER[0]), 0.002, wz(T.COMP_CENTER[1]));
        chip.position.lerpVectors(start, end, easeInOut(s));
        chip.position.y += 0.16 * 4 * s * (1 - s);
        chip.rotation.set(-0.35 + s * 7, s * 3, s * 2);
        chip.scale.setScalar(lerp(1, 0.35, s * s));
      }
    } else chip.visible = false;
  }

  // Clawd
  const visible3d = t >= T.EV.pop;
  clawd.visible = visible3d;
  blob.visible = visible3d;
  if (visible3d) poseClawd(t, cam);

  // yay sparkles
  sparkles.forEach((m) => {
    const d = t - T.EV.wave[0] - 0.25 - m.userData.d;
    if (d < 0 || d > 0.9) { m.visible = false; return; }
    m.visible = true;
    const k = d / 0.9;
    const base = clawd.position;
    m.position.set(
      base.x + Math.cos(m.userData.a) * m.userData.v * easeOut(k),
      base.y + 0.05 + m.userData.up * easeOut(k),
      base.z + Math.sin(m.userData.a) * m.userData.v * easeOut(k) * 0.6,
    );
    m.rotation.set(d * 6, d * 4, 0);
    m.scale.setScalar(Math.sin(k * Math.PI) * 1.4 + 0.001);
  });
}

function poseClawd(t, cam) {
  const P = clawdPath(t);
  let yaw = 0, pitch = 0, roll = 0, sy = 1, sxz = 1;
  const faceCam = cam.az; // yaw that faces the camera
  let pos = P.pos.clone();

  // pop out of the card
  const dp = t - T.EV.pop;
  let popScale = 1;
  if (dp >= 0 && dp < 0.2) popScale = 0.55 + 0.45 * easeOut(dp / 0.2) + 0.18 * Math.sin((dp / 0.2) * Math.PI);

  if (P.hop) {
    const h = P.hop, s = P.s;
    const dx = P.b.x - P.a.x, dz = P.b.z - P.a.z;
    const travel = Math.atan2(dx, dz);
    const prevYaw = yawAtRest(h.t0 - 0.001, cam);
    yaw = lerpAngle(prevYaw, lerpAngle(travel, faceCam, 0.35), smooth(clamp01(s * 3)));
    if (h.flip) pitch = Math.PI * 2 * easeInOut(clamp01((s - 0.12) / 0.76));
    const stretch = 0.14 * Math.max(0, 1 - s / 0.35) - 0.06 * Math.max(0, (s - 0.8) / 0.2);
    sy = 1 + stretch;
    sxz = 1 - stretch * 0.45;
  } else {
    yaw = yawAtRest(t, cam);
  }

  // take-off anticipation and landing squash
  for (const h of T.HOPS) {
    const a = t - (h.t0 - 0.09);
    if (a >= 0 && a < 0.09) {
      const q = Math.sin((a / 0.09) * Math.PI) * 0.16;
      sy = 1 - q; sxz = 1 + q * 0.5;
    }
    const l = t - h.t1;
    if (l >= 0 && l < 0.22) {
      const u = l / 0.22;
      const q = 0.24 * Math.exp(-4 * u) * Math.cos(u * Math.PI * 1.6);
      sy = 1 - q; sxz = 1 + q * 0.5;
    }
  }

  // kick the chip: turn to it, lunge
  if (t > T.EV.chipUp + 0.1 && t < T.HOPS[4].t0) {
    const s = smooth(clamp01((t - (T.EV.chipUp + 0.1)) / 0.2));
    yaw = lerpAngle(yaw, -Math.PI / 2, s);
    const l = t - (T.EV.kick - 0.06);
    if (l >= 0 && l < 0.2) {
      const k = Math.sin((l / 0.2) * Math.PI);
      pos.x -= 0.009 * k;
      pitch = 0.32 * k;
    }
  }

  // riding the playhead: lean into the rewind, surf the play
  if (T.riding(t)) {
    if (t < T.EV.rewind[1] + 0.05) {
      roll = -0.18 * Math.sin(clamp01((t - T.EV.rewind[0]) / 0.45) * Math.PI);
    } else {
      const s = clamp01((t - T.EV.surf[0]) / (T.EV.surf[1] - T.EV.surf[0]));
      yaw = lerpAngle(yaw, lerpAngle(Math.PI / 2, faceCam, 0.45), smooth(clamp01((t - T.EV.surf[0] + 0.1) / 0.25)));
      pitch = -0.14 * Math.sin(Math.min(1, s * 1.3) * Math.PI);
      pos.y += 0.003 * Math.abs(Math.sin((t - T.EV.surf[0]) * Math.PI * 4));
    }
  }

  // wave at the end
  let wave = 0;
  if (t >= T.EV.wave[0]) {
    const d = t - T.EV.wave[0];
    wave = Math.min(1, d / 0.12) * (1.1 + 0.45 * Math.sin(d * Math.PI * 2 * 3.2));
    roll += 0.06 * Math.sin(d * Math.PI * 2 * 1.6);
  }
  nubs[1].rotation.z = wave;
  nubs[0].rotation.z = 0;
  const happy = t >= T.EV.wave[0] - 0.05;
  eyes.forEach((e) => (e.visible = !happy));
  happyEyes.forEach((e) => (e.visible = happy));
  // blinks
  const blink = [6.95, 9.05, 10.7].some((b) => t > b && t < b + 0.09);
  eyes.forEach((e) => e.scale.set(1, blink ? 0.15 : 1, 1));

  clawd.position.copy(pos);
  clawd.rotation.set(0, 0, 0);
  clawd.rotation.order = "YXZ";
  clawd.rotation.set(pitch, yaw, roll);
  // flips rotate around the body centre, not the feet
  if (pitch !== 0) {
    const c = new THREE.Vector3(0, LEG_H + 4 * U, 0);
    const rotated = c.clone().applyEuler(clawd.rotation);
    clawd.position.add(c.sub(rotated));
  }
  clawdBody.scale.set(sxz * popScale, sy * popScale, sxz * popScale);

  // contact shadow on whatever is under him
  const groundY = groundUnder(pos.x, pos.z, t);
  if (groundY === null) blob.visible = false;
  else {
    const hgt = Math.max(0, pos.y - groundY);
    const k = clamp01(1 - hgt / 0.16);
    blob.visible = true;
    blob.position.set(pos.x, groundY + 0.0009, pos.z);
    blob.rotation.z = yaw;
    blob.scale.set(0.09 * (1.2 - 0.4 * k), 0.06 * (1.2 - 0.4 * k), 1);
    blob.material.opacity = 0.85 * k * k;
  }
}

// resting yaw: face the camera, lightly biased toward the last travel direction
function yawAtRest(t, cam) {
  const P = clawdPath(t);
  const prev = P.stand && P.stand.prev;
  const faceCam = cam ? cam.az : cameraAt(t).az;
  if (!prev) return faceCam;
  const a = spotWorld(prev.from, prev.t0), b = spotWorld(prev.to, prev.t1);
  const travel = Math.atan2(b.x - a.x, b.z - a.z);
  const s = smooth(clamp01((t - prev.t1) / 0.3));
  return lerpAngle(lerpAngle(travel, faceCam, 0.35), lerpAngle(travel, faceCam, 0.75), s);
}

function groundUnder(x, z, t) {
  const px = x / MM + T.UI_W / 2, py = z / MM + T.UI_H / 2;
  if (T.riding(t)) return T.SURF.ctiHead * MM;
  for (const n of ["type", "rect", "pen"]) {
    const r = T.toolRect(n);
    if (px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3]) return T.SURF.button * MM;
  }
  const pr = T.previewRect("play");
  if (px > pr[0] && px < pr[0] + pr[2] && py > pr[1] && py < pr[1] + pr[3]) return T.SURF.button * MM;
  for (const [name, P] of Object.entries(panels)) {
    const r = P.rect;
    if (px > r[0] && px < r[0] + r[2] && py > r[1] && py < r[1] + r[3]) {
      return P.group.position.y + (name === "comp" ? 0.0006 : 0);
    }
  }
  return null;
}

// ── Post: motion blur + AA by sub-frame accumulation, then DOF, bloom, AgX ─
const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
// sub-pixel jitter per sample (Halton 2,3) — anti-aliasing for free
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const HALTON = Array.from({ length: 32 }, (_, i) => [halton(i + 1, 2), halton(i + 1, 3)]);

class AccumulatePass extends Pass {
  constructor() {
    super();
    this.needsSwap = true;
    this.time = 0;
    this.sampleRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tSample: { value: null }, weight: { value: 1 } },
      vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tSample; uniform float weight; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(tSample, vUv).rgb * weight, 1.0); }`,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthTest: false, depthWrite: false, transparent: true,
    }));
  }
  render(r, writeBuffer) {
    const N = T.BLUR_SAMPLES;
    const open = T.SHUTTER / T.FPS;
    const autoClear = r.autoClear;
    r.autoClear = false; // the quad must add onto the buffer, not clear it
    r.setRenderTarget(writeBuffer);
    r.setClearColor(0x000000, 1);
    r.clear();
    for (let k = 0; k < N; k++) {
      const tk = this.time + open * ((k + 0.5) / N - 0.5);
      setState(Math.max(0, Math.min(T.DURATION, tk)));
      const [jx, jy] = HALTON[k % HALTON.length];
      camera.setViewOffset(W, H, jx - 0.5, jy - 0.5, W, H);
      r.setRenderTarget(this.sampleRT);
      r.setClearColor(VOID, 1);
      r.clear();
      r.render(scene, camera);
      camera.clearViewOffset();
      r.setClearColor(0x000000, 1);
      this.quad.material.uniforms.tSample.value = this.sampleRT.texture;
      this.quad.material.uniforms.weight.value = 1 / N;
      r.setRenderTarget(writeBuffer);
      this.quad.render(r);
    }
    r.autoClear = autoClear;
  }
}

const depthRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
depthRT.depthTexture = new THREE.DepthTexture(W, H);
depthRT.depthTexture.type = THREE.FloatType;

const dofPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: depthRT.depthTexture },
    texel: { value: new THREE.Vector2(1 / W, 1 / H) },
    focusDist: { value: 0.5 },
    lensK: { value: 10 },
    maxR: { value: DOF_MAX_RADIUS },
    cNear: { value: camera.near },
    cFar: { value: camera.far },
  },
  vertexShader: quadVS,
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform vec2 texel; uniform float focusDist, lensK, maxR, cNear, cFar;
    varying vec2 vUv;
    float dist(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cNear, cFar); }
    float coc(float d){ return clamp(lensK * abs(d - focusDist) / d, 0.0, maxR); }
    void main(){
      float cd = dist(vUv);
      float cs = coc(cd);
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float tot = 1.0;
      float radius = 0.75;
      for (int i = 0; i < 200; i++) {
        if (radius >= maxR) break;
        float ang = float(i) * 2.39996323;
        vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
        vec3 sc = texture2D(tDiffuse, tc).rgb;
        float sd = dist(tc);
        float ss = coc(sd);
        if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
        float m = smoothstep(radius - 0.5, radius + 0.5, ss);
        col += mix(col / tot, sc, m);
        tot += 1.0;
        radius += 1.6 / radius;
      }
      gl_FragColor = vec4(col / tot, 1.0);
    }`,
});

// ShaderPass clones its uniforms; point the clone at the live depth texture
dofPass.uniforms.tDepth.value = depthRT.depthTexture;

// Final grade: linear below a soft shoulder (the UI's dark greys stay exactly
// as authored), highlights roll off, then vignette, sRGB and grain.
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, frame: { value: 0 }, exposure: { value: EXPOSURE } },
  vertexShader: quadVS,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float frame, exposure; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32 + frame * 0.137); return fract(p.x * p.y); }
    vec3 shoulder(vec3 x){
      const float a = 0.7;
      vec3 over = max(x - a, 0.0);
      return min(x, vec3(a)) + (1.0 - a) * (1.0 - exp(-over / (1.0 - a)));
    }
    vec3 toSRGB(vec3 c){
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb * exposure;
      vec2 q = vUv - vec2(0.5, 0.47);
      float v = 1.0 - smoothstep(0.3, 0.95, length(q * vec2(1.0, 1.15)));
      c *= mix(0.62, 1.0, v);
      c = toSRGB(clamp(shoulder(max(c, 0.0)), 0.0, 1.0));
      c += (hash(vUv * vec2(1920.0, 1080.0)) - 0.5) * 0.016;
      gl_FragColor = vec4(c, 1.0);
    }`,
});

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(W, H);
const accum = new AccumulatePass();
composer.addPass(accum);
composer.addPass(dofPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.5, 1.05);
composer.addPass(bloom);
composer.addPass(gradePass);

// ── Render one frame ────────────────────────────────────────────────────────
function renderFrame(t) {
  t = Math.max(0, Math.min(T.DURATION, t));
  drawComp(comp.ctx, t);
  comp.tex.needsUpdate = true;
  drawTimecode(tcComp, timecode(T.ctiTime(t)), 72);
  drawTimecode(tcTimeline, timecode(T.ctiTime(t)), 104);

  // depth at the frame's own time for the depth of field
  setState(t);
  renderer.setRenderTarget(depthRT);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  const cam = cameraAt(t);
  const focusPoint = clawd.visible ? clawd.position.clone().add(new THREE.Vector3(0, LEG_H + 4 * U, 0)) : cam.target;
  const focus = lerp(cam.pos.distanceTo(cam.target), cam.pos.distanceTo(focusPoint), clamp01(CAM.follow(t)));
  const f = (SENSOR_H / 2) / Math.tan((cam.fov * DEG) / 2);
  dofPass.uniforms.focusDist.value = focus;
  dofPass.uniforms.lensK.value = ((f * f) / (cam.fstop * Math.max(0.01, focus - f))) / SENSOR_H * H * 0.5;
  gradePass.uniforms.frame.value = Math.round(t * T.FPS);

  accum.time = t;
  composer.render();
}

// ── Boot ────────────────────────────────────────────────────────────────────
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["clawd-world"] = (async () => {
  try {
    await Promise.all([
      document.fonts.load("900 118px Montserrat"),
      document.fonts.load("800 78px Montserrat"),
    ]);
  } catch (e) { /* fall back to the font stack */ }
  await uiReady;
  renderFrame(window.__hfThreeTime || 0);
})();

window.addEventListener("hf-seek", (e) => renderFrame(e.detail.time));
window.__clawd = { renderFrame, setState, cameraAt };
