// Instagram in the phone app, light: the profile (picture beside the counts,
// name, bio, link, buttons, highlights), the grid / reels / tagged tabs, then
// the reels as a three-column grid of 9:16 tiles. 600 UI px wide (1.54 px per
// pt); 1 UI px = 1 mm in the 3D world. The pinned reel is the first tile; the
// second rises in the second tile's place. See themes/x-desktop/layout.js for
// the theme contract.
export const UI_W = 600;
export const UI_H = 1300;
export const UI_SCALE = 3;

const W = UI_W;
export const TILE = { w: 199, h: 354, gap: 2, top: 797 };
export const PANELS = {
  header: [0, 0, W, 140], // status bar, back, username, bell, more
  info: [0, 140, W, 457], // picture, counts, name, bio, link, buttons
  tabs: [0, 597, W, 200], // highlights and the three tabs
  pinned: [0, TILE.top, TILE.w, TILE.h],
  rowRest: [TILE.w + TILE.gap, TILE.top, W - TILE.w - TILE.gap, TILE.h],
  grid: [0, TILE.top + TILE.h + TILE.gap, W, UI_H - TILE.top - TILE.h - TILE.gap],
};
export const AVATAR = { c: [82, 217], d: 121, ring: 2 };
export const ACCENT = "#0095F6";

const T = TILE;
const second = [T.w + T.gap, T.top, T.w, T.h];
export const ANCHORS = {
  pinnedCover: [0, T.top, T.w, T.h],
  count: [52, T.top + T.h - 22], // the plays, bottom left of the tile
  second,
  secondCover: second,
};
