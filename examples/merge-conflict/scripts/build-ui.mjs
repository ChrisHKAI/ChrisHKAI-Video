// Writes ui/workspace.html (a VS Code-style dark editor, no logos) from
// src/timeline.js, screenshots it to assets/ui.png (3840x2160) with headless
// Chrome, and dumps build/timeline.json for the sound script. The code area,
// terminal output and status bar are painted per frame into the atlas instead.
//
// usage: node scripts/build-ui.mjs [--no-shot]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const d of ["ui", "assets", "build"]) mkdirSync(join(root, d), { recursive: true });

const px = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;
const ICON = {
  files: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  branch: '<circle cx="7" cy="5" r="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="9" r="2"/><path d="M7 7v10M17 11c0 4-6 3-9 6"/>',
  run: '<path d="M8 5v14l11-7z"/>',
  blocks: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  user: '<circle cx="12" cy="9" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  chevD: '<path d="m7 10 5 5 5-5"/>',
  chevR: '<path d="m10 7 5 5-5 5"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2-5"/><path d="M19 4v4h-4"/>',
};
const icon = (n, s = 22, c = "currentColor") => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
const panel = (name, inner, cls = "") => `<section class="panel ${cls}" id="p-${name}" style="${px(T.PANELS[name])}">${inner}</section>`;
const fileIcon = (name) => {
  const ext = name.split(".").pop();
  const col = { py: "#5a9fd4", md: "#8a8a8a", txt: "#8a8a8a" }[ext] || "#8a8a8a";
  return `<span class="fico" style="color:${col}">${ext === "py" ? "py" : ext === "md" ? "M↓" : "≡"}</span>`;
};

