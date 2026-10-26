// Step 2's end: puts the research and the user's picks into film.json. The
// profile and its numbers go to "profile", the first proof to the pinned post
// (its number becomes the counter that rises from the spot where the page
// shows it), the second proof to the post whose cover stands up as a wall, the
// other posts to the grid, the name, handle and slogan to the end card.
// Numbers stay as the platform writes them. "step" moves on to the toy.
//
// usage: node engine/scripts/apply-research.mjs <film folder> [--dry-run]
// reads research/facts.json ("picks": { proof1: { post, number }, proof2: { post }, cta: { slogan } })
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readNumber } from "../lib/numbers.js";

const argv = process.argv.slice(2);
const dir = resolve(argv.find((a) => !a.startsWith("--")) ?? process.env.FILM ?? ".");
const film = JSON.parse(readFileSync(join(dir, "film.json"), "utf8"));
const facts = JSON.parse(readFileSync(join(dir, "research/facts.json"), "utf8"));
const fail = (msg) => { console.error(msg); process.exit(1); };
const warn = [];

const picks = facts.picks ?? fail("research/facts.json has no \"picks\" yet: the user picks from the material table first");
const post = (id) => facts.posts.find((p) => p.id === id) ?? fail(`no post "${id}" in research/facts.json`);
const p1 = post(picks.proof1?.post), p2 = post(picks.proof2?.post);
// the stage platform's own grid shows one number per tile
const stage = film.theme.split("-")[0];
const TILE = { douyin: "likes", xhs: "likes", channels: "likes", ig: "views", x: "views" }[stage] ?? "views";
const show = (p, k) => p.numbers?.[k]?.display;

function asPost(p) {
  return Object.fromEntries(Object.entries({
    date: p.date,
    title: p.title,
    counts: ["replies", "reposts", "likes", "views"].map((k) => show(p, k) ?? ""),
    count: show(p, TILE),
    cover: p.cover,
  }).filter(([, v]) => v !== undefined && v !== ""));
}

// the profile: its own fields, then each number as the page writes it
const pr = facts.profile;
const profile = { name: pr.name, handle: pr.handle, bio: pr.bio ?? [], avatar: pr.avatar, banner: pr.banner, ...(pr.fields ?? {}) };
for (const [k, v] of Object.entries(pr.numbers ?? {})) profile[k] = v.display;
// X writes the count with its word under the name ("3.5万 帖子")
if (stage === "x" && pr.numbers?.posts) { profile.postsCount = `${pr.numbers.posts.display} ${pr.numbers.posts.label}`; delete profile.posts; }
for (const k of Object.keys(profile)) if (profile[k] === undefined) delete profile[k];

// the counter: the first proof's number, counted up in display units
const n1 = p1.numbers?.[picks.proof1.number] ?? fail(`post "${p1.id}" has no number "${picks.proof1.number}"`);
const c = readNumber(n1.display) ?? fail(`can't read "${n1.display}" as a number`);
if (!c.whole) warn.push(`the counter counts whole numbers for now; "${n1.display}" has a decimal point (pick another number, or show it as ${Math.round(c.value / 1e3)}K)`);
if (!c.unit) warn.push(`the counter shows a unit after its digits (万, K…); "${n1.display}" has none`);
if ([...(n1.label ?? "")].length !== 2) warn.push(`the counter's label takes two characters; "${n1.label}" has ${[...(n1.label ?? "")].length}`);

const others = facts.posts.filter((p) => p !== p1 && p !== p2 && p.cover);
const slogan = picks.cta?.slogan ?? fail("picks.cta.slogan is missing (one or two short parts)");
const next = {
  ...film,
  profile,
  posts: { pinned: asPost(p1), retro: asPost(p2) },
  counter: { value: c.count, unit: c.unit, label: n1.label },
  ...(others.length ? { grid: others.map((p) => ({ cover: p.cover, ...(show(p, TILE) ? { count: show(p, TILE) } : {}) })) } : {}),
  cta: {
    ...(film.cta ?? {}),
    slogan: slogan.map((text, k) => ({ text, paper: k % 2 ? "red" : "cream" })),
    name: { text: pr.name, paper: "cream" },
    handle: { text: pr.handle ? `@${pr.handle}` : pr.name, paper: "blue" },
  },
  source: { ...(film.source ?? {}), read: facts.read },
  step: "toy",
};
if (argv.includes("--dry-run")) console.log(JSON.stringify(next, null, 2));
else {
  writeFileSync(join(dir, "film.json"), JSON.stringify(next, null, 2) + "\n");
  console.log(`film.json: profile, posts (pinned #${facts.posts.indexOf(p1) + 1}, retro #${facts.posts.indexOf(p2) + 1}), counter ${n1.display} ${n1.label}, ${others.length} grid tiles, end card; next step: the toy`);
}
for (const w of warn) console.log(`! ${w}`);
