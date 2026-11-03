// Where a film stands and what comes next, from its own files: which step it is
// on (film.json "step"), what that step still lacks, the commands to run in
// order, the page to show the user and where to read how. An agent picking a
// film up (or coming back to it) runs this first instead of reading every
// reference.
//
// usage: FILM=<film folder> node engine/scripts/next.mjs   (run.mjs next)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { film, fromFilm, fromTemplate } from "../lib/film.js";
import { HOME } from "../lib/tools.js";
import { storyTestIssues } from "../lib/story-test.js";

const has = (p) => existsSync(fromFilm(p));
const json = (p) => { try { return JSON.parse(readFileSync(fromFilm(p), "utf8")); } catch { return null; } };
const newer = (a, b) => has(a) && has(b) && statSync(fromFilm(a)).mtimeMs >= statSync(fromFilm(b)).mtimeMs;
const step = film.step ?? (film.profile ? "done" : "research");
const todo = [], cmds = [];
let show = null, read = null;

if (step === "research") {
  read = "references/research.md";
  // the user said yes to Grok Build in step 1: its X search runs first, before the browser
  if (film.grok === true && !has("research/grok.json")) cmds.push("node <skill>/engine/scripts/grok-search.mjs <film>   (first: the user chose Grok for the X search; in the background where you can, else wait a few minutes)");
  const facts = json("research/facts.json");
  // Grok's answer is leads: its search may not reach the profile page or know the pinned post, the browser does
  if (!facts) todo.push(`the research: the profile, the posts and their numbers (with source and date), the profile picture → research/facts.json${has("research/grok.json") ? "; Grok's leads are in research/grok.json: open the profile and each post in the browser too (the pinned post, today's counts as the page writes them)" : ""}`);
  else {
    if (!facts.toy?.confirmed) todo.push("ask which picture the toy is made from (the profile picture, or one they send) → facts.json toy");
    if (!facts.story?.length) todo.push("the creator's story: three to five things they are known for, each with its material, what is special about it, and two ideas at least designed from it (one the film's own, with a pitch and a sketch) → facts.json story (references/research.md)");
    const bare = (facts.story ?? []).filter((s) => !(s.becomes ?? []).some((b) => b.anim === "own"));
    if (facts.story?.length && bare.length && !(facts.picks?.direction || facts.picks?.story || facts.picks?.proof1)) todo.push(`an idea of the film's own, designed from its material, with its sketch, for ${bare.map((s) => s.id).join(", ")} (references/research.md, "The story first")`);
    const chosen = facts.picks?.direction || facts.picks?.story || facts.picks?.proof1;
    if (!facts.directions?.length && !chosen) todo.push("evidence map, one targeted gap search if needed, then up to three complete directions and a recommendation → facts.json directions (references/story-directions.md)");
    if (!facts.slots?.cta?.length && !facts.directions?.some((d) => d.cta?.slogan?.length)) todo.push("two or three endings: the closing line and the prop → facts.json slots.cta");
    if (facts.story?.length && !has("research/materials.png")) cmds.push("node <skill>/engine/scripts/materials.mjs <film> --lang " + (film.language ?? "zh-Hans"));
    if (has("research/materials.png") && !chosen) show = "the story page (run.mjs studio → /story/; research/materials.png for a chat): ask for the story direction (another idea for a point, if they prefer one) and the ending, one round; the story chooses the opening; notes on its cards: run.mjs comments";
    if (chosen && facts.toy?.confirmed) {
      let issues = [];
      try { issues = storyTestIssues(facts, json("research/story-test.json")); } catch (e) { issues = [e.message]; }
      // the story test is advice: recommended first, never in the way
      if (issues.length) {
        todo.push(...issues.map((issue) => `recommended: ${issue}`));
        cmds.push("node <skill>/engine/scripts/story-test.mjs <film>   (a cheap text review of the chosen story: references/story-test.md)");
      }
      cmds.push("node <skill>/engine/scripts/apply-research.mjs <film>");
    }
  }
} else if (step === "toy") {
  read = "references/toy.md";
  // a toy made for this creator before (references/toy.md): the start, still shown to the user
  const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const mine = slug(film.source?.handle ?? film.profile?.handle);
  const saved = mine && existsSync(join(HOME, "characters")) ? readdirSync(join(HOME, "characters")).filter((d) => slug(d).startsWith(mine) || (slug(d.split("-")[0]).length >= 4 && mine.startsWith(slug(d.split("-")[0])))) : [];
  if (!has(film.toy)) todo.push(`the toy, with the body its picture has (person, animal, object) → ${film.toy}${saved.length ? `; one made for them before: ${saved.map((d) => join(HOME, "characters", d)).join(", ")} (start from it, show the user anyway)` : ""}`);
  else {
    cmds.push("FILM=<film> node <skill>/engine/run.mjs lookdev");
    if (has("build/lookdev/compare.jpg") && newer("build/lookdev/compare.jpg", film.toy)) show = "build/lookdev/compare.jpg: change it from their words until they say it is right; then film.json step → story";
  }
  for (const seg of film.story?.segments ?? []) if (seg.beat?.startsWith("beats/") && !has(seg.beat)) todo.push(`write ${seg.beat}: an animation of this film's own (references/beats.md, "A beat of your own")`);
} else if (step === "story") {
  read = "references/storyboard.md (and cover-wall.md, props.md, beats.md for what the film plays)";
  for (const seg of film.story?.segments ?? []) if (seg.beat?.startsWith("beats/") && !has(seg.beat)) todo.push(`write ${seg.beat} (references/beats.md, "A beat of your own")`);
  // act 3 (a cover the toy climbs) needs its wall cut from that cover: the template only stops on it in run.mjs anim
  const act3 = (() => { try { return JSON.parse(readFileSync(fromTemplate("story.json"), "utf8")).pieces?.act3; } catch { return null; } })();
  const segs = film.story?.segments;
  const playsAct3 = act3 && (!segs?.length || segs.some((s) => s.story === "act3" || (Array.isArray(s.story) && s.story[0] < act3[1] && s.story[1] > act3[0])));
  if (playsAct3 && !film.story?.wall) todo.push("act 3's wall: a recipe that cuts the second post's cover into pieces, and film.json story.wall with their roles (references/cover-wall.md)");
  if (!film.cta?.prop?.module && !film.cta?.prop?.kind) todo.push(`the end card's prop: ${film.cta?.prop?.idea ?? "their idea"} (references/props.md; or the ready-made "plinth")`);
  cmds.push("FILM=<film> node <skill>/engine/run.mjs data check");
  // the film's own score, written once the cut is set, before the animatic (references/sound.md)
  const score = film.music?.score ?? "music/score.py";
  if ((film.sound ?? "song") === "score" && !has(score)) todo.push(`the film's own score: ${score}, compose(ctx) for this cut, once its parts and hits are set (references/sound.md); then run.mjs sound`);
  if (!has("build/storyboard/animatic.mp4")) cmds.push("FILM=<film> node <skill>/engine/run.mjs sound animatic");
  cmds.push("FILM=<film> node <skill>/engine/run.mjs storyboard -- --frames   (then render those frames as previews: references/storyboard.md)");
  cmds.push("FILM=<film> node <skill>/engine/run.mjs pace palette ledger review storyboard");
  if (has("build/storyboard/index.html")) show = "the storyboard page (run.mjs studio): the previews, the animatic with its score, the checks; on their go, film.json step → render";
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
