import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveDirection, numberProvenanceIssues } from "../skills/creator-toy-intro/engine/lib/research.js";
import { storyTestSignature, storyTestIssues } from "../skills/creator-toy-intro/engine/lib/story-test.js";
import { researchPrompt } from "../skills/creator-toy-intro/engine/lib/research-prompt.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const script = (name) => join(root, "skills/creator-toy-intro/engine/scripts", name);
const metric = (display) => ({ display, label: "views", source: "https://example.org/post", read: "2026-10-29" });
function facts() {
  return {
    platform: "x", read: "2026-10-29", profile: { name: "Test creator", handle: "test", bio: ["Tools for editors"], avatar: "assets/avatar.png", numbers: { followers: metric("150") } },
    posts: [
      { id: "p1", url: "https://example.org/p1", title: "Tool demo", pinned: true, numbers: { views: metric("1.2万") } },
      { id: "p2", url: "https://example.org/p2", title: "Tutorial", numbers: { views: metric("500") } },
    ],
    toy: { confirmed: true, images: ["assets/avatar.png"] },
    story: [
      { id: "s1", line: "Tool demo", posts: ["p1"], numbers: [metric("1.2万")], sources: [{ url: "https://example.org/p1", supports: "A real demo" }], becomes: [{ anim: "count", opts: { to: 12000, label: "views" } }] },
      { id: "s2", line: "Learn the method", posts: ["p2"], becomes: [{ anim: "phrase", opts: { text: "Learn the method" } }] },
    ],
    narrative: { audience: "Editors", goal: "Remember a useful tool", inferred: true },
    directions: [{ id: "method", title: "Learn by making", premise: "Useful tools for editors", hook: { question: "What can I make?", visual: "Reveal the demo", text: "Make this" }, beats: [{ story: "s1", role: "Show the work", action: { does: "Reveal the work", means: "See what the creator makes" } }, { story: "s2", role: "Explain the method", connection: "The tutorial explains the demo", action: { does: "Indicate the tutorial steps", means: "See how the work was made" } }], payoff: "Know what to learn", why: "Specific work and direct sources", gaps: [], cta: { slogan: ["Build along"], prop: "a tiny tool" } }],
    recommendedDirection: "method", picks: { direction: "method", opening: "page-stand" },
  };
}
function workspace(t, f = facts()) {
  const dir = mkdtempSync(join(tmpdir(), "story-directions-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const created = run(dir, "new-film.mjs", [dir, "--link", "https://x.com/test"]);
  assert.equal(created.status, 0, created.stderr);
  writeFileSync(join(dir, "research/facts.json"), JSON.stringify(f));
  if (f.picks?.direction) writeFileSync(join(dir, "research/story-test.json"), JSON.stringify(readyReport(f)));
  return dir;
}
// These are schema/integration fixtures, not an automated judgement of story quality.
function readyReport(f) {
  return { signature: storyTestSignature(f), verdict: "ready", takeaway: "A creator of editor tools", continuation: "The tutorial explains the demonstrated work", specificity: "The named demo and its own tutorial", actionMeaning: "Revealing the work and pointing at its steps directs attention to the method", material: "The demo's own interface fills the count; a jury would remember the export check turning green", issues: [] };
}
function run(dir, name, args = [], env = {}) {
  return spawnSync(process.execPath, [script(name), ...args], { encoding: "utf8", env: { ...process.env, FILM: dir, ...env }, cwd: root });
}

test("direction resolves ordered facts and permits only matching animation overrides", () => {
  const f = facts();
  assert.deepEqual(resolveDirection(f).story, ["s1", "s2"]);
  f.picks.story = ["s1", { id: "s2", anim: "phrase" }];
  assert.deepEqual(resolveDirection(f).story, f.picks.story);
  f.picks.story.reverse();
  assert.throws(() => resolveDirection(f), /differs/);
});

test("unsupported or broken directions cannot be applied", () => {
  for (const [mutate, pattern] of [
    [f => { f.picks.direction = "missing"; }, /name one direction/],
    [f => { f.directions[0].beats[1].story = "missing"; }, /missing story/],
    [f => { f.directions[0].beats[1].connection = ""; }, /connection/],
    [f => { f.directions[0].hook.text = ""; }, /hook.text/],
    [f => { f.directions[0].beats[1].story = "s1"; }, /repeats/],
  ]) {
    const f = facts(); mutate(f); assert.throws(() => resolveDirection(f), pattern);
  }
});

test("a direction with open evidence gaps can be chosen, the gaps repeated as a warning", () => {
  const f = facts(); f.directions[0].gaps = ["Why did they change?"];
  const { direction, warnings } = resolveDirection(f);
  assert.equal(direction.id, "method");
  assert.match(warnings.join("\n"), /open evidence gaps.*Why did they change/);
});

test("all number locations are checked, including old workspaces and blank metadata", () => {
  const f = facts();
  assert.deepEqual(numberProvenanceIssues(f), []);
  delete f.profile.numbers.followers.source;
  f.posts[0].numbers.views.read = " ";
  f.story[0].numbers[0].source = "";
  f.extra = [{ display: "3", source: "screenshot.png" }];
  f.numbers = [{ value: 0 }];
  assert.deepEqual(numberProvenanceIssues(f).map(i => i.path), ["numbers.0", "profile.numbers.followers", "posts[0].numbers.views", "story[0].numbers.0", "extra.0"]);
});

test("what the user keeps out reaches film.json, and check stops on a word that carries it", (t) => {
  const f = facts();
  f.picks.avoid = ["Build"];
  const dir = workspace(t, f);
  const applied = run(dir, "apply-research.mjs", [dir]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "film.json"))).avoid, ["Build"]);
  const checked = run(dir, "check.mjs");
  assert.match(checked.stdout, /"Build" is on the user's list of things to keep out, and cta\.slogan\[0\]\.text says "Build along"/);
  assert.notEqual(checked.status, 0);
});

