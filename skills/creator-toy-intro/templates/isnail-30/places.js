// Where the toy goes, where the camera looks and how the end card is laid out,
// worked out from the theme's anchors (themes/<theme>/layout.js), so the story
// plays on any platform page and in either orientation. film.json "story" may
// pin spots and camera keys, and film.json "cta" label positions, with its
// own tuned values. Places are UI px; camera targets are [UI x, UI y, height
// mm] or a tracker; CTA positions are metres from the CTA stage.
//
// frame: { portrait, aspect: width / height }; walls: { w, h2, h3 } in metres
// (the act 2 and act 3 cover walls once they stand up).
const VFOV = 30; // the camera's vertical field (deg), as in the film's "fov"

export function places(L, frame, walls) {
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
  const K = (t, target, dist, elev, az, fstop) => ({ t, target, dist, elev, az, fstop });
  const cx = C[0] + C[2] / 2, cb = C[1] + C[3];
  return frame.portrait ? portrait(L, frame, walls, { spots, K, A, P, R, cx, cb }) : landscape({ spots, K, A, P, R, cx, cb });
}

function landscape({ spots, K, A, P, R, cx, cb }) {
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
  // the end card: the slogan stands on the floor where the snail crawls, the
  // name and handle above; the toy points at the camera's last place
  const cta = {
    path: [-0.4, 0.47],
    pointAt: [0.03, 0.15 + 1.5 * Math.sin(0.157), 1.5 * Math.cos(0.157)],
    slogan: [{ em: 0.1, at: [-0.36, 0.064, -0.06], tilt: -0.012 }, { em: 0.1, at: [0.1, 0.07, -0.058], tilt: 0.02 }],
    sloganStep: [0.46, 0, 0],
    name: { em: 0.105, at: [-0.2, 0.322, -0.09], tilt: -0.03 },
    handle: { em: 0.062, at: [-0.16, 0.2, -0.085], tilt: 0.022 },
  };
  return { spots, camera, camera2, cta };
}

// Portrait: the same field of view sees far less width, so wide things are
// framed by their width and the end card stacks top to bottom.
function portrait(L, frame, walls, { spots, K, A, P, R, cx, cb }) {
  const t15 = Math.tan((VFOV / 2) * Math.PI / 180);
  const fitW = (w) => +((w / 2) / (t15 * frame.aspect)).toFixed(3); // distance that fits a width
  const fitH = (h) => +((h / 2) / t15).toFixed(3);
  const fit = (w, h, k = 1) => +(Math.max(fitW(w), fitH(h)) * k).toFixed(3);
  const page = fit(L.UI_W / 1000, L.UI_H / 1000 * 0.6, 1.02); // the page seen from high up
  const wall2 = fit(walls.w, walls.h2), wall3 = fit(walls.w, walls.h3);
  const H = 1.25; // close-ups of the toy step back a little: the frame is narrow
  const camera = [
    K(0.0, [L.UI_W / 2, L.UI_H * 0.48, 0], page, 64, 0, 8), // the whole page, like a screen
    K(1.0, [A.c[0] + 10, A.c[1] + 40, 20], 0.95, 40, -6, 5), // in on the picture
    K(1.9, [A.c[0] + 10, A.c[1] + 20, 50], 0.7, 22, -4, 4),
    K(2.4, "hero", 0.5 * H, 14, 6, 3.5),
    K(3.5, "hero", 0.4 * H, 12, 12, 3.2),
    K(4.0, "hero", 0.5 * H, 24, 4, 4),
    K(5.2, "hero", 0.6 * H, 32, -10, 4.5),
    K(6.0, "hero", 0.55 * H, 30, -12, 4.5),
    K(6.8, [cx, cb, walls.h2 * 500], wall2 * 1.04, 12, -18, 7), // the pinned cover stands up
    K(7.6, [cx, cb, walls.h2 * 500], wall2 * 0.98, 10, -12, 7),
    K(8.3, [cx + 14, cb + 38, 120], wall2 * 0.92, 13, -6, 7.5), // the count rises in front of it
    K(9.2, [cx + 19, cb + 58, 110], wall2 * 0.9, 15, 4, 7.5),
    K(9.8, [cx + 19, cb + 58, 110], wall2 * 0.9, 16, 8, 7.5),
    K(10.2, [cx + 19, cb + 58, 110], wall2 * 0.92, 16, 10, 7.5),
    K(10.9, [P[0] + P[2] * 0.6, R[1] + 32, 40], 1.6, 30, 8, 6), // the second post rises
    K(11.7, "wall", wall3 * 1.05, 20, 10, 6),
    K(12.8, "wall", wall3 * 1.0, 12, 12, 5.6),
    K(13.4, "hero", 0.55 * H, 10, 16, 4),
    K(14.2, "hero", 0.6 * H, 12, 20, 4),
    K(16.0, "hero", 0.66 * H, 14, 12, 4.5),
    K(17.7, "hero", 0.85 * H, 8, 6, 5),
    K(18.4, "hero", 0.66 * H, 12, 4, 4.5),
    K(19.2, "wall", wall3 * 1.0, 10, -10, 5.6),
    K(20.4, "wall", wall3 * 1.05, 4, -4, 8),
    K(21.8, "wallFront", wall3 * 1.08, 0, 0, 11), // squared up to the cover's own framing
    K(22.6, "wallFront", wall3 * 1.08, 0, 0, 11),
    K(24.0, "wallFront", wall3 * 1.12, 3, 0, 11),
    K(24.4, "wallFront", wall3 * 1.1, 4, 0, 11),
  ].map((k) => ({ ...k, dist: +k.dist.toFixed(3) }));
  // the end card stacks: name, handle, the slogan's lines, then the snail and
  // the toy along the floor; the text stays clear of the platform's top bar
  // and bottom captions
  const last = K(28.0, [0, 0.455, 0.02], 2.4, 6, 0, 10);
  const camera2 = [
    K(24.3833, [-0.2, 0.2, 0], 1.15, 9, 8, 9),
    K(25.2, [-0.2, 0.25, 0], 0.9, 8, 12, 7),
    K(25.8, [-0.17, 0.26, 0], 0.85, 8, 10, 7),
    K(26.9, [-0.05, 0.38, 0.01], 1.75, 7, 4, 9),
    last,
    { ...last, t: 29.0 },
    { ...last, t: 30.0 },
  ];
  const rad = (d) => d * Math.PI / 180;
  const pointAt = [
    last.target[0] + last.dist * Math.sin(rad(last.az)) * Math.cos(rad(last.elev)),
    last.target[1] + last.dist * Math.sin(rad(last.elev)),
    last.target[2] + last.dist * Math.cos(rad(last.az)) * Math.cos(rad(last.elev)),
  ];
  const cta = {
    path: [-0.2, 0.06],
    pointAt,
    slogan: [{ em: 0.065, at: [0, 0.555, -0.06], tilt: -0.012 }, { em: 0.065, at: [0, 0.455, -0.058], tilt: 0.02 }],
    sloganStep: [0, -0.1, 0],
    name: { em: 0.09, at: [0, 0.78, -0.09], tilt: -0.03 },
    handle: { em: 0.055, at: [0, 0.67, -0.085], tilt: 0.022 },
  };
  return { spots, camera, camera2, cta };
}
