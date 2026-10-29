// Step 2's end: puts the research and the user's picks into film.json.
// The picks are the creator's story (facts.json "story": the things picked, in
// order, each with the animation it becomes), the opening and the ending:
// they become film.json story.segments, so the film is built from what the
// user chose, not from isnail's story whole. The profile and its numbers go
// to "profile", the posts the page shows to "posts" (the pinned post, the one
// that rises), the number that rises from the page to "counter", the name,
// handle and line to the end card, the pictures the user confirmed for the toy
// to "toyFrom". Numbers stay as the platform writes them. "step" moves on to
// the toy.
//
// usage: node engine/scripts/apply-research.mjs <film folder> [--dry-run]
// reads research/facts.json:
//   "picks": { "story": ["s2", { "id": "s1", "anim": "calendar" }], "opening": "page-stand-left",
//              "cta": { "slogan": [...], "prop": "…" } }
//   (research from before the story: "picks": { "proof1": { post, number }, "proof2": { post }, "cta": … })
//   "toy": { "images", "confirmed" }
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { readNumber } from "../lib/numbers.js";
import { resolveDirection } from "../lib/research.js";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const dir = resolve(argv.find((a) => !a.startsWith("--")) ?? process.env.FILM ?? ".");
const film = JSON.parse(readFileSync(join(dir, "film.json"), "utf8"));
const facts = JSON.parse(readFileSync(join(dir, "research/facts.json"), "utf8"));
const fail = (msg) => { console.error(msg); process.exit(1); };
const warn = [];
const CAT = JSON.parse(readFileSync(join(SKILL, "beats/catalog.json"), "utf8")).animations;
const anim = (id) => CAT.find((a) => a.id === id);

const picks = facts.picks ?? fail("research/facts.json has no \"picks\" yet: the user picks from the material page first");
let selection;
try { selection = resolveDirection(facts); } catch (e) { fail(e.message); }
// the toy is only made from a picture the user said to use: many profile pictures are real people
if (!facts.toy?.confirmed || !facts.toy.images?.length) fail("the toy's picture is not confirmed yet: show the user the profile picture and ask which picture the toy is made from (research/facts.json \"toy\")");
const post = (id) => facts.posts.find((p) => p.id === id) ?? fail(`no post "${id}" in research/facts.json`);
// the stage platform's own grid shows one number per tile
const stage = film.theme.split("-")[0];
const TILE = { douyin: "likes", xhs: "likes", channels: "likes", ig: "views", x: "views" }[stage] ?? "views";
const show = (p, k) => p.numbers?.[k]?.display;

// ── the story the user picked → segments ────────────────────────────────────
// each pick: a story point's id, or { id, anim } when the user chose its second animation
const story = facts.story ?? [];
const picked = selection.story.map((x) => {
  const id = typeof x === "string" ? x : x.id;
  const s = story.find((q) => q.id === id) ?? fail(`picks.story names "${id}", which research/facts.json "story" does not have`);
  const b = (typeof x === "object" && x.anim ? s.becomes?.find((y) => y.anim === x.anim) ?? { anim: x.anim } : s.becomes?.[0]) ?? fail(`story point "${id}" says nothing it becomes ("becomes")`);
  return { s, b };
});
// the old way: the two proofs are acts 2 and 3 of isnail's story
const legacy = !picked.length && picks.proof1;
const usesAct2 = legacy || picked.some(({ b }) => b.anim === "act2");
const act2Pick = picked.find(({ b }) => b.anim === "act2");
const act3Pick = picked.find(({ b }) => b.anim === "act3");

// the posts the page shows: the one whose number rises (act 2, else the pinned one, else the first the story names),
// and the one that rises below it (act 3's, else the next)
const storyPosts = picked.flatMap(({ s }) => s.posts ?? []);
const firstId = legacy ? picks.proof1.post : act2Pick?.s.posts?.[0] ?? facts.posts.find((p) => p.pinned)?.id ?? storyPosts[0] ?? facts.posts[0]?.id;
const p1 = post(firstId ?? fail("the research found no post: the page needs one"));
const secondId = legacy ? picks.proof2.post : act3Pick?.s.posts?.[0] ?? [...storyPosts, ...facts.posts.map((p) => p.id)].find((id) => id !== p1.id);
const p2 = secondId ? post(secondId) : p1;

