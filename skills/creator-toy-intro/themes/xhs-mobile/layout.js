// 小红书 in the phone app: the profile over a blurred header, then the notes
// as a two-column feed of 3:4 cards. 600 UI px wide (1.54 px per pt); 1 UI px =
// 1 mm in the 3D world. The pinned note is the left card of the first row;
// the second note rises in the right card's place. See
// themes/x-desktop/layout.js for the theme contract.
export const UI_W = 600;
export const UI_H = 1300;
export const UI_SCALE = 3;

const W = UI_W;
export const PANELS = {
  banner: [0, 0, W, 140], // status bar, back, more
  info: [0, 140, W, 415], // picture, name, 小红书号, IP, counts, bio, tags
  tabs: [0, 555, W, 128], // 笔记 / 收藏, the collection chips
  pinned: [0, 683, 300, 517],
  rowRest: [300, 683, 300, 517],
  grid: [0, 1200, W, 100],
};
export const AVATAR = { c: [78, 206], d: 112, ring: 3 };
export const CARD = { margin: 7, gap: 7, w: 290, coverH: 387, top: 683 };
export const ACCENT = "#FF2442";

const C = CARD;
const left = C.margin, right = C.margin + C.w + C.gap;
export const ANCHORS = {
  pinnedCover: [left, C.top, C.w, C.coverH],
  count: [left + C.w - 32, C.top + C.coverH + 88], // the note's likes, bottom right of its card
  second: [right, C.top, C.w, 517],
  secondCover: [right, C.top, C.w, C.coverH],
};
