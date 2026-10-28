// isnail's end-card prop: his 公众号 mark drops in spinning and becomes the
// shell of a snail (he is 蜗牛King), which crawls out along the slogan; the toy
// rides on the shell. It is the worked example of a prop: a film's own prop
// (film.json cta.prop.module, a file in the film's workspace) exports the same
// makeProp(ctx) → { declare(add), sample(put, t), topAt(t), cues(add) }.
//   ctx: { film, E (story events), cta(x, y, z) (CTA stage → world, m),
//          path (the end card's floor path [x0, x1], m), readFilmJSON, lib }
//   lib: lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3, trs, qId,
//        qEuler, apply, mulT, HIDDEN
// Its parts use the toy's shapes and materials ({ type: "toy", key: colour })
// or any other the world knows (a "curve" from build/logo.json here).
export function makeProp({ film, E, cta, path, readFilmJSON, lib }) {
  const { lerp, seg, smooth, easeOut, easeInOut, backOut, TAU, v3, trs, qId, qEuler, apply, mulT, HIDDEN } = lib;
  const LOGO = readFilmJSON("build/logo.json", null) ?? { rings: [], aspect: 1 };
  const SHELL_H = 0.19;
  const SHELL_D = 0.032;
  // the snail: x forward (it crawls to +x), y up, z to the camera
  const SN = (shape, name, a, b, c = null, extra = {}) => ({ name, shape, ...(shape === "ellipsoid" ? { r: a } : { size: a, radius: extra.radius }), pos: b, rot: c, mat: extra.mat || "body" });
  const SNAIL_PARTS = [
    SN("ellipsoid", "body", [0.13, 0.03, 0.05], [0, 0.03, 0]),
    SN("ellipsoid", "tail", [0.07, 0.017, 0.032], [-0.12, 0.017, 0]),
    SN("ellipsoid", "neck", [0.06, 0.036, 0.043], [0.085, 0.046, 0]),
    SN("ellipsoid", "head", [0.043, 0.046, 0.043], [0.125, 0.078, 0]),
    ...[-1, 1].flatMap((k) => [
      SN("roundBox", `stalk${k}`, [0.008, 0.05, 0.008], [0.135, 0.125, k * 0.017], [k * 0.25, 0, -0.22], { radius: 0.0038 }),
      SN("ellipsoid", `eye${k}`, [0.011, 0.011, 0.011], [0.146, 0.151, k * 0.023], null, { mat: "eye" }),
      SN("ellipsoid", `pupil${k}`, [0.0048, 0.0048, 0.003], [0.15, 0.152, k * 0.023 + 0.0095], null, { mat: "pupil" }),
    ]),
    { name: "smile", shape: "arc", radius: 0.007, tube: 0.0016, arc: Math.PI * 0.75, pos: [0.14, 0.07, 0.04], rot: [0, 0.35, -Math.PI / 2 - Math.PI * 0.375], mat: "pupil" },
  ];
  const snailX = (t) => lerp(path[0], path[1], easeInOut(seg(t, E.glide[0], E.glide[1])));
  function snailT(t) {
    const x = snailX(t);
    const grow = t < E.snail[0] ? 0 : backOut(seg(t, E.snail[0], E.snail[1]), 1.4);
    const crawl = t > E.glide[0] && t < E.glide[1] + 0.2 ? Math.sin((t - E.glide[0]) * TAU * 3) : 0;
    return trs(cta(x, 0, 0.07), qId(), grow < 0.01 ? HIDDEN : [grow * (1 + 0.05 * crawl), grow * (1 - 0.04 * crawl), grow]);
  }
  function snailPartsAt(t) {
    const sT = snailT(t);
    const eyes = backOut(seg(t, E.eyes[0], E.eyes[1]), 2.2);
    return SNAIL_PARTS.map((p) => {
      let pos = p.pos, s = [1, 1, 1];
      if (/stalk|eye|pupil/.test(p.name)) {
        const wob = 0.05 * Math.sin(t * 9 + (p.name.endsWith("-1") ? 0 : 1.3));
        pos = [pos[0], 0.1 + (pos[1] - 0.1) * Math.max(eyes, 1e-3), pos[2]];
        s = eyes < 0.01 ? [HIDDEN, HIDDEN, HIDDEN] : [1, 1, 1];
        return mulT(sT, trs(pos, p.rot ? qEuler(p.rot[0], p.rot[1], p.rot[2] + wob) : qEuler(0, 0, wob), s));
      }
      return mulT(sT, trs(pos, p.rot ? qEuler(...p.rot) : qId(), s));
    });
  }
  // the 公众号 mark: drops in spinning, then rides the snail as its shell
  const SHELL_REST = [-0.015, 0.042 + SHELL_H / 2, 0];
  function logoAt(t) {
    const sT = snailT(Math.max(t, E.snail[1]));
    const rest = apply(trs(sT.p, qId(), 1), SHELL_REST);
    if (t < E.logo[0]) return trs(v3.add(rest, [0, 0.9, 0]), qId(), HIDDEN);
    const d = seg(t, E.logo[0], E.logo[1]);
    const floorY = SHELL_H / 2;
    const lift = smooth(seg(t, E.snail[0], E.snail[1]));
    const base = [rest[0], lerp(floorY, rest[1], lift), rest[2]];
    if (t < E.logo[1]) {
      const p = v3.add(base, [0, 0.3 * (1 - d * d), 0]);
      return trs(p, qEuler(0, -TAU * 2 * (1 - easeOut(d)), 0));
    }
    const b = t - E.logo[1];
    const sq = 0.18 * Math.exp(-b * 9) * Math.cos(b * 32);
    const sway = t > E.glide[0] ? 0.05 * Math.sin((t - E.glide[0]) * TAU * 1.5) * (1 - seg(t, E.glide[1], E.glide[1] + 0.4)) : 0;
    const x = t >= E.snail[0] ? snailT(t).p[0] + SHELL_REST[0] : base[0];
    return trs([x, base[1] - SHELL_H / 2 * sq, base[2]], qEuler(0, 0, sway), [1 + sq * 0.5, 1 - sq, 1]);
  }
  // where his feet go on top of the shell (logo rings are in units of its height)
  const SHELL_TOP = (() => {
    let best = 0.5;
    for (const r of LOGO.rings) for (const [x, y] of r) if (Math.abs(x) < 0.12 && y > (best === 0.5 ? -1 : best)) best = y;
    return best;
  })();

  return {
    declare(add) {
      add({ name: "logo", geo: { type: "curve", rings: LOGO.rings.map((r) => r.map(([x, y]) => [+(x * SHELL_H).toFixed(6), +(y * SHELL_H).toFixed(6)])), depth: SHELL_D, bevel: 0.0022 }, mat: { type: "type", color: film.cta.prop.logoColor, emit: 0.25 }, anim: true });
      SNAIL_PARTS.forEach((p) => {
        const geo = p.shape === "roundBox" ? { type: "roundBox", size: p.size, radius: p.radius } : p.shape === "ellipsoid" ? { type: "ellipsoid", r: p.r } : { type: "arc", radius: p.radius, tube: p.tube, arc: p.arc };
        add({ name: `snail_${p.name}`, geo, mat: { type: "toy", key: { body: "snail", eye: "white", pupil: "black" }[p.mat] }, anim: true });
      });
    },
    sample(put, t) {
      put("logo", logoAt(t));
      snailPartsAt(t).forEach((tr, i) => put(`snail_${SNAIL_PARTS[i].name}`, tr));
    },
    topAt: (t) => apply(logoAt(t), [0.0, SHELL_TOP * SHELL_H + 0.002, 0]),
    cues(add) {
      add(E.logo[0], "whooshDown", { dur: E.logo[1] - E.logo[0] });
      add(E.logo[1], "land");
      add(E.snail[0], "squelch", { dur: E.snail[1] - E.snail[0] + 0.1 });
      add(E.eyes[0], "boing", { soft: true }); add(E.eyes[0] + 0.1, "boing", { soft: true });
      add(E.glide[0], "glide", { dur: E.glide[1] - E.glide[0] });
    },
  };
}
