import { createHash } from "node:crypto";
import { resolveDirection } from "./research.js";

const text = (value) => typeof value === "string" && value.trim().length > 0;
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])])) : value;

// Bind a qualitative review to the selected story, source material and actual
// ending. JSON key reordering must not invalidate an otherwise identical review.
export function storyTestInput(facts) {
  const { direction, story } = resolveDirection(facts);
  if (!direction) return null; // old point/proof workspaces remain usable
  const selected = direction.beats.map((b) => facts.story.find((s) => s.id === b.story));
  const postIds = new Set(selected.flatMap((s) => s.posts ?? []));
  return {
    creator: { name: facts.profile?.name, bio: facts.profile?.bio },
    toyReference: facts.toy ?? null,
    audience: facts.narrative ?? {}, direction, story,
    opening: facts.picks?.opening ?? direction.opening ?? null,
    ending: facts.picks?.cta ?? direction.cta ?? null,
    facts: selected,
    posts: (facts.posts ?? []).filter((p) => postIds.has(p.id)),
  };
}

export function storyTestSignature(facts) {
  return createHash("sha256").update(JSON.stringify(canonical(storyTestInput(facts)))).digest("hex");
}

export function storyTestIssues(facts, report) {
  const input = storyTestInput(facts);
  if (!input) return [];
  const issues = [];
  for (const b of input.direction.beats) {
    if (!text(b.action?.does) || !text(b.action?.means)) issues.push(`story ${b.story} needs action.does and action.means (what the toy does and what the viewer learns)`);
  }
  if (!report) return [...issues, "no story test yet: run story-test.mjs, review the brief, and save research/story-test.json"];
  if (report.signature !== storyTestSignature(facts)) issues.push("story test is stale: the story, action, source material or ending changed; review it again");
  if (report.verdict !== "ready") issues.push("story test is not ready: revise the story from the review before making the toy");
  for (const key of ["takeaway", "continuation", "specificity", "actionMeaning", "material"]) {
    if (!text(report[key])) issues.push(`story test needs a concrete ${key} answer`);
  }
  if (!Array.isArray(report.issues) || report.issues.length) issues.push("story test has unresolved issues (use an empty list only after resolving them)");
  return issues;
}
