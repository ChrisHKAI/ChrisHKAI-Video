// Step 0: checks what the pipeline needs on this computer and lists what is
// missing as one plan (what, size, from where, whether it needs an admin
// password), so the user answers once. With --install it then installs the
// plan, user-level wherever it can: Blender into ~/Applications, the Python
// modules into a venv, headless Chrome into ~/.cache/puppeteer, the fallback
// faces into the skill's home. Steps that need an admin password are printed
// for the user to run themselves; the agent never types a password.
//
// usage: node engine/scripts/doctor.mjs                     checks + plan
//        node engine/scripts/doctor.mjs --json              the same as JSON
//        node engine/scripts/doctor.mjs --install [id…]     install the plan (or those items)
//        node engine/scripts/doctor.mjs --install --dry-run print the commands only
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statfsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HOME, VENV, FONTS, WIN, PY_MODULES, findBlender, findPython, anyPython, findChrome, findGrok, onPath } from "../lib/tools.js";

const SKILL = join(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const OS = process.platform, ARCH = process.arch;
const BLENDER_SERIES = "5.2";
const FONT_ZIP = "https://github.com/adobe-fonts/source-han-sans/releases/download/2.005R/01_SourceHanSans.ttc.zip";
const sh = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: "utf8", timeout: 120000, ...opt });
const ver = (s) => (s.match(/(\d+)\.(\d+)(?:\.(\d+))?/) ?? []).slice(1).map((v) => +(v ?? 0));
const atLeast = (v, w) => v.length && (v[0] - w[0] || v[1] - w[1] || (v[2] ?? 0) - (w[2] ?? 0)) >= 0;

// ── checks ──────────────────────────────────────────────────────────────────
const checks = [];
const check = (id, name, ok, found, note = "") => checks.push({ id, name, ok, found, note });

const supported = (OS === "darwin" && ARCH === "arm64") || (OS === "win32" && ["x64", "arm64"].includes(ARCH)) || (OS === "linux" && ARCH === "x64");
check("system", "computer", supported, `${OS} ${ARCH}`, supported ? (OS === "darwin" ? "" : "not yet tested on this system") : "Blender 5.2 has no build for this computer (Intel Macs included)");

const nodeV = ver(process.version);
check("node", "Node.js 22+", atLeast(nodeV, [22, 0, 0]), process.version);

const py = findPython();
const pyAny = py ?? anyPython();
check("python", "Python 3.9+", Boolean(pyAny), pyAny ? sh(pyAny, ["--version"]).stdout.trim() || sh(pyAny, ["--version"]).stderr.trim() : "not found");
check("python-modules", `Python modules (${PY_MODULES.join(", ")})`, Boolean(py), py ?? "missing", py && py.startsWith(VENV) ? "in the skill's venv" : "");

const blender = findBlender();
const bv = blender ? (sh(blender, ["--version"]).stdout.match(/Blender (\d+\.\d+\.\d+)/) ?? [])[1] : null;
check("blender", `Blender ${BLENDER_SERIES}+`, Boolean(bv && atLeast(ver(bv), ver(BLENDER_SERIES))), bv ? `${bv} (${blender})` : "not found");

const ff = onPath("ffmpeg") && onPath("ffprobe");
check("ffmpeg", "ffmpeg + ffprobe", ff, ff ? sh("ffmpeg", ["-version"]).stdout.split("\n")[0] : "not found");

const chrome = findChrome();
check("chrome", "headless Chrome", Boolean(chrome), chrome ?? "not found");

// optional: with Grok Build, step 2 asks Grok to search X for the creator's best posts and milestones
// (it signs in with the user's own Grok account, so it is never installed unasked: references/onboarding.md)
const grok = findGrok();
check("grok", "Grok Build (optional: searches X in step 2)", true, grok ? `${sh(grok, ["--version"]).stdout.trim().split(" (")[0]} (${grok})` : "not installed", grok ? "" : "ask whether they use Grok (references/onboarding.md)");

// optional: the real instruments' samples, for the sounds "strings" and "band" (about 1.4 GB, only on a yes)
const instDir = join(HOME, "instruments");
const libs = existsSync(instDir) ? readdirSync(instDir).filter((d) => !d.startsWith(".") && d !== "index.json") : [];
check("instruments", "real instruments (optional: the sounds strings and band)", true, libs.length ? `${libs.join(", ")} (${instDir})` : "not downloaded", libs.length ? "" : "node engine/scripts/instruments.mjs --list: what, how big, which licence");

