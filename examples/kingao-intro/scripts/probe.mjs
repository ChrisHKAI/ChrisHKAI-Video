// Where things land on screen: prints normalized screen coords (x right,
// y up, ±1 = frame edge) of named points at the given times.
// usage: node scripts/probe.mjs 1.85,2.0,2.3
import * as A from "../src/anim.js";
import * as T from "../src/timeline.js";
import { qRot, qConj } from "../src/quat.js";

const times = (process.argv[2] || "0,1.85,2.0,2.55,3.9").split(",").map(Number);
function project(t, p) {
  const cam = A.cameraAt(t);
  const d = qRot(qConj(cam.tr.q), A.v3.sub(p, cam.pos)); // camera looks down -z
  const k = 1 / Math.tan((cam.fov * Math.PI) / 360);
  return [(d[0] / -d[2]) * k * (9 / 16), (d[1] / -d[2]) * k].map((v) => +v.toFixed(2));
}
const corners = (t) => {
  const P = A.pageAt(t);
  return [[-0.15, 0.27], [0.15, 0.27], [-0.15, -0.27], [0.15, -0.27]].map(([x, y]) => project(t, A.v3.add(P.p, qRot(P.q, [x, y, 0]))));
};
for (const t of times) {
  const av = A.avatarAt(Math.min(t, T.EV.pop - 0.01)).p;
  console.log(t.toFixed(2), "avatar", project(t, av), "land", project(t, A.LAND_A), "cat", project(t, A.catCentre(t)), "column", JSON.stringify(corners(t)));
}
