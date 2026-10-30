// A line said big: its letters rise out of the floor of the beat's own stage
// one by one, in the end card's heavy face, the last one on a downbeat; the
// toy drops in beside the line, watches it rise, jumps for joy as it locks,
// does its own move and leaps out of the frame at the end. For a point in the
// user's own words, or a phrase lifted from a post (references/beats.md).
//
// film.json, in story.segments:
//   { "beat": "phrase", "bars": 3, "text": "马斯克得不到的男人", "color": "#F2C14E" }
// "text" is the line (the glyph step cuts its characters); "color" the
// letters' (default the end card's gold); "em" their size in metres (0.062).
export function makeBeat({ opts, len, bar, beat, at, fov, aspect, glyph, signature, kit, math, quat }) {
  const { seg, backOut } = math;
  const { trs, qId, qEuler } = quat;
  const TEXT = [...String(opts.text ?? "")];
  if (!TEXT.length) throw new Error('beat "phrase" needs "text": the line to say');
  const EM = opts.em ?? 0.062;
  const COLOR = opts.color ?? "#F2C14E";
  const blank = (c) => /\s/.test(c);
  const missing = TEXT.filter((c) => !blank(c) && !glyph.has(`heavy:${c}`));
  if (missing.length) throw new Error(`beat "phrase": no lettering for ${missing.join("")} yet: run the glyph step (run.mjs glyphs)`);

  // the line, centred on the stage; its glyphs' lowest point on the floor
  const advs = TEXT.map((c) => (blank(c) ? 0.3 : glyph.adv(`heavy:${c}`)) * EM);
  const W = advs.reduce((a, b) => a + b, 0);
  const X = advs.map((_, i) => -W / 2 + advs.slice(0, i).reduce((a, b) => a + b, 0));
  const BASE = 0.12 * EM;

  // when (seconds into the beat): the toy lands at 0.55; the letters on 8ths
  // (16ths for Latin), the last on the first downbeat they reach; the leap at the end
  const LAND = 0.55, RISE = 0.22;
  const steps = TEXT.map((c) => (/[\x00-\x7f]/.test(c) ? beat / 4 : beat / 2));
  const span = steps.slice(0, -1).reduce((a, b) => a + b, 0);
  let LOCK = bar;
  while (LOCK - span < LAND + 0.2) LOCK += bar;
  const LEAP = [len - 0.5, len];
  if (LOCK > LEAP[0] - 0.8) throw new Error(`beat "phrase": ${TEXT.length} letters need "bars": ${Math.ceil((LOCK + 1.3) / bar)} or more`);
  const T0 = steps.map((_, i) => LOCK - span + steps.slice(0, i).reduce((a, b) => a + b, 0));
  const letters = TEXT.map((c, i) => ({ c, i })).filter(({ c }) => !blank(c));
  const letterAt = (i, g) => {
    const u = seg(g, T0[i], T0[i] + RISE);
    return trs(at(X[i], BASE - EM * 1.2 * (1 - backOut(u, 1.6)), 0), qId(), u > 0 ? 1 : kit.HIDDEN);
  };

  // the toy, beside the line's end, turned a little towards it
  const SPOT = at(W / 2 + 0.07, 0, 0.05);
  function pose(g) {
    const o = kit.stand(SPOT);
    o.yaw = -0.5;
    if (g < LAND) return kit.dropIn(o, g, 0.05, LAND, SPOT);
    if (g >= LEAP[0]) return kit.leapOut(o, g, LEAP[0], LEAP[1], SPOT);
    let q = kit.landSquash(g, LAND, 0.28) + kit.crouch(g, LEAP[0], 0.16);
    o.head = [0.12, 0, 0];
    if (g >= LOCK + 0.05 && g < LOCK + 0.75) q += kit.cheer(o, g, LOCK + 0.05, LOCK + 0.65);
    if (LEAP[0] - (LOCK + 0.9) > 0.6) signature(o, g, LOCK + 0.9, seg(g, LOCK + 0.9, LOCK + 1.1) * (1 - seg(g, LEAP[0] - 0.4, LEAP[0] - 0.2)));
    kit.squash(o, q);
    return o;
  }

  // the camera frames the line and the toy, closing in a little as the line locks
  const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
  const dist = ((W + 0.25) / 2 / Math.tan(hfov / 2)) * 1.1;
  const C = at(0.04, EM * 0.9, 0);
  const camera = kit.cameraFrom([
    { t: 0, target: at(0.04, EM * 1.1, 0), dist: dist * 1.12, elev: 9, az: 4 },
    { t: LOCK, target: C, dist, elev: 7, az: 0 },
    { t: len, target: C, dist: dist * 0.96, elev: 7, az: -3 },
  ], { fov, aspect, shakes: [[LOCK, 0.6]] });

  const esc = (s) => s.replace(/[{}]/g, (m) => m + m); // the storyboard page fills {names}
  const line = esc(TEXT.join(""));
  return {
    declare(add) {
      add({ name: "floor", geo: { type: "plane", w: 6, h: 6 }, mat: { type: "stage" }, anim: true });
      for (const { c, i } of letters) add({ name: `l${i}`, geo: glyph.geo(`heavy:${c}`, EM, 0.014, 0.0014), mat: { type: "type", color: COLOR, emit: 0.3 }, anim: true });
    },
    sample(put, g) {
      put("floor", trs(at(0, 0, 0), qEuler(-Math.PI / 2, 0, 0)));
      for (const { i } of letters) put(`l${i}`, letterAt(i, g));
    },
    pose,
    camera,
    light: (g) => ({ p: at(0, 0.16, 0.18), energy: 0.3 + (g >= LOCK ? 1.4 * Math.exp(-(g - LOCK) / 0.25) : 0), color: "#FFF1E6" }),
    cues(add) {
      add(0.05, "whooshDown", { dur: 0.45 });
      add(LAND, "pomf");
      const NOTES = ["G4", "A4", "B4", "D5", "E5", "G5", "A5", "B5", "D6", "E6", "G6", "A6"];
      letters.forEach(({ i }, k) => add(T0[i], "push", { note: NOTES[k % NOTES.length] }));
      add(LOCK, "lock", { big: true });
      add(LOCK + 0.02, "sparkle");
      add(LOCK + 0.05, "boing");
      add(LOCK + 0.6, "pomf", { soft: true });
      add(LEAP[0], "boing", { long: true });
      add(LEAP[0] + 0.05, "whooshUp", { dur: 0.45 });
    },
    // what the viewer reads (engine/lib/pacing.py checks it stays long enough): the line, from its first letter
    reads: [{ text: TEXT.join(""), at: [T0[0], len] }],
    music: { groove: "light", chords: ["Em", "C", "G", "D"], hits: [LOCK] },
    storyboard: {
      part: {
        label: { "zh-Hant": "一句話", "zh-Hans": "一句话", en: "The line" },
        what: { "zh-Hant": `「${line}」逐個字由地下彈出，最後一個字落喺重拍，公仔跳起`, "zh-Hans": `「${line}」逐个字从地下弹出，最后一个字落在重拍，公仔跳起`, en: `"${line}" rises a letter at a time; the last lands on the downbeat and the toy jumps for joy` },
        uses: { "zh-Hant": "用家嘅原話", "zh-Hans": "用户的原话", en: "the user's own words" },
        why: { "zh-Hant": "佢自己一句話，大到記得住", "zh-Hans": "创作者自己的一句话，大到记得住", en: "their own words, big enough to remember" },
      },
      frames: [
        { at: LAND + 0.25, title: { "zh-Hant": "公仔落地", "zh-Hans": "公仔落地", en: "The toy lands" }, what: { "zh-Hant": "公仔由上面跌落句說話隔籬", "zh-Hans": "公仔从上面掉到这句话旁边", en: "The toy drops in beside the line" } },
        { at: LOCK + 0.3, title: { "zh-Hant": "成句出齊", "zh-Hans": "整句出齐", en: "The whole line" }, what: { "zh-Hant": "最後一個字落定，公仔跳起", "zh-Hans": "最后一个字落定，公仔跳起", en: "The last letter locks; the toy jumps for joy" } },
      ],
      hits: [{ at: LOCK, label: { "zh-Hant": "成句", "zh-Hans": "成句", en: "line" } }],
    },
  };
}
