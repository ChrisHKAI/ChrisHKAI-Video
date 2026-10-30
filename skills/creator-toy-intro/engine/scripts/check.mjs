// Before Blender: everything the film needs, said in plain words, so a mistake
// shows here in a second instead of an hour into a render. It reads film.json,
// the toy, the recipes and what they wrote, builds the film's world the way
// export-anim does and samples it, and checks every file the scene will open.
// Each line is ✓, ! (worth a look) or ✗ (will break); it exits 1 on any ✗.
// run.mjs runs it before render, estimate and animatic.
//
// usage: FILM=<film folder> node engine/scripts/check.mjs [--quiet: only ! and ✗] [--render: and the storyboard
//        page's checks and the user's sign-off, before the full render]
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { film, fromFilm, fromSkill, TEMPLATE, fromTemplate, importTemplate } from "../lib/film.js";
import { numberProvenanceIssues, resolveDirection } from "../lib/research.js";
import { storyTestIssues } from "../lib/story-test.js";

const quiet = process.argv.includes("--quiet");
const out = { ok: 0, warn: 0, bad: 0 };
const say = (kind, msg, fix) => {
  out[kind]++;
  if (quiet && kind === "ok") return;
  console.log(`${{ ok: "✓", warn: "!", bad: "✗" }[kind]} ${msg}${fix ? `\n    → ${fix}` : ""}`);
};
const json = (rel) => { try { return JSON.parse(readFileSync(fromFilm(rel), "utf8")); } catch { return null; } };
const STEPS = ["research", "toy", "story", "render", "done"];
// (a film from before "step" was written is a finished one)
const STEP = film.step ?? (film.profile ? "done" : "research");
const past = (step) => STEPS.indexOf(STEP) > STEPS.indexOf(step);

// ── film.json ───────────────────────────────────────────────────────────────
if (!existsSync(TEMPLATE)) say("bad", `the template ${film.template} is not there (${TEMPLATE})`, 'film.json "template": "isnail-30", or "./template" for the film\'s own copy');
if (!existsSync(fromSkill("themes", film.theme ?? "", "layout.js"))) say("bad", `the stage theme "${film.theme}" is not one of the skill's`, "themes/ lists them (x-desktop, x-mobile …)");
const fmt = film.format ?? {};
if (!(fmt.fps > 0 && fmt.duration > 0 && fmt.size?.length === 2)) say("bad", "film.json format needs fps, duration and size", '"format": { "fps": 30, "bpm": 120, "duration": 30, "size": [1920, 1080] }');

// ── the toy ─────────────────────────────────────────────────────────────────
const toy = existsSync(fromFilm(film.toy)) ? json(film.toy) : null;
if (!toy) {
  if (past("research")) say("bad", `the toy (${film.toy}) is missing or not valid JSON`, "build it in step 3 (references/toy.md)");
} else {
  const J = toy.joints ?? {};
  const SHAPES = ["roundBox", "ellipsoid", "arc", "blob", "tube", "prism", "loop", "plate", "mesh"];
  for (const [name, j] of Object.entries(J)) if (j.parent && !J[j.parent]) say("bad", `toy joint "${name}" hangs from "${j.parent}", which the toy has no joint for`, `add the joint, or set "parent" to one of: ${Object.keys(J).join(", ")}`);
  for (const p of toy.parts ?? []) {
    if (!J[p.group]) say("bad", `toy part "${p.name}" is in group "${p.group}", which is not a joint`, `"group": one of ${Object.keys(J).join(", ")}`);
    if (!SHAPES.includes(p.shape)) say("bad", `toy part "${p.name}" has an unknown shape "${p.shape}"`, `one of ${SHAPES.join(", ")}`);
    if ((p.shape === "tube" || p.shape === "loop") && !(p.pts?.length >= 2 && p.radii?.length)) say("bad", `toy part "${p.name}" (${p.shape}) needs "pts" (its path) and "radii"`);
    if (p.mat && !["paint", "shine"].includes(p.mat) && toy.colors && !toy.colors[p.mat]) say("bad", `toy part "${p.name}" is coloured "${p.mat}", which toy.json "colors" does not define`, `add "${p.mat}": "#rrggbb" to "colors"`);
  }
  say("ok", `the toy: ${(toy.parts ?? []).length} parts on ${Object.keys(J).length} joints (${Object.keys(J).join(", ")})`);
}