test("selected direction reaches film segments, ending and the preflight check", (t) => {
  const f = facts(), dir = workspace(t, f);
  const before = readFileSync(join(dir, "film.json"), "utf8");
  const dry = run(dir, "apply-research.mjs", [dir, "--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(readFileSync(join(dir, "film.json"), "utf8"), before);
  const applied = run(dir, "apply-research.mjs", [dir]);
  assert.equal(applied.status, 0, applied.stderr);
  const film = JSON.parse(readFileSync(join(dir, "film.json")));
  assert.deepEqual(film.story.direction, f.directions[0]);
  assert.equal(film.story.segments[1].beat, "count");
  assert.equal(film.story.segments[2].beat, "phrase");
  // each part says why it is there (the storyboard page shows it): the direction's action.means
  assert.equal(film.story.segments[1].why, "See what the creator makes");
  assert.equal(film.story.segments[2].why, "See how the work was made");
  assert.equal(film.cta.slogan[0].text, "Build along");
  assert.equal(film.cta.prop.idea, "a tiny tool");
  assert.equal(film.counter.display, "1.2万");
  writeFileSync(join(dir, "toy.json"), JSON.stringify({ joints: {}, parts: [] }));
  assert.equal(run(dir, "check.mjs").status, 0);
  f.directions[0].payoff = "Changed promise";
  delete f.posts[0].numbers.views.source;
  writeFileSync(join(dir, "research/facts.json"), JSON.stringify(f));
  const checked = run(dir, "check.mjs");
  assert.equal(checked.status, 1);
  assert.match(checked.stdout, /posts\[0\].numbers.views has no source/);
  assert.match(checked.stdout, /direction changed/);
});

test("existing point picks and legacy proof picks retain their behavior", (t) => {
  for (const picks of [
    { story: ["s2", "s1"], opening: "page-stand-left", cta: { slogan: ["Old story"] } },
    { proof1: { post: "p1", number: "views" }, proof2: { post: "p2" }, cta: { slogan: ["Old proofs"] } },
  ]) {
    const f = facts(); delete f.directions; f.picks = picks;
    const dir = workspace(t, f), result = run(dir, "apply-research.mjs", [dir]);
    assert.equal(result.status, 0, result.stderr);
    const film = JSON.parse(readFileSync(join(dir, "film.json")));
    assert.equal(film.cta.slogan[0].text, picks.cta.slogan[0]);
    assert.equal(film.counter.display, "1.2万");
    if (picks.story) assert.equal(film.story.segments[1].beat, "phrase");
  }
});

test("a direction is not applied before the toy picture is confirmed", (t) => {
  const f = facts(); f.toy.confirmed = false;
  const dir = workspace(t, f), before = readFileSync(join(dir, "film.json"), "utf8");
  const result = run(dir, "apply-research.mjs", [dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /picture is not confirmed/);
  assert.equal(readFileSync(join(dir, "film.json"), "utf8"), before);
});

test("material page shows complete directions and escapes source text in all languages", (t) => {
  const f = facts(); f.directions[0].title = '<script>alert("test")</script>';
  const dir = workspace(t, f);
  for (const lang of ["en", "zh-Hant", "zh-Hans"]) {
    const result = run(dir, "materials.mjs", [dir, "--html-only", "--lang", lang]);
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(join(dir, "research/materials.html"), "utf8");
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /The tutorial explains the demo/);
    assert.match(html, /Know what to learn/);
    assert.match(html, /href="https:\/\/example.org\/p1"/);
  }
});

test("next resumes a direction pick without requiring duplicate story picks", (t) => {
  const dir = workspace(t);
  const result = run(dir, "next.mjs");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /apply-research/);
  assert.doesNotMatch(result.stdout, /ask for the story/);
});

test("search prompts distinguish discovery from a bounded evidence-gap follow-up", () => {
  assert.match(researchPrompt("test"), /including low-engagement posts/);
  assert.match(researchPrompt("test"), /Historical|historical/);
  assert.match(researchPrompt("test", ["Why was this tool made?"]), /Do not repeat the top-post ranking/);
  for (const gaps of [[], [""], Array(6).fill("question"), ["a".repeat(501)]]) assert.throws(() => researchPrompt("test", gaps), /1–5/);
  assert.throws(() => researchPrompt("not a handle"), /X handle/);
});

test("saved follow-up responses reparse offline without replacing discovery results", (t) => {
  const dir = workspace(t);
  const original = '{"top":[{"url":"https://example.org/original"}]}';
  writeFileSync(join(dir, "research/grok.json"), original);
  writeFileSync(join(dir, "research/gaps.json"), JSON.stringify(["Why this tool?"]));
  const answer = { top: [], milestones: [], ideas: [], gap_answers: [{ question: "Why this tool?", status: "not_found", sources: [] }] };
  writeFileSync(join(dir, "research/grok-followup-raw.json"), JSON.stringify({ result: JSON.stringify(answer) }));
  const result = run(dir, "grok-search.mjs", [dir, "--gaps", "--from-raw"], { GROK: "/nonexistent-grok-do-not-run" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(dir, "research/grok.json"), "utf8"), original);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "research/grok-followup.json"))).gap_answers, answer.gap_answers);
});


