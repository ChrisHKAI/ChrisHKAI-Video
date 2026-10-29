// Research stays separate from animation: a direction connects existing facts,
// while a beat decides how to show one. Old story/proof picks still work.
export function resolveDirection(facts) {
  const picks = facts.picks ?? {};
  if (!picks.direction) return { direction: null, story: picks.story ?? [] };
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
  if (direction.gaps.length) throw new Error(`direction "${direction.id}" still has evidence gaps: resolve them or choose a supported direction`);
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
  return { direction, story };
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
