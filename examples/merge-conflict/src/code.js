// The editor's text: syntax colours, row heights while the conflict merges
// away, and the terminal transcript. Pure functions of film time, shared by
// the atlas painter (src/editor.js) and the motion (src/anim.js).
import * as T from "./timeline.js";

const clamp01 = (a) => Math.min(1, Math.max(0, a));
const smooth = (a) => a * a * (3 - 2 * a);

export const SYN = {
  keyword: "#C586C0",
  def: "#569CD6",
  fn: "#DCDCAA",
  ident: "#9CDCFE",
  punct: "#D4D4D4",
  plain: "#D4D4D4",
  ours: "#FFB38A", // Claude-orange block
  theirs: "#8FA6FF", // DeepSeek-blue block
  lens: "#9A9A9A",
  num: "#6E7681",
};
export const BLOCK = {
  ours: { bg: "rgba(217,119,87,0.16)", head: "rgba(217,119,87,0.42)", glow: "#FF9A72" },
  theirs: { bg: "rgba(77,107,254,0.16)", head: "rgba(77,107,254,0.45)", glow: "#7F97FF" },
};

const KEYWORDS = new Set(["import", "from", "return", "if", "in"]);
// one colour per character of a row's text
export function rowColors(row) {
  const text = row.text || "";
  const out = new Array(text.length).fill(SYN.plain);
  if (row.kind && row.kind.startsWith("mark")) {
    return out.fill(row.kind === "markTheirs" ? SYN.theirs : row.kind === "markOurs" ? SYN.ours : "#C8C8C8");
  }
  const re = /[A-Za-z_][A-Za-z_0-9]*|./g;
  let m;
  while ((m = re.exec(text))) {
    const w = m[0], i = m.index;
    let c = SYN.punct;
    if (/^[A-Za-z_]/.test(w)) {
      const next = text[i + w.length];
      if (w === "def") c = SYN.def;
      else if (KEYWORDS.has(w)) c = SYN.keyword;
      else if (next === "(") c = SYN.fn;
      else c = SYN.ident;
    }
    for (let k = 0; k < w.length; k++) out[i + k] = c;
  }
  return out;
}

// merge progress: 0 = conflict, 1 = markers gone, lines closed up
export const mergeAt = (t) => smooth(clamp01((t - T.EV.merge[0]) / (T.EV.merge[1] - T.EV.merge[0])));
const VANISH = new Set(["lens", "markOurs", "markMid", "markTheirs"]);

// every row's top (UI px), height scale and line number at time t
export function layoutRows(t) {
  const m = mergeAt(t);
  let y = T.ROW_TOP, n = 0;
  return T.ROWS.map((row, i) => {
    const h = VANISH.has(row.kind) ? 1 - m : 1;
    const counted = row.kind !== "lens" && (!VANISH.has(row.kind) || m < 0.5);
    if (counted) n++;
    const out = { i, row, top: y, h, num: counted ? n : null, alpha: VANISH.has(row.kind) ? clamp01(1 - m * 1.6) : 1 };
    y += T.ROW_H * h;
    return out;
  });
}

// ── Terminal transcript ─────────────────────────────────────────────────────
// at: when the line appears; type: [t0, t1] reveals `text` after `prefix`
const E = T.EV;
export const TERM_LINES = [
  { at: -1, prefix: "~/team-project (main) $ ", text: "git merge deepseek", color: "#D4D4D4" },
  { at: E.termLines[0], text: "Auto-merging main.py", color: "#B0B0B0" },
  { at: E.termLines[1], text: "CONFLICT (content): Merge conflict in main.py", color: "#FF6B6B", glow: true },
  { at: E.termLines[2], text: "Automatic merge failed; fix conflicts and then commit the result.", color: "#B0B0B0" },
  { at: E.termLines[2] + 0.1, prefix: T.PROMPT, text: E.typed, type: [E.typeKeys[0], E.typeKeys[5] + 0.05], color: "#FFB38A", until: E.enter },
  { at: E.enter, text: "removing deepseek/ ", bar: [E.enter, E.spout], color: "#FFB38A" },
  { at: E.spout, text: "error: deepseek/ is spouting back (EBUSY)", color: "#8FA6FF", glow: true },
  { at: E.clashEnd, text: "^C", color: "#D4D4D4" },
  { at: E.merge[0], prefix: T.PROMPT, text: "git commit -am \"accept both\"", type: E.commit, color: "#D4D4D4" },
  { at: E.buildPassed, text: "[main 7f3a9c2] Merge branch 'deepseek'", color: "#B0B0B0" },
  { at: E.buildPassed + 0.12, text: "✓ Build passed · 2 agents, 0 conflicts", color: "#4ADE80", glow: true },
  { at: E.buildPassed + 0.24, prefix: "~/team-project (main) $ ", text: "", color: "#D4D4D4", caret: true },
];
export const TERM_ROWS = Math.floor(T.TERM[3] / T.TERM_LINE);

// visible lines at t: [{text, prefix, color, glow, caret, progress}], scrolled to the end
export function terminalAt(t) {
  const shown = TERM_LINES.filter((l) => t >= l.at).map((l) => {
    let text = l.text;
    if (l.type) {
      const k = clamp01((t - l.type[0]) / (l.type[1] - l.type[0]));
      text = text.slice(0, Math.floor(k * text.length + 1e-6));
    }
    const live = l.until === undefined || t < l.until;
    return {
      ...l, text,
      caret: (l.prefix && live && (l.type ? t < l.type[1] + 0.6 || l.until : true) && l === lastPrompt(t)) || l.caret,
      progress: l.bar ? clamp01((t - l.bar[0]) / (l.bar[1] - l.bar[0])) : null,
      age: t - l.at,
    };
  });
  return shown.slice(-TERM_ROWS);
}
function lastPrompt(t) {
  const p = TERM_LINES.filter((l) => l.prefix && t >= l.at);
  const last = p[p.length - 1];
  const after = TERM_LINES.filter((l) => !l.prefix && t >= l.at && l.at > last.at);
  return after.length ? null : last;
}
