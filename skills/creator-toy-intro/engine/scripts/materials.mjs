// Step 2's page, for the user to pick from: the creator's story first (the
// things they are known for and proud of, each with its material, its numbers
// and where they were read, and the ideas for showing it: the film's own with
// a sketch made from their material, the skill's with a preview strip of that
// animation), each direction with its pitch and the opening the story chose,
// then how it ends (the line and the prop), then every post the research
// found, as evidence, and the skill's animations as parts. Plain words only:
// what the viewer will see, never the template's slot names. It says which
// point still lacks an idea of the film's own, or its sketch.
//
// usage: node engine/scripts/materials.mjs <film folder> [--lang zh-Hant|zh-Hans|en] [--html-only]
// reads research/facts.json ("story", "slots.cta", "posts", "ideas")
// → research/story/index.html (the page the studio serves, as the storyboard's is: run.mjs studio, /story/;
//   the user clicks a card to leave a note), research/materials.html (the same with file paths),
//   research/materials.png (the choices) and research/materials-posts.png (the posts and the parts), for a chat
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome } from "../lib/tools.js";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const dir = resolve(argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--lang") ?? process.env.FILM ?? ".");
const facts = JSON.parse(readFileSync(join(dir, "research/facts.json"), "utf8"));
const film = existsSync(join(dir, "film.json")) ? JSON.parse(readFileSync(join(dir, "film.json"), "utf8")) : {};
const lang = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : film.language ?? "zh-Hans";
const T = {
  "zh-Hans": { title: "你的片：先选故事", story: "① 片里讲哪几件事？", storyNote: "选两到三件，按出场顺序", becomes: "片里会看到", read: "读取", opening: "② 怎样开场？", openNote: "选一款", ending: "③ 怎样收尾？", endNote: "最后一句和公仔坐着的道具", other: "其他：直接讲", posts: "找到的帖子（证据）", pinned: "置顶", menu: "技能自带的动画（零件，可以从这里开始做）", ask: "选好就告诉我：故事（例如 A、C）、开场、收尾；有什么不想出现在片里（某个数字、某张图、旧名字），也一起说", idea: "想法", none: "还没写故事：agent 先按 research.md 找出创作者最出名、最自豪的几件事" },
  "zh-Hant": { title: "你條片：先揀故事", story: "① 片入面講佢邊幾件事？", storyNote: "揀兩至三件，照出場次序", becomes: "片入面會見到", read: "讀取", opening: "② 點樣開場？", openNote: "揀一款", ending: "③ 點樣收尾？", endNote: "最後一句同佢坐住嘅道具", other: "其他：直接講", posts: "搵到嘅帖（證據）", pinned: "置頂", menu: "skill 自帶嘅動畫（零件，可以由呢度開始整）", ask: "揀好就話我知：故事（例如 A、C）、開場、收尾；有冇嘢唔想出現喺片入面（某個數字、某張相、舊名），都一齊講", idea: "想法", none: "未寫故事：agent 先照 research.md 搵出佢最出名、最自豪嘅幾件事" },
  en: { title: "Your film: the story first", story: "① What does the film tell about them?", storyNote: "pick two or three, in the order they come", becomes: "On screen", read: "read", opening: "② How does it open?", openNote: "pick one", ending: "③ How does it end?", endNote: "the last line and the prop the toy sits on", other: "Other: just say", posts: "The posts found (the evidence)", pinned: "pinned", menu: "The skill's animations (parts to start from)", ask: "Tell me your picks: the story (say A, C), the opening, the ending; and anything that must not appear (a number, a picture, an old name)", idea: "idea", none: "No story yet: the agent first finds what they are known for and proud of (research.md)" },
}[lang] ?? {};
const D = {
  "zh-Hans": { title: "① 片子讲哪一条主线？", note: "选一条（A／B／C）。每条都已经排好要讲的几件事和次序", audience: "给谁看", goal: "看完记住什么／做什么", assumed: "根据资料推断，可修改", recommended: "推荐", hook: "开场让人想知道", visual: "第一个画面", text: "画面上的字", payoff: "最后回答了什么", ending: "收尾一句和道具", means: "观众会明白", evidence: "依据", gaps: "还缺证据：选这条的话，会只讲资料能证明的部分", ask: "选好就告诉我，例如：主线 A、收尾 1（想某件事换另一个点子也说）。有什么不想出现在片里（某个数字、某张图、旧名字），也一起说" },
  "zh-Hant": { title: "① 條片講邊條主線？", note: "揀一條（A／B／C）。每條都已經排好要講嘅幾件事同次序", audience: "畀邊個睇", goal: "睇完記得乜／做乜", assumed: "按資料推斷，可以改", recommended: "推薦", hook: "開場令人想知道", visual: "第一個畫面", text: "畫面上嘅字", payoff: "最後答咗乜", ending: "收尾一句同道具", means: "觀眾會明白", evidence: "依據", gaps: "仲欠證據：揀呢條嘅話，只會講資料證明到嘅部分", ask: "揀好就話我知，例如：主線 A、收尾 1（想某件事換第二個點子都講）。有冇嘢唔想出現喺片入面（某個數字、某張相、舊名），都一齊講" },
  en: { title: "① Which story does the film tell?", note: "Pick one (A / B / C): each already orders the facts it tells", audience: "Audience", goal: "What viewers remember / do", assumed: "Inferred from the sources; editable", recommended: "Recommended", hook: "What makes them want to know", visual: "First picture", text: "Words on screen", payoff: "What the end answers", ending: "Closing line and prop", means: "Viewer learns", evidence: "Evidence", gaps: "Evidence missing: choosing this, the film says only what the sources support", ask: "Tell me your picks, say: story A, ending 1 (and another idea for a point, if you prefer one). And anything that must not appear (a number, a picture, an old name)" },
}[lang] ?? null;
if (!D) throw new Error("--lang must be zh-Hant, zh-Hans or en");
const editorialWords = {
  "zh-Hant": { reason: "點解揀呢項", tradeoffs: "素材取捨", alternatives: "另一個開場講法（可以揀）", why: "取捨", points: "每件事嘅素材（詳細）", pointsNote: "主線用到嘅每件事、佢嘅數字同會變成嘅動畫；想換件事就話我知", ownEnding: "唔揀嘅話，就用主線自帶嘅收尾" },
  "zh-Hans": { reason: "为什么选这项", tradeoffs: "素材取舍", alternatives: "另一个开场讲法（可选）", why: "取舍", points: "每件事的素材（详细）", pointsNote: "主线用到的每件事、它的数字和会变成的动画；想换一件就告诉我", ownEnding: "不选的话，就用主线自带的收尾" },
  en: { reason: "Why this material", tradeoffs: "Material tradeoffs", alternatives: "Another way to open (you can pick it)", why: "Tradeoff", points: "Each fact's material (detail)", pointsNote: "Every fact the stories use, its numbers and the animation it becomes; ask to swap one", ownEnding: "Without a pick, each story keeps its own ending" },
}[lang];
// the ideas: the film's own (designed from the material, shown by its sketch) and the skill's (shown by a strip of another film)
const ideaWords = {
  "zh-Hant": { pitch: "一句講晒", special: "素材特別在", sketch: "示意：用佢自己嘅素材砌，唔係最終畫面", opening: "開場（按故事揀）", more: "仲有 {n} 個點子，喺詳細頁" },
  "zh-Hans": { pitch: "一句话", special: "素材特别在", sketch: "示意：用创作者自己的素材拼，不是最终画面", opening: "开场（按故事选）", more: "还有 {n} 个点子，在详细页" },
  en: { pitch: "In a sentence", special: "What is special", sketch: "a sketch from their own material, not the final frame", opening: "Opening (chosen by the story)", more: "{n} more ideas on the detail page" },
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
// an idea's picture: the film's own by its sketch, the skill's by its preview strip
const ownIdea = (b) => b?.anim === "own";
const ideaPic = (b) => (ownIdea(b) ? img(b.sketch) : strip(b?.anim));
const ideaLabel = (b) => { const a = anim(b?.anim); return a ? word(a.label) : b?.anim; };
const storyCard = (s, k) => {
  const pic = (s.material ?? []).map((m) => img(m)).find(Boolean) ?? (s.posts ?? []).map((id) => img(post(id)?.cover) ?? img(post(id)?.shot)).find(Boolean);
  const numbers = (s.numbers ?? []).map((n) => `<div class="num"><b>${esc(n.display)}</b> ${esc(n.label)}${n.source || n.read ? `<span class="src">${esc(host(n.source))}${n.read ? ` · ${T.read} ${esc(n.read)}` : ""}</span>` : ""}</div>`).join("");
  const turns = (s.becomes ?? []).slice(0, 3).map((b, j) => {
    const pv = ideaPic(b);
    return `<div class="turn"><div class="tl">${j ? "" : `${T.becomes}：`}<b>${esc(ideaLabel(b))}</b></div>${b.pitch ? `<div class="pitch">${esc(b.pitch)}</div>` : ""}${pv ? `<div class="pv${ownIdea(b) ? " sk" : ""}" style="background-image:url('${pv}')"></div>${ownIdea(b) ? `<div class="skn">${ideaWords.sketch}</div>` : ""}` : ""}${b.why ? `<div class="why">${esc(b.why)}</div>` : ""}</div>`;
  }).join("");
  return `<div class="sc"><div class="sp" style="${pic ? `background-image:url('${pic}')` : ""}"><i>${(facts.directions ?? []).length ? `#${k + 1}` : LETTER[k] ?? k + 1}</i></div><div class="sb"><div class="line">${esc(s.line)}</div>${s.says ? `<div class="why">${esc(s.says)}</div>` : ""}${s.special ? `<div class="why"><b>${ideaWords.special}:</b> ${esc(s.special)}</div>` : ""}${s.selection?.reason ? `<div class="why"><b>${editorialWords.reason}:</b> ${esc(s.selection.reason)}</div>` : ""}${numbers}${turns}</div></div>`;
};
const directions = facts.directions ?? [];
const actionWords = {
  "zh-Hant": ["公仔做乜", "觀眾明白乜"],
  "zh-Hans": ["公仔做什么", "观众明白什么"],
  en: ["Toy action", "Viewer learns"],
}[lang];
const beatRow = (b, n) => {
  const s = story.find((x) => x.id === b.story);
  const pic = s && ((s.material ?? []).map((m) => img(m)).find(Boolean) ?? (s.posts ?? []).map((id) => img(post(id)?.cover) ?? img(post(id)?.shot)).find(Boolean));
  const idea = s?.becomes?.[b.idea ?? 0], others = Math.max(0, (s?.becomes?.length ?? 0) - 1);
  const pv = idea && ideaPic(idea);
  return `<li class="beat"><div class="bp" style="${pic ? `background-image:url('${pic}')` : ""}"></div><div class="bt"><b>${n + 1}. ${esc(b.role)}</b>: ${esc(s?.line ?? b.story)}${idea?.pitch ? `<div class="pitch">${esc(idea.pitch)}</div>` : ""}${b.connection ? `<div class="why">${esc(b.connection)}</div>` : ""}${b.action?.means ? `<div class="why"><b>${D.means}:</b> ${esc(b.action.means)}</div>` : ""}${b.action?.does ? `<div class="why"><b>${actionWords[0]}:</b> ${esc(b.action.does)}</div>` : ""}${others ? `<div class="why">${esc(ideaWords.more.replace("{n}", others))}</div>` : ""}</div>${pv ? `<div class="pv bpv${ownIdea(idea) ? " sk" : ""}" style="background-image:url('${pv}')"></div>` : ""}</li>`;
};
const directionCard = (d, i) => {
  const evidence = (d.beats ?? []).flatMap((b) => {
    const s = story.find((s) => s.id === b.story);
    return [...(s?.sources ?? []).map((x) => ({ url: x.url, label: x.supports || x.url })),
      ...(s?.posts ?? []).map((id) => ({ url: post(id)?.url, label: post(id)?.title }))];
  }).filter((e, i, all) => e.url && all.findIndex((x) => x.url === e.url) === i);
  const link = (e) => /^https?:\/\//i.test(e.url) ? `<a href="${esc(e.url)}">${esc(e.label || e.url)}</a>` : esc(e.label || e.url);
  return `<article class="direction"><h3><span class="k">${LETTER[i] ?? i + 1}</span> ${esc(d.title)}${d.id === facts.recommendedDirection ? ` <span class="badge">${D.recommended}</span>` : ""}</h3>
  <p>${esc(d.premise)}</p>
  ${d.pitch ? `<p class="pitch"><b>${ideaWords.pitch}:</b> ${esc(d.pitch)}</p>` : ""}
  ${d.opening?.id ? `<p class="why"><b>${ideaWords.opening}:</b> ${esc(word(anim(d.opening.id)?.label) || d.opening.id)}${d.opening.why ? ` · ${esc(d.opening.why)}` : ""}</p>` : ""}
  <p><b>${D.visual}:</b> ${esc(d.hook?.visual)} · <b>${D.text}:</b> 「${esc(d.hook?.text)}」<br><span class="why"><b>${D.hook}:</b> ${esc(d.hook?.question)}</span></p>
  ${d.hookAlternatives?.length ? `<div class="hook-options"><b>${editorialWords.alternatives}</b>${d.hookAlternatives.slice(0, 2).map((h) => `<p><b>${D.visual}:</b> ${esc(h.visual)} · <b>${D.text}:</b> 「${esc(h.text)}」<br><span class="why"><b>${D.hook}:</b> ${esc(h.question)} · ${editorialWords.why}: ${esc(h.why)}</span></p>`).join("")}</div>` : ""}
  <ol class="beats">${(d.beats ?? []).map(beatRow).join("")}</ol>
  <p><b>${D.payoff}:</b> ${esc(d.payoff)}</p>
  ${(d.cta?.slogan ?? []).length ? `<p><b>${D.ending}:</b> ${(d.cta.slogan ?? []).map(esc).join(" ／ ")}${d.cta.prop ? ` · ${esc(d.cta.prop)}` : ""}</p>` : ""}
  <p class="why">${esc(d.why)}</p>
  ${evidence.length ? `<details><summary>${D.evidence} (${evidence.length})</summary><ul>${evidence.map((e) => `<li>${link(e)}</li>`).join("")}</ul></details>` : ""}
  ${d.gaps?.length ? `<p class="gap"><b>${D.gaps}:</b> ${d.gaps.map(esc).join("；")}</p>` : ""}</article>`;
};
const narrative = facts.narrative ?? {};
const directionSection = directions.length ? `<section><h2>${D.title}</h2><div class="note">${D.note}</div>
  <p class="note">${D.audience}: ${esc(narrative.audience)} · ${D.goal}: ${esc(narrative.goal)}${narrative.inferred ? `<br>${D.assumed}` : ""}</p>
  ${directions.map(directionCard).join("")}${facts.selectionNotes?.length ? `<p><b>${editorialWords.tradeoffs}</b></p><ul>${facts.selectionNotes.slice(0, 3).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</section>` : "";
const openings = CAT.filter((a) => a.group === "opening");
const opening = (a, k) => `<div class="op"><div class="ok">${k + 1}</div><div><b>${esc(word(a.label))}</b><div class="why">${esc(word(a.fits))}</div>${strip(a.id) ? `<div class="pv" style="background-image:url('${strip(a.id)}')"></div>` : ""}</div></div>`;
const cta = (c, k) => `<div class="c"><span class="k">${k + 1}</span><div><div class="h">${(c.slogan ?? []).map(esc).join(" ／ ")}</div>${c.prop ? `<div class="num">${esc(c.prop)}</div>` : ""}<div class="why">${esc(c.why)}</div></div></div>`;
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
.pv.sk { height: 120px; background: #EDEAE4 center/cover no-repeat; } .bpv.sk { height: 110px; } .skn { color: #999; font-size: 12px; margin-top: 3px; }
.pitch { font-size: 15px; font-weight: 600; color: #1C1B19; margin-top: 4px; line-height: 1.45; }
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
.direction h3 { display: flex; align-items: center; gap: 10px; }
.beats { list-style: none; padding: 0 !important; margin: 10px 0; }
.beat { display: grid; grid-template-columns: 120px minmax(0, 1fr) 260px; gap: 14px; align-items: center; padding: 8px 0; border-top: 1px solid #EEE; margin: 0 !important; }
.bp { height: 80px; border-radius: 8px; background: #E6E2DA center/cover no-repeat; }
.bt { font-size: 16px; line-height: 1.5; min-width: 0; } .bpv { height: 62px; margin: 0; background-size: 100% auto; }
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
  .beat { grid-template-columns: 84px minmax(0, 1fr); } .bp { height: 64px; } .bpv { grid-column: 1 / -1; }
  .direction h3 { font-size: 20px; }
  .ask { font-size: 18px; overflow-wrap: anywhere; }
}
</style>`;
const proposalNote = {
  "zh-Hant": "故事提案：先確認情節同次序，唔代表最終動畫風格。下面嘅示例用嚟講解；正式效果以實際動畫預覽為準。",
  "zh-Hans": "故事提案：先确认情节和顺序，不代表最终动画风格。下面的示例用于讲解；正式效果以实际动画预览为准。",
  en: "Story proposal: confirm the plot and order, not the final animation style. Examples explain the plan; actual animation previews establish the final treatment.",
}[lang];
const head = `<h1>${T.title}</h1><p class="note">${esc(proposalNote)}</p>
<div class="pro"><div class="av" style="${img(pr.avatar) ? `background-image:url('${img(pr.avatar)}')` : ""}"></div><div><div class="nm">${esc(pr.name)}</div><div class="hd">${pr.handle ? "@" + esc(pr.handle) + " · " : ""}${esc(where)}</div><div class="bio">${(pr.bio ?? []).map(esc).join("<br>")}</div><div class="ns">${nums(pr.numbers)}</div></div></div>`;
const storySection = `<section><h2>${directions.length ? editorialWords.points : T.story}</h2><div class="note">${directions.length ? editorialWords.pointsNote : T.storyNote}</div>${story.length ? `<div class="stories">${story.map(storyCard).join("")}</div>` : `<div class="why">${T.none}</div>`}</section>`;
const endings = facts.slots?.cta ?? [];
const decide = `${head}
${directions.length ? directionSection : storySection}
${directions.length ? "" : `<section><h2>${T.opening}</h2><div class="note">${T.openNote}</div><div class="ops">${openings.map(opening).join("")}</div></section>`}
<section><h2>${directions.length ? T.ending.replace("③", "②") : T.ending}</h2><div class="note">${directions.length && !endings.length ? editorialWords.ownEnding : T.endNote}</div>${endings.slice(0, 3).map(cta).join("")}<div class="c o"><span class="k">+</span><div class="h">${T.other}</div></div></section>
<div class="ask">${directions.length ? D.ask : T.ask}</div>`;
const more = `${directions.length ? storySection : ""}<section><h2>${T.posts}</h2><div class="grid">${posts.map(card).join("")}</div>
${(facts.extra ?? []).length ? `<div class="ns" style="margin-top:12px">${facts.extra.map((v) => `<span class="n"><b>${esc(v.display)}</b> ${esc(v.label)}</span>`).join("")}</div>` : ""}</section>
<section><h2>${T.menu}</h2><div class="menu">${menu}</div></section>`;
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${STYLE}</head><body>${body}</body></html>`;
writeFileSync(join(dir, "research/materials.html"), page(decide + more));
// the page the studio serves (run.mjs studio → /story/), as the storyboard page is: its pictures beside it, and a
// note on any card (a direction, a point, an idea, an ending, a post) goes to build/comments.jsonl
{
  const STORY = join(dir, "research/story");
  rmSync(join(STORY, "img"), { recursive: true, force: true });
  mkdirSync(join(STORY, "img"), { recursive: true });
  const copied = new Map();
  const local = (html) => html.replace(/file:\/\/([^'")]+)/g, (_, enc) => {
    const abs = decodeURI(enc);
    if (!copied.has(abs)) {
      const name = `${copied.size}-${basename(abs)}`;
      copyFileSync(abs, join(STORY, "img", name));
      copied.set(abs, `img/${encodeURIComponent(name)}`);
    }
    return copied.get(abs);
  });
  const NW = {
    "zh-Hant": { title: "意見", hint: "撳任何一張卡（主線、點子、收尾、帖），寫低想點改，寄出。", file: "撳任何一張卡寫低想點改：意見會複製，貼返俾 agent。", send: "寄出", copy: "複製", cancel: "取消", copied: "已複製，貼返俾 agent", none: "仲未有意見。", on: "喺" },
    "zh-Hans": { title: "意见", hint: "点任何一张卡（主线、点子、收尾、帖子），写下想怎么改，发送。", file: "点任何一张卡写下想怎么改：意见会复制，贴给 agent。", send: "发送", copy: "复制", cancel: "取消", copied: "已复制，贴给 agent", none: "还没有意见。", on: "在" },
    en: { title: "Notes", hint: "Click any card (a story, an idea, an ending, a post), write what to change, send.", file: "Click any card and write what to change: the note is copied, to paste to the agent.", send: "Send", copy: "Copy", cancel: "Cancel", copied: "Copied: paste it to the agent", none: "No notes yet.", on: "on" },
  }[lang] ?? {};
  const notes = `<section id="notes"><h2>${esc(NW.title)}</h2><div class="note nhint"></div><div class="nlist"></div></section>
<style>.npop{position:absolute;z-index:20;width:300px;background:#fff;border:1px solid #ddd;border-radius:10px;padding:10px;display:grid;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
.npop textarea{width:100%;min-height:80px;border:1px solid #ddd;border-radius:6px;padding:6px;font:inherit}.npop .row{display:flex;gap:8px;justify-content:flex-end}
.npop button{border:1px solid #ccc;background:#f4f2ee;border-radius:6px;padding:4px 12px;font:inherit;cursor:pointer}.npop button.go{background:#1C1B19;color:#fff;border-color:#1C1B19}
.direction,.sc,.beat,.c,.card{cursor:pointer}.noted{outline:3px solid #e2463b;outline-offset:2px}.nlist{display:grid;gap:8px}.nlist .n{border:1px solid #eee;border-radius:8px;padding:8px 10px}.nlist .n small{color:#999}</style>
<script>(() => {
  const W = ${JSON.stringify(NW)}, live = location.protocol.startsWith("http");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  document.querySelector("#notes .nhint").textContent = live ? W.hint : W.file;
  const label = (el) => (el.querySelector("h3, .line, .bt b, .h, .t")?.textContent || el.textContent).trim().replace(/\s+/g, " ").slice(0, 60);
  async function list() {
    if (!live) return;
    const all = await fetch("/api/comments").then((r) => r.json()).catch(() => []);
    const mine = all.filter((n) => n.source === "story");
    document.querySelector("#notes .nlist").innerHTML = mine.length ? mine.reverse().map((n) => '<div class="n"><small>' + esc(n.id + " · " + W.on + " " + n.on) + "</small><div>" + esc(n.text) + "</div>" + (n.reply ? "<small>→ " + esc(n.reply) + "</small>" : "") + "</div>").join("") : '<div class="note">' + esc(W.none) + "</div>";
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest(".npop, a, summary, details")) return;
    const card = e.target.closest(".direction .beat, .direction, .sc, .c, .card");
    if (!card) return;
    document.querySelector(".npop")?.remove();
    document.querySelectorAll(".noted").forEach((x) => x.classList.remove("noted"));
    card.classList.add("noted");
    const on = label(card), p = document.createElement("div");
    p.className = "npop";
    p.innerHTML = "<small>" + esc(W.on + " " + on) + "</small><textarea></textarea><div class=row><button class=no>" + esc(W.cancel) + "</button><button class=go>" + esc(live ? W.send : W.copy) + "</button></div>";
    const b = card.getBoundingClientRect();
    p.style.left = scrollX + Math.max(8, Math.min(e.clientX - 150, document.documentElement.clientWidth - 312)) + "px";
    p.style.top = scrollY + Math.min(e.clientY + 12, b.bottom + 6) + "px";
    document.body.appendChild(p);
    p.querySelector("textarea").focus();
    const close = () => { p.remove(); card.classList.remove("noted"); };
    p.querySelector(".no").onclick = close;
    p.querySelector(".go").onclick = async () => {
      const text = p.querySelector("textarea").value.trim();
      if (!text) return;
      if (live) {
        await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: "story", on, text }) }).catch(() => null);
        close(); list();
      } else {
        await navigator.clipboard?.writeText("[" + W.on + " " + on + "] " + text).catch(() => null);
        p.innerHTML = "<small>" + esc(W.copied) + "</small>"; setTimeout(close, 1500);
      }
    };
  });
  list();
})();</script>`;
  writeFileSync(join(STORY, "index.html"), local(page(decide + more + notes)));
}
const shown = directions.length ? story.filter((s) => directions.some((d) => (d.beats ?? []).some((b) => b.story === s.id))) : story;
for (const s of shown) {
  const own = (s.becomes ?? []).filter(ownIdea);
  if (!own.length) console.log(`! ${s.id} "${s.line}": no idea of the film's own yet: design one from what is special about its material (references/research.md, "The story first")`);
  for (const b of own) if (!img(b.sketch)) console.log(`! ${s.id}: its own idea "${b.pitch ?? b.beat ?? "?"}" has no sketch on the page yet (${b.sketch ?? "no sketch"}): make one from their material (engine/scripts/sketch.py)`);
  if (!s.special) console.log(`! ${s.id}: say what is special about its material ("special")`);
}
if (argv.includes("--html-only")) { console.log("wrote research/materials.html"); process.exit(0); }

