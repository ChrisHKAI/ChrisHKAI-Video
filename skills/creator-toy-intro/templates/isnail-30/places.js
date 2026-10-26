// Where the toy goes and where the camera looks, worked out from the theme's
// anchors (themes/<theme>/layout.js), so the story plays on any platform page.
// film.json "story" may pin any of them with tuned values (isnail's do).
// Places are UI px; camera targets are [UI x, UI y, height mm] or a tracker.
export function places(L, portrait) {
  const A = L.AVATAR, P = L.PANELS.pinned, C = L.ANCHORS.pinnedCover, V = L.ANCHORS.count;
  const R = L.ANCHORS.second, RC = L.ANCHORS.secondCover;
  const r = Math.round;
  const spots = {
    pop: [A.c[0], r(A.c[1] + 0.433 * A.d)], // the toy puffs up just below the picture's centre
    land: [r(A.c[0] + 0.91 * A.d), r(A.c[1] + 0.418 * A.d)], // beside the picture
    hop1: [r(P[0] + 0.45 * P[2]), P[1] - 100], // above the pinned post
    post: [r(P[0] + 0.5 * P[2]), r(P[1] + 0.377 * P[3])], // on it: the stomp
    hop2: [r(P[0] + 0.767 * P[2]), r(P[1] + 0.755 * P[3])],
    views: [V[0] + 80, V[1] + 6], // beside the count
    front: [r(RC[0] + 0.4845 * RC[2]), RC[1] + RC[3] + 112], // in front of the second cover
    front2: [r(C[0] + 0.45 * C[2]), C[1] + C[3] + 52], // in front of the pinned cover
  };
  const cx = C[0] + C[2] / 2, cb = C[1] + C[3];
  // in a portrait frame the same vertical field sees far less width: wide shots
  // step back further than close-ups of the toy
  const far = portrait ? 2.0 : 1, near = portrait ? 1.3 : 1;
  const K = (t, target, dist, elev, az, fstop) => ({ t, target, dist: +(dist * (typeof target === "string" && target === "hero" ? near : far)).toFixed(3), elev, az, fstop });
  const camera = [
    K(0.0, [P[0] + 280, P[1] - 80, 0], 1.55, 44, -24, 8), // the whole page
    K(1.0, [A.c[0] + 10, A.c[1] + 20, 20], 0.75, 28, -10, 5), // in on the picture
    K(1.9, [A.c[0] + 10, A.c[1] + 10, 50], 0.55, 16, -4, 4),
    K(2.4, "hero", 0.5, 14, 6, 3.5),
    K(3.5, "hero", 0.38, 12, 14, 3.2),
    K(4.0, "hero", 0.5, 24, 4, 4),
    K(5.2, "hero", 0.6, 32, -14, 4.5),
    K(6.0, "hero", 0.52, 30, -18, 4.5),
    K(6.8, [cx, cb, 140], 1.0, 12, -34, 7), // the pinned cover stands up
    K(7.6, [cx, cb, 140], 0.88, 10, -26, 7),
    K(8.3, [cx + 14, cb + 38, 120], 0.95, 13, -12, 7.5), // the count rises
    K(9.2, [cx + 19, cb + 58, 110], 0.95, 15, 6, 7.5),
    K(9.8, [cx + 19, cb + 58, 110], 0.95, 16, 13, 7.5),
    K(10.2, [cx + 19, cb + 58, 110], 0.98, 16, 16, 7.5),
    K(10.9, [P[0] + 360, R[1] + 32, 40], 0.9, 30, 10, 6), // the second post rises
    K(11.7, "wall", 0.95, 22, 14, 6),
    K(12.8, "wall", 0.82, 12, 18, 5.6),
    K(13.4, "hero", 0.5, 10, 20, 4),
    K(14.2, "hero", 0.56, 12, 28, 4),
    K(16.0, "hero", 0.62, 14, 16, 4.5),
    K(17.7, "hero", 0.82, 8, 8, 5),
    K(18.4, "hero", 0.62, 12, 4, 4.5),
    K(19.2, "wall", 0.82, 10, -16, 5.6),
    K(20.4, "wall", 0.92, 4, -6, 8),
    K(21.8, "wallFront", 0.8, 0, 0, 11), // squared up to the cover's own framing
    K(22.6, "wallFront", 0.8, 0, 0, 11),
    K(24.0, "wallFront", 0.92, 3, 0, 11),
    K(24.4, "wallFront", 0.86, 4, 0, 11),
  ];
  // after the cut: the CTA stage (targets in metres from the stage)
  const camera2 = [
    K(24.3833, [-0.4, 0.16, 0], 1.05, 9, 8, 9),
    K(25.2, [-0.4, 0.21, 0], 0.78, 8, 12, 7),
    K(25.8, [-0.36, 0.21, 0], 0.72, 8, 10, 7),
    K(26.9, [-0.08, 0.15, 0], 1.2, 9, 4, 9),
    K(28.0, [0.07, 0.15, 0.02], 1.45, 9, 0, 10),
    K(29.0, [0.05, 0.16, 0.02], 1.45, 9, 0, 10),
    K(30.0, [0.05, 0.16, 0.02], 1.45, 9, 0, 10),
  ];
  return { spots, camera, camera2 };
}
