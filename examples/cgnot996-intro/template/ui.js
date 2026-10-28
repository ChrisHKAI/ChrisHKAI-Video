// The pictures of the platform page this story needs: the whole profile (each
// panel becomes a glass slab) and the second post on its own canvas (it rises
// in act 3). Its cover is an empty socket: the 3D wall stands up from it.
export default function pages({ theme, film, L, asset }) {
  const [, , w, h] = L.ANCHORS.second;
  const pinned = { post: film.posts.pinned, cover: theme.pictureCover(asset, film.posts.pinned.cover) };
  return [
    { html: "ui/profile.html", out: "assets/ui.png", w: L.UI_W, h: L.UI_H, scale: L.UI_SCALE, page: theme.profilePage({ film, L, asset, pinned }) },
    { html: "ui/retro.html", out: "assets/retro.png", w, h, scale: L.UI_SCALE, page: theme.postPage({ film, L, asset, post: film.posts.retro, cover: theme.SOCKET_COVER, w, h }) },
  ];
}
