"""Is the toy in one piece? A vinyl toy's parts are glued together: each one
touches the rest, none is buried where it is never seen, and no two lie on
each other. The look-dev asks here once it has built the toy, at rest and in
the poses it renders (scripts/lookdev.py → build/toy-parts.json), because a
joint in the wrong place shows only when the arm turns. check.mjs reads it.

  floating  a part, or a few together, that touches nothing of the rest: an
            eye in front of the face, a hat above the head, an arm that comes
            off the shoulder when it turns (in any pose)
  hidden    a part inside the others in every pose: an eye sunk into the
            head is never seen (glass does not hide what is behind it)
  coincide  two parts of different colours or finishes whose surfaces lie
            on each other, facing the same way: the render speckles there
A part meant to stand apart (a halo, a spark, a prop held off the hand) says
"apart": true in toy.json.

The idea is the asset check of EL4CTEO/blender-skills (MIT), made for a toy.
"""
import json

import bmesh
from mathutils.bvhtree import BVHTree

SAMPLES = 300  # points per part


class Part:
    def __init__(self, bpy, name, ob, spec, finish):
        dg = bpy.context.evaluated_depsgraph_get()
        bm = bmesh.new()
        bm.from_object(ob, dg)
        bm.transform(ob.matrix_world)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.normal_update()
        self.name, self.spec = name, spec
        self.pts = [v.co.copy() for v in bm.verts]
        self.nrm = [v.normal.copy() for v in bm.verts]
        step = max(1, len(self.pts) // SAMPLES)
        self.sample = list(range(0, len(self.pts), step))
        self.closed = bool(bm.edges) and all(len(e.link_faces) == 2 for e in bm.edges)
        # the signed volume says which way a closed part's faces point (one made inside out still has an inside)
        vol = sum(f.verts[0].co.dot(f.verts[1].co.cross(f.verts[2].co)) for f in bm.faces) / 6 if self.closed else 1
        self.out = 1.0 if vol >= 0 else -1.0
        self.glass = (spec.get("finish") or finish.get(spec.get("mat"), "vinyl")) == "glass"
        self.bvh = BVHTree.FromBMesh(bm)
        self.corner = [f.verts[0].index for f in bm.faces]  # a triangle's first point, for its colour
        # a sculpted part's own colours, per point (toyblend.file_mesh): two painted parts may meet in one colour
        a = ob.data.color_attributes.get("paint") if spec.get("mat") == "paint" else None
        self.col = [tuple(c.color[:3]) for c in a.data] if a is not None and a.domain == "POINT" and len(a.data) == len(self.pts) else None
        xs, ys, zs = zip(*self.pts) if self.pts else ((0,), (0,), (0,))
        self.lo, self.hi = (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))
        self.size = sum((h - l) ** 2 for l, h in zip(self.lo, self.hi)) ** 0.5
        bm.free()

    def near(self, other, pad):
        return all(a <= d + pad and c <= b + pad for a, b, c, d in zip(self.lo, self.hi, other.lo, other.hi))

    def inside(self, p):
        """p is inside this closed part."""
        loc, nrm, _, _ = self.bvh.find_nearest(p)
        return loc is not None and (p - loc).dot(nrm) * self.out < 0


def _touch(a, b, tol):
    if not a.near(b, tol):
        return False
    if a.bvh.overlap(b.bvh):
        return True
    for x, y in ((a, b), (b, a)):
        for i in x.sample:
            if y.bvh.find_nearest(x.pts[i], tol)[0] is not None or (y.closed and y.inside(x.pts[i])):
                return True
    return False


def _gap(group, rest):
    """The shortest distance from a group of parts to the rest (m)."""
    best = float("inf")
    for a in group:
        for b in rest:
            for i in a.sample:
                loc, _, _, d = b.bvh.find_nearest(a.pts[i])
                if loc is not None:
                    best = min(best, d)
    return best


