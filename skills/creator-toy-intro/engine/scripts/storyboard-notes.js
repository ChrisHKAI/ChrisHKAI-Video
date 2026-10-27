// Notes on the storyboard page's real frames (inlined by storyboard.py; NOTES
// holds the language's words and the film's fps). Click a spot on a preview
// frame, or on the animatic (it pauses), write what to change, send. Through
// the studio (engine/scripts/studio.mjs) a note lands in build/comments.jsonl;
// opened as a plain file it is copied, to paste into the chat.
(() => {
  const W = NOTES.words, FPS = NOTES.fps;
  const live = location.protocol.startsWith("http");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const css = document.createElement("style");
  css.textContent = `.npop{position:absolute;z-index:20;width:280px;background:#15171c;border:1px solid #2a2d33;border-radius:8px;padding:10px;display:grid;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.npop textarea{width:100%;min-height:70px;background:#0f1115;color:#eceae6;border:1px solid #2a2d33;border-radius:6px;padding:6px;font:inherit;resize:vertical}
.npop small{color:#9a978f}.npop .row{display:flex;gap:8px;justify-content:flex-end}
.npop button,.nhint button{background:#22252c;color:#eceae6;border:1px solid #2a2d33;border-radius:6px;padding:4px 12px;font:inherit;cursor:pointer}
.npop button.go{background:#3d7bff;border-color:#3d7bff}
.npin{position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;background:#e2463b;border:2px solid #fff;z-index:4;pointer-events:none}
.nring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #e2463b;z-index:4;pointer-events:none}
.nvid{position:relative;display:inline-block;max-width:100%}.nvid .ncatch{position:absolute;left:0;top:0;right:0;bottom:48px;cursor:crosshair}
.nlist{display:grid;gap:8px}.nlist .n{border:1px solid #2a2d33;border-radius:6px;padding:8px 10px;background:#15171c}.nlist .n small{color:#9a978f}.nlist .n.done{opacity:.55}
.nhint{color:#9a978f;font-size:13px}`;
  document.head.appendChild(css);

  // the notes section, after the frames
  const sec = document.createElement("section");
  sec.innerHTML = `<h2>${esc(W.title)}<small>${esc(live ? W.hint : W.hintFile)}</small></h2><div class="nlist"></div>`;
  const frames = document.querySelector(".frames")?.closest("section");
  (frames?.nextSibling ? frames.parentNode.insertBefore(sec, frames.nextSibling) : document.querySelector(".wrap").appendChild(sec));
  const list = sec.querySelector(".nlist");
  let notes = [];

  function pop(box, x, y, meta) {
    document.querySelector(".npop")?.remove();
    document.querySelectorAll(".nring").forEach((r) => r.remove());
    const ring = document.createElement("i");
    ring.className = "nring";
    ring.style.left = `${x * 100}%`;
    ring.style.top = `${y * 100}%`;
    box.appendChild(ring);
    const p = document.createElement("div");
    p.className = "npop";
    // on the page, not inside the frame (a frame clips what overflows it): under a small
    // frame, so the ring on the spot stays in view; on the big animatic, under the spot
    const b = box.getBoundingClientRect();
    const small = b.height < 320;
    p.style.left = `${scrollX + Math.max(8, Math.min(b.left + x * b.width - 140, document.documentElement.clientWidth - 288))}px`;
    p.style.top = `${scrollY + (small ? b.bottom + 6 : b.top + Math.min(y * b.height + 28, b.height - 170))}px`;
    p.innerHTML = `<small>${esc(W.at.replace("{t}", meta.t.toFixed(2)).replace("{n}", meta.frame))}</small><textarea></textarea><div class="row"><button class="no">${esc(W.cancel)}</button><button class="go">${esc(live ? W.send : W.copy)}</button></div>`;
    document.body.appendChild(p);
    const ta = p.querySelector("textarea");
    ta.focus();
    const close = () => { p.remove(); ring.remove(); };
    p.querySelector(".no").onclick = (e) => { e.stopPropagation(); close(); };
    p.onclick = (e) => e.stopPropagation();
    p.querySelector(".go").onclick = async (e) => {
      e.stopPropagation();
      const text = ta.value.trim();
      if (!text) return;
      const rec = { ...meta, x: +x.toFixed(4), y: +y.toFixed(4), text };
      if (live) {
        const r = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) }).catch(() => null);
        if (r?.ok) { close(); load(); return; }
      }
      const line = W.line.replace("{n}", rec.frame).replace("{t}", rec.t.toFixed(2)).replace("{x}", rec.x.toFixed(2)).replace("{y}", rec.y.toFixed(2)) + text;
      try { await navigator.clipboard.writeText(line); } catch { ta.value = line; ta.select(); }
      p.querySelector("small").textContent = W.copied;
    };
  }

  // the preview frames (Cycles)
  for (const f of document.querySelectorAll("figure[data-t]")) {
    const shot = f.querySelector(".shot");
    shot.style.cursor = "crosshair";
    shot.addEventListener("click", (e) => {
      if (e.target.closest(".npop")) return;
      const r = shot.getBoundingClientRect();
      pop(shot, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, { source: "storyboard", t: +f.dataset.t, frame: +f.dataset.n });
    });
  }
  // the animatic (EEVEE): a click on the picture pauses it there; its controls stay free
  const vid = document.querySelector("video");
  if (vid) {
    const wrap = document.createElement("div");
    wrap.className = "nvid";
    vid.parentNode.insertBefore(wrap, vid);
    wrap.appendChild(vid);
    const c = document.createElement("div");
    c.className = "ncatch";
    wrap.appendChild(c);
    c.addEventListener("click", (e) => {
      vid.pause();
      const r = vid.getBoundingClientRect();
      pop(wrap, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, { source: "animatic", t: vid.currentTime, frame: Math.floor(vid.currentTime * FPS) + 1 });
    });
  }

  function pins() {
    document.querySelectorAll(".npin").forEach((i) => i.remove());
    for (const n of notes.filter((n) => n.status === "open" && n.source === "storyboard")) {
      const shot = document.querySelector(`figure[data-n="${n.frame}"] .shot`);
      if (!shot) continue;
      const i = document.createElement("i");
      i.className = "npin";
      i.style.left = `${n.x * 100}%`;
      i.style.top = `${n.y * 100}%`;
      shot.appendChild(i);
    }
  }
  async function load() {
    if (!live) { list.innerHTML = ""; return; }
    notes = await fetch("/api/comments").then((r) => (r.ok ? r.json() : [])).catch(() => []);
    list.innerHTML = notes.length
      ? notes.slice().reverse().map((n) => `<div class="n ${n.status}"><small>${esc(n.id)} · ${esc(W.at.replace("{t}", (+n.t).toFixed(2)).replace("{n}", n.frame))} · ${esc(n.source === "animatic" ? W.animatic : W.frame)} · ${esc(n.status === "open" ? W.open : W.done)}</small><div>${esc(n.text)}</div>${n.reply ? `<small>→ ${esc(n.reply)}</small>` : ""}</div>`).join("")
      : `<div class="nhint">${esc(W.none)}</div>`;
    pins();
  }
  load();
  if (live) setInterval(load, 5000);
})();
