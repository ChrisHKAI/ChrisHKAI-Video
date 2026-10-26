"""The outro in Blender: the iPhone 18 Pro (four times life size) springs up
in the dark, opens X on his profile; the avatar swells and pops into the
Chris toy (characters/chris-toy), who drops onto his name and pulls it off
the screen: it swings down, hanging by its far end, and its letters drop out
of it one per eighth note, landing as white plaster letters (Archivo Black)
that squash and pop back, the whole name in frame. On the floor everything is
CLAWD's (reference/clawd-pixar): a grey satin floor in a black void, the
reflections soft, its 35 mm lens low and centred. He lets go and falls the
length of the phone, the camera with him, through the dark onto the top of the
C, then hops along the tops of the letters, one a beat, and lands on the I on
the stinger.

usage: blender -b --factory-startup -P scripts/scene.py -- [--frames 1-645 | 40,160,283]
       [--samples 32] [--scale 100] [--out build/render] [--noblur] [--save build/scene.blend]
       [--letters white] [--spacing font10] [--cap 0.22] [--font sf]  (try a colour, spacing, letter size or SF Pro)
"""
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Euler, Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT.parent.parent / "characters/chris-toy/blender"))
import timeline as T  # noqa: E402
import chris_rig  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda n, d=None: argv[argv.index(n) + 1] if n in argv else d
UI = json.loads((ROOT / "build/ui.json").read_text())
EV = T.EV
F = T.frame


def lin(hex_):
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def seg(t, t0, t1):
    return min(max((t - t0) / (t1 - t0), 0.0), 1.0)


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


# ── the scene ──────────────────────────────────────────────────────────────
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
scene = bpy.context.scene
scene.render.fps = T.FPS
scene.frame_start, scene.frame_end = 1, T.FRAMES
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "METAL"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == "METAL"
scene.cycles.device = "GPU"
scene.cycles.samples = int(arg("--samples", 32))
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.resolution_percentage = int(arg("--scale", 100))
scene.view_settings.view_transform = "Standard"
scene.render.image_settings.file_format = "PNG"
scene.render.use_motion_blur = "--noblur" not in argv
scene.render.motion_blur_shutter = 0.5


def link(ob):
    scene.collection.objects.link(ob)
    return ob


def material(name, color, rough=0.4, metal=0.0, coat=0.0, coat_rough=0.1, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = lin(color)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = coat_rough
    if emit:
        p.inputs["Emission Color"].default_value = lin(emit)
        p.inputs["Emission Strength"].default_value = strength
    return m


def image_material(name, path, emit=0.0, rough=0.35, alpha=False, seq=False):
    """A material showing an image on its UVs (an image sequence when seq), lit or glowing."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(path))
    tex.interpolation = "Cubic"
    if seq:
        tex.image.source = "SEQUENCE"
        tex.image_user.frame_duration = T.FRAMES
        tex.image_user.frame_start = 1
        tex.image_user.use_auto_refresh = True
    nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = rough
    if emit:
        nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = emit
    if alpha:
        nt.links.new(tex.outputs["Alpha"], p.inputs["Alpha"])
    return m


def key(ob, path, t, value, index=-1):
    setattr(ob, path, value) if index < 0 else getattr(ob, path).__setitem__(index, value)
    ob.keyframe_insert(path, frame=F(t) if isinstance(t, float) else t, index=index)


def keyf(ob, path, frame, value):
    """Key at an exact (possibly fractional) frame."""
    setattr(ob, path, value)
    ob.keyframe_insert(path, frame=frame)


def show(ob, t_on=None, t_off=None):
    """Hidden but for [t_on, t_off) (film seconds); keyed, constant."""
    frames = [(1, t_on is None or t_on <= 0)]
    if t_on is not None and t_on > 0:
        frames.append((F(t_on), True))
    if t_off is not None:
        frames.append((F(t_off), False))
    for fr, on in frames:
        ob.hide_render = ob.hide_viewport = not on
        ob.keyframe_insert("hide_render", frame=fr)
        ob.keyframe_insert("hide_viewport", frame=fr)


def rounded_rect(w, h, r, n=12):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, w, h, r, depth, bevel, mat):
    """A rounded-rectangle slab, its faces to +-y (front = -y), built as a beveled curve."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    cu.fill_mode = "BOTH"
    sp = cu.splines.new("POLY")
    pts = rounded_rect(w - 2 * bevel, h - 2 * bevel, max(r - bevel, 1e-4), 16)
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    cu.extrude = max(depth / 2 - bevel, 0)
    cu.bevel_depth = bevel
    cu.bevel_resolution = 6
    ob = bpy.data.objects.new(name, cu)
    link(ob)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    me.shade_smooth()
    me.transform(Matrix.Rotation(math.pi / 2, 4, "X"))
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def plate(name, w, h, r, mat, uv=True):
    """A flat rounded rectangle facing -y, UVs over its bounds."""
    pts = rounded_rect(w, h, r, 16)
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, y)) for x, y in pts]
    face = bm.faces.new(vs)
    face.normal_update()
    if face.normal.y > 0:
        face.normal_flip()
    if uv:
        layer = bm.loops.layers.uv.new()
        for loop in face.loops:
            co = loop.vert.co
            loop[layer].uv = (co.x / w + 0.5, co.z / h + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def box(name, size, bevel, mat, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) / 2 - 1e-5), segments=4, affect="EDGES")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(mat)
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    return ob


