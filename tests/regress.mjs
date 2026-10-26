// Compares what the pipeline wrote in a film workspace with a reference film
// (a folder laid out the same way: build/, assets/). Byte-equal files pass;
// for JSON files that differ, it reports the first differing path.
//
// usage: node tests/regress.mjs <film folder> <reference folder> [file...]
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [film, ref, ...only] = process.argv.slice(2);
if (!film || !ref) {
  console.log("usage: node tests/regress.mjs <film folder> <reference folder> [file...]");
  process.exit(1);
}
const FILES = only.length ? only : [
  "build/anim.json", "build/timeline.json", "build/cover.json", "build/cover2.json", "build/glyphs.json",
  "build/logo.json", "build/sticker2d.json", "assets/ui.png", "assets/retro.png", "assets/cover-full.png",
  "assets/cover-wall.png", "assets/sticker2d.png", "assets/avatar.png", "assets/audio/score.wav",
];

function firstDiff(a, b, path = "$") {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) return `${path}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`;
  if (a && typeof a === "object") {
    const keys = Array.isArray(a) ? [...Array(Math.max(a.length, b.length)).keys()] : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    if (!Array.isArray(a) && Object.keys(a).join() !== Object.keys(b).join()) return `${path}: key order or keys differ`;
    for (const k of keys) {
      const d = firstDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${a} ≠ ${b}`;
}

const SUBSET = new Set(["build/glyphs.json"]);
let bad = 0;
for (const f of FILES) {
  const A = join(film, f), B = join(ref, f);
  if (!existsSync(A) || !existsSync(B)) { console.log(`MISSING ${f}${existsSync(A) ? " (reference)" : ""}`); bad++; continue; }
  const a = readFileSync(A), b = readFileSync(B);
  if (a.equals(b)) { console.log(`same    ${f}`); continue; }
  if (SUBSET.has(f)) {
    // the film only extracts the glyphs it uses: each must equal the reference's
    const A2 = JSON.parse(a), B2 = JSON.parse(b);
    const off = Object.keys(A2).filter((k) => JSON.stringify(A2[k]) !== JSON.stringify(B2[k]));
    if (!off.length) { console.log(`subset  ${f}  (${Object.keys(A2).length} of ${Object.keys(B2).length})`); continue; }
    console.log(`DIFF    ${f}  ${off.slice(0, 5).join(", ")}`); bad++; continue;
  }
  bad++;
  if (f.endsWith(".json")) console.log(`DIFF    ${f}  ${firstDiff(JSON.parse(a), JSON.parse(b))}`);
  else console.log(`DIFF    ${f}  (${a.length} vs ${b.length} bytes)`);
}
console.log(bad ? `\n${bad} file(s) differ` : "\nall equal");
process.exit(bad ? 1 : 0);
