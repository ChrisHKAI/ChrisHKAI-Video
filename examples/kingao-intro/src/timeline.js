// One layout, three readers: the UI builder (scripts/build-ui.mjs), the motion
// (src/anim.js → Blender) and the sound script (through build/timeline.json).
// Every time is film seconds. 120 BPM: a beat is 0.5 s, a bar 2 s, 15 bars;
// every big hit sits on a downbeat. World: metres, +y up, floor at y = 0.
//
// 0  flat: Kin's X profile fills the frame like a screen; it turns left, backs
//    off to the right and comes apart into floating slabs (3D)
// 1  the avatar photo bulges and the calico jumps out of it as the toy
// 2–3 SpaceXAI 官方认证大使 (中国区): a medal drops on, the title slaps up
// 4–6 微信 × Grok bot: the chat pops out of a phone; 第一个想到用微信直接和
//    Grok bot 聊天的人; the long article's 155万 浏览 counts up
// 7–10 一个月零18天 破万粉: it hops up a rising bar chart while the count runs
// 11–14 the call to action: 想学 Grok bot | 找 Kin 进群, Kin @KinGao476942,
//    the calico beckons like a lucky cat; hold to 30 s (no fade)

export const FPS = 30;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const DURATION = 30.0;
export const bar = (n, beat = 0) => +(n * BAR + beat * BEAT).toFixed(4);

// ── The X profile (UI px on a 1920x1080 desktop page, dark mode) ────────────
export const UI_W = 1920;
export const UI_H = 1080;
export const UI_SCALE = 2; // ui.png is 3840x2160
export const PX = 0.0005; // 1 UI px = 0.5 mm on the page in 3D
const NX = 327, NW = 260, MX = 612, MW = 600, SX = 1242, SW = 350;
// slabs [x, y, w, h]
export const PANELS = {
  nav: [NX, 0, NW, 1080],
  header: [MX, 0, MW, 53],
  banner: [MX, 53, MW, 200],
  info: [MX, 253, MW, 296],
  tabs: [MX, 549, MW, 53],
  pinned: [MX, 602, MW, 478],
  side: [SX, 0, SW, 1080],
};
export const AVATAR = { c: [MX + 16 + 67, 253], d: 134, ring: 4 };
export const PROFILE = {
  name: "Kin",
  handle: "@KinGao476942",
  posts: "1,521 帖子",
  // the bio as on X, without the contact number and the rate
  bio: ["SpaceXAI 官方认证大使；Grok bot 重度患者，", "专注研究AI 和自媒体"],
  meta: [["pin", "美国"], ["link", "okjk.co/1AL6jn"], ["cal", "2023年9月加入"]],
  following: "567",
  followers: "1.1万",
  pinned: {
    date: "9月15日",
    text: "🎉 我可能是推特中文圈里最熟悉 Grok bot 的内容创作者，今天我决定正式成立一个 Grok bot 深度学习小群，群内提供 24 小时答疑和交流服务，想进群的可以直接私聊我 🙋",
    counts: ["56", "8", "125", "13.3万"],
  },
};
// the bio's first line on the info slab (UI px): it lights up in act 1
export const BIO_LINE = [MX + 16, 253 + 148, 330, 20];

