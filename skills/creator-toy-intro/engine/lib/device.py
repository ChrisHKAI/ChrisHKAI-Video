"""Which GPU Cycles renders on, shared by the film (engine/scripts/scene.py)
and the toy's look-dev (engine/scripts/lookdev.py). Step 0
(engine/scripts/doctor.mjs) asks Blender the same question, so it reports
what the render will use.

The first backend in ORDER with a device Blender can use wins: OptiX, then
CUDA (NVIDIA), HIP (AMD), oneAPI (Intel), Metal (Apple). All its devices
render; the CPU does not join them. With none, Cycles renders on the CPU and
says so: a film then takes many hours.

`choose` takes Blender's device list as it is (anything with .type and
.name), so it is tested without a GPU or Blender (tests/render-device.test.py).
"""
ORDER = ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL")
LABEL = {"OPTIX": "OptiX", "CUDA": "CUDA", "HIP": "HIP", "ONEAPI": "oneAPI", "METAL": "Metal"}


def choose(devices):
    """(backend, its devices) for the first backend in ORDER that has one; (None, []): the CPU."""
    for backend in ORDER:
        found = [d for d in devices if d.type == backend]
        if found:
            return backend, found
    return None, []


def available(bpy):
    """Cycles' preferences and the GPUs Blender finds now (not ones the preferences remember from before)."""
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.refresh_devices()  # adds every entry first, so the lists below are not moved under us
    return prefs, [d for b in ORDER for d in prefs.get_devices_for_type(b) if d.type == b]


def use(bpy, scene, say=lambda line: print(line, flush=True)):
    """Points the scene's Cycles at the chosen GPU, or at the CPU with a warning. The backend, or None."""
    prefs, devices = available(bpy)
    backend, picked = choose(devices)
    if backend is None:
        scene.cycles.device = "CPU"
        say("Cycles: WARNING: no GPU Blender can use, rendering on the CPU (expect hours per film)")
        return None
    prefs.compute_device_type = backend
    for d in prefs.devices:
        d.use = d.type == backend
    scene.cycles.device = "GPU"
    say(f"Cycles: {', '.join(d.name for d in picked)} ({LABEL[backend]})")
    return backend
