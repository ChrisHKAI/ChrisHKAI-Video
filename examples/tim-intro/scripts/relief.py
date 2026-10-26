"""Steve Jobs's portrait as a photo relief in Blender: the black-and-white
photo (build/jobs-photo/photo.png) on the grid mesh scripts/depth.py pushed
out by its estimated depth (build/jobs-photo/relief.npz, 1 unit tall).

build_relief(scene, parent, height) → the object: x across, y up, z toward the
viewer (Three.js axes, like everything else), origin at the bottom centre of
the photo, `height` metres tall.
"""
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "build/jobs-photo"


def relief_material(name="jobsPhoto", image="photo.png"):
    """The photo's own values as light, a little of the room's light on top."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(SRC / image), check_existing=True)
    tex.interpolation = "Cubic"
    tex.extension = "EXTEND"
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Roughness"].default_value = 0.6
    p.inputs["Specular IOR Level"].default_value = 0.0
    dim = nt.nodes.new("ShaderNodeMix")
    dim.data_type = "RGBA"
    dim.blend_type = "MULTIPLY"
    dim.inputs["Factor"].default_value = 1.0
    nt.links.new(tex.outputs["Color"], dim.inputs["A"])
    dim.inputs["B"].default_value = (0.15, 0.15, 0.15, 1)
    nt.links.new(dim.outputs["Result"], p.inputs["Base Color"])
    nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 0.95
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return mat


def _mesh(name, V, UV, Q, mat):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set("co", V.astype(np.float32).ravel())
    me.loops.add(len(Q) * 4)
    me.loops.foreach_set("vertex_index", Q.astype(np.int32).ravel())
    me.polygons.add(len(Q))
    me.polygons.foreach_set("loop_start", (np.arange(len(Q)) * 4).astype(np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(Q), 4, dtype=np.int32))
    me.update(calc_edges=True)
    uvl = me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", UV[Q.ravel()].astype(np.float32).ravel())
    me.shade_smooth()
    me.materials.append(mat)
    return me


def build_relief(scene, parent, height):
    """The relief and, as its child, the layer behind the hand."""
    g = np.load(SRC / "relief.npz")
    ob = bpy.data.objects.new("jobsRelief", _mesh("jobsRelief", g["V"] * height, g["UV"], g["Q"], relief_material()))
    scene.collection.objects.link(ob)
    ob.parent = parent
    ob.rotation_mode = "QUATERNION"
    back = bpy.data.objects.new("jobsBehind", _mesh("jobsBehind", g["Vb"] * height, g["UVb"], g["Qb"], relief_material("jobsBehind", "photo-behind.png")))
    scene.collection.objects.link(back)
    back.parent = ob
    return ob