// ── what research put in film.json ──────────────────────────────────────────
if (past("research")) {
  for (const k of ["profile", "cta"]) if (!film[k]) say("bad", `film.json has no "${k}" yet`, "run apply-research (references/research.md)");
  const c = film.counter;
  if (c) {
    const shown = c.display ?? `${c.value}${c.unit}`;
    if (!/^\+?\d[\d,]*(\.\d+)?\s*\S{0,2}$/.test(String(shown).trim())) say("bad", `the counter "${shown}" does not read as a number`, "write it as the platform does: 304万, 6.5万, 7,253, 46K");
    else say("ok", `the counter: ${shown} ${c.label}`);
  }
  const facts = json("research/facts.json");
  // the number on screen is the one the user picked, written the same way
  const pick = facts?.picks?.proof1;
  if (c && pick?.post) {
    const n = facts.posts?.find((p) => p.id === pick.post)?.numbers?.[pick.number];
    if (n && c.display && n.display !== c.display) say("bad", `the counter shows ${c.display}, but the pick was ${n.display}`, "run apply-research again, or put the picked number in film.json counter.display");
  }
  for (const n of numberProvenanceIssues(facts ?? {})) say("warn", `the number ${n.display} at ${n.path} has no ${n.missing.join(" or ")}`, "research.md: every number keeps where it was read and when");
  if (facts?.picks?.direction) {
    try {
      const { direction, warnings } = resolveDirection(facts);
      for (const w of warnings) say("warn", w, "references/story-directions.md");
      if (JSON.stringify(film.story?.direction) !== JSON.stringify(direction)) say("bad", "the chosen story direction changed since it was applied", "run apply-research again, then rebuild the storyboard");
      // the story test is advice: worth a look, never a stop
      for (const issue of storyTestIssues(facts, json("research/story-test.json"))) say("warn", issue, "references/story-test.md");
    } catch (e) { say("bad", e.message, "references/story-directions.md"); }
  }
  const slogan = (film.cta?.slogan ?? []).map((s) => s.text).join("");
  if (film.cta && !slogan) say("bad", "the end card has no slogan", "film.json cta.slogan: one or two short parts");
}

// the platform's own marks on the page (film.json branding): copied from the creator's own page, never shipped
if (past("research") && (film.theme ?? "").startsWith("x-")) {
  if (!film.branding?.logo) say("warn", "the page has no X mark (film.json branding.logo is empty)", "copy the mark's SVG path from the creator's X page (the logo in its corner) into branding.logo");
  if (film.profile?.verified && !film.branding?.badge) say("warn", "the creator is verified but the page draws no badge (film.json branding.badge)", "copy the badge's SVG path from their X page into branding.badge");
}

