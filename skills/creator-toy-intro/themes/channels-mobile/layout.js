// 视频号 (WeChat Channels) in the phone app, light: the profile (name, title,
// location, bio, follow), 视频 with its collections, then a three-column grid
// of 3:4 tiles. 600 UI px wide (1.54 px per pt); 1 UI px = 1 mm in the 3D
// world. The pinned video is the first tile; the second rises in the second
// tile's place. See themes/x-desktop/layout.js for the theme contract.
export const UI_W = 600;
export const UI_H = 1300;
export const UI_SCALE = 3;

const W = UI_W;
export const TILE = { w: 199, h: 265, gap: 2, top: 676 };
export const PANELS = {
  header: [0, 0, W, 120], // status bar, back, search, more
  info: [0, 120, W, 410], // picture, name, title, location, bio, follow
  tabs: [0, 530, W, 146], // 视频, the collections
  pinned: [0, TILE.top, TILE.w, TILE.h],
  rowRest: [TILE.w + TILE.gap, TILE.top, W - TILE.w - TILE.gap, TILE.h],
  grid: [0, TILE.top + TILE.h + TILE.gap, W, UI_H - TILE.top - TILE.h - TILE.gap],
};
export const AVATAR = { c: [78, 195], d: 112, ring: 2 };
export const ACCENT = "#07C160";

const T = TILE;
const second = [T.w + T.gap, T.top, T.w, T.h];
export const ANCHORS = {
  pinnedCover: [0, T.top, T.w, T.h],
  count: [T.w - 46, T.top + T.h - 20], // the likes, bottom right of the tile
  second,
  secondCover: second,
};
