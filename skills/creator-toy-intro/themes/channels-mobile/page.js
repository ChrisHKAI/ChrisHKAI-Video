// 视频号 (WeChat Channels) in the phone app as HTML, filled from film.json:
// name, title with its badge, location, bio, original works, follow / message,
// 视频 with its collections, and the grid with likes on each tile.
import { icon, px, socket, statusBar, STATUS_CSS, SHADE_CSS, SOCKET_COVER, pictureCover } from "../_shared/icons.js";

export { SOCKET_COVER, pictureCover };
const STRINGS = {
  "zh-Hans": { follow: "关注", message: "私信", videos: "视频", originals: "条原创内容", friends: "个朋友关注" },
  "zh-Hant": { follow: "關注", message: "訊息", videos: "影片", originals: "則原創內容", friends: "個朋友關注" },
};
// a gold rosette with a tick: a generic verified mark
const BADGE = '<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#F7B500" d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z"/><path d="m8 12.2 2.7 2.6L16 9.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const css = (L) => `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${L.UI_W}px; height: ${L.UI_H}px; background: #fff; overflow: hidden; }
body { font-family: "PingFang SC", -apple-system, "Helvetica Neue", sans-serif; color: #111; -webkit-font-smoothing: antialiased; }
${STATUS_CSS}
${SHADE_CSS}
.a { position: absolute; }
.name { left: 153px; top: 146px; font-size: 26px; font-weight: 600; }
.title { left: 153px; top: 186px; font-size: 19px; display: flex; gap: 5px; align-items: center; }
.loc { left: 153px; top: 218px; font-size: 18px; color: #888; }
.bio { left: 28px; top: 270px; right: 28px; font-size: 19px; line-height: 30px; }
.grey { color: #888; font-size: 18px; }
.btn { position: absolute; top: 448px; height: 57px; width: 266px; border-radius: 8px; font-size: 20px; font-weight: 500; display: flex; align-items: center; justify-content: center; }
.tab { left: 28px; top: 536px; font-size: 21px; font-weight: 600; }
.tab::after { content: ""; position: absolute; left: -2px; right: -2px; bottom: -10px; height: 3px; background: #111; border-radius: 2px; }
.cols { left: 28px; top: 592px; right: 10px; display: flex; flex-wrap: wrap; gap: 14px 26px; font-size: 19px; color: #666; }
.cols span { display: flex; gap: 6px; align-items: center; }
.tile { position: absolute; width: ${L.TILE.w}px; height: ${L.TILE.h}px; overflow: hidden; background: #eee; }
.cover { width: 100%; height: 100%; position: absolute; left: 0; top: 0; }
.cnt { position: absolute; right: 10px; bottom: 9px; display: flex; gap: 5px; align-items: center; color: #fff; font-size: 17px; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
`;

function tile(post, cover, x, y) {
  const count = post.count ?? post.counts?.[2] ?? "";
  return `<div class="tile" style="left:${x}px;top:${y}px">${cover}${count ? `<span class="cnt">${icon("thumb", 20, "#fff", 2)}${count}</span>` : ""}</div>`;
}

export function profilePage({ film, L, asset, pinned }) {
  const S = STRINGS[film.language] ?? STRINGS["zh-Hans"];
  const pr = film.profile, T = L.TILE, A = L.ANCHORS;
  const grid = film.grid ?? [];
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const k = i + 2, col = k % 3, row = Math.floor(k / 3);
    cells.push(tile(grid[i % grid.length] ?? {}, grid.length ? pictureCover(asset, grid[i % grid.length].cover) : "", col * (T.w + T.gap), T.top + row * (T.h + T.gap)));
  }
  const retroCover = film.posts.retro.cover ? pictureCover(asset, film.posts.retro.cover) : "";
  const bioBottom = 270 + pr.bio.length * 30;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L)}</style></head><body>
${statusBar("#111")}
<div class="a" style="left:18px;top:78px">${icon("back", 36, "#111", 2)}</div>
<div class="a" style="right:76px;top:78px">${icon("search", 34, "#111", 2)}</div>
<div class="a" style="right:20px;top:78px">${icon("dots", 34, "#111", 2)}</div>
${socket(L.AVATAR, [0, 0], "#f2f2f2")}
<div class="a name">${pr.name}</div>
${pr.title ? `<div class="a title">${pr.title}${BADGE}</div>` : ""}
${pr.ip ? `<div class="a loc">${pr.ip}</div>` : ""}
<div class="a bio">${pr.bio.join("<br>")}</div>
${pr.posts ? `<div class="a grey" style="left:28px;top:${bioBottom + 10}px">${pr.posts} ${S.originals}</div>` : ""}
<div class="btn" style="left:28px;background:${L.ACCENT};color:#fff">${S.follow}</div>
<div class="btn" style="left:305px;background:#F2F2F2;color:#111">${S.message}</div>
<div class="a tab">${S.videos}</div>
${pr.collections?.length ? `<div class="a cols">${pr.collections.map((c) => `<span>${icon("video", 24, "#888", 1.6)}${c}</span>`).join("")}</div>` : ""}
${tile(pinned.post, pinned.cover, A.pinnedCover[0], T.top)}
${tile(film.posts.retro, retroCover, A.second[0], T.top)}
${cells.join("\n")}
</body></html>`;
}

export function postPage({ film, L, asset, post, cover, w, h }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css(L)} html, body { width: ${w}px; height: ${h}px; }</style></head><body>
${tile(post, cover, 0, 0)}
</body></html>`;
}
