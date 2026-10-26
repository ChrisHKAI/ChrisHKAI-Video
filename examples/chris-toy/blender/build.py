"""Assemble the Chris toy into chris-toy.blend: an armature ("ChrisRig") and
rigid vinyl parts parented to its bones, painted from per-vertex colours.
Reads build/chris.json and build/parts/*.npz (written by chris.py).

Films link or append the collection "ChrisToy" and pose the bones.

usage: blender -b --factory-startup -P blender/build.py
"""
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
META = json.loads((ROOT / "build/chris.json").read_text())

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
scene = bpy.context.scene
scene.unit_settings.scale_length = 1.0
col = bpy.data.collections.new("ChrisToy")
scene.collection.children.link(col)


def lin(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hexrgb(h):
    h = h.lstrip("#")
    return lin([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ── materials ──────────────────────────────────────────────────────────────
def principled(name, rough_attr=True, coat=0.0, coat_rough=0.1, sss=0.0, extra=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    a = nt.nodes.new("ShaderNodeAttribute")
    a.attribute_name = "Col"
    nt.links.new(a.outputs["Color"], p.inputs["Base Color"])
    if rough_attr:
        r = nt.nodes.new("ShaderNodeAttribute")
        r.attribute_name = "rough"
        nt.links.new(r.outputs["Fac"], p.inputs["Roughness"])
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
        p.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.25)
        p.inputs["Subsurface Scale"].default_value = 0.0015
    for k, v in (extra or {}).items():
        p.inputs[k].default_value = v
    return m


def eye_material():
    m = bpy.data.materials.new("eye")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    # u = x / 9.2 mm + 0.5, v = z / 10 mm + 0.5 over the eye piece (4.6 x 5.0 mm half size)
    u = nt.nodes.new("ShaderNodeMath")
    u.operation = "MULTIPLY_ADD"
    u.inputs[1].default_value = 1 / 0.0092
    u.inputs[2].default_value = 0.5
    nt.links.new(sep.outputs["X"], u.inputs[0])
    v = nt.nodes.new("ShaderNodeMath")
    v.operation = "MULTIPLY_ADD"
    v.inputs[1].default_value = 1 / 0.0100
    v.inputs[2].default_value = 0.5
    nt.links.new(sep.outputs["Z"], v.inputs[0])
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(u.outputs[0], comb.inputs["X"])
    nt.links.new(v.outputs[0], comb.inputs["Y"])
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(str(ROOT / "build/eye.png"))
    img.image.pack()
    img.extension = "EXTEND"
    nt.links.new(comb.outputs["Vector"], img.inputs["Vector"])
    nt.links.new(img.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.08
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.02
    return m


def lens_material():
    m = bpy.data.materials.new("lens")
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (1, 1, 1, 1)
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.0
    p.inputs["IOR"].default_value = 1.04
    return m


MATS = {
    "skin": principled("skin", coat=0.2, coat_rough=0.25, sss=0.18),
    "hair": principled("hair", coat=0.12, coat_rough=0.3),
    "teeth": principled("teeth", coat=0.6, coat_rough=0.1, sss=0.1),
    "tongue": principled("tongue", coat=0.4, coat_rough=0.15, sss=0.2),
    "shirt": principled("shirt", coat=0.15, coat_rough=0.3),
    "pants": principled("pants"),
    "shoe": principled("shoe", coat=0.3, coat_rough=0.15),
    "frame": principled("frame", coat=1.0, coat_rough=0.04),
    "pad": principled("pad", rough_attr=False, extra={"Roughness": 0.15, "Transmission Weight": 0.6}),
    "eye": eye_material(),
    "lens": lens_material(),
}

# ── the rig ────────────────────────────────────────────────────────────────
arm = bpy.data.armatures.new("ChrisRig")
rig = bpy.data.objects.new("ChrisRig", arm)
col.objects.link(rig)
arm.display_type = "STICK"
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for b in META["bones"]:
    eb = arm.edit_bones.new(b["name"])
    eb.head, eb.tail = Vector(b["head"]), Vector(b["tail"])
    eb.roll = 0
for b in META["bones"]:
    if b["parent"]:
        arm.edit_bones[b["name"]].parent = arm.edit_bones[b["parent"]]
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()

# ── the parts ──────────────────────────────────────────────────────────────
for part in META["parts"]:
    z = np.load(ROOT / "build" / part["file"])
    v, f, nrm = z["verts"], z["faces"], z["normals"]
    # wind the faces outward (marching cubes may give them either way)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    if (fn * nrm[f[:, 0]]).sum() < 0:
        f = f[:, ::-1].copy()
    me = bpy.data.meshes.new(part["name"])
    me.vertices.add(len(v))
    me.vertices.foreach_set("co", v.ravel())
    me.loops.add(f.size)
    me.loops.foreach_set("vertex_index", f.ravel())
    me.polygons.add(len(f))
    me.polygons.foreach_set("loop_start", np.arange(0, f.size, 3))
    me.update(calc_edges=True)
    me.validate()
    c = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    rgba = np.column_stack([lin(z["color"]), np.ones(len(v))]).astype(np.float32)
    c.data.foreach_set("color", rgba.ravel())
    r = me.attributes.new("rough", "FLOAT", "POINT")
    r.data.foreach_set("value", z["rough"])
    me.shade_smooth()
    me.materials.append(MATS[part["material"]])
    ob = bpy.data.objects.new(part["name"], me)
    col.objects.link(ob)
    ob.parent = rig
    ob.parent_type = "BONE"
    ob.parent_bone = part["bone"]
    bpy.context.view_layer.update()
    M = Matrix.Identity(4)
    if "frame" in part:
        R = Matrix(part["frame"]["R"])
        M = Matrix.Translation(Vector(part["frame"]["c"])) @ R.to_4x4()
    ob.matrix_world = M
    print(f"{part['name']:10s} {len(v):7d} verts -> {part['bone']}", flush=True)

# swappable pieces: the first variant of each group shows, the rest hide
rig["variants"] = json.dumps(META["variants"])
rig["grip"] = json.dumps(META["grip"])
for group, variants in META["variants"].items():
    default = next(iter(variants))
    shown = set(variants[default])
    for parts in variants.values():
        for name in parts:
            ob = bpy.data.objects[name]
            ob.hide_render = ob.hide_viewport = name not in shown

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "chris-toy.blend"), compress=True)
print("saved", ROOT / "chris-toy.blend", flush=True)
