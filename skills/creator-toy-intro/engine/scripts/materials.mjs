// Step 2's page, for the user to pick from: the creator's story first (the
// things they are known for and proud of, each with its material, its numbers
// and where they were read, and what it becomes in the film, with a preview
// strip of that animation), then how the film opens (each opening's preview),
// then how it ends (the line and the prop), then every post the research
// found, as evidence, and the whole menu of animations. Plain words only: what
// the viewer will see, never the template's slot names.
//
// usage: node engine/scripts/materials.mjs <film folder> [--lang zh-Hant|zh-Hans|en] [--html-only]
// reads research/facts.json ("story", "slots.cta", "posts", "ideas")
// → research/materials.html (everything), research/materials.png (the three
//   choices) and research/materials-posts.png (the posts and the menu)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "../lib/tools.js";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const dir = resolve(argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--lang") ?? process.env.FILM ?? ".");
const facts = JSON.parse(readFileSync(join(dir, "research/facts.json"), "utf8"));
const film = existsSync(join(dir, "film.json")) ? JSON.parse(readFileSync(join(dir, "film.json"), "utf8")) : {};
const lang = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : film.language ?? "zh-Hans";
const T = {
  "zh-Hans": { title: "你的片：先选故事", story: "① 片里讲他哪几件事？", storyNote: "选两到三件，按出场顺序", becomes: "片里会看到", read: "读取", opening: "② 怎样开场？", openNote: "选一款", ending: "③ 怎样收尾？", endNote: "最后一句和他坐着的道具", other: "其他：直接讲", posts: "找到的帖子（证据）", pinned: "置顶", menu: "还可以变成这些动画", ask: "选好就告诉我：故事（例如 A、C）、开场、收尾", idea: "想法", none: "还没写故事：agent 先按 research.md 找出他最出名、最自豪的几件事" },
  "zh-Hant": { title: "你條片：先揀故事", story: "① 片入面講佢邊幾件事？", storyNote: "揀兩至三件，照出場次序", becomes: "片入面會見到", read: "讀取", opening: "② 點樣開場？", openNote: "揀一款", ending: "③ 點樣收尾？", endNote: "最後一句同佢坐住嘅道具", other: "其他：直接講", posts: "搵到嘅帖（證據）", pinned: "置頂", menu: "仲可以變成呢啲動畫", ask: "揀好就話我知：故事（例如 A、C）、開場、收尾", idea: "想法", none: "未寫故事：agent 先照 research.md 搵出佢最出名、最自豪嘅幾件事" },
  en: { title: "Your film: the story first", story: "① What does the film tell about them?", storyNote: "pick two or three, in the order they come", becomes: "On screen", read: "read", opening: "② How does it open?", openNote: "pick one", ending: "③ How does it end?", endNote: "the last line and the prop the toy sits on", other: "Other: just say", posts: "The posts found (the evidence)", pinned: "pinned", menu: "What else the material can become", ask: "Tell me your picks: the story (say A, C), the opening, the ending", idea: "idea", none: "No story yet: the agent first finds what they are known for and proud of (research.md)" },
}[lang] ?? {};
const D = {
  "zh-Hans": { title: "先选一条故事主线", audience: "给谁看", goal: "看完记住什么／做什么", assumed: "根据资料推断，可修改", recommended: "推荐", hook: "开场要让人想知道", visual: "第一幕", text: "画面短句", payoff: "结尾回应", evidence: "依据", gaps: "还缺证据，暂不选用", ask: "告诉我：故事方向、开场、收尾；也可以修改下面的素材组合" },
  "zh-Hant": { title: "先揀一條故事主線", audience: "畀邊個睇", goal: "睇完記得乜／做乜", assumed: "按資料推斷，可以改", recommended: "推薦", hook: "開場令人想知道", visual: "第一幕", text: "畫面短句", payoff: "結尾回應", evidence: "依據", gaps: "仲欠證據，暫時唔揀", ask: "話我知：故事方向、開場、收尾；亦可以改下面嘅素材組合" },
  en: { title: "Choose a story direction", audience: "Audience", goal: "What viewers remember / do", assumed: "Inferred from the sources; editable", recommended: "Recommended", hook: "The opening question", visual: "First frame", text: "On-screen line", payoff: "Payoff", evidence: "Evidence", gaps: "Evidence missing; not ready to select", ask: "Tell me the direction, camera opening and ending; or change the material choices below" },
}[lang] ?? null;
if (!D) throw new Error("--lang must be zh-Hant, zh-Hans or en");
const editorialWords = {
  "zh-Hant": { reason: "點解揀呢項", tradeoffs: "素材取捨", alternatives: "其他故事開場", why: "取捨" },
  "zh-Hans": { reason: "为什么选这项", tradeoffs: "素材取舍", alternatives: "其他故事开场", why: "取舍" },
  en: { reason: "Why this material", tradeoffs: "Material tradeoffs", alternatives: "Alternative story hooks", why: "Tradeoff" },
}[lang];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const img = (p, base = dir) => (p && existsSync(join(base, p)) ? `file://${encodeURI(join(base, p))}` : null);
const nums = (n) => Object.values(n ?? {}).map((v) => `<span class="n"><b>${esc(v.display)}</b> ${esc(v.label)}</span>`).join("");
const posts = facts.posts ?? [];
const post = (id) => posts.find((p) => p.id === id);
const pr = facts.profile ?? {};
const PLATFORMS = JSON.parse(readFileSync(join(SKILL, "engine/lib/platforms.json"), "utf8")).platforms;
const where = PLATFORMS[facts.platform]?.name ?? facts.platform ?? "";
const CAT = JSON.parse(readFileSync(join(SKILL, "beats/catalog.json"), "utf8")).animations;
const word = (d) => (typeof d === "string" ? d : d?.[lang] ?? d?.["zh-Hant"] ?? d?.en ?? "");
const anim = (id) => CAT.find((c) => c.id === id);
const LETTER = "ABCDEFGH";
const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u ? String(u).slice(0, 28) : ""; } };

