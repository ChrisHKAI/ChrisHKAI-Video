// Writes ui/workspace.html from src/timeline.js, screenshots it to
// assets/ui.png (3840x2160) with headless Chrome, and dumps
// build/timeline.json for the sound script.
//
// usage: node scripts/build-ui.mjs [--no-shot]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as T from "../src/timeline.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "ui"), { recursive: true });
mkdirSync(join(root, "assets"), { recursive: true });
mkdirSync(join(root, "build"), { recursive: true });

const px = (r) => `left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;`;

// ── Icons (24x24 viewBox, stroke = currentColor) ────────────────────────────
const ICON = {
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  selection: '<path d="M6 3v17l4.5-4.2 3 6.2 2.6-1.2-3-6.1H19z" fill="currentColor"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5V5a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.7 0-4.2-1.4-5.6-3.7L4 14.6a1.4 1.4 0 0 1 2.3-1.6L8 15"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  orbit: '<path d="M19 12a7 7 0 1 1-3-5.7"/><path d="M16.5 3v3.6h3.6"/>',
  anchor: '<circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6"/>',
  rect: '<rect x="4.5" y="6" width="15" height="12" rx="1"/>',
  pen: '<path d="M12 3 7 12l2.5 8h5L17 12z"/><circle cx="12" cy="12" r="1.4"/><path d="M12 3v7.6"/>',
  type: '<path d="M5 5h14M12 5v15M9 20h6" stroke-width="2.2"/>',
  brush: '<path d="M19 4 9.5 13.5"/><path d="M9.5 13.5c-2.5-.3-4.5 1.5-4.5 4 0 1.2-.6 2-1.5 2.5 3.8.8 7.2-.8 7.5-4.3"/>',
  stamp: '<path d="M9 4h6v6l2 3H7l2-3zM5 15h14v3H5zM7 20h10"/>',
  eraser: '<path d="m14 4 6 6-9 9H6l-3-3z"/><path d="M8.5 9.5l6 6M11 19h9"/>',
  roto: '<path d="M7 15c-2-4 0-9 5-9s7 4 6 8"/><circle cx="7.5" cy="18" r="2.5"/><path d="M13 13l3 3"/>',
  puppet: '<path d="M12 3v4"/><circle cx="12" cy="10" r="3"/><path d="M12 13v8M8 21h8"/>',
  first: '<path d="M6 5v14M19 5l-10 7 10 7z" fill="currentColor"/>',
  prev: '<path d="M5 5v14M19 5 9 12l10 7z" fill="currentColor"/><path d="M5 5v14"/>',
  play: '<path d="M7 4.5v15L19.5 12z" fill="currentColor"/>',
  next: '<path d="M19 5v14M5 5l10 7-10 7z" fill="currentColor"/>',
  last: '<path d="M18 5v14M5 5l10 7-10 7z" fill="currentColor"/>',
  camera: '<rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.4"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/>',
  grid: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
  lines: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M10 3h4"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6S18 18 12 18 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>',
  speaker: '<path d="M4 9.5h4L13 5v14l-5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  lock: '<rect x="5.5" y="11" width="13" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  comp: '<rect x="3.5" y="5.5" width="17" height="13" rx="1"/><path d="M3.5 9.5h17M8 5.5v4M14 5.5v4"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="1"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5"/>',
  folder: '<path d="M3.5 6.5h6l2 2h9v10h-17z"/>',
  star: '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
  wave: '<path d="M3 15c3-6 6 2 9-3s6-4 9 0"/>',
  text: '<path d="M6 6h12M12 6v12" stroke-width="2.2"/>',
  chevron: '<path d="m8 10 4 4 4-4" fill="none"/>',
  caretR: '<path d="m10 7 5 5-5 5z" fill="currentColor"/>',
  caretD: '<path d="m7 10 5 5 5-5z" fill="currentColor"/>',
  menu: '<path d="M5 8h14M5 12h14M5 16h14"/>',
};
const icon = (name, size = 22, extra = "") =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICON[name]}</svg>`;

// ── Pieces ──────────────────────────────────────────────────────────────────
const panel = (name, r, inner, { focus = false } = {}) =>
  `<section class="panel${focus ? " focus" : ""}" id="p-${name}" style="${px(r)}">${inner}</section>`;

const tabs = (list) =>
  `<div class="tabs">${list
    .map((t) => `<div class="tab${t.active ? " active" : ""}">${t.label}${t.menu ? ' <span class="burger">≡</span>' : ""}</div>`)
    .join("")}</div>`;

function menubar() {
  const menus = ["File", "Edit", "Composition", "Layer", "Effect", "Animation", "View", "Window", "Help"];
  const tools = T.TOOLS.map((n) => {
    const r = T.toolRect(n);
    return `<div class="tool" style="${px(r)}">${icon(n, 26)}</div>`;
  }).join("");
  const sep = `<div class="sep" style="left:${T.toolRect("selection")[0] - 8}px"></div>`;
  const ws = ["Default", "Review", "Learning", "Standard", "Small Screen", "Libraries"];
  return `
    <div class="menubar">
      ${menus.map((m) => `<span>${m}</span>`).join("")}
      <div class="doc-title">Untitled Project.aep *</div>
    </div>
    <div class="toolbar">
      ${tools}${sep}
      <label class="snap"><span class="box">✓</span> Snapping</label>
      <div class="workspaces">${ws
        .map((w) => `<span class="${w === "Standard" ? "on" : ""}">${w}</span>`)
        .join("")}<span class="more">»</span>${icon("search", 20)}</div>
    </div>`;
}

function project() {
  return tabs([
    { label: "Project", menu: true },
    { label: "Effect Controls <b>MADE WITH CLAUDE</b>", active: true, menu: true },
  ]) + `
    <div class="proj-head">
      <div class="thumb"><i></i></div>
      <div class="meta">
        <div class="name">Main Comp <span class="caret">▾</span></div>
        <div>1920 x 1080 (1.00)</div>
        <div>Δ 0;00;10;00, 30.00 fps</div>
      </div>
    </div>
    <div class="search-row">${icon("search", 18)}<span></span></div>
    <div class="list-head"><span>Name</span><span>Type</span><span>Size</span></div>
    <div class="item sel">${icon("comp", 18)}<span>Main Comp</span><em>Composition</em><em></em></div>
    <div class="item">${icon("image", 18)}<span>clawd.png</span><em>PNG file</em><em>38 KB</em></div>
    <div class="item">${icon("folder", 18)}<span>Solids</span><em>Folder</em><em></em></div>
    <div class="fx-block">
      <div class="fx-title"><b>fx</b> Glow <span class="reset">Reset</span><span class="opt">Options...</span></div>
      <div class="fx-row"><span>Glow Based On</span><b>Color Channels ▾</b></div>
      <div class="fx-row"><span>Glow Threshold</span><b>60.0%</b></div>
      <div class="fx-row"><span>Glow Radius</span><b>40.0</b></div>
      <div class="fx-row"><span>Glow Intensity</span><b>1.5</b></div>
      <div class="fx-row"><span>Composite Original</span><b>Behind ▾</b></div>
      <div class="fx-row"><span>Glow Colors</span><b>A &amp; B Colors ▾</b></div>
    </div>
    <div class="footer-bar">${icon("comp", 16)}<span>8 bpc</span></div>`;
}

function comp() {
  const [cx, cy, cw, ch] = T.COMP;
  const [px0, py0] = T.PANELS.comp;
  const tc = T.TC_COMP;
  return tabs([
    { label: "Composition <b>Main Comp</b>", active: true, menu: true },
    { label: "Layer <i>(none)</i>" },
    { label: "Footage <i>(none)</i>" },
  ]) + `
    <div class="crumb">${icon("comp", 16)} Main Comp</div>
    <div class="viewer"></div>
    <div class="comp-frame" style="left:${cx - px0}px;top:${cy - py0}px;width:${cw}px;height:${ch}px"></div>
    <div class="comp-footer">
      <span class="dd">50% ▾</span>
      ${icon("grid", 18)}${icon("lines", 18)}
      <span class="cam">${icon("camera", 20)}</span>
      <span class="tc-slot" style="left:${tc[0] - px0}px;width:${tc[2]}px"></span>
      <span class="dd" style="left:${tc[0] - px0 + tc[2] + 30}px">Full ▾</span>
      <span class="dd" style="left:${tc[0] - px0 + tc[2] + 140}px">Active Camera ▾</span>
      <span class="dd" style="left:${tc[0] - px0 + tc[2] + 330}px">1 View ▾</span>
      <span class="dd" style="right:16px">+0.0</span>
    </div>`;
}

function info() {
  return tabs([{ label: "Info", active: true, menu: true }, { label: "Audio" }]) + `
    <div class="info">
      <div class="rgb"><span class="r">R : 217</span><span class="g">G : 119</span><span class="b">B : 87</span><span class="a">A : 255</span></div>
      <div class="xy"><span>X : 1044</span><span>Y : 532</span></div>
    </div>`;
}

function preview() {
  const [x0, y0] = T.PANELS.preview;
  const btns = T.PREVIEW_BUTTONS.map((n) => {
    const r = T.previewRect(n);
    return `<div class="pbtn" style="left:${r[0] - x0}px;top:${r[1] - y0}px;width:${r[2]}px;height:${r[3]}px">${icon(n, 24)}</div>`;
  }).join("");
  return tabs([{ label: "Preview", active: true, menu: true }]) + btns + `
    <div class="shortcut"><span>Shortcut</span><b>Spacebar ▾</b><span class="inc">Include:</span>${icon("speaker", 18)}${icon("eye", 18)}</div>`;
}

function effects() {
  const [x0, y0] = T.PANELS.effects;
  const s = T.EFFECTS_SEARCH;
  const rows = T.EFFECTS_ROWS.map((r) => {
    const indent = 18 + r.depth * 22;
    const lead = r.folder ? icon(r.open ? "caretD" : "caretR", 16) + icon("folder", 18) : r.fx ? '<b class="fx">fx</b>' : icon("star", 16);
    return `<div class="erow${r.selected ? " sel" : ""}" style="top:${r.y - y0}px;padding-left:${indent}px">${lead}<span>${r.text}</span></div>`;
  }).join("");
  return tabs([{ label: "Effects &amp; Presets", active: true, menu: true }, { label: "Libraries" }]) + `
    <div class="esearch" style="left:${s[0] - x0}px;top:${s[1] - y0}px;width:${s[2]}px;height:${s[3]}px">${icon("search", 18)}<span>glow</span><i>✕</i></div>
    ${rows}`;
}

function timeline() {
  const [x0, y0] = T.PANELS.timeline;
  const rowsHtml = T.TL_ROWS.map((row, i) => {
    const top = T.TL.rowsTop + i * T.TL.rowH - y0;
    if (row.type === "layer") {
      const L = T.LAYERS[row.layer];
      const glyph = L.kind === "text" ? icon("text", 18) : L.kind === "image" ? icon("image", 18) : icon(L.name === "Spark" ? "star" : "wave", 18);
      return `<div class="lrow" style="top:${top}px">
        <span class="sw">${icon("eye", 16)}${icon("speaker", 16)}</span>
        <span class="label" style="background:${L.color}"></span>
        <span class="num">${row.layer + 1}</span>
        <span class="tw">${row.layer === 0 ? icon("caretD", 14) : icon("caretR", 14)}</span>
        ${glyph}<span class="lname">${L.name}</span>
        <span class="mode">Normal ▾</span><span class="trk">None ▾</span><span class="parent">${icon("wave", 14)} None ▾</span>
      </div>`;
    }
    return `<div class="prow" style="top:${top}px">
      ${row.keyed ? `<span class="watch">${icon("stopwatch", 16)}</span>` : `<span class="watch off">${icon("stopwatch", 16)}</span>`}
      <span class="pname">${row.name}</span><span class="pval">${row.value}</span>
    </div>`;
  }).join("");
  const tracks = T.TL_ROWS.map((row, i) => {
    const top = T.TL.rowsTop + i * T.TL.rowH - y0;
    const shade = `<div class="track${i % 2 ? " odd" : ""}" style="top:${top}px;left:${T.TL.trackX0 - 20 - x0}px;width:${T.TL.trackX1 - T.TL.trackX0 + 40}px"></div>`;
    if (row.type !== "layer") return shade;
    const L = T.LAYERS[row.layer];
    return shade + `<div class="bar" style="top:${top + 5}px;left:${T.TL.trackX0 - x0}px;width:${T.TL.trackX1 - T.TL.trackX0}px;background:${L.color}"></div>`;
  }).join("");
  let ruler = "";
  for (let s = 0; s <= T.COMP_DURATION; s++) {
    const x = T.compTimeToX(s) - x0;
    ruler += `<div class="tick major" style="left:${x}px"></div><div class="tlabel" style="left:${x + 4}px">${String(s).padStart(2, "0")}s</div>`;
    if (s < T.COMP_DURATION) for (let q = 1; q < 4; q++) ruler += `<div class="tick" style="left:${T.compTimeToX(s + q / 4) - x0}px"></div>`;
  }
  const tc = T.TC_TIMELINE;
  return tabs([{ label: "Main Comp", active: true, menu: true }, { label: "Render Queue" }]) + `
    <div class="tl-head">
      <span class="tc-slot" style="left:${tc[0] - x0}px;top:${tc[1] - y0 - 30}px;width:${tc[2]}px;height:${tc[3]}px"></span>
      <span class="tc-sub">00195 (30.00 fps)</span>
      <div class="tl-search">${icon("search", 16)}</div>
      <div class="tl-switch">${icon("comp", 18)}${icon("lock", 18)}${icon("wave", 18)}${icon("grid", 18)}</div>
      <div class="work-area" style="left:${T.TL.trackX0 - x0}px;width:${T.TL.trackX1 - T.TL.trackX0}px"></div>
      ${ruler}
    </div>
    <div class="col-head">
      <span style="left:12px">${icon("eye", 14)} ${icon("speaker", 14)}</span>
      <span style="left:96px">#</span><span style="left:140px">Layer Name</span>
      <span style="left:390px">Mode</span><span style="left:500px">T  TrkMat</span><span style="left:600px">Parent &amp; Link</span>
    </div>
    ${tracks}${rowsHtml}
    <div class="divider" style="left:${T.TL.trackX0 - 24 - x0}px"></div>
    <div class="tl-foot"><span>Toggle Switches / Modes</span></div>`;
}

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${T.UI_W}px; height: ${T.UI_H}px; overflow: hidden; background: #0c0c0c; }
  body { font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif; color: #a9a9a9; font-size: 15px; -webkit-font-smoothing: antialiased; }
  b { color: #d6d6d6; font-weight: 600; }
  i { font-style: normal; color: #7c7c7c; }
  .panel { position: absolute; background: #232323; border-radius: 6px; overflow: hidden; }
  .panel.focus { box-shadow: inset 0 0 0 2px #2f8ff0; }
  .tabs { height: 28px; display: flex; gap: 2px; padding: 0 6px; align-items: flex-end; background: #1b1b1b; }
  .tab { padding: 5px 14px 6px; font-size: 14px; color: #8f8f8f; white-space: nowrap; }
  .tab.active { color: #e2e2e2; box-shadow: inset 0 -2px 0 #2f8ff0; }
  .tab .burger { color: #7a7a7a; margin-left: 6px; }
  svg { display: inline-block; vertical-align: middle; }

  #p-menubar { border-radius: 0; background: #262626; }
  .menubar { height: 30px; display: flex; align-items: center; gap: 22px; padding-left: 14px; background: #1d1d1d; font-size: 15px; color: #c9c9c9; }
  .ae-logo { width: 22px; height: 22px; border-radius: 5px; background: #00005b; color: #9999ff; font-weight: 700; font-size: 12px; display: grid; place-items: center; border: 1.5px solid #9999ff; }
  .doc-title { position: absolute; left: 50%; transform: translateX(-50%); color: #8a8a8a; font-size: 14px; top: 7px; }
  .toolbar { position: relative; height: 56px; }
  .tool { position: absolute; top: 5px !important; border-radius: 6px; display: grid; place-items: center; color: #c8c8c8; }
  .sep { position: absolute; top: 14px; width: 1px; height: 30px; background: #444; }
  .snap { position: absolute; left: 930px; top: 18px; font-size: 14px; color: #a8a8a8; }
  .snap .box { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 3px; background: #2f8ff0; color: #fff; font-size: 11px; margin-right: 6px; }
  .workspaces { position: absolute; right: 18px; top: 16px; display: flex; gap: 26px; align-items: center; font-size: 15px; color: #a0a0a0; }
  .workspaces .on { color: #4ea3ff; box-shadow: 0 6px 0 -4px #4ea3ff; }

  .proj-head { display: flex; gap: 14px; padding: 14px; }
  .thumb { width: 112px; height: 63px; background: #000; border: 1px solid #3a3a3a; position: relative; }
  .thumb i { position: absolute; left: 48px; top: 26px; width: 16px; height: 11px; background: #d97757; border-radius: 2px; }
  .meta { font-size: 14px; line-height: 21px; color: #a0a0a0; }
  .meta .name { color: #e0e0e0; font-weight: 600; }
  .search-row { margin: 0 14px 8px; height: 26px; border-radius: 13px; background: #1a1a1a; padding: 3px 10px; color: #777; }
  .list-head { display: grid; grid-template-columns: 1.4fr 1fr 0.6fr; padding: 4px 14px; font-size: 13px; color: #8b8b8b; border-bottom: 1px solid #333; }
  .item { display: grid; grid-template-columns: 24px 1.3fr 1fr 0.6fr; align-items: center; padding: 5px 14px; font-size: 14px; color: #c4c4c4; }
  .item.sel { background: #2b3e55; }
  .item em { font-style: normal; color: #8a8a8a; font-size: 13px; }
  .fx-block { margin: 14px 10px 0; border-top: 1px solid #333; padding-top: 10px; }
  .fx-title { font-size: 14px; color: #dcdcdc; padding: 4px 6px; }
  .fx-title b { color: #4ea3ff; margin-right: 8px; }
  .fx-title .reset { color: #4ea3ff; margin-left: 40px; }
  .fx-title .opt { color: #4ea3ff; margin-left: 18px; }
  .fx-row { display: flex; justify-content: space-between; padding: 5px 6px 5px 26px; font-size: 13.5px; color: #9c9c9c; }
  .fx-row b { color: #4ea3ff; font-weight: 500; }
  .footer-bar { position: absolute; bottom: 0; left: 0; right: 0; height: 28px; background: #1d1d1d; display: flex; gap: 8px; align-items: center; padding-left: 12px; font-size: 13px; }

  .crumb { height: 22px; padding: 2px 12px; font-size: 13.5px; color: #c9c9c9; background: #202020; }
  .viewer { position: absolute; left: 6px; right: 6px; top: 52px; bottom: 40px; background: #191919; }
  .comp-frame { position: absolute; background: #000; box-shadow: 0 0 0 1px #2c2c2c; }
  .comp-footer { position: absolute; left: 0; right: 0; bottom: 0; height: 38px; background: #1d1d1d; font-size: 15px; color: #cfcfcf; }
  .comp-footer > * { position: absolute; top: 8px; }
  .comp-footer svg { position: absolute; top: 9px; }
  .comp-footer > svg:nth-of-type(1) { left: 100px; }
  .comp-footer > svg:nth-of-type(2) { left: 134px; }
  .comp-footer .cam { left: 196px; top: 7px; }
  .comp-footer .dd:first-child { left: 14px; }

  .info { padding: 12px 22px; display: flex; gap: 70px; font-size: 15px; font-weight: 600; }
  .info .rgb { display: grid; grid-template-columns: 110px 110px; row-gap: 6px; }
  .info .r { color: #e2604f; } .info .g { color: #6ec46e; } .info .b { color: #4f8fe8; } .info .a { color: #bdbdbd; }
  .info .xy { display: grid; row-gap: 6px; color: #bdbdbd; }

  .pbtn { position: absolute; display: grid; place-items: center; color: #d0d0d0; border-radius: 6px; }
  .shortcut { position: absolute; left: 20px; right: 20px; top: 96px; display: flex; gap: 14px; align-items: center; font-size: 14px; color: #8f8f8f; }
  .shortcut b { color: #4ea3ff; font-weight: 500; }
  .shortcut .inc { margin-left: 60px; }

  .esearch { position: absolute; background: #1a1a1a; border-radius: 15px; padding: 5px 12px; display: flex; gap: 10px; align-items: center; color: #e0e0e0; font-size: 15px; }
  .esearch i { margin-left: auto; color: #8a8a8a; }
  .erow { position: absolute; left: 12px; right: 12px; height: 26px; display: flex; gap: 8px; align-items: center; font-size: 14.5px; color: #c4c4c4; }
  .erow.sel { background: #2f6fbf; color: #fff; border-radius: 3px; }
  .erow .fx { color: #fff; font-size: 13px; background: #1f4f8f; border-radius: 3px; padding: 0 4px; }
  .erow.sel span { font-weight: 600; }

  .tl-head { position: absolute; left: 0; right: 0; top: 28px; height: 52px; }
  .tc-slot { position: absolute; }
  .tc-sub { position: absolute; left: 16px; top: 38px; font-size: 11px; color: #777; }
  .tl-search { position: absolute; left: 250px; top: 12px; width: 180px; height: 26px; border-radius: 13px; background: #1a1a1a; padding: 3px 10px; color: #777; }
  .tl-switch { position: absolute; left: 470px; top: 14px; display: flex; gap: 18px; color: #9a9a9a; }
  .work-area { position: absolute; top: 4px; height: 14px; background: #3a4a5c; border-radius: 2px; }
  .tick { position: absolute; top: 34px; width: 1px; height: 8px; background: #5a5a5a; }
  .tick.major { top: 24px; height: 18px; background: #8a8a8a; }
  .tlabel { position: absolute; top: 22px; font-size: 12px; color: #9a9a9a; }
  .col-head { position: absolute; left: 0; right: 0; top: 80px; height: 22px; background: #1f1f1f; font-size: 13px; color: #8a8a8a; }
  .col-head span { position: absolute; top: 3px; }
  .track { position: absolute; height: ${T.TL.rowH}px; background: #1b1b1b; }
  .track.odd { background: #1e1e1e; }
  .bar { position: absolute; height: ${T.TL.rowH - 10}px; border-radius: 2px; opacity: 0.85; }
  .lrow, .prow { position: absolute; left: 0; width: ${T.TL.trackX0 - 30 - T.PANELS.timeline[0]}px; height: ${T.TL.rowH}px; display: flex; align-items: center; font-size: 14px; color: #cfcfcf; border-bottom: 1px solid #2b2b2b; }
  .lrow .sw { width: 70px; display: flex; gap: 6px; padding-left: 10px; color: #8a8a8a; }
  .lrow .label { width: 14px; height: 14px; border-radius: 2px; margin: 0 8px 0 4px; }
  .lrow .num { width: 26px; color: #a0a0a0; }
  .lrow .tw { width: 18px; color: #9a9a9a; }
  .lrow .lname { width: 220px; margin-left: 6px; }
  .lrow .mode, .lrow .trk, .lrow .parent { color: #9a9a9a; font-size: 13px; }
  .lrow .mode { width: 110px; } .lrow .trk { width: 100px; }
  .prow { padding-left: 150px; }
  .prow .watch { color: #4ea3ff; margin-right: 10px; } .prow .watch.off { color: #6a6a6a; }
  .prow .pname { width: 130px; color: #c7c7c7; } .prow .pval { color: #4ea3ff; }
  .divider { position: absolute; top: 80px; bottom: 30px; width: 1px; background: #343434; }
  .tl-foot { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; background: #1b1b1b; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #8a8a8a; }
`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>workspace</title><style>${css}</style></head>
<body>
${panel("menubar", T.PANELS.menubar, menubar())}
${panel("project", T.PANELS.project, project())}
${panel("comp", T.PANELS.comp, comp(), { focus: true })}
${panel("info", T.PANELS.info, info())}
${panel("preview", T.PANELS.preview, preview())}
${panel("effects", T.PANELS.effects, effects())}
${panel("timeline", T.PANELS.timeline, timeline())}
</body></html>`;

writeFileSync(join(root, "ui/workspace.html"), html);

// timeline.json for the sound script
const dump = {
  FPS: T.FPS, DURATION: T.DURATION, BPM: T.BPM, EV: T.EV, HOPS: T.HOPS,
  KEY_STAMP_TIMES: T.KEY_STAMP_TIMES, cues: T.soundCues(),
};
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
  ], { stdio: "inherit" });
}
console.log("ui built");
