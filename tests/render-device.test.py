"""Which GPU Cycles renders on (engine/lib/device.py), without Blender or a GPU:
fake device lists as Blender's Cycles preferences give them.

usage: python3 tests/render-device.test.py
"""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/creator-toy-intro/engine/lib"))
import device  # noqa: E402


def dev(type_, name="", id_=None):
    return SimpleNamespace(type=type_, name=name or type_.lower(), id=id_ or f"{type_}_{name}", use=type_ != "CPU")


class Prefs:
    """Cycles' preferences: `live` is what Blender finds now, `devices` also keeps entries from before."""

    def __init__(self, live, remembered=()):
        self.live, self.devices, self.compute_device_type = live, [*remembered], "NONE"

    def refresh_devices(self):
        self.devices += [d for d in self.live if d not in self.devices]

    def get_devices_for_type(self, t):
        gpus = [d for d in self.live if d.type == t]
        return gpus + [d for d in self.live if d.type == "CPU"] if gpus else []


def blender(prefs):
    return SimpleNamespace(context=SimpleNamespace(preferences=SimpleNamespace(addons={"cycles": SimpleNamespace(preferences=prefs)})))


def render(live, remembered=()):
    prefs, scene, said = Prefs(live, remembered), SimpleNamespace(cycles=SimpleNamespace(device="CPU")), []
    backend = device.use(blender(prefs), scene, said.append)
    return backend, prefs, scene, said


CPU = dev("CPU", "Apple M3 Max")


class Choose(unittest.TestCase):
    def test_order(self):
        self.assertEqual(device.ORDER, ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"))

    def test_mac(self):
        self.assertEqual(device.choose([CPU, dev("METAL", "Apple M3 Max (GPU - 40 cores)")])[0], "METAL")

    def test_nvidia_prefers_optix(self):
        rtx = [CPU, dev("CUDA", "RTX 4070"), dev("OPTIX", "RTX 4070")]
        backend, picked = device.choose(rtx)
        self.assertEqual((backend, [d.type for d in picked]), ("OPTIX", ["OPTIX"]))

    def test_older_nvidia_cuda(self):
        self.assertEqual(device.choose([CPU, dev("CUDA", "GTX 760")])[0], "CUDA")

    def test_amd_intel(self):
        self.assertEqual(device.choose([CPU, dev("HIP", "RX 7900")])[0], "HIP")
        self.assertEqual(device.choose([CPU, dev("ONEAPI", "Arc A770")])[0], "ONEAPI")
        self.assertEqual(device.choose([CPU, dev("HIP", "RX"), dev("ONEAPI", "Arc")])[0], "HIP")

    def test_two_cards_both_render(self):
        _, picked = device.choose([CPU, dev("OPTIX", "RTX 4090", "a"), dev("OPTIX", "RTX 4090", "b")])
        self.assertEqual(len(picked), 2)

    def test_cpu_only(self):
        self.assertEqual(device.choose([CPU]), (None, []))
        self.assertEqual(device.choose([]), (None, []))


class Use(unittest.TestCase):
    def test_mac_as_before(self):
        # what scene.py did before: compute type METAL, the Metal devices on, the CPU off, device GPU
        backend, prefs, scene, said = render([CPU, dev("METAL", "Apple M3 Max (GPU - 40 cores)")])
        self.assertEqual((backend, prefs.compute_device_type, scene.cycles.device), ("METAL", "METAL", "GPU"))
        self.assertEqual({d.type: d.use for d in prefs.devices}, {"CPU": False, "METAL": True})
        self.assertEqual(said, ["Cycles: Apple M3 Max (GPU - 40 cores) (Metal)"])

    def test_windows_nvidia(self):
        backend, prefs, scene, said = render([dev("CPU", "Ryzen 9"), dev("CUDA", "RTX 4070"), dev("OPTIX", "RTX 4070")])
        self.assertEqual((backend, prefs.compute_device_type, scene.cycles.device), ("OPTIX", "OPTIX", "GPU"))
        self.assertEqual([d.type for d in prefs.devices if d.use], ["OPTIX"])
        self.assertIn("OptiX", said[0])

    def test_cpu_warns(self):
        backend, prefs, scene, said = render([dev("CPU", "Core i7")])
        self.assertEqual((backend, prefs.compute_device_type, scene.cycles.device), (None, "NONE", "CPU"))
        self.assertIn("WARNING", said[0])
        self.assertIn("CPU", said[0])

    def test_remembered_card_is_not_used(self):
        # preferences saved on a computer with an NVIDIA card, now on a Mac: only what is here counts
        old = dev("OPTIX", "RTX 3080")
        backend, prefs, scene, _ = render([CPU, dev("METAL", "Apple M4 Pro")], remembered=[old])
        self.assertEqual(backend, "METAL")
        self.assertFalse(old.use)


if __name__ == "__main__":
    unittest.main()
