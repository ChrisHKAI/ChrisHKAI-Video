// 抖音 in the phone app: a dark header over the creator's banner, a white
// sheet with the counts, bio and the follow button, then the works as a
// three-column grid of 3:4 tiles. 600 UI px wide (1.54 px per pt); 1 UI px =
// 1 mm in the 3D world. The pinned work is the first tile; the second rises
// in the second tile's place. See themes/x-desktop/layout.js for the contract.
export const UI_W = 600;
export const UI_H = 1300;
export const UI_SCALE = 3;

const W = UI_W;
export const TILE = { w: 199, h: 265, gap: 2, top: 727 };
export const PANELS = {
  banner: [0, 0, W, 310], // status bar, buttons, picture, name, 抖音号
  info: [0, 310, W, 286], // counts, bio, tags, follow
  tabs: [0, 596, W, 131], // 作品, the collection chips
  pinned: [0, TILE.top, TILE.w, TILE.h],
  rowRest: [TILE.w + TILE.gap, TILE.top, W - TILE.w - TILE.gap, TILE.h],
  grid: [0, TILE.top + TILE.h + TILE.gap, W, UI_H - TILE.top - TILE.h - TILE.gap],
};
export const AVATAR = { c: [95, 214], d: 143, ring: 4 };
export const ACCENT = "#FE2C55";

const T = TILE;
const second = [T.w + T.gap, T.top, T.w, T.h];
export const ANCHORS = {
  pinnedCover: [0, T.top, T.w, T.h],
  count: [50, T.top + T.h - 20], // the likes, bottom left of the tile
  second,
  secondCover: second,
};
