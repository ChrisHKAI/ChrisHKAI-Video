// A picture peeling off the page like a sticker (the profile picture before it
// puffs into the toy). It is cut into strips parallel to the hinge, the edge
// nearest the camera that stays down longest; the sticker lets go from the far
// edge back to the hinge, curling up on a shrinking radius, and stands up.
import { qId, qAxis, trs } from "./quat.js";
import { seg, lerp, easeInOut } from "./math.js";

const HIDDEN = 1e-4;

// hinge: world point of the hinge's middle; size: the picture's width (m);
// peel: [start, end] of the peel; pop: when the strips vanish (the toy appears)
export function makePeel({ hinge, size, strips = 24, peel, pop }) {
  const D = size;
  function peelState(t) {
    const s = seg(t, peel[0], peel[1]);
    const e = easeInOut(s);
    const d = D * (1 - e); // still stuck from the hinge to d
    const phi = (Math.PI / 2) * Math.pow(e, 0.8) + 0.12 * Math.sin(seg(t, peel[1], pop) * Math.PI * 2) * (t > peel[1] ? 1 : 0);
    const R = lerp(0.016, 0.011, e);
    return { d, phi, R };
  }
  // position and bend angle of the sticker at arc length a from the hinge
  function peelPoint(a, st) {
    const { d, phi, R } = st;
    if (a <= d || phi < 1e-4) return { y: 0, z: -a, th: 0 };
    const curl = R * phi;
    if (a <= d + curl) {
      const th = (a - d) / R;
      return { y: R * (1 - Math.cos(th)), z: -d - R * Math.sin(th), th };
    }
    const r = a - d - curl;
    return { y: R * (1 - Math.cos(phi)) + r * Math.sin(phi), z: -d - R * Math.sin(phi) - r * Math.cos(phi), th: phi };
  }
  function stripAt(i, t) {
    const a = (i + 0.5) / strips * D;
    if (t >= pop) return trs([hinge[0], 0.06, hinge[2] - 0.01], qId(), HIDDEN);
    const pt = peelPoint(a, peelState(t));
    return trs([hinge[0], hinge[1] + pt.y, hinge[2] + pt.z], qAxis([1, 0, 0], pt.th));
  }
  return { stripAt, STRIPS: strips, STRIP_W: D, STRIP_H: D / strips };
}
