"""Whether the toy is in one piece (engine/lib/toyparts.py), in Blender: a body
with an eye set into it, then an eye in front of the face, a ball buried in the
body, a second body of another colour in the same place, and a spark meant to
float.

usage: python3 tests/toy-parts.test.py   (finds Blender, and runs itself in it)
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

LIB = Path(__file__).resolve().parents[1] / "skills/creator-toy-intro/engine/lib"

if "bpy" not in sys.modules and os.environ.get("TOYPARTS_IN_BLENDER") != "1":
    blender = os.environ.get("BLENDER") or shutil.which("blender") or next(
        (p for p in ("/Applications/Blender.app/Contents/MacOS/Blender", str(Path.home() / ".chrishkai-video/blender/blender")) if Path(p).exists()), None)
    if not blender:
        print("skipped: no Blender")
        sys.exit(0)
    r = subprocess.run([blender, "-b", "--factory-startup", "--python-exit-code", "1", "-P", __file__], env={**os.environ, "TOYPARTS_IN_BLENDER": "1"}, capture_output=True, text=True)
    print("\n".join(line for line in (r.stdout + r.stderr).splitlines() if line.startswith(("ok", "FAIL", "Traceback", "  ", "AssertionError", "all"))))
    sys.exit(r.returncode)

import bmesh  # noqa: E402
import bpy  # noqa: E402

sys.path.insert(0, str(LIB))
import toyparts  # noqa: E402

H = 0.1  # a 100 mm toy: touching is within 0.4 mm


def ball(name, r, at):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = at
    return ob


def toy(*parts):
    """parts: (name, radius, where, mat, apart?) → the objects and the hero it would come from."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    objs = {n: ball(n, r, at) for n, r, at, *_ in parts}
    hero = {"height": H, "finish": {}, "parts": [{"name": n, "mat": rest[0], **({"apart": True} if rest[1:] else {})} for n, _, _, *rest in parts]}
    return objs, hero


def found(*parts):
    objs, hero = toy(*parts)
    with tempfile.TemporaryDirectory() as d:
        return {(f["kind"], tuple(f["parts"])) for f in toyparts.write(Path(d) / "toy-parts.json", [toyparts.check(bpy, objs, hero, "rest")], hero)}


BODY = ("body", 0.03, (0, 0, 0), "white")
EYE = ("eye", 0.005, (0, -0.029, 0.01), "black")  # set into the body's front
checks = {
    "a body with an eye set into it is in one piece": (found(BODY, EYE), set()),
    "an eye 4 mm in front of the face floats": (found(BODY, ("eye", 0.005, (0, -0.038, 0.01), "black")), {("floating", ("eye",))}),
    "a ball inside the body is never seen": (found(BODY, EYE, ("ball", 0.008, (0, 0, 0), "red")), {("hidden", ("ball",))}),
    "a second body of another colour in the same place lies on it": (found(BODY, ("twin", 0.03, (0, 0, 0), "red")), {("coincide", ("body", "twin"))}),
    "a second body of the same colour renders the same": (found(BODY, ("twin", 0.03, (0, 0, 0), "white")), set()),
    "a spark meant to float is not floating": (found(BODY, ("spark", 0.003, (0, 0, 0.05), "white", True)), set()),
}
bad = 0
for name, (got, want) in checks.items():
    ok = got == want
    bad += not ok
    print(f"{'ok' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n  got {sorted(got)}, want {sorted(want)}"))
print(f"all {len(checks)} passed" if not bad else f"{bad} of {len(checks)} failed")
sys.exit(1 if bad else 0)
