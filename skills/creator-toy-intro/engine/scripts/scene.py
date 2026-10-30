"""Builds the world in Blender from build/anim.json and renders it with Cycles.

X's panels are floating slabs of black glossy glass with the UI as emission;
the profile picture is a sticker cut in strips that peel; the toy is smooth
vinyl parts under one empty; the view counter is glass with digit drums; the
cover is a wall whose pieces (boxes, lettering, the title) are extruded from
their own outlines and push out of it, all sharing one cover material mapped
in the wall's space. Keys go straight into the F-curves.

usage:
  blender -b --factory-startup -P scripts/scene.py -- \
      [--frames 1-720 | 13,49,121 | 1-20,45] [--samples 48] [--scale 100] \
      [--out build/render] [--save build/scene.blend] [--engine cycles|eevee] [--resume]
      [--look classic] [--rim 4]   (film.json "look" otherwise: references/render.md)
"""
import json
import math
import os
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from bpy_extras import anim_utils

# the engine: the skill running this (SKILL, set by engine/run.mjs), else the one this file sits in,
# so a film's own copy (<film>/engine/scene.py, `run.mjs own -- scene.py`) finds it too
sys.path.insert(0, str(Path(os.environ.get("SKILL") or Path(__file__).resolve().parents[2]) / "engine" / "lib"))
from film import FILM, FILM_JSON  # noqa: E402  the film workspace (FILM env var)
import toyblend  # noqa: E402  the pet and sculpt kits' shapes and paint
import look as lighting  # noqa: E402  the light, shared with the look-dev

ROOT = FILM
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


DATA = json.loads((ROOT / "build/anim.json").read_text())
SAMPLES = int(arg("--samples", 48))  # with the denoiser, 48 looks the same as 128 (references/render.md)
SCALE = int(arg("--scale", 100))
OUT = ROOT / arg("--out", "build/render")
ENGINE = arg("--engine", "cycles")
SUB = DATA["sub"]
SC = DATA["scalars"]
MM = 0.001


def srgb_to_linear(c):
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def hexrgb(hex_):
    h = hex_.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def rgba(hex_, k=1.0):
    r, g, b = srgb_to_linear(hexrgb(hex_))
    return (r * k, g * k, b * k, 1.0)


# the toy's colours and finishes (toy.json), plus the end card prop's (film.json cta.prop: colors, bodyColor)
TOY_SPEC = json.loads((FILM / FILM_JSON["toy"]).read_text())
# the prop's eyes take the toy's white and black when it has them (isnail's), else these
PROP = FILM_JSON["cta"].get("prop", {})
TOY = {"white": "#F3F1EC", "black": "#141416", **TOY_SPEC["colors"], **PROP.get("colors", {}), **({"snail": PROP["bodyColor"]} if "bodyColor" in PROP else {})}
FINISH = TOY_SPEC.get("finish", {})  # vinyl (default) | matte | soft | lens

# ── Scene ───────────────────────────────────────────────────────────────────
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
if ENGINE == "eevee":
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = SAMPLES
else:
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "METAL"
    scene.cycles.device = "GPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.015
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 5
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 2
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.blur_glossy = 0.5
scene.render.resolution_x, scene.render.resolution_y = FILM_JSON["format"].get("size", [1920, 1080])  # 16:9 or 9:16
scene.render.resolution_percentage = SCALE
scene.render.fps = DATA["fps"]
scene.frame_start = 1
scene.frame_end = DATA["frames"]
scene.render.use_motion_blur = "--no-blur" not in argv
scene.render.motion_blur_shutter = 0.5
scene.render.motion_blur_position = "CENTER"
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "8"
# the light (engine/lib/look.py: film.json "look", references/render.md "The light"), shared with the look-dev
LOOK = lighting.Look(FILM_JSON, arg, FILM)
lighting.view(scene, LOOK)
scene.view_settings.exposure = float(arg("--exposure", 0.0))
scene.render.use_persistent_data = True
lighting.world(bpy, scene, LOOK, sky=0.32)

root = bpy.data.objects.new("THREE", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.pi / 2, 0, 0)
RIM = lighting.suns(bpy, scene, root, LOOK)

# ── Materials ───────────────────────────────────────────────────────────────
images = {}


def image(path, colorspace="sRGB"):
    if path not in images:
        img = bpy.data.images.load(str(ROOT / path))
        img.colorspace_settings.name = colorspace
        images[path] = img
    return images[path]


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def principled(nt, base="#000000", rough=0.4, spec=0.5, coat=0.0, coat_rough=0.1):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = rgba(base)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    return p


def tex_node(nt, img, extension="REPEAT"):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Cubic"
    t.extension = extension
    return t


