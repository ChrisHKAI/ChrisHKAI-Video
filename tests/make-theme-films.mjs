// Makes portrait test workspaces (films/test-<theme>) from a 16:9 film, one per
// mobile theme, with test values for the profile fields the X film lacks. They
// check how each theme lays out; the numbers in them are not facts.
//
// usage: node tests/make-theme-films.mjs films/isnail [theme...]
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const [src, ...only] = process.argv.slice(2);
const themes = only.length ? only : ["x-mobile", "xhs-mobile", "douyin-mobile", "channels-mobile", "ig-mobile"];
const base = JSON.parse(readFileSync(join(src, "film.json"), "utf8"));
for (const theme of themes) {
  const dir = `films/test-${theme}`;
  mkdirSync(join(dir, "build/lookdev"), { recursive: true });
  for (const d of ["assets", "recipes"]) cpSync(join(src, d), join(dir, d), { recursive: true });
  cpSync(join(src, "toy.json"), join(dir, "toy.json"));
  if (existsSync(join(src, "build/lookdev/avatar-toy.png"))) cpSync(join(src, "build/lookdev/avatar-toy.png"), join(dir, "build/lookdev/avatar-toy.png"));
  const f = structuredClone(base);
  f.id = `test-${theme}`;
  f.theme = theme;
  f.format.size = [1080, 1920];
  f.output = `out/test-${theme}.mp4`;
  f.note = "test values for laying out themes: not facts";
  Object.assign(f.profile, { ip: "广东", likes: "12.6万", posts: "27", title: "自媒体博主", category: "数字创作者", tags: ["AI 博主", "副业"], collections: ["公众号运营", "AI 工具", "副业"] });
  f.posts.pinned.count = "304万";
  f.posts.retro.count = "7.5万";
  f.posts.retro.cover = "assets/cover-large.jpg";
  f.grid = [
    { cover: "assets/banner-real.jpg", count: "2.1万" },
    { cover: "assets/avatar-real.jpg", count: "8,862" },
    { cover: "assets/pinned-cover.jpg", count: "1.4万" },
    { cover: "assets/cover-large.jpg", count: "9,310" },
    { cover: "assets/banner-real.jpg", count: "6,021" },
  ];
  writeFileSync(join(dir, "film.json"), JSON.stringify(f, null, 2) + "\n");
  console.log(dir);
}
