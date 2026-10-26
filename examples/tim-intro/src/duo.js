// The "iPhone Duo": a book-style foldable. Two halves, each a slab with a
// silver frame; open, the inner screens make one wide screen with the crease
// down the middle. Half L's back is the cover screen, half R's back is pale
// cream with the camera plateau (two big lenses).
// Phone space (mm): the hinge runs along z through the origin, the screens
// face +y and the picture's top is +z. Open flat, half L spans x ∈ [0, W]
// and half R x ∈ [-W, 0]; folding turns each half about z (L by +φ, R by -φ)
// until at φ = 90° the screens meet and the phone stands on its hinge.
import { qAxis } from "./quat.js";

const mm = 0.001;
export const DUO = { W: 26, H: 37, T: 2.5 }; // one half: width, height, thickness (mm)

export const DUO_COLORS = {
  duoFrame: "#D9DBDF",
  duoBack: "#EEE8DD",
  duoGlass: "#0B0C0F",
  duoLensRing: "#C9CCD1",
  duoLens: "#121317",
  duoScreen: "#FFFFFF",
  duoCover: "#FFFFFF",
};
export const DUO_FINISH = { duoFrame: "metal", duoLensRing: "metal", duoGlass: "blackGlass", duoLens: "blackGlass", duoBack: "satin", duoScreen: "screen", duoCover: "screen" };

function half(s, n) {
  const { W, H, T } = DUO, cx = s * W / 2;
  // outer corners round, the hinge side square (the screen runs across it)
  const corners = (outer, inner) => (s > 0 ? [outer, inner, inner, outer] : [inner, outer, outer, inner]); // (+x+z, -x+z, -x-z, +x-z)
  const parts = [
    { name: `body${n}`, shape: "plate", w: W, d: H, t: T, corner: corners(3.4, 0.5), bevel: 0.8, pos: [cx, -T / 2, 0], mat: "duoFrame", half: n },
    { name: `glass${n}`, shape: "plate", w: W - 0.5, d: H - 0.6, t: 0.22, corner: corners(3.1, 0.2), bevel: 0.09, pos: [cx - s * 0.05, 0.02, 0], mat: "duoGlass", half: n },
    // the picture: u runs from his left (+x) to his right, v up the phone (+z)
    {
      name: `screen${n}`, shape: "plate", w: W - 1.4, d: H - 1.6, t: 0.04, corner: corners(2.5, 0.05), bevel: 0.0, pos: [cx - s * 0.5, 0.14, 0], mat: "duoScreen", half: n,
      // [u at its -x edge, v at -z, u at +x edge, v at +z]; both screens together span x ∈ ±(W - 1.2)
      uv: s > 0 ? [0.5 - 0.1 / (W - 1.2), 0, 0, 1] : [1, 0, 0.5 + 0.1 / (W - 1.2), 1],
    },
  ];
  if (s > 0) {
    // the cover screen on the back
    parts.push(
      { name: "coverGlass", shape: "plate", w: W - 0.6, d: H - 0.6, t: 0.22, corner: 3.1, bevel: 0.09, pos: [cx, -T - 0.02, 0], mat: "duoGlass", half: n },
      { name: "cover", shape: "plate", w: W - 2.0, d: H - 2.0, t: 0.04, corner: 2.4, bevel: 0, pos: [cx, -T - 0.14, 0], q: qAxis([0, 0, 1], Math.PI), mat: "duoCover", half: n, uv: [1, 0, 0, 1] },
    );
  } else {
    // pale back, the camera plateau near the top, two lenses in silver rings
    const py = -T - 0.12, pz = H / 2 - 6.2, px = -W + 9.2;
    parts.push(
      { name: "back", shape: "plate", w: W - 0.6, d: H - 0.6, t: 0.24, corner: 3.1, bevel: 0.1, pos: [cx, -T - 0.02, 0], mat: "duoBack", half: n },
      { name: "plateau", shape: "plate", w: 15.4, d: 8.2, t: 0.9, corner: 4.0, bevel: 0.4, pos: [px, py - 0.4, pz], mat: "duoBack", half: n },
      ...[-1, 1].flatMap((k, i) => [
        { name: `lensRing${i}`, shape: "plate", w: 6.2, d: 6.2, t: 0.7, corner: 3.1, bevel: 0.25, pos: [px + k * 3.55, py - 0.95, pz], mat: "duoLensRing", half: n },
        { name: `lens${i}`, shape: "plate", w: 4.9, d: 4.9, t: 0.5, corner: 2.45, bevel: 0.2, pos: [px + k * 3.55, py - 1.25, pz], mat: "duoLens", half: n },
      ]),
    );
  }
  return parts;
}

export const DUO_PARTS = [...half(1, "L"), ...half(-1, "R")].map((p) => {
  const q = { ...p, pos: p.pos.map((v) => v * mm) };
  for (const k of ["w", "d", "t", "bevel"]) q[k] *= mm;
  q.corner = Array.isArray(p.corner) ? p.corner.map((v) => v * mm) : p.corner * mm;
  return q;
});

// each half's turn about the hinge at fold φ (0 = open flat, π/2 = shut)
export const halfQ = (n, phi) => qAxis([0, 0, 1], n === "L" ? phi : -phi);

// where a hand holds a half (phone space at φ = 0, mm → m): the palm under
// the half's back at `along` of its width, fingers up the phone (+z), palm
// facing the phone (+y), thumb outward
export function grip(n, along = 0.86, z = 1.5) {
  const s = n === "L" ? 1 : -1, { W, T } = DUO;
  return { contact: [s * W * along * mm, -(T + 0.25) * mm, z * mm], F: [0, 0, 1], N: [0, 1, 0], Tdir: [s, 0, 0] };
}
