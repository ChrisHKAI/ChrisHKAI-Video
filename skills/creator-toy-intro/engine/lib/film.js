// The film workspace: a folder with film.json, the creator's pictures in
// assets/, and everything the pipeline writes (build/, out/, ui/). Every
// script finds it through the FILM environment variable, so the skill's code
// and one creator's data never mix.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.FILM) throw new Error("FILM is not set: point it at a film workspace (the folder that holds film.json)");
export const FILM = resolve(process.env.FILM);
export const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const film = JSON.parse(readFileSync(join(FILM, "film.json"), "utf8"));
export const fromFilm = (...p) => join(FILM, ...p);
export const fromSkill = (...p) => join(SKILL, ...p);
export const readFilmJSON = (rel, fallback) => {
  const f = fromFilm(rel);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fallback;
};
