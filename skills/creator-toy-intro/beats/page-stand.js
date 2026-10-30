// An opening (Kin's film): the creator's page fills the frame flat like a
// screen; it turns and backs off while its columns part into floating slabs;
// their own profile picture bulges and, on the 2.0 s downbeat, the toy puffs
// out of it and hops to the floor; its own move; it leaps out of the frame.
// The other opening is the story's own ({ "story": "opening" }: the page lies
// flat and the picture peels off like a sticker).
//
// film.json, first in story.segments:
//   { "beat": "page-stand", "bars": 2, "turn": "right" }
// "turn": "right" (the page turns right and backs off to the left, as in the
// cgnot996 film) or "left" (as in Kin's). Two bars at least; the page is the
// theme's own (assets/ui.png) and the picture the creator's (assets/avatar.png).
export function makeBeat({ opts, len, at, fov, aspect, page, signature, kit, math, quat }) {
  const { seg, smooth, lerp, easeIn, easeInOut, backOut, v3 } = math;
  const { trs, qId, qEuler, qMul, qAxis, qRot, mulT, apply } = quat;
  if (len < 4 - 1e-6) throw new Error('beat "page-stand" needs "bars": 2 or more (the toy pops on the 2.0 s downbeat)');
  const K = opts.turn === "left" ? -1 : 1;

  // when (seconds into the beat)
  const TURN = [0.45, 1.85], SPLIT = [0.55, 1.6], BULGE = [1.55, 2.0], POP = 2.0, LAND = 2.55;
  const LEAP = [len - 0.5, len], SIG = [2.85, Math.min(3.75, len - 0.75)];

  // the page: 0.5 mm a UI px, its bottom just above the floor; it turns and backs off
  const PX = 0.0005;
  const ui = (u, v) => [(u - page.w / 2) * PX, (page.h / 2 - v) * PX];
  const PAGE_C = (page.h / 2) * PX + 0.004;
  const PAGE0 = [0, PAGE_C, 0], PAGE1 = [-0.16 * K, PAGE_C, -0.12];
  const YAW = (62 * Math.PI) / 180;
  const UPRIGHT = qAxis([1, 0, 0], Math.PI / 2);
  function pageAt(g) {
    const s = easeInOut(seg(g, TURN[0], TURN[1]));
    const over = g > TURN[1] - 0.3 ? 0.05 * Math.sin(Math.PI * seg(g, TURN[1] - 0.3, TURN[1] + 0.5)) : 0;
    return trs(at(...v3.lerp(PAGE0, PAGE1, s)), qAxis([0, 1, 0], K * (YAW * s + over * 0.3)));
  }
  const DEPTH = { header: 0.012, banner: 0.006, info: 0.02, tabs: 0.01, pinned: 0.015, retro: 0.008 };
  const NAMES = Object.keys(page.panels);
  function panelAt(name, g) {
    const [x, y, w, h] = page.panels[name];
    const c = ui(x + w / 2, y + h / 2);
    const s = easeInOut(seg(g, SPLIT[0], SPLIT[1]));
    let local;
    if (name === "nav" || name === "side") { // the side columns fly back into the dark
      const k = name === "nav" ? -1 : 1, d = easeIn(seg(g, SPLIT[0], SPLIT[1] + 0.2));
      local = trs([c[0] + k * 0.25 * d, c[1] - 0.05 * d, -0.55 * d], qMul(qAxis([0, 1, 0], k * 0.5 * d), UPRIGHT), g > SPLIT[1] + 0.25 ? kit.HIDDEN : 0.5);
    } else local = trs([c[0], c[1], (DEPTH[name] ?? 0.01) * s], UPRIGHT, 0.5);
    return mulT(pageAt(g), local);
  }
  function backingAt(g) { // the page's own ground behind the columns, pushed back as they part
    const d = easeIn(seg(g, TURN[0], TURN[0] + 0.55));
    const tr = mulT(pageAt(g), trs([0, 0, -0.006 - 0.9 * d], UPRIGHT, 0.5));
    return g > TURN[0] + 0.6 ? trs(tr.p, tr.q, kit.HIDDEN) : tr;
  }
  // their picture: a round card over the info slab; it bulges, and the toy comes out of it
  const AV_D = page.avatar.d * PX, AV = [...ui(...page.avatar.c), 0];
  const avZ = (g) => 0.0015 + (DEPTH.info + 0.004) * easeInOut(seg(g, SPLIT[0], SPLIT[1]));
  function avatarAt(g) {
    const b = seg(g, BULGE[0], BULGE[1]), e = easeIn(b), wob = 0.04 * Math.sin(b * 26) * b;
    const tr = mulT(pageAt(g), trs([AV[0], AV[1], avZ(g) + 0.012 * e], qEuler(0, 0, wob), [1 + 0.1 * e, 1 + 0.1 * e + wob, 1]));
    return g >= POP ? trs(tr.p, tr.q, kit.HIDDEN) : tr;
  }
  const avatarWorld = (g) => apply(pageAt(g), [AV[0], AV[1], avZ(g) + 0.012]);

  // the toy
  const SPOT = at(0.13 * K, 0, 0.09);
  const out = v3.sub(avatarWorld(POP), [0, kit.CENTER[1], 0]);
  function pose(g) {
    const o = kit.stand(SPOT);
    o.pop = 1;
    if (g < POP) { o.show = false; o.pos = out; return o; }
    if (g < LAND) {
      kit.hop(o, g, out, SPOT, POP, LAND, 0.05);
      const s = seg(g, POP, LAND), inflate = seg(g, POP, POP + 0.18);
      const n = qRot(pageAt(POP).q, [0, 0, 1]);
      o.yaw = lerp(Math.atan2(n[0], n[2]), -0.1 * K, smooth(seg(g, POP + 0.08, LAND - 0.05)));
      o.flat = lerp(0.05, 1, backOut(inflate, 2.4));
      o.pop = lerp(0.72, 1, smooth(inflate));
      o.pitch = -0.35 * Math.sin(Math.PI * s);
      o.legL = o.legR = [-1.1 * Math.sin(Math.PI * s), 0, 0];
      o.ground = SPOT[1];
      return o;
    }
    if (g >= LEAP[0]) return kit.leapOut(o, g, LEAP[0], LEAP[1], SPOT);
    o.yaw = -0.1 * K;
    const k = seg(g, SIG[0], SIG[0] + 0.25) * (1 - seg(g, SIG[1] - 0.2, SIG[1]));
    signature(o, g, SIG[0], k);
    o.head = [-0.12 * k, -0.1 * k * K, -0.08 * k * K];
    o.glint = Math.exp(-Math.pow((g - (SIG[0] + 0.4)) / 0.09, 2));
    kit.squash(o, kit.landSquash(g, LAND, 0.26) + kit.crouch(g, LEAP[0], 0.16));
    return o;
  }

  // the camera: the page's upper part fills the frame, then it follows the toy down
  const tanV = Math.tan((fov * Math.PI) / 360);
  const HV = Math.min(page.h * PX, (page.w * PX * 0.725) / aspect);
  const D0 = HV / 2 / tanV, s = D0 / 0.735;
  const TOP_Y = PAGE_C + (page.h / 2 - HV / PX / 2) * PX;
  const key = (t, x, y, z, dist, elev, az, fstop) => ({ t, target: at(x * K, y, z), dist, elev, az: az * K, fstop });
  const camera = kit.cameraFrom([
    key(0, 0, TOP_Y, 0, D0, 0, 0, 32), key(TURN[0], 0, TOP_Y, 0, D0, 0, 0, 32), key(TURN[1], -0.16, 0.55 * s, -0.02, 0.85 * s, 3, 20, 7),
    key(POP + 0.05, -0.14, 0.52 * s, 0.03, 0.82 * s, 4, 18, 6), key(POP + 0.35, -0.02, 0.3, 0.06, 0.85, 5, 14, 6),
    key(LAND + 0.25, 0.12, 0.08, 0.08, 0.6, 7, 6, 4.5), key(SIG[1], 0.13, 0.085, 0.09, 0.46, 7, 0, 4), key(len, 0.13, 0.12, 0.09, 0.5, 8, 0, 4.5),
  ], { fov, aspect, shakes: [[POP, 0.4]] });

  const UI = { image: page.image, w: page.w, h: page.h };
  return {
    declare(add) {
      add({ name: "floor", geo: { type: "plane", w: 10, h: 10 }, mat: { type: "stage" }, anim: true });
      for (const name of NAMES) {
        const r = page.panels[name];
        add({ name: `p_${name}`, geo: { type: "uiBox", rect: [-r[2] / 2, -r[3] / 2, r[2], r[3]], uvRect: r, img: UI, thickness: page.slab }, mat: { type: "ui", image: UI.image }, anim: true });
      }
      add({ name: "back", geo: { type: "uiBox", rect: [-page.w / 2, -page.h / 2, page.w, page.h], uvRect: [20, 20, 200, 200], img: UI, thickness: 0.002 }, mat: { type: "ui", image: UI.image }, anim: true });
      add({ name: "avatar", geo: { type: "plane", w: AV_D, h: AV_D }, mat: { type: "card2d", image: "assets/avatar.png" }, anim: true });
    },
    sample(put, g) {
      put("floor", trs(at(0, 0, 0), qEuler(-Math.PI / 2, 0, 0)));
      const on = g >= 0 && g < len, park = trs(at(0, -1, 0), qId(), kit.HIDDEN);
      for (const name of NAMES) put(`p_${name}`, on ? panelAt(name, g) : park);
      put("back", on ? backingAt(g) : park);
      put("avatar", on ? avatarAt(g) : park);
    },
    pose,
    camera,
    light: (g) => ({ p: at(0.05 * K, 0.3, 0.2), energy: 0.2 + (g >= POP ? 1.2 * Math.exp(-(g - POP) / 0.18) : 0), color: "#FFE9E0" }),
    cues(add) {
      add(0.6, "glint", { soft: true });
      add(TURN[0], "whoosh", { dur: TURN[1] - TURN[0] });
      add(SPLIT[0] + 0.2, "slide", { dur: 0.6 });
      add(BULGE[0], "peel", { dur: BULGE[1] - BULGE[0] + 0.05 });
      add(POP, "pop");
      add(POP + 0.05, "tinkles", { dur: 1.2 });
      add(LAND, "pomf");
      add(SIG[0] + 0.4, "glint");
      add(LEAP[0], "boing", { long: true });
      add(LEAP[0] + 0.05, "whooshUp", { dur: 0.45 });
    },
    music: { groove: "light", chords: ["G", "Em", "C", "D"], hits: [POP] },
    storyboard: {
      part: {
        label: { "zh-Hant": "開場", "zh-Hans": "开场", en: "Opening" },
        what: { "zh-Hant": "主頁好似螢幕咁平放，轉身拆開做企起嘅 slab，頭像鼓起，2.0 秒強拍彈出變公仔", "zh-Hans": "主页像屏幕一样平放，转身拆开成立起的 slab，头像鼓起，2.0 秒强拍弹出变公仔", en: "The page fills the frame like a screen, turns and parts into standing slabs; the picture bulges and the toy pops out on the 2.0 s downbeat" },
        uses: { "zh-Hant": "佢嘅主頁同頭像", "zh-Hans": "创作者的主页和头像", en: "their page and picture" },
        why: { "zh-Hant": "頭兩秒畀觀眾一個留低嘅理由：佢自己個主頁企起身", "zh-Hans": "头两秒给观众一个留下的理由：创作者自己的主页站了起来", en: "a reason to stay in the first two seconds: their own page stands up" },
      },
      frames: [
        { at: 0.3, title: { "zh-Hant": "主頁", "zh-Hans": "主页", en: "The page" }, what: { "zh-Hant": "主頁好似螢幕咁填滿畫面", "zh-Hans": "主页像屏幕一样填满画面", en: "The page fills the frame" } },
        { at: TURN[1], title: { "zh-Hant": "拆開", "zh-Hans": "拆开", en: "It parts" }, what: { "zh-Hant": "主頁轉身，拆開做 slab", "zh-Hans": "主页转身，拆开成 slab", en: "The page turns and parts into slabs" } },
        { at: POP + 0.15, title: { "zh-Hant": "彈出變公仔", "zh-Hans": "弹出变公仔", en: "The pop" }, what: { "zh-Hant": "頭像彈出變立體公仔", "zh-Hans": "头像弹出变立体公仔", en: "The toy puffs out of the picture" } },
      ],
      hits: [{ at: POP, label: { "zh-Hant": "彈出", "zh-Hans": "弹出", en: "pop" } }],
    },
  };
}