// the creator's story: facts.json "story", or (research written before it) the old candidates as story points
const story = facts.story?.length ? facts.story : [
  ...(facts.slots?.proof1 ?? []).map((c, i) => ({ id: `n${i + 1}`, line: post(c.post)?.title, posts: [c.post], numbers: c.number && post(c.post)?.numbers?.[c.number] ? [post(c.post).numbers[c.number]] : [], becomes: [{ anim: "act2", why: c.why }] })),
  ...(facts.slots?.proof2 ?? []).map((c, i) => ({ id: `w${i + 1}`, line: post(c.post)?.title, posts: [c.post], becomes: [{ anim: "act3", why: c.why }] })),
  ...(facts.ideas ?? []).map((d, i) => ({ id: `i${i + 1}`, line: d.text, becomes: d.becomes ?? [] })),
];
const strip = (id) => { const a = anim(id); return a?.preview ? img(a.preview, SKILL) : null; };
const storyCard = (s, k) => {
  const pic = (s.material ?? []).map((m) => img(m)).find(Boolean) ?? (s.posts ?? []).map((id) => img(post(id)?.cover) ?? img(post(id)?.shot)).find(Boolean);
  const numbers = (s.numbers ?? []).map((n) => `<div class="num"><b>${esc(n.display)}</b> ${esc(n.label)}${n.source || n.read ? `<span class="src">${esc(host(n.source))}${n.read ? ` · ${T.read} ${esc(n.read)}` : ""}</span>` : ""}</div>`).join("");
  const turns = (s.becomes ?? []).slice(0, 2).map((b, j) => {
    const a = anim(b.anim);
    const pv = strip(b.anim);
    return `<div class="turn"><div class="tl">${j ? "" : `${T.becomes}：`}<b>${esc(a ? word(a.label) : b.anim)}</b></div>${pv ? `<div class="pv" style="background-image:url('${pv}')"></div>` : ""}${b.why ? `<div class="why">${esc(b.why)}</div>` : ""}</div>`;
  }).join("");
  return `<div class="sc"><div class="sp" style="${pic ? `background-image:url('${pic}')` : ""}"><i>${LETTER[k] ?? k + 1}</i></div><div class="sb"><div class="line">${esc(s.line)}</div>${s.says ? `<div class="why">${esc(s.says)}</div>` : ""}${s.selection?.reason ? `<div class="why"><b>${editorialWords.reason}:</b> ${esc(s.selection.reason)}</div>` : ""}${numbers}${turns}</div></div>`;
};
const directions = facts.directions ?? [];
const actionWords = {
  "zh-Hant": ["公仔做乜", "觀眾明白乜"],
  "zh-Hans": ["公仔做什么", "观众明白什么"],
  en: ["Toy action", "Viewer learns"],
}[lang];
const directionCard = (d, i) => {
  const evidence = (d.beats ?? []).flatMap((b) => {
    const s = story.find((s) => s.id === b.story);
    return [...(s?.sources ?? []).map((x) => ({ url: x.url, label: x.supports || x.url })),
      ...(s?.posts ?? []).map((id) => ({ url: post(id)?.url, label: post(id)?.title }))];
  }).filter((e, i, all) => e.url && all.findIndex((x) => x.url === e.url) === i);
  const link = (e) => /^https?:\/\//i.test(e.url) ? `<a href="${esc(e.url)}">${esc(e.label || e.url)}</a>` : esc(e.label || e.url);
  return `<article class="direction"><h3>${i + 1}. ${esc(d.title)}${d.id === facts.recommendedDirection ? ` <span class="badge">${D.recommended}</span>` : ""}</h3>
  <p>${esc(d.premise)}</p><p><b>${D.hook}:</b> ${esc(d.hook?.question)}</p>
  <p><b>${D.visual}:</b> ${esc(d.hook?.visual)}<br><b>${D.text}:</b> ${esc(d.hook?.text)}</p>
  ${d.hookAlternatives?.length ? `<div class="hook-options"><b>${editorialWords.alternatives}</b>${d.hookAlternatives.slice(0, 2).map((h) => `<p><b>${D.hook}:</b> ${esc(h.question)}<br><b>${D.visual}:</b> ${esc(h.visual)}<br><b>${D.text}:</b> ${esc(h.text)}<br><span class="why">${editorialWords.why}: ${esc(h.why)}</span></p>`).join("")}</div>` : ""}
  <ol>${(d.beats ?? []).map((b) => `<li><b>${esc(b.role)}</b>: ${esc(story.find((s) => s.id === b.story)?.line ?? b.story)}${b.connection ? `<div class="why">${esc(b.connection)}</div>` : ""}${b.action ? `<div class="why"><b>${actionWords[0]}:</b> ${esc(b.action.does)}<br><b>${actionWords[1]}:</b> ${esc(b.action.means)}</div>` : ""}</li>`).join("")}</ol>
  <p><b>${D.payoff}:</b> ${esc(d.payoff)}</p><p class="why">${esc(d.why)}</p>
  ${(d.cta?.slogan ?? []).length ? `<p>${D.payoff}: ${(d.cta.slogan ?? []).map(esc).join(" ／ ")}${d.cta.prop ? ` · ${esc(d.cta.prop)}` : ""}</p>` : ""}
  ${evidence.length ? `<details><summary>${D.evidence} (${evidence.length})</summary><ul>${evidence.map((e) => `<li>${link(e)}</li>`).join("")}</ul></details>` : ""}
  ${d.gaps?.length ? `<p class="gap"><b>${D.gaps}:</b> ${d.gaps.map(esc).join("；")}</p>` : ""}</article>`;
};
const narrative = facts.narrative ?? {};
const directionSection = directions.length ? `<section><h2>${D.title}</h2>
  <p class="note">${D.audience}: ${esc(narrative.audience)} · ${D.goal}: ${esc(narrative.goal)}${narrative.inferred ? `<br>${D.assumed}` : ""}</p>
  ${directions.map(directionCard).join("")}${facts.selectionNotes?.length ? `<p><b>${editorialWords.tradeoffs}</b></p><ul>${facts.selectionNotes.slice(0, 3).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</section>` : "";
const openings = CAT.filter((a) => a.group === "opening");
const opening = (a, k) => `<div class="op"><div class="ok">${k + 1}</div><div><b>${esc(word(a.label))}</b><div class="why">${esc(word(a.fits))}</div>${strip(a.id) ? `<div class="pv" style="background-image:url('${strip(a.id)}')"></div>` : ""}</div></div>`;
const cta = (c, k) => `<div class="c"><span class="k">${LETTER[k]}</span><div><div class="h">${(c.slogan ?? []).map(esc).join(" ／ ")}</div>${c.prop ? `<div class="num">${esc(c.prop)}</div>` : ""}<div class="why">${esc(c.why)}</div></div></div>`;
const card = (p, i) => `<div class="card"><div class="pic" style="${img(p.shot ?? p.cover) ? `background-image:url('${img(p.shot ?? p.cover)}')` : ""}"><i>#${i + 1}</i>${p.pinned ? `<em>${T.pinned}</em>` : ""}</div>
  <div class="meta">${esc(p.date)}</div><div class="t">${esc(p.title)}</div><div class="ns">${nums(p.numbers)}</div></div>`;
const menu = CAT.filter((a) => a.group === "middle").map((a) => `<div class="m"><b>${esc(word(a.label))}</b><div class="why">${esc(word(a.fits))}</div>${strip(a.id) ? `<div class="pv sm" style="background-image:url('${strip(a.id)}')"></div>` : ""}</div>`).join("");

const W = 1200;
const STYLE = `<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: ${W}px; max-width: 100%; background: #F4F2EE; font-family: "PingFang SC", "PingFang TC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #1C1B19; padding: 36px 40px; }
h1 { font-size: 30px; margin-bottom: 16px; } h2 { font-size: 24px; margin: 6px 0 4px; } .note { color: #777; font-size: 16px; margin-bottom: 14px; }
.pro { display: flex; gap: 20px; align-items: center; background: #fff; border-radius: 14px; padding: 18px 22px; }
.av { width: 84px; height: 84px; border-radius: 50%; background: #ddd center/cover; flex: none; }
.pro .nm { font-size: 24px; font-weight: 700; } .pro .hd { color: #777; font-size: 16px; margin: 2px 0 6px; } .pro .bio { font-size: 15px; line-height: 1.5; color: #444; }
.ns { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; } .n { font-size: 14px; color: #555; } .n b { font-size: 17px; color: #1C1B19; }
section { background: #fff; border-radius: 14px; padding: 20px 22px; margin-top: 18px; }
.stories { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sc { border: 2px solid #EEE; border-radius: 12px; overflow: hidden; display: grid; grid-template-columns: 170px 1fr; }
.sp { background: #E6E2DA center/cover no-repeat; position: relative; min-height: 190px; }
.sp i, .pic i { position: absolute; left: 10px; top: 10px; background: #1C1B19; color: #fff; font-style: normal; font-weight: 700; font-size: 22px; padding: 2px 13px; border-radius: 20px; }
.sb { padding: 14px 16px; } .line { font-size: 19px; font-weight: 700; line-height: 1.4; }
.num { font-size: 15px; margin-top: 6px; } .num b { font-size: 20px; } .src { color: #999; font-size: 12px; margin-left: 8px; }
.turn { margin-top: 10px; } .tl { font-size: 15px; } .tl b { color: #E8432E; }
.pv { height: 52px; margin-top: 6px; border-radius: 6px; background: #111 left center/auto 100% no-repeat; } .pv.sm { height: 44px; }
.why { color: #666; font-size: 14px; margin-top: 4px; line-height: 1.5; }
.ops { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; } .op { display: flex; gap: 10px; } .op b { font-size: 16px; } .op .pv { height: 62px; background-size: 100% auto; }
.ok, .k { flex: none; width: 32px; height: 32px; border-radius: 50%; background: #1C1B19; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.c { display: flex; gap: 14px; padding: 10px 0; border-top: 1px solid #EEE; } .c:first-of-type { border-top: 0; } .o .k { background: #BBB; } .h { font-size: 18px; font-weight: 600; padding-top: 4px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.card { background: #FAF9F7; border-radius: 12px; overflow: hidden; padding-bottom: 12px; }
.pic { height: 150px; background: #E6E2DA center/cover no-repeat; position: relative; } .pic i { font-size: 16px; }
.pic em { position: absolute; right: 10px; top: 10px; background: #E8432E; color: #fff; font-style: normal; font-size: 13px; padding: 3px 8px; border-radius: 6px; }
.meta { color: #888; font-size: 13px; margin: 10px 12px 3px; } .t { font-size: 15px; font-weight: 600; line-height: 1.4; margin: 0 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; } .card .ns { margin: 6px 12px 0; }
.menu { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; } .m b { font-size: 15px; }
.ask { font-size: 21px; font-weight: 700; margin-top: 22px; }
.direction { border-top: 1px solid #ddd; padding: 18px 0; line-height: 1.6; overflow-wrap: anywhere; }
.direction h3 { font-size: 22px; } .direction p { margin: 8px 0; font-size: 17px; }
.direction ol, .direction ul { padding-left: 24px; } .direction li { margin: 6px 0; }
.badge { color: #267146; font-size: 15px; } .gap { color: #a33c19; } a { color: #205d93; }
.hook-options { background: #F4F2EE; border-radius: 10px; padding: 12px 16px; margin: 12px 0; }
.sb, .op > div, .pro > div { min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 700px) {
  body { padding: 20px 14px; }
  h1 { font-size: 26px; } h2 { font-size: 21px; }
  section { padding: 18px 16px; }
  .pro { padding: 14px; gap: 12px; }
  .av { width: 56px; height: 56px; }
  .stories, .ops, .menu { grid-template-columns: 1fr; }
  .sc { grid-template-columns: 100px minmax(0, 1fr); }
  .sb { padding: 12px; }
  .grid { grid-template-columns: 1fr 1fr; }
  .direction p { font-size: 16px; }
  .direction h3 { font-size: 20px; }
  .ask { font-size: 18px; overflow-wrap: anywhere; }
}
</style>`;
const head = `<h1>${T.title}</h1>
<div class="pro"><div class="av" style="${img(pr.avatar) ? `background-image:url('${img(pr.avatar)}')` : ""}"></div><div><div class="nm">${esc(pr.name)}</div><div class="hd">${pr.handle ? "@" + esc(pr.handle) + " · " : ""}${esc(where)}</div><div class="bio">${(pr.bio ?? []).map(esc).join("<br>")}</div><div class="ns">${nums(pr.numbers)}</div></div></div>`;
const decide = `${head}
${directionSection}
<section><h2>${T.story}</h2><div class="note">${T.storyNote}</div>${story.length ? `<div class="stories">${story.map(storyCard).join("")}</div>` : `<div class="why">${T.none}</div>`}</section>
<section><h2>${T.opening}</h2><div class="note">${T.openNote}</div><div class="ops">${openings.map(opening).join("")}</div></section>
<section><h2>${T.ending}</h2><div class="note">${T.endNote}</div>${(facts.slots?.cta ?? []).slice(0, 3).map(cta).join("")}<div class="c o"><span class="k">+</span><div class="h">${T.other}</div></div></section>
<div class="ask">${directions.length ? D.ask : T.ask}</div>`;
const more = `<section><h2>${T.posts}</h2><div class="grid">${posts.map(card).join("")}</div>
${(facts.extra ?? []).length ? `<div class="ns" style="margin-top:12px">${facts.extra.map((v) => `<span class="n"><b>${esc(v.display)}</b> ${esc(v.label)}</span>`).join("")}</div>` : ""}</section>
<section><h2>${T.menu}</h2><div class="menu">${menu}</div></section>`;
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${STYLE}</head><body>${body}</body></html>`;
writeFileSync(join(dir, "research/materials.html"), page(decide + more));
if (argv.includes("--html-only")) { console.log("wrote research/materials.html"); process.exit(0); }

// the two pictures: the choices (what the user answers), then the evidence and the menu
const storyRows = Math.ceil(Math.max(story.length, 1) / 2);
const storyH = story.reduce((h, s, i) => (i % 2 ? h : h + 70 + Math.max(...[s, story[i + 1]].filter(Boolean).map((x) => 60 + 34 * (x.numbers?.length ?? 0) + 96 * Math.min(2, x.becomes?.length ?? 0)), 200)), 0);
const directionH = directions.length ? 160 + directions.reduce((h, d) => h + 340 + (d.beats?.length ?? 0) * 85 + Math.ceil(JSON.stringify(d).length / 65) * 30, 0) : 0;
const H1 = directionH + 36 + 60 + 130 + 110 + (story.length ? storyH + 16 * storyRows : 60) + 110 + 190 + 110 + 70 * (Math.min(3, facts.slots?.cta?.length ?? 0) + 1) + 90;
const H2 = 40 + 100 + Math.ceil(posts.length / 4) * 270 + ((facts.extra ?? []).length ? 50 : 0) + 100 + Math.ceil(CAT.filter((a) => a.group === "middle").length / 2) * 130 + 40;
const chrome = findChrome();
if (!chrome) { console.log("no headless Chrome: open research/materials.html instead"); process.exit(0); }
const shot = (body, h, png) => {
  const tmp = join(dir, `research/.${png}.html`);
  // Direction cards contain prose of variable length. Measure the laid-out
  // page instead of cropping a long language variant or adding blank screens.
  writeFileSync(tmp, page(body + '<script>document.title = "material-height:" + Math.ceil(document.documentElement.scrollHeight);</script>'));
  const flags = ["--headless", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files", "--force-device-scale-factor=1"];
  let height = h;
  try {
    const dom = execFileSync(chrome, [...flags, `--window-size=${W},600`, "--dump-dom", `file://${tmp}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    height = Number(dom.match(/<title>material-height:(\d+)<\/title>/)?.[1]) || h;
  } catch { console.log(`could not measure ${png}; using the estimated page height`); }
  execFileSync(chrome, [...flags, `--window-size=${W},${height}`, `--screenshot=${join(dir, "research", png)}`, `file://${tmp}`], { stdio: "ignore", timeout: 30000 });
  return height;
};
const height1 = shot(decide, H1, "materials.png");
const height2 = shot(more, H2, "materials-posts.png");
console.log(`wrote ${join(dir, "research/materials.html")}, materials.png (${W}x${height1}: the story, the opening, the ending) and materials-posts.png (${W}x${height2}: the posts, the menu)`);