// ── Story (film seconds) ────────────────────────────────────────────────────
export const EV = {
  // 0: flat → 3D
  turn: [0.45, 1.85], // the page turns left and backs off to the right
  split: [0.55, 1.6], // nav and sidebar drift off, the column's slabs part
  // 1: out of the avatar
  bulge: [1.55, 2.0],
  pop: bar(1), // 2.0 the photo puffs into the toy
  leap: [2.0, 2.55],
  land: 2.55,
  content: [2.75, 3.9], // chin up, eyes shut: the photo's pose
  // 2–3: the ambassador
  medal: [bar(2), 4.28], // 4.0 the medal drops round its neck
  title: 4.5, // SpaceXAI, then 官方认证大使 a letter per 8th
  stamp: bar(3), // 6.0 中国区 slams on
  proud: [6.3, 7.5],
  leap2: [7.62, 8.12], // off to the next stage, over the cut
  cut1: bar(4) - 1 / 60,
  // 4–7: 微信 × Grok bot — Kin's real first chat with it (CHAT below)
  phone: [8.0, 8.4],
  bubble2: 9.2, // 回皇上，是奴才… — Grok bot pops out beside its first reply
  first: bar(5), // 10.0 第一个想到用微信 / 直接和 Grok bot 聊天的人
  giggle: 13.05, // 封号还不退款
  article: [13.75, 14.3], // the article card rises beside the phone
  lock1: bar(7, 2), // 15.0 155万 浏览
  cheer: [15.05, 15.55],
  leap3: [15.62, 16.12],
  cut2: bar(8) - 1 / 60,
  // 8–11: 破万粉
  hops: [[16.6, 16.95], [17.3, 17.65], [18.0, 18.35], [18.7, 19.05], [19.5, 19.95]],
  lock2: bar(10), // 20.0 10000 粉丝 — 破万!
  days: 20.44, // 一个月零18天, a letter per 16th
  now: bar(11), // 22.0 on to 11000+
  leap4: [23.62, 24.12],
  cut3: bar(12) - 1 / 60,
  // 12–14: the call to action
  bots: [24.1, 24.6],
  slogan: bar(12, 1), // 24.5 想学 Grok bot | 找 Kin 进群, a word per 8th
  name: bar(13, 1), // 26.5 Kin / @KinGao476942
  beckon: [27.0, 28.0],
  final: bar(14), // 28.0 beckons at you; hold to 30
};

// stages: far apart, past every other shot's clip distance
export const STAGE = { a: [0, 0, 0], b: [100, 0, 0], c: [200, 0, 0], d: [300, 0, 0] };

// ── Lettering (Lantinghei SC Heavy) ─────────────────────────────────────────
// Torn-paper labels: text, em (m), paper, centre (stage m), yaw (faces the
// camera), tilt, when the sheet slaps on, and the time between letters (a
// Latin word pops as one beat).
const B16 = BEAT / 4, B8 = BEAT / 2;
export const LABELS = [
  // act 1, stage a
  { id: "spacexai", stage: "a", text: "SpaceXAI", em: 0.03, paper: "blue", c: [-0.37, 0.212, -0.02], yaw: -0.22, tilt: 0.03, at: 4.5, step: 0.04 },
  { id: "amb", stage: "a", text: "官方认证大使", em: 0.05, paper: "cream", c: [-0.33, 0.14, 0.0], yaw: -0.22, tilt: -0.02, at: 4.86, step: B16, first: 5.0 },
  { id: "cn", stage: "a", text: "中国区", em: 0.034, paper: "red", c: [-0.15, 0.198, 0.012], yaw: -0.22, tilt: 0.16, at: bar(3), step: 0, stamp: true },
  // act 2, stage b
  { id: "first1", stage: "b", text: "第一个想到用微信", em: 0.042, paper: "cream", c: [-0.03, 0.54, -0.075], yaw: 0, tilt: -0.025, at: bar(5) - 0.06, step: B16 / 2 },
  { id: "first2", stage: "b", text: "直接和 Grok bot 聊天的人", em: 0.042, paper: "red", c: [0.01, 0.48, -0.07], yaw: 0, tilt: 0.015, at: 10.5, step: B16 / 2 },
  // act 3, stage c
  { id: "pomwan", stage: "c", text: "破万!", em: 0.06, paper: "red", c: [0.27, 0.42, -0.2], yaw: -0.1, tilt: 0.18, at: bar(10), step: 0, stamp: true },
  { id: "days", stage: "c", text: "一个月零18天", em: 0.054, paper: "cream", c: [-0.24, 0.25, -0.06], yaw: -0.1, tilt: -0.03, at: 20.44, step: B16 },
  // act 4, stage d
  { id: "slogan1", stage: "d", text: "想学 Grok bot", em: 0.046, paper: "cream", c: [-0.51, 0.036, 0.02], yaw: 0, tilt: -0.012, at: bar(12, 1) - 0.06, step: B8 },
  { id: "slogan2", stage: "d", text: "找 Kin 进群", em: 0.046, paper: "red", c: [-0.17, 0.038, 0.025], yaw: 0, tilt: 0.02, at: bar(12, 3) - 0.06, step: B8 },
  { id: "name", stage: "d", text: "Kin", em: 0.11, paper: "cream", c: [0.12, 0.3, -0.05], yaw: 0, tilt: -0.03, at: bar(13, 1), step: 0.06 },
  { id: "handle", stage: "d", text: "@KinGao476942", em: 0.036, paper: "blue", c: [0.12, 0.188, -0.04], yaw: 0, tilt: 0.02, at: bar(13, 1) + 0.2, step: 0.025 },
];
// 3D counters (white lettering lit from inside): digit slots, then words
export const COUNTERS = {
  views: { stage: "b", em: 0.075, c: [0.56, 0.075, 0.07], yaw: -0.12, slots: 3, after: ["万", "浏览"], value: [14.45, 14.95, 155] },
  fans: { stage: "c", em: 0.1, c: [0.04, 0.3, -0.3], yaw: -0.1, slots: 5, after: ["粉丝"], value: [16.1, 19.95, 10000] },
  days: { stage: "c", em: 0.046, c: [-0.36, 0.41, -0.3], yaw: -0.1, slots: 2, before: ["第"], after: ["天"], value: [16.1, 19.95, 48] },
};
export const FANS_NOW = [bar(11), 22.6, 11000]; // then a "+"

