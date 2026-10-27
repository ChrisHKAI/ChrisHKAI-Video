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
//           lookdev  Blender turnaround of the toy → build/lookdev/, beside its picture: compare.jpg
//           estimate three frames at the final settings → how long the full render takes
//           render   Blender Cycles frames → build/render/ (args after -- go to scene.py; --resume skips frames on disk)
//           finish   bloom, vignette, grain, H.264 + AAC → out/ (and the effects-only cut), then covers and qa
//           covers   each platform's covers cut from the last frame → out/covers/
//           qa       the finished film's file, loudness, hits, exports → build/qa.txt, build/qa-sheet.jpg
//           safezone the platforms' controls over preview frames → build/safezone-check.jpg
//           storyboard  the page to sign off: parts, beat grid, previews, checks → build/storyboard/
//                    (storyboard -- --frames prints the preview frames to render)
//           animatic the whole film in EEVEE, small, with its score → build/storyboard/animatic.mp4
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { film, FILM, fromSkill } from "./lib/film.js";
import { findBlender, findPython, toolEnv } from "./lib/tools.js";

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

// Blender, the Python with the pipeline's modules, the skill's bin on PATH (engine/lib/tools.js)
const blender = findBlender() ?? "blender";
const PY = findPython() ?? "python3";
const tpl = (f) => fromSkill("templates", film.template, f);
// long renders keep a Mac awake (caffeinate -i: while the command runs)
const awake = (cmd, args) => (process.platform === "darwin" ? ["caffeinate", ["-i", cmd, ...args]] : [cmd, args]);
const run = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }) });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

for (const [i, step] of steps.entries()) {
  const more = i === steps.length - 1 ? extra : [];
  switch (step) {
    case "recipes":
      // "@tool" is one of the engine's tools (engine/scripts/tool.py); anything else is the film's own recipe
      for (const r of film.recipes ?? []) run(PY, [r.startsWith("@") ? fromSkill("engine/scripts", `${r.slice(1)}.py`) : join(FILM, "recipes", r)]);
      break;
    case "glyphs": run(PY, [fromSkill("engine/scripts/glyphs.py"), ...more]); break;
    case "hero": run("node", [fromSkill("engine/scripts/dump-hero.mjs")]); break;
    case "ui": run("node", [fromSkill("engine/scripts/build-ui.mjs"), ...more]); break;
    case "anim": run("node", [fromSkill("engine/scripts/export-anim.mjs")]); break;
    case "sound": run(PY, [tpl("score.py")]); break;
    case "lookdev":
      run(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/lookdev.py"), "--", ...more]);
      if (!more.includes("--avatar")) run(PY, [fromSkill("engine/scripts/toysheet.py"), ...(more.includes("--out") ? ["--in", more[more.indexOf("--out") + 1]] : [])]);
      break;
    case "render": {
      // no --frames: the whole film, its frame count from film.json (duration × fps)
      const all = more.includes("--frames") ? [] : ["--frames", `1-${film.format.duration * film.format.fps}`];
      run(...awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/scene.py"), "--", ...all, ...more]));
      break;
    }
    case "estimate": {
      // three frames at the final settings: how long the full render takes, before committing to it
      const n = film.format.duration * film.format.fps, at = [0.3, 0.55, 0.85].map((k) => Math.round(n * k));
      const [cmd, args] = awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/scene.py"), "--", "--frames", at.join(","), "--samples", "48", "--scale", "100", "--out", "build/estimate", ...more]);
      console.log(`\n▶ ${cmd} ${args.join(" ")}`);
      const r = spawnSync(cmd, args, { cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }), encoding: "utf8", maxBuffer: 1 << 26 });
      const secs = [...(r.stdout ?? "").matchAll(/rendered frame \d+ in ([\d.]+)s/g)].map((m) => +m[1]);
      if (r.status !== 0 || !secs.length) { console.error((r.stderr || r.stdout || "").slice(-2000)); process.exit(r.status || 1); }
      const per = secs.reduce((x, y) => x + y, 0) / secs.length;
      console.log(`about ${per.toFixed(0)} s a frame at 48 samples, full size: the film's ${n} frames ≈ ${(per * n / 3600).toFixed(1)} h; previews (32 samples, half size) ≈ ${(per / 16).toFixed(1)} s a frame`);
      break;
    }
    case "finish":
      run(...awake(PY, [fromSkill("engine/scripts/finish.py"), ...more]));
      run(PY, [fromSkill("engine/scripts/covers.py")]);
      run(PY, [fromSkill("engine/scripts/qa.py")]);
      break;
    case "qa": run(PY, [fromSkill("engine/scripts/qa.py"), ...more]); break;
    case "covers": run(PY, [fromSkill("engine/scripts/covers.py"), ...more]); break;
    case "safezone": run(PY, [fromSkill("engine/scripts/safezone.py"), ...more]); break;
    case "storyboard": run(PY, [fromSkill("engine/scripts/storyboard.py"), ...more]); break;
    case "animatic":
      run(...awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/scene.py"), "--", "--frames", `1-${film.format.duration * film.format.fps}`, "--engine", "eevee", "--samples", "4", "--scale", "33", "--out", "build/eev", ...more]));
      run(PY, [fromSkill("engine/scripts/animatic.py")]);
      break;
    default: console.error(`unknown step: ${step}`); process.exit(1);
  }
}
