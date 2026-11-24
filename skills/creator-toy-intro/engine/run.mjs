// Runs pipeline steps for one film workspace, in order.
//
// usage: FILM=<film folder> node engine/run.mjs <step|group>... [-- extra args for the last step]
//   groups: data = recipes glyphs hero ui anim sound
//   steps:  next     where the film stands: what its step still lacks, the commands in order, what to show
//           check    before Blender, in plain words, what will break (render, estimate and animatic run it
//                    first; the full render also wants the storyboard page clean and signed off; -- --force)
//           clearance  frame-by-frame 3D clearance (toy, props/cards, end-card labels, edge crops, floating small type)
//           diff     which frames to re-render after a motion or texture change (-- old.json new.json | -- --images a.jpg | -- --since build/render)
//           recipes  the film's own recipe scripts (film.json "recipes": cover cuts, stickers, logo…)
//           fonts    the faces here that have every character the film shows (each film chooses its own)
//           typesheet  the film's lines in the faces it might choose, at phone size, read back
//                    (-- --faces "PingFang TC:Semibold,Lantinghei TC:Heavy") → build/type-sheet.jpg
//           glyphs   3D lettering outlines in the faces film.json "type" chose → build/glyphs.json
//           hero     the toy's parts → build/hero.json (look-dev reads it)
//           ui       the platform page as HTML → assets/ui.png …, build/timeline.json
//           anim     every object at every half frame → build/anim.json
//           sound    the film's sound → assets/audio/score.wav: its effects over its own score (film.json "sound": "score",
//                    <film>/music/score.py: references/sound.md), their own song ("own"), the effects alone ("fx"), or an
//                    older film's ("song", "band", "bed", "strings")
//           listen   (older films) other sounds under the animatic → build/storyboard/sound-<sound>.mp4
//           lookdev  Blender turnaround of the toy → build/lookdev/, beside its picture: compare.jpg
//           poses    the toy alone in the poses a story's frames need, on a clear background → build/poses/
//                    (-- startle,kick:right,stand:back:close; none: every pose of engine/lib/poses.json; references/frames.md)
//           estimate three frames at the final settings → how long the full render takes
//           sample   a stretch at the final quality with its sound, to watch before the hours of the whole
//                    (-- --from 6 --to 14, seconds; else the film's own beat, else 6–14 s) → out/<film>-sample.mp4
//           previs   render all storyboard + compare preview frames in one pass (24 samples, 50% → build/previs)
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
//           compare  this film beside the approved films, moment by moment (opening, the toy, the proof,
//                    the payoff, the end card), with each frame's brightness, contrast and colour
//                    → build/compare.jpg (compare -- --in build/sample: the sample's frames)
//           review   the independent review's brief: the film, what to watch, the checks, the
//                    rubric → build/review.md (references/review.md)
//           storyboard  the page to sign off: parts, beat grid, previews, checks → build/storyboard/
//                    (storyboard -- --frames prints the preview frames to render)
//           animatic the whole film in EEVEE, small, with its score → build/storyboard/animatic.mp4
//                    (-- --stop ends one still rendering; a new one ends an older one first)
//           studio   the story page (/story/) and the storyboard page on a local server: the user clicks a card, or a spot on a real frame or
//                    the paused animatic and writes a note → build/comments.jsonl
//                    (from port 4173 up, the first free one: it prints its address; one already serving this film is
//                    used as it is; runs until stopped)
//           comments the user's open notes, each with its frame marked → build/comments/<id>.jpg
//                    (comments -- --all; comments -- --done c3 "what changed")
//           own      a copy in the film to change for this film alone (own -- template scene.py):
//                    template → <film>/template/ (film.json "template": "./template"),
//                    scene.py → <film>/engine/scene.py (render, estimate and animatic use it)
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { film, FILM, fromFilm, fromSkill, fromTemplate, importTemplate, OWN_TEMPLATE } from "./lib/film.js";
import { HOME, findBlender, findLocalBlender, findPython, toolEnv } from "./lib/tools.js";

