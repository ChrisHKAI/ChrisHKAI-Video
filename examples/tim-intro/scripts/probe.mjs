// Screen positions (0..1, y down) of named points at given times, for framing.
// usage: node scripts/probe.mjs 24.5,30 [shot]
import * as A from "../src/anim.js";
import * as T from "../src/timeline.js";
import { apply, qConj, qRot } from "../src/quat.js";

const mm = (v) => v.map((x) => x * 0.001);
const times = (process.argv[2] ?? "0").split(",").map(Number);
for (const t of times) {
  const cam = A.cameraAt(t);
  const fov = (cam.fov * Math.PI) / 180, aspect = 16 / 9;
  const ci = qConj(cam.tr.q);
  const proj = (w) => {
    const d = qRot(ci, w.map((v, i) => v - cam.tr.p[i]));
    if (d[2] >= 0) return "behind";
    const y = d[1] / -d[2] / Math.tan(fov / 2), x = d[0] / -d[2] / Math.tan(fov / 2) / aspect;
    return [(0.5 + x / 2).toFixed(2), (0.5 - y / 2).toFixed(2)];
  };
  const S = T.SET.screen, tim = A.TIM_ROOT(t), jb = A.jobsRoot(t);
  const pts = {
    screenTL: A.fromStage([-S.w / 2, S.y + S.h, S.z]), screenBR: A.fromStage([S.w / 2, S.y, S.z]),
    timHead: apply(tim, mm([0, 128, 0])), timFeet: apply(tim, [0, 0, 0]),
    counter: A.counterFrame(t).p, jobsHead: apply(jb, mm([0, 128, 0])), jobsFeet: apply(jb, [0, 0, 0]),
  };
  console.log(t.toFixed(2), T.shotAt(t).name, Object.entries(pts).map(([k, v]) => `${k}=${proj(v)}`).join(" "));
}
