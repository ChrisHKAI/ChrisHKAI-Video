// Writes build/hero.json (the mascot's parts, joints and colours) for the
// Blender look-dev script. usage: node scripts/dump-hero.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MASCOT_PARTS, JOINTS, COLORS } from "../src/hero.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/hero.json"), JSON.stringify({ parts: MASCOT_PARTS, joints: JOINTS, colors: COLORS }, null, 1));
console.log(`hero.json: ${MASCOT_PARTS.length} parts`);
