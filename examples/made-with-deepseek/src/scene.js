// Three.js preview of the world: every After Effects panel is a floating slab
// of black glossy glass with the UI as emission, over a dark warm studio, and
// the whale hops across it. Motion comes from src/anim.js (shared with the
// Blender build); this file only builds meshes and applies that state.
// Rendered from HyperFrames time only: hf-seek → renderFrame(t).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import * as T from "./timeline.js";
import * as A from "./anim.js";
import { HERO_PARTS, FIN_PIVOTS, HERO_COLORS, U } from "./hero.js";
import { drawComp, drawWhale, drawChip, timecode } from "./comp.js";

const W = 1920, H = 1080;
const { MM, SLAB_T, BUTTON_T, wx, wz } = A;
const UI_EMIT = 1.0;
const COMP_EMIT = 1.05;
const EXPOSURE = 1.0;
const DOF_MAX_RADIUS = 26; // px
const SENSOR_H = 0.024; // full-frame height (m)
const DEG = Math.PI / 180;

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

// ── Lights (for the whale and the lit props; the UI itself is emission) ────
scene.add(new THREE.HemisphereLight(0xffe4d2, 0x2a3040, 1.7));
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
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ── Studio floor far below: warm pool of light falling off to dark ─────────
{
  const tex = radialTexture([[0, "#5a4336"], [0.3, "#47352b"], [0.65, "#382a22"], [1, "#2f231d"]], 512);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-0.35, -1.1, -0.2);
  scene.add(floor);
}
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
function uiMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x030303, emissive: 0xffffff, emissiveMap: uiTex, emissiveIntensity: UI_EMIT,
    roughness: 0.32, metalness: 0, specularIntensity: 0.1, envMapIntensity: 0.14,
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
  group.position.copy(vec(A.PANEL_BASE[name]));
  scene.add(group);
  const mat = uiMaterial();
  group.add(uiBox(r, SLAB_T, mat));
  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(r[2] * MM + 0.09, r[3] * MM + 0.09),
    new THREE.MeshBasicMaterial({ map: slabShadowTex, transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(0.012, -0.045, 0.018);
  group.add(sh);
  panels[name] = { group, mats: [mat] };
}

// ── Buttons that press and light up ─────────────────────────────────────────
const buttons = {};
function addButton(name, panelName, r) {
  const mat = uiMaterial();
  const mesh = uiBox(r, BUTTON_T, mat);
  const rest = vec(A.panelLocal(panelName, r[0] + r[2] / 2, r[1] + r[3] / 2, BUTTON_T));
  mesh.position.copy(rest);
  panels[panelName].group.add(mesh);
  panels[panelName].mats.push(mat);
  buttons[name] = { mesh, mat, rest };
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
  plane.position.copy(vec(A.panelLocal("comp", x + w / 2, y + h / 2, 0.0004)));
  panels.comp.group.add(plane);
  panels.comp.mats.push(mat);
}
function timecodePlane(panelName, r, scale) {
  const tc = canvasTexture(r[2] * scale, r[3] * scale);
  const mat = new THREE.MeshBasicMaterial({ map: tc.tex, transparent: true, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(r[2] * MM, r[3] * MM), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.copy(vec(A.panelLocal(panelName, r[0] + r[2] / 2, r[1] + r[3] / 2, 0.0003)));
  panels[panelName].group.add(plane);
  return { ...tc, mat, last: "" };
}
const tcComp = timecodePlane("comp", T.TC_COMP, 4);
const tcTimeline = timecodePlane("timeline", T.TC_TIMELINE, 4);
export function drawTimecode(tc, text, size) {
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
T.TL_ROWS.forEach((row, i) => {
  if (row.type !== "layer") return;
  const L = T.LAYERS[row.layer];
  const len = (T.TL.trackX1 - T.TL.trackX0) * MM;
  const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(L.color), emissiveIntensity: 0.62, roughness: 0.62, metalness: 0, envMapIntensity: 0.2 });
  const bar = new THREE.Mesh(new RoundedBoxGeometry(len, 0.004, (T.TL.rowH - 10) * MM, 2, 0.0012), mat);
  bar.position.copy(vec(A.panelLocal("timeline", (T.TL.trackX0 + T.TL.trackX1) / 2, T.rowCenterY(i), 0.002)));
  panels.timeline.group.add(bar);
  panels.timeline.mats.push(mat);
});
const keyMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.5, envMapIntensity: 0.4 });
panels.timeline.mats.push(keyMat);
const keyCubes = T.KEY_COMP_TIMES.map((ct) => {
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.012, 0.012, 2, 0.0018), keyMat);
  m.rotation.y = Math.PI / 4;
  m.position.copy(vec(A.panelLocal("timeline", T.compTimeToX(ct), T.POSITION_ROW_Y, 0.008)));
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

