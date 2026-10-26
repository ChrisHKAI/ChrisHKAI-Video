"""Builds the world in Blender from build/anim.json and renders it with Cycles.

Every panel is a floating slab of black glossy glass with the UI as emission;
the fighters are smooth toy parts parented to their hero empty, plus the
plastic beads they burst into; the beam, spout, sparks, glyphs and the solid
title are keyed from the same timeline. Keys go straight into the F-curves.

usage:
  blender -b --factory-startup -P scripts/scene.py -- \
      [--frames 1-576 | --frames 13,49,121] [--samples 128] [--scale 100] \
      [--out build/render] [--save build/scene.blend] [--engine cycles|eevee]
"""
import json
import math
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from bpy_extras import anim_utils
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


DATA = json.loads((ROOT / "build/anim.json").read_text())
SAMPLES = int(arg("--samples", 128))
SCALE = int(arg("--scale", 100))
OUT = ROOT / arg("--out", "build/render")
ENGINE = arg("--engine", "cycles")
SUB = DATA["sub"]
SC = DATA["scalars"]


def srgb_to_linear(c):
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def hexrgb(hex_):
    h = hex_.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def rgba(hex_, k=1.0):
    r, g, b = srgb_to_linear(hexrgb(hex_))
    return (r * k, g * k, b * k, 1.0)


# ── Scene ───────────────────────────────────────────────────────────────────
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
if ENGINE == "eevee":
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = SAMPLES
else:
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "METAL"
    scene.cycles.device = "GPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.015
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 5
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.blur_glossy = 0.5
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = SCALE
scene.render.fps = DATA["fps"]
scene.frame_start = 1
scene.frame_end = DATA["frames"]
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.5
scene.render.motion_blur_position = "CENTER"
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "8"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = float(arg("--exposure", 0.0))
scene.render.use_persistent_data = True

# the world: a cool dark void for the camera, a dim cool bounce for light
world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
wn.clear()
w_out = wn.new("ShaderNodeOutputWorld")
w_mix = wn.new("ShaderNodeMixShader")
w_light = wn.new("ShaderNodeBackground")
w_light.inputs["Color"].default_value = rgba("#dfe6ff")
w_light.inputs["Strength"].default_value = 0.3
w_cam = wn.new("ShaderNodeBackground")
w_cam.inputs["Color"].default_value = rgba("#0d1016")
w_path = wn.new("ShaderNodeLightPath")
wl.new(w_path.outputs["Is Camera Ray"], w_mix.inputs["Fac"])
wl.new(w_light.outputs["Background"], w_mix.inputs[1])
wl.new(w_cam.outputs["Background"], w_mix.inputs[2])
wl.new(w_mix.outputs["Shader"], w_out.inputs["Surface"])

# Three.js space (+y up) → Blender (+z up): one parent turns the whole world
root = bpy.data.objects.new("THREE", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.pi / 2, 0, 0)


def sun(name, energy, color, direction, size_deg):
    data = bpy.data.lights.new(name, "SUN")
    data.energy = energy
    data.color = rgba(color)[:3]
    data.angle = math.radians(size_deg)
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.parent = root
    ob.matrix_basis = Vector(direction).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    ob.visible_glossy = False  # keep the lights out of the glass reflections
    return ob


sun("Key", 2.4, "#fff3ea", (-1.2, 2.2, 1.6), 14)
sun("Rim", 1.9, "#d6e2ff", (1.4, 1.1, -1.8), 10)
sun("Fill", 0.5, "#ffe2d0", (1.6, 0.8, 1.4), 30)

# ── Materials ───────────────────────────────────────────────────────────────
images = {}


def image(path, sequence=False):
    if path not in images:
        img = bpy.data.images.load(str(ROOT / path))
        if sequence:
            img.source = "SEQUENCE"
        images[path] = img
    return images[path]


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def principled(nt, base="#000000", rough=0.4, spec=0.5, coat=0.0, coat_rough=0.1):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = rgba(base)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    return p


def tex_node(nt, img, sequence=False, closest=False):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Closest" if closest else "Cubic"
    if sequence:
        t.image_user.frame_duration = DATA["frames"]
        t.image_user.frame_start = 1
        t.image_user.frame_offset = 0
        t.image_user.use_auto_refresh = True
    return t


glow_values = []  # (who, node tree, Value node) keyed per frame
split_values = []
blob_values = {}
mats = {}
EDGE = None


