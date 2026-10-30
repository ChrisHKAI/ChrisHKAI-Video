// Where the pipeline's outside tools are: Blender, the Python with the
// pipeline's modules, headless Chrome. Step 0 (scripts/doctor.mjs) installs
// what is missing without admin rights where it can: Blender into
// ~/Applications on a Mac, elsewhere a portable Blender into the skill's home
// (~/.chrishkai-video, or CHRISHKAI_VIDEO_HOME), as are the Python modules'
// venv and the fallback faces.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const HOME = process.env.CHRISHKAI_VIDEO_HOME || join(homedir(), ".chrishkai-video");
export const VENV = join(HOME, "venv");
export const BIN = join(HOME, "bin");
export const FONTS = join(HOME, "fonts");
export const WIN = process.platform === "win32";

const venvPython = WIN ? join(VENV, "Scripts", "python.exe") : join(VENV, "bin", "python3");
export const PY_MODULES = ["numpy", "scipy", "PIL", "fontTools", "contourpy", "skimage"]; // skimage: the sculpt kit's marching cubes

// whether a command runs (exits 0)
const runs = (cmd, args = ["--version"]) => spawnSync(cmd, args, { encoding: "utf8", timeout: 60000 }).status === 0;
export const onPath = (cmd) => runs(WIN ? "where" : "which", [cmd]);

// BLENDER first (a Blender kept anywhere else), then the usual places: newest version first
export function blenderCandidates() {
  const exe = WIN ? "blender.exe" : "blender";
  // in each folder, its versions' own folders ("Blender 5.2", "blender-5.2.3-windows-x64")
  const inside = (dir) => newestFirst(readdirSafe(dir)).map((d) => join(dir, d, exe));
  const env = process.env;
  return [
    env.BLENDER,
    "/Applications/Blender.app/Contents/MacOS/Blender",
    join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"),
    // a portable Blender (doctor's, or a .zip / .tar.xz unpacked by hand) in the skill's home
    join(HOME, "blender", exe),
    ...inside(join(HOME, "blender")),
    ...(WIN ? [
      ...inside(join(env.ProgramFiles || "C:/Program Files", "Blender Foundation")),
      ...(env.LOCALAPPDATA ? inside(join(env.LOCALAPPDATA, "Programs", "Blender Foundation")) : []),
      join(env["ProgramFiles(x86)"] || "C:/Program Files (x86)", "Steam/steamapps/common/Blender", exe),
    ] : []),
  ].filter(Boolean);
}
export function findBlender() {
  return blenderCandidates().find((p) => existsSync(p)) ?? (onPath("blender") ? "blender" : null);
}

// the Python that has every module the scripts import
export function findPython() {
  const cands = [process.env.PYTHON, venvPython, WIN ? "python" : "python3"].filter(Boolean);
  return cands.find((p) => (p.includes("/") || p.includes("\\") ? existsSync(p) : true) && runs(p, ["-c", `import ${PY_MODULES.join(", ")}`])) ?? null;
}
export const anyPython = () => [WIN ? "python" : "python3", "python"].find((p) => runs(p)) ?? null;

// Grok Build (xAI's agent CLI), where the user has it: step 2 asks it to search X
export function findGrok() {
  if (process.env.GROK) return process.env.GROK;
  const home = join(homedir(), ".grok/bin", WIN ? "grok.exe" : "grok");
  return existsSync(home) ? home : onPath("grok") ? "grok" : null;
}

export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
  for (const ver of readdirSafe(base).sort().reverse()) {
    for (const sub of readdirSafe(join(base, ver))) {
      const bin = join(base, ver, sub, WIN ? "chrome-headless-shell.exe" : "chrome-headless-shell");
      if (existsSync(bin)) return bin;
    }
  }
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
  ].find((p) => existsSync(p)) ?? null;
}

// the environment for the pipeline's own commands: the skill's bin first
export const toolEnv = (extra = {}) => ({ ...process.env, PATH: `${BIN}${WIN ? ";" : ":"}${process.env.PATH}`, ...extra });

function readdirSafe(d) {
  try { return readdirSync(d); } catch { return []; }
}
// "Blender 5.10" before "Blender 5.2"
const newestFirst = (names) => [...names].sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
