// The pictures of the platform page this story needs: the whole profile (each
// panel becomes a glass slab) and the second post on its own canvas (it rises
// in act 3). Its cover is an empty socket: the 3D wall stands up from it.
import { readFileSync } from "node:fs";

const STORY = JSON.parse(readFileSync(new URL("./story.json", import.meta.url), "utf8"));

// a film of its own beats that plays none of the story's page (its opening its own, an Instagram or a site, then the
// end card) never shows these pictures; the slabs still load them, so they are blank, and need no banner or posts
function pageless(film) {
  const segs = film.story?.segments ?? [];
  const bar = (60 / (film.format?.bpm ?? 120)) * 4, end = STORY.pieces.endCard[0];
  return segs.length > 0 && segs.every((s) => (s.beat ? s.beat !== "page-stand" : s.story === "endCard" || (Array.isArray(s.story) && s.story[0] > end - bar)));
}

export default function pages({ theme, film, L, asset }) {
  const [, , w, h] = L.ANCHORS.second;
  if (pageless(film)) {
    const blank = "<!doctype html><html><body style=\"margin:0;background:#000\"></body></html>";
    return [
      { html: "ui/profile.html", out: "assets/ui.png", w: L.UI_W, h: L.UI_H, scale: 1, page: blank },
      { html: "ui/retro.html", out: "assets/retro.png", w, h, scale: 1, page: blank },
    ];
  }
  const pinned = { post: film.posts.pinned, cover: theme.pictureCover(asset, film.posts.pinned.cover) };
  return [
    { html: "ui/profile.html", out: "assets/ui.png", w: L.UI_W, h: L.UI_H, scale: L.UI_SCALE, page: theme.profilePage({ film, L, asset, pinned }) },
    { html: "ui/retro.html", out: "assets/retro.png", w, h, scale: L.UI_SCALE, page: theme.postPage({ film, L, asset, post: film.posts.retro, cover: theme.SOCKET_COVER, w, h }) },
  ];
}
