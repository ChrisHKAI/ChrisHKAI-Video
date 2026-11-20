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
const { fromFilm } = await import("../lib/film.js");
const { clearance, describe, solidClashes, describeClashes } = await import("../lib/clearance.js");

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const path = fromFilm("build/anim.json");
if (!existsSync(path)) { console.log("no build/anim.json yet: run.mjs anim first"); process.exit(1); }
const anim = JSON.parse(readFileSync(path, "utf8"));
const tol = arg("--tol") ? +arg("--tol") / 1000 : null;
const { contacts, tol: limit, height } = clearance(anim, { tol, file: (p) => fromFilm(p) });
const moments = describe(contacts, height);
const rawClashes = solidClashes(anim);
const clashes = describeClashes(rawClashes);
writeFileSync(fromFilm("build/clearance.json"), JSON.stringify({ tol: limit, moments, contacts, clashes, rawClashes }, null, 1));
if (process.argv.includes("--json")) console.log(JSON.stringify({ moments, clashes }, null, 1));
else if (!moments.length && !clashes.length) console.log(`✓ the toy and props go through nothing (deeper than ${(limit * 1000).toFixed(1)} mm)`);
else {
  for (const m of moments) console.log(`${m.kind === "into" ? "✗" : "!"} ${m.text}`);
  for (const m of clashes) console.log(`✗ ${m.text}`);
}
process.exit(moments.some((m) => m.kind === "into") || clashes.length ? 1 : 0);
