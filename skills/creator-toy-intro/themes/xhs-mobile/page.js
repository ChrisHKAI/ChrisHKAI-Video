// 小红书 in the phone app as HTML, filled from film.json: the header over the
// creator's blurred banner (name, 小红书号, IP, counts, bio, tags), the 笔记 /
// 收藏 tabs and the two-column note feed. The 群聊 / 直播 cards and the follow
// buttons are left out, as on a creator's own page.
import { icon, px, socket, statusBar, STATUS_CSS, SOCKET_COVER, pictureCover } from "../_shared/icons.js";

export { SOCKET_COVER, pictureCover };
const STRINGS = {
  "zh-Hans": { id: "小红书号：", ip: "IP属地：", following: "关注", followers: "粉丝", likes: "获赞与收藏", tabs: ["笔记", "收藏"], pinned: "置顶" },
  "zh-Hant": { id: "小紅書號：", ip: "IP：", following: "追蹤中", followers: "粉絲", likes: "獲讚與收藏", tabs: ["筆記", "收藏"], pinned: "置頂" },
};

const css = (L, film, asset) => `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${L.UI_W}px; height: ${L.UI_H}px; background: #F5F5F5; overflow: hidden; }
body { font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif; color: #222; -webkit-font-smoothing: antialiased; }
${STATUS_CSS}
.head { position: absolute; left: 0; top: 0; width: 100%; height: 600px; overflow: hidden; }
.head .bg { position: absolute; inset: -60px; background: url(${asset(film.profile.banner ?? film.profile.avatar)}) center/cover; filter: blur(38px) brightness(.55) saturate(.8); }
.head .bg::after { content: ""; position: absolute; inset: 0; background: rgba(60, 52, 46, .35); }
.w { color: #fff; position: absolute; }
.name { left: 158px; top: 148px; font-size: 29px; font-weight: 700; }
.sub { left: 158px; font-size: 16px; color: rgba(255,255,255,.7); display: flex; gap: 6px; align-items: center; }
.stats { left: 24px; top: 288px; display: flex; gap: 26px; align-items: baseline; font-size: 16px; color: rgba(255,255,255,.85); }
.stats b { font-size: 22px; color: #fff; margin-right: 5px; }
.bio { left: 24px; top: 334px; right: 24px; font-size: 18px; line-height: 28px; }
.tags { left: 24px; display: flex; gap: 10px; }
.tags span { font-size: 14px; padding: 5px 12px; border-radius: 14px; background: rgba(255,255,255,.18); color: rgba(255,255,255,.9); }
.sheet { position: absolute; left: 0; top: 555px; width: 100%; height: 760px; background: #F7F7F7; border-radius: 18px 18px 0 0; }
.tabsrow { height: 56px; background: #fff; border-radius: 18px 18px 0 0; display: flex; align-items: center; padding: 0 28px; gap: 44px; position: relative; font-size: 20px; color: #999; }
.tabsrow .on { color: #222; font-weight: 700; position: relative; }
.tabsrow .on::after { content: ""; position: absolute; left: 50%; bottom: -12px; transform: translateX(-50%); width: 30px; height: 4px; border-radius: 2px; background: ${L.ACCENT}; }
.chips { display: flex; gap: 8px; padding: 10px 7px; }
.chips span { display: flex; gap: 6px; align-items: center; font-size: 16px; padding: 8px 14px; border-radius: 6px; background: #fff; color: #333; }
.card { position: absolute; width: ${L.CARD.w}px; background: #fff; border-radius: 8px; overflow: hidden; }
.cover { width: 100%; height: ${L.CARD.coverH}px; position: relative; }
.pin { position: absolute; left: 10px; top: 10px; background: ${L.ACCENT}; color: #fff; font-size: 14px; padding: 2px 8px; border-radius: 10px; }
.tt { padding: 9px 12px 0; font-size: 18px; line-height: 25px; height: 59px; overflow: hidden; color: #222; }
.by { display: flex; align-items: center; gap: 7px; padding: 8px 12px 12px; font-size: 14px; color: #666; }
.by i { width: 24px; height: 24px; border-radius: 50%; background: url(${asset(film.profile.avatar)}) center/cover; }
.by .n { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.by .c { display: flex; gap: 4px; align-items: center; }
`;

function card(L, film, S, post, cover, x, y, pinned) {
  const count = post.count ?? post.counts?.[2] ?? "";
  return `<div class="card" style="left:${x}px;top:${y}px">${cover}${pinned ? `<span class="pin">${S.pinned}</span>` : ""}
    <div class="tt">${post.title}</div>
    <div class="by"><i></i><span class="n">${film.profile.name}</span><span class="c">${icon("heart", 18, "#666", 2)}${count}</span></div></div>`;
}

export function profilePage({ film, L, asset, pinned }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  const pr = film.profile, C = L.CARD, A = L.ANCHORS;
  const grid = film.grid ?? [];
  const tile = (i) => grid[i] ? pictureCover(asset, grid[i].cover) : `<div class="cover" style="background:#e9e9e9"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L, film, asset)}</style></head><body>
<div class="head"><div class="bg"></div>
  ${statusBar("#fff")}
  <div class="w" style="left:20px;top:78px">${icon("back", 36, "#fff", 2.2)}</div>
  <div class="w" style="right:22px;top:78px">${icon("dots", 36, "#fff", 2.2)}</div>
  ${socket(L.AVATAR, [0, 0], "rgba(255,255,255,.85)")}
  <div class="w name">${pr.name}</div>
  <div class="w sub" style="top:192px">${S.id}${pr.handle}${icon("copy", 16, "rgba(255,255,255,.7)", 2)}</div>
  ${pr.ip ? `<div class="w sub" style="top:220px">${S.ip}${pr.ip}</div>` : ""}
  <div class="w stats"><span><b>${pr.following}</b>${S.following}</span><span><b>${pr.followers}</b>${S.followers}</span>${pr.likes ? `<span><b>${pr.likes}</b>${S.likes}</span>` : ""}</div>
  <div class="w bio">${pr.bio.join("<br>")}</div>
  ${pr.tags?.length ? `<div class="w tags" style="top:${334 + pr.bio.length * 28 + 22}px">${pr.tags.map((t) => `<span>${t}</span>`).join("")}</div>` : ""}
</div>
<div class="sheet">
  <div class="tabsrow"><span class="on">${S.tabs[0]}</span><span>${S.tabs[1]}</span><span style="margin-left:auto">${icon("search", 30, "#999", 2)}</span></div>
  ${pr.collections?.length ? `<div class="chips">${pr.collections.map((c) => `<span>${icon("layers", 20, "#333", 1.8)}${c}</span>`).join("")}</div>` : ""}
</div>
${card(L, film, S, pinned.post, pinned.cover, A.pinnedCover[0], C.top, true)}
${card(L, film, S, film.posts.retro, film.posts.retro.cover ? pictureCover(asset, film.posts.retro.cover) : tile(0), A.secondCover[0], C.top, true)}
${card(L, film, S, { title: "", count: "" }, tile(1), A.pinnedCover[0], C.top + 524, false)}
${card(L, film, S, { title: "", count: "" }, tile(2), A.secondCover[0], C.top + 524, false)}
</body></html>`;
}

export function postPage({ film, L, asset, post, cover, w, h }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L, film, asset)} html, body { width: ${w}px; height: ${h}px; background: transparent; }</style></head><body>
${card(L, film, S, post, cover, 0, 0, true)}
</body></html>`;
}