// ── The whale ───────────────────────────────────────────────────────────────
const heroMats = {
  skin: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(HERO_COLORS.skin), roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.25, envMapIntensity: 0.9 }),
  belly: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(HERO_COLORS.belly), roughness: 0.4, clearcoat: 0.3, envMapIntensity: 0.8 }),
  eye: new THREE.MeshStandardMaterial({ color: new THREE.Color(HERO_COLORS.eye), roughness: 0.2, metalness: 0.1 }),
};
const hero = new THREE.Group(); // origin at the belly's ground contact, head = +z
const heroBody = new THREE.Group(); // squash pivot
hero.add(heroBody);
const heroGroups = { eyes: [], happy: [] };
const finPivots = {};
for (const [name, p] of Object.entries(FIN_PIVOTS)) {
  const g = new THREE.Group();
  g.position.set(p.pos[0] * U, p.pos[1] * U, p.pos[2] * U);
  g.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
  heroBody.add(g);
  finPivots[name] = g;
}
for (const part of HERO_PARTS) {
  let geo;
  if (part.shape === "ellipsoid") {
    geo = new THREE.SphereGeometry(1, 48, 32);
    geo.scale(part.r[0] * U, part.r[1] * U, part.r[2] * U);
  } else {
    geo = new THREE.TorusGeometry(part.radius * U, part.tube * U, 10, 20, part.arc);
  }
  const m = new THREE.Mesh(geo, heroMats[part.mat]);
  m.position.set(part.pos[0] * U, part.pos[1] * U, part.pos[2] * U);
  m.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
  const parent = finPivots[part.group] || heroBody;
  parent.add(m);
  if (part.group === "eyes" || part.group === "happy") heroGroups[part.group].push(m);
}
scene.add(hero);

// contact shadow under the whale (the UI is emission, so it can't take a real one)
const blobTex = radialTexture([[0, "rgba(0,0,0,0.75)"], [0.5, "rgba(0,0,0,0.35)"], [1, "rgba(0,0,0,0)"]]);
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2;
scene.add(blob);

// the flat card he peels off the screen as
const spriteCard = (() => {
  const s = canvasTexture(512, 332);
  drawWhale(s.ctx, 256, 197, 240, { style: "mascot" });
  s.tex.needsUpdate = true;
  const [w, h] = A.CARD_SIZE;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0); // hinge on its bottom edge
  const mat = new THREE.MeshStandardMaterial({ map: s.tex, transparent: true, emissive: 0xffffff, emissiveMap: s.tex, emissiveIntensity: 0.55, roughness: 0.5, side: THREE.DoubleSide, alphaTest: 0.02 });
  const m = new THREE.Mesh(geo, mat);
  scene.add(m);
  return m;
})();

// ── Glass shards ────────────────────────────────────────────────────────────
const shardMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeaff, emissive: 0x9fbfff, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
const shards = A.SHARDS.map((sh) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(sh.tri, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, shardMat);
  scene.add(m);
  return m;
});

// ── The Glow chip ───────────────────────────────────────────────────────────
const chip = (() => {
  const c = canvasTexture(416, 104);
  drawChip(c.ctx);
  c.tex.needsUpdate = true;
  const [, , w, h] = T.GLOW_CHIP;
  const top = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0xffffff, emissiveMap: c.tex, emissiveIntensity: 1.3, roughness: 0.3 });
  const side = new THREE.MeshStandardMaterial({ color: 0x1d4f92, emissive: 0x2f6fbf, emissiveIntensity: 0.6, roughness: 0.3 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * MM, 0.005, h * MM), [side, side, top, side, side, side]);
  scene.add(m);
  return m;
})();

// ── "Yay" sparkles ──────────────────────────────────────────────────────────
const sparkleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.68, 1.0).multiplyScalar(1.8) });
const sparkles = Array.from({ length: 14 }, () => {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.0025, 0), sparkleMat);
  scene.add(m);
  return m;
});

