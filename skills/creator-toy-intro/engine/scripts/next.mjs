// Where a film stands and what comes next, from its own files: which step it is
// on (film.json "step"), what that step still lacks, the commands to run in
// order, the page to show the user and where to read how. An agent picking a
// film up (or coming back to it) runs this first instead of reading every
// reference.
//
// usage: FILM=<film folder> node engine/scripts/next.mjs   (run.mjs next)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { film, fromFilm } from "../lib/film.js";
import { storyTestIssues } from "../lib/story-test.js";

const has = (p) => existsSync(fromFilm(p));
const json = (p) => { try { return JSON.parse(readFileSync(fromFilm(p), "utf8")); } catch { return null; } };
const newer = (a, b) => has(a) && has(b) && statSync(fromFilm(a)).mtimeMs >= statSync(fromFilm(b)).mtimeMs;
const step = film.step ?? (film.profile ? "done" : "research");
const todo = [], cmds = [];
let show = null, read = null;

if (step === "research") {
  read = "references/research.md";
  const facts = json("research/facts.json");
  if (!facts) todo.push("the research: the profile, the posts and their numbers (with source and date), the profile picture → research/facts.json");
  else {
    if (!facts.toy?.confirmed) todo.push("ask which picture the toy is made from (the profile picture, or one they send) → facts.json toy");
    if (!facts.story?.length) todo.push("the creator's story: three to five things they are known for, each with its material and what it becomes → facts.json story");
    const chosen = facts.picks?.direction || facts.picks?.story || facts.picks?.proof1;
    if (!facts.directions?.length && !chosen) todo.push("evidence map, one targeted gap search if needed, then up to three complete directions and a recommendation → facts.json directions (references/story-directions.md)");
    if (!facts.slots?.cta?.length && !facts.directions?.some((d) => d.cta?.slogan?.length)) todo.push("two or three endings: the closing line and the prop → facts.json slots.cta");
    if (facts.story?.length && !has("research/materials.png")) cmds.push("node <skill>/engine/scripts/materials.mjs <film> --lang " + (film.language ?? "zh-Hans"));
    if (has("research/materials.png") && !chosen) show = "research/materials.png: ask for the story direction, the opening and the ending (one round)";
    if (chosen && facts.toy?.confirmed) {
      let issues = [];
      try { issues = storyTestIssues(facts, json("research/story-test.json")); } catch (e) { issues = [e.message]; }
      if (issues.length) {
        todo.push(...issues);
        cmds.push("node <skill>/engine/scripts/story-test.mjs <film>   (review the brief, save story-test.json, then --check)");
      } else cmds.push("node <skill>/engine/scripts/apply-research.mjs <film>");
    }
  }
} else if (step === "toy") {
  read = "references/toy.md";
  if (!has(film.toy)) todo.push(`the toy, with the body its picture has (person, animal, object) → ${film.toy}`);
  else {
    cmds.push("FILM=<film> node <skill>/engine/run.mjs lookdev");
    if (has("build/lookdev/compare.jpg") && newer("build/lookdev/compare.jpg", film.toy)) show = "build/lookdev/compare.jpg: change it from their words until they say it is right; then film.json step → story";
  }
  for (const seg of film.story?.segments ?? []) if (seg.beat?.startsWith("beats/") && !has(seg.beat)) todo.push(`write ${seg.beat}: an animation of this film's own (references/beats.md, "A beat of your own")`);
} else if (step === "story") {
  read = "references/storyboard.md (and cover-wall.md, props.md, beats.md for what the film plays)";
  for (const seg of film.story?.segments ?? []) if (seg.beat?.startsWith("beats/") && !has(seg.beat)) todo.push(`write ${seg.beat} (references/beats.md, "A beat of your own")`);
  if (!film.cta?.prop?.module && !film.cta?.prop?.kind) todo.push(`the end card's prop: ${film.cta?.prop?.idea ?? "their idea"} (references/props.md; or the ready-made "plinth")`);
  cmds.push("FILM=<film> node <skill>/engine/run.mjs data check");
  if (!has("build/storyboard/animatic.mp4")) cmds.push("FILM=<film> node <skill>/engine/run.mjs animatic listen");
  else if (!readdirSync(fromFilm("build/storyboard")).some((f) => f.startsWith("sound-"))) cmds.push("FILM=<film> node <skill>/engine/run.mjs listen");
  cmds.push("FILM=<film> node <skill>/engine/run.mjs storyboard -- --frames   (then render those frames as previews: references/storyboard.md)");
  cmds.push("FILM=<film> node <skill>/engine/run.mjs pace palette ledger review storyboard");
  if (has("build/storyboard/index.html")) show = "the storyboard page (run.mjs studio): the previews, the sounds, the checks; on their go, film.json step → render";
  const checks = json("build/storyboard/checks.json");
  for (const c of checks ?? []) if (!c.ok) todo.push(`the page says: ${c.text}`);
} else if (step === "render") {
  read = "references/render.md";
  const n = Math.round(film.format.duration * film.format.fps);
  const done = has("build/render") ? readdirSync(fromFilm("build/render")).filter((f) => f.endsWith(".png")).length : 0;
  if (!has("build/estimate")) cmds.push("FILM=<film> node <skill>/engine/run.mjs estimate   (tell the user how long, before starting)");
  if (done < n) cmds.push(`FILM=<film> node <skill>/engine/run.mjs render${done ? " -- --resume" : ""}   (${done}/${n} frames; in the background)`);
  else cmds.push("FILM=<film> node <skill>/engine/run.mjs finish");
  if (has(film.output)) show = `${film.output} and build/qa-sheet.jpg: the last look; once they take it, run.mjs ledger -- --add`;
} else {
  todo.push("nothing: the film is delivered");
}

console.log(`${film.id}: step ${step}`);
if (todo.length) console.log(`\nstill to do:\n${todo.map((t) => `  - ${t}`).join("\n")}`);
if (cmds.length) console.log(`\nthen:\n${cmds.map((c) => `  ${c}`).join("\n")}`);
if (show) console.log(`\nshow the user: ${show}`);
if (read) console.log(`\nhow: ${read}`);
