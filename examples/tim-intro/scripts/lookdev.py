"""Look-dev of Tim and the Duo: builds every part from build/hero.json once,
then for each view sets a solved pose (transforms, hidden face pieces) and
renders it in Cycles in a white studio (a curved cyclorama, soft area lights).

usage:
  blender -b --factory-startup -P scripts/lookdev.py -- [--samples 64] [--out build/lookdev] [--views front,face] [--scale 100]
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from toy import part_material, part_mesh, rgba  # noqa: E402
from relief import build_relief  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


HERO = json.loads((ROOT / "build/hero.json").read_text())
OUT = ROOT / arg("--out", "build/lookdev")
OUT.mkdir(parents=True, exist_ok=True)
IMAGES = {"duoScreen": str(ROOT / "assets/duo-screen.png"), "duoCover": str(ROOT / "assets/duo-cover.png")}

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
scene.cycles.max_bounces = 6
scene.cycles.transmission_bounces = 4
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = int(arg("--scale", 50))
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.image_settings.file_format = "PNG"

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = rgba("#eef1f6")
bg.inputs["Strength"].default_value = 0.22

root = bpy.data.objects.new("THREE", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.pi / 2, 0, 0)


def link(ob):
    scene.collection.objects.link(ob)
    ob.parent = root
    return ob


def area(name, energy, color, pos, target, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = rgba(color)[:3]
    data.shape = "DISK"
    data.size = size
    ob = link(bpy.data.objects.new(name, data))
    d = (Vector(pos) - Vector(target)).normalized()
    ob.matrix_basis = Matrix.Translation(pos) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    return ob


area("Key", 3.2, "#fff4ea", (-0.32, 0.42, 0.42), (0, 0.08, 0), 0.38)
area("Fill", 0.8, "#eef3ff", (0.42, 0.1, 0.38), (0, 0.08, 0), 0.4)
area("Rim", 2.4, "#ffffff", (0.25, 0.38, -0.4), (0, 0.1, 0), 0.3)

# the cyclorama: floor running into a curved wall
prof = [(z, 0.0) for z in (1.4, 0.6, 0.0, -0.2)]
R, cz = 0.32, -0.2
prof += [(cz - R * math.sin(a), R - R * math.cos(a)) for a in [i * math.pi / 2 / 12 for i in range(1, 13)]]
prof += [(cz - R, 1.6)]
verts, faces = [], []
for x in (-2.5, 2.5):
    verts += [(x, y, z) for z, y in prof]
n = len(prof)
faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
me = bpy.data.meshes.new("cyc")
me.from_pydata(verts, [], faces)
me.shade_smooth()
cyc = link(bpy.data.objects.new("cyc", me))
cm = bpy.data.materials.new("cyc")
cm.use_nodes = True
cp = cm.node_tree.nodes["Principled BSDF"]
cp.inputs["Base Color"].default_value = rgba("#e9ebef")
cp.inputs["Roughness"].default_value = 0.42
cp.inputs["Coat Weight"].default_value = 0.15
me.materials.append(cm)

# every part once
objs, cache = {}, {}
for p in HERO["parts"]:
    me = part_mesh(p)
    me.materials.append(part_material(p, HERO, cache, IMAGES))
    ob = link(bpy.data.objects.new(p["name"], me))
    ob.rotation_mode = "QUATERNION"
    objs[p["name"]] = ob

# Steve Jobs's photo relief, 0.2 m tall, standing on the floor
relief = build_relief(scene, root, 0.2)
relief.hide_render = True

cam_data = bpy.data.cameras.new("Camera")
cam_data.sensor_fit = "VERTICAL"
cam_data.sensor_height = 24
cam_data.clip_start = 0.005
cam_data.dof.use_dof = True
cam = link(bpy.data.objects.new("Camera", cam_data))
scene.camera = cam


def look(target, az, el, dist, fov=26, fstop=5.6):
    t = Vector(target)
    a, e = math.radians(az), math.radians(el)
    pos = t + Vector((dist * math.sin(a) * math.cos(e), dist * math.sin(e), dist * math.cos(a) * math.cos(e)))
    z = (pos - t).normalized()
    x = Vector((0, 1, 0)).cross(z).normalized()
    y = z.cross(x)
    cam.matrix_basis = Matrix.Translation(pos) @ Matrix((x, y, z)).transposed().to_4x4()
    cam_data.lens = 12 / math.tan(math.radians(fov) / 2)
    cam_data.dof.focus_distance = dist
    cam_data.dof.aperture_fstop = fstop


def pose(name, lift=0.0):
    relief.hide_render = relief.children[0].hide_render = name != "_relief"
    if name == "_relief":
        for ob in objs.values():
            ob.hide_render = True
        return
    P = HERO["poses"][name]
    for pname, ob in objs.items():
        tr = P["parts"].get(pname)
        ob.hide_render = tr is None or pname in P["hidden"]
        if tr:
            ob.location = (tr[0], tr[1] + lift, tr[2])
            ob.rotation_quaternion = (tr[6], tr[3], tr[4], tr[5])
            ob.scale = tr[7:10]


H = 0.148
views = {
    "front": ("rest", 0, (0, 0.074, 0), 0, 5, 0.56, 26, 8),
    "threequarter": ("open", 0, (0, 0.074, 0.01), 38, 12, 0.52, 26, 8),
    "side": ("calm", 0, (0, 0.074, 0), 90, 4, 0.56, 26, 8),
    "back": ("calm", 0, (0, 0.08, 0), 150, 14, 0.56, 26, 8),
    "face": ("rest", 0, (0, 0.11, 0.012), 14, 3, 0.2, 26, 4),
    "head34": ("calm", 0, (0, 0.115, 0.01), 40, 8, 0.24, 26, 8),
    "headSide": ("calm", 0, (0, 0.115, 0.0), 90, 4, 0.24, 26, 8),
    "headBack": ("calm", 0, (0, 0.115, 0.0), 160, 16, 0.26, 26, 8),
    "photo": ("photo", 0, (0, 0.09, 0.01), 0, 2, 0.34, 26, 5.6),
    "shut": ("shut", 0, (0, 0.085, 0.015), 28, 8, 0.36, 26, 5.6),
    "duoOpen": ("duoOpen", 0.03, (0, 0.03, 0), 20, 38, 0.17, 26, 8),
    "duoHalf": ("duoHalf", 0.03, (0, 0.045, 0), 160, 28, 0.19, 26, 8),
    "duoShut": ("duoShut", 0.0, (0, 0.016, 0), -140, 14, 0.15, 26, 8),
    "grip": ("open", 0, (0, 0.058, 0.025), 25, 28, 0.22, 26, 5.6),
    "gripShut": ("shut", 0, (0, 0.062, 0.025), 35, 12, 0.22, 26, 5.6),
    "jobsFront": ("jobsRest", 0, (0, 0.074, 0), 0, 5, 0.56, 26, 8),
    "jobs34": ("jobsWalk", 0, (0, 0.074, 0.01), 35, 10, 0.52, 26, 8),
    "jobsSide": ("jobsRest", 0, (0, 0.074, 0), 90, 4, 0.56, 26, 8),
    "jobsBack": ("jobsRest", 0, (0, 0.08, 0), 150, 14, 0.56, 26, 8),
    "jobsFace": ("jobsGentle", 0, (0, 0.11, 0.012), 14, 3, 0.2, 26, 4),
    "jobsChin": ("jobsChin", 0, (0, 0.098, 0.01), -18, 2, 0.3, 26, 5.6),
    **{f"relief{az:+d}_{el}": ("_relief", 0, (0, 0.13, 0.03), az, el, 0.42, 26, 8) for az, el in ((0, 2), (-20, 4), (30, 6), (-40, 8), (15, 30), (60, 4))},
    "duoPov": ("duoOpen", 0.03, (0, 0.03, 0), 180, 62, 0.15, 26, 8),
    **{f"expr_{e}": (f"expr_{e}", 0, (0, 0.112, 0.012), 10, 3, 0.19, 26, 5.6) for e in ("surprised", "happy", "focus", "strain", "tired", "calm")},
}
only = set(arg("--views", "").split(",")) - {""}
for name, (pname, lift, target, az, el, dist, fov, fstop) in views.items():
    if only and name not in only:
        continue
    pose(pname, lift)
    look(target, az, el, dist, fov, fstop)
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name, flush=True)
