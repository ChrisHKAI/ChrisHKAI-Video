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
import { createHash } from "node:crypto";
import { join } from "node:path";
import { film, FILM, fromFilm, fromSkill, TEMPLATE, fromTemplate, importTemplate } from "../lib/film.js";
import { numberProvenanceIssues, resolveDirection } from "../lib/research.js";
import { storyTestIssues } from "../lib/story-test.js";
import { clearance, describe, solidClashes, describeClashes, labelOverlaps, describeLabelOverlaps, lineOverlaps, describeLineOverlaps, edgeCrops, describeEdgeCrops, sunkLetters, fastReveal, floatingSmallLetters, describeFloatingLetters, offStageHero, describeOffStageHero, offStageObjects, describeOffStageObjects, oversizedUiBoxes, describeOversizedUiBoxes, movieWraps, describeMovieWraps, cardScreenOverlaps, describeCardScreenOverlaps, heroFaceOcclusions, describeHeroFaceOcclusions, confettiOverText, describeConfettiOverText, lineBackdropClashes, describeLineBackdropClashes, propCoversToyBody, describePropCoversToyBody, heroStreaksOverText, describeHeroStreaksOverText, edgeOnCards, describeEdgeOnCards, pedestalSideClashes, describePedestalSideClashes, cardBezelMismatches, describeCardBezelMismatches, frameSlicesCard, describeFrameSlicesCard, sparksOverHeroFace, describeSparksOverHeroFace, plaqueInControlsZone, describePlaqueInControlsZone, preCutHeroGap, describePreCutHeroGap, propBlocksCard, describePropBlocksCard, floatingCtaBase, describeFloatingCtaBase, ctaPropBlocksLabels, describeCtaPropBlocksLabels, emptyCutFrames, describeEmptyCutFrames, coplanarCards, describeCoplanarCards, buriedCompoundCores, describeBuriedCompoundCores, lingeringPainHeadlines, describeLingeringPainHeadlines } from "../lib/clearance.js";

const canonical = (v) => Array.isArray(v) ? v.map(canonical) : (v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
const filmSceneHash = (f) => { const { step: _step, ...rest } = f ?? {}; return createHash("sha256").update(JSON.stringify(canonical(rest))).digest("hex"); };

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
  // in one piece? (the look-dev checks it: engine/lib/toyparts.py)
  const tp = fromFilm("build/toy-parts.json");
  if (existsSync(tp) && statSync(tp).mtimeMs >= statSync(fromFilm(film.toy)).mtimeMs) {
    const found = json("build/toy-parts.json")?.found ?? [];
    for (const f of found) say(f.kind === "floating" && process.argv.includes("--render") ? "bad" : "warn", `the toy: ${f.text}`, "references/toy.md, \"In one piece\"");
    if (!found.length) say("ok", "the toy is in one piece");
  } else if (existsSync(tp)) say("warn", "the toy changed since its parts were checked", "FILM=<film> node <skill>/engine/run.mjs hero lookdev -- --parts");
}

