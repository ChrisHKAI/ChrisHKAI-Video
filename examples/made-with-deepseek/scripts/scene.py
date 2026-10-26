"""Builds the world in Blender from build/anim.json and renders it with Cycles.

Every panel is a floating slab of black glossy glass with the UI as emission;
the whale, the comp and every move come from the same timeline as the preview.

usage:
  blender -b --factory-startup -P scripts/scene.py -- \
      [--frames 1-361 | --frames 13,49,121] [--samples 128] [--scale 100] \
      [--out build/render] [--save build/scene.blend] [--view agx|standard]
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parent.parent
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


DATA = json.loads((ROOT / "build/anim.json").read_text())
SAMPLES = int(arg("--samples", 128))
SCALE = int(arg("--scale", 100))
OUT = ROOT / arg("--out", "build/render")
VIEW = arg("--view", "standard")
MM = 0.001
UI_EMIT = 1.0
SUB = DATA["sub"]


def srgb_to_linear(hex_):
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def rgba(hex_, k=1.0):
    r, g, b = srgb_to_linear(hex_)
    return (r * k, g * k, b * k, 1.0)


# ── Scene ───────────────────────────────────────────────────────────────────
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
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
scene.cycles.transmission_bounces = 4
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
if VIEW == "agx":
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = arg("--look", "AgX - Punchy")
else:
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
scene.view_settings.exposure = float(arg("--exposure", 0.0))
scene.render.use_persistent_data = True
bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"

# the world: the warm studio void for the camera, a dim warm bounce for light
world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes
wl = world.node_tree.links
wn.clear()
w_out = wn.new("ShaderNodeOutputWorld")
w_mix = wn.new("ShaderNodeMixShader")
w_light = wn.new("ShaderNodeBackground")
w_light.inputs["Color"].default_value = rgba("#ffe4d2")
w_light.inputs["Strength"].default_value = 0.32
w_cam = wn.new("ShaderNodeBackground")
w_cam.inputs["Color"].default_value = rgba("#2f231d")
w_cam.inputs["Strength"].default_value = 1.0
w_path = wn.new("ShaderNodeLightPath")
wl.new(w_path.outputs["Is Camera Ray"], w_mix.inputs["Fac"])
wl.new(w_light.outputs["Background"], w_mix.inputs[1])
wl.new(w_cam.outputs["Background"], w_mix.inputs[2])
wl.new(w_mix.outputs["Shader"], w_out.inputs["Surface"])

# Three.js space (+y up) → Blender (+z up): one parent turns the whole world
root = bpy.data.objects.new("THREE", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.pi / 2, 0, 0)


def light(name, kind, energy, color, direction, size_deg=12, glossy=False):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = rgba(color)[:3]
    if kind == "SUN":
        data.angle = math.radians(size_deg)
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.parent = root
    # point the light's -Z at the origin from `direction` (Three space)
    from mathutils import Vector
    d = Vector(direction).normalized()
    ob.matrix_basis = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    ob.visible_glossy = glossy  # keep the lights out of the UI reflections
    return ob


light("Key", "SUN", 2.6, "#fff0e4", (-1.2, 2.2, 1.6), 14)
light("Rim", "SUN", 1.7, "#dbe8ff", (1.4, 1.1, -1.8), 10)

# ── Materials ───────────────────────────────────────────────────────────────
images = {}


def image(path, sequence=False):
    if path in images:
        return images[path]
    img = bpy.data.images.load(str(ROOT / path))
    if sequence:
        img.source = "SEQUENCE"
    images[path] = img
    return img


emit_keys = []  # (socket, base value, scalar name)
EDGE = None


def edge_material():
    global EDGE
    if EDGE is None:
        EDGE, nt, out = new_mat("slab_edge")
        p = principled(nt, "#141212", 0.35, 0.5)
        p.inputs["Metallic"].default_value = 0.3
        nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return EDGE
tint_keys = []  # (node, button)


def principled(nt, base="#000000", rough=0.4, spec=0.5, coat=0.0, coat_rough=0.1):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = rgba(base)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    return p


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def tex_node(nt, img, sequence=False):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Cubic"
    if sequence:
        t.image_user.frame_duration = DATA["frames"]
        t.image_user.frame_start = 1
        t.image_user.frame_offset = 0
        t.image_user.use_auto_refresh = True
    return t


def material(spec, name):
    kind = spec["type"]
    m, nt, out = new_mat(name)
    L = nt.links
    group = spec.get("emitGroup")
    if kind == "ui":
        p = principled(nt, "#030303", 0.32, 0.1, coat=0.25, coat_rough=0.12)
        t = tex_node(nt, image(DATA["ui"]["image"]))
        tint = nt.nodes.new("ShaderNodeMix")
        tint.data_type = "RGBA"
        tint.blend_type = "MULTIPLY"
        tint.inputs["Factor"].default_value = 1.0
        tint.inputs[7].default_value = (1, 1, 1, 1)  # B colour: the tint
        L.new(t.outputs["Color"], tint.inputs[6])
        L.new(tint.outputs[2], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = UI_EMIT
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        emit_keys.append((p.inputs["Emission Strength"], UI_EMIT, f"emit_{group}"))
        if spec.get("tintKey"):
            tint_keys.append((tint, spec["tintKey"]))
        return [m, edge_material()]
    elif kind in ("atlas", "atlasAlpha"):
        p = principled(nt, "#020202", 0.3, 0.1, coat=0.25, coat_rough=0.1)
        t = tex_node(nt, image(f"{DATA['atlas']['dir']}/0001.png", sequence=True), sequence=True)
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = spec["strength"]
        if kind == "atlasAlpha":
            L.new(t.outputs["Alpha"], p.inputs["Alpha"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        emit_keys.append((p.inputs["Emission Strength"], spec["strength"], f"emit_{group}"))
    elif kind == "emissive":
        p = principled(nt, spec["base"], spec["roughness"], 0.3)
        p.inputs["Emission Color"].default_value = rgba(spec["color"])
        p.inputs["Emission Strength"].default_value = spec["strength"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        if group:
            emit_keys.append((p.inputs["Emission Strength"], spec["strength"], f"emit_{group}"))
    elif kind == "light":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba(spec["color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
        if group:
            emit_keys.append((e.inputs["Strength"], spec["strength"], f"emit_{group}"))
    elif kind == "hero":
        key = spec["key"]
        if key == "eye":
            p = principled(nt, spec["color"], 0.18, 0.6, coat=0.6, coat_rough=0.05)
        else:
            p = principled(nt, spec["color"], 0.36 if key == "skin" else 0.42, 0.5, coat=0.45 if key == "skin" else 0.3, coat_rough=0.22)
            p.inputs["Subsurface Weight"].default_value = 0.08
            p.inputs["Subsurface Radius"].default_value = (0.004, 0.003, 0.006)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "floor":
        e = nt.nodes.new("ShaderNodeEmission")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (2.2, 2.2, 2.2)
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].position = 0.0
        cr.elements[0].color = rgba("#2f231d")
        cr.elements[1].position = 1.0
        cr.elements[1].color = rgba("#5a4336")
        mid = cr.elements.new(0.55)
        mid.color = rgba("#3f2e25")
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        L.new(mp.outputs["Vector"], grad.inputs["Vector"])
        L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
        L.new(ramp.outputs["Color"], e.inputs["Color"])
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind in ("blob", "slabShadow"):
        # soft black, opaque in the middle: it hides the emission beneath
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
            k.inputs[1].default_value = 1.0
            L.new(ramp.outputs["Color"], k.inputs[0])
            L.new(k.outputs["Value"], p.inputs["Alpha"])
            globals()["BLOB_OPACITY"] = k.inputs[1]
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
    elif kind == "image":
        p = principled(nt, "#000000", 0.5, 0.3)
        t = tex_node(nt, image(spec["image"]))
        L.new(t.outputs["Color"], p.inputs["Base Color"])
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        L.new(t.outputs["Alpha"], p.inputs["Alpha"])
        p.inputs["Emission Strength"].default_value = spec["strength"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "chip":
        p = principled(nt, "#0a0a0a", 0.3, 0.3)
        t = tex_node(nt, image(spec["image"]))
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 1.3
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        side, snt, sout = new_mat(name + "_side")
        sp = principled(snt, "#1d4f92", 0.3, 0.3)
        sp.inputs["Emission Color"].default_value = rgba("#2f6fbf")
        sp.inputs["Emission Strength"].default_value = 0.6
        snt.links.new(sp.outputs["BSDF"], sout.inputs["Surface"])
        return [side, m]
    elif kind == "glass":
        p = principled(nt, "#dfeaff", 0.05, 0.5)
        p.inputs["Transmission Weight"].default_value = 1.0
        p.inputs["IOR"].default_value = 1.45
        p.inputs["Emission Color"].default_value = rgba("#9fbfff")
        p.inputs["Emission Strength"].default_value = 0.25
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    else:
        raise ValueError(kind)
    return [m]


# ── Geometry ────────────────────────────────────────────────────────────────
def mesh_from(name, verts, faces, uvs=None, mat_index=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                layer.data[li].uv = uvs[me.loops[li].vertex_index] if isinstance(uvs, list) else uvs(poly, me.loops[li].vertex_index)
    if mat_index:
        for i, poly in enumerate(me.polygons):
            poly.material_index = mat_index(i, poly)
    if smooth:
        me.shade_smooth()
    me.update()
    return me


def box_faces():
    # 8 corners: index = x + 2y + 4z bits; outward winding
    return [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)]


def box_verts(sx, sy, sz, y0=None):
    lo_y = -sy / 2 if y0 is None else y0
    hi_y = sy / 2 if y0 is None else y0 + sy
    return [(x, y, z) for z in (-sz / 2, sz / 2) for y in (lo_y, hi_y) for x in (-sx / 2, sx / 2)]


def build_geo(o):
    g = o["geo"]
    t = g["type"]
    if t == "uiBox":
        r = g["rect"]
        w, d, th = r[2] * MM, r[3] * MM, g["thickness"]
        verts = box_verts(w, th, d, y0=-th)
        uvs = [((r[0] + (v[0] + w / 2) / MM) / DATA["ui"]["w"], 1 - (r[1] + (v[2] + d / 2) / MM) / DATA["ui"]["h"]) for v in verts]
        # top face (+y, index 3) shows the UI; the sides are dark glass edges
        return mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 0 if i == 3 else 1)
    if t == "plane":
        w, h = g["w"], g["h"]
        y0 = 0 if g.get("hinge") else -h / 2
        verts = [(-w / 2, y0, 0), (w / 2, y0, 0), (w / 2, y0 + h, 0), (-w / 2, y0 + h, 0)]
        if "uv" in g:
            u0, v0, u1, v1 = g["uv"]  # pixel-space fractions, v from the top
            uvs = [(u0, 1 - v1), (u1, 1 - v1), (u1, 1 - v0), (u0, 1 - v0)]
        else:
            uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        return mesh_from(o["name"], verts, [(0, 1, 2, 3)], uvs)
    if t in ("box", "roundBox"):
        sx, sy, sz = g["size"]
        verts = box_verts(sx, sy, sz)
        if g.get("topImage"):
            # top face (+y) maps the whole image, u along x, v along -z
            uvs = [((v[0] + sx / 2) / sx, 1 - (v[2] + sz / 2) / sz) for v in verts]
            me = mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 1 if i == 3 else 0)
        else:
            me = mesh_from(o["name"], verts, box_faces())
        return me
    if t == "ellipsoid":
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=28, radius=1.0)
        rx, ry, rz = g["r"]
        for v in bm.verts:
            v.co.x *= rx
            v.co.y *= ry
            v.co.z *= rz
        me = bpy.data.meshes.new(o["name"])
        bm.to_mesh(me)
        bm.free()
        me.shade_smooth()
        return me
    if t == "arc":
        R, r, arc = g["radius"], g["tube"], g["arc"]
        n, m = 20, 10
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
        me = mesh_from(o["name"], verts, faces, smooth=True)
        return me
    if t == "tri":
        v = g["verts"]
        return mesh_from(o["name"], [tuple(v[0:3]), tuple(v[3:6]), tuple(v[6:9])], [(0, 1, 2)])
    if t == "octa":
        r = g["r"]
        verts = [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r)]
        faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
        return mesh_from(o["name"], verts, faces)
    raise ValueError(t)


def mat4(m):
    return Matrix([m[0:4], m[4:8], m[8:12], m[12:16]])


objs = {"root": root}
for o in DATA["objects"]:
    name = o["name"]
    if o.get("camera"):
        cam_data = bpy.data.cameras.new("Camera")
        cam_data.sensor_fit = "VERTICAL"
        cam_data.sensor_height = 24
        cam_data.clip_start = 0.01
        cam_data.clip_end = 30
        cam_data.dof.use_dof = True
        ob = bpy.data.objects.new("Camera", cam_data)
        scene.camera = ob
    elif o["geo"] is None:
        ob = bpy.data.objects.new(name, None)
    else:
        me = build_geo(o)
        for mat in material(o["mat"], name + "_mat") if o.get("mat") else []:
            me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        if o["geo"]["type"] == "roundBox":
            bev = ob.modifiers.new("Bevel", "BEVEL")
            bev.width = o["geo"]["radius"]
            bev.segments = 3
            bev.limit_method = "NONE"
    scene.collection.objects.link(ob)
    ob.parent = objs[o["parent"]]
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.matrix_basis = mat4(o["matrix"])
    ob.rotation_mode = "QUATERNION"
    objs[name] = ob

# ── Keyframes ───────────────────────────────────────────────────────────────
anim = DATA["anim"]
for name, mats in anim.items():
    ob = objs[name]
    prev = None
    for s, m in enumerate(mats):
        f = 1 + s / SUB
        ob.matrix_basis = mat4(m)
        q = ob.rotation_quaternion.copy()
        if prev is not None and prev.dot(q) < 0:
            q.negate()
            ob.rotation_quaternion = q
        prev = q
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("rotation_quaternion", frame=f)
        ob.keyframe_insert("scale", frame=f)

sc = DATA["scalars"]
cam = objs["camera"].data
for s in range(DATA["samples"]):
    f = 1 + s / SUB
    cam.lens = 12 / math.tan(math.radians(sc["fov"][s]) / 2)
    cam.keyframe_insert("lens", frame=f)
    cam.dof.focus_distance = sc["focus"][s]
    cam.dof.aperture_fstop = sc["fstop"][s]
    cam.dof.keyframe_insert("focus_distance", frame=f)
    cam.dof.keyframe_insert("aperture_fstop", frame=f)

# material channels only change on whole frames; key those
TINT_ON = rgba("#6fb4ff")
for f in range(1, DATA["frames"] + 1):
    s = (f - 1) * SUB
    for sock, base, key in emit_keys:
        sock.default_value = base * sc[key][s]
        sock.keyframe_insert("default_value", frame=f)
    for node, btn in tint_keys:
        node.inputs[7].default_value = TINT_ON if sc[f"on_{btn}"][s] else (1, 1, 1, 1)
        node.inputs[7].keyframe_insert("default_value", frame=f)
    BLOB_OPACITY.default_value = sc["blobOpacity"][s]
    BLOB_OPACITY.keyframe_insert("default_value", frame=f)

print(f"built: {len(objs)} objects, {len(anim)} animated")

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
    import time
    for f in frames:
        t0 = time.time()
        scene.frame_set(f)
        scene.render.filepath = str(OUT / f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"rendered frame {f} in {time.time() - t0:.1f}s", flush=True)
