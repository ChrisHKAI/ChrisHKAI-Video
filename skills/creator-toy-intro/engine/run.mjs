// Runs pipeline steps for one film workspace, in order.
//
// usage: FILM=<film folder> node engine/run.mjs <step|group>... [-- extra args for the last step]
//   groups: data = recipes glyphs hero ui anim sound
//   steps:  recipes  the film's own recipe scripts (film.json "recipes": cover cuts, stickers, logo…)
//           glyphs   3D lettering outlines → build/glyphs.json
//           hero     the toy's parts → build/hero.json (look-dev reads it)
//           ui       the platform page as HTML → assets/ui.png …, build/timeline.json
//           anim     every object at every half frame → build/anim.json
//           sound    the synthesized score → assets/audio/score.wav
//           lookdev  Blender turnaround of the toy → build/lookdev/
//           render   Blender Cycles frames → build/render/ (args after -- go to scene.py)
//           finish   bloom, vignette, grain, H.264 + AAC → out/
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { film, FILM, fromSkill } from "./lib/film.js";

const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
const names = dash < 0 ? argv : argv.slice(0, dash);
const extra = dash < 0 ? [] : argv.slice(dash + 1);
const GROUPS = { data: ["recipes", "glyphs", "hero", "ui", "anim", "sound"] };
const steps = names.flatMap((n) => GROUPS[n] ?? [n]);
if (!steps.length) {
  console.log("usage: FILM=<film folder> node engine/run.mjs <step|group>... [-- args]");
  process.exit(1);
}

const blender = process.env.BLENDER || (existsSync("/Applications/Blender.app/Contents/MacOS/Blender") ? "/Applications/Blender.app/Contents/MacOS/Blender" : "blender");
const tpl = (f) => fromSkill("templates", film.template, f);
const run = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: FILM, env: { ...process.env, FILM } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

for (const [i, step] of steps.entries()) {
  const more = i === steps.length - 1 ? extra : [];
  switch (step) {
    case "recipes":
      for (const r of film.recipes ?? []) run("python3", [join(FILM, "recipes", r)]);
      break;
    case "glyphs": run("python3", [fromSkill("engine/scripts/glyphs.py"), ...more]); break;
    case "hero": run("node", [fromSkill("engine/scripts/dump-hero.mjs")]); break;
    case "ui": run("node", [fromSkill("engine/scripts/build-ui.mjs"), ...more]); break;
    case "anim": run("node", [fromSkill("engine/scripts/export-anim.mjs")]); break;
    case "sound": run("python3", [tpl("score.py")]); break;
    case "lookdev": run(blender, ["-b", "--factory-startup", "-P", fromSkill("engine/scripts/lookdev.py"), "--", ...more]); break;
    case "render": run(blender, ["-b", "--factory-startup", "-P", fromSkill("engine/scripts/scene.py"), "--", ...more]); break;
    case "finish": run("python3", [fromSkill("engine/scripts/finish.py"), ...more]); break;
    default: console.error(`unknown step: ${step}`); process.exit(1);
  }
}
