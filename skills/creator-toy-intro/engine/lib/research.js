// Research stays separate from animation: a direction connects existing facts,
// while a beat decides how to show one. Old story/proof picks still work.
// A direction with open evidence gaps can still be chosen once its claims are narrowed
// to what the sources support: the gaps come back as warnings, for the user to see.
const FAMILIAR_ACRONYMS = new Set([
  "PPT", "PDF", "APP", "VIP", "CEO", "CTO", "CFO", "COO", "API", "SDK", "CLI", "GUI", "GPU", "CPU", "RAM", "SSD",
  "USB", "URL", "WEB", "CSS", "HTML", "JSON", "SQL", "SSH", "GIT", "IOS", "MAC", "WIN", "PRO", "MAX", "MINI", "AIR",
  "PLUS", "GPT", "LLM", "RAG", "MCP", "AGI", "AIGC", "OCR", "TTS", "FPS", "BPM", "RGB", "HDR", "PNG", "JPG", "SVG",
  "MP4", "MOV", "GIF", "ZIP", "LED", "LCD", "OLED", "DIY", "FAQ", "SOP", "MVP", "ROI", "KPI", "OKR", "B2B", "B2C",
  "C2C", "DTC", "SAAS", "CRM", "ERP", "CMS", "SEO", "SEM", "CTR", "CVR", "GMV", "ARR", "MRR", "KOL", "KOC", "UGC",
  "PGC", "BGM", "SFX", "VFX", "CAD", "BIM", "NFT", "ETF", "IPO", "NBA", "CBA", "FIFA", "ATM", "SIM", "WIFI", "GPS",
]);

function copyClarityWarnings(direction, picks, storyItems = []) {
  const out = [];
  const slogan = (picks?.cta?.slogan ?? direction.cta?.slogan ?? []).map((s) => (typeof s === "string" ? s : s?.text ?? ""));
  const frameTexts = (direction.frames ?? []).map((fr) => (fr?.words ?? []).filter((w) => typeof w === "string").join(" "));
  const beatIds = new Set((direction.beats ?? []).map((b) => b?.story));
  const beatLines = storyItems.filter((s) => beatIds.has(s?.id) && typeof s?.line === "string").map((s) => s.line);
  const allCopy = [direction.hook?.text ?? "", ...slogan, ...frameTexts, ...beatLines].join(" ");
  if (/[\u4e00-\u9fff]/.test(allCopy)) {
    const hasCjkUnit = /\d(?:\.\d+)?\s*[万萬亿億]/.test(allCopy);
    const latinUnit = allCopy.match(/\b\d+(?:\.\d+)?\s*[wW]\+?(?![A-Za-z])/);
    if (hasCjkUnit && latinUnit) {
      out.push(`direction "${direction.id}" mixes Chinese counter units (万/亿) with shorthand "${latinUnit[0].trim()}" on screen: write both in the platform's script (e.g. 20万+) so numbers stay consistent`);
    }
    const checkChunks = [direction.hook?.text ?? "", slogan.join(" "), ...frameTexts];
    const flagged = new Set();
    for (const chunk of checkChunks) {
      if (!chunk) continue;
      const cjkCount = (chunk.match(/[\u4e00-\u9fff]/g) ?? []).length;
      for (const m of chunk.matchAll(/(?<![A-Za-z])[A-Z]{3,5}(?![A-Za-z])/g)) {
        const acr = m[0];
        if (FAMILIAR_ACRONYMS.has(acr) || flagged.has(acr)) continue;
        if (cjkCount < 7) {
          flagged.add(acr);
          out.push(`direction "${direction.id}" puts niche acronym "${acr}" on screen ("${chunk.trim()}") with little plain-language context: add everyday words beside it so first-time viewers outside the niche understand immediately`);
        }
      }
    }
  }
  return out;
}

