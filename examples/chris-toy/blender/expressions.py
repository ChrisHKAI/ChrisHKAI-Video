"""Close-ups of the toy's expressions and hands (chris_rig.py), for review.

usage: blender -b chris-toy.blend -P blender/expressions.py -- [--samples 64] [--out build/expressions]
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.append(str(Path(__file__).resolve().parent))
import chris_rig  # noqa: E402
from studio import Studio  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda n, d: argv[argv.index(n) + 1] if n in argv else d
OUT = ROOT / arg("--out", "build/expressions")
OUT.mkdir(parents=True, exist_ok=True)
studio = Studio(bpy.context.scene, 720, 720, int(arg("--samples", 64)))
rig = bpy.data.objects["ChrisRig"]

for name in chris_rig.EXPRESSIONS:
    chris_rig.expression(rig, name)
    bpy.context.view_layer.update()
    studio.look((0, -0.004, 0.079), -12, 3, 0.2)
    studio.render(OUT / f"face_{name}.png")
    print("rendered", name, flush=True)
chris_rig.expression(rig, "grin")

# hands: his right hand at rest, close, from his right front; a rope through the grip
grip = json.loads(rig["grip"])["R"]
c, axis = Vector(grip["c"]), Vector(grip["axis"])
bpy.ops.mesh.primitive_cylinder_add(radius=grip["rope_radius"], depth=0.03, location=c)
rope = bpy.context.object
rope.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
mat = bpy.data.materials.new("rope")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.25, 0.9, 1)
rope.data.materials.append(mat)
for kind in ("relaxed", "grip", "point", "open"):
    chris_rig.hand(rig, "R", kind)
    rope.hide_render = kind != "grip"
    bpy.context.view_layer.update()
    hb = rig.pose.bones["hand.R"]
    mid = rig.matrix_world @ ((hb.head + hb.tail) / 2)
    studio.look(tuple(mid), -55, 8, 0.075)
    studio.render(OUT / f"hand_{kind}.png")
    print("rendered hand", kind, flush=True)
