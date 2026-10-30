// Step 1: opens a film workspace from what onboarding settled: the creator's
// link, where the film goes, its orientation, the stage theme and the script.
// Whatever is not given is worked out: the stage is the link's platform, the
// orientation follows the publish platforms (X alone plays 16:9, any phone
// platform 9:16), the theme follows both. film.json grows from here, step by
// step ("step" says which one is next); the engine runs once it is complete.
//
// usage: node engine/scripts/new-film.mjs <folder> [--link "<url or pasted share text>"]
//          [--publish douyin,xhs] [--aspect 9:16|16:9] [--theme <id>] [--language zh-Hans|zh-Hant]
//          [--grok yes|no: asked in step 1 when this computer has Grok Build; with yes, step 2 searches X with it]
//          [--id <name>] [--force] [--dry-run: print what it would write, write nothing] [--any-platform]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readLink, stageTheme } from "../lib/link.js";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const fail = (msg) => { console.error(msg); process.exit(1); };
const VALUED = new Set(["--link", "--publish", "--aspect", "--theme", "--language", "--id", "--grok"]);
const folder = argv.find((a, i) => !a.startsWith("--") && !VALUED.has(argv[i - 1])) ?? fail("usage: node engine/scripts/new-film.mjs <folder> [--link …] [--publish …] [--aspect …]");
const dir = resolve(folder);
if (existsSync(join(dir, "film.json")) && !argv.includes("--force") && !argv.includes("--dry-run")) fail(`${join(dir, "film.json")} is already there (--force replaces it)`);

const PLATFORMS = JSON.parse(readFileSync(join(SKILL, "engine/lib/platforms.json"), "utf8")).platforms;
const THEMES = { "x-desktop": "16:9", "x-mobile": "9:16", "douyin-mobile": "9:16", "xhs-mobile": "9:16", "channels-mobile": "9:16", "ig-mobile": "9:16" };

const link = arg("--link") ? readLink(arg("--link")) : null;
if (arg("--link") && !link) fail(`no link found in: ${arg("--link")}`);
const publish = arg("--publish")?.split(",").filter(Boolean) ?? (link && PLATFORMS[link.platform] && (PLATFORMS[link.platform].release === "v1" || argv.includes("--any-platform")) ? [link.platform] : ["x"]);
const unknown = publish.filter((p) => !PLATFORMS[p]);
if (unknown.length) fail(`unknown platform ${unknown.join(", ")}; known: ${Object.keys(PLATFORMS).join(", ")}`);
// this release publishes on X only; the others come later (--any-platform for development)
const later = publish.filter((p) => PLATFORMS[p].release !== "v1");
if (later.length && !argv.includes("--any-platform")) fail(`${later.map((p) => PLATFORMS[p].name).join(", ")}: not in this release yet (it publishes on X); later releases add one platform at a time`);
const theme0 = arg("--theme");
if (theme0 && !THEMES[theme0]) fail(`unknown theme ${theme0}; known: ${Object.keys(THEMES).join(", ")}`);
const aspect = arg("--aspect") ?? (theme0 ? THEMES[theme0] : publish.some((p) => p !== "x") ? "9:16" : "16:9");
if (!["9:16", "16:9"].includes(aspect)) fail(`aspect is 9:16 or 16:9, not ${aspect}`);
const theme = theme0 ?? stageTheme(link?.platform, aspect) ?? (aspect === "16:9" ? "x-desktop" : stageTheme(publish.find((p) => stageTheme(p, "9:16")), "9:16") ?? "x-mobile");
if (THEMES[theme] !== aspect) fail(`${theme} plays ${THEMES[theme]}, not ${aspect}`);

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const id = arg("--id") ?? (slug(link?.handle ?? "") || slug(basename(dir)) || "film");
const film = {
  id,
  template: "isnail-30",
  theme,
  language: arg("--language") ?? "zh-Hans",
  format: { fps: 30, bpm: 120, duration: 30, size: aspect === "9:16" ? [1080, 1920] : [1920, 1080] },
  output: `out/${id}.mp4`,
  publish,
  ...(link ? { source: Object.fromEntries(Object.entries({ link: link.url, platform: link.platform, handle: link.handle, id: link.id, short: link.short || undefined }).filter(([, v]) => v !== undefined)) } : {}),
  step: "research",
  // whether step 2 searches X with Grok Build: asked only when this computer has it (references/onboarding.md)
  ...(arg("--grok") ? { grok: /^(y|yes|true|1)$/i.test(arg("--grok")) } : {}),
  // the toy, built in step 3 (references/toy.md)
  toy: "toy.json",
  // the profile picture that peels: the creator's own, cut to the app's circle (references/avatar.md)
  recipes: ["@avatar"],
  // the effects over a quiet bed of long chords ("song": the template's full arrangement)
  sound: "bed",
  story: {},
};
if (argv.includes("--dry-run")) { console.log(JSON.stringify(film, null, 2)); process.exit(0); }
for (const d of ["research", "assets", "recipes"]) mkdirSync(join(dir, d), { recursive: true });
writeFileSync(join(dir, "film.json"), JSON.stringify(film, null, 2) + "\n");
console.log(`wrote ${join(dir, "film.json")}`);
console.log(JSON.stringify(film, null, 2));
if (link?.short) console.log("The link is a share link: open it in the browser to reach the profile page.");
if (link && !link.themes) console.log(`${link.platform ?? "This site"} has no stage theme yet: the film plays on ${theme}.`);