def disc(name, radius, rings=24, segs=96):
    """A flat disc facing -y with polar rings (for bulging), UVs over its bounds."""
    bm = bmesh.new()
    layer = bm.loops.layers.uv.new()
    center = bm.verts.new((0, 0, 0))
    grid = [[bm.verts.new((radius * (i / rings) * math.cos(2 * math.pi * j / segs), 0,
                           radius * (i / rings) * math.sin(2 * math.pi * j / segs))) for j in range(segs)] for i in range(1, rings + 1)]
    faces = [bm.faces.new((center, grid[0][(j + 1) % segs], grid[0][j])) for j in range(segs)]
    for i in range(rings - 1):
        for j in range(segs):
            faces.append(bm.faces.new((grid[i][j], grid[i][(j + 1) % segs], grid[i + 1][(j + 1) % segs], grid[i + 1][j])))
    for f in faces:
        for loop in f.loops:
            co = loop.vert.co
            loop[layer].uv = (co.x / (2 * radius) + 0.5, co.z / (2 * radius) + 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    for f in faces:
        if f.normal.y > 0:
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


# ── world, floor, lights ───────────────────────────────────────────────────
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
wn.clear()
w_out, w_mix = wn.new("ShaderNodeOutputWorld"), wn.new("ShaderNodeMixShader")
w_light, w_cam = wn.new("ShaderNodeBackground"), wn.new("ShaderNodeBackground")
w_light.inputs["Color"].default_value = lin("#c9d3ff")
w_light.inputs["Strength"].default_value = 0.12
w_cam.inputs["Color"].default_value = (0, 0, 0, 1)
w_path = wn.new("ShaderNodeLightPath")
wl.new(w_path.outputs["Is Camera Ray"], w_mix.inputs["Fac"])
wl.new(w_light.outputs["Background"], w_mix.inputs[1])
wl.new(w_cam.outputs["Background"], w_mix.inputs[2])
wl.new(w_mix.outputs["Shader"], w_out.inputs["Surface"])

def concrete():
    """A dark poured floor: mottled, a little sheen, a fine grit."""
    m = material("floor", "#1b1d21", rough=0.55, coat=0.15, coat_rough=0.25)
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 6.0
    n.inputs["Detail"].default_value = 8.0
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].color = lin("#121317")
    r.color_ramp.elements[1].color = lin("#2a2c31")
    nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
    nt.links.new(r.outputs["Color"], p.inputs["Base Color"])
    g = nt.nodes.new("ShaderNodeTexNoise")
    g.inputs["Scale"].default_value = 900.0
    nt.links.new(tc.outputs["Object"], g.inputs["Vector"])
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = 0.25
    b.inputs["Distance"].default_value = 0.0003
    nt.links.new(g.outputs["Fac"], b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    return m


floor = plate("floor", 12, 12, 0.01, concrete(), uv=False)
floor.rotation_euler = (-math.pi / 2, 0, 0)  # face up
floor.location = (0, 0, 0)


def area(name, power, color, loc, target, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.color = lin(color)[:3]
    data.shape = "DISK"
    data.size = size
    ob = link(bpy.data.objects.new(name, data))
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


# up at the phone in the air, and down on the floor where the letters land
_U = T.PHONE_AT[2]
area("KeyUp", 70, "#fff1e4", (-0.9, -1.2, _U + 1.2), (0, 0, _U + 0.15), 1.0)
area("RimUp", 50, "#cfdcff", (0.9, 0.9, _U + 1.1), (0, 0, _U + 0.15), 0.8)
area("FillUp", 16, "#ffe6d6", (1.1, -0.9, _U + 0.2), (0, 0, _U), 1.2)
area("KeyDown", 90, "#fff1e4", (-0.5, -1.4, 1.3), (0.7, -0.15, 0.1), 1.2)
area("RimDown", 55, "#cfdcff", (1.6, 1.2, 1.0), (0.7, -0.15, 0.1), 1.0)
area("FillDown", 22, "#ffe6d6", (2.2, -1.2, 0.5), (0.7, -0.15, 0.1), 1.4)

# ── the iPhone 18 Pro ──────────────────────────────────────────────────────
P, S = T.PHONE, T.SCREEN
phone = link(bpy.data.objects.new("Phone", None))
metal = material("phoneMetal", "#3a4a6c", rough=0.3, metal=1.0)
glass = material("phoneGlass", "#040405", rough=0.04, coat=1.0, coat_rough=0.02)
lens_m = material("lens", "#06070a", rough=0.05, coat=1.0, coat_rough=0.01)
parts = [slab("body", P["w"], P["h"], P["r"], P["d"], 0.0011 * T.K, metal)]
front = plate("front", P["w"] - 0.0014 * T.K, P["h"] - 0.0014 * T.K, P["r"] - 0.0007 * T.K, glass, uv=False)
front.location.y = -P["d"] / 2 - 0.0003
parts.append(front)
screen_mat = image_material("screen", ROOT / "build/screen/0001.jpg", emit=1.0, rough=0.12, seq=True)
_sp = screen_mat.node_tree.nodes["Principled BSDF"]
for _l in list(_sp.inputs["Base Color"].links):
    screen_mat.node_tree.links.remove(_l)
_sp.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)  # a glowing screen under glass: no diffuse to wash it out
_sp.inputs["Coat Weight"].default_value = 0.25
_sp.inputs["Coat Roughness"].default_value = 0.05
screen = plate("screen", S["w"], S["h"], S["r"], screen_mat)
screen.location.y = -P["d"] / 2 - 0.0005
parts.append(screen)
island = plate("island", 0.0135 * T.K, 0.0037 * T.K, 0.00185 * T.K, glass, uv=False)
island.location = (0, -P["d"] / 2 - 0.0007, S["h"] / 2 - 0.0078 * T.K)
parts.append(island)
# the buttons: the action button and volume on the left, the side button and camera control on the right
for name, x, z, h in (("action", -1, 0.038, 0.007), ("volUp", -1, 0.020, 0.012), ("volDown", -1, 0.004, 0.012),
                      ("side", 1, 0.022, 0.017), ("camCtl", 1, -0.024, 0.010)):
    parts.append(box(name, (0.0014 * T.K, 0.0036 * T.K, h * T.K), 0.0006 * T.K, metal, (x * (P["w"] / 2 + 0.0002 * T.K), 0, z * T.K)))
# the camera plateau across the back
plateau = box("plateau", (P["w"] - 0.006 * T.K, 0.0018 * T.K, 0.027 * T.K), 0.0009 * T.K, metal, (0, P["d"] / 2 + 0.0008 * T.K, P["h"] / 2 - 0.0185 * T.K))
parts.append(plateau)
for i, (lx, lz) in enumerate(((-0.0215, 0.0068), (-0.0215, -0.0068), (-0.0095, 0.0)), 1):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0055 * T.K, depth=0.0016 * T.K, vertices=64)
    ring = bpy.context.object
    ring.name = f"lensRing{i}"
    ring.rotation_euler = (math.pi / 2, 0, 0)
    ring.location = (lx * T.K, P["d"] / 2 + 0.0024 * T.K, P["h"] / 2 - 0.0185 * T.K + lz * T.K)
    ring.data.materials.append(metal)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0042 * T.K, depth=0.0018 * T.K, vertices=64)
    ln = bpy.context.object
    ln.name = f"lens{i}"
    ln.rotation_euler = (math.pi / 2, 0, 0)
    ln.location = ring.location + Vector((0, 0.0003 * T.K, 0))
    ln.data.materials.append(lens_m)
    parts += [ring, ln]
