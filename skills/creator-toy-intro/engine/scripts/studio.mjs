// The studio: a small local server for one film's storyboard page, so the
// user can leave notes on the real frames. They click a spot on a preview
// frame (Cycles) or on the paused animatic (EEVEE), write what to change,
// and the note lands in build/comments.jsonl with its time, frame and place
// in the frame (engine/scripts/comments.py reads it). Only this computer
// can reach it (127.0.0.1). Opened as a plain file the page still works:
// a note is copied, to paste into the chat.
//
// usage: node engine/scripts/studio.mjs --film <film folder> [--port 4173]
//        (or FILM=<film> node engine/run.mjs studio)
import { createServer } from "node:http";
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const FILM = resolve(arg("--film", process.env.FILM ?? ""));
if (!existsSync(join(FILM, "film.json"))) { console.error(`no film.json in ${FILM}: pass --film <film folder>`); process.exit(1); }
const PORT = +arg("--port", 4173);
const PAGE = join(FILM, "build/storyboard");
const INBOX = join(FILM, "build/comments.jsonl");
const TYPES = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png" };

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

createServer((req, res) => {
  const p = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (p === "/") { res.writeHead(302, { location: "/storyboard/" }); res.end(); return; }
  if (p === "/api/comments" && req.method === "GET") return json(res, 200, readInbox());
  if (p === "/api/comments" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on("end", () => {
      let c;
      try { c = JSON.parse(body); } catch { return json(res, 400, { error: "not JSON" }); }
      if (typeof c.text !== "string" || !c.text.trim() || typeof c.t !== "number") return json(res, 400, { error: "a note needs text and t" });
      const all = readInbox();
      const keep = ["source", "t", "frame", "x", "y", "text"];
      const rec = { id: `c${all.length + 1}`, created: new Date().toISOString(), status: "open", ...Object.fromEntries(keep.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])) };
      mkdirSync(dirname(INBOX), { recursive: true });
      appendFileSync(INBOX, JSON.stringify(rec) + "\n");
      console.log(`note ${rec.id}, ${rec.t.toFixed(2)} s (${rec.source}): ${rec.text}`);
      json(res, 200, rec);
    });
    return;
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
}).listen(PORT, "127.0.0.1", () => {
  console.log(`studio for ${FILM}`);
  console.log(`  the storyboard  http://127.0.0.1:${PORT}/storyboard/  (click a frame or the paused animatic to write a note)`);
  console.log(`  notes land in   build/comments.jsonl (run.mjs comments lists them)`);
});