def value_node(nt, v=0.0):
    n = nt.nodes.new("ShaderNodeValue")
    n.outputs[0].default_value = v
    return n


keyed = []  # (scalar name, node tree, Value node, fn)
mats = {}
_edge = None


def edge_material():
    global _edge
    if _edge is None:
        _edge, nt, out = new_mat("slab_edge")
        p = principled(nt, "#121316", 0.32, 0.5)
        p.inputs["Metallic"].default_value = 0.3
        nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return _edge


def material(spec):
    key = json.dumps(spec, sort_keys=True)
    if key in mats:
        return mats[key]
    kind = spec["type"]
    m, nt, out = new_mat(kind + "_" + str(len(mats)))
    L = nt.links
    result = [m]
    if kind == "ui":
        p = principled(nt, "#030303", 0.3, 0.1, coat=0.3, coat_rough=0.1)
        t = tex_node(nt, image(spec["image"]), "EXTEND")
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 1.0
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        result = [m, edge_material()]
    elif kind == "sticker":
        t = tex_node(nt, image(spec["image"]), "CLIP")
        front = principled(nt, "#050505", 0.3, 0.2, coat=0.45, coat_rough=0.08)
        L.new(t.outputs["Color"], front.inputs["Emission Color"])
        front.inputs["Emission Strength"].default_value = 1.0
        back = principled(nt, "#EFEDE7", 0.6, 0.3)
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        side = nt.nodes.new("ShaderNodeMixShader")
        L.new(geo.outputs["Backfacing"], side.inputs["Fac"])
        L.new(front.outputs["BSDF"], side.inputs[1])
        L.new(back.outputs["BSDF"], side.inputs[2])
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        cut = nt.nodes.new("ShaderNodeMixShader")
        L.new(t.outputs["Alpha"], cut.inputs["Fac"])
        L.new(tr.outputs["BSDF"], cut.inputs[1])
        L.new(side.outputs["Shader"], cut.inputs[2])
        L.new(cut.outputs["Shader"], out.inputs["Surface"])
    elif kind == "toy" and spec["key"] == "paint":
        # a sculpted part: its colours and roughness are painted per vertex
        p = principled(nt, "#ffffff", 0.34, 0.5, coat=0.5, coat_rough=0.16)
        toyblend.vertex_paint(nt, p, spec.get("finish", "vinyl"))
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "toy" and FINISH.get(spec["key"]) in toyblend.MORE_FINISHES:
        p = principled(nt, TOY[spec["key"]], 0.34, 0.5)
        L.new(toyblend.finish(nt, p, FINISH[spec["key"]], rgba(TOY[spec["key"]])), out.inputs["Surface"])
    elif kind == "toy":
        k = spec["key"]
        fin = FINISH.get(k, "vinyl")
        lens, matte = fin == "lens", fin == "matte"
        p = principled(nt, TOY[k], 0.1 if lens else 0.55 if matte else 0.34, 0.5,
                       coat=1.0 if lens else 0.15 if matte else 0.5, coat_rough=0.03 if lens else 0.16)
        if fin == "soft":
            p.inputs["Subsurface Weight"].default_value = 0.08
            p.inputs["Subsurface Radius"].default_value = (0.004, 0.003, 0.003)
        if lens:
            p.inputs["Emission Color"].default_value = rgba(TOY[k])
            g = value_node(nt)
            mul = nt.nodes.new("ShaderNodeMath")
            mul.operation = "MULTIPLY_ADD"
            L.new(g.outputs[0], mul.inputs[0])
            mul.inputs[1].default_value = 1.6
            mul.inputs[2].default_value = 0.25
            L.new(mul.outputs[0], p.inputs["Emission Strength"])
            keyed.append(("glint", nt, g))
        if spec.get("paint"):
            toyblend.paint(nt, p, TOY, k, spec["paint"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "shine":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#ffffff")
        g = value_node(nt)
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY_ADD"
        L.new(g.outputs[0], mul.inputs[0])
        mul.inputs[1].default_value = 7.0
        mul.inputs[2].default_value = 1.4
        L.new(mul.outputs[0], e.inputs["Strength"])
        keyed.append(("glint", nt, g))
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "glass":
        p = principled(nt, "#0b0c0f", 0.14, 0.6, coat=0.9, coat_rough=0.04)
        p.inputs["Metallic"].default_value = 0.2
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "screen":
        p = principled(nt, "#050506", 0.2, 0.4, coat=0.8, coat_rough=0.05)
        t = tex_node(nt, image(spec["image"]), "REPEAT")
        L.new(t.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = spec["strength"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        g, gnt, gout = new_mat(kind + "_side_" + str(len(mats)))
        if spec.get("sides"):  # the 万 plate: glossy glass like the housing
            gp = principled(gnt, "#0b0c0f", 0.14, 0.6, coat=0.9, coat_rough=0.04)
        else:  # drum ends: matte, so they never mirror the next drum's digits
            gp = principled(gnt, "#060607", 0.85, 0.1)
        gnt.links.new(gp.outputs["BSDF"], gout.inputs["Surface"])
        result = [g, m] if spec.get("sides") else [m, g]
    elif kind == "type":  # 3D lettering and the 公众号 mark: glossy, lit a little from inside
        p = principled(nt, spec["color"], 0.22, 0.5, coat=0.8, coat_rough=0.05)
        p.inputs["Emission Color"].default_value = rgba(spec["color"])
        p.inputs["Emission Strength"].default_value = spec["emit"]
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "paper":  # torn labels: matte paper with a little grain
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 900.0
        nz.inputs["Detail"].default_value = 6.0
        L.new(tc.outputs["Object"], nz.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.88
        mr.inputs["To Max"].default_value = 1.04
        L.new(nz.outputs["Fac"], mr.inputs["Value"])
        tint = nt.nodes.new("ShaderNodeMix")
        tint.data_type = "RGBA"
        tint.blend_type = "MULTIPLY"
        tint.inputs["Factor"].default_value = 1.0
        tint.inputs[6].default_value = rgba(spec["color"])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        for ch in ("Red", "Green", "Blue"):
            L.new(mr.outputs["Result"], comb.inputs[ch])
        L.new(comb.outputs["Color"], tint.inputs[7])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.08
        L.new(nz.outputs["Fac"], bump.inputs["Height"])
        p = principled(nt, "#ffffff", 0.82, 0.3)
        L.new(tint.outputs[2], p.inputs["Base Color"])
        L.new(tint.outputs[2], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.12
        L.new(bump.outputs["Normal"], p.inputs["Normal"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "stage":  # the CTA floor: glass in the stage's tone that mirrors the line, fading out far away
        tc = nt.nodes.new("ShaderNodeTexCoord")
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.45, 0.45, 0.45)
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        L.new(mp.outputs["Vector"], grad.inputs["Vector"])
        p = principled(nt, LOOK.stage["glass"], 0.34, 0.4, coat=0.25, coat_rough=0.3)
        dark = nt.nodes.new("ShaderNodeBsdfDiffuse")
        dark.inputs["Color"].default_value = rgba(LOOK.stage["fade"])
        mx = nt.nodes.new("ShaderNodeMixShader")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        ramp.color_ramp.elements[1].position = 0.55
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
        L.new(ramp.outputs["Color"], mx.inputs["Fac"])
        L.new(dark.outputs["BSDF"], mx.inputs[1])
        L.new(p.outputs["BSDF"], mx.inputs[2])
        L.new(mx.outputs["Shader"], out.inputs["Surface"])
    elif kind == "glow":
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba(spec["color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "cover":
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tc.object = objs["wall"]
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / WALL_W, 1 / WALL_H, 1)
        mp.inputs["Location"].default_value = (0.5, 0, 0)
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        ta = tex_node(nt, image("assets/cover-wall.png"), "EXTEND")
        tb = tex_node(nt, image("assets/cover-full.png"), "EXTEND")
        L.new(mp.outputs["Vector"], ta.inputs["Vector"])
        L.new(mp.outputs["Vector"], tb.inputs["Vector"])
        mixv = value_node(nt, 1.0)
        keyed.append(("coverMix", nt, mixv))
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        L.new(mixv.outputs[0], mx.inputs["Factor"])
        L.new(ta.outputs["Color"], mx.inputs[6])
        L.new(tb.outputs["Color"], mx.inputs[7])
        col = mx.outputs[2]
        # sides of the pushed-out pieces: the same paper, in shade
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        L.new(tc.outputs["Normal"], sep.inputs["Vector"])
        ab = nt.nodes.new("ShaderNodeMath")
        ab.operation = "ABSOLUTE"
        L.new(sep.outputs["Z"], ab.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.35
        mr.inputs["From Max"].default_value = 0.85
        mr.inputs["To Min"].default_value = 0.5
        L.new(ab.outputs[0], mr.inputs["Value"])
        shade = nt.nodes.new("ShaderNodeMix")
        shade.data_type = "RGBA"
        shade.blend_type = "MULTIPLY"
        shade.inputs["Factor"].default_value = 1.0
        L.new(col, shade.inputs[6])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        for ch in ("Red", "Green", "Blue"):
            L.new(mr.outputs["Result"], comb.inputs[ch])
        L.new(comb.outputs["Color"], shade.inputs[7])
        flat = value_node(nt, 0.0)
        keyed.append(("coverFlat", nt, flat))
        # lit paper → the flat picture: base fades out, emission takes over
        lit = nt.nodes.new("ShaderNodeMix")
        lit.data_type = "RGBA"
        L.new(flat.outputs[0], lit.inputs["Factor"])
        L.new(shade.outputs[2], lit.inputs[6])
        lit.inputs[7].default_value = (0, 0, 0, 1)
        p = principled(nt, "#ffffff", 0.72, 0.3, coat=0.06, coat_rough=0.3)
        L.new(lit.outputs[2], p.inputs["Base Color"])
        L.new(shade.outputs[2], p.inputs["Emission Color"])
        em = nt.nodes.new("ShaderNodeMath")
        em.operation = "MULTIPLY_ADD"
        L.new(flat.outputs[0], em.inputs[0])
        em.inputs[1].default_value = 0.7
        em.inputs[2].default_value = 0.3
        L.new(em.outputs[0], p.inputs["Emission Strength"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        result = [m, edge_material()]
    elif kind == "card2d":  # the 2D mascot sticker: the cover's own shading, cut out by alpha
        tx = tex_node(nt, image(spec["image"]), "CLIP")
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        flat = value_node(nt, 0.0)
        keyed.append(("coverFlat", nt, flat))
        lit = nt.nodes.new("ShaderNodeMix")
        lit.data_type = "RGBA"
        L.new(flat.outputs[0], lit.inputs["Factor"])
        L.new(tx.outputs["Color"], lit.inputs[6])
        lit.inputs[7].default_value = (0, 0, 0, 1)
        p = principled(nt, "#ffffff", 0.72, 0.3, coat=0.06, coat_rough=0.3)
        L.new(lit.outputs[2], p.inputs["Base Color"])
        L.new(tx.outputs["Color"], p.inputs["Emission Color"])
        em = nt.nodes.new("ShaderNodeMath")
        em.operation = "MULTIPLY_ADD"
        L.new(flat.outputs[0], em.inputs[0])
        em.inputs[1].default_value = 0.7
        em.inputs[2].default_value = 0.3
        L.new(em.outputs[0], p.inputs["Emission Strength"])
        back = principled(nt, "#EFEDE7", 0.6, 0.3)
        side = nt.nodes.new("ShaderNodeMixShader")
        L.new(geo.outputs["Backfacing"], side.inputs["Fac"])
        L.new(p.outputs["BSDF"], side.inputs[1])
        L.new(back.outputs["BSDF"], side.inputs[2])
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        cut = nt.nodes.new("ShaderNodeMixShader")
        L.new(tx.outputs["Alpha"], cut.inputs["Fac"])
        L.new(tr.outputs["BSDF"], cut.inputs[1])
        L.new(side.outputs["Shader"], cut.inputs[2])
        L.new(cut.outputs["Shader"], out.inputs["Surface"])
    elif kind == "cover2":  # the pinned cover: one picture, mapped in wall2's space
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tc.object = objs["wall2"]
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / spec["w"], 1 / spec["h"], 1)
        mp.inputs["Location"].default_value = (0.5, 0, 0)
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        tx = tex_node(nt, image(FILM_JSON["posts"]["pinned"]["cover"]), "EXTEND")
        L.new(mp.outputs["Vector"], tx.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        L.new(tc.outputs["Normal"], sep.inputs["Vector"])
        ab = nt.nodes.new("ShaderNodeMath")
        ab.operation = "ABSOLUTE"
        L.new(sep.outputs["Z"], ab.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.35
        mr.inputs["From Max"].default_value = 0.85
        mr.inputs["To Min"].default_value = 0.5
        L.new(ab.outputs[0], mr.inputs["Value"])
        comb = nt.nodes.new("ShaderNodeCombineColor")
        for ch in ("Red", "Green", "Blue"):
            L.new(mr.outputs["Result"], comb.inputs[ch])
        shade = nt.nodes.new("ShaderNodeMix")
        shade.data_type = "RGBA"
        shade.blend_type = "MULTIPLY"
        shade.inputs["Factor"].default_value = 1.0
        L.new(tx.outputs["Color"], shade.inputs[6])
        L.new(comb.outputs["Color"], shade.inputs[7])
        p = principled(nt, "#ffffff", 0.72, 0.3, coat=0.06, coat_rough=0.3)
        L.new(shade.outputs[2], p.inputs["Base Color"])
        L.new(shade.outputs[2], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.3
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        result = [m, edge_material()]
    elif kind == "flake":
        info = nt.nodes.new("ShaderNodeObjectInfo")
        p = principled(nt, "#ffffff", 0.45, 0.5, coat=0.3)
        L.new(info.outputs["Color"], p.inputs["Base Color"])
        L.new(info.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 0.2
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "spark":
        info = nt.nodes.new("ShaderNodeObjectInfo")
        e = nt.nodes.new("ShaderNodeEmission")
        L.new(info.outputs["Color"], e.inputs["Color"])
        e.inputs["Strength"].default_value = spec["strength"]
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "floor":
        e = nt.nodes.new("ShaderNodeEmission")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.4, 0.4, 0.4)
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        cr.elements[0].color = rgba(LOOK.stage["floorEdge"])
        cr.elements[1].color = rgba(LOOK.stage["floorMid"])
        cr.elements.new(0.55).color = rgba(LOOK.stage["floorRing"])
        L.new(tc.outputs["Object"], mp.inputs["Vector"])
        L.new(mp.outputs["Vector"], grad.inputs["Vector"])
        L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
        L.new(ramp.outputs["Color"], e.inputs["Color"])
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "blob":
        p = principled(nt, "#000000", 0.6, 0.0)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (-1, -1, 0)
        mp.inputs["Scale"].default_value = (2, 2, 1)
        L.new(tc.outputs["UV"], mp.inputs["Vector"])
        L.new(mp.outputs["Vector"], grad.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        ramp.color_ramp.elements[1].position = 0.9
        ramp.color_ramp.elements[1].color = (0.8, 0.8, 0.8, 1)
        L.new(grad.outputs["Fac"], ramp.inputs["Fac"])
        k = nt.nodes.new("ShaderNodeMath")
        k.operation = "MULTIPLY"
        L.new(ramp.outputs["Color"], k.inputs[0])
        L.new(k.outputs["Value"], p.inputs["Alpha"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
        keyed.append(("blob", nt, k))
    else:
        raise ValueError(kind)
    mats[key] = result
    return result


# ── Geometry ────────────────────────────────────────────────────────────────
def mesh_from(name, verts, faces, uvs=None, mat_index=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        layer = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                layer.data[li].uv = uvs[vi] if not callable(uvs) else uvs(poly, vi)
    if mat_index:
        for i, poly in enumerate(me.polygons):
            poly.material_index = mat_index(i, poly)
    me.update()
    return me


def box_faces():
    return [(0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)]


def box_verts(x0, x1, y0, y1, z0, z1):
    return [(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]


def round_box_mesh(name, size, radius):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(radius, min(size) / 2 - 1e-5), segments=5, profile=0.5, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(30))
    return me


def sphere_mesh(name, r=(1, 1, 1), u=40, v=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=1.0)
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
    me = mesh_from(name, verts, faces)
    me.shade_smooth()
    return me


def octa_mesh(name, r):
    verts = [(r, 0, 0), (-r, 0, 0), (0, r, 0), (0, -r, 0), (0, 0, r), (0, 0, -r)]
    faces = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    return mesh_from(name, verts, faces)


def drum_mesh(name, r, w, n=72):
    # axis along x; angle a from the front (+z) towards the top (+y); v grows as a falls
    verts, faces, uv = [], [], {}
    for j in range(n + 1):
        a = math.pi / 10 - j * 2 * math.pi / n
        for i, x in enumerate((-w / 2, w / 2)):
            verts.append((x, r * math.sin(a), r * math.cos(a)))
            uv[len(verts) - 1] = (i, j / n)
    for j in range(n):
        a, b = 2 * j, 2 * (j + 1)
        faces.append((a, a + 1, b + 1, b))
    caps = []
    for i, x in enumerate((-w / 2, w / 2)):
        c0 = len(verts)
        for j in range(n):
            a = 2 * math.pi * j / n
            verts.append((x * 1.0, r * 0.999 * math.sin(a), r * 0.999 * math.cos(a)))
            uv[len(verts) - 1] = (0, 0)
        ring = list(range(c0, c0 + n))
        caps.append(tuple(ring if i else ring[::-1]))
    faces += caps
    me = mesh_from(name, verts, faces, uvs=lambda poly, vi: uv[vi], mat_index=lambda i, p: 1 if len(p.vertices) > 4 else 0)
    for p in me.polygons:
        p.use_smooth = len(p.vertices) == 4
    # make sure the side faces point outwards
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return me


def wall_slab_mesh(name, w, h, d):
    verts = box_verts(-w / 2, w / 2, 0, h, -d, 0)
    faces = box_faces()
    front = 5  # (4, 5, 7, 6): z = 0
    me = mesh_from(name, verts, faces, mat_index=lambda i, p: 0 if i == front else 1)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return me


mesh_cache = {}


def build_geo(o):
    g = o["geo"]
    t = g["type"]
    if t in ("octa",) or (t in ("box", "ellipsoid") and o["mat"]["type"] == "flake"):
        key = (t, json.dumps(g, sort_keys=True), json.dumps(o["mat"], sort_keys=True))
        if key not in mesh_cache:
            me = octa_mesh(o["name"], g["r"]) if t == "octa" else sphere_mesh(o["name"], g["r"], 16, 10) if t == "ellipsoid" else round_box_mesh(o["name"], g["size"], 0.0002)
            for mat in material(o["mat"]):
                me.materials.append(mat)
            mesh_cache[key] = me
        return mesh_cache[key]
    if t == "roundBox":
        me = round_box_mesh(o["name"], g["size"], g["radius"])
    elif t == "ellipsoid":
        me = sphere_mesh(o["name"], g["r"])
    elif t == "arc":
        me = arc_mesh(o["name"], g["radius"], g["tube"], g["arc"])
    elif t in ("blob", "tube", "prism", "loop", "plate", "mesh"):
        me = toyblend.part_mesh(o["name"], g, FILM)
    elif t == "uiBox":
        x0, y0, w, h = g["rect"]
        ux, uy, uw, uh = g["uvRect"]
        W, H = g["img"]["w"], g["img"]["h"]
        th = g["thickness"]
        verts = box_verts(x0 * MM, (x0 + w) * MM, -th, 0, y0 * MM, (y0 + h) * MM)
        uvs = [((ux + (v[0] / MM - x0)) / W, 1 - (uy + (v[2] / MM - y0)) / H) for v in verts]
        me = mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 0 if i == 3 else 1)
    elif t == "plane":
        w, h = g["w"], g["h"]
        if g.get("flat"):
            u0, v0, u1, v1 = g["uvB"]
            verts = [(-w / 2, 0, h / 2), (w / 2, 0, h / 2), (w / 2, 0, -h / 2), (-w / 2, 0, -h / 2)]
            uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
        else:
            verts = [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)]
            uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
        me = mesh_from(o["name"], verts, [(0, 1, 2, 3)], uvs)
    elif t == "box":
        sx, sy, sz = g["size"]
        verts = box_verts(-sx / 2, sx / 2, -sy / 2, sy / 2, -sz / 2, sz / 2)
        if g.get("frontImage"):
            uvs = [((v[0] + sx / 2) / sx, (v[1] + sy / 2) / sy) for v in verts]
            me = mesh_from(o["name"], verts, box_faces(), uvs, mat_index=lambda i, p: 1 if i == 5 else 0)
        else:
            me = mesh_from(o["name"], verts, box_faces())
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    elif t == "drum":
        me = drum_mesh(o["name"], g["r"], g["w"])
    elif t == "wallSlab":
        me = wall_slab_mesh(o["name"], g["w"], g["h"], g["d"])
    else:
        raise ValueError(t)
    for mat in material(o["mat"]) if o.get("mat") else []:
        me.materials.append(mat)
    return me


def ring_curve(name, rings, g):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = g["depth"] / 2
    cu.bevel_depth = g.get("bevel", 0.0005)
    cu.bevel_resolution = 2
    cu.resolution_u = 1
    for ring in rings:
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for p, (x, y) in zip(sp.points, ring):
            p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    return cu


def inside(pt, ring):
    """Ray casting: whether pt is inside the closed ring."""
    x, y = pt
    c = False
    for i in range(len(ring)):
        (x0, y0), (x1, y1) = ring[i - 1], ring[i]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def islands(rings):
    """The rings grouped into islands: an outer ring (inside an even number of others) and the holes right inside
    it. Blender's fill decides the holes of all a curve's rings at once, and two islands side by side can fool it
    into taking one for a hole of the other: 优's 亻 touches its 尤 at a point, and most of 亻 went unfilled. A
    ring is inside another when most of its points are."""
    area = lambda r: abs(0.5 * sum(r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1] for i in range(len(r))))  # noqa: E731
    box = [(min(x for x, _ in r), min(y for _, y in r), max(x for x, _ in r), max(y for _, y in r)) for r in rings]
    def within(i, j):  # (two dozen of its points are enough to tell)
        a, b = box[i], box[j]
        if a[0] < b[0] or a[1] < b[1] or a[2] > b[2] or a[3] > b[3]:
            return False
        pts = rings[i][:: max(1, len(rings[i]) // 24)]
        return sum(inside(p, rings[j]) for p in pts) > len(pts) / 2
    holders = [[j for j in range(len(rings)) if j != i and within(i, j)] for i in range(len(rings))]
    groups = {i: [rings[i]] for i, h in enumerate(holders) if len(h) % 2 == 0}
    for i, h in enumerate(holders):
        if len(h) % 2:
            own = min((j for j in h if j in groups), key=lambda j: area(rings[j]), default=None)
            (groups[own] if own is not None else groups.setdefault(i, [])).append(rings[i])
    return list(groups.values())


def curve_piece(o):
    """Lettering or a cover piece: its outline rings filled, extruded and bevelled. One island is a curve as
    ever; several are each filled on their own and joined into one mesh."""
    g = o["geo"]
    parts = islands(g["rings"])
    if len(parts) <= 1:
        data = ring_curve(o["name"], g["rings"], g)
    else:
        bm = bmesh.new()
        for k, rings in enumerate(parts):
            cu = ring_curve(f"{o['name']}.{k}", rings, g)
            tmp = bpy.data.objects.new(cu.name, cu)
            bpy.context.scene.collection.objects.link(tmp)
            me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
            bm.from_mesh(me)
            bpy.data.objects.remove(tmp)
            bpy.data.curves.remove(cu)
            bpy.data.meshes.remove(me)
        data = bpy.data.meshes.new(o["name"])
        bm.to_mesh(data)
        bm.free()
    for mat in material(o["mat"]):
        data.materials.append(mat)
    return data


# ── Keys straight into the F-curves ─────────────────────────────────────────
_bags = {}


def channelbag(idblock):
    if idblock.as_pointer() in _bags:
        return _bags[idblock.as_pointer()]
    idblock.animation_data_create()
    act = bpy.data.actions.new(idblock.name + "_act")
    idblock.animation_data.action = act
    slot = idblock.animation_data.action_slot
    if slot is None:
        slot = act.slots.new(id_type=idblock.id_type, name=idblock.name)
        idblock.animation_data.action_slot = slot
    _bags[idblock.as_pointer()] = anim_utils.action_ensure_channelbag_for_slot(act, slot)
    return _bags[idblock.as_pointer()]


LINEAR = bpy.types.Keyframe.bl_rna.properties["interpolation"].enum_items["LINEAR"].value


CONSTANT = bpy.types.Keyframe.bl_rna.properties["interpolation"].enum_items["CONSTANT"].value


def curve(cb, path, index, frames, values, interp=LINEAR):
    fc = cb.fcurves.new(path, index=index)
    n = len(frames)
    fc.keyframe_points.add(n)
    co = np.empty(2 * n, dtype=np.float32)
    co[0::2] = frames
    co[1::2] = values
    fc.keyframe_points.foreach_set("co", co)
    fc.keyframe_points.foreach_set("interpolation", np.full(n, interp, dtype=np.int32))
    fc.update()


def set_trs(ob, tr):
    ob.location = tr[0:3]
    ob.rotation_quaternion = (tr[6], tr[3], tr[4], tr[5])
    ob.scale = tr[7:10]


# ── Objects ─────────────────────────────────────────────────────────────────
WALL_W = WALL_H = None
for o in DATA["objects"]:
    if o["geo"] and o["geo"]["type"] == "wallSlab":
        WALL_W, WALL_H = o["geo"]["w"], o["geo"]["h"]
objs = {"root": root}
t0 = time.time()
for o in DATA["objects"]:
    name = o["name"]
    if o.get("camera"):
        cam = bpy.data.cameras.new("Camera")
        cam.sensor_fit = "VERTICAL"
        cam.sensor_height = 24
        cam.clip_start = 0.005
        cam.clip_end = 40
        cam.dof.use_dof = True
        cam.dof.aperture_blades = 7
        ob = bpy.data.objects.new("Camera", cam)
        scene.camera = ob
    elif o.get("light"):
        ld = bpy.data.lights.new(name, "POINT")
        ld.shadow_soft_size = 0.02
        ld.energy = 0
        ob = bpy.data.objects.new(name, ld)
        ob.visible_glossy = False
    elif o["geo"] is None:
        ob = bpy.data.objects.new(name, None)
    elif o["geo"]["type"] == "curve":
        ob = bpy.data.objects.new(name, curve_piece(o))
    else:
        ob = bpy.data.objects.new(name, build_geo(o))
    scene.collection.objects.link(ob)
    ob.parent = objs[o["parent"]]
    ob.rotation_mode = "QUATERNION"
    set_trs(ob, o["tr"])
    objs[name] = ob
    if name.startswith(("strip_", "blob")):
        ob.visible_shadow = name.startswith("strip_")
print(f"objects built in {time.time() - t0:.1f}s", flush=True)

t0 = time.time()
STEP = {o["name"] for o in DATA["objects"] if o.get("step")}  # digits that swap: no in-between
for name, keys in DATA["tracks"].items():
    ob = objs[name]
    k = np.asarray(keys, dtype=np.float64)
    frames = 1 + k[:, 0] / SUB
    set_trs(ob, k[0, 1:])
    cb = channelbag(ob)
    it = CONSTANT if name in STEP else LINEAR
    for i in range(3):
        curve(cb, "location", i, frames, k[:, 1 + i], it)
    for i, c in enumerate((7, 4, 5, 6)):  # w x y z
        curve(cb, "rotation_quaternion", i, frames, k[:, c], it)
    for i in range(3):
        curve(cb, "scale", i, frames, k[:, 8 + i], it)
    if name in DATA["colors"]:
        ck = np.asarray(DATA["colors"][name], dtype=np.float64)
        cf = 1 + ck[:, 0]
        lin = np.where(ck[:, 1:4] <= 0.04045, ck[:, 1:4] / 12.92, ((ck[:, 1:4] + 0.055) / 1.055) ** 2.4)
        for i in range(3):
            curve(cb, "color", i, cf, lin[:, i])
        curve(cb, "color", 3, cf, ck[:, 4])
print(f"object keys in {time.time() - t0:.1f}s", flush=True)

# the rim follows the camera (not in the classic look): it comes from behind the toy as the camera sees it,
# and from above, so it outlines the head and shoulders in every shot, whichever way the camera turns
if not LOOK.classic and "camera" in DATA["tracks"]:
    k = np.asarray(DATA["tracks"]["camera"], dtype=np.float64)
    x, y, z, w = k[:, 4:8].T
    away = -np.stack([2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)], axis=1)  # the camera's -z
    rots, prev = [], None
    for d in away:
        r = lighting.rim_behind(d)
        if prev is not None and r.dot(prev) < 0:
            r.negate()  # the shorter way between keys
        rots.append(r)
        prev = r
    RIM.rotation_mode = "QUATERNION"
    cb = channelbag(RIM)
    for i in range(4):  # w x y z
        curve(cb, "rotation_quaternion", i, 1 + k[:, 0] / SUB, np.array([r[i] for r in rots]))

cam = objs["camera"].data
cb = channelbag(cam)
fr = 1 + np.arange(DATA["samples"]) / SUB
curve(cb, "lens", 0, fr, 12 / np.tan(np.radians(np.asarray(SC["fov"])) / 2))
curve(cb, "dof.focus_distance", 0, fr, np.asarray(SC["focus"]))
curve(cb, "dof.aperture_fstop", 0, fr, np.asarray(SC["fstop"]))

ff = 1 + np.arange(DATA["frames"])
for name, nt, node in keyed:
    sock = node.outputs[0] if node.bl_idname == "ShaderNodeValue" else node.inputs[1]
    path = f'nodes["{node.name}"].outputs[0].default_value' if node.bl_idname == "ShaderNodeValue" else f'nodes["{node.name}"].inputs[1].default_value'
    curve(channelbag(nt), path, 0, ff, np.asarray(SC[name]))
ld = objs["fx"].data
cb = channelbag(ld)
curve(cb, "energy", 0, ff, np.asarray(SC["fx_energy"]))
cols = np.asarray(SC["fx_color"])
for i in range(3):
    curve(cb, "color", i, ff, cols[:, i])

# look-dev: --hide name_,cta_ leaves those objects out of the render (background plates)
for prefix in arg("--hide", "").split(","):
    if prefix:
        for name, ob in objs.items():
            if name.startswith(prefix):
                ob.hide_render = True
# the rim light falls on the toy alone (and what look.rimOn names: a dark prop, say)
if not LOOK.classic:
    n = lighting.rim_on(bpy, RIM, [ob for name, ob in objs.items() if any(name == p or name.startswith(p + "_") for p in LOOK.rim_on)], LOOK)
    print(f"rim light on {n} objects ({', '.join(LOOK.rim_on)})", flush=True)
print(f"built: {len(objs)} objects, {len(DATA['tracks'])} animated", flush=True)
if "--save" in argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / arg("--save", "build/scene.blend")))

# ── Render ──────────────────────────────────────────────────────────────────
spec = arg("--frames", None)
if spec:
    OUT.mkdir(parents=True, exist_ok=True)
    # "1-720", "13,49,121" or both: "1-20,45,60-64"
    frames = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        frames += list(range(int(a), int(b or a) + 1))
    # --resume: frames already on disk stay (a long render picks up where it stopped)
    todo = [f for f in frames if not ("--resume" in argv and (OUT / f"{f:04d}.png").exists())]
    if len(todo) < len(frames):
        print(f"resuming: {len(frames) - len(todo)} frames already in {OUT.name}/", flush=True)
    spent = 0.0
    for n, f in enumerate(todo, 1):
        t0 = time.time()
        scene.frame_set(f)
        scene.render.filepath = str(OUT / f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        spent += time.time() - t0
        left = spent / n * (len(todo) - n)
        print(f"rendered frame {f} in {time.time() - t0:.1f}s ({n}/{len(todo)}, about {left / 60:.0f} min to go)", flush=True)