for ob in parts:
    ob.parent = phone
PHONE_REST = Vector(T.PHONE_AT)

# ── the pieces that come off the screen ────────────────────────────────────
av = UI["avatar"]
AV_C = Vector(T.ui_to_world(av["cx"], av["cy"], 0.0007))
AV_R = av["r"] * T.PX
av_me = disc("avatarDisc", AV_R)
sk = None
avatar = link(bpy.data.objects.new("avatar", av_me))
avatar.location = AV_C
avatar.data.materials.append(image_material("avatar", ROOT / "assets/avatar.png", emit=0.6, rough=0.3, alpha=True))
avatar.shape_key_add(name="Basis")
bulge = avatar.shape_key_add(name="bulge")
for v, kb in zip(avatar.data.vertices, bulge.data):
    r2 = (v.co.x ** 2 + v.co.z ** 2) / AV_R ** 2
    kb.co = v.co + Vector((0, -0.75 * AV_R * max(1 - r2, 0) ** 0.8, 0))


def strip(name, rect, pivot):
    """A paper strip from a screen piece; its origin at pivot ("bottom" edge middle, "left" or "right" end)."""
    x, y, w, h = rect
    ww, hh = w * T.PX, h * T.PX
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    nx, nz = 48, 6
    vs = [[bm.verts.new(((i / nx - 0.5) * ww, 0, (j / nz - 0.5) * hh)) for i in range(nx + 1)] for j in range(nz + 1)]
    layer = bm.loops.layers.uv.new()
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
            for loop in f.loops:
                loop[layer].uv = (loop.vert.co.x / ww + 0.5, loop.vert.co.z / hh + 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()
    c = Vector(T.ui_to_world(x + w / 2, y + h / 2, 0.0007))
    off = {"bottom": Vector((0, 0, hh / 2)), "left": Vector((ww / 2, 0, 0)), "right": Vector((-ww / 2, 0, 0))}[pivot]
    me.transform(Matrix.Translation(off))
    ob = link(bpy.data.objects.new(name, me))
    ob.location = c - off
    sol = ob.modifiers.new("paper", "SOLIDIFY")
    sol.thickness = 0.0009
    sol.offset = 1.0
    sol.material_offset_rim = 1
    face = image_material(name, ROOT / "build/strip/0001.png", emit=0.35, rough=0.6, seq=True) if name == "name" else \
        image_material(name, ROOT / f"assets/{name}.png", emit=0.35, rough=0.6)
    # the back of the paper is blank: mix the print to plain stock where the face looks away
    nt = face.node_tree
    p = nt.nodes["Principled BSDF"]
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = lin("#efe8d6")
    nt.links.new(geo.outputs["Backfacing"], mix.inputs["Factor"])
    nt.links.new(tex.outputs["Color"], mix.inputs["A"])
    nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    nt.links.new(mix.outputs["Result"], p.inputs["Emission Color"])
    me.materials.append(face)
    me.materials.append(material(f"{name}Edge", "#4a463f", rough=0.7))
    return ob, ww, hh


name_strip, NAME_W, NAME_H = strip("name", UI["name"], "right")

# the page he stands on once it is blown up: a sharp band over the screen, from the zoom on
zx, zy, zw, zh = UI["zoom"]
_zm = image_material("zoomPage", ROOT / "assets/profile-zoom.jpg", emit=1.0, rough=0.12)
_zbsdf = _zm.node_tree.nodes["Principled BSDF"]
for _l in list(_zbsdf.inputs["Base Color"].links):
    _zm.node_tree.links.remove(_l)
_zbsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)  # it glows like the screen: no diffuse to wash it out
_zbsdf.inputs["Specular IOR Level"].default_value = 0.0  # nor a gloss: blown up, the lights' glints on it were metres wide
# the app going: it fades to the page's plain white as "gone" (a value, keyed) goes 0 → 1; then
# black ink spreads behind each letter he turns white ("inkMix", its factor wired in scripts/choreo.py)
_znt = _zm.node_tree
_ztex = next(n for n in _znt.nodes if n.type == "TEX_IMAGE")
_zgone = _znt.nodes.new("ShaderNodeValue")
_zgone.name = "gone"
_zmix = _znt.nodes.new("ShaderNodeMix")
_zmix.data_type = "RGBA"
_znt.links.new(_zgone.outputs[0], _zmix.inputs["Factor"])
_znt.links.new(_ztex.outputs["Color"], _zmix.inputs["A"])
_zmix.inputs["B"].default_value = (1.0, 1.0, 1.0, 1.0)
_zink = _znt.nodes.new("ShaderNodeMix")
_zink.name = "inkMix"
_zink.data_type = "RGBA"
_zink.inputs["Factor"].default_value = 0.0
_znt.links.new(_zmix.outputs["Result"], _zink.inputs["A"])
_zink.inputs["B"].default_value = (0.0, 0.0, 0.0, 1.0)
_znt.links.new(_zink.outputs["Result"], _zbsdf.inputs["Emission Color"])
# lit as well as glowing, a little, so the letters standing off it cast their shadows on it
_znt.links.new(_zink.outputs["Result"], _zbsdf.inputs["Base Color"])
_zbsdf.inputs["Emission Strength"].default_value = 0.8
zoom_page = plate("zoomPage", zw * T.PX, zh * T.PX, 1e-4, _zm)
zoom_page.parent = phone
zoom_page.location = Vector(T.ui_to_world(zx + zw / 2, zy + zh / 2, 0.0009)) - PHONE_REST

