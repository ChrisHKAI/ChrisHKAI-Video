"""The vinyl toy in Blender: meshes for each part shape (blobs, tubes, closed
loops, rounded plates) and the materials by finish (vinyl with painted-on
markings, gloss, satin, metal, glass, black glass, screens). Shared by
lookdev.py and scene.py (both put scripts/ on sys.path).

Paint: a part's `paint` layers each union a few blobs (ellipsoids in the
part's own mesh space) into one soft mask; the noise wobbles the edges.
Later layers paint over earlier ones.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Vector


def srgb_to_linear(c):
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def rgba(hex_, k=1.0):
    h = hex_.lstrip("#")
    r, g, b = srgb_to_linear([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return (r * k, g * k, b * k, 1.0)


# ── meshes ──────────────────────────────────────────────────────────────────
def round_box_mesh(name, size, radius):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(radius, min(size) / 2 - 1e-5), segments=6, profile=0.5, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(30))
    return me


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
        idx = len(verts)
        for j in range(ring):
            a = 2 * math.pi * j / ring
            verts.append(c + (fr[0] * math.cos(a) + fr[1] * math.sin(a)) * rad)
        rings.append(idx)

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


def loop_mesh(name, pts, radii, ring=16, per_seg=6):
    """A smooth closed tube through pts (closed Catmull-Rom), per-point radii.
    Parallel-transport frames, the leftover twist spread round the loop."""
    P = [Vector(p) for p in pts]
    n = len(P)
    samples, rads = [], []
    for i in range(n):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
        r1, r2 = radii[i], radii[(i + 1) % n]
        for k in range(per_seg):
            t = k / per_seg
            t2, t3 = t * t, t * t * t
            samples.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            rads.append(r1 + (r2 - r1) * (3 * t2 - 2 * t3))
    m = len(samples)
    tans = [(samples[(i + 1) % m] - samples[i - 1]).normalized() for i in range(m)]
    up = Vector((0, 1, 0)) if abs(tans[0].y) < 0.9 else Vector((1, 0, 0))
    nrm = tans[0].cross(up).normalized()
    n0 = nrm.copy()
    normals = []
    for i, t in enumerate(tans):
        if i:
            nrm = (nrm - t * nrm.dot(t)).normalized()
        normals.append(nrm.copy())
    # twist left over after going round once
    last = (normals[-1] - tans[0] * normals[-1].dot(tans[0])).normalized()
    twist = math.atan2(n0.cross(last).dot(tans[0]), n0.dot(last))
    verts, faces = [], []
    for i, (c, rad, t, nv) in enumerate(zip(samples, rads, tans, normals)):
        a = -twist * i / m
        nv = nv * math.cos(a) + t.cross(nv) * math.sin(a)
        bv = t.cross(nv).normalized()
        for j in range(ring):
            b = 2 * math.pi * j / ring
            verts.append(c + (nv * math.cos(b) + bv * math.sin(b)) * rad)
    for i in range(m):
        a, b = i * ring, ((i + 1) % m) * ring
        for j in range(ring):
            j2 = (j + 1) % ring
            faces.append((a + j, a + j2, b + j2, b + j))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def round_rect(w, d, corners, n=8):
    """Rounded rectangle in the xz plane; corners (+x+z, -x+z, -x-z, +x-z)."""
    if not isinstance(corners, (list, tuple)):
        corners = [corners] * 4
    out = []
    for k, ((sx, sz), r) in enumerate(zip(((1, 1), (-1, 1), (-1, -1), (1, -1)), corners)):
        r = min(r, w / 2 - 1e-6, d / 2 - 1e-6)
        cx, cz = sx * (w / 2 - r), sz * (d / 2 - r)
        if r < 1e-6:
            out.append((sx * w / 2, sz * d / 2))
            continue
        for i in range(n + 1):
            a = (k + i / n) * math.pi / 2
            out.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return out


def plate_mesh(name, w, d, t, corners, bevel, uv=None, outline=None):
    """A slab lying in the xz plane (w along x, d along z, t thick along y),
    rounded corners (or any outline of (x, z) points), bevelled rim.
    uv = [u at -x, v at -z, u at +x, v at +z]."""
    bm = bmesh.new()
    if outline:
        w = max(x for x, _ in outline) - min(x for x, _ in outline)
        d = max(z for _, z in outline) - min(z for _, z in outline)
    vs = [bm.verts.new((x, -t / 2, z)) for x, z in (outline or round_rect(w, d, corners))]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.y += t
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel > 0:
        rim = [e for e in bm.edges if e.calc_face_angle(0) > 0.6]
        bmesh.ops.bevel(bm, geom=rim, offset=min(bevel, t / 2 - 1e-6), segments=4, profile=0.5, affect="EDGES", clamp_overlap=True)
    u0, v0, u1, v1 = uv or (0, 0, 1, 1)
    layer = bm.loops.layers.uv.new("UVMap")
    for face in bm.faces:
        for lp in face.loops:
            x, _, z = lp.vert.co
            lp[layer].uv = (u0 + (x / w + 0.5) * (u1 - u0), v0 + (z / d + 0.5) * (v1 - v0))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(35))
    return me


def part_mesh(p):
    if p["shape"] == "roundBox":
        return round_box_mesh(p["name"], p["size"], p["radius"])
    if p["shape"] == "ellipsoid":
        return blob_mesh(p["name"], p["r"], 2.0, 0.0, 48, 32)
    if p["shape"] == "blob":
        return blob_mesh(p["name"], p["r"], p.get("p", 2.0), p.get("taper", 0.0))
    if p["shape"] == "prism":
        return prism_mesh(p["name"], p["sides"], p["r"], p["depth"], p["bevel"])
    if p["shape"] == "tube":
        return tube_mesh(p["name"], p["pts"], p["radii"])
    if p["shape"] == "loop":
        return loop_mesh(p["name"], p["pts"], p["radii"])
    if p["shape"] == "plate":
        return plate_mesh(p["name"], p.get("w"), p.get("d"), p["t"], p.get("corner"), p["bevel"], p.get("uv"), p.get("outline"))
    raise ValueError(p["shape"])


# ── materials ─────────────────────────────────────────────────────────────── ───────────────────────────────────────────────────────────────
VINYL = {
    # roughness, coat weight, coat roughness
    "default": (0.34, 0.5, 0.16),
    "skin": (0.4, 0.4, 0.2),
    "hair": (0.48, 0.25, 0.2),
    "shirt": (0.5, 0.25, 0.24),
    "jeans": (0.55, 0.2, 0.3),
    "pupil": (0.2, 0.8, 0.05),
    "line": (0.3, 0.6, 0.1),
    "brow": (0.36, 0.4, 0.2),
    "mouth": (0.3, 0.6, 0.1),
    "tongue": (0.3, 0.6, 0.1),
    "teeth": (0.25, 0.6, 0.08),
}


def _paint_mask(nt, coord, layer):
    """One soft mask from the union of the layer's blobs."""
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 140.0
    noise.inputs["Detail"].default_value = 3.0
    nt.links.new(coord, noise.inputs["Vector"])
    wob = nt.nodes.new("ShaderNodeMath")
    wob.operation = "MULTIPLY_ADD"
    nt.links.new(noise.outputs["Fac"], wob.inputs[0])
    wob.inputs[1].default_value = 2 * layer["noise"]
    wob.inputs[2].default_value = -layer["noise"]
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
    mr.inputs["From Min"].default_value = 1 - layer["soft"]
    mr.inputs["From Max"].default_value = 1 + layer["soft"]
    mr.inputs["To Min"].default_value = 1.0
    mr.inputs["To Max"].default_value = 0.0
    nt.links.new(d, mr.inputs["Value"])
    return mr.outputs["Result"]


