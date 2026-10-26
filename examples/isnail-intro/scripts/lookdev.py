"""Look-dev turnaround of the mascot: builds the toy from build/hero.json and
renders a few posed views in Cycles on a plain studio floor.

usage:
  blender -b --factory-startup -P scripts/lookdev.py -- [--samples 64] [--out build/lookdev]
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


HERO = json.loads((ROOT / "build/hero.json").read_text())
OUT = ROOT / arg("--out", "build/lookdev")
OUT.mkdir(parents=True, exist_ok=True)


def srgb_to_linear(c):
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def rgba(hex_, k=1.0):
    h = hex_.lstrip("#")
    r, g, b = srgb_to_linear([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return (r * k, g * k, b * k, 1.0)


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
scene.cycles.samples = int(arg("--samples", 64))
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 540
scene.view_settings.view_transform = "Standard"
scene.render.image_settings.file_format = "PNG"

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
wn.clear()
w_out = wn.new("ShaderNodeOutputWorld")
w_mix = wn.new("ShaderNodeMixShader")
w_light = wn.new("ShaderNodeBackground")
w_light.inputs["Color"].default_value = rgba("#dfe6ff")
w_light.inputs["Strength"].default_value = 0.35
w_cam = wn.new("ShaderNodeBackground")
w_cam.inputs["Color"].default_value = rgba("#14161b")
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
    return ob


sun("Key", 2.6, "#fff3ea", (-1.2, 2.2, 1.6), 14)
sun("Rim", 2.0, "#d6e2ff", (1.4, 1.1, -1.8), 10)
sun("Fill", 0.6, "#ffe2d0", (1.6, 0.8, 1.4), 30)

mats = {}


def material(key):
    if key in mats:
        return mats[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if key == "shine":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#ffffff")
        e.inputs["Strength"].default_value = 1.6
        nt.links.new(e.outputs["Emission"], out.inputs["Surface"])
    else:
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = rgba(HERO["colors"][key])
        lens = key in ("blue", "lensRed")
        p.inputs["Roughness"].default_value = 0.1 if lens else 0.55 if key == "grey" else 0.34
        p.inputs["Coat Weight"].default_value = 1.0 if lens else 0.15 if key == "grey" else 0.5
        p.inputs["Coat Roughness"].default_value = 0.03 if lens else 0.16
        if key in ("white", "hoodie"):
            p.inputs["Subsurface Weight"].default_value = 0.08
            p.inputs["Subsurface Radius"].default_value = (0.004, 0.003, 0.003)
        if lens:
            p.inputs["Emission Color"].default_value = rgba(HERO["colors"][key])
            p.inputs["Emission Strength"].default_value = 0.25
        nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    mats[key] = m
    return m


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


def sphere_mesh(name, r):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
    for vt in bm.verts:
        vt.co.x *= r[0]
        vt.co.y *= r[1]
        vt.co.z *= r[2]
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
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
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.shade_smooth()
    return me


def build_hero(name):
    hero = bpy.data.objects.new(name, None)
    scene.collection.objects.link(hero)
    hero.parent = root
    joints = {}
    for j, spec in HERO["joints"].items():
        ob = bpy.data.objects.new(f"{name}_{j}", None)
        scene.collection.objects.link(ob)
        joints[j] = (ob, spec)
    for j, (ob, spec) in joints.items():
        parent = joints[spec["parent"]][0] if spec["parent"] else hero
        ob.parent = parent
        pp = Vector(joints[spec["parent"]][1]["p"]) if spec["parent"] else Vector((0, 0, 0))
        ob.location = Vector(spec["p"]) - pp
    for p in HERO["parts"]:
        if p["shape"] == "roundBox":
            me = round_box_mesh(p["name"], p["size"], p["radius"])
        elif p["shape"] == "ellipsoid":
            me = sphere_mesh(p["name"], p["r"])
        else:
            me = arc_mesh(p["name"], p["radius"], p["tube"], p["arc"])
        me.materials.append(material(p["mat"]))
        ob = bpy.data.objects.new(f"{name}_{p['name']}", me)
        scene.collection.objects.link(ob)
        jo, spec = joints[p["group"]]
        ob.parent = jo
        ob.location = Vector(p["pos"]) - Vector(spec["p"])
        ob.rotation_euler = Euler(p.get("rot", [0, 0, 0]), "XYZ")
    return hero, {j: ob for j, (ob, _) in joints.items()}


floor_me = bpy.data.meshes.new("floor")
floor_me.from_pydata([(-2, 0, -2), (2, 0, -2), (2, 0, 2), (-2, 0, 2)], [], [(0, 3, 2, 1)])
floor = bpy.data.objects.new("floor", floor_me)
scene.collection.objects.link(floor)
floor.parent = root
fm = bpy.data.materials.new("floor")
fm.use_nodes = True
fp = fm.node_tree.nodes["Principled BSDF"]
fp.inputs["Base Color"].default_value = rgba("#24272e")
fp.inputs["Roughness"].default_value = 0.45
floor_me.materials.append(fm)

hero, J = build_hero("mascot")

cam_data = bpy.data.cameras.new("Camera")
cam_data.sensor_fit = "VERTICAL"
cam_data.sensor_height = 24
cam_data.lens = 12 / math.tan(math.radians(26) / 2)
cam_data.clip_start = 0.005
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 5.6
cam = bpy.data.objects.new("Camera", cam_data)
scene.collection.objects.link(cam)
cam.parent = root
scene.camera = cam


def look(target, az, el, dist):
    t = Vector(target)
    a, e = math.radians(az), math.radians(el)
    pos = t + Vector((dist * math.sin(a) * math.cos(e), dist * math.sin(e), dist * math.cos(a) * math.cos(e)))
    z = (pos - t).normalized()
    x = Vector((0, 1, 0)).cross(z).normalized()
    y = z.cross(x)
    cam.matrix_basis = Matrix((x, y, z)).transposed().to_4x4()
    cam.location = pos
    cam_data.dof.focus_distance = dist


def pose(p):
    for j, ob in J.items():
        ob.rotation_euler = Euler(p.get(j, (0, 0, 0)), "XYZ")
    J["finger"].scale = (1, 1, 1) if p.get("point") else (0.6, 0.15, 0.6)


REST = {"armR": (0, 0, -0.12), "armL": (0, 0, 0.12)}
POINT = {"point": True, "armR": (-1.25, 0, -0.75), "armL": (0.1, 0, 0.35), "head": (0.06, -0.12, 0.05), "legR": (0.25, 0, 0), "legL": (-0.2, 0, 0)}
CHEER = {"armR": (0, 0, -2.4), "armL": (0, 0, 2.4), "head": (-0.08, 0, 0), "ears": (0, 0, 0.12)}
if "--avatar" in argv:
    # the flat profile picture: flat colours and an inked outline (inverted hull)
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = 1024
    scene.render.use_freestyle = False
    floor.hide_render = True
    cam_data.dof.use_dof = False
    ink = bpy.data.materials.new("ink")
    ink.use_nodes = True
    nt = ink.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = rgba("#141416")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Backfacing"], mx.inputs["Fac"])
    nt.links.new(e.outputs["Emission"], mx.inputs[1])
    nt.links.new(tr.outputs["BSDF"], mx.inputs[2])
    nt.links.new(mx.outputs["Shader"], o.inputs["Surface"])
    for key, m in mats.items():
        nt2 = m.node_tree
        nt2.nodes.clear()
        o2 = nt2.nodes.new("ShaderNodeOutputMaterial")
        e2 = nt2.nodes.new("ShaderNodeEmission")
        col = "#ffffff" if key == "shine" else HERO["colors"][key]
        e2.inputs["Color"].default_value = rgba(col)
        nt2.links.new(e2.outputs["Emission"], o2.inputs["Surface"])
    for ob in list(scene.objects):
        if ob.type == "MESH" and ob.name.startswith("mascot_"):
            if any(k in ob.name for k in ("shine", "lens", "smile")):
                continue
            ob.data.materials.append(ink)
            mod = ob.modifiers.new("ink", "SOLIDIFY")
            mod.thickness = -0.0011
            mod.offset = 1
            mod.use_flip_normals = True
            mod.use_rim = False
            mod.material_offset = len(ob.data.materials) - 1
    pose({"armR": (0, 0, -0.18), "armL": (0, 0, 0.18)})
    look((0, 0.066, 0), 0, 4, 0.36)
    cam_data.lens = 12 / math.tan(math.radians(30) / 2)
    scene.render.filepath = str(OUT / "avatar-toy.png")
    bpy.ops.render.render(write_still=True)
    print("rendered avatar", flush=True)
    raise SystemExit

views = [
    ("front", REST, (0, 0.056, 0), 0, 8, 0.42),
    ("threequarter", POINT, (0, 0.056, 0), 35, 12, 0.40),
    ("side", REST, (0, 0.056, 0), 90, 6, 0.42),
    ("back", CHEER, (0, 0.06, 0), 150, 18, 0.44),
    ("face", REST, (0, 0.075, 0), 22, 6, 0.2),
]
for name, p, target, az, el, dist in views:
    pose(p)
    look(target, az, el, dist)
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name, flush=True)
