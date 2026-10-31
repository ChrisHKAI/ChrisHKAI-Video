// A sharp screenshot of a public page (their site, a README, a gallery) for the story page, with headless
// Chrome: the agent's browser pane shows a page scaled to the pane, too small to keep. Not for X or any page
// behind a login (headless Chrome has none): those are read in the logged-in browser.
//
// usage: node engine/scripts/shot.mjs <url> <out.png> [--size 1440x900] [--scale 2] [--wait 4000]
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { findChrome } from "../lib/tools.js";

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const [url, out] = argv.filter((a, i) => !a.startsWith("--") && !["--size", "--scale", "--wait"].includes(argv[i - 1]));
if (!/^https?:\/\//i.test(url ?? "") || !out) { console.error("usage: node engine/scripts/shot.mjs <https://…> <out.png> [--size 1440x900] [--scale 2] [--wait 4000]"); process.exit(1); }
const [w, h] = opt("--size", "1440x900").split("x").map(Number);
const scale = Math.max(1, Math.min(3, +opt("--scale", 2) || 2));
const chrome = findChrome() ?? (console.error("no Chrome on this computer: take it with the browser tool instead"), process.exit(1));
const file = resolve(out);
mkdirSync(dirname(file), { recursive: true });
execFileSync(chrome, ["--headless", "--hide-scrollbars", "--disable-gpu", `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`,
  `--virtual-time-budget=${+opt("--wait", 4000)}`, `--screenshot=${file}`, url], { stdio: "ignore", timeout: 60000 });
console.log(`${out}: ${url} at ${w * scale}x${h * scale}`);