def _math(nt, op, a, b):
    m = nt.nodes.new("ShaderNodeMath")
    m.operation = op
    nt.links.new(a, m.inputs[0])
    if isinstance(b, (int, float)):
        m.inputs[1].default_value = b
    else:
        nt.links.new(b, m.inputs[1])
    return m.outputs[0]


def vinyl_material(name, colors, base, paint=()):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    kind = base.split(".")[-1]  # colours may be named figure.colour
    rough, coat, coat_rough = VINYL.get(kind, VINYL["default"])
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    if kind == "skin":
        p.inputs["Subsurface Weight"].default_value = 0.12
        p.inputs["Subsurface Radius"].default_value = (0.004, 0.0022, 0.0016)
    if not paint:
        p.inputs["Base Color"].default_value = rgba(colors[base])
    else:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        col = None
        for layer in paint:
            mask = _paint_mask(nt, tc.outputs["Object"], layer)
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            nt.links.new(mask, mix.inputs["Factor"])
            if col is None:
                mix.inputs["A"].default_value = rgba(colors[base])
            else:
                nt.links.new(col, mix.inputs["A"])
            if layer.get("speckle"):
                # stubble: the layer's colour broken up by fine dots of the colour beneath
                nz = nt.nodes.new("ShaderNodeTexNoise")
                nz.inputs["Scale"].default_value = 1400.0
                nz.inputs["Detail"].default_value = 0.0
                nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
                cut = nt.nodes.new("ShaderNodeMapRange")
                cut.inputs["From Min"].default_value = 0.5 - layer["speckle"] * 0.2
                cut.inputs["From Max"].default_value = 0.5 + layer["speckle"] * 0.05
                nt.links.new(nz.outputs["Fac"], cut.inputs["Value"])
                dots = nt.nodes.new("ShaderNodeMix")
                dots.data_type = "RGBA"
                nt.links.new(cut.outputs["Result"], dots.inputs["Factor"])
                dots.inputs["A"].default_value = rgba(colors[layer["mat"]])
                dots.inputs["B"].default_value = rgba(colors[layer.get("speckleWith", base)])
                nt.links.new(dots.outputs["Result"], mix.inputs["B"])
            else:
                mix.inputs["B"].default_value = rgba(colors[layer["mat"]])
            col = mix.outputs["Result"]
        nt.links.new(col, p.inputs["Base Color"])
    if kind == "hair":
        # sculpted strands: wavy grooves running front to back
        tc = nt.nodes.new("ShaderNodeTexCoord")
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "X"
        # light (grey) hair shows the grooves more: finer and shallower there
        light = sum(rgba(colors[base])[:3]) / 3 > 0.15
        wave.inputs["Scale"].default_value = 170.0 if light else 70.0
        wave.inputs["Distortion"].default_value = 5.0
        wave.inputs["Detail"].default_value = 2.0
        wave.inputs["Detail Scale"].default_value = 1.5
        nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.14 if light else 0.35
        bump.inputs["Distance"].default_value = 0.0004
        nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], p.inputs["Normal"])
        # salt and pepper: the colour varies a little along the strands
        tint = nt.nodes.new("ShaderNodeMix")
        tint.data_type = "RGBA"
        nt.links.new(wave.outputs["Fac"], tint.inputs["Factor"])
        c = rgba(colors[base])
        tint.inputs["A"].default_value = (c[0] * 0.86, c[1] * 0.86, c[2] * 0.86, 1)
        tint.inputs["B"].default_value = (min(1, c[0] * 1.08), min(1, c[1] * 1.08), min(1, c[2] * 1.08), 1)
        nt.links.new(tint.outputs["Result"], p.inputs["Base Color"])
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return m


