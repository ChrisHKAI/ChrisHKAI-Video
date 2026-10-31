// The skill's animations (beats/catalog.json) and what an idea gives each one: its `takes`, the opts it needs and
// may have. An animation's film.json entry is its own keys (the beat or story piece, its bars, a turn) with the
// idea's opts: the values the catalog's `film` shows for those opts are another film's example (its numbers, its
// line) and never reach this one.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const CAT = JSON.parse(readFileSync(join(SKILL, "beats/catalog.json"), "utf8")).animations;
export const anim = (id) => CAT.find((a) => a.id === id);
const SHARED = ["bars", "len"]; // every beat's clock

// what is wrong with an idea's opts for this animation, in words: [] when nothing is
export function optsIssues(id, opts = {}) {
  const a = anim(id);
  if (!a || id === "own") return [];
  const need = a.takes?.required ?? [], may = a.takes?.optional ?? [];
  const known = [...need, ...may, ...(a.kind === "beat" ? SHARED : [])];
  const out = [];
  const odd = Object.keys(opts ?? {}).filter((k) => !known.includes(k));
  if (odd.length) out.push(`${id} does nothing with ${odd.map((k) => `"${k}"`).join(", ")}: it takes ${known.length ? known.map((k) => `"${k}"`).join(", ") : "no opts"}${a.takes?.note ? ` (${a.takes.note})` : ""}`);
  const missing = need.filter((k) => opts?.[k] === undefined || opts[k] === "");
  if (missing.length) out.push(`${id} needs ${missing.map((k) => `"${k}"`).join(", ")} in its opts: this creator's, never the catalog's example`);
  return out;
}

// the film.json segment an idea becomes: null for "own" (written for the film) or an id the catalog does not have
export function segmentOf(id, opts = {}) {
  const a = anim(id);
  if (!a || id === "own") return null;
  const example = new Set([...(a.takes?.required ?? []), ...(a.takes?.optional ?? [])]);
  const own = Object.fromEntries(Object.entries(a.film).filter(([k]) => !example.has(k)));
  // a story piece's opts choose its material (act 2's post and number) and stay out of its segment
  return a.kind === "story" ? own : { ...own, ...(opts ?? {}) };
}
