// The film workspace: a folder with film.json, the creator's pictures in
// assets/, and everything the pipeline writes (build/, out/, ui/). Every
// script finds it through the FILM environment variable, so the skill's code
// and one creator's data never mix.
import { readFileSync, existsSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (!process.env.FILM) throw new Error("FILM is not set: point it at a film workspace (the folder that holds film.json)");
export const FILM = resolve(process.env.FILM);
export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const film = JSON.parse(readFileSync(join(FILM, "film.json"), "utf8"));
export const fromFilm = (...p) => join(FILM, ...p);
export const fromSkill = (...p) => join(SKILL, ...p);

// the story template: one of the skill's (film.json "template": "isnail-30") or the
// film's own copy, a path in the film ("./template", made by `run.mjs own -- template`)
export const OWN_TEMPLATE = /^\.|[\\/]/.test(film.template ?? "");
export const TEMPLATE = OWN_TEMPLATE ? resolve(FILM, film.template) : join(SKILL, "templates", film.template ?? "");
export const fromTemplate = (...p) => join(TEMPLATE, ...p);
// a template's module. Templates reach the engine as "#engine/<file>": inside the
// skill its package.json maps that; for a film's own copy, engine-hooks.mjs does
let hooked = false;
export function importTemplate(...p) {
  if (OWN_TEMPLATE && !hooked) { register("./engine-hooks.mjs", import.meta.url); hooked = true; }
  return import(pathToFileURL(fromTemplate(...p)).href);
}
export const readFilmJSON = (rel, fallback) => {
  const f = fromFilm(rel);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fallback;
};
