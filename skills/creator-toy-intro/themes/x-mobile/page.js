// X (Twitter) in the phone app, dark mode, as HTML: the profile page and a
// single post, filled from film.json, at 600 UI px wide (1.54 px per pt).
// Same functions as themes/x-desktop/page.js; platform marks only from the
// film's "branding".
import { ICON } from "../x-desktop/page.js";

const STRINGS = {
  "zh-Hans": {
    follow: "关注", following: "正在关注", followers: "关注者",
    tabs: ["帖子", "回复", "亮点", "文章", "媒体"], pinned: "已置顶", article: "文章",
  },
};
const MORE = {
  status: '<path d="M2 18h3v3H2zM7 14h3v7H7zM12 10h3v11h-3zM17 6h3v15h-3z" fill="currentColor" stroke="none"/>',
};

function kit({ film }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  const B = film.branding ?? {};
  const icon = (n, s = 40, c = "currentColor", w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[n] ?? MORE[n] ?? ""}</svg>`;
  const badge = (s = 30) => (B.badge ? `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${B.badge}</svg>` : "");
  const pr = film.profile;
  const NAME = `${pr.name}${pr.nameEmoji ? ` <span class="emo">${pr.nameEmoji}</span>` : ""}`;
  return { S, icon, badge, pr, NAME };
}

const css = (L, avatar) => `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${L.UI_W}px; height: ${L.UI_H}px; background: #000; overflow: hidden; }
body { font-family: "PingFang SC", -apple-system, "Helvetica Neue", Helvetica, sans-serif; color: #E7E9EA; -webkit-font-smoothing: antialiased; }
.panel { position: absolute; overflow: hidden; background: #000; }
.emo { font-family: "Apple Color Emoji"; font-size: .9em; }
.grey { color: #71767B; }
.socket { position: absolute; border-radius: 50%; background: radial-gradient(circle at 50% 42%, #0b0c0e 0 58%, #020203 72%); box-shadow: inset 0 14px 30px rgba(0,0,0,.95), 0 0 0 3px #16181c; }
/* banner */
.status { position: absolute; left: 0; top: 0; width: 100%; height: 72px; background: linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,0)); display: flex; align-items: center; justify-content: space-between; padding: 8px 44px 0 52px; font-size: 26px; font-weight: 600; color: #fff; }
.status .bat { width: 40px; height: 20px; border: 2px solid #fff; border-radius: 6px; position: relative; }
.status .bat::after { content: ""; position: absolute; left: 3px; top: 3px; width: 26px; height: 10px; background: #fff; border-radius: 2px; }
.round { position: absolute; top: 84px; width: 54px; height: 54px; border-radius: 50%; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; color: #fff; }
/* info */
.btn { position: absolute; top: 18px; height: 54px; border-radius: 27px; font-size: 23px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.name { position: absolute; left: 25px; top: 80px; font-size: 34px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
.line { position: absolute; left: 25px; font-size: 23px; line-height: 32px; }
.meta { position: absolute; left: 25px; top: 270px; display: flex; gap: 20px; font-size: 22px; color: #71767B; }
.meta span { display: flex; align-items: center; gap: 6px; }
/* tabs */
.tabs { display: flex; height: 72px; padding: 0 12px; gap: 6px; }
.tab { padding: 0 22px; display: flex; align-items: center; font-size: 23px; color: #71767B; position: relative; font-weight: 500; }
.tab.on { color: #E7E9EA; font-weight: 700; }
.tab.on::after { content: ""; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 70%; height: 6px; border-radius: 3px; background: #1D9BF0; }
.sep { position: absolute; left: 0; width: 100%; height: 2px; background: #2F3336; }
/* posts */
.post-top { position: absolute; left: 66px; top: 18px; font-size: 20px; color: #71767B; font-weight: 700; display: flex; align-items: center; gap: 10px; }
.av { position: absolute; left: 24px; top: 50px; width: 62px; height: 62px; border-radius: 50%; background: url(${avatar}) center/cover; }
.who { position: absolute; left: 104px; top: 52px; right: 20px; font-size: 23px; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
.card { position: absolute; left: ${L.CARD.x}px; top: ${L.CARD.y}px; width: ${L.CARD.w}px; border: 2px solid #2F3336; border-radius: 24px; overflow: hidden; }
.cover { width: 100%; height: ${L.CARD.coverH}px; position: relative; }
.card .tt { padding: 14px 18px 4px; font-size: 25px; font-weight: 700; line-height: 32px; min-height: 76px; }
.card .chip { margin: 6px 18px 14px; display: inline-flex; gap: 8px; align-items: center; font-size: 20px; color: #71767B; }
.acts { position: absolute; top: ${L.ACTIONS_Y - 18}px; left: ${L.CARD.x}px; width: ${L.CARD.w}px; height: 36px; font-size: 20px; color: #71767B; }
.acts span { position: absolute; display: flex; align-items: center; gap: 8px; height: 36px; }
/* tab bar */
.bar { position: absolute; left: 0; top: 0; width: 100%; height: 76px; display: flex; justify-content: space-around; align-items: center; color: #E7E9EA; }
.home-ind { position: absolute; left: 50%; bottom: 14px; width: 210px; height: 8px; border-radius: 4px; background: #E7E9EA; transform: translateX(-50%); }
`;
const style = (L, asset, film) => css(L, asset(film.profile.avatar));
const px = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;

function postBody({ film, L, post, pinned, cover }) {
  const { S, icon, badge, pr, NAME } = kit({ film });
  const names = ["reply", "repost", "like", "views"];
  const actions = `<div class="acts">${names.map((n, i) => `<span style="left:${L.ACTION_X[i]}px">${icon(n, 28, "#71767B", 1.7)}${post.counts[i]}</span>`).join("")}
    </div>`;
  return `${pinned && post.pinned !== false ? `<div class="post-top">${icon("pin", 22, "#71767B", 2)}${S.pinned}</div>` : ""}
    <div class="av"></div>
    <div class="who"><b>${NAME}</b>${badge(26)}<span class="grey">@${pr.handle} · ${post.date}</span></div>
    <div class="card">${cover}<div class="tt">${post.title}</div>${(post.kind ?? "article") === "article" ? `<div class="chip">${icon("mail", 22, "#71767B")}${S.article}</div>` : ""}</div>
    ${actions}`;
}

export const SOCKET_COVER = `<div class="cover" style="background:#050506;box-shadow:inset 0 10px 30px #000"></div>`;
export const pictureCover = (asset, path) => `<div class="cover" style="background:url(${asset(path)}) center/cover"></div>`;

export function profilePage({ film, L, asset, pinned }) {
  const { S, icon, badge, pr, NAME } = kit({ film });
  const P = L.PANELS, av = L.AVATAR;
  const socket = (panel) => `<div class="socket" style="left:${av.c[0] - panel[0] - av.d / 2 - av.ring}px;top:${av.c[1] - panel[1] - av.d / 2 - av.ring}px;width:${av.d + 2 * av.ring}px;height:${av.d + 2 * av.ring}px"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style(L, asset, film)}</style></head><body>
<section class="panel" style="${px(P.banner)};background:url(${asset(pr.banner)}) center/cover">
  <div class="status"><span>9:41</span><span style="display:flex;gap:10px;align-items:center">${icon("status", 30, "#fff")}<i class="bat"></i></span></div>
  <div class="round" style="left:20px">${icon("back", 32, "#fff", 2.2)}</div>
  <div class="round" style="right:90px">${icon("search", 30, "#fff", 2.2)}</div>
  <div class="round" style="right:20px">${icon("dots", 30, "#fff", 2.2)}</div>
  ${socket(P.banner)}
</section>
<section class="panel" style="${px(P.info)}">
  ${socket(P.info)}
  <div class="btn" style="right:146px;width:54px;border:2px solid #536471">${icon("dots", 30)}</div>
  <div class="btn" style="right:24px;width:110px;background:#EFF3F4;color:#0F1419">${S.follow}</div>
  <div class="name">${NAME}${badge(34)}</div>
  <div class="line grey" style="top:124px">@${pr.handle}</div>
  <div class="line" style="top:162px">${pr.bio.join("<br>")}</div>
  <div class="meta">${[pr.meta?.location ? `<span>${icon("place", 26, "#71767B")}${pr.meta.location}</span>` : pr.meta?.topic ? `<span>${icon("globe", 26, "#71767B")}${pr.meta.topic}</span>` : "", pr.meta?.link ? `<span>${icon("link", 26, "#71767B")}<b style="color:#1D9BF0;font-weight:400">${pr.meta.link}</b></span>` : ""].join("")}</div>
  <div class="line" style="top:308px"><b>${pr.following}</b> <span class="grey">${S.following}</span>&nbsp;&nbsp;&nbsp;<b>${pr.followers}</b> <span class="grey">${S.followers}</span></div>
</section>
<section class="panel" style="${px(P.tabs)}"><div class="tabs">${S.tabs.map((t, i) => `<div class="tab${i ? "" : " on"}">${t}</div>`).join("")}</div><div class="sep" style="bottom:0"></div></section>
<section class="panel" style="${px(P.pinned)}">${postBody({ film, L, post: pinned.post, pinned: true, cover: pinned.cover })}<div class="sep" style="bottom:0"></div></section>
<section class="panel" style="${px(P.retro)}"><div class="av" style="top:16px"></div></section>
<section class="panel" style="${px(P.tabbar)};border-top:2px solid #2F3336">
  <div class="bar">${["home", "search", "people", "bell", "mail"].map((n, i) => icon(n, 40, "currentColor", i ? 1.8 : 2.4)).join("")}</div>
  <div class="home-ind"></div>
</section>
</body></html>`;
}

export function postPage({ film, L, asset, post, cover, w, h }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style(L, asset, film)} html, body { width: ${w}px; height: ${h}px; }</style></head><body>
<section class="panel" style="left:0;top:0;width:${w}px;height:${h}px">${postBody({ film, L, post, pinned: false, cover })}</section>
</body></html>`;
}
