// Writes ui/profile.html (X in dark mode: Kin's profile on a 1920x1080
// desktop page) from src/timeline.js, screenshots it with headless Chrome at
// 2x to assets/ui.png (3840x2160), and dumps build/timeline.json for the
// sound script.
// The profile picture is left as an empty socket: it is a 3D sticker of its
// own (the photo the calico jumps out of). The pinned post's small avatar is
// a socket too, so the cat is never on screen twice.
//
// usage: node scripts/build-ui.mjs [--no-shot]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const d of ["ui", "assets", "build"]) mkdirSync(join(root, d), { recursive: true });
const fileUrl = (f) => `file://${encodeURI(join(root, f))}`;
const asset = (f) => `'${fileUrl(f)}'`; // for url(...) inside double-quoted attributes

const px = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;
const ICON = {
  x: '<path fill="currentColor" stroke="none" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  grok: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 16 8-8"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.5c2.4.3 4 1.9 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.8-6.5 8-6.5s7.2 2.3 8 6.5"/>',
  more: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="16" cy="12" r=".8"/>',
  back: '<path d="M20 12H5M11 5l-7 7 7 7"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  pinned: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
  reply: '<path d="M4 11.5C4 7.4 7.6 4.5 12 4.5s8 2.9 8 7-3.6 7-8 7c-1 0-2-.1-2.9-.4L5 20l.9-3.6C4.7 15.1 4 13.4 4 11.5z"/>',
  repost: '<path d="M4 9V7h12l-3-3M20 15v2H8l3 3"/><path d="M16 4l3 3-3 3M8 20l-3-3 3-3"/>',
  like: '<path d="M12 20s-7.5-4.6-8.6-9.6C2.7 7 5 4.5 7.8 4.5c1.8 0 3.2 1 4.2 2.5 1-1.5 2.4-2.5 4.2-2.5 2.8 0 5.1 2.5 4.4 5.9C19.5 15.4 12 20 12 20z"/>',
  views: '<path d="M5 20V12M10 20V5M15 20v-9M20 20V8"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};
const icon = (n, s = 26, c = "currentColor", w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
const badge = (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path fill="#1D9BF0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m8 12.3 2.8 2.8L16.5 9"/></svg>`;
const P = T.PROFILE;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${T.UI_W}px; height: ${T.UI_H}px; background: #000; overflow: hidden; }
body { font-family: "PingFang SC", -apple-system, "Helvetica Neue", Helvetica, sans-serif; color: #E7E9EA; -webkit-font-smoothing: antialiased; }
.panel { position: absolute; overflow: hidden; background: #000; }
.emo { font-family: "Apple Color Emoji"; font-size: .9em; }
.grey { color: #71767B; }
.socket { position: absolute; border-radius: 50%; background: radial-gradient(circle at 50% 42%, #0b0c0e 0 58%, #020203 72%); box-shadow: inset 0 10px 22px rgba(0,0,0,.95), 0 0 0 2px #16181c; }
.nav-item { position: absolute; left: 12px; display: flex; align-items: center; gap: 20px; font-size: 20px; height: 50px; padding: 0 12px; }
.nav-item.on { font-weight: 700; }
.post-btn { position: absolute; left: 12px; width: 236px; height: 52px; border-radius: 26px; background: #EFF3F4; color: #0F1419; font-weight: 700; font-size: 17px; display: flex; align-items: center; justify-content: center; }
.hdr { position: absolute; left: 16px; top: 4px; display: flex; align-items: center; gap: 30px; }
.hdr .t { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
.hdr .s { font-size: 13px; color: #71767B; margin-top: 1px; }
.btn { position: absolute; top: 12px; height: 36px; border-radius: 18px; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.name { position: absolute; left: 16px; font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 4px; }
.line { position: absolute; left: 16px; font-size: 15px; line-height: 20px; white-space: nowrap; }
.meta { position: absolute; left: 16px; display: flex; gap: 14px; font-size: 15px; color: #71767B; }
.meta span { display: flex; align-items: center; gap: 4px; }
.tabs { display: flex; height: 53px; }
.tab { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #71767B; position: relative; font-weight: 500; }
.tab.on { color: #E7E9EA; font-weight: 700; }
.tab.on::after { content: ""; position: absolute; bottom: 0; width: 56px; height: 4px; border-radius: 2px; background: #1D9BF0; }
.post-top { position: absolute; left: 40px; top: 12px; font-size: 13px; color: #71767B; font-weight: 700; display: flex; align-items: center; gap: 12px; }
.av { position: absolute; left: 16px; top: 34px; width: 40px; height: 40px; border-radius: 50%; background: #16181c; }
.who { position: absolute; left: 68px; top: 34px; font-size: 15px; display: flex; align-items: center; gap: 4px; }
.txt { position: absolute; left: 68px; top: 58px; width: 512px; font-size: 15px; line-height: 21px; }
.shots { position: absolute; left: 68px; top: 168px; width: 512px; height: 214px; display: flex; gap: 2px; border-radius: 16px; overflow: hidden; border: 1px solid #2F3336; }
.shots i { flex: 1; background: #EDEDED; position: relative; }
.shots b { position: absolute; height: 26px; border-radius: 6px; }
.shots b.me { right: 46px; background: #95EC69; }
.shots b.bot { left: 46px; background: #fff; }
.shots u { position: absolute; width: 30px; height: 30px; border-radius: 6px; top: 0; }
.shots u.me { right: 10px; background: #c9c9c9; }
.shots u.bot { left: 10px; background: #1b1b1d; }
.acts { position: absolute; top: 396px; left: 68px; width: 512px; height: 24px; font-size: 13px; color: #71767B; }
.acts span { position: absolute; display: flex; align-items: center; gap: 6px; height: 24px; }
.sep { position: absolute; left: 0; width: 100%; height: 1px; background: #2F3336; }
.search { position: absolute; left: 0; top: 8px; width: 350px; height: 44px; border-radius: 22px; background: #202327; display: flex; align-items: center; gap: 12px; padding-left: 18px; color: #71767B; font-size: 15px; }
.box { position: absolute; left: 0; width: 350px; border: 1px solid #2F3336; border-radius: 16px; padding: 12px 16px; }
.box h4 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
.sk { display: flex; align-items: center; gap: 12px; height: 64px; }
.sk i { display: block; background: #202327; border-radius: 6px; }
`;

const av = T.AVATAR;
const socket = (panel) => `<div class="socket" style="left:${av.c[0] - panel[0] - av.d / 2 - 2}px;top:${av.c[1] - panel[1] - av.d / 2 - 2}px;width:${av.d + 4}px;height:${av.d + 4}px"></div>`;
const ACT_X = [0, 128, 256, 376];
const actions = (counts) => `<div class="acts">${["reply", "repost", "like", "views"].map((n, i) => `<span style="left:${ACT_X[i]}px">${icon(n, 19, "#71767B", 1.7)}${counts[i]}</span>`).join("")}
  <span style="right:34px">${icon("bookmark", 19, "#71767B", 1.7)}</span><span style="right:0">${icon("share", 19, "#71767B", 1.7)}</span></div>`;

const navItems = [["home", "主页"], ["search", "探索"], ["bell", "通知"], ["mail", "私信"], ["grok", "Grok"], ["bookmark", "书签"], ["people", "社群"], ["user", "个人资料", true], ["more", "更多"]];
const profile = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<section class="panel" style="${px(T.PANELS.nav)}">
  <div style="position:absolute;left:24px;top:14px">${icon("x", 30)}</div>
  ${navItems.map(([n, l, on], i) => `<div class="nav-item${on ? " on" : ""}" style="top:${70 + i * 58}px">${icon(n, 28, "currentColor", on ? 2.4 : 1.8)}${l}</div>`).join("")}
  <div class="post-btn" style="top:${70 + navItems.length * 58 + 20}px">发帖</div>
</section>
<section class="panel" style="${px(T.PANELS.header)}">
  <div class="hdr">${icon("back", 22)}<div><div class="t">${P.name}${badge(20)}</div><div class="s">${P.posts}</div></div></div>
</section>
<section class="panel" style="${px(T.PANELS.banner)};background:url(${asset("assets/banner-real.jpg")}) center/cover">${socket(T.PANELS.banner)}</section>
<section class="panel" style="${px(T.PANELS.info)}">
  ${socket(T.PANELS.info)}
  <div class="btn" style="right:118px;width:36px;border:1px solid #536471">${icon("dots", 20)}</div>
  <div class="btn" style="right:164px;width:36px;border:1px solid #536471">${icon("mail", 18)}</div>
  <div class="btn" style="right:16px;width:92px;background:#EFF3F4;color:#0F1419">关注</div>
  <div class="name" style="top:84px">${P.name}${badge(22)}</div>
  <div class="line grey" style="top:114px">${P.handle}</div>
  <div class="line" style="top:148px">${P.bio[0]}<br>${P.bio[1]}</div>
  <div class="meta" style="top:200px">${P.meta.map(([i, l]) => `<span>${icon(i, 18, "#71767B")}${i === "link" ? `<b style="color:#1D9BF0;font-weight:400">${l}</b>` : l}</span>`).join("")}</div>
  <div class="line" style="top:236px"><b>${P.following}</b> <span class="grey">正在关注</span>&nbsp;&nbsp;&nbsp;&nbsp;<b>${P.followers}</b> <span class="grey">关注者</span></div>
</section>
<section class="panel" style="${px(T.PANELS.tabs)}"><div class="tabs">${["帖子", "回复", "亮点", "文章", "媒体", "喜欢"].map((t, i) => `<div class="tab${i ? "" : " on"}">${t}</div>`).join("")}</div><div class="sep" style="bottom:0"></div></section>
<section class="panel" style="${px(T.PANELS.pinned)}">
  <div class="post-top">${icon("pinned", 14, "#71767B", 2)}已置顶</div>
  <div class="av"></div>
  <div class="who"><b>${P.name}</b>${badge(18)}<span class="grey">${P.handle} · ${P.pinned.date}</span></div>
  <div class="txt">${P.pinned.text.replace(/(🎉|🙋)/g, '<span class="emo">$1</span>')}</div>
  <div class="shots">${[0, 1].map((k) => `<i>${[[24, "me", 150], [64, "bot", 190], [104, "bot", 120], [144, "me", 170], [184, "bot", 150]].map(([y, w, len], j) => `<u class="${w}" style="top:${y - 2}px"></u><b class="${w}" style="top:${y}px;width:${len - 22 * ((j + k) % 3)}px"></b>`).join("")}</i>`).join("")}</div>
  ${actions(P.pinned.counts)}
</section>
<section class="panel" style="${px(T.PANELS.side)}">
  <div class="search">${icon("search", 18, "#71767B")}搜索</div>
  <div class="box" style="top:72px"><h4>你可能会喜欢</h4>${[0, 1, 2].map(() => `<div class="sk"><i style="width:40px;height:40px;border-radius:50%"></i><div><i style="width:120px;height:12px;margin-bottom:8px"></i><i style="width:80px;height:10px"></i></div><i style="margin-left:auto;width:72px;height:32px;border-radius:16px;background:#EFF3F4"></i></div>`).join("")}</div>
  <div class="box" style="top:370px"><h4>有什么新鲜事</h4>${[0, 1, 2, 3].map(() => `<div class="sk" style="height:58px;display:block;padding-top:10px"><i style="width:140px;height:10px;margin-bottom:9px"></i><i style="width:200px;height:13px"></i></div>`).join("")}</div>
</section>
</body></html>`;

writeFileSync(join(root, "ui/profile.html"), profile);

// ── Stage b: Kin's first chat with Grok bot, on a phone ─────────────────────
// The screen carries only the title and input bars; every message is a card of
// its own (assets/bubble-<id>.png) that pops out of the screen. Bubble sizes are
// measured in Chrome with the same CSS, so the 3D cards fit their text
// (build/chat.json).
const PH = T.PHONE, BB = T.BUBBLE;
const PCSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "PingFang SC", -apple-system, sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden; color: #111; }
.b { display: inline-block; max-width: ${BB.maxW}px; padding: 12px 16px; font-size: 24px; line-height: 34px; font-weight: 500; }`;
const COLOR = { me: "#95EC69", bot: "#E9E9EB" };
const phone = `<!doctype html><html><head><meta charset="utf-8"><style>${PCSS}
html, body { width: ${PH.w}px; height: ${PH.h}px; background: #F7F7F7; }
.bar { position: absolute; left: 0; width: 100%; }
</style></head><body>
<div class="bar" style="top:0;height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 26px;font-size:16px;font-weight:600">
  <span>9:41</span><span style="display:flex;gap:6px;align-items:center"><i style="display:block;width:18px;height:11px;border-radius:2px;background:#111"></i><i style="display:block;width:26px;height:12px;border-radius:3px;border:2px solid #111"></i></span></div>
<div class="bar" style="top:40px;height:48px;display:flex;align-items:center;gap:8px;padding:0 20px;font-size:19px;font-weight:600;border-bottom:1px solid #e2e2e2;background:#fff">
  ${T.CHAT_TITLE}<span style="font-size:11px;font-weight:600;color:#fff;background:#b9b9bd;border-radius:3px;padding:1px 4px">AI</span>
  <svg style="margin-left:auto" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/></svg></div>
<div class="bar" style="top:${PH.h - 62}px;height:62px;background:#fff;border-top:1px solid #e2e2e2;display:flex;align-items:center;gap:10px;padding:0 12px">
  <i style="display:block;width:30px;height:30px;border-radius:50%;border:2px solid #333"></i>
  <i style="display:block;flex:1;height:40px;border-radius:6px;background:#F2F2F2"></i>
  <i style="display:block;width:30px;height:30px;border-radius:50%;border:2px solid #333"></i>
  <i style="display:block;width:30px;height:30px;border-radius:50%;border:2px solid #333"></i></div>
</body></html>`;
writeFileSync(join(root, "ui/phone.html"), phone);

function chromeBin() {
  const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
  const ver = readdirSync(base).sort().pop();
  const bin = join(base, ver, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
  if (!existsSync(bin)) throw new Error(`headless chrome not found at ${bin}`);
  return bin;
}
const texts = T.CHAT.filter((m) => m.text);
const measure = `<!doctype html><html><head><meta charset="utf-8"><style>${PCSS} body { width: ${PH.w}px; } div { margin-bottom: 4px; }</style></head><body>
${texts.map((m) => `<div><span class="b" id="${m.id}">${m.text}</span></div>`).join("\n")}
<script>const r = {}; for (const e of document.querySelectorAll(".b")) { const b = e.getBoundingClientRect(); r[e.id] = [Math.ceil(b.width), Math.ceil(b.height)]; }
document.body.innerHTML = "<pre id=out>" + JSON.stringify(r) + "</pre>";</script></body></html>`;
writeFileSync(join(root, "ui/chat-measure.html"), measure);
const dom = execFileSync(chromeBin(), ["--headless", "--disable-gpu", "--allow-file-access-from-files", `--window-size=${PH.w},2000`, "--dump-dom", `file://${join(root, "ui/chat-measure.html")}`]).toString();
const sizes = JSON.parse(dom.match(/<pre id="?out"?>(.*?)<\/pre>/s)[1]);
sizes.typing = [96, 58];
for (const m of T.CHAT) if (m.sticker) sizes[m.id] = [BB.sticker, BB.sticker];
writeFileSync(join(root, "build/chat.json"), JSON.stringify(sizes));

const bubbleHtml = (m, [w, h]) => {
  let inner;
  if (m.typing) inner = `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-size:30px;letter-spacing:4px;color:#888;padding-bottom:12px">···</div>`;
  else if (m.sticker) inner = existsSync(join(root, m.sticker))
    ? `<div style="width:${w}px;height:${h}px;background:#fff url(${asset(m.sticker)}) center/86% no-repeat"></div>`
    : `<div style="width:${w}px;height:${h}px;background:#fff;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:22px">表情包</div>`;
  else inner = `<span class="b" style="width:${w}px;height:${h}px">${m.text}</span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${PCSS}
html, body { width: ${w}px; height: ${h}px; background: ${m.sticker ? "#fff" : COLOR[m.side]}; }</style></head><body>${inner}</body></html>`;
};
for (const m of T.CHAT) writeFileSync(join(root, `ui/bubble-${m.id}.html`), bubbleHtml(m, sizes[m.id]));

// ── Stage b: the long article as an X post ──────────────────────────────────
const AR = T.ARTICLE_SLAB;
const article = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
html, body { width: ${AR.w}px; height: ${AR.h}px; }
.cover { position: absolute; left: 0; top: 0; width: 100%; height: 228px; background: linear-gradient(135deg, #0BD56E, #06A452); display: flex; align-items: center; justify-content: center; gap: 18px; color: #fff; }
.cover b { font-family: "Helvetica Neue"; font-weight: 800; font-size: 46px; letter-spacing: -1px; }
.cover s { text-decoration: none; font-size: 40px; font-weight: 300; opacity: .9; }
.cover u { text-decoration: none; font-weight: 800; font-size: 46px; }
.bub { position: absolute; border-radius: 10px; height: 26px; }
</style></head><body>
<div class="av" style="top:16px"></div>
<div class="who" style="top:24px"><b>${P.name}</b>${badge(18)}<span class="grey">${P.handle} · ${T.ARTICLE.date}</span></div>
<div style="position:absolute;left:68px;top:60px;width:456px;border:1px solid #2F3336;border-radius:16px;overflow:hidden;height:376px">
  <div class="cover"><b>Grok Bot</b><s>×</s><u>微信</u>
    <i class="bub" style="left:28px;top:30px;width:86px;background:#fff;opacity:.92"></i><i class="bub" style="left:28px;top:66px;width:54px;background:#fff;opacity:.92"></i>
    <i class="bub" style="right:28px;bottom:58px;width:70px;background:#95EC69"></i><i class="bub" style="right:28px;bottom:22px;width:104px;background:#95EC69"></i></div>
  <div style="position:absolute;top:244px;left:16px;right:16px;font-size:23px;font-weight:700;line-height:32px">${T.ARTICLE.title.replace("？", "？<br>")}</div>
  <div style="position:absolute;top:330px;left:16px;display:flex;gap:6px;align-items:center;font-size:15px;color:#71767B">${icon("mail", 17, "#71767B")}文章</div>
</div>
<div class="acts" style="top:${T.VIEWS_AT[1] - 12}px">${["reply", "repost", "like", "views"].map((n, i) => `<span style="left:${[0, 110, 230, 340][i]}px;font-size:15px">${icon(n, 21, "#71767B", 1.7)}${T.ARTICLE.counts[i]}</span>`).join("")}</div>
</body></html>`;
writeFileSync(join(root, "ui/article.html"), article);
writeFileSync(join(root, "build/text.json"), JSON.stringify(T.ALL_TEXT));

// timeline.json for the sound script
const dump = { FPS: T.FPS, DURATION: T.DURATION, BPM: T.BPM, BEAT: T.BEAT, BAR: T.BAR, EV: T.EV, cues: T.soundCues ? T.soundCues() : [] };
writeFileSync(join(root, "build/timeline.json"), JSON.stringify(dump, null, 1));

if (!process.argv.includes("--no-shot")) {
  const chrome = chromeBin();
  const shot = (html, out, w, h, scale) => execFileSync(chrome, [
    "--headless", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files",
    `--window-size=${w},${h}`, `--force-device-scale-factor=${scale}`,
    `--screenshot=${join(root, out)}`, `file://${join(root, html)}`,
  ], { stdio: "ignore" });
  shot("ui/profile.html", "assets/ui.png", T.UI_W, T.UI_H, T.UI_SCALE);
  shot("ui/phone.html", "assets/phone.png", PH.w, PH.h, 3);
  for (const m of T.CHAT) shot(`ui/bubble-${m.id}.html`, `assets/bubble-${m.id}.png`, ...sizes[m.id], 3);
  shot("ui/article.html", "assets/article.png", AR.w, AR.h, 3);
}
console.log("ui built");