# ── the letters: enamel ──────────────────────────────────────────────────
def enamel(name, color):
    """The letters: smooth satin, like PIXAR's white plaster letters, a thin clear coat. Black as the
    handle prints them until he lands on them: each object's "white" (0..1, keyed) turns it white,
    as CLAWD's letters turn orange under him."""
    m = material(name, color, rough=0.45, coat=0.15, coat_rough=0.25)  # no subsurface: its red scatter warmed the white
    nt = m.node_tree
    att = nt.nodes.new("ShaderNodeAttribute")
    att.attribute_type = "OBJECT"
    att.attribute_name = "white"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = lin(T.LETTER_INK)
    mix.inputs["B"].default_value = lin(color)
    nt.links.new(att.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    # black, they barely shine (their gloss mirrored the white page and greyed them); white, the satin
    for name, black, white in (("Specular IOR Level", T.INK_SHINE, 0.5), ("Coat Weight", 0.0, 0.15), ("Roughness", T.INK_ROUGH, 0.45)):
        m_ = nt.nodes.new("ShaderNodeMapRange")
        m_.inputs["To Min"].default_value = black
        m_.inputs["To Max"].default_value = white
        nt.links.new(att.outputs["Fac"], m_.inputs["Value"])
        nt.links.new(m_.outputs["Result"], nt.nodes["Principled BSDF"].inputs[name])
    return m


# the face (T.FONT; `--font sf`: SF Pro Black, the first), at SF Pro Black's cap height
SF = bpy.data.fonts.load(str(ROOT / "build/SFPro-Black.ttf"))
font = SF if arg("--font") == "sf" else bpy.data.fonts.load(str(ROOT / T.FONTS[arg("--font", T.FONT)]))
T.LETTER_COLOR = T.PALETTES[arg("--letters", "white")]
if arg("--ink"):
    T.LETTER_INK, T.INK_SHINE, T.INK_ROUGH = T.INKS[arg("--ink")]
enamels = {c: enamel(f"enamel{c}", c) for c in set(T.LETTER_COLOR)}
letters = []
x_cursor = 0.0
T.SPACING = T.SPACINGS[arg("--spacing")] if arg("--spacing") else T.SPACING
if arg("--font") == "sf" and not arg("--spacing"):
    T.SPACING = T.SPACINGS["font10"]
if arg("--cap"):  # try another letter size: depth and bevel scale with it
    _k = float(arg("--cap")) / T.LETTER["cap"]
    T.LETTER = {**T.LETTER, "cap": float(arg("--cap")), "depth": T.LETTER["depth"] * _k, "bevel": T.LETTER["bevel"] * _k}


def glyph_mesh(body, face=None, size=None, bevel=None):
    """The text `body` as an extruded, bevelled mesh, laid out as Blender sets it."""
    cu = bpy.data.curves.new(f"glyph{body}", "FONT")
    cu.body = body
    cu.font = face or font
    cu.size = size or SIZE
    bevel = T.LETTER["bevel"] if bevel is None else bevel
    cu.extrude = T.LETTER["depth"] / 2 - bevel
    cu.bevel_depth = bevel
    cu.offset = -bevel  # bevelled inward: the outline stays the font's (outward, it closed the i's dot onto its stem)
    cu.bevel_resolution = 5
    tmp = link(bpy.data.objects.new("tmp", cu))
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    return me


def cap_height(face):
    """The height of the face's H, set at size 1 with no bevel."""
    me = glyph_mesh("H", face, 1.0, 0.0)
    ys = [v.co.y for v in me.vertices]
    bpy.data.meshes.remove(me)
    return max(ys) - min(ys)


SIZE = T.LETTER["cap"] / 0.72 * cap_height(SF) / cap_height(font)  # SF Pro's H at "cap": every face stands as tall


right = lambda me: max(v.co.x for v in me.vertices)
_m1, _m2 = glyph_mesh("HH"), glyph_mesh("H H")
space = right(_m2) - right(_m1)  # the word space's advance
bpy.data.meshes.remove(_m1)
bpy.data.meshes.remove(_m2)
for i, ch in enumerate(T.LETTERS):
    me = glyph_mesh(ch)
    # the pen's step to the next letter: its advance width, read off two of it
    twice = glyph_mesh(ch * 2)
    advance = right(twice) - right(me)
    bpy.data.meshes.remove(twice)
    # stand it up (text lies in xy): its face to -y, its base on z = 0, its middle at x = 0
    me.transform(Matrix.Rotation(math.pi / 2, 4, "X"))
    xs = [v.co.x for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    pen_mid = (min(xs) + max(xs)) / 2  # its middle, from the pen
    me.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2, 0, -min(zs))))
    me.materials.append(enamels[T.LETTER_COLOR[i]])
    for poly in me.polygons:
        poly.use_smooth = True
    me.set_sharp_from_angle(angle=math.radians(40))
    ob = link(bpy.data.objects.new(f"letter{i}_{ch}", me))
    # where he can stand on it: the middle of its highest part (local x, top z)
    top = max(zs) - min(zs)
    hi = [v.co.x for v in me.vertices if v.co.z > top - 0.012]
    ob["top_x"] = sum(hi) / len(hi)
    ob["top_z"] = top
    width = max(xs) - min(xs)
    ob["w"] = width
    if T.SPACING["mode"] == "box":
        if i == 5:
            x_cursor += 0.07  # the space
        ob["x"] = x_cursor + width / 2
        x_cursor += width + 0.01
    else:
        track = T.SPACING["track"] * T.LETTER["cap"]
        if i == 5:
            x_cursor += space + track  # the space is tracked like a letter
        ob["x"] = x_cursor + pen_mid
        x_cursor += advance + track
    letters.append(ob)

