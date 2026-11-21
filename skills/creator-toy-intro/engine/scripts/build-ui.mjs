// Builds the platform page as HTML (the film's theme, filled from film.json)
// and screenshots it with headless Chrome into the textures the glass slabs
// use. The template says which pages it needs (templates/<t>/ui.js); sockets
// are left empty where a 3D object stands (the profile picture, a cover wall).
//
// usage: FILM=<film folder> node engine/scripts/build-ui.mjs [--no-shot]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { film, FILM, fromFilm, fromSkill, importTemplate } from "../lib/film.js";
import { findChrome } from "../lib/tools.js";

const load = (...p) => import(pathToFileURL(fromSkill(...p)).href);
const theme = await load("themes", film.theme, "page.js");
const L = await load("themes", film.theme, "layout.js");
const { default: pages } = await importTemplate("ui.js");

// the platform's own marks (film.json branding: the X mark, the verified badge) are copied once from a creator's
// page, never shipped with the skill; this computer keeps the last ones (~/.chrishkai-video/branding/<platform>.json)
// and gives them to a film that has none, writing them into its film.json so it says what it draws
const platform = (film.theme ?? "").split("-")[0];
if (platform) {
  const home = join(process.env.CHRISHKAI_VIDEO_HOME || join(homedir(), ".chrishkai-video"), "branding");
  const kept = join(home, `${platform}.json`);
  const B = film.branding ?? {};
  const had = existsSync(kept) ? JSON.parse(readFileSync(kept, "utf8")) : {};
  const fill = Object.fromEntries(["logo", "badge"].filter((k) => !B[k] && had[k]).map((k) => [k, had[k]]));
  if (Object.keys(fill).length) {
    film.branding = { ...B, ...fill };
    const F = JSON.parse(readFileSync(fromFilm("film.json"), "utf8"));
    F.branding = { ...(F.branding ?? {}), ...fill };
    writeFileSync(fromFilm("film.json"), JSON.stringify(F, null, 2) + "\n");
    console.log(`the page's ${Object.keys(fill).join(" and ")}: this computer's copy from an earlier film (${kept}), written into film.json branding`);
  }
  const mine = Object.fromEntries(["logo", "badge"].filter((k) => B[k] && B[k] !== had[k]).map((k) => [k, B[k]]));
  if (Object.keys(mine).length) {
    mkdirSync(home, { recursive: true });
    writeFileSync(kept, JSON.stringify({ ...had, ...mine }, null, 2) + "\n");
  }
}

for (const d of ["ui", "assets", "build"]) mkdirSync(fromFilm(d), { recursive: true });
const asset = (f) => `'file://${encodeURI(fromFilm(f))}'`; // for url(...) inside double-quoted attributes
const list = pages({ theme, film, L, asset, filmDir: FILM });
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
