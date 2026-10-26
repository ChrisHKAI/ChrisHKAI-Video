"""For films using the Chris toy: append it, pose it, swap its expression and
hands. Import it from a Blender script:

    sys.path.append(".../characters/chris-toy/blender")
    import chris_rig
    rig = chris_rig.append()
    chris_rig.expression(rig, "happy", frame=30)
    chris_rig.hand(rig, "R", "grip", frame=30)
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

BLEND = Path(__file__).resolve().parent.parent / "chris-toy.blend"

# an expression = a variant per face group, and how the brows sit
# (raise: mm up; tilt: degrees, + = the inner ends down, a frown)
EXPRESSIONS = {
    "grin": {"mouth": "grin", "eye.L": "open", "eye.R": "open", "raise": 0.0, "tilt": 0.0},
    "happy": {"mouth": "grin", "eye.L": "happy", "eye.R": "happy", "raise": 0.8, "tilt": -6.0},
    "wink": {"mouth": "grin", "eye.L": "happy", "eye.R": "open", "raise": 0.4, "tilt": 0.0},
    "effort": {"mouth": "grit", "eye.L": "squint", "eye.R": "squint", "raise": -0.6, "tilt": 16.0},
    "surprise": {"mouth": "oh", "eye.L": "open", "eye.R": "open", "raise": 1.8, "tilt": -8.0},
}


def append(scene=None, collection="ChrisToy"):
    """Append the toy's collection into the scene; returns the rig."""
    with bpy.data.libraries.load(str(BLEND), link=False) as (src, dst):
        dst.collections = [collection]
    col = dst.collections[0]
    (scene or bpy.context.scene).collection.children.link(col)
    return next(o for o in col.objects if o.type == "ARMATURE")


def _parts(rig):
    return {o.name.split(".")[0]: o for o in rig.children_recursive}


def show(rig, group, variant, frame=None):
    """Show one variant of a group (mouth, eye.L/R, hand.L/R), hiding the others."""
    variants = json.loads(rig["variants"])[group]
    on, parts = set(variants[variant]), _parts(rig)
    for names in variants.values():
        for n in names:
            ob = parts[n]
            ob.hide_render = ob.hide_viewport = n not in on
            if frame is not None:
                ob.keyframe_insert("hide_render", frame=frame)
                ob.keyframe_insert("hide_viewport", frame=frame)


def hand(rig, side, kind, frame=None):
    show(rig, f"hand.{side}", kind, frame)


def brows(rig, raise_mm=0.0, tilt_deg=0.0, frame=None):
    """Lift the brows (mm) and tilt them (+ = inner ends down)."""
    for side, s in (("L", 1), ("R", -1)):
        pb = rig.pose.bones[f"brow.{side}"]
        bone = rig.data.bones[pb.name]
        to_bone = bone.matrix_local.to_3x3().inverted()
        pb.location = to_bone @ Vector((0, 0, raise_mm / 1000))
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion(to_bone @ Vector((0, -1, 0)), math.radians(tilt_deg) * -s)
        if frame is not None:
            pb.keyframe_insert("location", frame=frame)
            pb.keyframe_insert("rotation_quaternion", frame=frame)


def expression(rig, name, frame=None):
    e = EXPRESSIONS[name]
    for group in ("mouth", "eye.L", "eye.R"):
        show(rig, group, e[group], frame)
    brows(rig, e["raise"], e["tilt"], frame)


def rotate(rig, bone, axis, deg, frame=None):
    """Turn a bone about a world axis (rest frame), e.g. rotate(rig, "upper_arm.L", (0, 1, 0), -40)."""
    pb = rig.pose.bones[bone]
    b = rig.data.bones[bone]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = Quaternion(b.matrix_local.to_3x3().inverted() @ Vector(axis), math.radians(deg))
    if frame is not None:
        pb.keyframe_insert("rotation_quaternion", frame=frame)