// the lettering faces, through the pipeline's own lookup (engine/lib/fonts.py)
let fontsOk = false, fontsFound = "needs Python first", fontsNote = "";
if (pyAny) {
  const r = sh(py ?? pyAny, ["-c", `import sys, json; sys.path.insert(0, ${JSON.stringify(join(SKILL, "engine/lib"))})
from fonts import face
out = {}
for role in ("latin", "cjk", "heavy"):
    for lang in ("zh-Hans", "zh-Hant"):
        try: out[role + " " + lang] = face(role, lang)[2]
        except SystemExit: out[role + " " + lang] = None
print(json.dumps(out))`]);
  const faces = r.status === 0 ? JSON.parse(r.stdout) : {};
  const missing = Object.entries(faces).filter(([, v]) => !v).map(([k]) => k);
  fontsOk = r.status === 0 && !missing.length;
  fontsFound = r.status === 0 ? Object.entries(faces).map(([k, v]) => `${k}: ${v ?? "none"}`).join("; ") : /No module/.test(r.stderr) ? "needs the Python modules first" : r.stderr.trim().split("\n").pop();
  if (fontsOk && !/Lantinghei/.test(faces["heavy zh-Hans"] ?? "")) fontsNote = "end-card labels fall back to Source Han Sans Heavy; on a Mac, Lantinghei SC Heavy (the isnail look) can be added in Font Book";
}
check("fonts", "lettering faces", fontsOk, fontsFound, fontsNote);

let free = null;
try { const s = statfsSync(process.cwd()); free = (s.bavail * s.bsize) / 1e9; } catch { /* not on this system */ }
check("disk", "free space (a film needs about 10 GB)", free === null || free >= 10, free === null ? "unknown" : `${free.toFixed(0)} GB free here`);

const gpu = OS === "darwin" && ARCH === "arm64" ? "Apple GPU (Metal)" : onPath("nvidia-smi") ? "NVIDIA (OptiX / CUDA)" : null;
check("gpu", "GPU for Cycles", Boolean(gpu), gpu ?? "none found", gpu ? "" : "Cycles renders on the CPU: expect hours per film; the draft tier (EEVEE) stays quick");

// for trying the plan on a computer that has everything: DOCTOR_PRETEND_MISSING=blender,chrome
for (const id of (process.env.DOCTOR_PRETEND_MISSING ?? "").split(",").filter(Boolean)) {
  const c = checks.find((k) => k.id === id);
  if (c) Object.assign(c, { ok: false, found: "(pretend) not found" });
}

// ── the plan ───────────────────────────────────────────────────────────────
const brew = onPath("brew");
const failed = new Set(checks.filter((c) => !c.ok).map((c) => c.id));
const plan = [];
const item = (id, what, size, source, admin, steps, userRuns = false) => plan.push({ id, what, size, source, admin, steps, userRuns });

if (failed.has("node")) item("node", "Node.js 22 LTS", "~50 MB", "nodejs.org", OS !== "win32" && !brew, OS === "darwin" ? (brew ? [["brew", "install", "node@22"]] : [["open", "https://nodejs.org/en/download"]]) : OS === "win32" ? [["winget", "install", "-e", "--id", "OpenJS.NodeJS.LTS"]] : [["sudo", "apt", "install", "-y", "nodejs"]], OS === "linux" || (OS === "darwin" && !brew));
const needBrew = OS === "darwin" && !brew && (failed.has("ffmpeg") || (failed.has("python") && !pyAny));
if (needBrew) item("homebrew", "Homebrew (the Mac's package manager, for ffmpeg)", "~500 MB", "brew.sh", true, [["/bin/bash", "-c", "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"]], true);
if (failed.has("python")) item("python", "Python 3", "~100 MB", OS === "win32" ? "python.org via winget" : "Homebrew / apt", OS === "linux", OS === "darwin" ? [["brew", "install", "python"]] : OS === "win32" ? [["winget", "install", "-e", "--id", "Python.Python.3.12"]] : [["sudo", "apt", "install", "-y", "python3", "python3-venv"]], OS === "linux");
if (failed.has("python-modules") || failed.has("python")) {
  const base = pyAny ?? (WIN ? "python" : "python3");
  const vpy = WIN ? join(VENV, "Scripts", "python.exe") : join(VENV, "bin", "python3");
  item("python-modules", "the Python modules, in the skill's own venv", "~150 MB", "PyPI", false, [
    [base, "-m", "venv", VENV],
    [vpy, "-m", "pip", "install", "--upgrade", "pip"],
    [vpy, "-m", "pip", "install", "numpy", "scipy", "pillow", "fonttools", "contourpy", "scikit-image"],
  ]);
}
if (failed.has("blender") && supported) item("blender", `Blender ${BLENDER_SERIES} LTS`, "~400 MB", "download.blender.org", OS === "win32", OS === "win32" ? [["winget", "install", "-e", "--id", "BlenderFoundation.Blender"]] : [["@blender"]]);
if (failed.has("ffmpeg")) item("ffmpeg", "ffmpeg", "~80 MB", OS === "win32" ? "gyan.dev via winget" : "Homebrew / apt", OS === "linux", OS === "darwin" ? [["brew", "install", "ffmpeg"]] : OS === "win32" ? [["winget", "install", "-e", "--id", "Gyan.FFmpeg"]] : [["sudo", "apt", "install", "-y", "ffmpeg"]], OS === "linux");
if (failed.has("chrome")) item("chrome", "headless Chrome (Chrome for Testing)", "~100 MB", "Google, via @puppeteer/browsers", false, [["npx", "-y", "@puppeteer/browsers", "install", "chrome-headless-shell@stable", "--path", join(homedir(), ".cache/puppeteer")]]);
if (failed.has("fonts") && py && fontsFound !== "needs the Python modules first") item("fonts", "Source Han Sans (free faces, SIL OFL)", "~96 MB", "github.com/adobe-fonts", false, [["@fonts"]]);