def finish_material(name, colors, base, finish, images=None):
    """Non-vinyl finishes: gloss, satin, metal, glass, blackGlass, emit, screen."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    c = rgba(colors[base])
    p.inputs["Base Color"].default_value = c
    shader = p.outputs["BSDF"]
    if finish == "gloss":
        p.inputs["Roughness"].default_value = 0.3
        p.inputs["Coat Weight"].default_value = 0.45
        p.inputs["Coat Roughness"].default_value = 0.14
    elif finish == "satin":
        p.inputs["Roughness"].default_value = 0.42
        p.inputs["Coat Weight"].default_value = 0.25
        p.inputs["Coat Roughness"].default_value = 0.3
    elif finish == "metal":
        p.inputs["Metallic"].default_value = 1.0
        p.inputs["Roughness"].default_value = 0.2
    elif finish == "blackGlass":
        p.inputs["Roughness"].default_value = 0.08
        p.inputs["Coat Weight"].default_value = 1.0
        p.inputs["Coat Roughness"].default_value = 0.02
    elif finish == "emit":
        p.inputs["Emission Color"].default_value = c
        p.inputs["Emission Strength"].default_value = 1.6
    elif finish == "glass":
        # thin clear lens: refracts in camera, lets light through for shadows
        p.inputs["Transmission Weight"].default_value = 1.0
        p.inputs["Roughness"].default_value = 0.02
        p.inputs["IOR"].default_value = 1.25
        lp = nt.nodes.new("ShaderNodeLightPath")
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
        nt.links.new(p.outputs["BSDF"], mix.inputs[1])
        nt.links.new(tr.outputs["BSDF"], mix.inputs[2])
        shader = mix.outputs["Shader"]
    elif finish == "screen":
        p.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
        p.inputs["Roughness"].default_value = 0.1
        p.inputs["Coat Weight"].default_value = 1.0
        p.inputs["Coat Roughness"].default_value = 0.03
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(images[base], check_existing=True)
        tex.interpolation = "Cubic"
        tex.extension = "EXTEND"
        nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 1.15
        m["screen"] = True
    nt.links.new(shader, out.inputs["Surface"])
    return m


def part_material(p, hero, cache, images=None):
    """The material for a part: shared per colour unless it has paint."""
    fin = hero["finish"].get(p["mat"], "vinyl")
    if p.get("paint"):
        return vinyl_material(p["name"], hero["colors"], p["mat"], p["paint"])
    if p["mat"] not in cache:
        if fin == "vinyl":
            cache[p["mat"]] = vinyl_material(p["mat"], hero["colors"], p["mat"])
        else:
            cache[p["mat"]] = finish_material(p["mat"], hero["colors"], p["mat"], fin, images)
    return cache[p["mat"]]
