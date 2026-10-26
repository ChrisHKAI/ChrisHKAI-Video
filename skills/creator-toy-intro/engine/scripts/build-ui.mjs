// Builds the platform page as HTML (the film's theme, filled from film.json)
// and screenshots it with headless Chrome into the textures the glass slabs
// use. The template says which pages it needs (templates/<t>/ui.js); sockets
// are left empty where a 3D object stands (the profile picture, a cover wall).
//
// usage: FILM=<film folder> node engine/scripts/build-ui.mjs [--no-shot]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { film, FILM, fromFilm, fromSkill } from "../lib/film.js";

const load = (...p) => import(pathToFileURL(fromSkill(...p)).href);
const theme = await load("themes", film.theme, "page.js");
const L = await load("themes", film.theme, "layout.js");
const { default: pages } = await load("templates", film.template, "ui.js");

for (const d of ["ui", "assets", "build"]) mkdirSync(fromFilm(d), { recursive: true });
const asset = (f) => `'file://${encodeURI(fromFilm(f))}'`; // for url(...) inside double-quoted attributes
const list = pages({ theme, film, L, asset });
for (const p of list) writeFileSync(fromFilm(p.html), p.page);

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
  const ver = existsSync(base) ? readdirSync(base).sort().pop() : null;
  const bin = ver && join(base, ver, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
  if (bin && existsSync(bin)) return bin;
  const app = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(app)) return app;
  throw new Error("no headless Chrome found: set CHROME to its binary");
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