def check(bpy, objects, hero, pose):
    """The toy's parts as they stand now: {"floating": [...], "hidden": set, "coincide": [...]}.
    objects: part name → its Blender object; hero: build/hero.json."""
    bpy.context.view_layer.update()
    H = hero.get("height", 0.113)
    tol, eps = 0.004 * H, 0.0004 * H  # touching: half a millimetre on isnail's 113 mm; lying on: under 0.05
    specs = {p["name"]: p for p in hero["parts"]}
    parts = [Part(bpy, n, ob, specs[n], hero.get("finish", {})) for n, ob in objects.items()]
    parts = [p for p in parts if p.pts]
    glued = [p for p in parts if not p.spec.get("apart")]

    # floating: the groups of parts that touch one another; the biggest group is the toy
    root = list(range(len(glued)))

    def find(i):
        while root[i] != i:
            root[i] = root[root[i]]
            i = root[i]
        return i
    for i, a in enumerate(glued):
        for j in range(i + 1, len(glued)):
            if find(i) != find(j) and _touch(a, glued[j], tol):
                root[find(i)] = find(j)
    groups = {}
    for i, p in enumerate(glued):
        groups.setdefault(find(i), []).append(p)
    floating = []
    if len(groups) > 1:
        body = max(groups.values(), key=lambda g: sum(p.size for p in g))
        rest = [p for p in glued if p in body]
        for g in groups.values():
            if g is not body:
                floating.append({"pose": pose, "parts": sorted(p.name for p in g), "mm": round(_gap(g, rest) * 1000, 1)})

    # hidden: every point of the part is inside another part (an opaque, closed one)
    hidden = set()
    hiders = [p for p in parts if p.closed and not p.glass]
    for a in parts:
        around = [b for b in hiders if b is not a and a.near(b, 0)]
        if around and all(any(b.inside(a.pts[i]) for b in around) for i in a.sample):
            hidden.add(a.name)

    # coincide: much of one part's surface lies on another's, facing the same way; parts of one colour and
    # finish render the same whichever the ray finds (an elbow where two tubes' round ends meet)
    coincide = []
    look = lambda p: (p.spec.get("mat"), p.spec.get("finish") or hero.get("finish", {}).get(p.spec.get("mat"), "vinyl"))  # noqa: E731
    for i, a in enumerate(parts):
        for b in parts[i + 1:]:
            if not a.near(b, eps) or (look(a) == look(b) and look(a)[0] != "paint"):
                continue
            small, big = (a, b) if len(a.sample) <= len(b.sample) else (b, a)
            on = 0
            for k in small.sample:
                loc, nrm, t, _ = big.bvh.find_nearest(small.pts[k], eps)
                if loc is not None and small.nrm[k].dot(nrm) * small.out * big.out > 0.99:
                    on += not (small.col and big.col) or max(abs(x - y) for x, y in zip(small.col[k], big.col[big.corner[t]])) > 0.02
            share = on / len(small.sample)
            if share > 0.08:
                coincide.append({"pose": pose, "parts": [small.name, big.name], "share": round(share, 2)})
    return {"floating": floating, "hidden": hidden, "coincide": coincide}


def write(path, results, hero):
    """build/toy-parts.json from check()'s results, one per pose: what is wrong, said in a line each."""
    out = []
    seen = set()
    for r in results:
        for f in r["floating"]:
            key = ("floating", tuple(f["parts"]))
            if key in seen:
                continue
            seen.add(key)
            what = f["parts"][0] if len(f["parts"]) == 1 else f"{', '.join(f['parts'][:-1])} and {f['parts'][-1]}"
            out.append({**f, "kind": "floating", "text": f"{what} {'float' if len(f['parts']) > 1 else 'floats'} {f['mm']} mm off the rest of the toy ({f['pose']})"})
    for name in sorted(set.intersection(*(r["hidden"] for r in results)) if results else ()):
        out.append({"kind": "hidden", "parts": [name], "text": f"{name} is inside the other parts in every pose: it is never seen"})
    for r in results[:1]:
        for c in r["coincide"]:
            out.append({**c, "kind": "coincide", "text": f"{c['parts'][0]} lies on {c['parts'][1]} ({round(c['share'] * 100)}% of it): the render speckles there"})
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"height": hero.get("height"), "found": out}, indent=1, ensure_ascii=False))
    return out
