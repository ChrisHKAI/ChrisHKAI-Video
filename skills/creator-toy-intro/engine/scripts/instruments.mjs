// The real instruments' samples, for the sounds "strings" and "band". These
// are the five libraries engine/lib/instruments.json pins: lemo-opuscar's
// packs from its GitHub release, about 1.4 GB in all. Each one is checked
// against its SHA-256 and unpacked into ~/.chrishkai-video/instruments/
// (outside any film and any repository). An interrupted download picks up
// where it stopped. A library already there is left alone.
//
// Only on the user's yes: say what, how big, from where and under which
// licence (references/onboarding.md).
//
// usage: node engine/scripts/instruments.mjs [all | vsco2ce salamander …] [--list]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { HOME, findPython } from "../lib/tools.js";

const MAN = JSON.parse(readFileSync(new URL("../lib/instruments.json", import.meta.url), "utf8"));
export const DIR = join(HOME, "instruments");
const have = (lib) => existsSync(join(DIR, lib)) && readdirSync(join(DIR, lib)).length > 0;
const argv = process.argv.slice(2);
const mb = (n) => `${(n / 1e6).toFixed(0)} MB`;

if (argv.includes("--list") || !argv.length) {
  for (const [lib, p] of Object.entries(MAN.packs)) console.log(`${have(lib) ? "✓" : "·"} ${lib.padEnd(11)} ${mb(p.size).padStart(7)}  ${p.licence.padEnd(28)} ${p.what}`);
  console.log(`\n${DIR}${argv.length ? "" : "\nusage: node engine/scripts/instruments.mjs all | <library> …"}`);
  process.exit(0);
}
const libs = argv.includes("all") ? Object.keys(MAN.packs) : argv.filter((a) => !a.startsWith("--"));
const unknown = libs.filter((l) => !MAN.packs[l]);
if (unknown.length) { console.error(`no library ${unknown.join(", ")}; known: ${Object.keys(MAN.packs).join(", ")}`); process.exit(1); }

const sha256 = (path) => new Promise((ok, fail) => {
  const h = createHash("sha256");
  createReadStream(path).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", fail);
});
// the library's folder and index.json, wherever the pack keeps them (lemo keeps core/audio/instruments/)
function find(dir, name) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.name === name) return p;
    if (e.isDirectory()) { const f = find(p, name); if (f) return f; }
  }
  return null;
}

// the sampler reads FLAC and retunes with these two (a few MB, into the skill's venv)
const py = findPython();
if (py && spawnSync(py, ["-c", "import soundfile, soxr"]).status !== 0) {
  console.log("↓ the Python modules soundfile and soxr (a few MB, PyPI)");
  if (spawnSync(py, ["-m", "pip", "install", "soundfile", "soxr"], { stdio: "inherit" }).status !== 0) { console.error("✗ could not install soundfile and soxr"); process.exit(1); }
}

mkdirSync(join(DIR, ".downloads"), { recursive: true });
for (const lib of libs) {
  if (have(lib)) { console.log(`✓ ${lib}: already there`); continue; }
  const p = MAN.packs[lib];
  const tmp = join(DIR, ".downloads", p.file);
  const url = `https://github.com/${MAN.repo}/releases/download/${MAN.tag}/${p.file}`;
  if (!existsSync(tmp) || statSync(tmp).size !== p.size) {
    console.log(`↓ ${lib}: ${p.file}, ${mb(p.size)}, ${p.licence}, from ${url}`);
    const r = spawnSync("curl", ["-L", "--fail", "--retry", "3", "--retry-delay", "2", "--connect-timeout", "20", "-C", "-", "-sS", "-o", tmp, url], { stdio: "inherit" });
    if (r.status !== 0) { console.error(`✗ ${lib}: the download stopped (curl ${r.status}); run the same command again to resume`); process.exit(1); }
  }
  if ((await sha256(tmp)) !== p.sha256) { rmSync(tmp); console.error(`✗ ${lib}: the checksum does not match engine/lib/instruments.json; the pack was deleted`); process.exit(1); }
  const stage = join(DIR, ".downloads", `${lib}-unpack`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  if (spawnSync("tar", ["-xf", tmp, "-C", stage], { stdio: "inherit" }).status !== 0) { console.error(`✗ ${lib}: could not unpack ${tmp}`); process.exit(1); }
  const src = find(stage, lib);
  if (!src) { console.error(`✗ ${lib}: no ${lib}/ folder in the pack`); process.exit(1); }
  renameSync(src, join(DIR, lib));
  const index = find(stage, "index.json");
  if (index && !existsSync(join(DIR, "index.json"))) copyFileSync(index, join(DIR, "index.json")); // every pack ships the same full index
  rmSync(stage, { recursive: true, force: true });
  rmSync(tmp);
  console.log(`✓ ${lib}: ${join(DIR, lib)}`);
}
rmSync(join(DIR, ".downloads"), { recursive: true, force: true });
