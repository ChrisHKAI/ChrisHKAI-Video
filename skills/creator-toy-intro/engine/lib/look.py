"""The light, shared by the film (engine/scripts/scene.py) and the toy's look-dev
(engine/scripts/lookdev.py), so the toy the user signs off in step 3 is lit
the way the film will light it.

The settings are film.json "look" (references/render.md, "The light"). By
default:
- Khronos PBR Neutral turns light into colour. It keeps a material's own
  colour (the toy's paint, its skin) where Standard greys it.
- The rim light falls on the toy alone (light linking), from behind it as
  the camera sees it and from above, and the vinyl reflects it. That lifts
  dark hair off the dark stage without lighting the world (look.rim, its
  strength; look.rimOn, the names it falls on).
- What reflects sees a bright softbox sky, and what is lit sees a dim one
  (look.softbox, look.sky): vinyl keeps its highlights, the world stays dark.

"light": "classic" (or --look classic) keeps the first films' light: Standard,
a rim light on everything, one even sky (each script's own numbers).
"""
import math

from mathutils import Vector

STAGE = "#0b0c10"  # what the camera sees behind everything
RIM_DIR = (1.4, 1.1, -1.8)  # where the rim comes from when nothing aims it (+y up)


def rgba(hex_, k=1.0):
    h = hex_.lstrip("#")
    r, g, b = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))]
    return (r * k, g * k, b * k, 1.0)


class Look:
    def __init__(self, film_json, arg):
        L = film_json.get("look", {})
        self.classic = arg("--look", L.get("light", "")) == "classic"
        self.view = "Standard" if self.classic else L.get("view", "Khronos PBR Neutral")
        self.rim = float(arg("--rim", L.get("rim", 2.0 if self.classic else 4.0)))
        self.rim_on = L.get("rimOn", ["hero"])
        self.sky = float(L.get("sky", 0.22))
        self.softbox = float(L.get("softbox", 1.4))


def view(scene, look):
    try:
        scene.view_settings.view_transform = look.view
    except TypeError:  # a Blender before 4.2 has no PBR Neutral
        scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


def world(bpy, scene, look, sky=0.32, camera=STAGE):
    """The world: the camera sees `camera`. In the classic light everything else sees one even sky
    (strength `sky`); otherwise what reflects sees the softbox, and what is lit a dim sky (look.sky)."""
    w = bpy.data.worlds.new("Studio")
    scene.world = w
    w.use_nodes = True
    wn, wl = w.node_tree.nodes, w.node_tree.links
    wn.clear()
    w_out = wn.new("ShaderNodeOutputWorld")
    w_mix = wn.new("ShaderNodeMixShader")
    w_light = wn.new("ShaderNodeBackground")
    w_light.inputs["Color"].default_value = rgba("#dfe6ff")
    w_light.inputs["Strength"].default_value = sky if look.classic else look.sky
    w_cam = wn.new("ShaderNodeBackground")
    w_cam.inputs["Color"].default_value = rgba(camera)
    w_path = wn.new("ShaderNodeLightPath")
    wl.new(w_path.outputs["Is Camera Ray"], w_mix.inputs["Fac"])
    wl.new(w_cam.outputs["Background"], w_mix.inputs[2])
    wl.new(w_mix.outputs["Shader"], w_out.inputs["Surface"])
    if look.classic:
        wl.new(w_light.outputs["Background"], w_mix.inputs[1])
        return w
    # reflections see a softbox: bright overhead, falling off to a dark horizon
    w_dir = wn.new("ShaderNodeTexCoord")
    w_xyz = wn.new("ShaderNodeSeparateXYZ")
    w_up = wn.new("ShaderNodeMapRange")
    w_up.inputs["From Min"].default_value, w_up.inputs["From Max"].default_value = 0.15, 0.85
    w_box = wn.new("ShaderNodeMix")
    w_box.data_type = "RGBA"
    w_box.inputs["A"].default_value = rgba("#1a1d24")
    w_box.inputs["B"].default_value = rgba("#ffffff")
    w_gloss = wn.new("ShaderNodeBackground")
    w_gloss.inputs["Strength"].default_value = look.softbox
    w_ray = wn.new("ShaderNodeMixShader")
    wl.new(w_dir.outputs["Generated"], w_xyz.inputs["Vector"])
    wl.new(w_xyz.outputs["Z"], w_up.inputs["Value"])
    wl.new(w_up.outputs["Result"], w_box.inputs["Factor"])
    wl.new(w_box.outputs["Result"], w_gloss.inputs["Color"])
    wl.new(w_path.outputs["Is Glossy Ray"], w_ray.inputs["Fac"])
    wl.new(w_light.outputs["Background"], w_ray.inputs[1])
    wl.new(w_gloss.outputs["Background"], w_ray.inputs[2])
    wl.new(w_ray.outputs["Shader"], w_mix.inputs[1])
    return w


def suns(bpy, scene, root, look, key=2.5, fill=0.55, glossy=False):
    """Key, rim and fill, three suns parented to the THREE root (+y up). The rim is returned, to aim and link.
    `glossy`: whether the classic light's suns show in reflections (the film's do not)."""
    def sun(name, energy, color, direction, size_deg, seen):
        data = bpy.data.lights.new(name, "SUN")
        data.energy = energy
        data.color = rgba(color)[:3]
        data.angle = math.radians(size_deg)
        ob = bpy.data.objects.new(name, data)
        scene.collection.objects.link(ob)
        ob.parent = root
        ob.matrix_basis = Vector(direction).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        ob.visible_glossy = seen
        return ob

    seen = glossy if look.classic else False
    sun("Key", key if look.classic else 2.5, "#fff3ea", (-1.2, 2.2, 1.6), 14, seen)
    rim = sun("Rim", look.rim, "#d6e2ff", RIM_DIR, 10, seen)
    sun("Fill", fill if look.classic else 0.55, "#ffe2d0", (1.6, 0.8, 1.4), 30, seen)
    return rim


def rim_on(bpy, rim, objects, look):
    """The rim falls on these objects alone, and they reflect it (not in the classic light)."""
    if look.classic:
        return 0
    lit = bpy.data.collections.new("rim_receivers")
    for ob in objects:
        lit.objects.link(ob)
    rim.light_linking.receiver_collection = lit
    rim.visible_glossy = True  # dark hair is outlined by what the vinyl reflects, not by what it scatters
    return len(lit.objects)


def rim_behind(away):
    """The rim's rotation (in the THREE root's frame) for a camera looking along `away`: from behind the toy, and above."""
    return (Vector(away) + Vector((0, 0.8, 0))).normalized().to_track_quat("Z", "Y")
