// Where the toy goes into something solid (a wall, a piece pushed out of it,
// the lettering, the counter, a label, the prop), frame by frame, from
// build/anim.json: before Blender, in seconds. Each line is a moment to fix
// (references/clearance.md says how); none means nothing is in the way.
// check.mjs runs it too.
//
// usage: FILM=<film folder> node engine/scripts/clearance.mjs [--json] [--tol <mm>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fromFilm } from "../lib/film.js";
import { clearance, describe } from "../lib/clearance.js";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const path = fromFilm("build/anim.json");
if (!existsSync(path)) { console.log("no build/anim.json yet: run.mjs anim first"); process.exit(1); }
const anim = JSON.parse(readFileSync(path, "utf8"));
const tol = arg("--tol") ? +arg("--tol") / 1000 : null;
const { contacts, tol: limit, height } = clearance(anim, { tol, file: (p) => fromFilm(p) });
const moments = describe(contacts, height);
writeFileSync(fromFilm("build/clearance.json"), JSON.stringify({ tol: limit, moments, contacts }, null, 1));
if (process.argv.includes("--json")) console.log(JSON.stringify(moments, null, 1));
else if (!moments.length) console.log(`✓ the toy goes into nothing (deeper than ${(limit * 1000).toFixed(1)} mm)`);
else for (const m of moments) console.log(`${m.kind === "into" ? "✗" : "!"} ${m.text}`);
process.exit(moments.some((m) => m.kind === "into") ? 1 : 0);
