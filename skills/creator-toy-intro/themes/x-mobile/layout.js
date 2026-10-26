// X (Twitter) in the phone app, dark mode: the profile page as one column, for
// portrait (9:16) films. The page is 600 UI px wide (a 390 pt phone at
// 1.54 px per pt) and one screen tall; 1 UI px = 1 mm in the 3D world. Each
// panel [x, y, w, h] becomes its own glass slab. See themes/x-desktop/layout.js
// for the theme contract.
export const UI_W = 600;
export const UI_H = 1300;
export const UI_SCALE = 3; // screenshotted at 1800 x 3900

const W = UI_W;
export const PANELS = {
  banner: [0, 0, W, 232], // under the status bar, with the back / search / more buttons
  info: [0, 232, W, 348], // follow button, name, handle, bio, meta, counts
  tabs: [0, 580, W, 72],
  pinned: [0, 652, W, 480],
  retro: [0, 1132, W, 40], // the top of the next post, under the tab bar
  tabbar: [0, 1172, W, 128],
};
export const AVATAR = { c: [87, 232], d: 124, ring: 6 };
// a post: the article card sits right of the author's picture
export const CARD = { x: 104, y: 100, w: 472, coverH: 189 };
export const ACTIONS_Y = 440; // the action row (relative to the post's slab)
export const ACTION_X = [0, 118, 236, 354]; // replies, reposts, likes, views (from the card's left)
export const VIEWS_DX = 44; // from the views icon to the middle of its count
export const ACCENT = "#1D9BF0";

const P = PANELS.pinned;
const second = [P[0], P[1] + P[3] + 24, P[2], P[3]];
export const ANCHORS = {
  pinnedCover: [P[0] + CARD.x, P[1] + CARD.y, CARD.w, CARD.coverH],
  count: [P[0] + CARD.x + ACTION_X[3] + VIEWS_DX, P[1] + ACTIONS_Y],
  second,
  secondCover: [second[0] + CARD.x, second[1] + CARD.y, CARD.w, CARD.coverH],
};
