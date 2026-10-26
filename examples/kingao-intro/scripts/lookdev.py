"""Look-dev turnaround of the cat: builds the toy from build/hero.json and
renders a few posed views in Cycles on a plain studio floor.

usage:
  blender -b --factory-startup -P scripts/lookdev.py -- [--samples 64] [--out build/lookdev] [--views front,face]
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from toy import build_toy, rgba  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


HERO = json.loads((ROOT / "build/hero.json").read_text())
OUT = ROOT / arg("--out", "build/lookdev")
OUT.mkdir(parents=True, exist_ok=True)

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

toy, J, _ = build_toy(scene, root, HERO, "cat")

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
        ob.rotation_euler = Euler(p.get(j, (0, 0, 0)), "ZYX")


REST = {}
# the photo: chin up, head turned a little to its right, ears relaxed back
CONTENT = {"head": (-0.22, -0.32, 0.08), "earL": (-0.1, 0, -0.08), "earR": (-0.1, 0, 0.08), "tail1": (0, 0.15, 0), "tail2": (0, 0.2, 0.15)}
PAW = {"head": (-0.12, 0.18, -0.1), "legR": (-1.15, 0, -0.15), "tail1": (0, -0.2, 0), "tail2": (0, -0.25, -0.2)}
views = [
    ("front", REST, (0, 0.05, 0), 0, 8, 0.38),
    ("threequarter", PAW, (0, 0.05, 0), 35, 12, 0.36),
    ("side", REST, (0, 0.05, 0), 90, 6, 0.38),
    ("back", REST, (0, 0.05, 0), 155, 18, 0.40),
    ("photo", CONTENT, (0, 0.06, 0), 52, 4, 0.30),
    ("face", REST, (0, 0.065, 0.01), 18, 6, 0.17),
]
only = set(arg("--views", "").split(",")) - {""}
for name, p, target, az, el, dist in views:
    if only and name not in only:
        continue
    pose(p)
    look(target, az, el, dist)
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name, flush=True)