def edge_material():
    global EDGE
    if EDGE is None:
        EDGE, nt, out = new_mat("slab_edge")
        p = principled(nt, "#121316", 0.32, 0.5)
        p.inputs["Metallic"].default_value = 0.3
        nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return EDGE


def obj_info(nt):
    return nt.nodes.new("ShaderNodeObjectInfo")


def material(spec):
    key = json.dumps(spec, sort_keys=True)
    if key in mats:
        return mats[key]
    kind = spec["type"]
    m, nt, out = new_mat(kind + "_" + str(len(mats)))
    L = nt.links
    result = [m]
    if kind == "ui":
        p = principled(nt, "#030303", 0.3, 0.1, coat=0.3, coat_rough=0.1)
        t = tex_node(nt, image(DATA["ui"]["image"]))
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = spec.get("bright", 1.0)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        result = [m, edge_material()]
    elif kind == "atlas":
        p = principled(nt, "#020202", 0.3, 0.1, coat=0.3, coat_rough=0.1)
        # one still image, re-pointed at each frame's file before rendering it
        # (a SEQUENCE image went black now and then in long persistent-data runs)
        t = tex_node(nt, image(f"{DATA['atlas']['dir']}/0001.png"))
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = spec["strength"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind in ("hero", "bead"):
        who = spec["who"]
        key = spec.get("key", "body")
        if key == "eye":
            p = principled(nt, spec["color"], 0.16, 0.6, coat=0.7, coat_rough=0.04)
            L.new(p.outputs["BSDF"], out.inputs["Surface"])
        else:
            p = principled(nt, "#ffffff", 0.34, 0.5, coat=0.5, coat_rough=0.16)
            p.inputs["Subsurface Weight"].default_value = 0.06
            p.inputs["Subsurface Radius"].default_value = (0.003, 0.002, 0.004)
            glow = nt.nodes.new("ShaderNodeValue")
            emit = nt.nodes.new("ShaderNodeMath")
            emit.operation = "ADD"
            L.new(glow.outputs[0], emit.inputs[0])
            emit.inputs[1].default_value = 0.0
            if kind == "bead":
                info = obj_info(nt)
                col = info.outputs["Color"]
                # the bead's own flash rides in its colour's alpha
                L.new(info.outputs["Alpha"], emit.inputs[1])
            elif key == "body":
                # the other hero's colour where the hero-space coordinate < split
                tc = nt.nodes.new("ShaderNodeTexCoord")
                tc.object = objs[who]
                sep = nt.nodes.new("ShaderNodeSeparateXYZ")
                L.new(tc.outputs["Object"], sep.inputs["Vector"])
                split = nt.nodes.new("ShaderNodeValue")
                split.outputs[0].default_value = -0.06
                lo = nt.nodes.new("ShaderNodeMath")
                lo.operation = "SUBTRACT"
                L.new(split.outputs[0], lo.inputs[0])
                lo.inputs[1].default_value = 0.0012
                hi = nt.nodes.new("ShaderNodeMath")
                hi.operation = "ADD"
                L.new(split.outputs[0], hi.inputs[0])
                hi.inputs[1].default_value = 0.0012
                mr = nt.nodes.new("ShaderNodeMapRange")
                mr.interpolation_type = "SMOOTHSTEP"
                L.new(sep.outputs["XYZ"[spec["axis"]]], mr.inputs["Value"])
                L.new(lo.outputs[0], mr.inputs["From Min"])
                L.new(hi.outputs[0], mr.inputs["From Max"])
                mix = nt.nodes.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                L.new(mr.outputs["Result"], mix.inputs["Factor"])
                mix.inputs[6].default_value = rgba(spec["other"])
                mix.inputs[7].default_value = rgba(spec["color"])
                col = mix.outputs[2]
                split_values.append((who, nt, split))
            else:
                rgb = nt.nodes.new("ShaderNodeRGB")
                rgb.outputs[0].default_value = rgba(spec["color"])
                col = rgb.outputs[0]
            L.new(col, p.inputs["Base Color"])
            L.new(col, p.inputs["Emission Color"])
            L.new(emit.outputs[0], p.inputs["Emission Strength"])
            L.new(p.outputs["BSDF"], out.inputs["Surface"])
            glow_values.append((who, nt, glow))
    elif kind == "water":
        info = obj_info(nt)
        p = principled(nt, "#ffffff", 0.06, 0.5)
        L.new(info.outputs["Color"], p.inputs["Base Color"])
        p.inputs["Transmission Weight"].default_value = 0.55
        p.inputs["IOR"].default_value = 1.33
        L.new(info.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = spec["strength"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "title":
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tc.object = objs["title"]
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        L.new(tc.outputs["Object"], sep.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = -0.24
        mr.inputs["From Max"].default_value = 0.24
        L.new(sep.outputs["X"], mr.inputs["Value"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = rgba("#D97757")
        ramp.color_ramp.elements[1].color = rgba("#4D6BFE")
        ramp.color_ramp.elements.new(0.5).color = rgba("#A070C0")
        L.new(mr.outputs["Result"], ramp.inputs["Fac"])
        p = principled(nt, "#ffffff", 0.3, 0.5, coat=0.6, coat_rough=0.1)
        L.new(ramp.outputs["Color"], p.inputs["Base Color"])
        L.new(ramp.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.3
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "glowVoxel":
        info = obj_info(nt)
        e = nt.nodes.new("ShaderNodeEmission")
        L.new(info.outputs["Color"], e.inputs["Color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "glow":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba(spec["color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "glyph":
        e = nt.nodes.new("ShaderNodeEmission")
        t = tex_node(nt, image(spec["image"]))
        L.new(t.outputs["Color"], e.inputs["Color"])
        e.inputs["Strength"].default_value = 2.2
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mix = nt.nodes.new("ShaderNodeMixShader")
        L.new(t.outputs["Alpha"], mix.inputs["Fac"])
        L.new(tr.outputs["BSDF"], mix.inputs[1])
        L.new(e.outputs["Emission"], mix.inputs[2])
        L.new(mix.outputs["Shader"], out.inputs["Surface"])
    elif kind == "keycap":
        p = principled(nt, "#dddfe6", 0.35, 0.5, coat=0.4)
        t = tex_node(nt, image(spec["image"]))
        L.new(t.outputs["Color"], p.inputs["Base Color"])
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.35
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        side, snt, sout = new_mat("keycap_side")
        sp = principled(snt, "#b9bcc6", 0.4, 0.5)
        snt.links.new(sp.outputs["BSDF"], sout.inputs["Surface"])
        result = [side, m]
    elif kind == "floor":
        e = nt.nodes.new("ShaderNodeEmission")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (2.4, 2.4, 2.4)
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].color = rgba("#0d1016")
        cr.elements[1].color = rgba("#232b3c")
        cr.elements.new(0.55).color = rgba("#151a24")
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        L.new(mp.outputs["Vector"], grad.inputs["Vector"])
        L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
        L.new(ramp.outputs["Color"], e.inputs["Color"])
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind in ("blob", "slabShadow"):
        p = principled(nt, "#000000", 0.6, 0.0)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        if kind == "blob":
            grad = nt.nodes.new("ShaderNodeTexGradient")
            grad.gradient_type = "SPHERICAL"
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Location"].default_value = (-1, -1, 0)
            mp.inputs["Scale"].default_value = (2, 2, 1)
            L.new(tc.outputs["UV"], mp.inputs["Vector"])
            L.new(mp.outputs["Vector"], grad.inputs["Vector"])
            ramp = nt.nodes.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
            ramp.color_ramp.elements[1].position = 0.9
            ramp.color_ramp.elements[1].color = (0.8, 0.8, 0.8, 1)
            L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
            k = nt.nodes.new("ShaderNodeMath")
            k.operation = "MULTIPLY"
            L.new(ramp.outputs["Color"], k.inputs[0])
            L.new(k.outputs["Value"], p.inputs["Alpha"])
            blob_values[spec["who"]] = (nt, k)
        else:
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            L.new(tc.outputs["UV"], sep.inputs["Vector"])
            edge = []
            for axis in ("X", "Y"):
                a = nt.nodes.new("ShaderNodeMath")
                a.operation = "SUBTRACT"
                a.inputs[1].default_value = 0.5
                L.new(sep.outputs[axis], a.inputs[0])
                b = nt.nodes.new("ShaderNodeMath")
                b.operation = "ABSOLUTE"
                L.new(a.outputs["Value"], b.inputs[0])
                edge.append(b)
            mx = nt.nodes.new("ShaderNodeMath")
            mx.operation = "MAXIMUM"
            L.new(edge[0].outputs["Value"], mx.inputs[0])
            L.new(edge[1].outputs["Value"], mx.inputs[1])
            mr = nt.nodes.new("ShaderNodeMapRange")
            mr.interpolation_type = "SMOOTHSTEP"
            mr.inputs["From Min"].default_value = 0.5
            mr.inputs["From Max"].default_value = 0.32
            mr.inputs["To Max"].default_value = 0.7
            L.new(mx.outputs["Value"], mr.inputs["Value"])
            L.new(mr.outputs["Result"], p.inputs["Alpha"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    else:
        raise ValueError(kind)
    mats[key] = result
    return result


# ── Geometry ────────────────────────────────────────────────────────────────
MM = 0.001


def mesh_from(name, verts, faces, uvs=None, mat_index=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs[me.loops[li].vertex_index]
    if mat_index:
        for i, poly in enumerate(me.polygons):
            poly.material_index = mat_index(i, poly)
    me.update()
    return me


def box_faces():
    return [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)]


def box_verts(sx, sy, sz, y0=None):
    lo_y = -sy / 2 if y0 is None else y0
    hi_y = sy / 2 if y0 is None else y0 + sy
    return [(x, y, z) for z in (-sz / 2, sz / 2) for y in (lo_y, hi_y) for x in (-sx / 2, sx / 2)]


def round_box_mesh(name, size, radius):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=radius, segments=5, profile=0.5, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(30))
    return me


def sphere_mesh(name, r=(1, 1, 1), u=48, v=28):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
    for vt in bm.verts:
        vt.co.x *= r[0]
        vt.co.y *= r[1]
        vt.co.z *= r[2]
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def cyl_mesh(name):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.5, radius2=0.5, depth=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(50))
    return me


def arc_mesh(name, R, r, arc):
    n, m = 24, 12
    verts, faces = [], []
    for i in range(n + 1):
        th = arc * i / n
        for j in range(m):
            ph = 2 * math.pi * j / m
            verts.append(((R + r * math.cos(ph)) * math.cos(th), (R + r * math.cos(ph)) * math.sin(th), r * math.sin(ph)))
    for i in range(n):
        for j in range(m):
            a, b = i * m + j, i * m + (j + 1) % m
            faces.append((a, b, b + m, a + m))
    me = mesh_from(name, verts, faces)
    me.shade_smooth()
    return me


def octa_mesh(name, r, flat=1.0):
    verts = [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r * flat), (0, 0, -r * flat)]
    faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    return mesh_from(name, verts, faces)


def star_mesh(name, r):
    verts, faces = [(0, 0, r * 0.35), (0, 0, -r * 0.35)], []
    for k in range(10):
        a = math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.42
        verts.append((rr * math.cos(a), rr * math.sin(a), 0))
    for k in range(10):
        a, b = 2 + k, 2 + (k + 1) % 10
        faces += [(0, a, b), (1, b, a)]
    return mesh_from(name, verts, faces)


mesh_cache = {}


def build_geo(o):
    g = o["geo"]
    t = g["type"]
    if t in ("orb", "cyl", "octa", "star"):
        key = (t, json.dumps(o["mat"], sort_keys=True), g.get("r"))
        if key not in mesh_cache:
            me = (sphere_mesh(o["name"], u=20, v=12) if t == "orb" else cyl_mesh(o["name"]) if t == "cyl"
                  else octa_mesh(o["name"], g["r"] if "r" in g else 0.0016) if t == "octa" else star_mesh(o["name"], g["r"]))
            for mat in material(o["mat"]):
                me.materials.append(mat)
            mesh_cache[key] = me
        return mesh_cache[key], False
    if t == "roundBox":
        me = round_box_mesh(o["name"], g["size"], g["radius"])
    elif t == "ellipsoid":
        me = sphere_mesh(o["name"], g["r"])
    elif t == "arc":
        me = arc_mesh(o["name"], g["radius"], g["tube"], g["arc"])
    elif t == "uiBox":
        r = g["rect"]
        w, d, th = r[2] * MM, r[3] * MM, g["thickness"]
        verts = box_verts(w, th, d, y0=-th)
        uvs = [((r[0] + (v[0] + w / 2) / MM) / DATA["ui"]["w"], 1 - (r[1] + (v[2] + d / 2) / MM) / DATA["ui"]["h"]) for v in verts]
        me = mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 0 if i == 3 else 1)
    elif t == "plane":
        w, h = g["w"], g["h"]
        verts = [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)]
        if "uv" in g:
            u0, v0, u1, v1 = g["uv"]  # pixel-space fractions, v from the top
            uvs = [(u0, 1 - v1), (u1, 1 - v1), (u1, 1 - v0), (u0, 1 - v0)]
        else:
            uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        me = mesh_from(o["name"], verts, [(0, 1, 2, 3)], uvs)
    elif t == "box":
        sx, sy, sz = g["size"]
        verts = box_verts(sx, sy, sz)
        if g.get("topImage"):
            uvs = [((v[0] + sx / 2) / sx, 1 - (v[2] + sz / 2) / sz) for v in verts]
            me = mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 1 if i == 3 else 0)
        else:
            me = mesh_from(o["name"], verts, box_faces())
    else:
        raise ValueError(t)
    for mat in material(o["mat"]) if o.get("mat") else []:
        me.materials.append(mat)
    return me, True


# ── Keys straight into the F-curves ─────────────────────────────────────────
_bags = {}


def channelbag(idblock):
    if idblock.as_pointer() in _bags:  # one action per datablock, however many curves
        return _bags[idblock.as_pointer()]
    idblock.animation_data_create()
    act = bpy.data.actions.new(idblock.name + "_act")
    idblock.animation_data.action = act
    slot = idblock.animation_data.action_slot
    if slot is None:
        slot = act.slots.new(id_type=idblock.id_type, name=idblock.name)
        idblock.animation_data.action_slot = slot
    _bags[idblock.as_pointer()] = anim_utils.action_ensure_channelbag_for_slot(act, slot)
    return _bags[idblock.as_pointer()]


LINEAR = bpy.types.Keyframe.bl_rna.properties["interpolation"].enum_items["LINEAR"].value
CONSTANT = bpy.types.Keyframe.bl_rna.properties["interpolation"].enum_items["CONSTANT"].value


def curve(cb, path, index, frames, values, interp=LINEAR):
    fc = cb.fcurves.new(path, index=index)
    n = len(frames)
    fc.keyframe_points.add(n)
    co = np.empty(2 * n, dtype=np.float32)
    co[0::2] = frames
    co[1::2] = values
    fc.keyframe_points.foreach_set("co", co)
    fc.keyframe_points.foreach_set("interpolation", np.full(n, interp, dtype=np.int32))
    fc.update()


def set_trs(ob, tr):
    ob.location = tr[0:3]
    ob.rotation_quaternion = (tr[6], tr[3], tr[4], tr[5])
    ob.scale = tr[7:10]


# ── Objects ─────────────────────────────────────────────────────────────────
objs = {"root": root}
t0 = time.time()
for o in DATA["objects"]:
    name = o["name"]
    if o.get("camera"):
        cam = bpy.data.cameras.new("Camera")
        cam.sensor_fit = "VERTICAL"
        cam.sensor_height = 24
        cam.clip_start = 0.005
        cam.clip_end = 30
        cam.dof.use_dof = True
        cam.dof.aperture_blades = 7
        ob = bpy.data.objects.new("Camera", cam)
        scene.camera = ob
    elif o.get("light"):
        ld = bpy.data.lights.new(name, "POINT")
        ld.shadow_soft_size = 0.008
        ld.energy = 0
        ob = bpy.data.objects.new(name, ld)
        ob.visible_glossy = False
    elif o["geo"] is None:
        ob = bpy.data.objects.new(name, None)
    elif o["geo"]["type"] == "text":
        g = o["geo"]
        cu = bpy.data.curves.new(name, "FONT")
        cu.body = g["text"]
        cu.font = bpy.data.fonts.load(g["font"], check_existing=True)
        cu.size = g["size"]
        cu.extrude = 0.009
        cu.bevel_depth = 0.0025
        cu.bevel_resolution = 4
        cu.align_x = "CENTER"
        cu.align_y = "BOTTOM_BASELINE"
        for mat in material(o["mat"]):
            cu.materials.append(mat)
        ob = bpy.data.objects.new(name, cu)
    else:
        me, _ = build_geo(o)
        ob = bpy.data.objects.new(name, me)
        if "color" in o:
            ob.color = (*srgb_to_linear(o["color"][:3]), o["color"][3])
    scene.collection.objects.link(ob)
    ob.parent = objs[o["parent"]]
    ob.rotation_mode = "QUATERNION"
    set_trs(ob, o["tr"])
    objs[name] = ob
# lay the title's letter slots out by the letters' own widths
slots = sorted((o for o in DATA["objects"] if "slot" in o), key=lambda o: o["slot"])
if slots:
    bpy.context.view_layer.update()
    widths = [objs[f"title_{o['slot']}"].dimensions.x for o in slots]
    gap = 0.012
    total = sum(widths) + gap * (len(widths) - 1)
    x = -total / 2
    for o, w in zip(slots, widths):
        objs[o["name"]].location = (x + w / 2, 0, 0)
        x += w + gap
print(f"objects built in {time.time() - t0:.1f}s", flush=True)

t0 = time.time()
for name, keys in DATA["tracks"].items():
    ob = objs[name]
    k = np.asarray(keys, dtype=np.float64)
    frames = 1 + k[:, 0] / SUB
    set_trs(ob, k[0, 1:])
    cb = channelbag(ob)
    for i in range(3):
        curve(cb, "location", i, frames, k[:, 1 + i])
    for i, c in enumerate((7, 4, 5, 6)):  # w x y z
        curve(cb, "rotation_quaternion", i, frames, k[:, c])
    for i in range(3):
        curve(cb, "scale", i, frames, k[:, 8 + i])
    if name in DATA["colors"]:
        ck = np.asarray(DATA["colors"][name], dtype=np.float64)
        cf = 1 + ck[:, 0]
        lin = np.where(ck[:, 1:4] <= 0.04045, ck[:, 1:4] / 12.92, ((ck[:, 1:4] + 0.055) / 1.055) ** 2.4)
        for i in range(3):
            curve(cb, "color", i, cf, lin[:, i])
        curve(cb, "color", 3, cf, ck[:, 4])
print(f"object keys in {time.time() - t0:.1f}s", flush=True)

# camera lens / focus / f-stop every sample
cam = objs["camera"].data
cb = channelbag(cam)
fr = 1 + np.arange(DATA["samples"]) / SUB
curve(cb, "lens", 0, fr, 12 / np.tan(np.radians(np.asarray(SC["fov"])) / 2))
curve(cb, "dof.focus_distance", 0, fr, np.asarray(SC["focus"]))
curve(cb, "dof.aperture_fstop", 0, fr, np.asarray(SC["fstop"]))

# per-frame shader values and the two fx lights
ff = 1 + np.arange(DATA["frames"])
for who, nt, node in glow_values:
    curve(channelbag(nt), f'nodes["{node.name}"].outputs[0].default_value', 0, ff, np.asarray(SC[f"glow_{who}"]))
for who, nt, node in split_values:
    curve(channelbag(nt), f'nodes["{node.name}"].outputs[0].default_value', 0, ff, np.asarray(SC[f"split_{who}"]))
for who, (nt, node) in blob_values.items():
    curve(channelbag(nt), f'nodes["{node.name}"].inputs[1].default_value', 0, ff, np.asarray(SC[f"blob_{who}"]))
for name in ("fxA", "fxB"):
    ld = objs[name].data
    cb = channelbag(ld)
    curve(cb, "energy", 0, ff, np.asarray(SC[f"{name}_energy"]))
    cols = np.asarray(SC[f"{name}_color"])
    for i in range(3):
        curve(cb, "color", i, ff, cols[:, i])

print(f"built: {len(objs)} objects, {len(DATA['tracks'])} animated", flush=True)
if "--save" in argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / arg("--save", "build/scene.blend")))

# ── Render ──────────────────────────────────────────────────────────────────
spec = arg("--frames", None)
if spec:
    OUT.mkdir(parents=True, exist_ok=True)
    if "-" in spec and "," not in spec:
        a, b = map(int, spec.split("-"))
        frames = list(range(a, b + 1))
    else:
        frames = [int(x) for x in spec.split(",")]
    atlas = images[f"{DATA['atlas']['dir']}/0001.png"]
    for f in frames:
        t0 = time.time()
        atlas.filepath = str(ROOT / f"{DATA['atlas']['dir']}/{f:04d}.png")
        atlas.reload()
        scene.frame_set(f)
        scene.render.filepath = str(OUT / f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"rendered frame {f} in {time.time() - t0:.1f}s", flush=True)
