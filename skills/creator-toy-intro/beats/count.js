// A number counts up in big 3D lettering on the beat's own stage and locks on
// a downbeat: a follower milestone, stars on a repo, plays, days. Written the
// way the platform writes it: thousands separators, decimals, a unit after it
// (万, K, +), and a label of any length under it, over a bar that fills with
// the count. The toy drops in beside it, points at it while it counts, jumps
// for joy as it locks (confetti), and leaps out of the frame at the end.
//
// film.json, in story.segments:
//   { "beat": "count", "bars": 3, "to": 10000, "label": "关注者" }
// "from" (0), "decimals" (0), "sep" (","), "unit" ("", e.g. "万", "+"),
// "color" of the digits (glowing white on the dark stage), "em" their size (m).
// It locks a bar before its end (the first downbeat after 2 s in a 2-bar beat).
export function makeBeat({ opts, len, bar, at, fov, aspect, glyph, signature, kit, math, quat, accent, pop, mulberry32 }) {
  const { seg, smooth, backOut, lerp } = math;
  const { trs, qId, qEuler, mulT, apply } = quat;
  if (typeof opts.to !== "number") throw new Error('beat "count" needs "to": the number it lands on');
  if (len < 2 * bar - 1e-6) throw new Error('beat "count" needs "bars": 2 or more');
  const FMT = { decimals: opts.decimals ?? 0, sep: opts.sep ?? ",", unit: opts.unit ?? "" };
  const FROM = opts.from ?? 0, TO = opts.to;
  const EM = opts.em ?? 0.07, LEM = EM * 0.42;
  const NUM = kit.readout({ fmt: (v) => kit.formatCount(v, FMT), from: FROM, to: TO, em: EM, adv: glyph.adv });
  const LABEL = [...String(opts.label ?? "")];
  const missing = [...new Set([...NUM.names.map((n) => n.key), ...LABEL.filter((c) => !/\s/.test(c)).map((c) => `heavy:${c}`)])].filter((k) => !glyph.has(k));
  if (missing.length) throw new Error(`beat "count": no lettering for ${missing.join(" ")} yet: run the glyph step (run.mjs glyphs)`);

  // when (seconds into the beat)
  const LAND = 0.55, RISE = [0.6, 0.95];
  const LOCK = Math.max(bar, len - bar);
  const COUNT = [Math.min(1.0, LOCK - 0.6), LOCK];
  const CHEER = [LOCK + 0.1, LOCK + 0.7];
  const LEAP = [len - 0.5, len];
  const valueAt = (g) => (g < COUNT[0] ? FROM : FROM + (TO - FROM) * (1 - Math.pow(1 - seg(g, COUNT[0], COUNT[1]), 3)));
  const shown = (g) => {
    const v = valueAt(g);
    return g >= LOCK ? TO : FMT.decimals ? v : Math.floor(v);
  };

  // where: the number centred over the stage, its label under it, the bar under that; the toy to its left
  const W = NUM.width(TO);
  const LW = LABEL.reduce((w, c) => w + (/\s/.test(c) ? 0.3 : glyph.adv(`heavy:${c}`)) * LEM, 0);
  const NUM_Y = 0.085;
  function groupAt(g) {
    const u = seg(g, RISE[0], RISE[1]);
    const punch = g > LOCK ? 0.12 * Math.exp(-(g - LOCK) * 9) * Math.cos((g - LOCK) * 30) : 0;
    return trs(at(0, NUM_Y * Math.min(1, backOut(u, 1.4)), 0), qEuler(-0.04, 0, 0), u > 0 ? Math.max(kit.HIDDEN, backOut(u, 1.6) * (1 + punch)) : kit.HIDDEN);
  }
  const numFrame = (grp) => mulT(grp, trs([W / 2, 0, 0]));
  const BAR_Y = -LEM * 1.7 - 0.012;
  const SPOT = at(-W / 2 - 0.1, 0, 0.06);
  const centre = (g) => apply(groupAt(Math.max(g, RISE[1])), [0, EM * 0.35, 0]);

  function pose(g) {
    const o = kit.stand(SPOT);
    o.yaw = 0.55;
    if (g < LAND) return kit.dropIn(o, g, 0.05, LAND, SPOT);
    if (g >= LEAP[0]) return kit.leapOut(o, g, LEAP[0], LEAP[1], SPOT);
    let q = kit.landSquash(g, LAND, 0.26) + kit.crouch(g, LEAP[0], 0.16);
    const k = smooth(seg(g, COUNT[0] - 0.3, COUNT[0])) * (1 - smooth(seg(g, LOCK - 0.1, LOCK + 0.1)));
    if (k > 0) { o.aimR = { world: centre(g), k, len: 1.1 }; o.pointR = k; o.head = [-0.1 * k, 0.15 * k, 0]; }
    if (g >= CHEER[0] && g < CHEER[1] + 0.1) q += kit.cheer(o, g, CHEER[0], CHEER[1]);
    if (LEAP[0] - (CHEER[1] + 0.2) > 0.6) signature(o, g, CHEER[1] + 0.2, seg(g, CHEER[1] + 0.2, CHEER[1] + 0.4) * (1 - seg(g, LEAP[0] - 0.4, LEAP[0] - 0.2)));
    kit.squash(o, q);
    return o;
  }

  const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
  const dist = ((W + 0.32) / 2 / Math.tan(hfov / 2)) * 1.15;
  const C = at(-0.04, NUM_Y * 0.8, 0);
  const camera = kit.cameraFrom([
    { t: 0, target: at(-0.04, NUM_Y, 0), dist: dist * 1.1, elev: 9, az: 4 },
    { t: COUNT[0], target: C, dist, elev: 8, az: 0 },
    { t: LOCK, target: C, dist: dist * 0.92, elev: 8, az: 2 },
    { t: len, target: C, dist: dist * 0.96, elev: 8, az: 0 },
  ], { fov, aspect, shakes: [[LOCK, 0.7]] });

  const CONF = 16, COLS = pop.confetti;
  const esc = (s) => s.replace(/[{}]/g, (m) => m + m);
  const final = esc(kit.formatCount(TO, FMT) + (LABEL.length ? ` ${LABEL.join("")}` : ""));
  const start = esc(kit.formatCount(FROM, FMT));
  return {
    declare(add) {
      add({ name: "floor", geo: { type: "plane", w: 6, h: 6 }, mat: { type: "stage" }, anim: true });
      for (const n of NUM.names) add({ name: n.name, geo: glyph.geo(n.key, EM, 0.012, 0.0012), mat: { type: "type", color: opts.color ?? "#F4F6F8", emit: 0.55 }, anim: true, step: true });
      LABEL.forEach((c, i) => { if (!/\s/.test(c)) add({ name: `label${i}`, geo: glyph.geo(`heavy:${c}`, LEM, 0.006, 0.0006), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true }); });
      add({ name: "bar", geo: { type: "roundBox", size: [W, 0.005, 0.005], radius: 0.0022 }, mat: { type: "glow", color: accent, strength: 3 }, anim: true });
      for (let i = 0; i < CONF; i++) add({ name: `conf${i}`, geo: { type: "box", size: [0.008, 0.0008, 0.006] }, mat: { type: "flake" }, anim: true, colorAnim: true });
    },
    sample(put, g, putColor) {
      put("floor", trs(at(0, 0, 0), qEuler(-Math.PI / 2, 0, 0)));
      const grp = groupAt(g);
      for (const [name, tr] of Object.entries(NUM.at(shown(g), numFrame(grp)))) put(name, tr);
      let x = -LW / 2;
      LABEL.forEach((c, i) => {
        if (!/\s/.test(c)) put(`label${i}`, mulT(grp, trs([x, -LEM * 1.5, 0.002])));
        x += (/\s/.test(c) ? 0.3 : glyph.adv(`heavy:${c}`)) * LEM;
      });
      const p = Math.max(0.002, g < COUNT[0] ? 0 : (shown(g) - FROM) / (TO - FROM || 1));
      put("bar", mulT(grp, trs([-W / 2 + (W * p) / 2, BAR_Y, 0], qId(), [p, 1, 1])));
      const r = mulberry32(700);
      for (let i = 0; i < CONF; i++) {
        const f = kit.confetti(i, g, LOCK, centre(LOCK), COLS, r);
        put(`conf${i}`, f.tr);
        putColor(`conf${i}`, f.color);
      }
    },
    pose,
    camera,
    light: (g) => ({ p: at(0.0, 0.2, 0.18), energy: 0.3 + (g >= LOCK ? 1.6 * Math.exp(-(g - LOCK) / 0.22) : 0), color: "#FFE6CC" }),
    cues(add) {
      add(0.05, "whooshDown", { dur: 0.45 });
      add(LAND, "pomf");
      add(RISE[0], "whooshUp", { dur: RISE[1] - RISE[0] });
      add(COUNT[0] + 0.05, "ticker", { dur: COUNT[1] - COUNT[0] - 0.1 });
      add(LOCK, "lock", { big: true });
      add(LOCK + 0.02, "sparkle");
      add(CHEER[0], "boing");
      add(CHEER[1] - 0.05, "pomf", { soft: true });
      add(LEAP[0], "boing", { long: true });
      add(LEAP[0] + 0.05, "whooshUp", { dur: 0.45 });
    },
    // what the viewer reads (engine/lib/pacing.py): the number and its label, from when they rise
    reads: [{ text: kit.formatCount(TO, FMT) + (LABEL.length ? ` ${LABEL.join("")}` : ""), at: [RISE[0], len] }],
    music: { groove: "light", chords: ["G", "Em", "C", "D"], hits: [LOCK] },
    storyboard: {
      part: {
        label: { "zh-Hant": "數字", "zh-Hans": "数字", en: "The number" },
        what: { "zh-Hant": `${final}：由 ${start} 跳上去，喺重拍鎖定，公仔跳起`, "zh-Hans": `${final}：从 ${start} 跳上去，在重拍锁定，公仔跳起`, en: `${final}: counts up from ${start} and locks on the downbeat; the toy jumps for joy` },
        uses: { "zh-Hant": "用家講嘅數字", "zh-Hans": "用户给的数字", en: "the user's number" },
        why: { "zh-Hant": "一個數字證明佢講嘅嘢", "zh-Hans": "一个数字证明说的是真的", en: "a number that proves the point" },
      },
      frames: [
        { at: (COUNT[0] + LOCK) / 2, title: { "zh-Hant": "跳數", "zh-Hans": "跳数", en: "Counting" }, what: { "zh-Hant": "公仔指住個數字", "zh-Hans": "公仔指着数字", en: "The toy points at it as it counts" } },
        { at: LOCK + 0.3, title: { "zh-Hant": "鎖定", "zh-Hans": "锁定", en: "Locked" }, what: { "zh-Hant": "數字落定，彩紙", "zh-Hans": "数字落定，彩纸", en: "It locks; confetti" } },
      ],
      hits: [{ at: LOCK, label: { "zh-Hant": "鎖定", "zh-Hans": "锁定", en: "lock" } }],
    },
  };
}