test("preproduction story test writes a brief, never approves itself, and never stops the film", (t) => {
  const f = facts(), dir = workspace(t, f);
  rmSync(join(dir, "research/story-test.json"));
  const brief = run(dir, "story-test.mjs", [dir]);
  assert.equal(brief.status, 0, brief.stderr);
  assert.match(readFileSync(join(dir, "research/story-test.md"), "utf8"), /Specificity: replace the creator/);
  assert.equal(run(dir, "story-test.mjs", [dir, "--check"]).status, 1);
  // advice, not a gate: the direction is applied and the missing review is said
  const next = run(dir, "next.mjs");
  assert.match(next.stdout, /story-test.mjs/);
  assert.match(next.stdout, /apply-research.mjs/);
  const applied = run(dir, "apply-research.mjs", [dir]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /story test: no story test/);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "film.json"), "utf8")).story.direction, f.directions[0]);
});

test("review requires ready answers, resolved issues and purposeful actions", () => {
  const f = facts();
  assert.deepEqual(storyTestIssues(f, readyReport(f)), []);
  for (const mutate of [r => { r.verdict = "revise"; }, r => { r.specificity = " "; }, r => { r.issues = ["s1 is generic"]; }, r => { delete r.material; }]) {
    const r = readyReport(f); mutate(r); assert.ok(storyTestIssues(f, r).length);
  }
  delete f.directions[0].beats[0].action.means;
  assert.match(storyTestIssues(f, readyReport(f)).join("\n"), /s1 needs action/);
});

