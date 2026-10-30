// Runs pipeline steps for one film workspace, in order.
//
// usage: FILM=<film folder> node engine/run.mjs <step|group>... [-- extra args for the last step]
//   groups: data = recipes glyphs hero ui anim sound
//   steps:  next     where the film stands: what its step still lacks, the commands in order, what to show
//           check    before Blender, in plain words, what will break (render, estimate and animatic run it
//                    first; the full render also wants the storyboard page clean and signed off; -- --force)
//           recipes  the film's own recipe scripts (film.json "recipes": cover cuts, stickers, logo…)
//           glyphs   3D lettering outlines → build/glyphs.json
//           hero     the toy's parts → build/hero.json (look-dev reads it)
//           ui       the platform page as HTML → assets/ui.png …, build/timeline.json
//           anim     every object at every half frame → build/anim.json
//           sound    the synthesized score → assets/audio/score.wav (film.json "sound": song | band | bed | strings | fx | own)
//           listen   each sound under the animatic, to choose by ear → build/storyboard/sound-<sound>.mp4
//                    (listen -- bed own: just those)
//           lookdev  Blender turnaround of the toy → build/lookdev/, beside its picture: compare.jpg
//           estimate three frames at the final settings → how long the full render takes
//           render   Blender Cycles frames → build/render/ (args after -- go to scene.py; --resume skips frames on disk)
//           finish   bloom, vignette, grain, H.264 + AAC → out/ (and the effects-only cut), then covers and qa
//           covers   each platform's covers cut from the last frame → out/covers/
//           qa       the finished film's file, loudness, hits, exports → build/qa.txt, build/qa-sheet.jpg
//           safezone the platforms' controls over preview frames → build/safezone-check.jpg
//           pace     quiet stretches, the toy hopping alone, the first hit, reading time (from anim;
//                    the storyboard page shows the same)
//           palette  the creator's colours from their own pictures, and the toy's, the lettering's and
//                    the confetti's against the stage → build/palette.json, build/palette-check.jpg
//           ledger   how this film differs from each delivered one (opening, structure, signature, colours,
//                    sound, ending: four of six at least); ledger -- --add keeps it once delivered
//           review   the independent review's brief: the film, what to watch, the checks, the
//                    rubric → build/review.md (references/review.md)
//           storyboard  the page to sign off: parts, beat grid, previews, checks → build/storyboard/
//                    (storyboard -- --frames prints the preview frames to render)
//           animatic the whole film in EEVEE, small, with its score → build/storyboard/animatic.mp4
//           studio   the storyboard page on a local server: the user clicks a spot on a real frame or
//                    the paused animatic and writes a note → build/comments.jsonl
//                    (studio -- --port 4173; runs until stopped)
//           comments the user's open notes, each with its frame marked → build/comments/<id>.jpg
//                    (comments -- --all; comments -- --done c3 "what changed")
//           own      a copy in the film to change for this film alone (own -- template scene.py):
//                    template → <film>/template/ (film.json "template": "./template"),
//                    scene.py → <film>/engine/scene.py (render, estimate and animatic use it)
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { film, FILM, fromFilm, fromSkill, fromTemplate, OWN_TEMPLATE } from "./lib/film.js";
import { HOME, findBlender, findPython, toolEnv } from "./lib/tools.js";

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
// the Blender scene: the film's own copy (engine/scene.py) when it has one, else the skill's
const scene = () => {
  if (!existsSync(fromFilm("engine/scene.py"))) return fromSkill("engine/scripts/scene.py");
  console.log("(the film's own engine/scene.py)");
  return fromFilm("engine/scene.py");
};
// long renders keep a Mac awake (caffeinate -i: while the command runs)
const awake = (cmd, args) => (process.platform === "darwin" ? ["caffeinate", ["-i", cmd, ...args]] : [cmd, args]);
const run = (cmd, args, env = {}) => {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill(), ...env }) });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// render, estimate and animatic start only once check passes (-- --force: start anyway)
const force = extra.includes("--force");
if (force) extra.splice(extra.indexOf("--force"), 1);
const gate = (full) => {
  if (force || steps.includes("check")) return;
  const r = spawnSync("node", [fromSkill("engine/scripts/check.mjs"), "--quiet", ...(full ? ["--render"] : [])], { stdio: "inherit", cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }) });
  if (r.status !== 0) { console.error("\nfix what check says first (or -- --force to start anyway)"); process.exit(1); }
};

