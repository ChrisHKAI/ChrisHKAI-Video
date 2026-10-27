// Resolves "#engine/<file>" to this skill's engine/lib/<file> for modules
// outside the skill: a film's own copy of a template (film.json "template":
// "./template"), its own beats and props, and the modules they import. Inside
// the skill the package.json "imports" field does the same. Registered by
// film.js's importFile.
const LIB = new URL("./", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("#engine/")) return { url: new URL(specifier.slice("#engine/".length), LIB).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