export const ARTICLE = {
  title: "如何把 Grok Bot 接入你的微信？保姆级新手指南",
  date: "10月8日",
  counts: ["225", "1,145", "4,775", "155万"],
};
// Kin's first chat with Grok bot on 微信, as he posted it (two screenshots)
export const CHAT = [
  { id: "me1", side: "me", text: "你好，你是 Grok bot 么？", at: 8.5 },
  { id: "typing", side: "bot", typing: true, at: 8.85, until: 9.2 },
  { id: "bot1", side: "bot", text: "回皇上，是奴才，御前总管太监，跑在 Grok Bot 上伺候您。微信这条路已经通了，您有什么旨意直接吩咐就成。", at: 9.2 },
  { id: "me2", side: "me", text: "把奶娃的达里奥表情包发我", at: 11.3 },
  { id: "bot2", side: "bot", text: "这个我帮不了", at: 11.65 },
  { id: "stk1", side: "bot", sticker: "assets/sticker-1.png", at: 11.9 },
  { id: "bot3", side: "bot", text: "不要逼我把你号封了", at: 12.35 },
  { id: "stk2", side: "bot", sticker: "assets/sticker-2.png", at: 12.6 },
  { id: "bot4", side: "bot", text: "封号还不退款", at: 13.05 },
];
export const CHAT_TITLE = "Grok bot 微信版";
// every string on screen, for scripts/glyphs.py
export const ALL_TEXT = [...LABELS.map((l) => l.text), ...Object.values(COUNTERS).flatMap((c) => [...(c.before ?? []), ...c.after])];

// ── Stage b: the phone and the article (UI px → m) ──────────────────────────
export const PHONE = { w: 405, h: 640, px: 0.5 / 750, c: [0.0, 0.02 + 320 * (0.5 / 750), -0.1], yaw: 0.0, depth: 0.012 };
export const CHAT_AREA = [88, 578]; // UI px: under the title bar, over the input bar
export const BUBBLE = { maxW: 322, gap: 12, margin: 14, sticker: 168 };
export const ARTICLE_SLAB = { w: 540, h: 600, px: 0.4 / 600, c: [0.56, 0.235, -0.1], yaw: -0.12, depth: 0.006 };
export const VIEWS_AT = [540 - 16 - 130, 600 - 44]; // the 155万 in the action bar (UI px)

