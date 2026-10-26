// X (Twitter) on the desktop web, dark mode: where everything sits on the page.
// The page is laid out on a 1920 x 1440 workspace in UI px; 1 UI px = 1 mm in
// the 3D world. Each panel [x, y, w, h] becomes its own glass slab.
export const UI_W = 1920;
export const UI_H = 1440;
export const UI_SCALE = 2; // the page is screenshotted at 3840 x 2880

const MX = 600, MW = 600; // the main column
export const PANELS = {
  nav: [340, 0, 250, 1440],
  header: [MX, 0, MW, 56],
  banner: [MX, 56, MW, 200],
  info: [MX, 256, MW, 330],
  tabs: [MX, 586, MW, 54],
  pinned: [MX, 640, MW, 424],
  retro: [MX, 1064, MW, 376],
  side: [1230, 0, 350, 1440],
};
// the profile picture: a sticker over the banner / info seam
export const AVATAR = { c: [MX + 16 + 67, 256], d: 134, ring: 4 };
// an article card inside a post slab (relative to the slab), cover 5:2
export const CARD = { x: 68, y: 66, w: 516, coverH: 206 };
export const ACTIONS_Y = 396; // the action bar row (relative to the slab)
export const ACTION_X = [0, 132, 264, 384]; // replies, reposts, likes, views
export const VIEWS_DX = 52; // from the views icon to the middle of its count
export const ACCENT = "#1D9BF0"; // X blue: the selected post's outline, the count's bar