function titlebar() {
  const menus = ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"];
  return `<div class="lights"><i></i><i></i><i></i></div>
    <div class="menus">${menus.map((m) => `<span>${m}</span>`).join("")}</div>
    <div class="cmd">${icon("search", 16)} team-project</div>
    <div class="title-right">${icon("split", 18)}${icon("dots", 18)}</div>`;
}
function explorer() {
  const [x0, y0] = T.PANELS.explorer;
  const acts = ["files", "search", "branch", "run", "blocks"].map((n, i) =>
    `<div class="act${i === 0 ? " on" : ""}" style="top:${16 + i * 64}px">${icon(n, 30)}${n === "branch" ? '<b class="badge">1</b>' : ""}</div>`).join("");
  const rows = T.FILES.map((f, i) => {
    const top = T.FILE_ROW_TOP + i * T.FILE_ROW_H - y0;
    const indent = 70 + f.depth * 22;
    const chev = f.folder ? icon(f.open ? "chevD" : "chevR", 18) : "";
    const label = f.folder ? `<span class="fname${f.depth === 0 ? " root" : ""}">${f.name}</span>` : `${fileIcon(f.name)}<span class="fname">${f.name}</span>`;
    return `<div class="frow${f.selected ? " sel" : ""}${f.conflict ? " conflict" : ""}" style="top:${top}px;padding-left:${indent}px">
      <span class="chev">${chev}</span>${label}${f.conflict ? '<span class="flag">!</span><span class="cbadge">C</span>' : ""}</div>`;
  }).join("");
  return `<div class="actbar">${acts}<div class="act" style="bottom:70px">${icon("user", 28)}</div><div class="act" style="bottom:16px">${icon("gear", 28)}</div></div>
    <div class="side-head" style="left:${70 - x0}px">EXPLORER <span>${icon("dots", 18)}</span></div>${rows}
    <div class="outline-head" style="top:${560 - y0}px">${icon("chevR", 16)} OUTLINE</div>
    <div class="outline-head" style="top:${600 - y0}px">${icon("chevR", 16)} TIMELINE</div>`;
}
function editor() {
  const [x0, y0] = T.PANELS.editor;
  const [bx, by, bw, bh] = T.ACCEPT_BOTH;
  return `<div class="tabs">
      <div class="tab on conflict">${fileIcon("main.py")} main.py <span class="cbadge">C</span> ${icon("close", 14)}</div>
      <div class="tab">${fileIcon("claude.py")} claude.py</div>
      <div class="tab">${fileIcon("deepseek.py")} deepseek.py</div>
      <div class="tab-tools">${icon("split", 18)}${icon("dots", 18)}</div>
    </div>
    <div class="crumbs">team-project ${icon("chevR", 14)} main.py ${icon("chevR", 14)} <span class="fn">build_team</span></div>
    <div class="accept" style="${px([bx - x0, by - y0, bw, bh])}">Accept Both Changes</div>`;
}
function minimap() {
  let bars = "";
  const rows = [10, 26, 0, 18, 12, -1, 20, 22, 7, 24, 15, 14, 0, 19];
  rows.forEach((w, i) => {
    const y = 26 + i * 12;
    if (w < 0) return;
    const col = i >= 6 && i <= 7 ? "#c97a5e" : i >= 9 && i <= 10 ? "#6f86f0" : i === 8 ? "#888" : "#6a7a8a";
    bars += `<i style="top:${y}px;left:${16 + (i === 4 || i === 7 || i === 9 || i === 11 ? 10 : 0)}px;width:${w * 6}px;background:${col}"></i>`;
  });
  return `<div class="mm-head">MINIMAP</div><div class="mm-slider"></div>${bars}
    <div class="mm-band" style="top:${26 + 6 * 12 - 3}px;background:rgba(217,119,87,0.35)"></div>
    <div class="mm-band" style="top:${26 + 9 * 12 - 3}px;height:${2 * 12}px;background:rgba(77,107,254,0.38)"></div>
    <div class="ruler" style="top:${26 + 6 * 12}px;background:#D97757"></div>
    <div class="ruler" style="top:${26 + 10 * 12}px;background:#4D6BFE"></div>`;
}
function scm() {
  return `<div class="side-head">SOURCE CONTROL <span>${icon("check", 18)}${icon("refresh", 18)}${icon("dots", 18)}</span></div>
    <div class="msg">Message (⌘⏎ to commit on "main")</div>
    <div class="commit">Continue</div>
    <div class="grp">${icon("chevD", 16)} Merge Changes <b>1</b></div>
    <div class="frow conflict" style="position:relative;padding-left:40px;height:34px">${fileIcon("main.py")}<span class="fname">main.py</span><span class="cbadge">C</span></div>
    <div class="grp">${icon("chevR", 16)} Staged Changes <b>0</b></div>`;
}
function terminal() {
  const tabs = ["PROBLEMS", "OUTPUT", "DEBUG CONSOLE", "TERMINAL", "PORTS"];
  return `<div class="ttabs">${tabs.map((t) => `<span class="${t === "TERMINAL" ? "on" : ""}">${t}${t === "PROBLEMS" ? ' <b class="badge2">1</b>' : ""}</span>`).join("")}
    <div class="ttools"><span class="shell">zsh</span>${icon("plus", 18)}${icon("split", 18)}${icon("trash", 18)}${icon("dots", 18)}${icon("close", 18)}</div></div>`;
}

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${T.UI_W}px; height: ${T.UI_H}px; overflow: hidden; background: #0a0a0a; }
  body { font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif; color: #cccccc; font-size: 15px; -webkit-font-smoothing: antialiased; }
  svg { display: inline-block; vertical-align: middle; }
  .panel { position: absolute; overflow: hidden; border-radius: 6px; background: #181818; }
  #p-titlebar { background: #1b1b1b; border-radius: 0; display: flex; align-items: center; }
  .lights { display: flex; gap: 9px; padding-left: 16px; }
  .lights i { width: 13px; height: 13px; border-radius: 50%; background: #4a4a4a; }
  .menus { display: flex; gap: 20px; margin-left: 30px; font-size: 15px; color: #c8c8c8; }
  .cmd { position: absolute; left: 50%; transform: translateX(-50%); width: 520px; height: 28px; border-radius: 6px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #a8a8a8; font-size: 14px; display: flex; gap: 8px; align-items: center; justify-content: center; }
  .title-right { position: absolute; right: 16px; display: flex; gap: 14px; color: #9a9a9a; }
  .actbar { position: absolute; left: 0; top: 0; bottom: 0; width: 56px; background: #181818; border-right: 1px solid #2b2b2b; }
  .act { position: absolute; left: 0; width: 56px; display: grid; place-items: center; color: #7d7d7d; height: 52px; }
  .act.on { color: #d7d7d7; box-shadow: inset 3px 0 0 #0078d4; }
  .badge { position: absolute; right: 8px; bottom: 6px; background: #0078d4; color: #fff; font-size: 11px; border-radius: 9px; padding: 1px 5px; font-style: normal; }
  .side-head { position: absolute; top: 0; left: 70px; right: 0; height: 40px; display: flex; align-items: center; justify-content: space-between; padding-right: 14px; font-size: 13px; letter-spacing: 0.5px; color: #bbbbbb; }
  #p-scm .side-head { left: 16px; }
  .side-head span { display: flex; gap: 10px; color: #9a9a9a; }
  .frow { position: absolute; left: 56px; right: 0; height: ${T.FILE_ROW_H}px; display: flex; align-items: center; gap: 6px; font-size: 16px; color: #cccccc; }
  .frow.sel { background: #04395e; box-shadow: inset 0 0 0 1px #0078d4; }
  .frow.conflict .fname { color: #e9a08a; }
  .chev { width: 18px; color: #a0a0a0; }
  .fname.root { font-weight: 700; font-size: 13px; letter-spacing: 0.5px; }
  .fico { font: 700 11px Menlo, monospace; width: 22px; text-align: center; }
  .flag { margin-left: auto; color: #e9a08a; font-weight: 700; }
  .cbadge { color: #e06c5a; font: 700 13px Menlo, monospace; margin: 0 14px 0 12px; }
  .outline-head { position: absolute; left: 56px; right: 0; height: 36px; border-top: 1px solid #2b2b2b; display: flex; align-items: center; gap: 4px; padding-left: 10px; font-size: 13px; letter-spacing: 0.5px; color: #bbbbbb; }
  #p-editor { background: #1f1f1f; }
  .tabs { height: 40px; display: flex; background: #181818; border-bottom: 1px solid #2b2b2b; }
  .tab { display: flex; align-items: center; gap: 6px; padding: 0 16px; font-size: 15px; color: #9d9d9d; border-right: 1px solid #2b2b2b; }
  .tab.on { background: #1f1f1f; color: #ffffff; box-shadow: inset 0 2px 0 #0078d4; }
  .tab.conflict { color: #e9a08a; }
  .tab .cbadge { margin: 0 4px; }
  .tab-tools { margin-left: auto; display: flex; gap: 14px; align-items: center; padding-right: 14px; color: #9a9a9a; }
  .crumbs { height: 28px; display: flex; align-items: center; gap: 4px; padding-left: 20px; font-size: 14px; color: #a9a9a9; }
  .crumbs .fn { color: #dcdcaa; }
  .accept { position: absolute; border-radius: 8px; display: grid; place-items: center; font-size: 19px; font-weight: 600; color: #ffffff;
    background: linear-gradient(90deg, #D97757, #9b72b0 50%, #4D6BFE); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.35); letter-spacing: 0.2px; }
  #p-minimap { background: #1c1c1c; }
  .mm-head { position: absolute; top: 4px; left: 16px; font-size: 11px; color: #555; letter-spacing: 1px; }
  #p-minimap i { position: absolute; height: 5px; border-radius: 1px; opacity: 0.8; }
  .mm-band { position: absolute; left: 0; right: 14px; height: 12px; }
  .mm-slider { position: absolute; left: 0; right: 0; top: 20px; height: 200px; background: rgba(121,121,121,0.13); }
  .ruler { position: absolute; right: 0; width: 10px; height: 8px; }
  .msg { margin: 46px 16px 0; height: 34px; border-radius: 4px; background: #2a2a2a; border: 1px solid #3c3c3c; color: #8a8a8a; font-size: 14px; padding: 7px 10px; }
  .commit { margin: 10px 16px; height: 34px; border-radius: 4px; background: #0078d4; color: #fff; font-size: 15px; display: grid; place-items: center; }
  .grp { margin: 12px 8px 6px; font-size: 14px; color: #cccccc; display: flex; gap: 6px; align-items: center; }
  .grp b { margin-left: auto; margin-right: 10px; background: #3a3a3a; border-radius: 9px; padding: 0 7px; font-size: 12px; }
  #p-scm .frow { left: 0; }
  .ttabs { height: 32px; display: flex; gap: 26px; align-items: center; padding-left: 18px; font-size: 13px; letter-spacing: 0.5px; color: #8f8f8f; border-bottom: 1px solid #2b2b2b; }
  .ttabs .on { color: #e7e7e7; box-shadow: 0 9px 0 -7px #0078d4; }
  .badge2 { background: #3a3a3a; color: #ddd; border-radius: 9px; padding: 0 6px; font-size: 11px; }
  .ttools { margin-left: auto; display: flex; gap: 14px; align-items: center; padding-right: 14px; color: #9a9a9a; }
  .shell { font-size: 13px; color: #bbbbbb; margin-right: 6px; }
  #p-statusbar { background: #181818; border-radius: 0; }
`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>workspace</title><style>${css}</style></head>
<body>
${panel("titlebar", titlebar())}
${panel("explorer", explorer())}
${panel("editor", editor())}
${panel("minimap", minimap())}
${panel("scm", scm())}
${panel("terminal", terminal())}
${panel("statusbar", "")}
</body></html>`;
writeFileSync(join(root, "ui/workspace.html"), html);

// timeline.json for the sound script
const dump = { FPS: T.FPS, DURATION: T.DURATION, BPM: T.BPM, BEAT: T.BEAT, BAR: T.BAR, EV: T.EV, cues: T.soundCues() };
writeFileSync(join(root, "build/timeline.json"), JSON.stringify(dump, null, 1));

if (!process.argv.includes("--no-shot")) {
  const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
  const ver = readdirSync(base).sort().pop();
  const chrome = join(base, ver, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
  if (!existsSync(chrome)) throw new Error(`headless chrome not found at ${chrome}`);
  execFileSync(chrome, [
    "--headless", "--hide-scrollbars", "--disable-gpu",
    `--window-size=${T.UI_W},${T.UI_H}`, `--force-device-scale-factor=${T.UI_SCALE}`,
    `--screenshot=${join(root, "assets/ui.png")}`, `file://${join(root, "ui/workspace.html")}`,
  ], { stdio: "ignore" });
}
console.log("ui built");
