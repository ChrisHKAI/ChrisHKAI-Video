// X (Twitter) on the desktop web, dark mode, as HTML: the profile page and a
// single post, filled from film.json. No platform logos ship with the theme:
// film.json "branding" may supply them (the site mark and the verified badge)
// from the creator's own copies.
//
//   profilePage({ film, L, asset })            → the whole page, UI_W x UI_H
//   postPage({ film, L, asset, post, cover })  → one post on its own canvas
// `asset(path)` turns a workspace path into a url() argument; `cover` is the
// HTML of the post's cover slot (a picture, or an empty socket the 3D wall
// stands up from).
export const STRINGS = {
  "zh-Hans": {
    nav: ["主页", "探索", "通知", "私信", "Grok", "书签", "社群", "个人资料", "更多"],
    post: "发帖", subscribe: "订阅", follow: "关注", following: "正在关注", followers: "关注者",
    tabs: ["帖子", "回复", "亮点", "文章", "媒体", "喜欢"], pinned: "已置顶", article: "文章",
    search: "搜索", whoToFollow: "你可能会喜欢", trends: "有什么新鲜事",
  },
};

export const ICON = {
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
  pin: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
  reply: '<path d="M4 11.5C4 7.4 7.6 4.5 12 4.5s8 2.9 8 7-3.6 7-8 7c-1 0-2-.1-2.9-.4L5 20l.9-3.6C4.7 15.1 4 13.4 4 11.5z"/>',
  repost: '<path d="M4 9V7h12l-3-3M20 15v2H8l3 3"/><path d="M16 4l3 3-3 3M8 20l-3-3 3-3"/>',
  like: '<path d="M12 20s-7.5-4.6-8.6-9.6C2.7 7 5 4.5 7.8 4.5c1.8 0 3.2 1 4.2 2.5 1-1.5 2.4-2.5 4.2-2.5 2.8 0 5.1 2.5 4.4 5.9C19.5 15.4 12 20 12 20z"/>',
  views: '<path d="M5 20V12M10 20V5M15 20v-9M20 20V8"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};

function kit({ film, L }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  const B = film.branding ?? {};
  const icon = (n, s = 26, c = "currentColor", w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${n === "x" ? B.logo ?? "" : ICON[n]}</svg>`;
  const badge = (s = 20) => (B.badge ? `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${B.badge}</svg>` : "");
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
.b { font-weight: 700; }
.row { display: flex; align-items: center; }
.socket { position: absolute; border-radius: 50%; background: radial-gradient(circle at 50% 42%, #0b0c0e 0 58%, #020203 72%); box-shadow: inset 0 10px 22px rgba(0,0,0,.95), 0 0 0 2px #16181c; }
/* nav */
.nav-item { position: absolute; left: 12px; display: flex; align-items: center; gap: 20px; font-size: 20px; height: 50px; padding: 0 12px; }
.nav-item.on { font-weight: 700; }
.post-btn { position: absolute; left: 12px; width: 226px; height: 52px; border-radius: 26px; background: #EFF3F4; color: #0F1419; font-weight: 700; font-size: 17px; display: flex; align-items: center; justify-content: center; }
/* profile */
.hdr { position: absolute; left: 16px; top: 4px; display: flex; align-items: center; gap: 30px; }
.hdr .t { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
.hdr .s { font-size: 13px; color: #71767B; margin-top: 1px; }
.btn { position: absolute; top: 12px; height: 36px; border-radius: 18px; font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.name { position: absolute; left: 16px; font-size: 20px; font-weight: 800; display: flex; align-items: center; gap: 4px; }
.line { position: absolute; left: 16px; font-size: 15px; line-height: 20px; }
.meta { position: absolute; left: 16px; display: flex; gap: 14px; font-size: 15px; color: #71767B; }
.meta span { display: flex; align-items: center; gap: 4px; }
.tabs { display: flex; height: 54px; }
.tab { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #71767B; position: relative; font-weight: 500; }
.tab.on { color: #E7E9EA; font-weight: 700; }
.tab.on::after { content: ""; position: absolute; bottom: 0; width: 56px; height: 4px; border-radius: 2px; background: #1D9BF0; }
/* posts */
.post-top { position: absolute; left: 16px; font-size: 13px; color: #71767B; font-weight: 700; display: flex; align-items: center; gap: 12px; }
.av { position: absolute; left: 16px; top: 34px; width: 40px; height: 40px; border-radius: 50%; background: url(${avatar}) center/cover; }
.who { position: absolute; left: 68px; top: 34px; font-size: 15px; display: flex; align-items: center; gap: 4px; }
.card { position: absolute; left: ${L.CARD.x}px; top: ${L.CARD.y}px; width: ${L.CARD.w}px; border: 1px solid #2F3336; border-radius: 16px; overflow: hidden; }
.cover { width: 100%; height: ${L.CARD.coverH}px; position: relative; }
.card .tt { padding: 12px 14px 4px; font-size: 17px; font-weight: 700; line-height: 23px; min-height: 62px; }
.card .chip { margin: 6px 14px 12px; display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: #71767B; }
.acts { position: absolute; top: ${L.ACTIONS_Y - 12}px; left: ${L.CARD.x}px; width: ${L.CARD.w}px; height: 24px; font-size: 13px; color: #71767B; }
.acts span { position: absolute; display: flex; align-items: center; gap: 6px; height: 24px; }
.sep { position: absolute; left: 0; width: 100%; height: 1px; background: #2F3336; }
/* sidebar skeletons */
.search { position: absolute; left: 0; top: 8px; width: 350px; height: 44px; border-radius: 22px; background: #202327; display: flex; align-items: center; gap: 12px; padding-left: 18px; color: #71767B; font-size: 15px; }
.box { position: absolute; left: 0; width: 350px; border: 1px solid #2F3336; border-radius: 16px; padding: 12px 16px; }
.box h4 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
.sk { display: flex; align-items: center; gap: 12px; height: 64px; }
.sk i { display: block; background: #202327; border-radius: 6px; }
`;
const style = (L, asset, film) => css(L, asset(film.profile.avatar));
const px = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;

function postBody({ film, L, post, pinned, cover }) {
  const { S, icon, badge, pr, NAME } = kit({ film, L });
  const names = ["reply", "repost", "like", "views"];
  const actions = `<div class="acts">${names.map((n, i) => `<span style="left:${L.ACTION_X[i]}px">${icon(n, 19, "#71767B", 1.7)}${post.counts[i]}</span>`).join("")}
    <span style="right:34px">${icon("bookmark", 19, "#71767B", 1.7)}</span><span style="right:0">${icon("share", 19, "#71767B", 1.7)}</span></div>`;
  return `${pinned ? `<div class="post-top" style="top:12px;left:40px">${icon("pin", 14, "#71767B", 2)}${S.pinned}</div>` : ""}
    <div class="av"></div>
    <div class="who"><b>${NAME}</b>${badge(18)}<span class="grey">@${pr.handle} · ${post.date}</span><span style="margin-left:auto"></span></div>
    <div class="card">${cover}<div class="tt">${post.title}</div><div class="chip">${icon("mail", 15, "#71767B")}${S.article}</div></div>
    ${actions}`;
}

// the empty socket a 3D object stands in (the profile picture, a cover wall)
export const SOCKET_COVER = `<div class="cover" style="background:#050506;box-shadow:inset 0 8px 24px #000"></div>`;
export const pictureCover = (asset, path) => `<div class="cover" style="background:url(${asset(path)}) center/cover"></div>`;

export function profilePage({ film, L, asset, pinned, below }) {
  const { S, icon, badge, pr, NAME } = kit({ film, L });
  const P = L.PANELS, av = L.AVATAR;
  const socket = (panelY) => `<div class="socket" style="left:${av.c[0] - P.info[0] - av.d / 2 - 2}px;top:${av.c[1] - panelY - av.d / 2 - 2}px;width:${av.d + 4}px;height:${av.d + 4}px"></div>`;
  const navIcons = ["home", "search", "bell", "mail", "grok", "bookmark", "people", "user", "more"];
  const navItems = navIcons.map((n, i) => [n, S.nav[i], n === "user"]);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style(L, asset, film)}</style></head><body>
<section class="panel" style="${px(P.nav)}">
  <div style="position:absolute;left:24px;top:14px">${icon("x", 30)}</div>
  ${navItems.map(([n, l, on], i) => `<div class="nav-item${on ? " on" : ""}" style="top:${70 + i * 58}px">${icon(n, 28, "currentColor", on ? 2.4 : 1.8)}${l}</div>`).join("")}
  <div class="post-btn" style="top:${70 + navItems.length * 58 + 20}px">${S.post}</div>
</section>
<section class="panel" style="${px(P.header)}">
  <div class="hdr">${icon("back", 22)}<div><div class="t">${NAME}${badge(20)}</div><div class="s">${pr.postsCount}</div></div></div>
</section>
<section class="panel" style="${px(P.banner)};background:url(${asset(pr.banner)}) center/cover">${socket(P.banner[1])}</section>
<section class="panel" style="${px(P.info)}">
  ${socket(P.info[1])}
  <div class="btn" style="right:206px;width:36px;border:1px solid #536471">${icon("dots", 20)}</div>
  <div class="btn" style="right:118px;width:78px;border:1px solid #536471">${S.subscribe}</div>
  <div class="btn" style="right:16px;width:92px;background:#EFF3F4;color:#0F1419">${S.follow}</div>
  <div class="name" style="top:84px">${NAME}${badge(22)}</div>
  <div class="line grey" style="top:114px">@${pr.handle}</div>
  <div class="line" style="top:148px">${pr.bio.join("<br>")}</div>
  <div class="meta" style="top:222px"><span>${icon("globe", 18, "#71767B")}${pr.meta.topic}</span><span>${icon("link", 18, "#71767B")}<b style="color:#1D9BF0;font-weight:400">${pr.meta.link}</b></span><span>${icon("cal", 18, "#71767B")}${pr.meta.joined}</span></div>
  <div class="line" style="top:258px"><b>${pr.following}</b> <span class="grey">${S.following}</span>&nbsp;&nbsp;&nbsp;&nbsp;<b>${pr.followers}</b> <span class="grey">${S.followers}</span></div>
</section>
<section class="panel" style="${px(P.tabs)}"><div class="tabs">${S.tabs.map((t, i) => `<div class="tab${i ? "" : " on"}">${t}</div>`).join("")}</div><div class="sep" style="bottom:0"></div></section>
<section class="panel" style="${px(P.pinned)}">${postBody({ film, L, post: pinned.post, pinned: true, cover: pinned.cover })}<div class="sep" style="bottom:0"></div></section>
<section class="panel" style="${px(P.retro)}">
  <div class="av" style="top:14px"></div>
  <div style="position:absolute;left:68px;top:18px">${[[180, 14], [460, 14], [400, 14], [300, 14]].map(([w, h], i) => `<i style="display:block;width:${w}px;height:${h}px;margin-bottom:12px;background:#16181c;border-radius:7px"></i>`).join("")}</div>
</section>
<section class="panel" style="${px(P.side)}">
  <div class="search">${icon("search", 18, "#71767B")}${S.search}</div>
  <div class="box" style="top:72px"><h4>${S.whoToFollow}</h4>${[0, 1, 2].map(() => `<div class="sk"><i style="width:40px;height:40px;border-radius:50%"></i><div><i style="width:120px;height:12px;margin-bottom:8px"></i><i style="width:80px;height:10px"></i></div><i style="margin-left:auto;width:72px;height:32px;border-radius:16px;background:#EFF3F4"></i></div>`).join("")}</div>
  <div class="box" style="top:370px"><h4>${S.trends}</h4>${[0, 1, 2, 3].map(() => `<div class="sk" style="height:58px;display:block;padding-top:10px"><i style="width:140px;height:10px;margin-bottom:9px"></i><i style="width:200px;height:13px"></i></div>`).join("")}</div>
</section>
</body></html>`;
}

export function postPage({ film, L, asset, post, cover, w, h }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style(L, asset, film)} html, body { width: ${w}px; height: ${h}px; }</style></head><body>
<section class="panel" style="left:0;top:0;width:${w}px;height:${h}px">${postBody({ film, L, post, pinned: false, cover })}</section>
</body></html>`;
}
