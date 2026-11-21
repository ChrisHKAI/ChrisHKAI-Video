// The pictures of the platform page this story needs: the whole profile (each
// panel becomes a glass slab) and the second post on its own canvas (it rises
// in act 3). Its cover is an empty socket: the 3D wall stands up from it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STORY = JSON.parse(readFileSync(new URL("./story.json", import.meta.url), "utf8"));

// a film of its own beats that plays none of the story's page (its opening its own, an Instagram or a site, then the
// end card) never shows these pictures; the slabs still load them, so they are blank, and need no banner or posts.
// Opt in with film.story.profilePage = true, or automatically when any custom beat file references assets/ui.png.
export function pageless(film, filmDir = process.env.FILM) {
  if (film.story?.profilePage === true) return false;
  const segs = film.story?.segments ?? [];
  const bar = (60 / (film.format?.bpm ?? 120)) * 4, end = STORY.pieces.endCard[0];
  const allCustom = segs.length > 0 && segs.every((s) => (s.beat ? s.beat !== "page-stand" : s.story === "endCard" || (Array.isArray(s.story) && s.story[0] > end - bar)));
  if (!allCustom) return false;
  if (filmDir) {
    for (const s of segs) {
      if (!s.beat) continue;
      const p = join(filmDir, s.beat);
      if (existsSync(p) && /assets\/ui\.png/.test(readFileSync(p, "utf8"))) return false;
    }
  }
  return true;
}

export default function pages({ theme, film, L, asset, filmDir = process.env.FILM }) {
  const [, , w, h] = L.ANCHORS.second;
  const blank = "<!doctype html><html><body style=\"margin:0;background:#000\"></body></html>";
  if (pageless(film, filmDir)) {
    return [
      { html: "ui/profile.html", out: "assets/ui.png", w: L.UI_W, h: L.UI_H, scale: 1, page: blank },
      { html: "ui/retro.html", out: "assets/retro.png", w, h, scale: 1, page: blank },
    ];
  }
  const pinned = film.posts?.pinned ? { post: film.posts.pinned, cover: theme.pictureCover(asset, film.posts.pinned.cover) } : null;
  const retro = film.posts?.retro
    ? { html: "ui/retro.html", out: "assets/retro.png", w, h, scale: L.UI_SCALE, page: theme.postPage({ film, L, asset, post: film.posts.retro, cover: theme.SOCKET_COVER, w, h }) }
    : { html: "ui/retro.html", out: "assets/retro.png", w, h, scale: 1, page: blank };
  return [
    { html: "ui/profile.html", out: "assets/ui.png", w: L.UI_W, h: L.UI_H, scale: L.UI_SCALE, page: theme.profilePage({ film, L, asset, pinned }) },
    retro,
  ];
}