// ── Camera keys per stage ───────────────────────────────────────────────────
// target: [x, y, z] (stage metres) or a tracker name; dist m, elev / az deg
// (az 0 = looking down -z), fov deg, fstop.
export const CAMERA = {
  a: [
    { t: 0.0, target: [0, 0.3, 0], dist: 1.531, elev: 0, az: 0, fov: 20, fstop: 32 },
    { t: 0.45, target: [0, 0.3, 0], dist: 1.531, elev: 0, az: 0, fov: 20, fstop: 32 },
    { t: 1.85, target: [-0.02, 0.3, -0.08], dist: 0.92, elev: 4, az: -20, fov: 30, fstop: 7 },
    { t: 2.05, target: "cat", dist: 0.9, elev: 5, az: -18, fov: 30, fstop: 6 },
    { t: 2.75, target: "cat", dist: 0.62, elev: 8, az: -6, fov: 30, fstop: 4.5 },
    { t: 3.9, target: "cat", dist: 0.42, elev: 8, az: 4, fov: 30, fstop: 3.5 },
    { t: 4.4, target: "cat", dist: 0.46, elev: 9, az: 0, fov: 30, fstop: 3.8 },
    { t: 5.1, target: "cat+", dist: 0.74, elev: 9, az: -8, fov: 30, fstop: 5.6 },
    { t: 6.0, target: "cat+", dist: 0.78, elev: 8, az: -14, fov: 30, fstop: 6 },
    { t: 7.55, target: "cat+", dist: 0.74, elev: 9, az: -20, fov: 30, fstop: 5.6 },
    { t: 8.0, target: "cat", dist: 0.7, elev: 9, az: -20, fov: 30, fstop: 5 },
  ],
  b: [
    { t: 7.95, target: "cat", dist: 0.8, elev: 7, az: 6, fov: 30, fstop: 6 },
    { t: 8.45, target: [0.1, 0.2, -0.05], dist: 0.85, elev: 6, az: 6, fov: 30, fstop: 6.5 },
    { t: 9.4, target: [0.02, 0.27, -0.08], dist: 0.72, elev: 4, az: 2, fov: 30, fstop: 6 },
    { t: 10.15, target: [0.0, 0.3, -0.06], dist: 1.2, elev: 4, az: 0, fov: 30, fstop: 8 },
    { t: 11.7, target: [0.0, 0.3, -0.06], dist: 1.18, elev: 4, az: -1, fov: 30, fstop: 8 },
    { t: 12.25, target: [0.02, 0.22, -0.08], dist: 0.82, elev: 4, az: -2, fov: 30, fstop: 6.5 },
    { t: 13.55, target: [0.04, 0.2, -0.08], dist: 0.82, elev: 5, az: -3, fov: 30, fstop: 6.5 },
    { t: 14.4, target: [0.5, 0.18, 0.0], dist: 0.85, elev: 6, az: -6, fov: 30, fstop: 7 },
    { t: 15.1, target: [0.5, 0.15, 0.02], dist: 0.72, elev: 7, az: -10, fov: 30, fstop: 6 },
    { t: 15.6, target: [0.5, 0.15, 0.02], dist: 0.7, elev: 7, az: -13, fov: 30, fstop: 6 },
    { t: 16.0, target: "cat", dist: 0.7, elev: 7, az: -14, fov: 30, fstop: 5 },
  ],
  c: [
    { t: 15.95, target: "cat", dist: 0.9, elev: 8, az: 12, fov: 30, fstop: 6 },
    { t: 16.5, target: [-0.12, 0.25, -0.12], dist: 1.25, elev: 7, az: 12, fov: 30, fstop: 8 },
    { t: 19.0, target: "climb", dist: 1.08, elev: 7, az: 4, fov: 30, fstop: 8 },
    { t: 20.0, target: [0.0, 0.25, -0.12], dist: 1.25, elev: 6, az: -4, fov: 30, fstop: 9 },
    { t: 23.5, target: [0.0, 0.25, -0.12], dist: 1.18, elev: 6, az: -8, fov: 30, fstop: 9 },
    { t: 24.0, target: "cat", dist: 0.9, elev: 6, az: -8, fov: 30, fstop: 6 },
  ],
  d: [
    { t: 23.95, target: "cat", dist: 0.8, elev: 8, az: 8, fov: 30, fstop: 6 },
    { t: 24.5, target: [0.08, 0.08, 0.08], dist: 0.7, elev: 8, az: 8, fov: 30, fstop: 6 },
    { t: 25.2, target: [-0.26, 0.09, 0.03], dist: 0.98, elev: 7, az: 4, fov: 30, fstop: 8 },
    { t: 26.6, target: [-0.2, 0.14, 0.0], dist: 1.1, elev: 7, az: 2, fov: 30, fstop: 9 },
    { t: 28.0, target: [-0.19, 0.14, 0.0], dist: 1.12, elev: 7, az: 0, fov: 30, fstop: 10 },
    { t: 30.0, target: [-0.19, 0.14, 0.0], dist: 1.12, elev: 7, az: 0, fov: 30, fstop: 10 },
  ],
};
export const SHAKES = [[2.0, 0.35], [4.28, 0.25], [6.0, 0.8], [10.0, 0.4], [15.0, 0.7], [20.0, 1.1], [26.5, 0.4], [28.0, 0.5]];

