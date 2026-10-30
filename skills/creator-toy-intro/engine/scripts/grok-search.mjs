// Step 2 with Grok Build, where the user has it: Grok searches X for the
// creator's pinned post, their posts with the most views or engagement, the
// milestones they posted about, and ideas a film could turn into animation.
// The result goes to research/grok.json. Treat it as leads: every number in
// the film still comes from the page itself, as the page writes it
// (references/research.md).
//
// What Grok Build has that a browser does not is X search: x_user_search,
// x_keyword_search (from:<handle>, with X's operators), x_semantic_search and
// x_thread_fetch (a post with its numbers). These tools cannot be named in
// --tools, so every other tool is named in --disallowed-tools instead:
// - the shell;
// - files;
// - MCP (a browser);
// - images and video;
// - schedules;
// - subagents.
// What stays is read only: the four X tools and web search. Grok is also told
// to only read. It runs on the user's own Grok account. A search takes
// minutes and a dollar or so (two runs on cgnot996: $0.92 and $1.38), so run it
// in the background while the browser research goes on.
//
// usage: node engine/scripts/grok-search.mjs <film folder> [--handle <name>] [--max-turns 20] [--gaps] [--from-raw]
// --gaps reads research/gaps.json; writes separate grok-followup[-raw].json.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findGrok } from "../lib/tools.js";
import { researchPrompt } from "../lib/research-prompt.js";

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const dir = resolve(argv.find((a, i) => !a.startsWith("--") && !["--handle", "--max-turns"].includes(argv[i - 1])) ?? process.env.FILM ?? ".");
const film = existsSync(join(dir, "film.json")) ? JSON.parse(readFileSync(join(dir, "film.json"), "utf8")) : {};
const handle = (arg("--handle") ?? film.source?.handle ?? film.profile?.handle ?? "").replace(/^@/, "");
if (!handle) { console.error("no handle: pass --handle <name> (the X account, without @)"); process.exit(1); }
if (film.source?.platform && film.source.platform !== "x") { console.error(`Grok searches X; this creator is on ${film.source.platform}: use the browser (references/research.md)`); process.exit(1); }
const grok = findGrok();
if (!grok && !argv.includes("--from-raw")) { console.error("no Grok Build on this computer: search X in the browser (references/research.md); there is nothing to ask the user"); process.exit(1); }
const followup = argv.includes("--gaps");
const stem = followup ? "grok-followup" : "grok";
let prompt;
try {
  prompt = researchPrompt(handle, followup ? JSON.parse(readFileSync(join(dir, "research/gaps.json"), "utf8")) : null);
} catch (e) { console.error(e.message); process.exit(1); }

const str = { type: "string" };
const post = { type: "object", properties: { url: str, date: str, first_line: str, views: str, likes: str, reposts: str, replies: str, has_picture: { type: "boolean" } }, required: ["url", "first_line"] };
const schema = {
  type: "object",
  properties: {
    account: { type: "object", properties: { name: str, handle: str, followers: str, bio: str } },
    pinned: post,
    top: { type: "array", items: post },
    milestones: { type: "array", items: { type: "object", properties: { what: str, date: str, url: str, views: str }, required: ["what"] } },
    ideas: { type: "array", items: { type: "object", properties: { idea: str, from: str }, required: ["idea"] } },
    story_leads: { type: "array", items: { type: "object", properties: { what: str, kind: str, date: str, url: str, evidence_kind: str }, required: ["what", "kind", "url", "evidence_kind"] } },
    gap_answers: { type: "array", items: { type: "object", properties: { question: str, status: { type: "string", enum: ["found", "not_found"] }, answer: str, sources: { type: "array", items: str } }, required: ["question", "status", "sources"] } },
    notes: str,
  },
  required: ["top", "milestones", "ideas"],
};

// the answer's text holds one JSON object per turn that answered (the early ones empty): the fullest one
function answerOf(text) {
  const objs = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { esc = !esc && c === "\\"; if (!esc && c === '"') inStr = false; else if (c !== "\\") esc = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") { if (depth++ === 0) start = i; }
    else if (c === "}" && --depth === 0) { try { objs.push(JSON.parse(text.slice(start, i + 1))); } catch { /* a broken one */ } }
  }
  const size = (o) => (o.top?.length ?? 0) + (o.milestones?.length ?? 0) + (o.ideas?.length ?? 0) + (o.story_leads?.length ?? 0) + (o.gap_answers?.length ?? 0) + (o.pinned ? 1 : 0);
  return objs.reduce((best, o) => (size(o) >= size(best ?? {}) ? o : best), null);
}

mkdirSync(join(dir, "research"), { recursive: true });
const t0 = Date.now();
let raw;
if (argv.includes("--from-raw")) raw = readFileSync(join(dir, `research/${stem}-raw.json`), "utf8"); // no paid search
else {
  console.log(`grok: searching X for @${handle} (about ten minutes)…`);
  // every tool but the X tools and web search (which --tools cannot name): checked by asking Grok for its tools
  const DENY = ["run_terminal_cmd", "search_replace", "write", "read_file", "list_dir", "grep", "todo_write", "task", "web_fetch", "use_tool", "search_tool",
    "image_gen", "image_edit", "image_to_video", "reference_to_video", "workflow", "scheduler_create", "scheduler_delete", "scheduler_list", "monitor",
    "send_feedback", "ask_user_question", "spawn_subagent", "kill_command_or_subagent", "get_command_or_subagent_output", "enter_plan_mode", "exit_plan_mode"];
  const r = spawnSync(grok, ["-p", prompt, "--disallowed-tools", DENY.join(","), "--output-format", "json", "--json-schema", JSON.stringify(schema), "--max-turns", arg("--max-turns", "20")],
    { cwd: join(dir, "research"), encoding: "utf8", maxBuffer: 1 << 28 });
  raw = r.stdout ?? "";
  writeFileSync(join(dir, `research/${stem}-raw.json`), raw);
  if (r.status !== 0) { console.error((r.stderr || raw).slice(-2000)); process.exit(r.status || 1); }
}
let out, found;
try {
  out = JSON.parse(raw);
  const answer = out.text ?? out.result;
  found = typeof answer === "string" ? answerOf(answer) : answer;
  if (!found) throw new Error("no JSON object in the answer");
} catch (e) {
  console.error(`grok answered, but not in the shape asked for: see research/${stem}-raw.json (${e.message})`);
  process.exit(1);
}
const lead = { handle, searched: new Date().toISOString().slice(0, 10), minutes: argv.includes("--from-raw") ? null : +((Date.now() - t0) / 60000).toFixed(1), costUSD: out.total_cost_usd ?? null, ...found };
writeFileSync(join(dir, `research/${stem}.json`), JSON.stringify(lead, null, 2) + "\n");
// what it found; its minutes and cost stay in the file (costUSD), for the record, not for the user
console.log(`research/${stem}.json: pinned ${found.pinned ? "yes" : "no"}, ${found.top?.length ?? 0} top posts, ${found.milestones?.length ?? 0} milestones, ${found.story_leads?.length ?? 0} story leads, ${found.gap_answers?.length ?? 0} gap answers`);
if (found.notes) console.log(`grok's note: ${found.notes}`);
console.log("leads only: open each post on the page and take its numbers from there (references/research.md)");
