// The studio: a small local server for one film's pages, the story page
// (step 2, research/story/) and the storyboard page (step 4), so the user can
// leave notes: on a card of the story page, or on the real frames. They click a spot on a preview
// frame (Cycles) or on the paused animatic (EEVEE), write what to change,
// and the note lands in build/comments.jsonl with its time, frame and place
// in the frame (engine/scripts/comments.py reads it). Only this computer
// can reach it (127.0.0.1). Opened as a plain file the page still works:
// a note is copied, to paste into the chat. Each film's studio has a port of
// its own: from 4173 up, the first one free, and it prints its address; one
// already serving this film is used as it is.
//
// usage: node engine/scripts/studio.mjs --film <film folder> [--port 4173]   (the first port it tries)
//        (or FILM=<film> node engine/run.mjs studio)
import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const FILM = resolve(arg("--film", process.env.FILM ?? ""));
if (!existsSync(join(FILM, "film.json"))) { console.error(`no film.json in ${FILM}: pass --film <film folder>`); process.exit(1); }
const FIRST = +arg("--port", 4173);
const PAGE = join(FILM, "build/storyboard");
const STORY = join(FILM, "research/story");
const INBOX = join(FILM, "build/comments.jsonl");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

function send(res, file, req) {
  if (!file || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, { "content-type": "text/plain" }); res.end(existsSync(join(PAGE, "index.html")) ? "not found" : "not found: build the storyboard page first (run.mjs storyboard)"); return; }
  const size = statSync(file).size, type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range) { // the animatic seeks with ranges
    const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1, "cache-control": "no-store" });
    createReadStream(file, { start: a, end: b }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-store" });
  createReadStream(file).pipe(res);
}
const readInbox = () => (existsSync(INBOX) ? readFileSync(INBOX, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
function json(res, code, body) { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(body)); }

function serve(req, res) {
  const p = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (p === "/api/film") return json(res, 200, { film: FILM });
  if (p === "/") { res.writeHead(302, { location: existsSync(join(PAGE, "index.html")) ? "/storyboard/" : "/story/" }); res.end(); return; }
  if (p === "/api/comments" && req.method === "GET") return json(res, 200, readInbox());
  if (p === "/api/comments" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on("end", () => {
      let c;
      try { c = JSON.parse(body); } catch { return json(res, 400, { error: "not JSON" }); }
      if (typeof c.text !== "string" || !c.text.trim() || (typeof c.t !== "number" && c.source !== "story")) return json(res, 400, { error: "a note needs text and t" });
      const all = readInbox();
      const keep = ["source", "t", "frame", "x", "y", "on", "text"];
      const rec = { id: `c${all.length + 1}`, created: new Date().toISOString(), status: "open", ...Object.fromEntries(keep.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])) };
      mkdirSync(dirname(INBOX), { recursive: true });
      appendFileSync(INBOX, JSON.stringify(rec) + "\n");
      console.log(rec.source === "story" ? `note ${rec.id}, story page, on ${rec.on}: ${rec.text}` : `note ${rec.id}, ${rec.t.toFixed(2)} s (${rec.source}): ${rec.text}`);
      json(res, 200, rec);
    });
    return;
  }
  if (p === "/story" || p.startsWith("/story/")) {
    let rel;
    try { rel = decodeURIComponent(p.slice(6).replace(/^\//, "")) || "index.html"; } catch { rel = ""; }
    const file = resolve(STORY, rel);
    if (p === "/story" || (!TYPES[extname(file).toLowerCase()] && existsSync(join(STORY, "index.html")))) { res.writeHead(302, { location: "/story/" }); res.end(); return; }
    return send(res, file === STORY || file.startsWith(STORY + sep) ? file : null, req);
  }
  if (p === "/storyboard" || p.startsWith("/storyboard/")) {
    let rel;
    try { rel = decodeURIComponent(p.slice(12).replace(/^\//, "")) || "index.html"; } catch { rel = ""; }
    const file = resolve(PAGE, rel);
    // "/storyboard" without its slash, or the address clicked in a chat with the words stuck to it: to the page
    if (p === "/storyboard" || (!TYPES[extname(file).toLowerCase()] && existsSync(join(PAGE, "index.html")))) { res.writeHead(302, { location: "/storyboard/" }); res.end(); return; }
    return send(res, file === PAGE || file.startsWith(PAGE + sep) ? file : null, req);
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}

// another film's studio may hold a port (each film runs its own): the next one, so a link never opens another
// film's page
const open = (port) => new Promise((ok, no) => { const s = createServer(serve); s.once("error", no); s.listen(port, "127.0.0.1", () => ok(s)); });
const filmAt = (port) => fetch(`http://127.0.0.1:${port}/api/film`, { signal: AbortSignal.timeout(1000) }).then((r) => (r.ok ? r.json() : {})).then((j) => j.film, () => null);
function say(port, already) {
  console.log(`studio for ${FILM}${already ? ": already running" : port !== FIRST ? ` (${FIRST}${port - FIRST > 1 ? `–${port - 1}` : ""} taken by another film's studio or program)` : ""}`);
  if (existsSync(join(STORY, "index.html"))) console.log(`  the story page  http://127.0.0.1:${port}/story/  (a card's note button writes a note; a picture opens large)`);
  console.log(`  the storyboard  http://127.0.0.1:${port}/storyboard/  (click a frame or the paused animatic to write a note)`);
  console.log(`  notes land in   build/comments.jsonl (run.mjs comments lists them)`);
}
for (let port = FIRST; ; port++) {
  try { await open(port); say(port); break; } catch (e) {
    if (e.code !== "EADDRINUSE" || port >= FIRST + 50) { console.error(`studio: ${e.message}`); process.exit(1); }
    if ((await filmAt(port)) === FILM) { say(port, true); process.exit(0); }
  }
}
