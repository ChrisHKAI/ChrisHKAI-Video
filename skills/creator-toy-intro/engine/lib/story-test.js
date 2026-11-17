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
    // the personal moments found, used or not: was a stronger one left out? (only when written, so older reviews stay current)
    ...(facts.moments ? { moments: facts.moments } : {}),
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
  if (report.signature !== storyTestSignature(facts)) issues.push("story test is stale: the story, action, source material or ending changed; review it again (only a word changed and the review stands: story-test.mjs --resign \"what changed\")");
  if (report.verdict !== "ready") issues.push("story test is not ready: revise the story from the review before making the toy");
  // a story told as a scene (retold, scene, frames: references/story-directions.md) is asked three more things;
  // one written before stays complete on the six it was asked
  const d = input.direction, asScene = !!(d.retold || d.scene || (d.frames ?? []).length);
  for (const key of ["takeaway", "continuation", "specificity", "actionMeaning", "material", "heart", ...(asScene ? ["retold", "scene", "shown"] : [])]) {
    if (!text(report[key])) issues.push(`story test needs a concrete ${key} answer`);
  }
  // its frames were shown to a reader who was told nothing, first with every word taken off, then as they are
  if ((d.frames ?? []).length && !text(report.silent)) issues.push("story test has no silent reading: give research/story-silent.md (the frames without their words) to a reader who has not seen the story, before the blind page, and put what they said the story was in \"silent\"");
  if ((d.frames ?? []).length && !text(report.blind)) issues.push("story test has no blind reading: give research/story-blind.md to a reader who has not seen the story, and put their sentence in \"blind\"");
  if (!Array.isArray(report.issues) || report.issues.length) issues.push("story test has unresolved issues (use an empty list only after resolving them)");
  return issues;
}
