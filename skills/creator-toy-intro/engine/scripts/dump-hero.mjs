// Writes build/hero.json (the toy's parts, joints and colours) for the Blender
// look-dev script. usage: FILM=<film folder> node engine/scripts/dump-hero.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FILM } from "../lib/film.js";
import { MASCOT_PARTS, JOINTS, COLORS } from "../lib/toy.js";

mkdirSync(join(FILM, "build"), { recursive: true });
writeFileSync(join(FILM, "build/hero.json"), JSON.stringify({ parts: MASCOT_PARTS, joints: JOINTS, colors: COLORS }, null, 1));
console.log(`hero.json: ${MASCOT_PARTS.length} parts`);
