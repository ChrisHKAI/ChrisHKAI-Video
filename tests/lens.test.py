"""Whether what is behind a toy's lens is lit and seen (engine/lib/toyblend.py), in Blender, on the light paths the
film and the look-dev share (engine/lib/look.py paths): an eye behind a lens, lit through the lens, as bright as with
no lens there, from the front and from the side. A sculpted toy's lenses once showed the eyes in the look-dev and hid
them in the film: the two rendered on different bounces, and the lens kept the light out.

usage: python3 tests/lens.test.py   (finds Blender, and runs itself in it)
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1] / "skills/creator-toy-intro"
LIB = SKILL / "engine/lib"

if "bpy" not in sys.modules and os.environ.get("LENS_IN_BLENDER") != "1":
    blender = os.environ.get("BLENDER") or shutil.which("blender") or next(
        (p for p in ("/Applications/Blender.app/Contents/MacOS/Blender", str(Path.home() / ".chrishkai-video/blender/blender")) if Path(p).exists()), None)
    if not blender:
        print("skipped: no Blender")
        sys.exit(0)
    r = subprocess.run([blender, "-b", "--factory-startup", "--python-exit-code", "1", "-P", __file__], env={**os.environ, "LENS_IN_BLENDER": "1"}, capture_output=True, text=True)
    print("\n".join(line for line in (r.stdout + r.stderr).splitlines() if line.startswith(("ok", "FAIL", "Traceback", "  ", "AssertionError", "all"))))
    sys.exit(r.returncode)

import bmesh  # noqa: E402
import bpy  # noqa: E402

sys.path.insert(0, str(LIB))
import look  # noqa: E402
import toyblend  # noqa: E402

TMP = Path(tempfile.mkdtemp())


def material(name, build):
    m = bpy.data.materials.new(name)
    if not m.node_tree:  # (a Blender before 5 makes its nodes on asking)
        m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(build(nt, p) or p.outputs["BSDF"], out.inputs["Surface"])
    return m


def brown(nt, p):
    p.inputs["Base Color"].default_value = (0.35, 0.2, 0.1, 1)
    p.inputs["Roughness"].default_value = 0.6


LENSES = {
    # a sculpted toy's lens: the kit sets the node up in place, and whatever links it to the output is the scene's
    "a sculpted toy's lens": lambda nt, p: toyblend.vertex_paint(nt, p, "glass"),
    # a part-built toy's lens (toy.json "finish": "glass"): the kit returns the shader for the output
    "a part-built toy's lens": lambda nt, p: toyblend.finish(nt, p, "glass", (1, 1, 1, 1)),
}


def scene_with(lens, turn):
    """An eye at the origin, a lens 30 mm in front of it (towards −y), a sun shining through the lens onto the eye,
    nothing else lit; the camera `turn` degrees round from the lens's own axis. → the eye's brightness (0–1)."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    look.paths(scene)
    scene.render.resolution_x = scene.render.resolution_y = 64
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "Standard"
    scene.world = bpy.data.worlds.new("dark")
    if not scene.world.node_tree:
        scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0

    def mesh(name, make, mat, at):
        bm = bmesh.new()
        make(bm)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        scene.collection.objects.link(ob)
        ob.location = at
        me.materials.append(mat)
        return ob

    mesh("eye", lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=0.02), material("eye", brown), (0, 0, 0))
    if lens:
        # a solid disc, 2 mm thick, its faces across the y axis
        ob = mesh("lens", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.06, radius2=0.06, depth=0.002), material("lens", LENSES[lens]), (0, -0.03, 0))
        ob.rotation_euler = (math.pi / 2, 0, 0)
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3.0
    # shining through the lens onto the eye, from 25° above the lens's axis: its mirror image in the lens's face
    # falls below the camera, so what is measured is the eye, not the lens's own glint
    sun.rotation_euler = (math.radians(65), 0, 0)
    scene.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    a = math.radians(turn)
    cam.location = (0.5 * math.sin(a), -0.5 * math.cos(a), 0)
    cam.rotation_euler = (math.pi / 2, 0, a)
    cam.data.lens = 120
    scene.collection.objects.link(cam)
    scene.camera = cam
    path = str(TMP / f"{lens or 'bare'}-{turn}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    w, h = img.size
    px = list(img.pixels)
    box = [(x, y) for y in range(h * 2 // 5, h * 3 // 5) for x in range(w * 2 // 5, w * 3 // 5)]
    return sum(sum(px[(y * w + x) * 4 + c] for c in range(3)) / 3 for x, y in box) / len(box)


checks = {}
for turn, word in ((0, "from the front"), (55, "from the side")):
    bare = scene_with(None, turn)
    for lens in LENSES:
        got = scene_with(lens, turn) / max(bare, 1e-6)
        # the part-built lens refracts, so from the side it shows the eye a little off its place: lit is what is asked
        need = 0.9 if lens.startswith("a sculpted") else 0.6
        checks[f"the eye behind {lens} is lit, {word}"] = (got, need)
# the look-dev and the film render on the same light paths: neither sets its own
for script in ("lookdev.py", "scene.py"):
    src = (SKILL / "engine/scripts" / script).read_text()
    checks[f"{script} takes its light paths from engine/lib/look.py"] = (float("lighting.paths(scene)" in src and "transmission_bounces" not in src), 1.0)

bad = 0
for name, (got, need) in checks.items():
    ok = got >= need
    bad += not ok
    print(f"{'ok' if ok else 'FAIL'}  {name}" + (f" ({got:.0%} of its brightness with no lens)" if need < 1 else "") + ("" if ok else f"\n  got {got:.2f}, want {need:.2f} at least"))
print(f"all {len(checks)} passed" if not bad else f"{bad} of {len(checks)} failed")
sys.exit(1 if bad else 0)
