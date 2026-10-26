// 抖音 in the phone app as HTML, filled from film.json: the dark header (name,
// 抖音号), the white sheet (获赞 / 关注 / 粉丝, bio, IP and tags, + 关注), 作品
// with its collection chips and the three-column grid. The 群聊 / 会员 cards
// are left out.
import { icon, px, socket, statusBar, STATUS_CSS, SHADE_CSS, SOCKET_COVER, pictureCover } from "../_shared/icons.js";

export { SOCKET_COVER, pictureCover };
const STRINGS = {
  "zh-Hans": { id: "抖音号：", ip: "IP：", likes: "获赞", following: "关注", followers: "粉丝", follow: "关注", works: "作品", pinned: "置顶" },
  "zh-Hant": { id: "抖音號：", ip: "IP：", likes: "獲讚", following: "關注", followers: "粉絲", follow: "關注", works: "作品", pinned: "置頂" },
};

const css = (L, film, asset) => `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${L.UI_W}px; height: ${L.UI_H}px; background: #fff; overflow: hidden; }
body { font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif; color: #161823; -webkit-font-smoothing: antialiased; }
${STATUS_CSS}
${SHADE_CSS}
.head { position: absolute; left: 0; top: 0; width: 100%; height: 330px; overflow: hidden; background: #101012; }
.head .bg { position: absolute; inset: -10px; background: url(${asset(film.profile.banner ?? film.profile.avatar)}) center/cover; filter: blur(3px) brightness(.28); }
.w { position: absolute; color: #fff; }
.round { position: absolute; top: 74px; height: 50px; min-width: 50px; padding: 0 12px; border-radius: 25px; background: rgba(255,255,255,.12); display: flex; align-items: center; justify-content: center; gap: 6px; color: #fff; font-size: 18px; }
.name { left: 192px; top: 182px; font-size: 30px; font-weight: 700; }
.sub { left: 192px; top: 224px; font-size: 16px; color: rgba(255,255,255,.65); display: flex; gap: 6px; align-items: center; }
.sheet { position: absolute; left: 0; top: 310px; width: 100%; height: 1000px; background: #fff; border-radius: 22px 22px 0 0; }
.stats { position: absolute; left: 23px; top: 330px; display: flex; gap: 22px; align-items: baseline; font-size: 17px; color: rgba(22,24,35,.6); }
.stats b { font-size: 25px; color: #161823; margin-right: 6px; }
.bio { position: absolute; left: 23px; top: 378px; right: 23px; font-size: 18px; line-height: 29px; }
.tags { position: absolute; left: 23px; display: flex; gap: 8px; }
.tags span { font-size: 15px; padding: 4px 8px; border-radius: 4px; background: #F3F3F3; color: rgba(22,24,35,.75); }
.follow { position: absolute; left: 23px; top: 514px; width: 493px; height: 50px; border-radius: 4px; background: ${L.ACCENT}; color: #fff; font-size: 20px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; }
.share { position: absolute; left: 525px; top: 514px; width: 52px; height: 50px; border-radius: 4px; background: #F3F3F3; display: flex; align-items: center; justify-content: center; }
.works { position: absolute; left: 23px; top: 600px; font-size: 21px; font-weight: 600; display: flex; gap: 10px; align-items: center; }
.chips { position: absolute; left: 0; top: 660px; width: 100%; height: 67px; background: #FBFBFB; display: flex; gap: 8px; padding: 10px 14px; overflow: hidden; }
.chips span { display: flex; gap: 6px; align-items: center; font-size: 17px; padding: 0 14px; border-radius: 4px; background: #fff; border: 1px solid #EEE; white-space: nowrap; }
.tile { position: absolute; width: ${L.TILE.w}px; height: ${L.TILE.h}px; overflow: hidden; background: #eee; }
.cover { width: 100%; height: 100%; position: absolute; left: 0; top: 0; }
.tag { position: absolute; left: 10px; top: 10px; background: #FACE15; color: #161823; font-size: 15px; padding: 1px 7px; border-radius: 3px; font-weight: 500; }
.cnt { position: absolute; left: 10px; bottom: 9px; display: flex; gap: 5px; align-items: center; color: #fff; font-size: 17px; font-weight: 500; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
`;

function tile(L, S, post, cover, x, y, pinned) {
  const count = post.count ?? post.counts?.[2] ?? "";
  return `<div class="tile" style="left:${x}px;top:${y}px">${cover}${pinned ? `<span class="tag">${S.pinned}</span>` : ""}
    ${count ? `<span class="cnt">${icon("heart", 22, "#fff", 2)}${count}</span>` : ""}</div>`;
}

export function profilePage({ film, L, asset, pinned }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  const pr = film.profile, T = L.TILE, A = L.ANCHORS;
  const grid = film.grid ?? [];
  const more = (i) => (grid[i] ? { post: grid[i], cover: pictureCover(asset, grid[i].cover) } : { post: {}, cover: "" });
  const tagTop = 378 + pr.bio.length * 29 + 12;
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const k = i + 2, col = k % 3, row = Math.floor(k / 3); // after the pinned work and the second
    const m = more(i % Math.max(1, grid.length));
    cells.push(tile(L, S, m.post, m.cover, col * (T.w + T.gap), T.top + row * (T.h + T.gap), false));
  }
  const second = { post: film.posts.retro, cover: film.posts.retro.cover ? pictureCover(asset, film.posts.retro.cover) : more(4).cover };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L, film, asset)}</style></head><body>
<div class="head"><div class="bg"></div>
  ${statusBar("#fff")}
  <div class="round" style="left:18px">${icon("back", 30, "#fff", 2.2)}</div>
  <div class="round" style="right:150px">${icon("hand", 24, "#fff", 1.8)}求更新</div>
  <div class="round" style="right:86px;padding:0">${icon("search", 28, "#fff", 2.2)}</div>
  <div class="round" style="right:22px;padding:0">${icon("dots", 28, "#fff", 2.2)}</div>
  ${socket(L.AVATAR, [0, 0], "#fff")}
  <div class="w name">${pr.name}</div>
  <div class="w sub">${S.id}${pr.handle}${icon("copy", 16, "rgba(255,255,255,.65)", 2)}</div>
</div>
<div class="sheet"></div>
<div class="stats">${pr.likes ? `<span><b>${pr.likes}</b>${S.likes}</span>` : ""}<span><b>${pr.following}</b>${S.following}</span><span><b>${pr.followers}</b>${S.followers}</span></div>
<div class="bio">${pr.bio.join("<br>")}</div>
<div class="tags" style="top:${tagTop}px">${pr.ip ? `<span>${S.ip}${pr.ip}</span>` : ""}${(pr.tags ?? []).map((t) => `<span>${t}</span>`).join("")}</div>
<div class="follow">+ ${S.follow}</div>
<div class="share">${icon("plane", 28, "#161823", 2)}</div>
<div class="works">${S.works} ${pr.posts ?? ""} ${icon("chevron", 22, "#161823", 2.4)}</div>
${pr.collections?.length ? `<div class="chips">${pr.collections.map((c) => `<span>${icon("layers", 20, "#161823", 1.8)}${c}</span>`).join("")}</div>` : ""}
${tile(L, S, pinned.post, pinned.cover, A.pinnedCover[0], T.top, true)}
${tile(L, S, second.post, second.cover, A.second[0], T.top, true)}
${cells.join("\n")}
</body></html>`;
}

export function postPage({ film, L, asset, post, cover, w, h }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L, film, asset)} html, body { width: ${w}px; height: ${h}px; }</style></head><body>
${tile(L, S, post, cover, 0, 0, true)}
</body></html>`;
}