# ── the toy ────────────────────────────────────────────────────────────────
rig = chris_rig.append(scene)
for b in rig.pose.bones:
    b.rotation_mode = "QUATERNION"

# ── the camera ─────────────────────────────────────────────────────────────
cam_data = bpy.data.cameras.new("Camera")
cam_data.sensor_fit = "VERTICAL"
cam_data.sensor_height = 24
cam_data.lens = 12 / math.tan(math.radians(26) / 2)
cam_data.clip_start = 0.01
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 4.0
cam = link(bpy.data.objects.new("Camera", cam_data))
scene.camera = cam
focus = link(bpy.data.objects.new("focus", None))
cam_data.dof.focus_object = focus

exec((ROOT / "scripts/choreo.py").read_text())  # the motion: phone, avatar, toy, name, letters, cracks, camera

if arg("--save"):
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / arg("--save")))

out = ROOT / arg("--out", "build/render")
out.mkdir(parents=True, exist_ok=True)
spec = arg("--frames", f"1-{T.FRAMES}")
frames = []
for part in spec.split(","):
    a, _, b = part.partition("-")
    frames += list(range(int(a), int(b or a) + 1))
# no motion blur on the frames of his landing on the I: he stops dead from about 10 m/s, and
# the blur, sampled across the frame, smeared him up and down (the user saw it, 2026-10-24)
SHARP = set(range(T.frame(T.EV["sting"]) - 2, T.frame(T.EV["sting"]) + 3))
blur = scene.render.use_motion_blur
for fr in frames:
    scene.render.use_motion_blur = blur and fr not in SHARP
    scene.frame_set(fr)
    scene.render.filepath = str(out / f"{fr:04d}.png")
    bpy.ops.render.render(write_still=True)
    print(f"rendered frame {fr}", flush=True)
