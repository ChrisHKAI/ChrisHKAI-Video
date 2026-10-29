// A ready-made end-card prop to fill in rather than write: a plinth the toy
// stands on, dropping in spinning on the cut and gliding along the line as it
// slaps down. film.json cta.prop:
//   { "kind": "plinth",
//     "shape": "round" | "square" | "star" (a star the toy rides, as lemo's stars),
//     "colors": { "plinth": "#F2C230", "plinthTop": "#FFFFFF" } (else the toy's white and black),
//     "logo": true (their mark from build/logo.json, cut by @shape, on its front) }
// A prop that says more about the creator (isnail's 公众号 mark becoming a snail's shell) is still
// written for them: references/props.md, and props/snail.js for how.
export function makeProp({ film, E, cta, path, readFilmJSON, lib }) {
  const { lerp, seg, easeOut, easeInOut, TAU, v3, trs, qId, qEuler, apply, HIDDEN } = lib;
  const P = film.cta.prop ?? {};
  const shape = P.shape ?? "round";
  const C = P.colors ?? {};
  const body = C.plinth ? "plinth" : "white", top = C.plinthTop ? "plinthTop" : C.plinth ? "white" : "black";
  const H = shape === "star" ? 0.035 : 0.075, R = shape === "star" ? 0.12 : 0.085;
  const LOGO = P.logo ? readFilmJSON("build/logo.json", null) : null;
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * TAU + Math.PI / 2, r = i % 2 ? R * 0.45 : R;
    return [+(Math.cos(a) * r).toFixed(5), +(Math.sin(a) * r).toFixed(5)];
  });
  const geoBody = shape === "square" ? { type: "roundBox", size: [2 * R, H, 2 * R], radius: 0.012 }
    : shape === "star" ? { type: "plate", outline: star, t: H, bevel: 0.006 }
    : { type: "prism", sides: 48, r: R, depth: H, bevel: 0.008 };
  const geoTop = shape === "square" ? { type: "roundBox", size: [2 * R - 0.012, 0.008, 2 * R - 0.012], radius: 0.004 }
    : shape === "star" ? null
    : { type: "prism", sides: 48, r: R - 0.008, depth: 0.008, bevel: 0.003 };
  // a prism stands along its depth axis: turned upright (its depth along y)
  const upright = shape === "round" ? qEuler(-Math.PI / 2, 0, 0) : qId();

  const x = (t) => lerp(path[0], path[1], easeInOut(seg(t, E.glide[0], E.glide[1])));
  function baseAt(t) {
    const rest = cta(x(t), 0, 0.07);
    if (t < E.logo[0]) return trs(v3.add(rest, [0, 0.8, 0]), qId(), HIDDEN);
    const d = seg(t, E.logo[0], E.logo[1]);
    if (t < E.logo[1]) return trs(v3.add(rest, [0, 0.45 * (1 - d * d), 0]), qEuler(0, -TAU * 1.5 * (1 - easeOut(d)), 0));
    const b = t - E.logo[1];
    const sq = 0.16 * Math.exp(-b * 9) * Math.cos(b * 30);
    const sway = t > E.glide[0] ? 0.04 * Math.sin((t - E.glide[0]) * TAU * 1.5) * (1 - seg(t, E.glide[1], E.glide[1] + 0.4)) : 0;
    return trs(rest, qEuler(0, 0, sway), [1 + sq * 0.5, 1 - sq, 1 + sq * 0.5]);
  }
  const part = (t, p, q = qId()) => { const b = baseAt(t); return trs(apply(b, p), q === qId() ? b.q : q, b.s); };

  return {
    declare(add) {
      add({ name: "plinth_body", geo: geoBody, mat: { type: "toy", key: body }, anim: true });
      if (geoTop) add({ name: "plinth_top", geo: geoTop, mat: { type: "toy", key: top }, anim: true });
      if (LOGO?.rings?.length) {
        const s = H * 0.8;
        add({ name: "plinth_logo", geo: { type: "curve", rings: LOGO.rings.map((r) => r.map(([u, v]) => [+(u * s).toFixed(6), +(v * s).toFixed(6)])), depth: 0.004, bevel: 0.0008 }, mat: { type: "toy", key: top }, anim: true });
      }
    },
    sample(put, t) {
      const b = baseAt(t);
      const turn = (q) => [q[0], q[1], q[2], q[3]];
      // the body's middle half its height up; a round one is a prism turned upright
      const mid = apply(b, [0, H / 2, 0]);
      put("plinth_body", trs(mid, shape === "round" ? qMulSafe(b.q, upright) : turn(b.q), b.s));
      if (geoTop) put("plinth_top", trs(apply(b, [0, H + 0.002, 0]), shape === "round" ? qMulSafe(b.q, upright) : turn(b.q), b.s));
      if (LOGO?.rings?.length) put("plinth_logo", trs(apply(b, [0, H / 2, (shape === "square" ? R : R * 0.98) + 0.002]), b.q, b.s));
    },
    topAt: (t) => apply(baseAt(t), [0, H + 0.004, 0]),
    cues(add) {
      add(E.logo[0], "whooshDown", { dur: E.logo[1] - E.logo[0] });
      add(E.logo[1], "land");
      add(E.glide[0], "glide", { dur: E.glide[1] - E.glide[0] });
    },
  };

  // (quaternion product, written out here so the prop needs nothing beyond lib)
  function qMulSafe(a, b2) {
    return [
      a[3] * b2[0] + a[0] * b2[3] + a[1] * b2[2] - a[2] * b2[1],
      a[3] * b2[1] - a[0] * b2[2] + a[1] * b2[3] + a[2] * b2[0],
      a[3] * b2[2] + a[0] * b2[1] - a[1] * b2[0] + a[2] * b2[3],
      a[3] * b2[3] - a[0] * b2[0] - a[1] * b2[1] - a[2] * b2[2],
    ];
  }
}
