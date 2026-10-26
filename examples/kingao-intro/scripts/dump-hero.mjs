// Writes build/hero.json (the cat's parts, joints and colours) for the
// Blender look-dev script. usage: node scripts/dump-hero.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAT_PARTS, JOINTS, COLORS } from "../src/cat.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "build"), { recursive: true });
writeFileSync(join(root, "build/hero.json"), JSON.stringify({ parts: CAT_PARTS, joints: JOINTS, colors: COLORS }, null, 1));
console.log(`hero.json: ${CAT_PARTS.length} parts`);
