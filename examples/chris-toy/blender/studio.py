"""The look-dev studio (the isnail film's): a dark floor, three suns, a camera
with a 26-degree vertical view. setup() builds it into the current scene."""
import math

import bpy
from mathutils import Vector


def rgba(hex_, k=1.0):
    h = hex_.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (c[0] * k, c[1] * k, c[2] * k, 1.0)


class Studio:
    def __init__(self, scene, w=960, h=540, samples=64):
        self.scene = scene
        scene.render.engine = "CYCLES"
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "METAL"
        scene.cycles.device = "GPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.render.resolution_x, scene.render.resolution_y = w, h
        scene.view_settings.view_transform = "Standard"
        scene.render.image_settings.file_format = "PNG"

        world = bpy.data.worlds.new("Studio")
        scene.world = world
        world.use_nodes = True
        wn, wl = world.node_tree.nodes, world.node_tree.links
        wn.clear()
        out = wn.new("ShaderNodeOutputWorld")
        mix = wn.new("ShaderNodeMixShader")
        light = wn.new("ShaderNodeBackground")
        light.inputs["Color"].default_value = rgba("#dfe6ff")
        light.inputs["Strength"].default_value = 0.35
        seen = wn.new("ShaderNodeBackground")
        seen.inputs["Color"].default_value = rgba("#14161b")
        path = wn.new("ShaderNodeLightPath")
        wl.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
        wl.new(light.outputs["Background"], mix.inputs[1])
        wl.new(seen.outputs["Background"], mix.inputs[2])
        wl.new(mix.outputs["Shader"], out.inputs["Surface"])

        self.sun("Key", 2.6, "#fff3ea", (-1.2, -1.9, 1.5), 14)
        self.sun("Rim", 2.0, "#d6e2ff", (1.4, 1.8, 1.1), 10)
        self.sun("Fill", 0.6, "#ffe2d0", (1.6, -1.4, 0.8), 30)

        me = bpy.data.meshes.new("floor")
        me.from_pydata([(-20, -20, 0), (20, -20, 0), (20, 20, 0), (-20, 20, 0)], [], [(0, 1, 2, 3)])
        self.floor = bpy.data.objects.new("floor", me)
        scene.collection.objects.link(self.floor)
        fm = bpy.data.materials.new("floor")
        fm.use_nodes = True
        fp = fm.node_tree.nodes["Principled BSDF"]
        fp.inputs["Base Color"].default_value = rgba("#24272e")
        fp.inputs["Roughness"].default_value = 0.45
        me.materials.append(fm)

        self.cam_data = bpy.data.cameras.new("Camera")
        self.cam_data.sensor_fit = "VERTICAL"
        self.cam_data.sensor_height = 24
        self.cam_data.lens = 12 / math.tan(math.radians(26) / 2)
        self.cam_data.clip_start = 0.005
        self.cam_data.dof.use_dof = True
        self.cam_data.dof.aperture_fstop = 5.6
        self.cam = bpy.data.objects.new("Camera", self.cam_data)
        scene.collection.objects.link(self.cam)
        scene.camera = self.cam

    def sun(self, name, energy, color, direction, size_deg):
        data = bpy.data.lights.new(name, "SUN")
        data.energy = energy
        data.color = rgba(color)[:3]
        data.angle = math.radians(size_deg)
        ob = bpy.data.objects.new(name, data)
        self.scene.collection.objects.link(ob)
        ob.rotation_euler = Vector(direction).normalized().to_track_quat("Z", "Y").to_euler()
        return ob

    def look(self, target, az, el, dist):
        """Aim from azimuth az (deg, 0 = his front, -90 = his right side), elevation el, at dist (m)."""
        t = Vector(target)
        a, e = math.radians(az), math.radians(el)
        pos = t + dist * Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
        self.cam.location = pos
        self.cam.rotation_euler = (t - pos).to_track_quat("-Z", "Y").to_euler()
        self.cam_data.dof.focus_distance = dist

    def render(self, path):
        self.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
