// Writes build/cues.json for scripts/sound.py: the story's times (EV), the
// beat and the song's drop, the instant of every count tick and every
// visible snap shut of the Duo.
// usage: node scripts/cues.mjs
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";
import { folds } from "../src/anim.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ticks = [], snaps = [];
let prev = folds(0);
for (let i = 1, dt = 1 / 2400; i * dt <= T.DURATION; i++) {
  const t = i * dt, f = folds(t);
  if (f.count > prev.count) for (let k = prev.count; k < f.count; k++) ticks.push(+t.toFixed(4));
  // the phone shuts at every half cycle
  if (Math.floor(f.phase + 0.5) > Math.floor(prev.phase + 0.5) && f.phase > 0.1) snaps.push(+t.toFixed(4));
  prev = f;
}
writeFileSync(join(root, "build/cues.json"), JSON.stringify({ EV: T.EV, BEAT: T.BEAT, SONG: T.SONG, DURATION: T.DURATION, ticks, snaps }));
console.log(`cues: ${ticks.length} ticks, ${snaps.length} snaps`);
