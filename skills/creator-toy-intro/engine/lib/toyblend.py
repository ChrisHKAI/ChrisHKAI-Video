"""The toy's shapes and vinyl in Blender, beyond the rounded boxes, balls and
arcs every kit has (scene.py, lookdev.py): the pet kit's blobs, tubes and
pillows with markings painted on, and the sculpt kit's meshes made offline
(engine/scripts/sculpt.py → build/toy/<part>.npz, painted per vertex).

Paint: a part's `paint` layers each union a few blobs ({ c, r } in the part's
own space, metres) into one soft mask; noise wobbles the edges so patches read
as fur or print, not circles. Later layers paint over earlier ones.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

# finishes: roughness, coat weight, coat roughness (toy.json "finish": colour key → finish)
FINISH = {"vinyl": (0.34, 0.5, 0.16), "soft": (0.34, 0.5, 0.16), "matte": (0.55, 0.15, 0.16), "lens": (0.1, 1.0, 0.03), "gloss": (0.2, 0.7, 0.06)}


def srgb_to_linear(c):
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def rgba(hex_, k=1.0):
    h = hex_.lstrip("#")
    r, g, b = srgb_to_linear([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return (r * k, g * k, b * k, 1.0)


# ── shapes ──────────────────────────────────────────────────────────────────
def blob_mesh(name, r, p=2.0, taper=0.0, u=64, v=40):
    """Superellipsoid |x|^p + |y|^p + |z|^p = 1 scaled by r, poles on y; x and z
    scale by (1 + taper * y/ry), so taper < 0 narrows the top (ears, pears)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    for vt in bm.verts:
        d = Vector((vt.co.x, vt.co.z, vt.co.y)).normalized()
        s = (abs(d.x) ** p + abs(d.y) ** p + abs(d.z) ** p) ** (-1 / p)
        x, y, z = d.x * s * r[0], d.y * s * r[1], d.z * s * r[2]
        f = 1 + taper * d.y * s
        vt.co = (x * f, y, z * f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def tube_mesh(name, pts, radii, ring=20, per_seg=10, cap=8):
    """A smooth tube through pts (Catmull-Rom) with per-point radii and round caps."""
    P = [Vector(p) for p in pts]
    n = len(P)
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    samples, rads = [], []
    for i in range(n - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        for k in range(per_seg):
            t = k / per_seg
            t2, t3 = t * t, t * t * t
            samples.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            rads.append(radii[i] + (radii[i + 1] - radii[i]) * (3 * t2 - 2 * t3))
    samples.append(P[-1])
    rads.append(radii[-1])
    # parallel-transport frames
    tans = []
    for i in range(len(samples)):
        a, b = samples[max(i - 1, 0)], samples[min(i + 1, len(samples) - 1)]
        tans.append((b - a).normalized())
    up = Vector((0, 1, 0)) if abs(tans[0].y) < 0.9 else Vector((1, 0, 0))
    nrm = tans[0].cross(up).normalized()
    frames = []
    for i, t in enumerate(tans):
        if i:
            nrm = (nrm - t * nrm.dot(t)).normalized()
        frames.append((nrm.copy(), t.cross(nrm).normalized()))
    verts, faces, rings = [], [], []

    def add_ring(c, rad, fr):
        rings.append(len(verts))
        for j in range(ring):
            a = 2 * math.pi * j / ring
            verts.append(c + (fr[0] * math.cos(a) + fr[1] * math.sin(a)) * rad)

    # start cap (from the tip inward), body, end cap
    for k in range(cap, 0, -1):
        th = (math.pi / 2) * k / cap
        add_ring(samples[0] - tans[0] * rads[0] * math.sin(th), rads[0] * math.cos(th) + 1e-6, frames[0])
    for c, rad, fr in zip(samples, rads, frames):
        add_ring(c, rad, fr)
    for k in range(1, cap + 1):
        th = (math.pi / 2) * k / cap
        add_ring(samples[-1] + tans[-1] * rads[-1] * math.sin(th), rads[-1] * math.cos(th) + 1e-6, frames[-1])
    for a, b in zip(rings, rings[1:]):
        for j in range(ring):
            j2 = (j + 1) % ring
            faces.append((a + j, a + j2, b + j2, b + j))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def prism_mesh(name, sides, r, depth, bevel):
    """A rounded n-sided pillow (a corner up), its faces at z = ±depth/2."""
    bm = bmesh.new()
    vs = [bm.verts.new((r * math.sin(2 * math.pi * i / sides), r * math.cos(2 * math.pi * i / sides), -depth / 2)) for i in range(sides)]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=8, profile=0.5, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def file_mesh(name, path):
    """A sculpted part (sculpt.py): verts (m, part space), faces, and per-vertex
    colour (linear RGB) and roughness in the "paint" and "rough" attributes."""
    d = np.load(path)
    v, f = d["verts"], d["faces"]
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(v))
    me.vertices.foreach_set("co", v.ravel())
    me.loops.add(f.size)
    me.loops.foreach_set("vertex_index", f.ravel())
    me.polygons.add(len(f))
    me.polygons.foreach_set("loop_start", np.arange(0, f.size, 3))
    me.update(calc_edges=True)
    me.validate()
    if "color" in d:
        a = me.color_attributes.new("paint", "FLOAT_COLOR", "POINT")
        rgba_ = np.concatenate([d["color"], np.ones((len(d["color"]), 1))], axis=1).astype(np.float32)
        a.data.foreach_set("color", rgba_.ravel())
    if "rough" in d:
        r = me.attributes.new("rough", "FLOAT", "POINT")
        r.data.foreach_set("value", d["rough"].astype(np.float32))
    me.update()
    me.shade_smooth()
    return me


def part_mesh(name, g, root):
    """The mesh for a geometry spec { type: blob | tube | prism | mesh, … }; root resolves mesh files."""
    t = g["type"]
    if t == "blob":
        return blob_mesh(name, g["r"], g.get("p", 2.0), g.get("taper", 0.0))
    if t == "tube":
        return tube_mesh(name, g["pts"], g["radii"])
    if t == "prism":
        return prism_mesh(name, g["sides"], g["r"], g["depth"], g["bevel"])
    if t == "mesh":
        return file_mesh(name, root / g["file"])
    raise ValueError(t)


# ── vinyl ───────────────────────────────────────────────────────────────────
def _math(nt, op, a, b):
    m = nt.nodes.new("ShaderNodeMath")
    m.operation = op
    nt.links.new(a, m.inputs[0])
    if isinstance(b, (int, float)):
        m.inputs[1].default_value = b
    else:
        nt.links.new(b, m.inputs[1])
    return m.outputs[0]


def _paint_mask(nt, coord, layer):
    """One soft mask from the union of the layer's blobs."""
    soft, wob_k = layer.get("soft", 0.035), layer.get("noise", 0.22)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 140.0
    noise.inputs["Detail"].default_value = 3.0
    nt.links.new(coord, noise.inputs["Vector"])
    wob = nt.nodes.new("ShaderNodeMath")
    wob.operation = "MULTIPLY_ADD"
    nt.links.new(noise.outputs["Fac"], wob.inputs[0])
    wob.inputs[1].default_value = 2 * wob_k
    wob.inputs[2].default_value = -wob_k
    acc = None
    for b in layer["blobs"]:
        sub = nt.nodes.new("ShaderNodeVectorMath")
        sub.operation = "SUBTRACT"
        nt.links.new(coord, sub.inputs[0])
        sub.inputs[1].default_value = b["c"]
        div = nt.nodes.new("ShaderNodeVectorMath")
        div.operation = "MULTIPLY"
        nt.links.new(sub.outputs[0], div.inputs[0])
        div.inputs[1].default_value = [1 / x for x in b["r"]]
        ln = nt.nodes.new("ShaderNodeVectorMath")
        ln.operation = "LENGTH"
        nt.links.new(div.outputs[0], ln.inputs[0])
        acc = ln.outputs["Value"] if acc is None else _math(nt, "MINIMUM", acc, ln.outputs["Value"])
    d = _math(nt, "ADD", acc, wob.outputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHSTEP"
    mr.inputs["From Min"].default_value = 1 - soft
    mr.inputs["From Max"].default_value = 1 + soft
    mr.inputs["To Min"].default_value = 1.0
    mr.inputs["To Max"].default_value = 0.0
    nt.links.new(d, mr.inputs["Value"])
    return mr.outputs["Result"]


def paint(nt, p, colors, base, layers):
    """Paint layers over the base colour into Principled node p's Base Color."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    col = None
    for layer in layers:
        mask = _paint_mask(nt, tc.outputs["Object"], layer)
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(mask, mix.inputs["Factor"])
        if col is None:
            mix.inputs["A"].default_value = rgba(colors[base])
        else:
            nt.links.new(col, mix.inputs["A"])
        mix.inputs["B"].default_value = rgba(colors[layer["mat"]])
        col = mix.outputs["Result"]
    nt.links.new(col, p.inputs["Base Color"])


def vertex_paint(nt, p, finish="vinyl"):
    """A sculpted part's own colours and roughness, per vertex, in its finish:
    vinyl, skin (light under the surface), gloss (eyes, frames), glass (lenses)."""
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_name = "paint"
    nt.links.new(a.outputs["Color"], p.inputs["Base Color"])
    if finish == "glass":
        p.inputs["Base Color"].default_value = (1, 1, 1, 1)
        nt.links.remove(p.inputs["Base Color"].links[0])
        p.inputs["Transmission Weight"].default_value = 1.0
        p.inputs["Roughness"].default_value = 0.0
        p.inputs["IOR"].default_value = 1.04
        return
    if finish == "gloss":
        p.inputs["Roughness"].default_value = 0.08
        p.inputs["Coat Weight"].default_value = 1.0
        p.inputs["Coat Roughness"].default_value = 0.03
        return
    r = nt.nodes.new("ShaderNodeAttribute")
    r.attribute_name = "rough"
    nt.links.new(r.outputs["Fac"], p.inputs["Roughness"])
    p.inputs["Coat Weight"].default_value = 0.2 if finish == "skin" else 0.15
    p.inputs["Coat Roughness"].default_value = 0.25
    if finish == "skin":
        p.inputs["Subsurface Weight"].default_value = 0.18
        p.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.25)
        p.inputs["Subsurface Scale"].default_value = 0.0015
