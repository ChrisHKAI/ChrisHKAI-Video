// Writes the toy.json of every toy here that is written as code: the calico cat
// (pet kit) and Tim and Steve Jobs (the Tim film's toy line, also the pet
// kit's shapes), with their joints renamed onto the story's rig contract.
// isnail is a toy.json already; Chris is a sculpt (chris/sculpt.py).
//
// usage: node characters/build.mjs [--expression happy]
import { writeFileSync } from "node:fs";

const here = (f) => new URL(f, import.meta.url);
const argv = process.argv.slice(2);
const EXPR = argv.includes("--expression") ? argv[argv.indexOf("--expression") + 1] : "happy";
const write = (dir, toy) => {
  writeFileSync(here(`${dir}/toy.json`), JSON.stringify(toy, null, 1) + "\n");
  console.log(`${dir}/toy.json: ${toy.parts.length} parts on ${Object.keys(toy.joints).join(" ")}`);
};
const rename = (joints, parts, G) => ({
  joints: Object.fromEntries(Object.entries(joints).map(([j, s]) => [G[j] ?? j, { ...s, parent: s.parent ? (G[s.parent] ?? s.parent) : null }])),
  parts: parts.map((p) => ({ ...p, group: G[p.group] ?? p.group })),
});

// the cat: front legs are its arms, hind legs its legs, both ears one joint
{
  const { CAT_PARTS, JOINTS, COLORS, HEIGHT, CENTER } = await import(here("kingao-cat/cat.js"));
  const G = { legL: "armL", legR: "armR", hindL: "legL", hindR: "legR", earL: "ears", earR: "ears" };
  const { joints, parts } = rename(JOINTS, CAT_PARTS, G);
  joints.ears = { p: [0, 0.077, 0], parent: "head" }; // between the two ears
  write("kingao-cat", { name: "金敖 (kingao), a calico cat", kit: "pet", height: HEIGHT, center: CENTER, colors: COLORS,
    finish: { white: "soft", line: "gloss", nose: "gloss", whisker: "gloss" }, joints, parts });
}

// the Tim line: hips are the body; chest, elbows, hands, thumbs and brows rest
// under their parents; one expression's face pieces (EXPRESSIONS in figure.js)
{
  const { EXPRESSIONS, HEIGHT } = await import(here("tim-line/figure.js"));
  const e = EXPRESSIONS[EXPR] ?? EXPRESSIONS.happy;
  const keep = new Set([`eyes:${e.eyes}`, `mouth:${e.mouth}`]);
  for (const [dir, file, key, name] of [["tim", "tim.js", "TIM", "Tim (Tim Pan, 影视飓风)"], ["steve", "jobs.js", "JOBS", "Steve Jobs"]]) {
    const m = await import(here(`tim-line/${file}`));
    const fig = m[key];
    const { joints, parts } = rename(fig.joints, fig.parts.filter((p) => !p.expr || keep.has(p.expr)).map(({ expr, ...p }) => p), { hips: "body" });
    write(dir, { name, kit: "pet", line: "tim", expression: EXPR, height: HEIGHT, center: [0, +(HEIGHT * 0.42).toFixed(4), 0],
      colors: m.COLORS, finish: m.FINISH, joints, parts });
  }
}