// the two pictures: the choices (what the user answers), then the evidence and the menu
const storyRows = Math.ceil(Math.max(story.length, 1) / 2);
const storyH = story.reduce((h, s, i) => (i % 2 ? h : h + 70 + Math.max(...[s, story[i + 1]].filter(Boolean).map((x) => 60 + 34 * (x.numbers?.length ?? 0) + 96 * Math.min(2, x.becomes?.length ?? 0)), 200)), 0);
const directionH = directions.length ? 160 + directions.reduce((h, d) => h + 340 + (d.beats?.length ?? 0) * 85 + Math.ceil(JSON.stringify(d).length / 65) * 30, 0) : 0;
const H1 = (directions.length ? directionH : (story.length ? storyH + 16 * storyRows : 60)) + 36 + 60 + 130 + 110 + 110 + 190 + 110 + 70 * (Math.min(3, endings.length) + 1) + 90;
const H2 = (directions.length ? storyH + 16 * storyRows + 110 : 0) + 40 + 100 + Math.ceil(posts.length / 4) * 270 + ((facts.extra ?? []).length ? 50 : 0) + 100 + Math.ceil(CAT.filter((a) => a.group === "middle").length / 2) * 130 + 40;
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
console.log(`wrote ${join(dir, "research/materials.html")}, materials.png (${W}x${height1}: ${directions.length ? "the directions with their ideas, the ending" : "the story, the opening, the ending"}) and materials-posts.png (${W}x${height2}: the posts, the skill's animations)`);