const argv = process.argv.slice(2);
const dash = argv.indexOf("--");
// Also allow trailing flags without `--` (e.g. `run.mjs check --render`) once at least one step name has appeared.
const firstFlag = dash < 0 ? argv.findIndex((a, i) => i > 0 && a.startsWith("--")) : -1;
const splitAt = dash >= 0 ? dash : firstFlag;
const names = splitAt < 0 ? argv : argv.slice(0, splitAt);
const extra = dash >= 0 ? argv.slice(dash + 1) : firstFlag >= 0 ? argv.slice(firstFlag) : [];
const GROUPS = { data: ["recipes", "glyphs", "hero", "ui", "anim", "sound"] };
const steps = names.flatMap((n) => GROUPS[n] ?? [n]);
if (!steps.length) {
  console.log("usage: FILM=<film folder> node engine/run.mjs <step|group>... [-- args]");
  process.exit(1);
}

// Blender, the Python with the pipeline's modules, the skill's bin on PATH (engine/lib/tools.js)
// Full-quality sequence steps (`render`, `sample`) use `blender` (honoring remote multi-GPU wrappers unless COLAB_LOCAL=1);
// non-sequence / fast local steps (`lookdev`, `poses`, `previs`, `estimate`, `animatic`) use `localBlender` by default.
const blender = findBlender() ?? "blender";
const localBlender = (process.env.COLAB_ALL === "1" ? blender : findLocalBlender()) ?? blender;
const PY = findPython() ?? "python3";

function parseFrameSet(spec, total) {
  if (!spec) {
    const s = new Set();
    for (let k = 1; k <= total; k++) s.add(k);
    return s;
  }
  const s = new Set();
  for (const part of String(spec).split(",")) {
    const t = part.trim();
    if (!t) continue;
    if (t.includes("-")) {
      const [a, b] = t.split("-").map((x) => +x.trim());
      if (Number.isInteger(a) && Number.isInteger(b)) for (let k = a; k <= b; k++) s.add(k);
    } else if (Number.isInteger(+t)) s.add(+t);
  }
  return s;
}

function seedResumeFrames(outDir, moreArgs, totalFrames) {
  if (!moreArgs.includes("--resume") || outDir !== fromFilm("build/render")) return 0;
  const opt = (flag) => (moreArgs.includes(flag) ? moreArgs[moreArgs.indexOf(flag) + 1] : null);
  if ((opt("--samples") ?? "48") !== "48" || (opt("--scale") ?? "100") !== "100") return 0;
  const animAt = existsSync(fromFilm("build/anim.json")) ? statSync(fromFilm("build/anim.json")).mtimeMs : 0;
  const glyphAt = existsSync(fromFilm("build/glyphs.json")) ? statSync(fromFilm("build/glyphs.json")).mtimeMs : 0;
  const minMtime = Math.max(animAt, glyphAt);
  const want = parseFrameSet(opt("--frames"), totalFrames);
  mkdirSync(outDir, { recursive: true });
  let copied = 0;
  for (const srcRel of ["build/sample", "build/estimate"]) {
    const srcDir = fromFilm(srcRel);
    if (!existsSync(srcDir)) continue;
    for (const f of readdirSync(srcDir)) {
      const m = f.match(/^(\d{4,})\.png$/);
      if (!m || !want.has(+m[1])) continue;
      const dst = join(outDir, f);
      if (existsSync(dst) && statSync(dst).mtimeMs >= minMtime) continue;
      const src = join(srcDir, f);
      if (statSync(src).mtimeMs < minMtime) continue;
      cpSync(src, dst);
      copied++;
    }
  }
  return copied;
}
// the Blender scene: the film's own copy (engine/scene.py) when it has one, else the skill's
const scene = () => {
  if (!existsSync(fromFilm("engine/scene.py"))) return fromSkill("engine/scripts/scene.py");
  console.log("(the film's own engine/scene.py)");
  return fromFilm("engine/scene.py");
};
// Transient GPU recovery (e.g. macOS Metal kIOGPUCommandBufferCallbackErrorInnocentVictim) can interrupt a long
// multi-hour Cycles render midway. Auto-resume up to 4 times ONLY when progress was made or a transient GPU error
// occurred, streaming output live so real failures on frame 1 still fail fast.
const GPU_TRANSIENT = /kIOGPUCommandBufferCallbackErrorInnocentVictim|MTLCommandBufferErrorDomain|Command buffer not completed|GPU error\/recovery/i;
const pngCount = (dir) => { try { return readdirSync(dir).filter((f) => f.endsWith(".png")).length; } catch { return 0; } };
const runRender = (cmd, args, outDir, maxRetries = 4) => new Promise((done) => {
  const attempt = (n, curArgs) => {
    const before = pngCount(outDir);
    console.log(`\n▶ ${cmd} ${curArgs.join(" ")}`);
    const c = spawn(cmd, curArgs, { stdio: ["inherit", "pipe", "pipe"], cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }) });
    let tail = "";
    const tap = (stream) => (chunk) => {
      stream.write(chunk);
      tail = (tail + chunk.toString("utf8")).slice(-8000);
    };
    c.stdout.on("data", tap(process.stdout));
    c.stderr.on("data", tap(process.stderr));
    c.on("exit", (code) => {
      if (code === 0) return done();
      const after = pngCount(outDir);
      const progressed = after > before;
      const transient = GPU_TRANSIENT.test(tail);
      if (n < maxRetries && (progressed || transient)) {
        const nextArgs = curArgs.includes("--resume") ? curArgs : [...curArgs, "--resume"];
        console.error(`\n! render interrupted (${transient ? "transient GPU recovery" : `${after - before} new frame(s) written`}); auto-resuming pass ${n + 2}/${maxRetries + 1}...`);
        setTimeout(() => attempt(n + 1, nextArgs), 3000);
        return;
      }
      process.exit(code ?? 1);
    });
  };
  attempt(0, args);
});
// long renders keep a Mac awake while the command runs (caffeinate -i: idle sleep; -s: system sleep on power); neither
// holds off a closed lid or Sleep from the menu, so the full render says so before it starts
const awake = (cmd, args) => (process.platform === "darwin" ? ["caffeinate", ["-is", cmd, ...args]] : [cmd, args]);
const SLEEP_NOTE = process.platform === "darwin"
  ? "keep the lid open and the power in until it ends: a closed lid or Sleep stops the render (it picks up with --resume)"
  : "set the computer not to sleep until it ends: sleep stops the render (it picks up with --resume)";
