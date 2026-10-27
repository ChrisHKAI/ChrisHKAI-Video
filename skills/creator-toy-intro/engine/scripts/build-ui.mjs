// Builds the platform page as HTML (the film's theme, filled from film.json)
// and screenshots it with headless Chrome into the textures the glass slabs
// use. The template says which pages it needs (templates/<t>/ui.js); sockets
// are left empty where a 3D object stands (the profile picture, a cover wall).
//
// usage: FILM=<film folder> node engine/scripts/build-ui.mjs [--no-shot]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { film, FILM, fromFilm, fromSkill, importTemplate } from "../lib/film.js";
import { findChrome } from "../lib/tools.js";

const load = (...p) => import(pathToFileURL(fromSkill(...p)).href);
const theme = await load("themes", film.theme, "page.js");
const L = await load("themes", film.theme, "layout.js");
const { default: pages } = await importTemplate("ui.js");

for (const d of ["ui", "assets", "build"]) mkdirSync(fromFilm(d), { recursive: true });
const asset = (f) => `'file://${encodeURI(fromFilm(f))}'`; // for url(...) inside double-quoted attributes
const list = pages({ theme, film, L, asset });
for (const p of list) writeFileSync(fromFilm(p.html), p.page);

function chrome() {
  const bin = findChrome();
  if (!bin) throw new Error("no headless Chrome found: run step 0 (scripts/doctor.mjs) or set CHROME to its binary");
  return bin;
}
if (!process.argv.includes("--no-shot")) {
  const bin = chrome();
  for (const p of list) {
    execFileSync(bin, [
      "--headless", "--hide-scrollbars", "--disable-gpu", "--allow-file-access-from-files",
      `--window-size=${p.w},${p.h}`, `--force-device-scale-factor=${p.scale}`,
      `--screenshot=${fromFilm(p.out)}`, `file://${fromFilm(p.html)}`,
    ], { stdio: "ignore" });
  }
}
console.log(`ui built: ${list.map((p) => p.out).join(", ")} (${FILM})`);
