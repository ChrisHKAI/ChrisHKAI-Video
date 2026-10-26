// Renders build/atlas/0001.png … (one per frame) plus build/sprite.png and
// build/chip.png in headless Chrome, using the same drawing code as the
// preview. Talks to Chrome over the DevTools protocol; no extra packages.
//
// usage: node scripts/render-atlas.mjs [--frames 1-361]
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { FPS, DURATION } from "../src/timeline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "build/atlas");
mkdirSync(outDir, { recursive: true });

const total = Math.round(DURATION * FPS) + 1;
let [f0, f1] = [1, total];
const fi = process.argv.indexOf("--frames");
if (fi > 0) [f0, f1] = process.argv[fi + 1].split("-").map(Number);

// ── static server for the project (ES modules need http, not file://) ───────
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  if (!path.startsWith(root) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

// ── headless Chrome ─────────────────────────────────────────────────────────
const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
const chromeBin = join(base, readdirSync(base).sort().pop(), "chrome-headless-shell-mac-arm64/chrome-headless-shell");
const debugPort = 9300 + Math.floor((process.pid % 500));
const chrome = spawn(chromeBin, [
  "--headless", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${debugPort}`,
  "--force-device-scale-factor=1", "--window-size=1920,1240", "about:blank",
], { stdio: "ignore" });

async function json(path, method = "GET") {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${debugPort}${path}`, { method });
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Chrome did not start");
}
const targets = await json("/json/list");
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((res) => {
  const id = nextId++;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
  return r.result.result.value;
}
const savePng = (dataUrl, file) => writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));

await send("Page.navigate", { url: `http://127.0.0.1:${port}/scripts/atlas.html` });
for (let i = 0; i < 200 && !(await evaluate("window.atlasReady === true")); i++) {
  await new Promise((r) => setTimeout(r, 50));
}

savePng(await evaluate("renderSprite()"), join(root, "build/sprite.png"));
savePng(await evaluate("renderChip()"), join(root, "build/chip.png"));
for (let f = f0; f <= f1; f++) {
  const t = (f - 1) / FPS;
  savePng(await evaluate(`renderAtlas(${t})`), join(outDir, `${String(f).padStart(4, "0")}.png`));
  if (f % 60 === 0) console.log(`atlas ${f}/${f1}`);
}
console.log(`atlas frames ${f0}-${f1} → ${outDir}`);
ws.close();
chrome.kill();
server.close();