// ── output ─────────────────────────────────────────────────────────────────
if (argv.includes("--json")) {
  console.log(JSON.stringify({ ok: !failed.size || [...failed].every((f) => f === "gpu"), checks, plan, home: HOME }, null, 2));
} else if (!argv.includes("--install")) {
  for (const c of checks) console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.found}${c.note ? `  (${c.note})` : ""}`);
  if (!plan.length) console.log(failed.size ? "\nNothing to install; see the notes above." : "\nEverything is here.");
  else {
    console.log("\nTo install (one yes covers the list):");
    for (const p of plan) console.log(`- ${p.what}: ${p.size}, from ${p.source}${p.admin ? ", needs your password" : ""}${p.userRuns ? " (you run this one in Terminal)" : ""}`);
    console.log(`\nThen: node ${join(SKILL, "engine/scripts/doctor.mjs")} --install`);
  }
}

// ── install ────────────────────────────────────────────────────────────────
if (argv.includes("--install")) {
  const dry = argv.includes("--dry-run");
  const ids = argv.filter((a) => !a.startsWith("--"));
  const todo = plan.filter((p) => !ids.length || ids.includes(p.id));
  if (!todo.length) { console.log("Nothing to install."); process.exit(0); }
  const run = (cmd, args) => {
    console.log(`$ ${[cmd, ...args].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`);
    if (dry) return;
    const r = spawnSync(cmd, args, { stdio: "inherit" });
    if (r.status !== 0) { console.error(`failed (${r.status ?? r.error?.code}): ${cmd}`); process.exit(1); }
  };
  for (const p of todo) {
    console.log(`\n▶ ${p.what}`);
    if (p.userRuns) {
      console.log("This one needs your password, so run it yourself in Terminal, then ask me to check again:");
      for (const s of p.steps) console.log(`  ${s.map((a) => (/\s/.test(a) ? `'${a}'` : a)).join(" ")}`);
      continue;
    }
    for (const [cmd, ...args] of p.steps) {
      if (cmd === "@blender") await installBlender(run, dry);
      else if (cmd === "@fonts") installFonts(run, dry);
      else run(cmd, args);
    }
  }
  if (!dry) console.log("\nDone: run doctor.mjs again to check.");
}

// Blender: the newest 5.2.x build for this computer, user-level
async function installBlender(run, dry) {
  const index = `https://download.blender.org/release/Blender${BLENDER_SERIES}/`;
  const kind = OS === "darwin" ? "macos-arm64.dmg" : "linux-x64.tar.xz";
  const names = [...(await (await fetch(index)).text()).matchAll(new RegExp(`blender-${BLENDER_SERIES.replace(".", "\\.")}\\.(\\d+)-${kind.replace(".", "\\.")}`, "g"))];
  if (!names.length) throw new Error(`no ${kind} in ${index}`);
  const name = names.sort((a, b) => +a[1] - +b[1]).at(-1)[0];
  const tmp = dry ? join(tmpdir(), "blender-dl") : mkdtempSync(join(tmpdir(), "blender-"));
  const file = join(tmp, name);
  run("curl", ["-fL", "--progress-bar", "-o", file, index + name]);
  if (OS === "darwin") {
    const mnt = join(tmp, "mnt");
    run("hdiutil", ["attach", "-nobrowse", "-quiet", "-mountpoint", mnt, file]);
    mkdirSync(join(homedir(), "Applications"), { recursive: true });
    run("ditto", [join(mnt, "Blender.app"), join(homedir(), "Applications/Blender.app")]);
    run("hdiutil", ["detach", "-quiet", mnt]);
  } else {
    mkdirSync(join(HOME, "blender"), { recursive: true });
    run("tar", ["-xJf", file, "-C", join(HOME, "blender"), "--strip-components=1"]);
  }
  if (!dry) rmSync(tmp, { recursive: true, force: true });
}

// Source Han Sans: one collection with every weight the roles ask for, kept in the skill's home
function installFonts(run, dry) {
  const tmp = dry ? join(tmpdir(), "fonts-dl") : mkdtempSync(join(tmpdir(), "fonts-"));
  run("curl", ["-fL", "--progress-bar", "-o", join(tmp, "shs.zip"), FONT_ZIP]);
  run("tar", ["-xf", join(tmp, "shs.zip"), "-C", tmp]);
  if (dry) { console.log(`(then copy the .ttc into ${FONTS})`); return; }
  mkdirSync(FONTS, { recursive: true });
  const ttc = readdirSync(tmp, { recursive: true }).filter((f) => String(f).toLowerCase().endsWith(".ttc"));
  for (const f of ttc) cpSync(join(tmp, f), join(FONTS, String(f).split(/[\\/]/).pop()));
  rmSync(tmp, { recursive: true, force: true });
  if (!ttc.length) { console.error("no .ttc in the download"); process.exit(1); }
}
