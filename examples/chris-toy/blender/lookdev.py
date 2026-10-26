"""Look-dev renders of chris-toy.blend on a plain studio floor (the lighting of
the isnail film's look-dev): front, three-quarter, side, back, face.

usage: blender -b chris-toy.blend -P blender/lookdev.py -- [--samples 64] [--out build/lookdev] [--views front,face]
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = ROOT / arg("--out", "build/lookdev")
OUT.mkdir(parents=True, exist_ok=True)
sys.path.append(str(Path(__file__).resolve().parent))
from studio import Studio  # noqa: E402

scene = bpy.context.scene
studio = Studio(scene, int(arg("--w", 960)), int(arg("--hgt", 540)), int(arg("--samples", 64)))
cam_data, look = studio.cam_data, studio.look


VIEWS = {
    # name: target (m), azimuth (deg, 0 = his front, -90 = his right side), elevation, distance
    "front": ((0, 0, 0.062), 0, 6, 0.46),
    "threequarter": ((0, 0, 0.062), -35, 10, 0.44),
    "side": ((0, 0, 0.062), -90, 5, 0.46),
    "back": ((0, 0, 0.064), 180, 12, 0.46),
    "face": ((0, -0.004, 0.08), -22, 4, 0.2),
    "facefront": ((0, -0.004, 0.079), 0, 2, 0.19),
    "hero": ((0, 0, 0.063), -28, 9, 0.40),
    "top": ((0.004, -0.004, 0.1), 15, 48, 0.17),
}
# the stand: arms a little out from the sides, as on the character sheet
rig = bpy.data.objects["ChrisRig"]
for side, a in (("L", 1), ("R", -1)):
    pb = rig.pose.bones[f"upper_arm.{side}"]
    axis = rig.data.bones[pb.name].matrix_local.to_3x3().inverted() @ Vector((0, 1, 0))
    pb.rotation_mode = "AXIS_ANGLE"
    pb.rotation_axis_angle = (math.radians(-9 * a), *axis)
bpy.context.view_layer.update()

if "--turntable" in argv:
    # a full turn of the toy before a fixed camera: build/turntable/0001.png ...
    n = int(arg("--turntable", 96))
    look((0, 0, 0.064), 0, 9, 0.44)
    tt = ROOT / "build/turntable"
    tt.mkdir(parents=True, exist_ok=True)
    for i in range(n):
        rig.rotation_euler = (0, 0, 2 * math.pi * i / n)
        scene.render.filepath = str(tt / f"{i + 1:04d}.png")
        bpy.ops.render.render(write_still=True)
        print("turntable", i + 1, flush=True)
    raise SystemExit

# orthographic, eye level, for laying beside the character sheet
ORTHO = {"orthofront": 0, "orthoside": -90, "orthoback": 180}
names = arg("--views", ",".join(VIEWS)).split(",")
for name in names:
    if name in ORTHO:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = 0.135
        cam_data.dof.use_dof = False
        look((0, 0, 0.0612), ORTHO[name], 0, 1.0)
    else:
        cam_data.type = "PERSP"
        cam_data.dof.use_dof = True
        look(*VIEWS[name])
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name, flush=True)