test("review goes stale after action, source, ending or order changes but not JSON key ordering", () => {
  const f = facts(), r = readyReport(f);
  const reordered = Object.fromEntries(Object.entries(f).reverse());
  assert.equal(storyTestSignature(reordered), r.signature);
  for (const mutate of [
    x => { x.directions[0].beats[0].action.does = "Spin around"; },
    x => { x.posts[0].title = "Different work"; },
    x => { x.picks.cta = { slogan: ["Changed promise"] }; },
    x => { x.directions[0].beats.reverse(); x.directions[0].beats[1].connection = "Another progression"; },
  ]) {
    const changed = structuredClone(f); mutate(changed);
    assert.match(storyTestIssues(changed, r).join("\n"), /stale/);
  }
});

test("current review passes check and action meanings appear in the choice page", (t) => {
  const dir = workspace(t);
  assert.equal(run(dir, "story-test.mjs", [dir, "--check"]).status, 0);
  assert.equal(run(dir, "materials.mjs", [dir, "--html-only", "--lang", "zh-Hant"]).status, 0);
  const html = readFileSync(join(dir, "research/materials.html"), "utf8");
  assert.match(html, /公仔做乜/);
  assert.match(html, /See how the work was made/);
});

test("material reasons and alternative hooks are escaped in all story-page languages", (t) => {
  const f = facts();
  f.story[0].selection = { reason: 'Useful demo <script>alert("x")</script>' };
  f.selectionNotes = ['Omit unrelated viral post <img src=x>'];
  f.directions[0].hookAlternatives = [{ question: 'What is <safe> here?', visual: 'Actual demo', text: 'Check "before" export', why: 'Concrete task & payoff' }];
  const dir = workspace(t, f);
  for (const lang of ['en', 'zh-Hant', 'zh-Hans']) {
    const result = run(dir, 'materials.mjs', [dir, '--html-only', '--lang', lang]);
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(join(dir, 'research/materials.html'), 'utf8');
    assert.ok(html.includes('Useful demo &lt;script&gt;'));
    assert.ok(html.includes('Omit unrelated viral post &lt;img src=x&gt;'));
    assert.ok(html.includes('What is &lt;safe&gt; here?'));
    assert.ok(html.includes('Concrete task &amp; payoff'));
    assert.ok(!html.includes('<script>alert('));
  }
});

test("switching to an alternative hook invalidates the review and applies only the selected hook", (t) => {
  const f = facts();
  f.directions[0].hookAlternatives = [{ question: 'What does this tool check?', visual: 'The actual demo', text: 'Check before export', why: 'Lead with the task' }];
  const dir = workspace(t, f);
  const { question, visual, text } = f.directions[0].hookAlternatives[0];
  f.directions[0].hook = { question, visual, text };
  writeFileSync(join(dir, 'research/facts.json'), JSON.stringify(f));
  // the old review no longer fits the new hook: said, not stopped
  const stale = run(dir, 'apply-research.mjs', [dir]);
  assert.equal(stale.status, 0, stale.stderr);
  assert.match(stale.stdout, /stale/);
  writeFileSync(join(dir, 'research/story-test.json'), JSON.stringify(readyReport(f)));
  const fresh = run(dir, 'apply-research.mjs', [dir]);
  assert.equal(fresh.status, 0);
  assert.doesNotMatch(fresh.stdout, /story test:/);
  const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
  assert.deepEqual(film.story.direction.hook, { question, visual, text });
  assert.equal(film.story.segments.length, 4); // opening + two factual beats + ending
});

// The idea first (references/research.md): each point carries ideas designed from its material, the film's own among them
function withIdeas(f = facts()) {
  f.story[0].special = "The demo's own screens";
  f.story[0].becomes.unshift({ anim: "own", beat: "beats/demo.js", pitch: "The demo's screens assemble into the tool", why: "Its screens fly in and lock", sketch: "research/sketches/s1.png" });
  return f;
}

