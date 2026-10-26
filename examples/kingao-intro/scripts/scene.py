"""Builds the world in Blender from build/anim.json and renders it with Cycles.

Kin's X profile is a set of floating slabs of black glossy glass with the UI
as emission; the avatar is a round photo card; the calico and every other toy
are smooth vinyl parts (scripts/toy.py) under one empty each. Keys go straight
into the F-curves.

usage:
  blender -b --factory-startup -P scripts/scene.py -- \
      [--frames 1-900 | --frames 13,49,121] [--samples 128] [--scale 100] \
      [--out build/render] [--save build/scene.blend] [--engine cycles|eevee] [--no-blur]
      [--anim build/anim.json]
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
sys.path.insert(0, str(ROOT / "scripts"))
from toy import part_mesh, rgba, round_box_mesh, vinyl_material  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


DATA = json.loads((ROOT / arg("--anim", "build/anim.json")).read_text())
SAMPLES = int(arg("--samples", 128))
SCALE = int(arg("--scale", 100))
OUT = ROOT / arg("--out", "build/render")
ENGINE = arg("--engine", "cycles")
SUB = DATA["sub"]
SC = DATA["scalars"]
PALETTE = DATA["palette"]

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
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.blur_glossy = 0.5
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = SCALE
scene.render.fps = DATA["fps"]
scene.frame_start = 1
scene.frame_end = DATA["frames"]
scene.render.use_motion_blur = "--no-blur" not in argv
scene.render.motion_blur_shutter = 0.5
scene.render.motion_blur_position = "CENTER"
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "8"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = float(arg("--exposure", 0.0))
scene.render.use_persistent_data = True

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
wn.clear()
w_out = wn.new("ShaderNodeOutputWorld")
w_mix = wn.new("ShaderNodeMixShader")
w_light = wn.new("ShaderNodeBackground")
w_light.inputs["Color"].default_value = rgba("#dfe6ff")
w_light.inputs["Strength"].default_value = 0.32
w_cam = wn.new("ShaderNodeBackground")
w_cam.inputs["Color"].default_value = rgba("#08090c")
w_path = wn.new("ShaderNodeLightPath")
wl.new(w_path.outputs["Is Camera Ray"], w_mix.inputs["Fac"])
wl.new(w_light.outputs["Background"], w_mix.inputs[1])
wl.new(w_cam.outputs["Background"], w_mix.inputs[2])
wl.new(w_mix.outputs["Shader"], w_out.inputs["Surface"])

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
    ob.visible_glossy = False
    return ob


sun("Key", 2.5, "#fff3ea", (-1.2, 2.2, 1.6), 14)
sun("Rim", 2.0, "#d6e2ff", (1.4, 1.1, -1.8), 10)
sun("Fill", 0.55, "#ffe2d0", (1.6, 0.8, 1.4), 30)

# ── Materials ───────────────────────────────────────────────────────────────
images = {}


def image(path, colorspace="sRGB"):
    if path not in images:
        img = bpy.data.images.load(str(ROOT / path))
        img.colorspace_settings.name = colorspace
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


def tex_node(nt, img, extension="REPEAT"):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Cubic"
    t.extension = extension
    return t


keyed = []  # (scalar name, node tree, node)
mats = {}
_edge = None


def edge_material():
    global _edge
    if _edge is None:
        _edge, nt, out = new_mat("slab_edge")
        p = principled(nt, "#121316", 0.32, 0.5)
        p.inputs["Metallic"].default_value = 0.3
        nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return _edge


def material(spec):
    key = json.dumps(spec, sort_keys=True)
    if key in mats:
        return mats[key]
    kind = spec["type"]
    if kind == "vinyl":
        mats[key] = [vinyl_material(f"vinyl_{len(mats)}", PALETTE, spec["base"], spec["paint"])]
        return mats[key]
    m, nt, out = new_mat(kind + "_" + str(len(mats)))
    L = nt.links
    result = [m]
    if kind in ("ui", "photo"):
        p = principled(nt, "#030303", 0.3, 0.1, coat=0.3 if kind == "ui" else 0.5, coat_rough=0.1 if kind == "ui" else 0.06)
        t = tex_node(nt, image(spec["image"]), "EXTEND" if kind == "ui" else "CLIP")
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 1.0
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        result = [m, edge_material()]
    elif kind == "floor":  # black glass that mirrors a little, fading out far away
        tc = nt.nodes.new("ShaderNodeTexCoord")
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.42, 0.42, 0.42)
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        L.new(mp.outputs["Vector"], grad.inputs["Vector"])
        p = principled(nt, "#0a0b0f", 0.3, 0.45, coat=0.3, coat_rough=0.25)
        dark = nt.nodes.new("ShaderNodeBsdfDiffuse")
        dark.inputs["Color"].default_value = rgba("#000000")
        mx = nt.nodes.new("ShaderNodeMixShader")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        ramp.color_ramp.elements[1].position = 0.55
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
        L.new(ramp.outputs["Color"], mx.inputs["Fac"])
        L.new(dark.outputs["BSDF"], mx.inputs[1])
        L.new(p.outputs["BSDF"], mx.inputs[2])
        L.new(mx.outputs["Shader"], out.inputs["Surface"])
    elif kind in ("screen", "bubble"):  # a phone screen / a chat bubble: the picture, lit, under a clear coat
        t = tex_node(nt, image(spec["image"]), "EXTEND")
        screen = kind == "screen"
        p = principled(nt, "#030303" if screen else "#ffffff", 0.3, 0.3, coat=0.6, coat_rough=0.05)
        if not screen:
            L.new(t.outputs["Color"], p.inputs["Base Color"])
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.8 if screen else 0.3
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneBody":
        p = principled(nt, "#111216", 0.25, 0.5, coat=0.6, coat_rough=0.08)
        p.inputs["Metallic"].default_value = 0.4
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "glass":  # the bar chart: dark glossy glass
        p = principled(nt, "#0d1016", 0.14, 0.6, coat=0.9, coat_rough=0.04)
        p.inputs["Metallic"].default_value = 0.2
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "glow":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba(spec["color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "type":  # 3D lettering: glossy, lit a little from inside
        p = principled(nt, spec["color"], 0.22, 0.5, coat=0.8, coat_rough=0.05)
        p.inputs["Emission Color"].default_value = rgba(spec["color"])
        p.inputs["Emission Strength"].default_value = spec["emit"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "paper":  # torn labels: matte paper with a little grain
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 900.0
        nz.inputs["Detail"].default_value = 6.0
        L.new(tc.outputs["Object"], nz.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.88
        mr.inputs["To Max"].default_value = 1.04
        L.new(nz.outputs["Fac"], mr.inputs["Value"])
        tint = nt.nodes.new("ShaderNodeMix")
        tint.data_type = "RGBA"
        tint.blend_type = "MULTIPLY"
        tint.inputs["Factor"].default_value = 1.0
        tint.inputs[6].default_value = rgba(spec["color"])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        for ch in ("Red", "Green", "Blue"):
            L.new(mr.outputs["Result"], comb.inputs[ch])
        L.new(comb.outputs["Color"], tint.inputs[7])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.08
        L.new(nz.outputs["Fac"], bump.inputs["Height"])
        p = principled(nt, "#ffffff", 0.82, 0.3)
        L.new(tint.outputs[2], p.inputs["Base Color"])
        L.new(tint.outputs[2], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.12
        L.new(bump.outputs["Normal"], p.inputs["Normal"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "matteBlack":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#000000")
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "puff":
        p = principled(nt, "#ffffff", 0.9, 0.2)
        p.inputs["Emission Color"].default_value = rgba("#fff6ec")
        p.inputs["Emission Strength"].default_value = 0.5
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "flake":
        info = nt.nodes.new("ShaderNodeObjectInfo")
        p = principled(nt, "#ffffff", 0.45, 0.5, coat=0.3)
        L.new(info.outputs["Color"], p.inputs["Base Color"])
        L.new(info.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.2
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "spark":
        info = nt.nodes.new("ShaderNodeObjectInfo")
        e = nt.nodes.new("ShaderNodeEmission")
        L.new(info.outputs["Color"], e.inputs["Color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "blob":
        p = principled(nt, "#000000", 0.6, 0.0)
        tc = nt.nodes.new("ShaderNodeTexCoord")
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
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        if spec.get("fixed"):
            k.inputs[1].default_value = spec["fixed"]
        else:
            keyed.append(("blob", nt, k))
    else:
        raise ValueError(kind)
    mats[key] = result
    return result


# ── Geometry ────────────────────────────────────────────────────────────────
def mesh_from(name, verts, faces, uvs=None, mat_index=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                layer.data[li].uv = uvs[vi] if not callable(uvs) else uvs(poly, vi)
    if mat_index:
        for i, poly in enumerate(me.polygons):
            poly.material_index = mat_index(i, poly)
    me.update()
    return me


def outward(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return me


def box_faces():
    return [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)]


def box_verts(x0, x1, y0, y1, z0, z1):
    return [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]


def sphere_mesh(name, r=(1, 1, 1), u=24, v=14):
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


def octa_mesh(name, r):
    verts = [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r)]
    faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    return mesh_from(name, verts, faces)


def disc_mesh(name, r, depth, ring, n=96):
    """A round card: the photo on the front (z+), inset by the ring."""
    verts, faces, uv = [], [], {}
    for k, z in enumerate((-depth / 2, depth / 2)):
        for j in range(n):
            a = 2 * math.pi * j / n
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for j in range(n):
        j2 = (j + 1) % n
        faces.append((j, j2, n + j2, n + j))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range(n, 2 * n)))
    k = 0.5 * r / (r - ring)
    uvs = [(0.5 + k * x / r, 0.5 + k * y / r) for x, y, _ in verts]
    me = mesh_from(name, verts, faces, uvs, mat_index=lambda i, p: 0 if i == len(faces) - 1 else 1)
    for p in me.polygons:
        p.use_smooth = len(p.vertices) == 4
    return outward(me)


mesh_cache = {}


def build_geo(o):
    g = o["geo"]
    t = g["type"]
    if t in ("octa", "box", "ellipsoid") and o["mat"]["type"] in ("flake", "spark", "puff"):
        key = (t, json.dumps(g, sort_keys=True), json.dumps(o["mat"], sort_keys=True))
        if key not in mesh_cache:
            me = octa_mesh(o["name"], g["r"]) if t == "octa" else sphere_mesh(o["name"], g["r"]) if t == "ellipsoid" else outward(mesh_from(o["name"], box_verts(*[v for s in g["size"] for v in (-s / 2, s / 2)]), box_faces()))
            for mat in material(o["mat"]):
                me.materials.append(mat)
            mesh_cache[key] = me
        return mesh_cache[key]
    if t == "toyPart":
        me = part_mesh(g["part"])
    elif t == "uiBox":
        w, h, th = g["w"], g["h"], g["thickness"]
        ux, uy, uw, uh = g["uvRect"]
        W, H = g["img"]["w"], g["img"]["h"]
        verts = box_verts(-w / 2, w / 2, -h / 2, h / 2, -th, 0)
        uvs = [((ux + (v[0] + w / 2) / w * uw) / W, 1 - (uy + (h / 2 - v[1]) / h * uh) / H) for v in verts]
        me = outward(mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 0 if i == 5 else 1))
    elif t == "roundBox":
        me = round_box_mesh(o["name"], g["size"], g["radius"])
    elif t == "roundCard":  # a rounded slab with its picture projected on the front
        sx, sy, sz = g["size"]
        me = round_box_mesh(o["name"], g["size"], g["radius"])
        layer = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                co = me.vertices[me.loops[li].vertex_index].co
                layer.data[li].uv = (co.x / sx + 0.5, co.y / sy + 0.5)
    elif t == "disc":
        me = disc_mesh(o["name"], g["r"], g["depth"], g["ring"])
    elif t == "plane":
        w, h = g["w"], g["h"]
        verts = [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)]
        me = mesh_from(o["name"], verts, [(0, 1, 2, 3)], [(0, 0), (1, 0), (1, 1), (0, 1)])
    elif t == "ellipsoid":
        me = sphere_mesh(o["name"], g["r"])
    else:
        raise ValueError(t)
    for mat in material(o["mat"]) if o.get("mat") else []:
        me.materials.append(mat)
    return me


def curve_piece(o):
    g = o["geo"]
    cu = bpy.data.curves.new(o["name"], "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = g["depth"] / 2
    cu.bevel_depth = g.get("bevel", 0.0005)
    cu.bevel_resolution = 2
    cu.resolution_u = 1
    for ring in g["rings"]:
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for p, (x, y) in zip(sp.points, ring):
            p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    for mat in material(o["mat"]):
        cu.materials.append(mat)
    return cu


# ── Keys straight into the F-curves ─────────────────────────────────────────
_bags = {}


def channelbag(idblock):
    if idblock.as_pointer() in _bags:
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
        cam.clip_end = 40
        cam.dof.use_dof = True
        cam.dof.aperture_blades = 7
        ob = bpy.data.objects.new("Camera", cam)
        scene.camera = ob
    elif o.get("light"):
        ld = bpy.data.lights.new(name, "POINT")
        ld.shadow_soft_size = 0.02
        ld.energy = 0
        ob = bpy.data.objects.new(name, ld)
        ob.visible_glossy = False
    elif o["geo"] is None:
        ob = bpy.data.objects.new(name, None)
    elif o["geo"]["type"] == "curve":
        ob = bpy.data.objects.new(name, curve_piece(o))
    else:
        ob = bpy.data.objects.new(name, build_geo(o))
    scene.collection.objects.link(ob)
    ob.parent = objs[o["parent"]]
    ob.rotation_mode = "QUATERNION"
    set_trs(ob, o["tr"])
    objs[name] = ob
    if name.startswith(("blob", "puff")) or name.endswith("_blob"):
        ob.visible_shadow = False
print(f"objects built in {time.time() - t0:.1f}s", flush=True)

t0 = time.time()
STEP = {o["name"] for o in DATA["objects"] if o.get("step")}  # digits that swap: no in-between
for name, keys in DATA["tracks"].items():
    ob = objs[name]
    k = np.asarray(keys, dtype=np.float64)
    frames = 1 + k[:, 0] / SUB
    set_trs(ob, k[0, 1:])
    cb = channelbag(ob)
    it = CONSTANT if name in STEP else LINEAR
    for i in range(3):
        curve(cb, "location", i, frames, k[:, 1 + i], it)
    for i, c in enumerate((7, 4, 5, 6)):  # w x y z
        curve(cb, "rotation_quaternion", i, frames, k[:, c], it)
    for i in range(3):
        curve(cb, "scale", i, frames, k[:, 8 + i], it)
    if name in DATA["colors"]:
        ck = np.asarray(DATA["colors"][name], dtype=np.float64)
        cf = 1 + ck[:, 0]
        lin = np.where(ck[:, 1:4] <= 0.04045, ck[:, 1:4] / 12.92, ((ck[:, 1:4] + 0.055) / 1.055) ** 2.4)
        for i in range(3):
            curve(cb, "color", i, cf, lin[:, i])
        curve(cb, "color", 3, cf, ck[:, 4])
print(f"object keys in {time.time() - t0:.1f}s", flush=True)

cam = objs["camera"].data
cb = channelbag(cam)
fr = 1 + np.arange(len(SC["fov"])) / SUB
curve(cb, "lens", 0, fr, 12 / np.tan(np.radians(np.asarray(SC["fov"])) / 2))
curve(cb, "dof.focus_distance", 0, fr, np.asarray(SC["focus"]))
curve(cb, "dof.aperture_fstop", 0, fr, np.asarray(SC["fstop"]))

ff = 1 + np.arange(len(SC["blob"]))
for name, nt, node in keyed:
    path = f'nodes["{node.name}"].inputs[1].default_value'
    curve(channelbag(nt), path, 0, ff, np.asarray(SC[name]))
ld = objs["fx"].data
cb = channelbag(ld)
curve(cb, "energy", 0, ff, np.asarray(SC["fx_energy"]))
cols = np.asarray(SC["fx_color"])
for i in range(3):
    curve(cb, "color", i, ff, cols[:, i])

# look-dev: --hide name_,label leaves those objects out of the render (background plates)
for prefix in arg("--hide", "").split(","):
    if prefix:
        for name, ob in objs.items():
            if name.startswith(prefix):
                ob.hide_render = True
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
    for f in frames:
        t0 = time.time()
        scene.frame_set(f)
        scene.render.filepath = str(OUT / f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"rendered frame {f} in {time.time() - t0:.1f}s", flush=True)
