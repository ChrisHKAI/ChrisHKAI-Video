// Line icons drawn for the themes (24-unit grid, stroke = currentColor).
// They are our own simple drawings, not any platform's artwork.
export const ICONS = {
  back: '<path d="M15 4 7 12l8 8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  dots: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4z"/><path d="M10 21h4"/>',
  heart: '<path d="M12 20s-7.5-4.6-8.6-9.6C2.7 7 5 4.5 7.8 4.5c1.8 0 3.2 1 4.2 2.5 1-1.5 2.4-2.5 4.2-2.5 2.8 0 5.1 2.5 4.4 5.9C19.5 15.4 12 20 12 20z"/>',
  thumb: '<path d="M7 11v9H4v-9zM7 11l4-7c1.4 0 2.3 1.1 2 2.5L12.4 10H19c1.2 0 2 1 1.8 2.1l-1.3 6.2c-.2 1-1 1.7-2 1.7H7"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
  plane: '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m21 3-11 10"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>',
  reels: '<rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" stroke="none"/><path d="M10 8.5v7l6-3.5z" fill="#fff" stroke="none"/>',
  tagged: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17c.8-2.2 2.4-3.4 4.5-3.4s3.7 1.2 4.5 3.4"/>',
  personPlus: '<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.8-4 3.2-6 6.5-6s5.7 2 6.5 6"/><path d="M19 7v6M16 10h6"/>',
  layers: '<path d="m12 4 8.5 4.2L12 12.4 3.5 8.2z"/><path d="m3.5 12.2 8.5 4.2 8.5-4.2M3.5 16.2l8.5 4.2 8.5-4.2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  video: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 3.6-2.4 6-6 6-2.6 0-4.3-1.3-5.5-3.4L4 13.2c-.6-1.1.9-2.1 1.8-1.2L8 14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
};
export const icon = (name, size = 30, colour = "currentColor", width = 1.8) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ""}</svg>`;
export const px = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;
// a cover in a tile or card: the picture, or the empty socket a 3D wall stands up from
export const SOCKET_COVER = `<div class="cover" style="background:#050506;box-shadow:inset 0 10px 30px #000"></div>`;
export const pictureCover = (asset, path) => `<div class="cover" style="background:url(${asset(path)}) center/cover"></div>`;
// the profile picture's socket: the 3D sticker sits in it
export const socket = (av, panel, ring = "#fff") =>
  `<div style="position:absolute;left:${av.c[0] - panel[0] - av.d / 2 - av.ring}px;top:${av.c[1] - panel[1] - av.d / 2 - av.ring}px;width:${av.d + 2 * av.ring}px;height:${av.d + 2 * av.ring}px;border-radius:50%;background:${ring};padding:${av.ring}px"><div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 50% 42%,#0b0c0e 0 58%,#020203 72%);box-shadow:inset 0 10px 24px rgba(0,0,0,.9)"></div></div>`;
export const STATUS_CSS = `.status { position: absolute; left: 0; top: 0; width: 100%; height: 66px; display: flex; align-items: center; justify-content: space-between; padding: 6px 40px 0 50px; font-size: 25px; font-weight: 600; }
.status .bat { display: inline-block; width: 38px; height: 19px; border: 2px solid currentColor; border-radius: 6px; position: relative; }
.status .bat::after { content: ""; position: absolute; left: 3px; top: 3px; width: 24px; height: 9px; background: currentColor; border-radius: 2px; }`;
export const statusBar = (colour) => `<div class="status" style="color:${colour}"><span>9:41</span><span style="display:flex;gap:10px;align-items:center"><svg width="30" height="30" viewBox="0 0 24 24"><path d="M2 18h3v3H2zM7 14h3v7H7zM12 10h3v11h-3zM17 6h3v15h-3z" fill="currentColor"/></svg><i class="bat"></i></span></div>`;
// a shade along a tile's foot so its count reads on any picture
export const SHADE_CSS = `.tile::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 30%; background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.42)); pointer-events: none; }
.tile > span { z-index: 2; }`;
