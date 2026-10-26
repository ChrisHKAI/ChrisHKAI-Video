"""Builds the film's world in Blender from build/anim.json and renders it in
Cycles: the 2007 keynote stage (or the white studio), its big screen playing
the feed (build/tv/####.jpg) and then the slide, Tim, Steve Jobs and the Duo
(vinyl toy parts, scripts/toy.py), the follow spot, the fold counter (3D
lettering), and the iPhone 4S at the end, Messages on its screen
(build/imsg/####.png). Keys go straight into the F-curves.

usage:
  blender -b --factory-startup -P scripts/scene.py -- \\
      [--anim build/anim.json] [--frames 1-120,1791-3379 | --frames 13,49,121] \\
      [--samples 128] [--scale 100] [--out build/render] [--no-blur] [--save build/scene.blend]
"""
import json
import math
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from bpy_extras import anim_utils

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from relief import build_relief  # noqa: E402
from toy import part_material, part_mesh, rgba, round_box_mesh  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


DATA = json.loads((ROOT / arg("--anim", "build/anim.json")).read_text())
SAMPLES = int(arg("--samples", 128))
SCALE = int(arg("--scale", 100))
OUT = ROOT / arg("--out", "build/render")
SUB = DATA["sub"]
HERO = {"colors": DATA["palette"], "finish": DATA["finish"]}
RIG = "rig" if "rig" in DATA["scalars"] else "screen"  # what the beams and the lamps overhead follow
IMAGES = {"duoScreen": str(ROOT / "assets/duo-screen.png"), "duoCover": str(ROOT / "assets/duo-cover.png")}
# the keynote slide under "iPhone Duo", foot (0) to top (1) of the big screen
SLIDES = {
    # bright: lavender at the foot to deep blue at the top
    "purple": [(0, "#a39be4"), (0.45, "#5a52c2"), (1, "#201e64")],
    # as the 2007 slide reads on the tape: black over the top third, deep
    # violet, a dusky lavender at the foot (sampled from the keynote at 46.6 s)
    "2007": [(0, "#625d8c"), (0.24, "#585581"), (0.38, "#4a447c"), (0.52, "#332a5f"), (0.67, "#130a3a"), (0.81, "#08031f"), (0.95, "#000008"), (1, "#000006")],
    # black, the words alone
    "black": [(0, "#030305"), (1, "#030305")],
}
SLIDE = arg("--slide", DATA.get("set", {}).get("slide", "purple"))

# ── Scene ───────────────────────────────────────────────────────────────────
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
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = float(arg("--threshold", 0.015))
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.denoising_use_gpu = "--gpu-denoise" in argv
scene.cycles.max_bounces = int(arg("--bounces", 6))
scene.cycles.glossy_bounces = int(arg("--glossy", 3))
scene.cycles.transmission_bounces = 4
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 0.5
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = SCALE
scene.render.fps = DATA["fps"]
scene.frame_start = 1
scene.frame_end = DATA["frames"]
scene.render.use_motion_blur = "--no-blur" not in argv
scene.render.motion_blur_shutter = 0.5
scene.render.motion_blur_position = "CENTER"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_depth = "8"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.render.use_persistent_data = True

world = bpy.data.worlds.new("Studio")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = rgba("#eef1f6")
bg.inputs["Strength"].default_value = 0.22

root = bpy.data.objects.new("THREE", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.pi / 2, 0, 0)

# ── Materials ───────────────────────────────────────────────────────────────
part_cache = {}
mats = {}
keyed = []  # (scalar, node tree, socket path, factor)


def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def principled(nt, base, rough=0.4, spec=0.5, coat=0.0, coat_rough=0.1):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = rgba(base)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = spec
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    return p