const run = (cmd, args, env = {}) => {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill(), ...env }) });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// a long render in a process group of its own, its id in a file: the next one (or `-- --stop`) ends it, so a render of
// an older story never runs on beside the new one
const stopGroup = (pidFile) => {
  if (!existsSync(pidFile)) return false;
  const { pgid } = JSON.parse(readFileSync(pidFile, "utf8"));
  rmSync(pidFile, { force: true });
  try { process.kill(process.platform === "win32" ? pgid : -pgid, "SIGTERM"); return true; } catch { return false; }
};
const runGroup = (cmd, args, pidFile) => new Promise((done) => {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const c = spawn(cmd, args, { stdio: "inherit", cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }), detached: process.platform !== "win32" });
  mkdirSync(dirname(pidFile), { recursive: true });
  writeFileSync(pidFile, JSON.stringify({ pgid: c.pid, started: new Date().toISOString() }));
  const stop = () => stopGroup(pidFile);
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  c.on("exit", (code, signal) => {
    process.off("SIGINT", stop); process.off("SIGTERM", stop);
    if (existsSync(pidFile) && JSON.parse(readFileSync(pidFile, "utf8")).pgid === c.pid) rmSync(pidFile, { force: true });
    if (code !== 0) { console.error(signal ? "stopped" : `exited with ${code}`); process.exit(code ?? 1); }
    done();
  });
});

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
  if ((step === "animatic" && !more.includes("--stop")) || step === "estimate" || step === "sample" || step === "previs") gate(false);
  if (step === "render") gate(!more.includes("--frames") || !more.includes("--samples"));
  switch (step) {
    case "check": run("node", [fromSkill("engine/scripts/check.mjs"), ...more]); break;
    case "clearance": run("node", [fromSkill("engine/scripts/clearance.mjs"), ...more]); break;
    case "diff": run(PY, [fromSkill("engine/scripts/diff-anim.py"), ...more]); break;
    case "next": run("node", [fromSkill("engine/scripts/next.mjs")]); break;
    case "recipes":
      // "@tool" is one of the engine's tools (engine/scripts/tool.py); anything else is the film's own recipe
      // (a film's recipe is named from recipes/: "cover.py"; "recipes/cover.py" works too)
      for (const r of film.recipes ?? []) run(PY, [r.startsWith("@") ? fromSkill("engine/scripts", `${r.slice(1)}.py`) : join(FILM, "recipes", r.replace(/^(\.\/)?recipes\//, ""))]);
      break;
    case "glyphs": run(PY, [fromSkill("engine/scripts/glyphs.py"), ...more]); break;
    case "fonts": run(PY, [fromSkill("engine/scripts/typesheet.py"), "--list", ...more]); break;
    case "typesheet": run(PY, [fromSkill("engine/scripts/typesheet.py"), ...more]); break;
    case "hero": run("node", [fromSkill("engine/scripts/dump-hero.mjs")]); break;
    case "ui": run("node", [fromSkill("engine/scripts/build-ui.mjs"), ...more]); break;
    case "anim": {
      // the lettering follows film.json and any workspace-local custom beat / prop .js modules
      const g = fromFilm("build/glyphs.json");
      const glyphSources = [
        fromFilm("film.json"),
        ...((film.story?.segments ?? []).map((s) => s?.beat).filter((b) => typeof b === "string" && b.endsWith(".js")).map((b) => fromFilm(b))),
        ...(typeof film.cta?.prop?.module === "string" ? [fromFilm(film.cta.prop.module)] : []),
      ].filter((p) => existsSync(p));
      const newestSrc = Math.max(0, ...glyphSources.map((p) => statSync(p).mtimeMs));
      if (!steps.slice(0, i).includes("glyphs") && (!existsSync(g) || statSync(g).mtimeMs < newestSrc)) {
        console.log("(film.json or beat/prop lettering changed since glyphs were made: glyphs first)");
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
      run(localBlender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/lookdev.py"), "--", ...more]);
      if (!more.includes("--avatar") && !more.includes("--parts")) run(PY, [fromSkill("engine/scripts/toysheet.py"), ...(more.includes("--out") ? ["--in", more[more.indexOf("--out") + 1]] : [])]);
      break;
    case "poses":
      // the toy alone in the poses a story's frames need, on a clear background (references/frames.md): seconds each
      if (!steps.slice(0, i).includes("hero")) run("node", [fromSkill("engine/scripts/dump-hero.mjs")]);
      run(localBlender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", fromSkill("engine/scripts/lookdev.py"), "--", "--poses", ...more]);
      break;
    case "previs": {
      // Collect the union of storyboard preview frames and compare reference moments, then render only missing/changed ones
      const askFrames = (script) => {
        const r = spawnSync(PY, [fromSkill("engine/scripts", script), "--frames"], { cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }), encoding: "utf8" });
        if (r.status !== 0) return [];
        const line = (r.stdout ?? "").trim().split(/\r?\n/).pop() ?? "";
        return line.split(",").map((x) => +x.trim()).filter((n) => Number.isInteger(n) && n > 0);
      };
      const union = [...new Set([...askFrames("storyboard.py"), ...askFrames("compare.py")])].sort((a, b) => a - b);
      if (!union.length) { console.error("no preview frames found: run anim first so build/timeline.json exists"); process.exit(1); }
      const outIdx = more.indexOf("--out");
      const outDir = fromFilm(outIdx >= 0 && more[outIdx + 1] ? more[outIdx + 1] : "build/previs");
      const snapPath = join(outDir, ".anim-snapshot.json");
      const animPath = fromFilm("build/anim.json");
      const pad4 = (n) => String(n).padStart(4, "0");
      let targetFrames = union;
      const canIncremental = !force && !more.includes("--frames") && !more.includes("--samples") && !more.includes("--scale") && existsSync(snapPath) && existsSync(animPath);
      if (canIncremental) {
        const dr = spawnSync(PY, [fromSkill("engine/scripts/diff-anim.py"), snapPath, animPath, "--since", snapPath], { cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }), encoding: "utf8" });
        if (dr.status === 0) {
          const firstLine = (dr.stdout ?? "").trim().split(/\r?\n/)[0]?.trim() ?? "";
          const changed = firstLine === "none" ? new Set() : parseFrameSet(firstLine, film.format.duration * film.format.fps);
          targetFrames = union.filter((f) => !existsSync(join(outDir, `${pad4(f)}.png`)) || changed.has(f));
        }
      }
      if (!targetFrames.length) {
        console.log(`previs: all ${union.length} frame(s) up to date (${union.join(",")})`);
        break;
      }
      for (const f of targetFrames) rmSync(join(outDir, `${pad4(f)}.png`), { force: true });
      const defaults = [
        ...(more.includes("--frames") ? [] : ["--frames", targetFrames.join(",")]),
        ...(more.includes("--samples") ? [] : ["--samples", "24"]),
        ...(more.includes("--scale") ? [] : ["--scale", "50"]),
        ...(more.includes("--out") ? [] : ["--out", "build/previs"]),
      ];
      const reused = union.length - targetFrames.length;
      console.log(`previs: ${targetFrames.length} frame(s)${reused > 0 ? ` (reused ${reused} unchanged)` : " (storyboard + compare)"} → ${targetFrames.join(",")}`);
      const [cmd, args] = awake(localBlender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", ...defaults, ...more]);
      await runRender(cmd, args, outDir);
      if (existsSync(animPath) && !more.includes("--frames")) {
        mkdirSync(outDir, { recursive: true });
        cpSync(animPath, snapPath);
      }
      break;
    }
    case "render": {
      // no --frames: the whole film, its frame count from film.json (duration × fps)
      const totalFrames = film.format.duration * film.format.fps;
      const all = more.includes("--frames") ? [] : ["--frames", `1-${totalFrames}`];
      const outIdx = more.indexOf("--out");
      const outDir = fromFilm(outIdx >= 0 && more[outIdx + 1] ? more[outIdx + 1] : "build/render");
      const seeded = seedResumeFrames(outDir, more, totalFrames);
      if (seeded > 0) console.log(`(reused ${seeded} fresh pre-rendered frame(s) from build/sample or build/estimate)`);
      console.log(`\n${SLEEP_NOTE}`);
      const [cmd, args] = awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", ...all, ...more]);
      await runRender(cmd, args, outDir);
      break;
    }
    case "estimate": {
      // three frames at the final settings: how long the full render takes, before committing to it; a fourth
      // goes first and is not counted, as it carries Cycles' start (kernels, BVH, textures): counted, it made
      // a 1.3 h film read as 6.4 h
      const n = film.format.duration * film.format.fps, at = [0.2, 0.3, 0.55, 0.85].map((k) => Math.round(n * k));
      const [cmd, args] = awake(localBlender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", "--frames", at.join(","), "--samples", "48", "--scale", "100", "--out", "build/estimate", ...more]);
      console.log(`\n▶ ${cmd} ${args.join(" ")}`);
      const r = spawnSync(cmd, args, { cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }), encoding: "utf8", maxBuffer: 1 << 26 });
      const secs = [...(r.stdout ?? "").matchAll(/rendered frame \d+ in ([\d.]+)s/g)].map((m) => +m[1]).slice(1);
      if (r.status !== 0 || !secs.length) { console.error((r.stderr || r.stdout || "").slice(-2000)); process.exit(r.status || 1); }
      const per = secs.reduce((x, y) => x + y, 0) / secs.length;
      // which GPU it ran on (engine/lib/device.py), or the warning that it ran on the CPU
      const gpu = (r.stdout ?? "").match(/^Cycles: .*$/m);
      if (gpu) console.log(gpu[0]);
      console.log(`about ${per.toFixed(0)} s a frame at 48 samples, full size: the film's ${n} frames ≈ ${(per * n / 3600).toFixed(1)} h; previews (32 samples, half size) ≈ ${(per / 16).toFixed(1)} s a frame`);
      break;
    }
    case "sample": {
      // the stretch most likely to disappoint, at the final settings with its sound, before committing the
      // hours (references/render.md): -- --from s --to s, else the film's own beat (10 s of it at most), else 6–14 s
      const fps = film.format.fps, pick = (k) => (more.includes(k) ? +more[more.indexOf(k) + 1] : null);
      let [a, b] = [pick("--from"), pick("--to")];
      if (a == null || b == null) {
        const T = await importTemplate("timeline.js");
        const own = T.SEG?.on ? T.SEG.list.find((s) => s.kind === "beat" && /[/.]/.test(s.entry.beat)) : null;
        [a, b] = own ? [own.f0, Math.min(own.f1, own.f0 + 10)] : [6, 14];
      }
      const rest = more.filter((v, j) => !["--from", "--to"].includes(v) && !["--from", "--to"].includes(more[j - 1]));
      rmSync(fromFilm("build/sample"), { recursive: true, force: true });
      console.log(`the sample: ${a.toFixed(1)}–${b.toFixed(1)} s at 48 samples, full size`);
      run(...awake(blender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", "--frames", `${Math.round(a * fps) + 1}-${Math.round(b * fps)}`, "--samples", "48", "--scale", "100", "--out", "build/sample", ...rest]));
      run(...awake(PY, [fromSkill("engine/scripts/finish.py"), "--in", "build/sample", "--out", (film.output ?? "out/film.mp4").replace(/(\.mp4)?$/, "-sample.mp4")]));
      break;
    }
    case "finish": {
      const autoSfx = !more.includes("--out") && !more.includes("--sfx-cut") && !more.includes("--no-sfx-cut") && existsSync(fromFilm("assets/audio/score-sfx.wav"));
      run(...awake(PY, [fromSkill("engine/scripts/finish.py"), ...(force ? ["--force"] : []), ...(autoSfx ? ["--sfx-cut"] : []), ...more]));
      // a side cut (the quick version: -- --in build/quick --out out/<id>-quick.mp4) gets no covers or qa
      if (!more.includes("--out")) {
        run(PY, [fromSkill("engine/scripts/covers.py")]);
        run(PY, [fromSkill("engine/scripts/qa.py")]);
      }
      break;
    }
    case "qa": run(PY, [fromSkill("engine/scripts/qa.py"), ...more]); break;
    case "covers": run(PY, [fromSkill("engine/scripts/covers.py"), ...more]); break;
    case "safezone": run(PY, [fromSkill("engine/scripts/safezone.py"), ...more]); break;
    case "storyboard":
      // the page plays the film's own sound under the animatic, no menu of versions (references/sound.md)
      // where the toy goes into something, for the page's checks (a moment to fix is not a stop here)
      if (existsSync(fromFilm("build/anim.json"))) spawnSync("node", [fromSkill("engine/scripts/clearance.mjs")], { stdio: "inherit", cwd: FILM, env: toolEnv({ FILM, SKILL: fromSkill() }) });
      run(PY, [fromSkill("engine/scripts/storyboard.py"), ...more]);
      break;
    case "animatic": {
      // -- --stop ends the one rendering; a new one ends an older one first (its story may be stale)
      const PID = fromFilm("build/animatic.pid");
      if (more.includes("--stop")) { console.log(stopGroup(PID) ? "stopped the animatic that was rendering" : "no animatic is rendering"); break; }
      if (stopGroup(PID)) console.log("an animatic was still rendering (an older story?): stopped it");
      const animAt = () => (existsSync(fromFilm("build/anim.json")) ? statSync(fromFilm("build/anim.json")).mtimeMs : 0);
      const t0 = animAt();
      const defaults = [
        ...(more.includes("--frames") ? [] : ["--frames", `1-${film.format.duration * film.format.fps}`]),
        ...(more.includes("--engine") ? [] : ["--engine", "eevee"]),
        ...(more.includes("--samples") ? [] : ["--samples", "4"]),
        ...(more.includes("--scale") ? [] : ["--scale", "33"]),
        ...(more.includes("--out") ? [] : ["--out", "build/eev"]),
      ];
      await runGroup(...awake(localBlender, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", scene(), "--", ...defaults, ...more]), PID);
      if (animAt() !== t0) console.log("! build/anim.json changed while the animatic rendered: it shows the motion from before; run it again");
      run(PY, [fromSkill("engine/scripts/animatic.py")]);
      break;
    }
    case "studio": run("node", [fromSkill("engine/scripts/studio.mjs"), "--film", FILM, ...more]); break;
    case "comments": run(PY, [fromSkill("engine/scripts/comments.py"), ...more]); break;
    case "pace": run(PY, [fromSkill("engine/scripts/pace.py"), ...more]); break;
    case "palette": run(PY, [fromSkill("engine/scripts/palette.py"), ...more]); break;
    case "ledger": run(PY, [fromSkill("engine/scripts/ledger.py"), ...more]); break;
    case "review": run(PY, [fromSkill("engine/scripts/review.py"), ...more]); break;
    case "compare": run(PY, [fromSkill("engine/scripts/compare.py"), ...more]); break;
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