export function resolveDirection(facts) {
  const picks = facts.picks ?? {};
  if (!picks.direction) return { direction: null, story: picks.story ?? [], warnings: [] };
  const matches = (facts.directions ?? []).filter((d) => d.id === picks.direction);
  if (matches.length !== 1) throw new Error(`picks.direction must name one direction: "${picks.direction}"`);
  const direction = matches[0];
  for (const key of ["title", "premise", "payoff", "why"]) {
    if (typeof direction[key] !== "string" || !direction[key].trim()) throw new Error(`direction "${direction.id}" needs ${key}`);
  }
  for (const key of ["question", "visual", "text"]) {
    if (typeof direction.hook?.[key] !== "string" || !direction.hook[key].trim()) throw new Error(`direction "${direction.id}" needs hook.${key}`);
  }
  if (!Array.isArray(direction.gaps)) throw new Error(`direction "${direction.id}" needs gaps (an empty list when supported)`);
  const warnings = direction.gaps.length
    ? [`direction "${direction.id}" has open evidence gaps (${direction.gaps.join("; ")}): keep its claims to what the sources support, and tell the user`]
    : [];
  // a person at its heart, not a number (SKILL.md, "The bar"): who, why, for whom, the moment
  // an ending the user picked from another direction: its payoff was written for its own
  const picked = picks.cta?.slogan, own = direction.cta?.slogan;
  if (picked && own && JSON.stringify(picked) !== JSON.stringify(own)) warnings.push(`the ending picked ("${picked.join(" ")}") is not direction "${direction.id}"'s own ("${own.join(" ")}"): check its payoff still answers the hook, rewrite it if not, and write the picked ending into the direction's cta`);
  // told as a scene, seen before it is built (references/story-directions.md, frames.md): advice, never a stop
  if (!direction.retold?.trim()) warnings.push(`direction "${direction.id}" has no line a viewer would retell ("retold": 「就是那个……的人」): the film has nothing to plant`);
  if (!direction.scene?.wants?.trim() || !direction.scene?.stuck?.trim() || !direction.scene?.turn?.trim()) warnings.push(`direction "${direction.id}" is not a scene yet ("scene": where, wants, stuck, turn): as it stands it tells its points one after another`);
  if (!(direction.frames ?? []).length) warnings.push(`direction "${direction.id}" has no frames ("frames": the storyboard on paper, references/frames.md): its image has not been seen yet`);
  if (!direction.heart?.who?.trim()) warnings.push(`direction "${direction.id}" has no person at its heart (heart: who, why, for whom, the moment): as it stands it is numbers and devices (references/story-directions.md)`);
  warnings.push(...copyClarityWarnings(direction, picks, facts.story ?? []));
  if (!Array.isArray(direction.beats) || direction.beats.length < 1 || direction.beats.length > 4) throw new Error(`direction "${direction.id}" needs 1–4 story beats`);
  const ids = direction.beats.map((b, i) => {
    if (!(facts.story ?? []).some((s) => s.id === b.story)) throw new Error(`direction "${direction.id}" names missing story "${b.story}"`);
    if (!b.role?.trim() || (i > 0 && !b.connection?.trim())) throw new Error(`direction "${direction.id}" beat ${i + 1} needs a role and its connection to the previous beat`);
    return b.story;
  });
  if (new Set(ids).size !== ids.length) throw new Error(`direction "${direction.id}" repeats a story beat`);
  // Permit animation overrides, but do not silently detach the agreed story
  // from its order. Edit the direction first when the user changes the arc.
  const story = picks.story ?? ids;
  if (!Array.isArray(story) || JSON.stringify(story.map((s) => typeof s === "string" ? s : s.id)) !== JSON.stringify(ids)) {
    throw new Error("picks.story differs from the chosen direction: update its beats first (animation overrides may keep the same order)");
  }
  return { direction, story, warnings };
}

export function numberProvenanceIssues(facts = {}) {
  const issues = [];
  const visit = (numbers, path) => {
    for (const [key, n] of Object.entries(numbers ?? {})) {
      if (!n || typeof n !== "object" || (n.display === undefined && n.value === undefined)) continue;
      const missing = ["source", "read"].filter((field) => typeof n[field] !== "string" || !n[field].trim());
      if (missing.length) issues.push({ path: `${path}.${key}`, display: n.display ?? n.value, missing });
    }
  };
  visit(facts.numbers, "numbers"); // older workspaces
  visit(facts.profile?.numbers, "profile.numbers");
  for (const [i, p] of (facts.posts ?? []).entries()) visit(p.numbers, `posts[${i}].numbers`);
  for (const [i, s] of (facts.story ?? []).entries()) visit(s.numbers, `story[${i}].numbers`);
  visit(facts.extra, "extra");
  return issues;
}