// ── what research put in film.json ──────────────────────────────────────────
// the user chose Grok Build for the X search (film.json grok, asked in step 1): it should have run
if (film.grok === true && !existsSync(fromFilm("research/grok.json"))) say("warn", "the user chose Grok for the X search, but research/grok.json is not there: it has not run, or it failed", "node <skill>/engine/scripts/grok-search.mjs <film> (references/research.md); if it fails, tell the user what it needs");
if (past("research")) {
  for (const k of ["profile", "cta"]) if (!film[k]) say("bad", `film.json has no "${k}" yet`, "run apply-research (references/research.md)");
  const segsForAct2 = film.story?.segments;
  const [a2, b2] = existsSync(fromTemplate("story.json")) ? (JSON.parse(readFileSync(fromTemplate("story.json"), "utf8")).pieces?.act2 ?? [6, 12]) : [6, 12];
  const playsAct2 = !segsForAct2?.length || segsForAct2.some((s) => s.story === "act2" || s.story === "whole" || (Array.isArray(s.story) && s.story[0] < b2 && (s.story[1] === "end" ? Infinity : s.story[1]) > a2));
  if (playsAct2 && !film.posts?.pinned?.cover) {
    say("bad", "act 2 stands the pinned post's cover up as a wall, but film.posts.pinned.cover is empty", "set posts.pinned.cover to its image in assets/, or replace act 2 with a custom beat for a text-only post");
  }
  const c = film.counter;
  if (c && playsAct2) {
    const shown = c.display ?? `${c.value}${c.unit}`;
    if (!/^\+?\d[\d,]*(\.\d+)?\s*\S{0,2}$/.test(String(shown).trim())) say("bad", `the counter "${shown}" does not read as a number`, "write it as the platform does: 304万, 6.5万, 7,253, 46K");
    else say("ok", `the counter: ${shown} ${c.label}`);
  }
  const facts = json("research/facts.json");
  // the number on screen is the one the user picked, written the same way
  const pick = facts?.picks?.proof1;
  if (c && playsAct2 && pick?.post) {
    const n = facts.posts?.find((p) => p.id === pick.post)?.numbers?.[pick.number];
    if (n && c.display && n.display !== c.display) say("bad", `the counter shows ${c.display}, but the pick was ${n.display}`, "run apply-research again, or put the picked number in film.json counter.display");
  }
  for (const n of numberProvenanceIssues(facts ?? {})) say("warn", `the number ${n.display} at ${n.path} has no ${n.missing.join(" or ")}`, "research.md: every number keeps where it was read and when");
  if (facts?.picks?.direction) {
    try {
      const { direction, warnings } = resolveDirection(facts);
      for (const w of warnings) say("warn", w, "references/story-directions.md");
      if (JSON.stringify(film.story?.direction) !== JSON.stringify(direction)) {
        // which of its parts differ, so a change made on one side (a why reworded in film.json) is copied to the other
        // rather than re-applied: apply-research rewrites story.segments, a film's hand-made ones too
        const was = film.story?.direction ?? {}, now = direction ?? {};
        const diff = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => JSON.stringify(was[k]) !== JSON.stringify(now[k]));
        say("bad", `the chosen story direction in film.json differs from research/facts.json's (${diff.join(", ") || "its order"})`, "make the same change on both sides (film.json story.direction and the direction in research/facts.json); apply-research again only for a new direction: it rewrites story.segments");
      }
      // the story test is advice: worth a look, never a stop
      for (const issue of storyTestIssues(facts, json("research/story-test.json"))) say("warn", issue, "references/story-test.md");
    } catch (e) { say("bad", e.message, "references/story-directions.md"); }
  }
  // what the user wants kept out (film.json avoid, from picks.avoid): no word on screen may carry it
  if (film.avoid?.length) {
    const words = [];
    const collect = (v, path) => {
      if (typeof v === "string") words.push([path, v]);
      else if (Array.isArray(v)) v.forEach((x, i) => collect(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!["prop", "image", "cover", "file", "module", "colors", "color"].includes(k)) collect(x, `${path}.${k}`);
    };
    collect(film.cta, "cta"); collect(film.counter, "counter"); collect(film.story?.segments, "story.segments"); collect(film.profile, "profile");
    const norm = (x) => String(x).toLowerCase().replace(/[\s,，]/g, "");
    let hits = 0;
    for (const a of film.avoid) for (const [path, v] of words) if (norm(a) && norm(v).includes(norm(a))) { hits++; say("bad", `"${a}" is on the user's list of things to keep out, and ${path} says "${v}"`, "change that text, or ask the user"); }
    if (!hits) say("ok", `no word on screen carries what the user keeps out (${film.avoid.join(", ")}); pictures and covers: look`);
  }
  const slogan = (film.cta?.slogan ?? []).map((s) => s.text).join("");
  if (film.cta && !slogan) say("bad", "the end card has no slogan", "film.json cta.slogan: one or two short parts");
  // an idea alone is not a prop: the template would play its own (isnail's snail) in its place, and say nothing
  const prop = film.cta?.prop, segs = film.story?.segments;
  const endCard = !segs || segs.some((s) => s.story === "endCard" || (Array.isArray(s.story) && s.story[1] === "end"));
  if (endCard && prop?.idea && !prop.module && !prop.kind) say(process.argv.includes("--render") ? "bad" : "warn", `the end card's prop is an idea only ("${prop.idea}"): until its module is written, the end card plays the skill's snail`, "write it (references/props.md) and set cta.prop.module, or pick a ready-made one: cta.prop.kind \"plinth\"");
}

