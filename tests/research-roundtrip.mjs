// Step 2 round trip: writes the research a film's own film.json implies
// (research/facts.json, two extra test posts with test numbers so each slot
// has candidates), opens a fresh workspace with new-film, builds the material
// table, applies the picks and checks that profile, posts, counter and the end
// card's name and handle come back as the film had them, and that nothing is
// applied before the toy's picture is confirmed.
//
// usage: node tests/research-roundtrip.mjs films/isnail <scratch folder>
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

const [src, out] = process.argv.slice(2).map((p) => resolve(p));
const S = resolve("skills/creator-toy-intro/engine/scripts");
const f = JSON.parse(readFileSync(join(src, "film.json"), "utf8"));
const pr = f.profile, X = ["replies", "reposts", "likes", "views"], LABEL = { replies: "回复", reposts: "转帖", likes: "喜欢", views: f.counter.label };

rmSync(out, { recursive: true, force: true });
execFileSync("node", [join(S, "new-film.mjs"), out, "--link", `https://x.com/${pr.handle}`, "--publish", "x", "--aspect", f.format.size[0] > f.format.size[1] ? "16:9" : "9:16"], { stdio: "ignore" });
cpSync(join(src, "assets"), join(out, "assets"), { recursive: true });
const post = (id, p, extra = {}) => ({ id, url: `https://x.com/${pr.handle}/status/${id}`, date: p.date, title: p.title, cover: p.cover, numbers: Object.fromEntries(X.map((k, i) => [k, { label: LABEL[k], display: p.counts[i] }])), ...extra });
const facts = {
  platform: "x",
  url: `https://x.com/${pr.handle}`,
  read: "2026-10-26",
  note: "posts t1 and t2 are test posts with test numbers",
  profile: {
    name: pr.name, handle: pr.handle, bio: pr.bio, avatar: pr.avatar, banner: pr.banner,
    fields: { nameEmoji: pr.nameEmoji, verified: pr.verified, meta: pr.meta },
    numbers: { following: { label: "正在关注", display: pr.following }, followers: { label: "关注者", display: pr.followers }, posts: { label: pr.postsCount.split(" ")[1], display: pr.postsCount.split(" ")[0] } },
  },
  posts: [
    post("p1", f.posts.pinned, { pinned: true }),
    post("p2", { ...f.posts.retro, cover: "assets/cover-large.jpg" }),
    post("t1", { date: "9月1日", title: "test post one", counts: ["10", "20", "300", "4.2万"], cover: "assets/banner-real.jpg" }),
    post("t2", { date: "8月2日", title: "test post two", counts: ["5", "6", "70", "1.8万"], cover: "assets/avatar-real.jpg" }),
  ],
  slots: {
    proof1: [{ post: "p1", number: "views", why: "pinned, the highest count" }, { post: "t1", number: "views", why: "test" }, { post: "p2", number: "views", why: "test" }],
    proof2: [{ post: "p2", why: "its cover carries the story" }, { post: "t1", why: "test" }],
    cta: [{ slogan: f.cta.slogan.map((s) => s.text), why: "the creator's own words" }, { slogan: ["test"], why: "test" }],
  },
};
mkdirSync(join(out, "research"), { recursive: true });
writeFileSync(join(out, "research/facts.json"), JSON.stringify(facts, null, 2));
execFileSync("node", [join(S, "materials.mjs"), out, "--lang", "zh-Hant"], { stdio: "inherit" });
facts.picks = { proof1: facts.slots.proof1[0], proof2: facts.slots.proof2[0], cta: facts.slots.cta[0] };
writeFileSync(join(out, "research/facts.json"), JSON.stringify(facts, null, 2));
// it must stop while the user has not said which picture the toy is made from
let stopped = false;
try { execFileSync("node", [join(S, "apply-research.mjs"), out], { stdio: "pipe" }); } catch { stopped = true; }
facts.toy = { images: [pr.avatar], confirmed: true };
writeFileSync(join(out, "research/facts.json"), JSON.stringify(facts, null, 2));
execFileSync("node", [join(S, "apply-research.mjs"), out], { stdio: "inherit" });

const g = JSON.parse(readFileSync(join(out, "film.json"), "utf8"));
const strip = (p) => { const { cover, count, ...rest } = p; return rest; }; // the film's own posts may carry no cover / tile count
const checks = {
  "stops until the toy's picture is confirmed": [stopped, true],
  toyFrom: [g.toyFrom, [pr.avatar]],
  profile: [g.profile, pr],
  pinned: [strip(g.posts.pinned), strip(f.posts.pinned)],
  retro: [strip(g.posts.retro), strip(f.posts.retro)],
  counter: [g.counter, f.counter],
  name: [g.cta.name.text, f.cta.name.text],
  handle: [g.cta.handle.text, f.cta.handle.text],
  slogan: [g.cta.slogan.map((s) => s.text), f.cta.slogan.map((s) => s.text)],
};
let bad = 0;
for (const [k, [a, b]] of Object.entries(checks)) {
  const ok = isDeepStrictEqual(a, b);
  bad += !ok;
  console.log(`${ok ? "✓" : "✗"} ${k}${ok ? "" : `\n  got  ${JSON.stringify(a)}\n  want ${JSON.stringify(b)}`}`);
}
process.exit(bad ? 1 : 0);
