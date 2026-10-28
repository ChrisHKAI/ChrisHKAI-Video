// 铁柱AGI's end-card prop: the Grok Bot blob from his covers, a ball with two
// upright eyes. His covers draw it black; on the film's black stage it is white
// with black eyes (the user, 2026-10-27: "改做白色…總之唔好黑色"), film.json
// cta.prop.colors { blob, blobEye }. It drops in and
// lands with a squash, opens its eyes, the toy falls onto it, and it rolls
// along the floor path while the slogan slaps down, the toy running on top
// like a circus ball. film.json cta.prop.module points here; the interface is
// the template's (templates/isnail-30/props/snail.js): makeProp(ctx) →
// { declare(add), sample(put, t), topAt(t), cues(add) }.
export function makeProp({ E, cta, path, lib }) {
  const { lerp, seg, smooth, easeIn, easeOut, easeInOut, backOut, TAU, v3, trs, qId, qEuler, mulT, HIDDEN } = { easeIn: (x) => x * x, ...lib };
  const R = 0.072; // the ball's radius (m): a little taller than the toy is wide
  const Z = 0.07; // in front of the slogan, as the snail is
  // its face, ball-local: the eyes upright ovals on the front (no painted shine:
  // the user read it as a third eye)
  const PARTS = [
    { name: "body", geo: { type: "ellipsoid", r: [R, R, R] }, pos: [0, 0, 0], mat: { type: "toy", key: "blob" } },
    ...[-1, 1].map((k) => ({ name: `eye${k}`, geo: { type: "ellipsoid", r: [0.0105, 0.019, 0.006] }, pos: [k * 0.022, 0.014, R * 0.955], rot: [-0.19, k * 0.3, 0], mat: { type: "toy", key: "blobEye" }, eye: true })),
  ];
  // it rolls a little further than the template's path: past the end of a 12-letter slogan
  const END = Math.max(path[1], 0.55);
  const ballX = (t) => lerp(path[0], END, easeInOut(seg(t, E.glide[0], E.glide[1])));
  // the ball: drops in spinning, lands with a squash, rolls (a bob on each turn)
  function ballT(t) {
    const x = ballX(t);
    if (t < E.logo[0]) return trs(cta(x, 0.9, Z), qId(), HIDDEN);
    if (t < E.logo[1]) {
      const d = seg(t, E.logo[0], E.logo[1]);
      return trs(cta(x, R + 0.75 * (1 - d * d), Z), qEuler(0, -TAU * (1 - easeOut(d)), 0));
    }
    const b = t - E.logo[1];
    const sq = 0.22 * Math.exp(-b * 8) * Math.cos(b * 30) + (t > E.ride ? 0.1 * Math.exp(-(t - E.ride) * 10) : 0);
    const rolling = t > E.glide[0] && t < E.glide[1];
    const bob = rolling ? 0.004 * Math.abs(Math.sin((x - path[0]) / R)) : 0;
    const lean = rolling ? -0.12 * Math.sin(Math.PI * seg(t, E.glide[0], E.glide[1])) : 0;
    return trs(cta(x, R * (1 - sq) + bob, Z), qEuler(0, 0, lean), [1 + sq * 0.6, 1 - sq, 1 + sq * 0.6]);
  }
  function partsAt(t) {
    const B = ballT(t);
    const open = backOut(seg(t, E.eyes[0], E.eyes[1]), 2.2);
    // a blink while it rolls, and the eyes look up at the toy when it lands
    const blink = t > 27.0 && t < 27.14 ? 0.12 : 1;
    const up = 0.004 * smooth(seg(t, E.ride - 0.2, E.ride));
    return PARTS.map((p) => {
      const q = p.rot ? qEuler(...p.rot) : qId();
      if (!p.eye) return mulT(B, trs(p.pos, q));
      const k = open * blink;
      return mulT(B, trs([p.pos[0], p.pos[1] + up, p.pos[2]], q, k < 0.01 ? HIDDEN : [1, k, 1]));
    });
  }
  return {
    declare(add) {
      PARTS.forEach((p) => add({ name: `blob_${p.name}`, geo: p.geo, mat: p.mat, anim: true }));
    },
    sample(put, t) {
      partsAt(t).forEach((tr, i) => put(`blob_${PARTS[i].name}`, tr));
    },
    // the toy's feet: the top of the ball (it stays upright: the ball rolls under it)
    topAt: (t) => v3.add(ballT(Math.max(t, E.logo[1])).p, [0, R * ballT(Math.max(t, E.logo[1])).s[1] + 0.001, 0]),
    cues(add) {
      add(E.logo[0], "whooshDown", { dur: E.logo[1] - E.logo[0] });
      add(E.logo[1], "land");
      add(E.eyes[0], "boing", { soft: true }); add(E.eyes[0] + 0.1, "boing", { soft: true });
      add(E.glide[0], "glide", { dur: E.glide[1] - E.glide[0] });
    },
  };
}