def material(spec):
    key = json.dumps(spec, sort_keys=True)
    if key in mats:
        return mats[key]
    kind = spec["type"]
    m, nt, out = new_mat(kind)
    L = nt.links
    if kind == "floor":  # white studio floor: a soft gloss that mirrors a little
        p = principled(nt, "#e9ebee", 0.2, 0.5, coat=0.35, coat_rough=0.12)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "wall":  # white panels with fine seams
        tc = nt.nodes.new("ShaderNodeTexCoord")
        br = nt.nodes.new("ShaderNodeTexBrick")
        br.inputs["Scale"].default_value = 3.0
        br.inputs["Mortar Size"].default_value = 0.004
        br.inputs["Mortar Smooth"].default_value = 0.6
        br.inputs["Brick Width"].default_value = 0.5
        br.inputs["Row Height"].default_value = 0.5
        br.offset = 0.0
        br.inputs["Color1"].default_value = rgba("#e8eaee")
        br.inputs["Color2"].default_value = rgba("#e5e8ec")
        br.inputs["Mortar"].default_value = rgba("#c9ccd2")
        L.new(tc.outputs["Object"], br.inputs["Vector"])
        p = principled(nt, "#e8eaee", 0.55, 0.3)
        L.new(br.outputs["Color"], p.inputs["Base Color"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "portal":  # the door of light: a hot core, softer toward its edges
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (-1.0, -1.0, 0)
        mp.inputs["Scale"].default_value = (2.0, 2.0, 1.0)
        L.new(tc.outputs["UV"], mp.inputs["Vector"])
        ln = nt.nodes.new("ShaderNodeVectorMath")
        ln.operation = "LENGTH"
        L.new(mp.outputs["Vector"], ln.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.0
        mr.inputs["From Max"].default_value = 1.2
        mr.inputs["To Min"].default_value = 1.0
        mr.inputs["To Max"].default_value = 0.3
        L.new(ln.outputs["Value"], mr.inputs["Value"])
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#fffaf2")
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        L.new(mr.outputs["Result"], mul.inputs[0])
        L.new(mul.outputs["Value"], e.inputs["Strength"])
        keyed.append(("portal", nt, f'nodes["{mul.name}"].inputs[1].default_value', 9.0))
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "lightFigure":  # Steve Jobs as a figure of white light: brightest where he faces us
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.5
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 1.0
        mr.inputs["To Max"].default_value = 0.55
        L.new(lw.outputs["Facing"], mr.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        L.new(mr.outputs["Result"], mul.inputs[0])
        keyed.append(("figure", nt, f'nodes["{mul.name}"].inputs[1].default_value', 1.7))
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#fffaf3")
        L.new(mul.outputs["Value"], e.inputs["Strength"])
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "figureHalo":  # the glow round his head in the close-up
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (-1.0, -1.0, 0)
        mp.inputs["Scale"].default_value = (2.0, 2.0, 1.0)
        L.new(tc.outputs["UV"], mp.inputs["Vector"])
        ln = nt.nodes.new("ShaderNodeVectorMath")
        ln.operation = "LENGTH"
        L.new(mp.outputs["Vector"], ln.inputs[0])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Max"].default_value = 1.0
        mr.inputs["To Min"].default_value = 1.0
        mr.inputs["To Max"].default_value = 0.0
        mr.interpolation_type = "SMOOTHSTEP"
        L.new(ln.outputs["Value"], mr.inputs["Value"])
        pw = nt.nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.inputs[1].default_value = 2.0
        L.new(mr.outputs["Result"], pw.inputs[0])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        L.new(pw.outputs["Value"], mul.inputs[0])
        keyed.append(("figure", nt, f'nodes["{mul.name}"].inputs[1].default_value', 1.3))
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#fff7ee")
        L.new(mul.outputs["Value"], e.inputs["Strength"])
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    elif kind == "silhouette":  # (unused) a dark figure with a rim of light
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.inputs["Blend"].default_value = 0.12
        pw = nt.nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.inputs[1].default_value = 5.0
        L.new(lw.outputs["Facing"], pw.inputs[0])
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#fff4e6")
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        L.new(pw.outputs["Value"], mul.inputs[0])
        L.new(mul.outputs["Value"], e.inputs["Strength"])
        keyed.append(("portal", nt, f'nodes["{mul.name}"].inputs[1].default_value', 7.0))
        d = principled(nt, "#020203", 0.6, 0.15)
        add = nt.nodes.new("ShaderNodeAddShader")
        L.new(d.outputs["BSDF"], add.inputs[0])
        L.new(e.outputs["Emission"], add.inputs[1])
        L.new(add.outputs["Shader"], out.inputs["Surface"])
    elif kind == "halo":  # a soft glow card behind the door: radial falloff, additive
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (-0.5, -0.5, 0)
        L.new(tc.outputs["UV"], mp.inputs["Vector"])
        grad = nt.nodes.new("ShaderNodeTexGradient")
        grad.gradient_type = "SPHERICAL"
        sc = nt.nodes.new("ShaderNodeMapping")
        sc.inputs["Scale"].default_value = (2.0, 2.0, 1.0)
        L.new(mp.outputs["Vector"], sc.inputs["Vector"])
        L.new(sc.outputs["Vector"], grad.inputs["Vector"])
        pw = nt.nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.inputs[1].default_value = 2.2
        L.new(grad.outputs["Fac"], pw.inputs[0])
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#fff6ea")
        keyed.append(("portal", nt, f'nodes["{e.name}"].inputs["Strength"].default_value', 0.9))
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        add = nt.nodes.new("ShaderNodeAddShader")
        mx = nt.nodes.new("ShaderNodeMixShader")
        L.new(pw.outputs["Value"], mx.inputs["Fac"])
        L.new(tr.outputs["BSDF"], mx.inputs[1])
        L.new(e.outputs["Emission"], add.inputs[0])
        L.new(tr.outputs["BSDF"], add.inputs[1])
        L.new(add.outputs["Shader"], mx.inputs[2])
        L.new(mx.outputs["Shader"], out.inputs["Surface"])
        m.blend_method = "BLEND"
    elif kind == "countType":  # the count: white numerals, lit a little from within
        p = principled(nt, "#f4f6f8", 0.22, 0.5, coat=0.8, coat_rough=0.05)
        p.inputs["Emission Color"].default_value = rgba("#f4f6f8")
        p.inputs["Emission Strength"].default_value = 0.55
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "countEdge":  # their dark twins behind
        p = principled(nt, "#16171b", 0.35, 0.5, coat=0.4, coat_rough=0.1)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "paper":  # torn labels: matte paper with a little grain (as in kingao-intro)
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
    elif kind == "labelType":  # raised letters on the labels: glossy ink
        p = principled(nt, spec["color"], 0.22, 0.5, coat=0.8, coat_rough=0.05)
        p.inputs["Emission Color"].default_value = rgba(spec["color"])
        p.inputs["Emission Strength"].default_value = 0.0 if spec["color"] == "#161514" else 0.12
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "titleType":  # (unused) light lettering, lit from within
        p = principled(nt, "#f7f4ee", 0.3, 0.5, coat=0.6, coat_rough=0.06)
        p.inputs["Emission Color"].default_value = rgba("#fffaf2")
        p.inputs["Emission Strength"].default_value = 0.9
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "dropType":  # its dark drop, so it reads on light too
        p = principled(nt, "#050506", 0.6, 0.2)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "card":  # lit a little from within, so it reads in the dark
        p = principled(nt, "#f6f4ef", 0.5, 0.4, coat=0.2, coat_rough=0.2)
        p.inputs["Emission Color"].default_value = rgba("#f6f4ef")
        p.inputs["Emission Strength"].default_value = 0.35
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "ink":
        p = principled(nt, "#151417", 0.3, 0.5, coat=0.5, coat_rough=0.08)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "deck":  # the stage floor: dark grey, a satin sheen, scuffed
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 40.0
        nz.inputs["Detail"].default_value = 8.0
        L.new(tc.outputs["Object"], nz.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = 0.3
        mr.inputs["To Max"].default_value = 0.5
        L.new(nz.outputs["Fac"], mr.inputs["Value"])
        p = principled(nt, "#36363c", 0.38, 0.5, coat=0.2, coat_rough=0.2)
        L.new(mr.outputs["Result"], p.inputs["Roughness"])
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "deckEdge":
        p = principled(nt, "#0e0e11", 0.5, 0.4)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "house":
        p = principled(nt, "#050507", 0.9, 0.2)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "drape":  # black velvet
        p = principled(nt, "#07070a", 0.95, 0.1)
        p.inputs["Sheen Weight"].default_value = 0.4
        p.inputs["Sheen Tint"].default_value = rgba("#3a3a55")
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "stageBlack":
        p = principled(nt, "#0b0b0e", 0.35, 0.5, coat=0.3, coat_rough=0.15)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "crowd":  # the house: dark heads and shoulders that catch the stage's spill
        p = principled(nt, "#0b0b0e", 0.62, 0.35)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind in ("keynoteScreen", "beam"):
        # the slide (SLIDES), from its foot to its top; the beams: blue-violet light raking up the drapes, soft at the sides, fading up
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        L.new(tc.outputs["UV"], sep.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp
        if kind == "keynoteScreen":
            stops = SLIDES[SLIDE]
            cr.elements[0].color, cr.elements[1].color = rgba(stops[0][1]), rgba(stops[-1][1])
            for pos, c in stops[1:-1]:
                cr.elements.new(pos).color = rgba(c)
        else:
            cr.elements[0].color = rgba("#5b56e8")
            cr.elements[1].color = (0, 0, 0, 1)
            cr.elements[1].position = 0.75
        L.new(sep.outputs["Y"], ramp.inputs["Fac"])
        e = nt.nodes.new("ShaderNodeEmission")
        L.new(ramp.outputs["Color"], e.inputs["Color"])
        if kind == "beam":
            # a soft edge across the beam: 4u(1-u), squared
            a = nt.nodes.new("ShaderNodeMath")
            a.operation = "MULTIPLY"
            L.new(sep.outputs["X"], a.inputs[0])
            inv = nt.nodes.new("ShaderNodeMath")
            inv.operation = "SUBTRACT"
            inv.inputs[0].default_value = 1.0
            L.new(sep.outputs["X"], inv.inputs[1])
            L.new(inv.outputs["Value"], a.inputs[1])
            pw = nt.nodes.new("ShaderNodeMath")
            pw.operation = "POWER"
            pw.inputs[1].default_value = 1.2
            sc = nt.nodes.new("ShaderNodeMath")
            sc.operation = "MULTIPLY"
            sc.inputs[1].default_value = 4.0
            L.new(a.outputs["Value"], sc.inputs[0])
            L.new(sc.outputs["Value"], pw.inputs[0])
            mul = nt.nodes.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            L.new(pw.outputs["Value"], mul.inputs[0])
            L.new(mul.outputs["Value"], e.inputs["Strength"])
            keyed.append((RIG, nt, f'nodes["{mul.name}"].inputs[1].default_value', 1.1))
            tr = nt.nodes.new("ShaderNodeBsdfTransparent")
            add = nt.nodes.new("ShaderNodeAddShader")
            L.new(e.outputs["Emission"], add.inputs[0])
            L.new(tr.outputs["BSDF"], add.inputs[1])
            L.new(add.outputs["Shader"], out.inputs["Surface"])
            m.blend_method = "BLEND"
        else:
            # the slide: "iPhone Duo" in white over it
            # (assets/keynote-iphone-duo.png, scripts/slide.py)
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(str(ROOT / "assets/keynote-iphone-duo.png"))
            tex.image.colorspace_settings.name = "Non-Color"
            L.new(tc.outputs["UV"], tex.inputs["Vector"])
            word = nt.nodes.new("ShaderNodeMath")
            word.operation = "MULTIPLY"
            L.new(tex.outputs["Color"], word.inputs[0])
            keyed.append(("word", nt, f'nodes["{word.name}"].inputs[1].default_value', 1.0))
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            L.new(word.outputs["Value"], mix.inputs["Factor"])
            L.new(ramp.outputs["Color"], mix.inputs["A"])
            mix.inputs["B"].default_value = rgba("#f4f2ff")
            L.new(mix.outputs["Result"], e.inputs["Color"])
            keyed.append(("screen", nt, f'nodes["{e.name}"].inputs["Strength"].default_value', 1.15))
            # before it: the feed (build/tv/####.jpg, film frames), until it dies
            ft = nt.nodes.new("ShaderNodeTexImage")
            img = bpy.data.images.load(str(ROOT / "build/tv/0001.jpg"))
            img.source = "SEQUENCE"
            ft.image = img
            ft.image_user.frame_duration = DATA["frames"]
            ft.image_user.frame_start = 1
            ft.image_user.use_auto_refresh = True
            ft.extension = "EXTEND"
            L.new(tc.outputs["UV"], ft.inputs["Vector"])
            fe = nt.nodes.new("ShaderNodeEmission")
            L.new(ft.outputs["Color"], fe.inputs["Color"])
            keyed.append(("feed", nt, f'nodes["{fe.name}"].inputs["Strength"].default_value', 1.15))
            both = nt.nodes.new("ShaderNodeAddShader")
            L.new(e.outputs["Emission"], both.inputs[0])
            L.new(fe.outputs["Emission"], both.inputs[1])
            L.new(both.outputs["Shader"], out.inputs["Surface"])
    elif kind == "steel":  # the iPhone 4S's band: polished stainless steel
        p = principled(nt, "#cfd2d6", 0.13, 0.5)
        p.inputs["Metallic"].default_value = 1.0
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneGlass":  # its black glass, front and back
        p = principled(nt, "#030304", 0.03, 0.5, coat=1.0, coat_rough=0.02)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneButton":
        p = principled(nt, "#0a0a0c", 0.25, 0.5, coat=0.6, coat_rough=0.1)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneGrey":  # the square on the home button
        p = principled(nt, "#4b4e55", 0.35, 0.5)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneGrille":  # the earpiece's mesh
        p = principled(nt, "#1e1f23", 0.65, 0.3)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneLens":
        p = principled(nt, "#07080b", 0.05, 0.5, coat=1.0, coat_rough=0.02)
        L.new(p.outputs["BSDF"], out.inputs["Surface"])
    elif kind == "phoneScreen":
        # Messages (build/imsg/####.png, film frames, scripts/imessage.py) under the
        # glass: lit while the screen is on ("phone"), the glass's reflections over it
        seq = sorted((ROOT / "build/imsg").glob("*.png"))
        tc = nt.nodes.new("ShaderNodeTexCoord")
        ft = nt.nodes.new("ShaderNodeTexImage")
        img = bpy.data.images.load(str(seq[0]))
        img.source = "SEQUENCE"
        ft.image = img
        first = int(seq[0].stem)
        ft.image_user.frame_start = first
        ft.image_user.frame_offset = first - 1
        ft.image_user.frame_duration = len(seq)
        ft.image_user.use_auto_refresh = True
        ft.interpolation = "Cubic"
        L.new(tc.outputs["UV"], ft.inputs["Vector"])
        e = nt.nodes.new("ShaderNodeEmission")
        L.new(ft.outputs["Color"], e.inputs["Color"])
        keyed.append(("phone", nt, f'nodes["{e.name}"].inputs["Strength"].default_value', 1.0))
        g = principled(nt, "#000000", 0.03, 0.5)
        add = nt.nodes.new("ShaderNodeAddShader")
        L.new(e.outputs["Emission"], add.inputs[0])
        L.new(g.outputs["BSDF"], add.inputs[1])
        L.new(add.outputs["Shader"], out.inputs["Surface"])
    elif kind == "fixture":  # the lamps in the rig overhead
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = rgba("#fff1dc")
        keyed.append((RIG, nt, f'nodes["{e.name}"].inputs["Strength"].default_value', 9.0))
        L.new(e.outputs["Emission"], out.inputs["Surface"])
    else:
        raise ValueError(kind)
    mats[key] = m
    return m


# ── Geometry ────────────────────────────────────────────────────────────────
def plane_mesh(name, w, h):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for li, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[li].uv = c
    return me


def crowd_mesh(name, g):
    """The house: raked rows of seated toy people (a head on a pair of shoulders), staggered and jittered."""
    rng = np.random.default_rng(7)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1.0)
    sv = np.array([v.co[:] for v in bm.verts])
    sf = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    blobs = []  # (centre, radii): shoulders, then a head
    for r in range(g["rows"]):
        z, y0 = g["z0"] + r * g["row"], g["floor"] + r * g["rake"]
        for x in np.arange(-g["x"] + (r % 2) * g["seat"] / 2, g["x"], g["seat"]):
            j = rng.normal(0, 0.004, 3)
            blobs.append(((x + j[0], y0 + 0.045, z + j[2]), (0.021, 0.03, 0.015)))
            blobs.append(((x + j[0] * 1.5, y0 + 0.083 + j[1], z + j[2] - 0.002), (0.0135, 0.0145, 0.0135)))
    c = np.array([b[0] for b in blobs])[:, None, :]
    s = np.array([b[1] for b in blobs])[:, None, :]
    verts = (sv[None] * s + c).reshape(-1, 3)
    n = len(sv)
    faces = [[i + k * n for i in f] for k in range(len(blobs)) for f in sf]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces)
    me.shade_smooth()
    return me


def glyph_curve(name, g, mat):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    cu.extrude = g["depth"] / 2
    cu.bevel_depth = g.get("bevel", 0.0003)
    cu.bevel_resolution = 2
    cu.resolution_u = 1
    for ring in g["rings"]:
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for p, (x, y) in zip(sp.points, ring):
            p.co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    cu.materials.append(mat)
    return cu


def set_trs(ob, tr):
    ob.location = tr[0:3]
    ob.rotation_quaternion = (tr[6], tr[3], tr[4], tr[5])
    ob.scale = tr[7:10]


objs = {"root": root}
lights = []
t0 = time.time()
for o in DATA["objects"]:
    name, g = o["name"], o["geo"]
    if g is None:
        ob = bpy.data.objects.new(name, None)
    elif g["type"] == "camera":
        cam = bpy.data.cameras.new("Camera")
        cam.sensor_fit = "VERTICAL"
        cam.sensor_height = 24
        cam.clip_start = 0.004
        cam.clip_end = 30
        cam.dof.use_dof = True
        cam.dof.aperture_blades = 7
        ob = bpy.data.objects.new("camera", cam)
        scene.camera = ob
    elif g["type"] == "light":
        ld = bpy.data.lights.new(name, "AREA")
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = g["size"], g["sizeY"]
        ld.color = rgba("#fff6ec")[:3]
        ob = bpy.data.objects.new(name, ld)
        lights.append(("portalLight", ld, 2.0))
    elif g["type"] == "areaLight":
        ld = bpy.data.lights.new(name, "AREA")
        ld.shape = "DISK"
        ld.size = g["size"]
        ld.energy = g["energy"]
        ld.color = rgba(g["color"])[:3]
        ob = bpy.data.objects.new(name, ld)
        if "key" in g:
            lights.append((g["key"], ld, g["energy"]))
    elif g["type"] == "curve":
        ob = bpy.data.objects.new(name, glyph_curve(name, g, material(o["mat"])))
    elif g["type"] == "spotLight":  # the follow spot: a hard-edged warm white pool
        ld = bpy.data.lights.new(name, "SPOT")
        ld.shadow_soft_size = g["radius"]
        ld.spot_blend = g["blend"]
        ld.color = rgba("#fff3e2")[:3]
        ob = bpy.data.objects.new(name, ld)
        lights.append(("spot", ld, 1100.0))
    elif g["type"] == "relief":
        ob = build_relief(scene, None, g["height"])
        scene.collection.objects.unlink(ob)
    elif g["type"] == "glyph":
        ob = bpy.data.objects.new(name, glyph_curve(name, g, material(o["mat"])))
    else:
        if g["type"] == "part":
            me = part_mesh(g["part"])
            figure = g["part"]["mat"].startswith("hum.")
            me.materials.append(material({"type": "lightFigure"}) if figure else part_material(g["part"], HERO, part_cache, IMAGES))
        elif g["type"] == "plane":
            me = plane_mesh(name, g["w"], g["h"])
            me.materials.append(material(o["mat"]))
        elif g["type"] == "ellipsoid":
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1.0)
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            me.shade_smooth()
            me.materials.append(material(o["mat"]))
        elif g["type"] == "box":
            me = round_box_mesh(name, g["size"], g["radius"])
            me.materials.append(material(o["mat"]))
        elif g["type"] == "crowd":
            me = crowd_mesh(name, g)
            me.materials.append(material(o["mat"]))
        else:
            raise ValueError(g["type"])
        ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    ob.parent = objs[o["parent"]]
    ob.rotation_mode = "QUATERNION"
    set_trs(ob, o["tr"])
    objs[name] = ob
print(f"objects built in {time.time() - t0:.1f}s", flush=True)

# studio lights (the room dims through the news and goes dark as the big screen dies)
from mathutils import Matrix, Vector  # noqa: E402


def area(name, energy, color, pos, target, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = rgba(color)[:3]
    data.shape = "DISK"
    data.size = size
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.parent = root
    d = (Vector(pos) - Vector(target)).normalized()
    ob.matrix_basis = Matrix.Translation(pos) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    lights.append(("studio", data, energy))
    return ob


SET = DATA.get("set", {"kind": "studio"})
if SET["kind"] == "keynote":
    # the stage's rig, placed in stage space (turned SET yaw about +y)
    cy, sy = math.cos(SET["yaw"]), math.sin(SET["yaw"])
    st = lambda v: (v[0] * cy + v[2] * sy, v[1], -v[0] * sy + v[2] * cy)  # noqa: E731
    area("Key", 9.0, "#fff2e4", st((0.75, 0.8, 1.3)), st((0.05, 0.08, 0.0)), 0.5)
    area("Fill", 2.5, "#e8eeff", st((-0.9, 0.6, 1.2)), st((0.0, 0.08, 0.0)), 0.6)
    area("Rim", 5.0, "#cfd6ff", st((0.3, 0.9, -0.55)), st((0.0, 0.1, 0.05)), 0.4)
    area("Top", 1.2, "#f4f6ff", st((0.0, 1.0, 0.1)), st((0.0, 0.0, 0.0)), 0.8)
    # the big screen's own glow on the stage: lavender from the slide, on faces
    # turned upstage and a rim on the rest; white from the feed, as bright as
    # its picture (build/tv/luma.json)
    S = SET["screen"]
    # not on the deck, which stays dark under the screen so the follow spot's pool shows on it
    dc = bpy.data.collections.new("deck_dark")
    dc.objects.link(objs["floor"])
    dc.collection_objects[0].light_linking.link_state = "EXCLUDE"
    z, y = Vector(st((0.0, 0.0, -1.0))), Vector((0.0, 1.0, 0.0))  # local −Z, the way it shines, to the house
    glow = {}
    for name, colour in (("ScreenGlow", "#c2bdf2"), ("FeedGlow", "#e4e8f4")):
        sd = glow[name] = bpy.data.lights.new(name, "AREA")
        sd.shape, sd.size, sd.size_y = "RECTANGLE", S["w"], S["h"]
        sd.color = rgba(colour)[:3]
        sl = bpy.data.objects.new(name, sd)
        scene.collection.objects.link(sl)
        sl.parent = root
        sl.matrix_basis = Matrix.Translation(st((0.0, S["y"] + S["h"] / 2, S["z"] + 0.02))) @ Matrix((y.cross(z), y, z)).transposed().to_4x4()
        sl.light_linking.receiver_collection = dc
    lights.append(("screen", glow["ScreenGlow"], 11.0))
    if SLIDE != "purple":
        # a darker slide gives that much less light (by its mean, against the
        # purple the rig was lit for), and the words their own, white
        def mean(stops):
            v = np.linspace(0, 1, 201)
            c = np.array([rgba(h)[:3] for _, h in stops])
            return np.array([np.interp(v, [p for p, _ in stops], c[:, i]).mean() for i in range(3)])
        lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
        m, ref = mean(SLIDES[SLIDE]), lum(mean(SLIDES["purple"]))
        glow["ScreenGlow"].color = m / m.max()
        lights[-1] = ("screen", glow["ScreenGlow"], 11.0 * lum(m) / ref)
        img = bpy.data.images.load(str(ROOT / "assets/keynote-iphone-duo.png"), check_existing=True)
        text = np.asarray(img.pixels[:], dtype=np.float32)[0::4].mean()
        wd = bpy.data.lights.new("WordGlow", "AREA")
        wd.shape, wd.size, wd.size_y = "RECTANGLE", S["w"] * 0.62, S["h"] * 0.2
        wd.color = rgba("#f4f2ff")[:3]
        wl = bpy.data.objects.new("WordGlow", wd)
        scene.collection.objects.link(wl)
        wl.parent = root
        wl.matrix_basis = Matrix.Translation(st((0.0, S["y"] + S["h"] * 0.57, S["z"] + 0.02))) @ Matrix((y.cross(z), y, z)).transposed().to_4x4()
        wl.light_linking.receiver_collection = dc
        lights.append(("word", wd, 11.0 * text * lum(rgba("#f4f2ff")) / ref))
        print(f"slide {SLIDE}: screen light x{lum(m) / ref:.2f}, words {11.0 * text * lum(rgba('#f4f2ff')) / ref:.2f} W", flush=True)
    bg.inputs["Color"].default_value = rgba("#0a0a10")
    if "crowd" in objs:
        hc = bpy.data.collections.new("house_dark")
        hc.objects.link(objs["crowd"])
        hc.collection_objects[0].light_linking.link_state = "EXCLUDE"
        for n in ("Key", "Fill", "Top"):
            bpy.data.objects[n].light_linking.receiver_collection = hc
else:
    area("Key", 2.7, "#fff4ea", (0.25, 0.55, 0.55), (-0.05, 0.08, 0), 0.45)
    area("Fill", 0.8, "#eef3ff", (-0.55, 0.3, 0.45), (-0.05, 0.08, 0), 0.45)
    area("Rim", 1.6, "#ffffff", (0.3, 0.45, -0.45), (0, 0.1, 0), 0.35)
    area("Top", 1.3, "#f4f6ff", (0.0, 0.9, 0.05), (0, 0, 0), 0.8)

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


t0 = time.time()
for name, keys in DATA["tracks"].items():
    ob = objs[name]
    k = np.asarray(keys, dtype=np.float64)
    frames = 1 + k[:, 0] / SUB
    set_trs(ob, k[0, 1:])
    cb = channelbag(ob)
    for i in range(3):
        curve(cb, "location", i, frames, k[:, 1 + i])
    for i, c in enumerate((7, 4, 5, 6)):  # w x y z
        curve(cb, "rotation_quaternion", i, frames, k[:, c])
    for i in range(3):
        curve(cb, "scale", i, frames, k[:, 8 + i])
for name, keys in DATA["vis"].items():
    k = np.asarray(keys, dtype=np.float64)
    for ob in [objs[name], *objs[name].children]:
        curve(channelbag(ob), "hide_render", 0, k[:, 0], 1 - k[:, 1], CONSTANT)
        ob.hide_render = not keys[0][1]
print(f"keys in {time.time() - t0:.1f}s", flush=True)

SC = DATA["scalars"]


def scalar(name):
    k = np.asarray(SC[name], dtype=np.float64)
    return 1 + k[:, 0] / SUB, k[:, 1]


cam = objs["camera"].data
cb = channelbag(cam)
f, v = scalar("fov")
curve(cb, "lens", 0, f, 12 / np.tan(np.radians(v) / 2))
f, v = scalar("focus")
curve(cb, "dof.focus_distance", 0, f, v)
f, v = scalar("fstop")
curve(cb, "dof.aperture_fstop", 0, f, v)
for gm in [m for m in bpy.data.materials if m.name.endswith(".glint")]:
    gp = next(n for n in gm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    keyed.append(("glint", gm.node_tree, f'nodes["{gp.name}"].inputs["Emission Strength"].default_value', gp.inputs["Emission Strength"].default_value))
for sname, nt, path, k in keyed:
    f, v = scalar(sname)
    curve(channelbag(nt), path, 0, f, v * k)
for sname, ld, k in lights:
    f, v = scalar(sname)
    curve(channelbag(ld), "energy", 0, f, v * k)
if "spotSize" in SC:
    f, v = scalar("spotSize")
    curve(channelbag(objs["followspot"].data), "spot_size", 0, f, np.radians(v))
if SET["kind"] == "keynote":
    luma = np.asarray(json.loads((ROOT / "build/tv/luma.json").read_text()), dtype=np.float64)
    f, v = scalar("feed")
    fr = np.arange(1, len(luma) + 1, dtype=np.float64)
    curve(channelbag(glow["FeedGlow"]), "energy", 0, fr, 10.0 * luma * np.interp(fr, f, v))
f, v = scalar("studio")
curve(channelbag(world.node_tree), 'nodes["Background"].inputs["Strength"].default_value', 0, f, 0.22 * v)
# at a cut the camera (and the count, which turns to it) must jump between two
# frames' shutters (f-0.75 and f-0.25), not inside the new shot's first frame:
# else that frame is both shots smeared together
MOVES = ("location", "rotation_quaternion", "scale", "lens", "dof.focus_distance", "dof.aperture_fstop")
for f in DATA.get("cuts", []):
    for idb in (objs["camera"], cam, objs["counter"]):
        for fc in channelbag(idb).fcurves:
            if fc.data_path in MOVES:
                fc.keyframe_points.insert(f - 0.4, fc.evaluate(f), options={"FAST"}).interpolation = "LINEAR"
                fc.update()
# a still camera instead of the film's, for look tests:
#   --cam px,py,pz,tx,ty,tz[,fov[,fstop]]  (Three.js world; --cam-stage: stage space)
if "--cam" in argv:
    v = [float(x) for x in arg("--cam", "").split(",")]
    pos, tgt = Vector(v[0:3]), Vector(v[3:6])
    if "--cam-stage" in argv and SET["kind"] == "keynote":
        pos, tgt = Vector(st(pos)), Vector(st(tgt))
    fov, fst = (v[6] if len(v) > 6 else 26.0), (v[7] if len(v) > 7 else 8.0)
    co = objs["camera"]
    co.animation_data_clear()
    cam.animation_data_clear()
    z = (pos - tgt).normalized()
    x = Vector((0, 1, 0)).cross(z).normalized()
    co.location = pos
    co.rotation_quaternion = Matrix((x, z.cross(x), z)).transposed().to_quaternion()
    cam.lens = 12 / math.tan(math.radians(fov) / 2)
    cam.dof.focus_distance = (pos - tgt).length
    cam.dof.aperture_fstop = fst
print(f"built: {len(objs)} objects", flush=True)
if "--save" in argv:
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / arg("--save", "build/scene.blend")))

# ── Render ──────────────────────────────────────────────────────────────────
spec = arg("--frames", None)
if spec:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        frames += list(range(int(a), int(b or a) + 1))
    for fr in frames:
        t0 = time.time()
        scene.frame_set(fr)
        scene.render.filepath = str(OUT / f"{fr:04d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"rendered frame {fr} in {time.time() - t0:.1f}s", flush=True)
