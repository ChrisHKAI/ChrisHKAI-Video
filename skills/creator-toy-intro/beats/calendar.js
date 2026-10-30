// A span of time as an object, when there is no picture of it (an idea beat:
// "from July 10 to October 24 he reached 10,000"): a desk flip calendar rises
// showing the first day; its pages flip ever faster while a count beside it
// climbs; on a downbeat it stops at the last day, the count locks and a red
// stamp slams onto the page. The toy drops in, points at the calendar while
// the pages fly, jumps for joy, and leaps out at the end.
//
// film.json, in story.segments:
//   { "beat": "calendar", "bars": 4, "from": "2026-07-10", "to": "2026-10-24",
//     "count": { "to": 10000, "label": "关注者" }, "stamp": "万粉" }
// "count" (optional: as the count beat's, from 0) and "stamp" (optional,
// a word or two) are left out to show the days alone. Three bars at least;
// it locks a bar before its end.
export function makeBeat({ opts, len, bar, at, fov, aspect, glyph, kit, math, quat, pop, mulberry32 }) {
  const { seg, smooth, lerp, easeOut, easeIn, easeInOut, backOut, v3 } = math;
  const { trs, qId, qEuler, qMul, qAxis, mulT, apply } = quat;
  const day = (s) => { const [y, m, d] = String(s).split("-").map(Number); return Date.UTC(y, m - 1, d); };
  if (!opts.from || !opts.to) throw new Error('beat "calendar" needs "from" and "to" (dates, "2026-07-10")');
  if (len < 3 * bar - 1e-6) throw new Error('beat "calendar" needs "bars": 3 or more');
  const D0 = day(opts.from), DAYS = Math.round((day(opts.to) - D0) / 864e5);
  if (!(DAYS > 0)) throw new Error(`beat "calendar": "to" (${opts.to}) is not after "from" (${opts.from})`);
  const dateOf = (n) => { const d = new Date(D0 + Math.round(n) * 864e5); return { m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
  const hidden = (p) => trs(p, qId(), kit.HIDDEN);

  // when (seconds into the beat)
  const LOCK = len - bar;
  const DROP = [0.05, 0.5], RISE = [0.5, 1.1], LABEL_IN = 1.5, FLIP = [1.5, LOCK - 0.25], CHEER = [LOCK + 0.15, LOCK + 0.75], LEAP = [len - 0.5, len];
  const flipS = (g) => easeInOut(seg(g, FLIP[0], FLIP[1]));
  const nAt = (g) => (g >= LOCK - 0.25 ? DAYS : flipS(g) * DAYS);

  // the calendar: a base, the day's page, the red month band, two rings (calendar-local m)
  const CAL = { w: 0.16, h: 0.19, d: 0.035, base: 0.025, band: 0.05 };
  const FRONT = CAL.d / 2 + 0.0004;
  const M_EM = 0.034, D_EM = 0.085;
  const MONTH = kit.readout({ fmt: (n) => `${dateOf(n).m}月`, from: 0, to: DAYS, em: M_EM, adv: glyph.adv, steps: DAYS });
  const DAY = kit.readout({ fmt: (n) => String(dateOf(n).d), from: 0, to: DAYS, em: D_EM, adv: glyph.adv, steps: DAYS });
  function calAt(g) {
    if (g < RISE[0]) return hidden(at(0, -0.3, 0));
    const u = seg(g, RISE[0], RISE[1]), hit = g - LOCK;
    const jolt = hit > 0 ? 0.04 * Math.exp(-hit * 10) * Math.cos(hit * 35) : 0;
    return trs(at(0, lerp(-0.25, 0, Math.min(1, backOut(u, 1.4))), 0), qEuler(0, -0.12, 0), [1 + jolt, 1 - jolt, 1 + jolt]);
  }
  // the pages that flip away, hinged under the band, over the top to the back
  const FLIPS = 2;
  function flipAt(i, g, cal) {
    const top = CAL.base + CAL.h - CAL.band;
    const off = mulT(cal, trs([0, top, 0], qId(), kit.HIDDEN));
    if (g < FLIP[0] || g >= FLIP[1]) return off;
    const n = nAt(g), rate = (nAt(g + 0.01) - n) / 0.01;
    if (i > 0 && rate < 6) return off;
    const p = (((n + i / FLIPS) % 1) + 1) % 1;
    if (p > 0.62) return off;
    return mulT(cal, mulT(trs([0, top, FRONT + 0.0015], qAxis([1, 0, 0], -Math.PI * easeOut(Math.min(1, p * 1.6)))), trs([0, -(CAL.h - CAL.band) / 2, 0])));
  }
  // the stamp slammed onto the page on the lock
  const STAMP = [...String(opts.stamp ?? "")].filter((c) => !/\s/.test(c)), S_EM = 0.036;
  const SW = STAMP.reduce((w, c) => w + glyph.adv(`heavy:${c}`) * S_EM, 0);
  function stampAt(g, cal) {
    const home = mulT(cal, trs([0.004, CAL.base + 0.03, FRONT + 0.004], qEuler(0, 0, -0.12), 0.85));
    if (g < LOCK - 0.25) return trs(home.p, home.q, kit.HIDDEN);
    if (g < LOCK) {
      const u = easeIn(seg(g, LOCK - 0.25, LOCK));
      return trs(v3.lerp(v3.add(home.p, [0.05, 0.2, 0.3]), home.p, u), qMul(home.q, qEuler(0.6 * (1 - u), 0, 0.5 * (1 - u))), home.s.map((v) => v * lerp(2.0, 1, u)));
    }
    const b = g - LOCK, sq = 0.22 * Math.exp(-b * 14) * Math.cos(b * 40);
    return trs(home.p, home.q, [home.s[0] * (1 + sq), home.s[1] * (1 - sq), home.s[2]]);
  }
  // the count beside it (optional)
  const C = opts.count ?? null;
  const FMT = C ? { decimals: C.decimals ?? 0, sep: C.sep ?? ",", unit: C.unit ?? "" } : null;
  const C_EM = 0.04, L_EM = C_EM * 0.45;
  const NUM = C ? kit.readout({ fmt: (v) => kit.formatCount(v, FMT), from: C.from ?? 0, to: C.to, em: C_EM, adv: glyph.adv }) : null;
  const LABEL = C ? [...String(C.label ?? "")].filter((c) => !/\s/.test(c)) : [];
  const countAt = (g) => (g >= LOCK ? C.to : g < FLIP[0] ? (C.from ?? 0) : Math.floor((C.from ?? 0) + (C.to - (C.from ?? 0)) * Math.pow(flipS(g), 1.8)));
  function countGroup(g) {
    const u = seg(g, LABEL_IN - 0.2, LABEL_IN + 0.2);
    const punch = g > LOCK ? 0.09 * Math.exp(-(g - LOCK) * 9) * Math.cos((g - LOCK) * 30) : 0;
    return trs(at(0.205, 0.115, 0.03), qEuler(-0.05, -0.18, 0), u > 0 ? Math.max(kit.HIDDEN, backOut(u, 1.6) * (1 + punch)) : kit.HIDDEN);
  }
  const keys = [...MONTH.names, ...DAY.names, ...(NUM ? NUM.names : [])].map((n) => n.key).concat([...STAMP, ...LABEL].map((c) => `heavy:${c}`));
  const missing = [...new Set(keys)].filter((k) => !glyph.has(k));
  if (missing.length) throw new Error(`beat "calendar": no lettering for ${missing.join(" ")} yet: run the glyph step (run.mjs glyphs)`);

  // the toy, to the calendar's left, turning to it and pointing while the pages fly
  const SPOT = at(-0.175, 0, 0.05);
  function pose(g) {
    const o = kit.stand(SPOT);
    o.pop = 1;
    if (g < DROP[1]) return kit.dropIn(o, g, DROP[0], DROP[1], SPOT);
    if (g >= LEAP[0]) return kit.leapOut(o, g, LEAP[0], LEAP[1], SPOT);
    let q = kit.landSquash(g, DROP[1], 0.26) + kit.crouch(g, LEAP[0], 0.16);
    o.yaw = lerp(0, 0.75, smooth(seg(g, RISE[0], RISE[0] + 0.4)));
    const k = smooth(seg(g, FLIP[0] - 0.3, FLIP[0])) * (1 - smooth(seg(g, LOCK - 0.1, LOCK + 0.1)));
    if (k > 0) { o.aimR = { world: apply(calAt(g), [0, CAL.base + 0.1, FRONT]), k, len: 1.1 }; o.pointR = k; o.head = [-0.1 * k, 0.15 * k, 0]; }
    if (g >= CHEER[0] && g < CHEER[1] + 0.1) q += kit.cheer(o, g, CHEER[0], CHEER[1]);
    kit.squash(o, q);
    return o;
  }

  const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
  const D = (0.3 / Math.tan(hfov / 2)) * 1.1;
  const camera = kit.cameraFrom([
    { t: 0, target: at(-0.02, 0.12, 0), dist: D * 1.17, elev: 9, az: 0, fstop: 6 },
    { t: FLIP[0], target: at(0.02, 0.12, 0), dist: D * 1.09, elev: 8, az: 0, fstop: 6 },
    { t: LOCK - 0.1, target: at(0.03, 0.12, 0), dist: D, elev: 8, az: 2, fstop: 6 },
    { t: CHEER[1], target: at(0.02, 0.12, 0), dist: D * 1.06, elev: 8, az: 0, fstop: 6 },
    { t: len, target: at(0, 0.14, 0), dist: D * 1.11, elev: 9, az: 0, fstop: 6 },
  ], { fov, aspect, shakes: [[LOCK, 0.7]] });

  const CONF = 16, COLS = pop.confetti;
  const date = (s) => { const { m, d } = dateOf(Math.round((day(s) - D0) / 864e5)); return `${m}月${d}日`; };
  const span = `${date(opts.from)} → ${date(opts.to)}`;
  const box = (name, size, color, emit = 0) => ({ name, geo: { type: "roundBox", size, radius: 0.003 }, mat: { type: "type", color, emit }, anim: true });
  return {
    declare(add) {
      add({ name: "floor", geo: { type: "plane", w: 6, h: 6 }, mat: { type: "stage" }, anim: true });
      add({ ...box("base", [CAL.w + 0.02, CAL.base, CAL.d + 0.05], "#2B2E35"), geo: { type: "roundBox", size: [CAL.w + 0.02, CAL.base, CAL.d + 0.05], radius: 0.004 } });
      add({ name: "page", geo: { type: "roundBox", size: [CAL.w, CAL.h - CAL.band, CAL.d], radius: 0.003 }, mat: { type: "paper", color: "#F7F4EE" }, anim: true });
      add(box("band", [CAL.w + 0.001, CAL.band, CAL.d + 0.001], "#D93A2B", 0.06));
      [-1, 1].forEach((k) => add({ ...box(`ring${k}`, [0.012, 0.022, 0.012], "#C9CDD3"), geo: { type: "roundBox", size: [0.012, 0.022, 0.012], radius: 0.004 } }));
      for (const n of MONTH.names) add({ name: `m_${n.name}`, geo: glyph.geo(n.key, M_EM, 0.002, 0.0003), mat: { type: "type", color: "#FFF6E8", emit: 0.25 }, anim: true, step: true });
      for (const n of DAY.names) add({ name: `d_${n.name}`, geo: glyph.geo(n.key, D_EM, 0.004, 0.0005), mat: { type: "type", color: "#1B1C20", emit: 0 }, anim: true, step: true });
      for (let i = 0; i < FLIPS; i++) add({ name: `flip${i}`, geo: { type: "roundBox", size: [CAL.w - 0.002, CAL.h - CAL.band, 0.0008], radius: 0.001 }, mat: { type: "paper", color: "#F7F4EE" }, anim: true });
      if (STAMP.length) {
        add({ ...box("stamp", [SW + 0.03, 0.052, 0.006], "#D93A2B", 0.12), geo: { type: "roundBox", size: [SW + 0.03, 0.052, 0.006], radius: 0.006 } });
        STAMP.forEach((c, i) => add({ name: `s${i}`, geo: glyph.geo(`heavy:${c}`, S_EM, 0.002, 0.0003), mat: { type: "type", color: "#FFF6E8", emit: 0.25 }, anim: true }));
      }
      if (NUM) {
        for (const n of NUM.names) add({ name: `c_${n.name}`, geo: glyph.geo(n.key, C_EM, 0.01, 0.001), mat: { type: "type", color: "#F4F6F8", emit: 0.55 }, anim: true, step: true });
        LABEL.forEach((c, i) => add({ name: `cl${i}`, geo: glyph.geo(`heavy:${c}`, L_EM, 0.005, 0.0005), mat: { type: "type", color: "#AEB4BA", emit: 0.35 }, anim: true }));
      }
      for (let i = 0; i < CONF; i++) add({ name: `conf${i}`, geo: { type: "box", size: [0.008, 0.0008, 0.006] }, mat: { type: "flake" }, anim: true, colorAnim: true });
    },
    sample(put, g, putColor) {
      put("floor", trs(at(0, 0, 0), qEuler(-Math.PI / 2, 0, 0)));
      const on = g >= 0 && g < len, gg = on ? g : -1;
      const cal = calAt(gg);
      put("base", mulT(cal, trs([0, CAL.base / 2, 0])));
      put("page", mulT(cal, trs([0, CAL.base + (CAL.h - CAL.band) / 2, 0])));
      put("band", mulT(cal, trs([0, CAL.base + CAL.h - CAL.band / 2, 0])));
      [-1, 1].forEach((k) => put(`ring${k}`, mulT(cal, trs([k * 0.045, CAL.base + CAL.h + 0.006, 0]))));
      const n = nAt(gg);
      const yb = CAL.base + CAL.h - CAL.band / 2 - 0.36 * M_EM;
      for (const [name, tr] of Object.entries(MONTH.at(n, mulT(cal, trs([MONTH.width(n) / 2, yb, FRONT + 0.0012]))))) put(`m_${name}`, tr);
      for (const [name, tr] of Object.entries(DAY.at(n, mulT(cal, trs([DAY.width(n) / 2, CAL.base + 0.06, FRONT + 0.0006]))))) put(`d_${name}`, tr);
      for (let i = 0; i < FLIPS; i++) put(`flip${i}`, flipAt(i, gg, cal));
      if (STAMP.length) {
        const st = stampAt(gg, cal);
        put("stamp", st);
        let x = -SW / 2;
        STAMP.forEach((c, i) => { put(`s${i}`, mulT(st, trs([x, -0.36 * S_EM, 0.0032]))); x += glyph.adv(`heavy:${c}`) * S_EM; });
      }
      if (NUM) {
        const grp = countGroup(gg);
        const v = countAt(gg);
        for (const [name, tr] of Object.entries(NUM.at(v, mulT(grp, trs([NUM.width(C.to) / 2, 0, 0]))))) put(`c_${name}`, tr);
        const LW = LABEL.reduce((w, c) => w + glyph.adv(`heavy:${c}`) * L_EM, 0);
        let x = -LW / 2;
        LABEL.forEach((c, i) => { put(`cl${i}`, mulT(grp, trs([x, -L_EM * 1.6, 0.002]))); x += glyph.adv(`heavy:${c}`) * L_EM; });
      }
      const r = mulberry32(900);
      for (let i = 0; i < CONF; i++) {
        const f = kit.confetti(i, gg, LOCK, at(0, 0.11, 0.05), COLS, r);
        put(`conf${i}`, f.tr);
        putColor(`conf${i}`, f.color);
      }
    },
    pose,
    camera,
    light: (g) => ({ p: at(0.05, 0.2, 0.18), energy: 0.25 + (g >= LOCK ? 1.6 * Math.exp(-(g - LOCK) / 0.22) : 0), color: "#FFE6CC" }),
    cues(add) {
      add(DROP[0], "whooshDown", { dur: 0.45 });
      add(DROP[1], "pomf");
      add(RISE[0], "stand", { dur: RISE[1] - RISE[0] });
      add(FLIP[0], "ticker", { dur: FLIP[1] - FLIP[0] });
      add(LOCK, "lock", { big: true });
      add(LOCK + 0.02, "sparkle");
      if (STAMP.length) add(LOCK + 0.04, "slam");
      add(CHEER[0], "boing");
      add(CHEER[1] - 0.05, "pomf", { soft: true });
      add(LEAP[0], "boing", { long: true });
      add(LEAP[0] + 0.05, "whooshUp", { dur: 0.45 });
    },
    // what the viewer reads (engine/lib/pacing.py): the last day, the count and the stamp, from when the label comes in
    reads: [{ text: [date(opts.to), C ? kit.formatCount(C.to, FMT) + (LABEL.length ? ` ${LABEL.join("")}` : "") : "", STAMP.join("")].filter(Boolean).join(" "), at: [LABEL_IN, len] }],
    music: { groove: "light", chords: ["Em", "C", "G", "D"], hits: [LOCK] },
    storyboard: {
      part: {
        label: { "zh-Hant": "日子", "zh-Hans": "日子", en: "The days" },
        what: { "zh-Hant": `月曆由 ${span} 越翻越快${C ? "，數字跟住升" : ""}，喺重拍停低${STAMP.length ? `，蓋上「${STAMP.join("")}」` : ""}`, "zh-Hans": `日历从 ${span} 越翻越快${C ? "，数字跟着升" : ""}，在重拍停下${STAMP.length ? `，盖上「${STAMP.join("")}」` : ""}`, en: `A flip calendar runs ${span}, faster and faster${C ? ", the count climbing beside it" : ""}, and stops on the downbeat${STAMP.length ? ` under a stamp: ${STAMP.join("")}` : ""}` },
        uses: { "zh-Hant": "冇素材，由 idea 嚟", "zh-Hans": "没有素材，由 idea 来", en: "no picture: from the idea itself" },
        why: { "zh-Hant": "用咗幾耐：一段日子變成睇得見嘅嘢", "zh-Hans": "花了多久：一段日子变成看得见的东西", en: "how long it took, made something you can see" },
      },
      frames: [
        { at: (FLIP[0] + FLIP[1]) / 2, title: { "zh-Hant": "翻日曆", "zh-Hans": "翻日历", en: "The pages fly" }, what: { "zh-Hant": "公仔指住月曆", "zh-Hans": "公仔指着日历", en: "The toy points at the calendar" } },
        { at: LOCK + 0.3, title: { "zh-Hant": "停喺嗰日", "zh-Hans": "停在那天", en: "The day" }, what: { "zh-Hant": "月曆停低，蓋印", "zh-Hans": "日历停下，盖章", en: "It stops; the stamp" } },
      ],
      hits: [{ at: LOCK, label: { "zh-Hant": "停", "zh-Hans": "停", en: "stop" } }],
    },
  };
}