// ── Apply the shared state ──────────────────────────────────────────────────
function place(obj, s) {
  obj.visible = s.visible;
  obj.position.copy(vec(s.pos));
  obj.rotation.set(s.rot[0], s.rot[1], s.rot[2]);
  obj.scale.setScalar(s.scale ?? 1);
}
function apply(S) {
  const c = S.cam;
  camera.position.copy(vec(c.pos));
  camera.fov = c.fov;
  camera.lookAt(vec(c.target));
  camera.updateProjectionMatrix();

  for (const [name, P] of Object.entries(S.panels)) {
    const p = panels[name];
    p.group.position.copy(vec(P.pos));
    p.group.rotation.set(P.rot[0], P.rot[1], P.rot[2]);
    p.group.visible = P.visible;
    p.mats.forEach((m) => {
      if (m.userData.base === undefined) m.userData.base = m.emissiveIntensity;
      m.emissiveIntensity = m.userData.base * P.emit;
    });
    if (name === "timeline") {
      ctiLineMat.color.copy(CTI_LINE).multiplyScalar(P.emit);
      tcTimeline.mat.opacity = P.emit;
    }
  }
  for (const [name, b] of Object.entries(buttons)) {
    b.mat.emissive.set(S.buttons[name].on ? 0x6fb4ff : 0xffffff);
    b.mesh.position.y = b.rest.y - S.buttons[name].press * 0.0022;
  }
  S.keys.forEach((k, i) => {
    keyCubes[i].visible = k > 0;
    keyCubes[i].scale.setScalar(Math.max(0.001, k));
  });
  cti.position.copy(vec(A.panelLocal("timeline", S.ctiX, T.TL.rulerY, 0)));

  const h = S.hero;
  hero.visible = h.visible;
  hero.position.copy(vec(h.pos));
  hero.rotation.order = "YXZ";
  hero.rotation.set(h.rot[0], h.rot[1], h.rot[2]);
  heroBody.scale.set(h.scale[0], h.scale[1], h.scale[2]);
  finPivots.finL.rotation.z = h.finL;
  finPivots.finR.rotation.z = h.finR;
  heroGroups.eyes.forEach((e) => { e.visible = !h.happy; e.scale.y = h.blink ? 0.15 : 1; });
  heroGroups.happy.forEach((e) => (e.visible = h.happy));

  blob.visible = S.blob.visible;
  blob.position.copy(vec(S.blob.pos));
  blob.rotation.z = S.blob.yaw;
  blob.scale.set(S.blob.sx, S.blob.sz, 1);
  blob.material.opacity = S.blob.opacity;

  place(spriteCard, S.card);
  place(chip, S.chip);
  S.shards.forEach((s, i) => place(shards[i], s));
  S.sparkles.forEach((s, i) => place(sparkles[i], s));
}

// ── Post: motion blur + AA by sub-frame accumulation, then DOF, bloom, grade
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
      apply(A.stateAt(tk));
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
    tDepth: { value: null },
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
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.5, 1.05));
composer.addPass(gradePass);

// ── Render one frame ────────────────────────────────────────────────────────
function renderFrame(t) {
  t = Math.max(0, Math.min(T.DURATION, t));
  drawComp(comp.ctx, t);
  comp.tex.needsUpdate = true;
  drawTimecode(tcComp, timecode(T.ctiTime(t)), 72);
  drawTimecode(tcTimeline, timecode(T.ctiTime(t)), 104);

  // depth at the frame's own time for the depth of field
  const S = A.stateAt(t);
  apply(S);
  renderer.setRenderTarget(depthRT);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  const f = SENSOR_H / 2 / Math.tan((S.cam.fov * DEG) / 2);
  const focus = S.cam.focus;
  dofPass.uniforms.focusDist.value = focus;
  dofPass.uniforms.lensK.value = ((f * f) / (S.cam.fstop * Math.max(0.01, focus - f))) / SENSOR_H * H * 0.5;
  gradePass.uniforms.frame.value = Math.round(t * T.FPS);

  accum.time = t;
  composer.render();
}

// ── Boot ────────────────────────────────────────────────────────────────────
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["whale-world"] = (async () => {
  try {
    await Promise.all([document.fonts.load("900 118px Montserrat"), document.fonts.load("900 62px Montserrat")]);
  } catch (e) { /* fall back to the font stack */ }
  await uiReady;
  renderFrame(window.__hfThreeTime || 0);
})();

window.addEventListener("hf-seek", (e) => renderFrame(e.detail.time));
window.__hero = { renderFrame, stateAt: A.stateAt };