test("the opening is chosen by the story: it hands over to the first point", (t) => {
  const opening = (f) => {
    const dir = workspace(t, f), r = run(dir, "apply-research.mjs", [dir]);
    assert.equal(r.status, 0, r.stderr);
    return { seg: JSON.parse(readFileSync(join(dir, "film.json"))).story.segments[0], out: r.stdout };
  };
  // a first point that is a beat: the page stands up (right or left), and the direction is asked to name it
  let f = facts(); delete f.picks.opening;
  let o = opening(f);
  assert.equal(o.seg.beat, "page-stand");
  assert.match(o.out, /names no opening/);
  // the direction's own choice wins, and no warning
  f = facts(); delete f.picks.opening; f.directions[0].opening = { id: "page-stand-left", why: "the toy comes out to the left of the page" };
  o = opening(f);
  assert.deepEqual([o.seg.beat, o.seg.turn], ["page-stand", "left"]);
  assert.doesNotMatch(o.out, /opening/);
  // a first point rising from the pinned post: the page floating, which ends on that post
  f = facts(); delete f.picks.opening; f.story[0].becomes = [{ anim: "act2" }, ...f.story[0].becomes];
  o = opening(f);
  assert.equal(o.seg.story, "opening");
  // the page floating before a beat: said, since it ends on the pinned post
  f = facts(); f.picks.opening = "opening";
  assert.match(opening(f).out, /ends with the toy on the pinned post/);
});

test("an idea is picked by its place, and a point without one of the film's own is said", (t) => {
  const f = withIdeas();
  f.picks.story = [{ id: "s1", idea: 1 }, "s2"];
  const dir = workspace(t, f), r = run(dir, "apply-research.mjs", [dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(readFileSync(join(dir, "film.json"))).story.segments[1].beat, "count");
  assert.match(r.stdout, /story point "s2" has no idea of the film's own/);
  assert.doesNotMatch(r.stdout, /story point "s1" has no idea/);
  // the direction's first idea for s1 is its own: a beat of the film still to write
  f.picks.story = ["s1", "s2"];
  writeFileSync(join(dir, "research/facts.json"), JSON.stringify(f));
  writeFileSync(join(dir, "research/story-test.json"), JSON.stringify(readyReport(f)));
  const own = run(dir, "apply-research.mjs", [dir]);
  assert.equal(JSON.parse(readFileSync(join(dir, "film.json"))).story.segments[1].beat, "beats/demo.js");
  assert.match(own.stdout, /write beats\/demo\.js/);
  // an idea that is not there stops it
  f.picks.story = [{ id: "s1", idea: 5 }, "s2"];
  writeFileSync(join(dir, "research/facts.json"), JSON.stringify(f));
  assert.match(run(dir, "apply-research.mjs", [dir]).stderr, /has no idea 5/);
});

test("the story page shows each point's ideas with their sketch and pitch, the opening the story chose, and no opening to pick", (t) => {
  const f = withIdeas();
  f.directions[0].pitch = "The tool builds itself out of its own demo";
  f.directions[0].opening = { id: "page-stand", why: "the toy comes out ready to reveal the demo" };
  const dir = workspace(t, f);
  const r = run(dir, "materials.mjs", [dir, "--html-only", "--lang", "zh-Hant"]);
  assert.equal(r.status, 0, r.stderr);
  const html = readFileSync(join(dir, "research/materials.html"), "utf8");
  assert.match(html, /The demo's screens assemble into the tool/);
  assert.match(html, /The tool builds itself out of its own demo/);
  assert.match(html, /開場（按故事揀）/);
  assert.doesNotMatch(html, /點樣開場/);
  assert.match(html, /呢條片自己嘅動畫/);
  // what still lacks an idea of the film's own, or its sketch, is said before the user sees it
  assert.match(r.stdout, /s1: its own idea "The demo's screens assemble into the tool" has no sketch/);
  assert.match(r.stdout, /s2 "Learn the method": no idea of the film's own yet/);
  // the page the studio serves: its pictures beside it, and a note on any card
  const served = readFileSync(join(dir, "research/story/index.html"), "utf8");
  assert.match(served, /id="notes"/);
  assert.doesNotMatch(served, /file:\/\//);
  // older workspaces without directions keep the opening choice
  delete f.directions; f.picks = { story: ["s1"] };
  writeFileSync(join(dir, "research/facts.json"), JSON.stringify(f));
  assert.equal(run(dir, "materials.mjs", [dir, "--html-only", "--lang", "zh-Hant"]).status, 0);
  assert.match(readFileSync(join(dir, "research/materials.html"), "utf8"), /點樣開場/);
});
