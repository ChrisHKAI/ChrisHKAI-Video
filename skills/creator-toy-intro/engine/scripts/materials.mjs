// Step 2's material table: every post the research found as a numbered card
// (its screenshot or cover, title, date and numbers), the profile above them,
// the candidates for each story slot below, each with why it was picked, then
// what each material becomes (posts, and ideas with no picture: facts.json
// "becomes", the animations in beats/catalog.json) and the whole menu of them.
// The user looks at it and picks; the screenshots never go into the film.
//
// usage: node engine/scripts/materials.mjs <film folder> [--lang zh-Hant|zh-Hans|en]
// reads research/facts.json → research/materials.html, research/materials.png
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findChrome } from "../lib/tools.js";

const argv = process.argv.slice(2);
const dir = resolve(argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--lang") ?? process.env.FILM ?? ".");
const facts = JSON.parse(readFileSync(join(dir, "research/facts.json"), "utf8"));
const film = existsSync(join(dir, "film.json")) ? JSON.parse(readFileSync(join(dir, "film.json"), "utf8")) : {};
const lang = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : film.language ?? "zh-Hans";
const T = {
  "zh-Hans": { title: "素材表", pinned: "置顶", proof1: "证据一：数字升起的帖子", proof2: "证据二：封面企起做墙的帖子", cta: "结尾：口号和道具", other: "其他：直接讲", ask: "用这几个做素材好不好？", becomes: "素材 → 动画", idea: "想法", menu: "还可以变成这些动画（没有图的想法也行）" },
  "zh-Hant": { title: "素材表", pinned: "置頂", proof1: "證據一：數字升起嘅帖", proof2: "證據二：封面企起做牆嘅帖", cta: "結尾：口號同道具", other: "其他：直接講", ask: "用呢幾個做素材好唔好？", becomes: "素材 → 動畫", idea: "想法", menu: "仲可以變成呢啲動畫（冇圖嘅想法都得）" },
  en: { title: "Material", pinned: "pinned", proof1: "Proof 1: the post whose number rises", proof2: "Proof 2: the post whose cover becomes the wall", cta: "The ending: line and prop", other: "Other: just say", ask: "Use these as the material?", becomes: "Material → animation", idea: "idea", menu: "What else they can become (an idea with no picture works too)" },
}[lang] ?? {};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const img = (p) => (p && existsSync(join(dir, p)) ? `file://${encodeURI(join(dir, p))}` : null);
const nums = (n) => Object.values(n ?? {}).map((v) => `<span class="n"><b>${esc(v.display)}</b> ${esc(v.label)}</span>`).join("");
const posts = facts.posts ?? [];
const no = (id) => posts.findIndex((p) => p.id === id) + 1;
const pr = facts.profile ?? {};
const PLATFORMS = JSON.parse(readFileSync(new URL("../lib/platforms.json", import.meta.url), "utf8")).platforms;
const where = PLATFORMS[facts.platform]?.name ?? facts.platform ?? "";

const card = (p, i) => `<div class="card"><div class="pic" style="${img(p.shot ?? p.cover) ? `background-image:url('${img(p.shot ?? p.cover)}')` : ""}"><i>#${i + 1}</i>${p.pinned ? `<em>${T.pinned}</em>` : ""}</div>
  <div class="meta">${esc(p.date)}</div><div class="t">${esc(p.title)}</div><div class="ns">${nums(p.numbers)}</div></div>`;
const cand = (slot, c, k) => {
  const p = posts.find((q) => q.id === c.post);
  const head = c.slogan ? c.slogan.map(esc).join(" ／ ") : `#${no(c.post)} ${esc(p?.title ?? "")}`;
  const num = c.number && p?.numbers?.[c.number] ? `<b>${esc(p.numbers[c.number].display)}</b> ${esc(p.numbers[c.number].label)}` : "";
  const prop = c.prop ? `<div class="num">${esc(c.prop)}</div>` : "";
  return `<div class="c"><span class="k">${"ABC"[k] ?? k + 1}</span><div><div class="h">${head}</div>${num ? `<div class="num">${num}</div>` : ""}${prop}<div class="why">${esc(c.why)}</div></div></div>`;
};
// material → animation: what each post and each idea becomes (the agent writes "becomes"), and the menu
const CAT = JSON.parse(readFileSync(new URL("../../beats/catalog.json", import.meta.url), "utf8")).animations;
const word = (d) => (typeof d === "string" ? d : d?.[lang] ?? d?.["zh-Hant"] ?? d?.en ?? "");
const turn = (head, list) => `<div class="b"><div class="bh">${head}</div><div class="bl">${list.map((x) => {
  const a = CAT.find((c) => c.id === x.anim);
  return `<div class="ba"><span class="arr">→</span><div><b>${esc(a ? word(a.label) : x.anim)}</b>${x.why ? `<div class="why">${esc(x.why)}</div>` : ""}</div></div>`;
}).join("")}</div></div>`;
const turns = [...posts.map((p, i) => (p.becomes?.length ? turn(`#${i + 1} ${esc(p.title)}`, p.becomes) : "")), ...(facts.ideas ?? []).map((d) => turn(`<span class="tag">${T.idea}</span>${esc(d.text)}`, d.becomes ?? []))].filter(Boolean);
const becomes = turns.length ? `<section><h2>${T.becomes}</h2>${turns.join("")}</section>` : "";
const menu = `<section><h2>${T.menu}</h2><div class="menu">${CAT.map((a) => `<div class="m"><b>${esc(word(a.label))}</b><div class="why">${esc(word(a.fits))}</div></div>`).join("")}</div></section>`;
const slots = Object.entries(facts.slots ?? {}).map(([slot, list]) => `<section><h2>${esc(T[slot] ?? slot)}</h2>${list.slice(0, 3).map((c, k) => cand(slot, c, k)).join("")}<div class="c o"><span class="k">+</span><div class="h">${T.other}</div></div></section>`).join("");

const W = 1200, COLS = 3;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: ${W}px; background: #F4F2EE; font-family: "PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #1C1B19; padding: 40px; }
h1 { font-size: 30px; margin-bottom: 20px; } h2 { font-size: 22px; margin: 34px 0 14px; }
.pro { display: flex; gap: 22px; align-items: center; background: #fff; border-radius: 14px; padding: 22px; }
.av { width: 108px; height: 108px; border-radius: 50%; background: #ddd center/cover; flex: none; }
.pro .nm { font-size: 26px; font-weight: 700; } .pro .hd { color: #777; font-size: 18px; margin: 2px 0 8px; } .pro .bio { font-size: 16px; line-height: 1.5; color: #444; }
.ns { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; } .n { font-size: 15px; color: #555; } .n b { font-size: 18px; color: #1C1B19; }
.grid { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 18px; margin-top: 22px; }
.card { background: #fff; border-radius: 14px; overflow: hidden; padding-bottom: 14px; }
.pic { height: 210px; background: #E6E2DA center/cover no-repeat; position: relative; }
.pic i { position: absolute; left: 12px; top: 12px; background: #1C1B19; color: #fff; font-style: normal; font-weight: 700; font-size: 20px; padding: 3px 12px; border-radius: 20px; }
.pic em { position: absolute; right: 12px; top: 12px; background: #E8432E; color: #fff; font-style: normal; font-size: 15px; padding: 4px 10px; border-radius: 6px; }
.meta { color: #888; font-size: 14px; margin: 12px 16px 4px; } .t { font-size: 17px; font-weight: 600; line-height: 1.45; margin: 0 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; } .card .ns { margin: 10px 16px 0; }
section { background: #fff; border-radius: 14px; padding: 4px 22px 18px; margin-top: 18px; }
.c { display: flex; gap: 14px; padding: 12px 0; border-top: 1px solid #EEE; } .c:first-of-type { border-top: 0; }
.k { flex: none; width: 34px; height: 34px; border-radius: 50%; background: #1C1B19; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 17px; }
.o .k { background: #BBB; } .h { font-size: 18px; font-weight: 600; padding-top: 5px; } .num { font-size: 16px; margin-top: 4px; } .num b { font-size: 20px; } .why { color: #666; font-size: 15px; margin-top: 4px; line-height: 1.5; }
.ask { font-size: 22px; font-weight: 700; margin-top: 26px; }
.b { display: grid; grid-template-columns: 1fr 1.25fr; gap: 18px; padding: 14px 0; border-top: 1px solid #EEE; } .b:first-of-type { border-top: 0; }
.bh { font-size: 17px; font-weight: 600; line-height: 1.45; } .ba { display: flex; gap: 10px; margin-bottom: 6px; } .ba b { font-size: 17px; } .arr { color: #E8432E; font-weight: 700; font-size: 18px; }
.tag { display: inline-block; background: #E8432E; color: #fff; font-size: 13px; padding: 2px 8px; border-radius: 6px; margin-right: 8px; vertical-align: 2px; }
.menu { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 26px; padding-top: 6px; } .m b { font-size: 16px; }
</style></head><body>
<h1>${T.title}</h1>
<div class="pro"><div class="av" style="${img(pr.avatar) ? `background-image:url('${img(pr.avatar)}')` : ""}"></div><div><div class="nm">${esc(pr.name)}</div><div class="hd">${pr.handle ? "@" + esc(pr.handle) + " · " : ""}${esc(where)}</div><div class="bio">${(pr.bio ?? []).map(esc).join("<br>")}</div><div class="ns">${nums(pr.numbers)}</div></div></div>
<div class="grid">${posts.map(card).join("")}</div>
${(facts.extra ?? []).length ? `<section><h2>+</h2><div class="ns">${facts.extra.map((v) => `<span class="n"><b>${esc(v.display)}</b> ${esc(v.label)}</span>`).join("")}</div></section>` : ""}
${slots}
${becomes}
${menu}
<div class="ask">${T.ask}</div>
</body></html>`;
writeFileSync(join(dir, "research/materials.html"), html);

// tall enough for everything: the card rows, the slots, the profile
const rows = Math.ceil(posts.length / COLS);
const H = 80 + 190 + rows * 400 + Object.values(facts.slots ?? {}).reduce((h, l) => h + 90 + 96 * (Math.min(3, l.length) + 1), 0) + ((facts.extra ?? []).length ? 120 : 0) + 120
  + (turns.length ? 100 + 110 * turns.length : 0) + 100 + 100 * Math.ceil(CAT.length / 2);
const chrome = findChrome();
if (!chrome) { console.log("no headless Chrome: open research/materials.html instead"); process.exit(0); }
execFileSync(chrome, ["--headless", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files", `--window-size=${W},${H}`, "--force-device-scale-factor=1",
  `--screenshot=${join(dir, "research/materials.png")}`, `file://${join(dir, "research/materials.html")}`], { stdio: "ignore" });
console.log(`wrote ${join(dir, "research/materials.html")} and materials.png (${W}x${H})`);