// ── recipes ─────────────────────────────────────────────────────────────────
for (const r of film.recipes ?? []) {
  const p = r.startsWith("@") ? fromSkill("engine/scripts", `${r.slice(1)}.py`) : fromFilm("recipes", r.replace(/^(\.\/)?recipes\//, ""));
  if (!existsSync(p)) say("bad", `the recipe "${r}" is not there (${p})`, r.startsWith("@") ? "the skill's own tools are in engine/scripts/" : "a film's recipe lives in <film>/recipes/; name it by its file there");
}

// ── sound ───────────────────────────────────────────────────────────────────
if (film.sound === "own" && !(film.music?.file && existsSync(fromFilm(film.music.file)))) say("bad", 'the sound is "own" but film.json music.file is missing', 'put their song in assets/ and set "music": { "file": "assets/<song>" }');

// ── the world, built and sampled as export-anim does ────────────────────────
if (past("toy") && toy && film.profile) {
  let T = null, W = null;
  try {
    T = await importTemplate("timeline.js");
    W = await importTemplate("world.js");
    for (const w of T.SEG?.warnings ?? []) say("warn", w);
  } catch (e) {
    say("bad", `the story does not build: ${e.message.split("\n")[0]}`, hint(e));
  }
  if (W) {
    const objects = [];
    try {
      W.declare({ add: (o) => { objects.push(o); return o.name; }, pack: (t) => t, objects });
      say("ok", `the world: ${objects.length} objects`);
    } catch (e) {
      say("bad", `the world does not build: ${e.message.split("\n")[0]}`, hint(e));
    }
    // every picture the scene opens
    const images = new Set(objects.flatMap((o) => [o.mat?.image, o.geo?.img?.image]).filter(Boolean));
    if (objects.some((o) => o.mat?.type === "cover")) ["assets/cover-wall.png", "assets/cover-full.png"].forEach((p) => images.add(p));
    if (film.posts?.pinned?.cover) images.add(film.posts.pinned.cover);
    for (const p of images) if (!existsSync(fromFilm(p))) say("bad", `the scene opens ${p}, which is not there`, whoWrites(p));
    // the motion at a few moments of the film
    const D = T?.DURATION ?? fmt.duration;
    for (const t of [0, 0.25, 0.5, 0.75, 0.999].map((k) => k * D)) {
      try {
        W.sample(t, { put: () => {}, putColor: () => {}, regular: true, whole: true, scalars: W.scalars(), hex: () => [0, 0, 0] });
      } catch (e) {
        say("bad", `the film breaks at ${t.toFixed(1)} s: ${e.message.split("\n")[0]}`, hint(e));
        break;
      }
    }
    // the act-3 wall: an ink piece stands out from the box it rides on, so that box must be one the wall pushes out
    // (only when the film plays act 3: the story whole, or a piece of it inside 12–20.4 s)
    const [a3, b3] = JSON.parse(readFileSync(fromTemplate("story.json"), "utf8")).pieces?.act3 ?? [12, 20.38];
    const playsAct3 = !T?.SEG?.on || T.SEG.list.some((s) => s.kind === "story" && s.s0 < b3 && s.s1 > a3);
    const cover = json("build/cover.json"), wall = film.story?.wall;
    if (playsAct3 && T?.WALL && cover) {
      const roles = new Set(Object.values(T.WALL).map((w) => w.piece));
      for (const [role, w] of Object.entries(T.WALL)) if (!cover.pieces.some((p) => p.name === w.piece)) say("bad", `act 3's ${role} is the piece "${w.piece}", which build/cover.json does not have`, "name a piece the cover recipe cut (build/cover-check.png shows them)");
      for (const p of cover.pieces) if (p.kind === "ink" && p.of && !roles.has(p.of)) say("bad", `the ink piece "${p.name}" rides on "${p.of}", which no act-3 role pushes out`, `ride it on a role's piece (${[...roles].join(", ")}), or drop its "of"`);
      // lettering under about 20 mm on the wall smears as it pushes out and doubles the print under it
      const coverMM = film.story?.coverMM ?? JSON.parse(readFileSync(fromTemplate("story.json"), "utf8")).coverMM ?? 400;
      const wallH = (coverMM * cover.h) / cover.w;
      for (const p of cover.pieces) {
        if (p.kind !== "ink") continue;
        const vs = p.rings.flat().map((q) => q[1]);
        const mm = (Math.max(...vs) - Math.min(...vs)) * wallH;
        if (mm < 20) say("warn", `the ink piece "${p.name}" is ${mm.toFixed(0)} mm tall on the wall: small lettering smears and doubles the print under it`, "leave small words printed on the wall; push out only big type (references/cover-wall.md)");
      }
    } else if (playsAct3 && wall && !cover) say("bad", "film.json story.wall names act 3's pieces, but build/cover.json is not there", "run the cover recipe (run.mjs recipes)");
  }
}

// ── before the full render: what the storyboard page found, and the pacing ─
// (render and estimate pass --render: a long render starts only once the page is clean and signed off)
if (process.argv.includes("--render")) {
  const page = json("build/storyboard/checks.json");
  const anim = fromFilm("build/anim.json");
  if (!page) say("bad", "no storyboard page yet: the user signs off the previews before the full render", "run.mjs storyboard, render its preview frames, show the page (references/storyboard.md)");
  else {
    const stale = existsSync(anim) && statSync(fromFilm("build/storyboard/checks.json")).mtimeMs < statSync(anim).mtimeMs;
    if (stale) say("bad", "the film changed since the storyboard page was made", "run.mjs storyboard again (and the previews it lists), and show the user what changed");
    for (const c of page) if (!c.ok) say("bad", `the storyboard page: ${c.text}`, "fix it, or tell the user why it stays and start with -- --force");
    if (page.every((c) => c.ok) && !stale) say("ok", `the storyboard page: all ${page.length} checks pass`);
  }
  if (STEP !== "render" && STEP !== "done") say("bad", `film.json step is "${STEP}": the user has not signed off the storyboard`, 'show the page; once they say go, set "step": "render"');
}

console.log(`\n${out.bad ? `✗ ${out.bad} to fix` : "✓ nothing will break"}${out.warn ? `, ${out.warn} worth a look` : ""}`);
process.exit(out.bad ? 1 : 0);

// what usually lies behind an error, in a line
function hint(e) {
  const m = e.message;
  if (/no lettering|glyph/i.test(m)) return "run.mjs glyphs (it collects the characters from film.json); a character only the film's own code shows goes in film.json \"glyphs\"";
  if (/segments|piece|beat/i.test(m)) return "film.json story.segments: references/beats.md lists the pieces and the beats";
  if (/Cannot read properties of undefined/.test(m)) return `something film.json or the toy should say is missing: the line is ${(e.stack ?? "").split("\n")[1]?.trim()}`;
  return (e.stack ?? "").split("\n")[1]?.trim();
}
function whoWrites(p) {
  if (/cover-wall|cover-full/.test(p)) return "the act-3 cover recipe writes these (references/cover-wall.md); a film without act 3 leaves it out of story.segments";
  if (/avatar\.png/.test(p)) return 'the "@avatar" recipe writes it (film.json recipes)';
  if (/ui\.png|retro\.png/.test(p)) return "run.mjs ui";
  return "the recipe or the step that makes it has not run yet";
}