for (const [i, step] of steps.entries()) {
  const more = i === steps.length - 1 ? extra : [];
  // the animatic is part of making the storyboard; the full render waits for the page and the user's sign-off
  // (preview frames, the animatic and the estimate need only that nothing breaks)
  if (step === "animatic" || step === "estimate") gate(false);
  if (step === "render") gate(!more.includes("--frames") || !more.includes("--samples"));
  switch (step) {
    case "check": run("node", [fromSkill("engine/scripts/check.mjs"), ...more]); break;
    case "next": run("node", [fromSkill("engine/scripts/next.mjs")]); break;
    case "recipes":
      // "@tool" is one of the engine's tools (engine/scripts/tool.py); anything else is the film's own recipe
      // (a film's recipe is named from recipes/: "cover.py"; "recipes/cover.py" works too)
      for (const r of film.recipes ?? []) run(PY, [r.startsWith("@") ? fromSkill("engine/scripts", `${r.slice(1)}.py`) : join(FILM, "recipes", r.replace(/^(\.\/)?recipes\//, ""))]);
      break;
    case "glyphs": run(PY, [fromSkill("engine/scripts/glyphs.py"), ...more]); break;
    case "hero": run("node", [fromSkill("engine/scripts/dump-hero.mjs")]); break;
    case "ui": run("node", [fromSkill("engine/scripts/build-ui.mjs"), ...more]); break;
    case "anim": {
      // the lettering follows film.json: a changed slogan, label or beat word needs its glyphs first
      const g = fromFilm("build/glyphs.json");
      if (!steps.slice(0, i).includes("glyphs") && (!existsSync(g) || statSync(g).mtimeMs < statSync(fromFilm("film.json")).mtimeMs)) {
        console.log("(film.json changed since the lettering was made: glyphs first)");
        run(PY, [fromSkill("engine/scripts/glyphs.py")]);
      }
      run("node", [fromSkill("engine/scripts/export-anim.mjs")]);
      break;
    }
    case "sound": run(PY, [fromTemplate("score.py")]); break;
    case "listen": {
      // the same picture under each sound, to choose by ear: the song, the bed, the effects alone, and their
      // own song when film.json has "music" → build/listen/<sound>.wav, under the animatic as
      // build/storyboard/sound-<sound>.mp4 (the storyboard page plays them side by side)
      // (and on real instruments, the band and the strings, where the samples are: engine/scripts/instruments.mjs)
      const real = existsSync(join(HOME, "instruments", "vsco2ce"));
      const sounds = more.length ? more : ["song", ...(real ? ["band"] : []), "bed", ...(real ? ["strings"] : []), "fx", ...(film.music?.file ? ["own"] : [])];
      mkdirSync(fromFilm("build/listen"), { recursive: true });
      const animatic = fromFilm("build/storyboard/animatic.mp4");
      for (const s of sounds) {
        run(PY, [fromTemplate("score.py")], { SOUND: s, SCORE_OUT: `build/listen/${s}.wav` });
        if (existsSync(animatic)) run("ffmpeg", ["-v", "error", "-y", "-i", animatic, "-i", fromFilm(`build/listen/${s}.wav`), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", fromFilm(`build/storyboard/sound-${s}.mp4`)]);
      }
      if (!existsSync(animatic)) console.log("no animatic yet: the versions are in build/listen/ (run.mjs animatic, then listen again to see them under the picture)");
      break;
    }
    case "lookdev":
      // the turnaround reads build/hero.json: write it from toy.json first, so a changed toy always shows
      if (!steps.slice(0, i).includes("hero")) run("node", [fromSkill("engine/scripts/dump-hero.mjs")]);
      run(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/lookdev.py"), "--", ...more]);
      if (!more.includes("--avatar")) run(PY, [fromSkill("engine/scripts/toysheet.py"), ...(more.includes("--out") ? ["--in", more[more.indexOf("--out") + 1]] : [])]);
      break;
    case "render": {
      // no --frames: the whole film, its frame count from film.json (duration × fps)
      const all = more.includes("--frames") ? [] : ["--frames", `1-${film.format.duration * film.format.fps}`];
      run(...awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", ...all, ...more]));
      break;
    }
    case "estimate": {
      // three frames at the final settings: how long the full render takes, before committing to it
      const n = film.format.duration * film.format.fps, at = [0.3, 0.55, 0.85].map((k) => Math.round(n * k));
      const [cmd, args] = awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", "--frames", at.join(","), "--samples", "48", "--scale", "100", "--out", "build/estimate", ...more]);
      console.log(`\n▶ ${cmd} ${args.join(" ")}`);
      const r = spawnSync(cmd, args, { cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }), encoding: "utf8", maxBuffer: 1 << 26 });
      const secs = [...(r.stdout ?? "").matchAll(/rendered frame \d+ in ([\d.]+)s/g)].map((m) => +m[1]);
      if (r.status !== 0 || !secs.length) { console.error((r.stderr || r.stdout || "").slice(-2000)); process.exit(r.status || 1); }
      const per = secs.reduce((x, y) => x + y, 0) / secs.length;
      // which GPU it ran on (engine/lib/device.py), or the warning that it ran on the CPU
      const gpu = (r.stdout ?? "").match(/^Cycles: .*$/m);
      if (gpu) console.log(gpu[0]);
      console.log(`about ${per.toFixed(0)} s a frame at 48 samples, full size: the film's ${n} frames ≈ ${(per * n / 3600).toFixed(1)} h; previews (32 samples, half size) ≈ ${(per / 16).toFixed(1)} s a frame`);
      break;
    }
    case "finish":
      run(...awake(PY, [fromSkill("engine/scripts/finish.py"), ...more]));
      // a side cut (the quick version: -- --in build/quick --out out/<id>-quick.mp4) gets no covers or qa
      if (!more.includes("--out")) {
        run(PY, [fromSkill("engine/scripts/covers.py")]);
        run(PY, [fromSkill("engine/scripts/qa.py")]);
      }
      break;
    case "qa": run(PY, [fromSkill("engine/scripts/qa.py"), ...more]); break;
    case "covers": run(PY, [fromSkill("engine/scripts/covers.py"), ...more]); break;
    case "safezone": run(PY, [fromSkill("engine/scripts/safezone.py"), ...more]); break;
    case "storyboard":
      // the sounds to choose from are part of the page: with an animatic and no versions yet, make them first
      if (!more.includes("--frames") && existsSync(fromFilm("build/storyboard/animatic.mp4")) && !steps.includes("listen")
        && !readdirSync(fromFilm("build/storyboard")).some((f) => f.startsWith("sound-"))) {
        console.log("(the page plays every sound under the animatic: listen first)");
        run("node", [fromSkill("engine/run.mjs"), "listen"]);
      }
      run(PY, [fromSkill("engine/scripts/storyboard.py"), ...more]);
      break;
    case "animatic":
      run(...awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", "--frames", `1-${film.format.duration * film.format.fps}`, "--engine", "eevee", "--samples", "4", "--scale", "33", "--out", "build/eev", ...more]));
      run(PY, [fromSkill("engine/scripts/animatic.py")]);
      break;
    case "studio": run("node", [fromSkill("engine/scripts/studio.mjs"), "--film", FILM, ...more]); break;
    case "comments": run(PY, [fromSkill("engine/scripts/comments.py"), ...more]); break;
    case "pace": run(PY, [fromSkill("engine/scripts/pace.py"), ...more]); break;
    case "palette": run(PY, [fromSkill("engine/scripts/palette.py"), ...more]); break;
    case "ledger": run(PY, [fromSkill("engine/scripts/ledger.py"), ...more]); break;
    case "review": run(PY, [fromSkill("engine/scripts/review.py"), ...more]); break;
    case "own":
      // what the template or the scene can't do for this film is changed in the film's own copy
      if (!more.length) { console.error("own takes what to copy: own -- template scene.py"); process.exit(1); }
      for (const what of more) {
        if (what === "template") {
          if (OWN_TEMPLATE) { console.log(`the film already has its own template: ${film.template}`); continue; }
          if (existsSync(fromFilm("template"))) { console.error(`${fromFilm("template")} is already there`); process.exit(1); }
          cpSync(fromTemplate(), fromFilm("template"), { recursive: true });
          const f = JSON.parse(readFileSync(fromFilm("film.json"), "utf8"));
          writeFileSync(fromFilm("film.json"), JSON.stringify({ ...f, template: "./template", templateFrom: film.template }, null, 2) + "\n");
          console.log(`template/ ← templates/${film.template}; film.json "template": "./template"`);
        } else if (what === "scene.py") {
          if (existsSync(fromFilm("engine/scene.py"))) { console.log("the film already has its own engine/scene.py"); continue; }
          mkdirSync(fromFilm("engine"), { recursive: true });
          cpSync(fromSkill("engine/scripts/scene.py"), fromFilm("engine/scene.py"));
          console.log("engine/scene.py ← engine/scripts/scene.py (render, estimate and animatic use it)");
        } else { console.error(`own copies template or scene.py, not ${what}`); process.exit(1); }
      }
      break;
    default: console.error(`unknown step: ${step}`); process.exit(1);
  }
}