function asPost(p) {
  return Object.fromEntries(Object.entries({
    date: p.date,
    title: p.title,
    counts: ["replies", "reposts", "likes", "views"].map((k) => show(p, k) ?? ""),
    count: show(p, TILE),
    cover: p.cover,
    // how X shows it: an article (the default), a video, a picture post; "已置顶" only on a pinned one
    ...(p.kind && p.kind !== "article" ? { kind: p.kind } : {}),
    ...(p.pinned === false || (p.pinned === undefined && p !== facts.posts.find((q) => q.pinned)) ? { pinned: false } : {}),
  }).filter(([, v]) => v !== undefined && v !== ""));
}

// the profile: its own fields, then each number as the page writes it
const pr = facts.profile;
const profile = { name: pr.name, handle: pr.handle, bio: pr.bio ?? [], avatar: pr.avatar, banner: pr.banner, ...(pr.fields ?? {}) };
for (const [k, v] of Object.entries(pr.numbers ?? {})) profile[k] = v.display;
// X writes the count with its word under the name ("3.5万 帖子")
if (stage === "x" && pr.numbers?.posts) { profile.postsCount = `${pr.numbers.posts.display} ${pr.numbers.posts.label}`; delete profile.posts; }
for (const k of Object.keys(profile)) if (profile[k] === undefined) delete profile[k];

// the counter: the number that rises from the first post's spot on the page, as the platform writes it
const numberKey = legacy ? picks.proof1.number : act2Pick?.b.number ?? (act2Pick?.s.numbers?.[0] && Object.keys(p1.numbers ?? {}).find((k) => p1.numbers[k].display === act2Pick.s.numbers[0].display)) ?? TILE;
const n1 = p1.numbers?.[numberKey] ?? Object.values(p1.numbers ?? {})[0] ?? (usesAct2 ? fail(`post "${p1.id}" has no number "${numberKey}"`) : { display: "0", label: "" });
const c = readNumber(n1.display) ?? fail(`can't read "${n1.display}" as a number: write it as the platform does (304万, 6.5万, 7,253, 46K)`);
// it counts up as the platform writes it (6.5万, 7,253, 46K): a long label only crowds the page
if (usesAct2 && [...(n1.label ?? "")].length > 6) warn.push(`the counter's label "${n1.label}" is long for the spot under the post: a shorter word, as the app writes it, reads better`);