// ── Sound cues derived from the same numbers ────────────────────────────────
export function soundCues() {
  const cues = [];
  const add = (t, kind, extra = {}) => cues.push({ t: +t.toFixed(4), kind, ...extra });
  const E = EV;
  // 0–1: the screen turns into slabs; the photo puffs into the toy
  add(E.turn[0], "whoosh", { dur: E.turn[1] - E.turn[0] });
  add(E.split[0] + 0.1, "slabs", { dur: 0.9 });
  add(E.bulge[0], "suck", { dur: E.pop - E.bulge[0] });
  add(E.pop, "pop");
  add(E.pop + 0.05, "tinkles", { dur: 1.2 });
  add(E.land, "pomf");
  add(E.content[0] + 0.1, "purr", { dur: 1.0 });
  // 2–3: the ambassador
  add(E.medal[0], "whooshDown", { dur: E.medal[1] - E.medal[0] });
  add(E.medal[1], "medal");
  // 4–7: the chat, the caption, the count
  add(E.cut1 - 0.35, "whoosh", { dur: 0.5 });
  add(E.phone[0], "whooshUp", { dur: E.phone[1] - E.phone[0] });
  add(8.3, "pomf", { soft: true });
  // the chat: a blip per message, a pop per sticker; it taps "send" for its own
  for (const m of CHAT) {
    if (m.typing) add(m.at, "typing", { dur: m.until - m.at });
    else if (m.sticker) add(m.at, "sticker");
    else add(m.at, "bubble", { me: m.side === "me" });
    if (m.side === "me") add(m.at - 0.08, "tap");
  }
  add(E.bubble2 + 0.02, "pop", { soft: true });
  add(E.bubble2 + 0.5, "pomf", { soft: true });
  add(E.article[0], "whooshUp", { dur: E.article[1] - E.article[0] });
  add(13.8, "boing", { soft: true }); add(14.1, "pomf", { soft: true });
  add(14.15, "boing", { soft: true }); add(14.45, "pomf", { soft: true });
  add(COUNTERS.views.value[0], "ticker", { dur: COUNTERS.views.value[1] - COUNTERS.views.value[0] });
  add(E.lock1, "lock");
  add(E.lock1 + 0.02, "sparkle");
  add(E.cheer[0], "cheer");
  // 8–11: the climb
  add(E.cut2 - 0.35, "whoosh", { dur: 0.5 });
  add(E.cut2 + 0.2, "pomf");
  const UP = ["D5", "E5", "F#5", "A5", "B5"];
  E.hops.forEach(([a, b], i) => { add(a - 0.3, "rise", { dur: 0.32 }); add(a, "boing"); add(b, "step", { note: UP[i] }); });
  add(COUNTERS.fans.value[0], "ticker", { dur: COUNTERS.fans.value[1] - COUNTERS.fans.value[0], long: true });
  add(E.lock2, "lock", { big: true });
  add(E.lock2 + 0.02, "confetti", { dur: 2.0 });
  add(FANS_NOW[0], "ticker", { dur: FANS_NOW[1] - FANS_NOW[0] });
  add(FANS_NOW[1], "ding", { note: "A6" });
  // 12–14: the call to action
  add(E.cut3 - 0.35, "whoosh", { dur: 0.5 });
  add(E.cut3 + 0.28, "pomf");
  ["G4", "B4", "D5"].forEach((n, i) => add(E.bots[0] + 0.25 + 0.15 * i, "bonk", { note: n }));
  add(E.final, "lock", { big: true });
  add(E.final + 0.02, "sparkle");
  add(E.beckon[0], "chime");
  // every label: its slap, then a note per letter beat (stamps are a slam)
  const TUNE = ["D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6", "B6", "D7", "E7"];
  LABELS.forEach((L, i) => {
    if (L.stamp) { add(L.at, "stamp"); return; }
    add(L.at, "slap", { i });
    const first = L.first ?? L.at + 0.06;
    const toks = [...L.text.matchAll(/[A-Za-z0-9@]+|\s|./gu)].filter((m) => m[0] !== " ").length;
    if (!L.step) return;
    for (let k = 0; k < toks; k++) add(first + k * L.step, "letter", { note: TUNE[Math.min(k, TUNE.length - 1)], soft: L.step < 0.06, red: L.paper === "red" });
  });
  return cues.sort((a, b) => a.t - b.t);
}