// the platform's own marks on the page (film.json branding): copied from the creator's own page, never shipped
if (past("research") && (film.theme ?? "").startsWith("x-")) {
  // run.mjs ui fills them from this computer's copy of an earlier film's (~/.chrishkai-video/branding/x.json)
  if (!film.branding?.logo) say("warn", "the page has no X mark (film.json branding.logo is empty)", "run.mjs ui takes this computer's copy from an earlier film; the first time, copy the mark's SVG path from the creator's X page (the logo in its corner) into branding.logo");
  if (film.profile?.verified && !film.branding?.badge) say("warn", "the creator is verified but the page draws no badge (film.json branding.badge)", "run.mjs ui takes this computer's copy from an earlier film; the first time, copy the badge's SVG path from their X page into branding.badge");
}

// ── recipes ─────────────────────────────────────────────────────────────────
for (const r of film.recipes ?? []) {
  const p = r.startsWith("@") ? fromSkill("engine/scripts", `${r.slice(1)}.py`) : fromFilm("recipes", r.replace(/^(\.\/)?recipes\//, ""));
  if (!existsSync(p)) say("bad", `the recipe "${r}" is not there (${p})`, r.startsWith("@") ? "the skill's own tools are in engine/scripts/" : "a film's recipe lives in <film>/recipes/; name it by its file there");
}

// ── sound ───────────────────────────────────────────────────────────────────
if (film.sound === "own" && !(film.music?.file && existsSync(fromFilm(film.music.file)))) say("bad", 'the sound is "own" but film.json music.file is missing', 'put their song in assets/ and set "music": { "file": "assets/<song>" }');
if (film.sound === "score" && past("toy") && !existsSync(fromFilm(film.music?.score ?? "music/score.py"))) say("warn", `the film plays its effects alone: its own score (${film.music?.score ?? "music/score.py"}) is not written yet`, "compose it once the cut is set (references/sound.md), then run.mjs sound");

// ── the world, built and sampled as export-anim does ────────────────────────
if (past("toy") && toy && film.profile) {
  let T = null, W = null, U = null;
  try {
    T = await importTemplate("timeline.js");
    W = await importTemplate("world.js");
    U = await importTemplate("ui.js").catch(() => null);
    for (const w of T.SEG?.warnings ?? []) say("warn", w);
  } catch (e) {
    say("bad", `the story does not build: ${e.message.split("\n")[0]}`, hint(e));
  }
  if (T) {
    const segsEnd = film.story?.segments;
    const hasEndCard = !segsEnd?.length || segsEnd.some((s) => s.story === "endCard" || (Array.isArray(s.story) && s.story[1] === "end"));
    if (hasEndCard && T.LETTER_STEP != null && T.LETTER_STEP < 0.045) {
      say("warn", `end-card slogan types at ${(T.LETTER_STEP * 1000).toFixed(0)} ms a letter (too fast to read as typing)`, "widen or omit story.events.lettersEnd so two-column slogans step at >= 50 ms a letter");
    }
  }
  if (W) {
    const objects = [];
    try {
      W.declare({ add: (o) => { objects.push(o); return o.name; }, pack: (t) => t, objects });
      say("ok", `the world: ${objects.length} objects`);
    } catch (e) {
      say("bad", `the world does not build: ${e.message.split("\n")[0]}`, hint(e));
    }
    // Validate custom beat music.chords and music.groove symbols upfront before Python score synthesis
    const CHORD_RE = /^[A-G][#b]?(?:maj13|maj11|maj9|maj7|mmaj7|m7b5|min9|min7|min6|m13|m11|m9|m7|m6|dim7|dim|aug7|aug|\+|9sus4|7sus4|7sus2|sus2|sus4|sus|6\/9|69|add11|add9|add4|add2|7b9|7#9|7b5|7#5|13|11|9|min|maj|5|m|7|6|)(?:\/[A-G][#b]?)?$/;
    const GROOVE_SET = new Set(["normal", "light", "half", "double", "none"]);
    for (const segInfo of (typeof W.timeline === "function" ? W.timeline()?.SEGMENTS ?? [] : [])) {
      if (segInfo?.kind !== "beat" || !segInfo.music) continue;
      const bName = segInfo.beat ?? "beat";
      if (segInfo.music.groove && !GROOVE_SET.has(segInfo.music.groove)) {
        say("warn", `${bName} music.groove "${segInfo.music.groove}" is not one of normal, light, half, double, none`, "references/beats.md");
      }
      for (const ch of segInfo.music.chords ?? []) {
        if (typeof ch !== "string" || !CHORD_RE.test(ch.trim())) {
          say("bad", `${bName} music.chords has unknown chord "${ch}"`, "write a root A–G (#/b) + m, 7, maj7, maj9, m7, m6, sus2, sus4, dim, aug, 6, 6/9, add9, 9, 11 or 13");
        }
      }
    }
    // every picture or movie the scene opens
    const images = new Set(objects.flatMap((o) => [o.mat?.image, o.mat?.movie, o.geo?.img?.image]).filter(Boolean));
    if (objects.some((o) => o.mat?.type === "cover")) ["assets/cover-wall.png", "assets/cover-full.png"].forEach((p) => images.add(p));
    if (film.posts?.pinned?.cover) images.add(film.posts.pinned.cover);
    for (const p of images) if (!existsSync(fromFilm(p))) say("bad", `the scene opens ${p}, which is not there`, whoWrites(p));
    const beatUsesUi = objects.some((o) => /^beat\d+_/.test(o.name) && [o.mat?.image, o.mat?.movie, o.geo?.img?.image].includes("assets/ui.png"));
    const expectsProfileUi = beatUsesUi || !(typeof U?.pageless === "function" && U.pageless(film, FILM));
    if (images.has("assets/ui.png") && expectsProfileUi && existsSync(fromFilm("ui/profile.html"))) {
      const uiHtml = readFileSync(fromFilm("ui/profile.html"), "utf8");
      if (uiHtml.length < 250 && !/class=|id=|<svg|<img/i.test(uiHtml)) {
        say("bad", "the scene opens assets/ui.png, but ui wrote a blank pageless texture", "run.mjs ui (or set story.profilePage: true in film.json)");
      }
    }
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
  // where the toy goes into something, from the motion as built (run.mjs anim): worth a look while
  // previewing, a stop before the full render
  const animPath = fromFilm("build/anim.json");
  const animMeta = json("build/.anim-meta.json");
  const animFresh = existsSync(animPath) && (
    statSync(animPath).mtimeMs >= statSync(fromFilm("film.json")).mtimeMs ||
    (animMeta?.filmSceneHash && animMeta.filmSceneHash === filmSceneHash(film))
  );
  if (animFresh) {
    const motion = JSON.parse(readFileSync(animPath, "utf8"));
    const { contacts, height } = clearance(motion, { file: (p) => fromFilm(p) });
    // letters standing on a floor by their baseline sink their lowest strokes into it
    for (const m of sunkLetters(motion)) say("warn", `lettering sinks: ${m.text}`, "stand it by its lowest point, not its baseline (kit.line: ln.stand; references/beats.md)");
    // letters that come one by one, faster than they read as they come
    for (const m of fastReveal(motion)) say(process.argv.includes("--render") ? "bad" : "warn", `"${m.text}" comes letter by letter in ${m.secs} s at ${m.at.toFixed(1)} s: its ${m.n} letters want ${m.need} s at least (0.05 s a letter)`, "slow the typing, or bring the line in whole (references/beats.md, Lettering)");
    const into = describe(contacts, height).filter((m) => m.kind === "into");
    for (const m of into) say(process.argv.includes("--render") ? "bad" : "warn", `the toy goes through something: ${m.text}`, "references/clearance.md says how to keep it clear");
    if (!into.length) say("ok", "the toy goes through nothing");
    const clashes = describeClashes(solidClashes(motion));
    for (const m of clashes) say(process.argv.includes("--render") ? "bad" : "warn", `objects go through each other: ${m.text}`, "references/clearance.md says how to keep props and cards clear");
    if (!clashes.length) say("ok", "no props or cards go through each other");
    const labels = describeLabelOverlaps(labelOverlaps(motion));
    for (const m of labels) say(process.argv.includes("--render") ? "bad" : "warn", `end-card labels overlap: ${m.text}`, "widen the gap between film.json cta.slogan / name / handle positions (or use cta.layout: \"two-column\")");
    if (!labels.length) say("ok", "no end-card labels overlap");
    const lines = describeLineOverlaps(lineOverlaps(motion));
    for (const m of lines) say(process.argv.includes("--render") ? "bad" : "warn", `3D lettering lines overlap: ${m.text}`, "finish fading the outgoing line before bringing the next line onto the same coordinates (references/beats.md)");
    const [fw, fh] = fmt.size ?? [1920, 1080];
    const crops = describeEdgeCrops(edgeCrops(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of crops) say("warn", `edge crop: ${m.text}`, "pull camera back slightly or switch end card to cta.layout: \"two-column\" so nothing is cut off at a frame edge");
    const floating = describeFloatingLetters(floatingSmallLetters(motion));
    for (const m of floating) say("warn", `floating small 3D lettering: ${m.text}`, "print small text flat onto the plaque with kit.picture() (or mount flush < 3 mm) so it does not smear with double shadows (references/beats.md)");
    const offStage = describeOffStageHero(offStageHero(motion));
    for (const m of offStage) say(process.argv.includes("--render") ? "bad" : "warn", `off-stage toy: ${m.text}`, "wrap toy positions in at(x, y, z) instead of bare [x, y, z] so the toy stays on the beat's stage (references/beats.md)");
    const offObjs = describeOffStageObjects(offStageObjects(motion));
    for (const m of offObjs) say(process.argv.includes("--render") ? "bad" : "warn", `off-stage object: ${m.text}`, "wrap stage-local coordinates in at(x, y, z) once—never call at(...) a second time on a point already in world space");
    const oversized = describeOversizedUiBoxes(oversizedUiBoxes(motion));
    for (const m of oversized) say(process.argv.includes("--render") ? "bad" : "warn", `oversized picture card: ${m.text}`, "place kit.picture() cards with pic.at(pos, q, scale) instead of raw trs(...) (references/beats.md)");
    const wraps = describeMovieWraps(movieWraps(motion));
    for (const m of wraps) say("warn", `video card wraps while visible: ${m.text}`, "lengthen the video clip to cover the full visible stretch, or pass { cyclic: false } to kit.picture() so it holds its final frame");
    const cardOcc = describeCardScreenOverlaps(cardScreenOverlaps(motion, { aspect: fw / fh }));
    for (const m of cardOcc) say("warn", `picture cards overlap on camera: ${m.text}`, "place simultaneous hero screens side-by-side or hide the earlier card before popping the next one in front");
    const faceOcc = describeHeroFaceOcclusions(heroFaceOcclusions(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of faceOcc) say("warn", `prop blocks the toy's face: ${m.text}`, "arc hand-held props outward around the head or lower them outside key poses so the character's eyes stay clear");
    const confText = describeConfettiOverText(confettiOverText(motion, { aspect: fw / fh }));
    for (const m of confText) say("warn", `confetti over 3D lettering: ${m.text}`, "spawn confetti lower or to the sides so flakes do not shoot across headlines or readouts");
    const lineBg = describeLineBackdropClashes(lineBackdropClashes(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of lineBg) say("warn", `3D lettering over toy or card: ${m.text}`, "set foreground 3D headlines over clean stage floor or step the toy/cards slightly back/up so strokes do not fuse with shoes or card edges at phone size (references/beats.md)");
    const bodyOcc = describePropCoversToyBody(propCoversToyBody(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of bodyOcc) say("warn", `foreground card cuts across toy body: ${m.text}`, "mount front plaques or end-card prop towers lower/behind the pedestal so they do not slice across the character's legs or torso");
    const streaks = describeHeroStreaksOverText(heroStreaksOverText(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of streaks) say("warn", `sky-drop crosses 3D lettering: ${m.text}`, "use floor-level kit.strideIn / kit.strideOut instead of vertical dropIn / leapOut so the toy does not streak across top headlines or readouts");
    const edgeOn = describeEdgeOnCards(edgeOnCards(motion, { aspect: fw / fh }));
    for (const m of edgeOn) say("warn", `plaque or card stands edge-on to camera: ${m.text}`, "face plaques and showcase cards toward cam.tr.p (pass eyeWorld = cam.tr.p to bannerLine/readoutBadge) so they do not turn sideways");
    const pedClashes = describePedestalSideClashes(pedestalSideClashes(motion));
    for (const m of pedClashes) say("warn", `side prop intersects pedestal: ${m.text}`, "offset side-standing sub-props cleanly outside the main pedestal rim (references/props.md)");
    const bezelMis = describeCardBezelMismatches(cardBezelMismatches(motion, { aspect: fw / fh }));
    for (const m of bezelMis) say("warn", `picture card overflows bezel or floor: ${m.text}`, "use kit.framedPicture(file, width) (with .standY(stageY)) so the 4-sided bezel matches the image's exact aspect ratio and sits above the plinth");
    const frameSlices = describeFrameSlicesCard(frameSlicesCard(motion, { aspect: fw / fh }));
    for (const m of frameSlices) say("warn", `foreground frame slices picture card: ${m.text}`, "do not park static hollow viewfinder bars or icon glyphs in front of a picture card—let kit.framedPicture() border the card cleanly (active wipe bars sweep across and park clear of the card)");
    const faceSparks = describeSparksOverHeroFace(sparksOverHeroFace(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of faceSparks) say("warn", `particles cross toy's face: ${m.text}`, "spawn end-card/celebration sparks higher and behind the toy (vz < 0) so streaks never cross the character's eyes");
    const ctrlDip = describePlaqueInControlsZone(plaqueInControlsZone(motion, { aspect: fw / fh }));
    for (const m of ctrlDip) say("warn", `bottom plaque in player controls zone: ${m.text}`, "lift the bottom plaque slightly (or lower camera target.y by ~8–12 mm) so lettering clears the platform scrub-bar / caption strip");
    const cutGaps = describePreCutHeroGap(preCutHeroGap(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of cutGaps) say("warn", `empty stage before cut: ${m.text}`, "tighten strideOut / leapOut to the last 0.25–0.32 s of the beat so the toy stays on stage until the cut");
    const propBlocks = describePropBlocksCard(propBlocksCard(motion, { aspect: fw / fh }));
    for (const m of propBlocks) say("warn", `foreground prop blocks card or plaque: ${m.text}`, "tuck tabletop mugs/laptops behind or clear of front readout plaques so every digit and character stays unobstructed");
    const floatBases = describeFloatingCtaBase(floatingCtaBase(motion));
    for (const m of floatBases) say("warn", `end-card plinth base lifts off floor: ${m.text}`, "add celebratory hop offsets to topAt(t) rather than baseRoot(t) so only the toy bounces while the plinth stays planted on the floor (references/props.md)");
    const ctaLabelBlocks = describeCtaPropBlocksLabels(ctaPropBlocksLabels(motion, { aspect: fw / fh, file: (p) => fromFilm(p) }));
    for (const m of ctaLabelBlocks) say("warn", `end-card toy or prop blocks labels: ${m.text}`, "anchor custom makeProp({ path }) pedestals along path[0]..path[1] (x = -0.34 in two-column landscape) so the toy and prop stay clear of the torn-paper labels (references/props.md)");
    const emptyCuts = describeEmptyCutFrames(emptyCutFrames(motion, {}));
    for (const m of emptyCuts) say("warn", `empty frame at shot cut: ${m.text}`, "start incoming stage props or toy entrance at g = 0 / EV.cut (not a frame later) so cuts never flash an empty dark frame");
    const coplanar = describeCoplanarCards(coplanarCards(motion, { aspect: fw / fh }));
    for (const m of coplanar) say(process.argv.includes("--render") ? "bad" : "warn", `coplanar or buried screen/card: ${m.text}`, "step the picture card >= 1 mm in front of its backing off-screen/lid, or use kit.screenPicture() / kit.framedPicture()");
    const buriedCores = describeBuriedCompoundCores(buriedCompoundCores(motion));
    for (const m of buriedCores) say("warn", `buried prop detail: ${m.text}`, "widen the detail core's camera-facing thickness or reduce the sibling tube/ellipsoid cap radius so center holes, pupils and LEDs stay visible");
    const painLingering = describeLingeringPainHeadlines(lingeringPainHeadlines(motion));
    for (const m of painLingering) say("warn", `lingering pain-point headline: ${m.text}`, "hide or swap the pain/rejection banner right at the beat's turn so negative copy never sits above the creator's own showcase cards");
    const unkeyed = Object.entries(motion.tracks ?? {}).filter(([, ks]) => Array.isArray(ks) && ks.length === 0).map(([nm]) => nm);
    if (unkeyed.length) {
      const sampleNames = unkeyed.slice(0, 3).join(", ") + (unkeyed.length > 3 ? ` (+${unkeyed.length - 3} more)` : "");
      say("warn", `unkeyed animated object(s) (${sampleNames}) were declared with anim: true but never placed with put()`, "pass { outline: true } to kit.putLine when declareLine declared an outline, or drop unused objects");
    }
    const palPath = fromFilm("build/palette.json");
    if (existsSync(palPath) && statSync(palPath).mtimeMs >= statSync(animPath).mtimeMs) {
      for (const c of json("build/palette.json")?.film?.cards ?? []) {
        if (c.melts) say("warn", `dark picture card melts into stage: ${c.name} (${c.image}, ${c.contrast}:1 mean, ${c.borderContrast}:1 border)`, "wrap dark UI/terminal screenshots in a bright window frame and lift midtones so the card silhouette reads on the dark stage (references/beats.md)");
        if (c.glares) say("warn", `white picture card glares under bloom: ${c.name} (${c.image}, ${Math.round((c.whiteShare ?? 0) * 100)}% stark white)`, "pass { antiglare: true } to kit.picture() or tone down white web screenshots with stagekit.antiglare() so body copy stays crisp (references/beats.md)");
        if (c.doubleBorder) say("warn", `plaque card has redundant inner 2D border inside 3D bezel: ${c.name} (${c.image})`, "use stagekit.plaque() (zero inner 2D rectangle) so kit.framedPicture() supplies one clean 3D border without box-in-a-box clutter");
        if (c.cramped) say("warn", `plaque text touches or crowds side border: ${c.name} (${c.image})`, "build segmented metric plaques with stagekit.plaque() so canvas width auto-expands with generous left/right padding");
      }
    }
  } else if (past("toy") && film.profile) say("warn", "the motion is older than film.json: whether the toy goes through anything is not checked", "run.mjs anim");
}

// ── before the full render: what the storyboard page found, and the pacing ─
// (render and estimate pass --render: a long render starts only once the page is clean and signed off)
if (process.argv.includes("--render")) {
  const page = json("build/storyboard/checks.json");
  const anim = fromFilm("build/anim.json");
  if (!page) say("bad", "no storyboard page yet: the user signs off the previews before the full render", "run.mjs storyboard, render its preview frames, show the page (references/storyboard.md)");
  else {
    const sbMeta = json("build/storyboard/.meta.json");
    const curAnimHash = existsSync(anim) && sbMeta?.animHash ? createHash("sha256").update(readFileSync(anim)).digest("hex") : null;
    const stale = existsSync(anim)
      && statSync(fromFilm("build/storyboard/checks.json")).mtimeMs < statSync(anim).mtimeMs
      && !(curAnimHash && curAnimHash === sbMeta.animHash);
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
  if (/aim\.world/i.test(m)) return "wrap stage-local aim targets in at(x, y, z) once, or offset directly from o.pos / use kit.skyPoint & kit.raiseArms";
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
