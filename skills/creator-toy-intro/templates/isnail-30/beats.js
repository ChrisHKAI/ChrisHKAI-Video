// The film's beats (film.json "story.segments": references/beats.md), each
// made from its module with what it needs: its own stage, far from the story,
// the end card and every other beat (past the camera's 40 m clip distance),
// its length, the lens, the lettering, the toy's moves and the engine.
// world.js plays them; their sounds, music and storyboard go into
// build/timeline.json.
import { existsSync } from "node:fs";
import { film, fromFilm, fromSkill, importFile, readFilmJSON } from "#engine/film.js";
import * as math from "#engine/math.js";
import * as quat from "#engine/quat.js";
import * as kit from "#engine/beatkit.js";
import { mulberry32 } from "#engine/rng.js";
import * as T from "./timeline.js";
import * as A from "./anim.js";

// "phrase" is one of the skill's beats (beats/phrase.js); a path is the film's own
const where = (name) => (/^\.|[\\/]/.test(name) ? fromFilm(name) : fromSkill("beats", `${name}.js`));

export const BEATS = [];
for (const s of T.SEG.list.filter((x) => x.kind === "beat")) {
  const k = BEATS.length;
  const file = where(s.entry.beat);
  if (!existsSync(file)) throw new Error(`story.segments[${s.i}]: no beat at ${file}`);
  const stage = [150 + 50 * k, 0, 0];
  const b = (await importFile(file)).makeBeat({
    film, opts: s.entry, len: s.len, bar: T.BAR, beat: T.BEAT, stage,
    at: (x, y, z) => [stage[0] + x, stage[1] + y, stage[2] + z],
    fov: T.FOV, aspect: T.ASPECT,
    glyph: { adv: A.adv, geo: A.glyphGeo, has: (key) => !!A.GLYPHS[key] },
    // the theme's accent, the confetti's colours, and the page (its picture, panels in UI px, the profile picture's place)
    accent: T.ACCENT,
    pop: film.pop ?? { confetti: ["#F6C445", "#4E7BEF", "#7FC86B", "#F59A3B", "#FFFFFF", "#B44CC8"] },
    page: { image: "assets/ui.png", w: T.UI_W, h: T.UI_H, panels: T.PANELS, avatar: T.AVATAR, slab: A.SLAB_T },
    signature: A.signature,
    kit, math, quat, mulberry32, readFilmJSON,
  });
  BEATS.push({ ...s, k, stage, prefix: `beat${k}_`, b });
}
// the beat playing at film time t, and t in its own seconds
export const beatAt = (t) => {
  const s = T.SEG.at(t);
  return s.kind === "beat" ? BEATS.find((x) => x.i === s.i) : null;
};
