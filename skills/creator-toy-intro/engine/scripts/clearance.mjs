// Where the toy goes into something solid (a wall, a piece pushed out of it,
// the lettering, the counter, a label, the prop), frame by frame, from
// build/anim.json: before Blender, in seconds. Each line is a moment to fix
// (references/clearance.md says how); none means nothing is in the way.
// check.mjs runs it too.
//
// usage: node engine/scripts/clearance.mjs <film folder> [--json] [--tol <mm>]   (or FILM=<film folder>)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// the folder as an argument, like the other scripts take it: film.js reads FILM when it loads
const folder = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--tol");
if (folder) process.env.FILM = resolve(folder);
if (!process.env.FILM) { console.error("usage: node engine/scripts/clearance.mjs <film folder> [--json] [--tol <mm>]"); process.exit(1); }
const { film, fromFilm } = await import("../lib/film.js");
const { clearance, describe, solidClashes, describeClashes, labelOverlaps, describeLabelOverlaps, lineOverlaps, describeLineOverlaps, edgeCrops, describeEdgeCrops, floatingSmallLetters, describeFloatingLetters, offStageHero, describeOffStageHero, offStageObjects, describeOffStageObjects, oversizedUiBoxes, describeOversizedUiBoxes, movieWraps, describeMovieWraps, cardScreenOverlaps, describeCardScreenOverlaps, heroFaceOcclusions, describeHeroFaceOcclusions, confettiOverText, describeConfettiOverText, lineBackdropClashes, describeLineBackdropClashes, propCoversToyBody, describePropCoversToyBody, heroStreaksOverText, describeHeroStreaksOverText, edgeOnCards, describeEdgeOnCards, pedestalSideClashes, describePedestalSideClashes, cardBezelMismatches, describeCardBezelMismatches, frameSlicesCard, describeFrameSlicesCard, sparksOverHeroFace, describeSparksOverHeroFace, plaqueInControlsZone, describePlaqueInControlsZone, preCutHeroGap, describePreCutHeroGap } = await import("../lib/clearance.js");

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const path = fromFilm("build/anim.json");
if (!existsSync(path)) { console.log("no build/anim.json yet: run.mjs anim first"); process.exit(1); }
const anim = JSON.parse(readFileSync(path, "utf8"));
const tol = arg("--tol") ? +arg("--tol") / 1000 : null;
const [fw, fh] = film.format?.size ?? [1920, 1080];
const { contacts, tol: limit, height } = clearance(anim, { tol, file: (p) => fromFilm(p) });
const moments = describe(contacts, height);
const rawClashes = solidClashes(anim);
const clashes = describeClashes(rawClashes);
const rawLabels = labelOverlaps(anim);
const labels = describeLabelOverlaps(rawLabels);
const lines = describeLineOverlaps(lineOverlaps(anim));
const crops = describeEdgeCrops(edgeCrops(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
const floating = describeFloatingLetters(floatingSmallLetters(anim));
const offStage = [...describeOffStageHero(offStageHero(anim)), ...describeOffStageObjects(offStageObjects(anim))];
const oversized = describeOversizedUiBoxes(oversizedUiBoxes(anim));
const wraps = describeMovieWraps(movieWraps(anim));
const cardOverlaps = describeCardScreenOverlaps(cardScreenOverlaps(anim, { aspect: fw / fh }));
const faceOcclusions = describeHeroFaceOcclusions(heroFaceOcclusions(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
const confettiText = describeConfettiOverText(confettiOverText(anim, { aspect: fw / fh }));
const lineBackdrops = describeLineBackdropClashes(lineBackdropClashes(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
const bodyOcclusions = describePropCoversToyBody(propCoversToyBody(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
const textStreaks = describeHeroStreaksOverText(heroStreaksOverText(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
const edgeOn = describeEdgeOnCards(edgeOnCards(anim, { aspect: fw / fh }));
const pedClashes = describePedestalSideClashes(pedestalSideClashes(anim));
const bezelMis = describeCardBezelMismatches(cardBezelMismatches(anim, { aspect: fw / fh }));
const frameSlices = describeFrameSlicesCard(frameSlicesCard(anim, { aspect: fw / fh }));
const faceSparks = describeSparksOverHeroFace(sparksOverHeroFace(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
const ctrlDip = describePlaqueInControlsZone(plaqueInControlsZone(anim, { aspect: fw / fh }));
const cutGaps = describePreCutHeroGap(preCutHeroGap(anim, { aspect: fw / fh, file: (p) => fromFilm(p) }));
writeFileSync(fromFilm("build/clearance.json"), JSON.stringify({ tol: limit, moments, contacts, clashes, rawClashes, labels, lines, crops, floating, offStage, oversized, wraps, cardOverlaps, faceOcclusions, confettiText, lineBackdrops, bodyOcclusions, textStreaks, edgeOn, pedClashes, bezelMis, frameSlices, faceSparks, ctrlDip, cutGaps }, null, 1));
if (process.argv.includes("--json")) console.log(JSON.stringify({ moments, clashes, labels, lines, crops, floating, offStage, oversized, wraps, cardOverlaps, faceOcclusions, confettiText, lineBackdrops, bodyOcclusions, textStreaks, edgeOn, pedClashes, bezelMis, frameSlices, faceSparks, ctrlDip, cutGaps }, null, 1));
else if (!moments.length && !clashes.length && !labels.length && !lines.length && !crops.length && !floating.length && !offStage.length && !oversized.length && !wraps.length && !cardOverlaps.length && !faceOcclusions.length && !confettiText.length && !lineBackdrops.length && !bodyOcclusions.length && !textStreaks.length && !edgeOn.length && !pedClashes.length && !bezelMis.length && !frameSlices.length && !faceSparks.length && !ctrlDip.length && !cutGaps.length) console.log(`✓ the toy and props go through nothing (deeper than ${(limit * 1000).toFixed(1)} mm)`);
else {
  for (const m of moments) console.log(`${m.kind === "into" ? "✗" : "!"} ${m.text}`);
  for (const m of clashes) console.log(`✗ ${m.text}`);
  for (const m of labels) console.log(`✗ ${m.text}`);
  for (const m of lines) console.log(`✗ ${m.text}`);
  for (const m of offStage) console.log(`✗ ${m.text}`);
  for (const m of oversized) console.log(`✗ ${m.text}`);
  for (const m of crops) console.log(`! ${m.text}`);
  for (const m of floating) console.log(`! ${m.text}`);
  for (const m of wraps) console.log(`! ${m.text}`);
  for (const m of cardOverlaps) console.log(`! ${m.text}`);
  for (const m of faceOcclusions) console.log(`! ${m.text}`);
  for (const m of confettiText) console.log(`! ${m.text}`);
  for (const m of lineBackdrops) console.log(`! ${m.text}`);
  for (const m of bodyOcclusions) console.log(`! ${m.text}`);
  for (const m of textStreaks) console.log(`! ${m.text}`);
  for (const m of edgeOn) console.log(`! ${m.text}`);
  for (const m of pedClashes) console.log(`! ${m.text}`);
  for (const m of bezelMis) console.log(`! ${m.text}`);
  for (const m of frameSlices) console.log(`! ${m.text}`);
  for (const m of faceSparks) console.log(`! ${m.text}`);
  for (const m of ctrlDip) console.log(`! ${m.text}`);
  for (const m of cutGaps) console.log(`! ${m.text}`);
}
process.exit(moments.some((m) => m.kind === "into") || clashes.length || labels.length || lines.length || offStage.length || oversized.length ? 1 : 0);
