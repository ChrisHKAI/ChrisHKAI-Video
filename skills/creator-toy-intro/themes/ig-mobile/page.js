// Instagram in the phone app as HTML, filled from film.json: username bar,
// picture beside posts / followers / following, name, category, bio, link,
// the two buttons, highlights, the three tabs (reels selected) and the reels
// grid with plays on each tile.
import { icon, px, socket, statusBar, STATUS_CSS, SHADE_CSS, SOCKET_COVER, pictureCover } from "../_shared/icons.js";

export { SOCKET_COVER, pictureCover };
const STRINGS = {
  "zh-Hans": { posts: "帖子", followers: "粉丝", following: "关注", followed: "已关注", message: "发消息" },
  "zh-Hant": { posts: "貼文", followers: "位粉絲", following: "追蹤中", followed: "追蹤中", message: "發訊息" },
};

const css = (L, film, asset) => `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${L.UI_W}px; height: ${L.UI_H}px; background: #fff; overflow: hidden; }
body { font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif; color: #0C1014; -webkit-font-smoothing: antialiased; }
${STATUS_CSS}
${SHADE_CSS}
.a { position: absolute; }
.user { left: 92px; top: 80px; font-size: 29px; font-weight: 700; }
.dn { left: 173px; top: 164px; right: 20px; font-size: 19px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st { top: 202px; font-size: 17px; line-height: 24px; }
.st b { display: block; font-size: 22px; font-weight: 600; line-height: 28px; }
.cat { left: 23px; top: 290px; font-size: 18px; color: #737373; }
.bio { left: 23px; top: 318px; right: 23px; font-size: 18px; line-height: 27px; }
.link { left: 23px; font-size: 18px; font-weight: 600; display: flex; gap: 8px; align-items: center; }
.btn { position: absolute; top: 527px; height: 44px; width: 273px; border-radius: 10px; background: #EFEFEF; font-size: 18px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; }
.hl { position: absolute; top: 638px; width: 92px; text-align: center; font-size: 15px; }
.hl i { display: block; width: 84px; height: 84px; margin: 0 auto 8px; border-radius: 50%; border: 2px solid #DBDBDB; padding: 4px; background-clip: content-box; }
.tabs { position: absolute; left: 0; top: 750px; width: 100%; height: 47px; display: flex; }
.tabs span { flex: 1; display: flex; justify-content: center; align-items: center; gap: 4px; position: relative; }
.tabs .on::after { content: ""; position: absolute; left: 25%; right: 25%; bottom: -1px; height: 3px; background: #0C1014; }
.tile { position: absolute; width: ${L.TILE.w}px; height: ${L.TILE.h}px; overflow: hidden; background: #efefef; }
.cover { width: 100%; height: 100%; position: absolute; left: 0; top: 0; }
.pinic { position: absolute; right: 10px; top: 10px; filter: drop-shadow(0 1px 3px rgba(0,0,0,.6)); z-index: 2; }
.cnt { position: absolute; left: 10px; bottom: 9px; display: flex; gap: 5px; align-items: center; color: #fff; font-size: 18px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
`;

function tile(post, cover, x, y, pinned) {
  const count = post.count ?? post.counts?.[3] ?? "";
  return `<div class="tile" style="left:${x}px;top:${y}px">${cover}${pinned ? `<span class="pinic">${icon("pin", 26, "#fff", 2.2)}</span>` : ""}
    ${count ? `<span class="cnt">${icon("play", 20, "#fff", 2.2)}${count}</span>` : ""}</div>`;
}

export function profilePage({ film, L, asset, pinned }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  const pr = film.profile, T = L.TILE, A = L.ANCHORS;
  const grid = film.grid ?? [];
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const k = i + 2, col = k % 3, row = Math.floor(k / 3);
    cells.push(tile(grid[i % grid.length] ?? {}, grid.length ? pictureCover(asset, grid[i % grid.length].cover) : "", col * (T.w + T.gap), T.top + row * (T.h + T.gap), false));
  }
  const hl = pr.highlights ?? grid.slice(0, 3).map((g, i) => ({ image: g.cover, label: pr.collections?.[i] ?? "" }));
  const retroCover = film.posts.retro.cover ? pictureCover(asset, film.posts.retro.cover) : "";
  const linkTop = 318 + pr.bio.length * 27 + 8;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L, film, asset)}</style></head><body>
${statusBar("#0C1014")}
<div class="a" style="left:22px;top:82px">${icon("back", 38, "#0C1014", 2)}</div>
<div class="a user">${pr.handle}</div>
<div class="a" style="right:84px;top:82px">${icon("bell", 36, "#0C1014", 1.9)}</div>
<div class="a" style="right:22px;top:82px">${icon("dots", 36, "#0C1014", 2)}</div>
${socket(L.AVATAR, [0, 0], "#fff")}
<div class="a dn">${pr.name}</div>
<div class="a st" style="left:173px">${pr.posts ? `<b>${pr.posts}</b>${S.posts}` : ""}</div>
<div class="a st" style="left:301px"><b>${pr.followers}</b>${S.followers}</div>
<div class="a st" style="left:448px"><b>${pr.following}</b>${S.following}</div>
${pr.category ? `<div class="a cat">${pr.category}</div>` : ""}
<div class="a bio">${pr.bio.join("<br>")}</div>
${pr.meta?.link ? `<div class="a link" style="top:${linkTop}px">${icon("link", 22, "#0C1014", 2)}${pr.meta.link}</div>` : ""}
<div class="btn" style="left:23px;top:${Math.min(527, linkTop + 58)}px">${S.followed} ${icon("chevron", 20, "#0C1014", 2.2)}</div>
<div class="btn" style="left:304px;top:${Math.min(527, linkTop + 58)}px">${S.message}</div>
${hl.map((h, i) => `<div class="hl" style="left:${19 + i * 115}px"><i style="background:url(${asset(h.image)}) center/cover content-box"></i>${h.label}</div>`).join("")}
<div class="tabs"><span>${icon("grid", 32, "#737373", 1.6)}</span><span class="on">${icon("reels", 34, "#0C1014", 1.6)}${icon("chevron", 18, "#0C1014", 2.2)}</span><span>${icon("tagged", 32, "#737373", 1.6)}</span></div>
${tile(pinned.post, pinned.cover, A.pinnedCover[0], T.top, true)}
${tile(film.posts.retro, retroCover, A.second[0], T.top, true)}
${cells.join("\n")}
</body></html>`;
}

export function postPage({ film, L, asset, post, cover, w, h }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L, film, asset)} html, body { width: ${w}px; height: ${h}px; }</style></head><body>
${tile(post, cover, 0, 0, true)}
</body></html>`;
}