// the opening: the user's pick, else the one least used in the films delivered so far (the skill's own and this machine's)
function delivered() {
  const read = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return []; } };
  return [...read(join(SKILL, "engine/lib/ledger-base.json")), ...read(join(process.env.CHRISHKAI_VIDEO_HOME ?? join(homedir(), ".chrishkai-video"), "ledger.json"))];
}
let opening = picks.opening;
if (!legacy && !opening) {
  const used = Object.fromEntries(CAT.filter((a) => a.group === "opening").map((a) => [a.id, 0]));
  for (const f of delivered()) if (f.opening in used) used[f.opening]++;
  opening = Object.entries(used).sort((a, b) => a[1] - b[1])[0][0];
  warn.push(`no opening was picked: took "${opening}", the one used least so far; show the user the three and let them choose`);
}
const segOf = (id, opts = {}) => {
  const a = anim(id);
  if (id === "own" || !a) return null;
  return { ...a.film, ...opts };
};
let segments = film.story?.segments;
if (!legacy) {
  segments = [segOf(opening) ?? fail(`unknown opening "${opening}": one of ${CAT.filter((a) => a.group === "opening").map((a) => a.id).join(", ")}`)];
  for (const { s, b } of picked) {
    if (b.anim === "own") {
      // an animation written for this film (references/beats.md, "A beat of your own")
      segments.push({ beat: b.beat ?? `beats/${s.id}.js`, bars: b.bars ?? 3, ...(b.opts ?? {}) });
      if (!existsSync(join(dir, b.beat ?? `beats/${s.id}.js`))) warn.push(`"${s.line}" becomes an animation of its own: write ${b.beat ?? `beats/${s.id}.js`} before the story step (references/beats.md)`);
      continue;
    }
    const seg = segOf(b.anim, b.opts) ?? fail(`story point "${s.id}" becomes "${b.anim}", which beats/catalog.json does not have (or "own" for one written for this film)`);
    segments.push(seg);
    // act 3 hands over to the end card through its exit (the toy becomes the drawing of itself, or leaps)
    if (b.anim === "act3") segments.push({ story: "exit" });
  }
  // the end card's hits sit on the story's downbeats: after pieces that add up to whole bars it starts on the
  // downbeat before its cut (the story's own end card starts 0.383 s after one, where act 3 leaves it)
  const tpl = film.template ?? "isnail-30";
  const STORY = JSON.parse(readFileSync(join(/^\.|[\\/]/.test(tpl) ? resolve(dir, tpl) : join(SKILL, "templates", tpl), "story.json"), "utf8"));
  const bar = (60 / (film.format?.bpm ?? 120)) * 4;
  const lenOf = (g) => (g.beat ? g.len ?? g.bars * bar : (([a, b]) => b - a)((typeof g.story === "string" ? STORY.pieces[g.story] : g.story).map((v) => (v === "end" ? STORY.duration : v))));
  const before = segments.reduce((t, g) => t + lenOf(g), 0);
  const [e0] = STORY.pieces.endCard;
  const off = (((before - e0) % bar) + bar) % bar;
  segments.push(off < 1e-3 || bar - off < 1e-3 ? { story: "endCard" } : { story: [Math.floor(e0 / bar) * bar, "end"] });
}
// a beat right before the end card: the toy drops onto the prop from above
const beforeEnd = segments?.[segments.length - 2];
const exit = !legacy && beforeEnd && !beforeEnd.story ? "jump" : film.story?.exit;

const others = facts.posts.filter((p) => p !== p1 && p !== p2 && p.cover);
const ending = picks.cta ?? selection.direction?.cta;
const slogan = ending?.slogan ?? fail("picks.cta.slogan is missing (one or two short parts)");
const next = {
  ...film,
  profile,
  posts: { pinned: asPost(p1), retro: asPost(p2) },
  counter: { value: c.count, unit: c.unit, label: n1.label, display: n1.display },
  ...(others.length ? { grid: others.map((p) => ({ cover: p.cover, ...(show(p, TILE) ? { count: show(p, TILE) } : {}) })) } : {}),
  cta: {
    ...(film.cta ?? {}),
    // the prop idea the user picked with the closing line; the agent builds it (references/props.md)
    ...(ending.prop ? { prop: { ...(film.cta?.prop ?? {}), idea: ending.prop } } : {}),
    slogan: slogan.map((text, k) => ({ text, paper: k % 2 ? "red" : "cream" })),
    name: { text: pr.name, paper: "cream" },
    handle: { text: pr.handle ? `@${pr.handle}` : pr.name, paper: "blue" },
  },
  ...(legacy ? (film.story?.direction ? { story: { ...film.story, direction: null } } : {}) : { story: { ...(film.story ?? {}), segments, direction: selection.direction, ...(exit ? { exit } : {}) } }),
  toyFrom: facts.toy.images,
  source: { ...(film.source ?? {}), read: facts.read },
  step: "toy",
};
if (argv.includes("--dry-run")) console.log(JSON.stringify(next, null, 2));
else {
  writeFileSync(join(dir, "film.json"), JSON.stringify(next, null, 2) + "\n");
  const shape = legacy ? "isnail's story" : segments.map((s) => s.beat ? `${s.beat}${s.turn === "left" ? " (left)" : ""}` : s.story).join(" → ");
  console.log(`film.json: ${shape}; the page shows #${facts.posts.indexOf(p1) + 1} and #${facts.posts.indexOf(p2) + 1}, counter ${n1.display} ${n1.label}, ${others.length} grid tiles, end card; next step: the toy`);
}
for (const w of warn) console.log(`! ${w}`);
