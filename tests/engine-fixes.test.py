#!/usr/bin/env python3
"""Unit tests for v0.8.4 engine reliability fixes:
- pacing.slanted() ignores hidden letters (scale <= 1e-3) in multi-line beats
- diff-anim.py ignores parked-coordinate/color edits where objects stay hidden in both anims
- reading.match() uses minimal high-confidence cover + char-weighted mean on Vision-split lines
- compare.py --frames prints reference frame numbers without needing rendered frames
- score.py groove() falls back cleanly on unknown groove modes
- scene.py bevel_spiked() flattens bevels that shoot miter spikes past glyph outlines (Blender check if installed)
"""
import importlib.util
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/creator-toy-intro"
LIB = SKILL / "engine/lib"
SCRIPTS = SKILL / "engine/scripts"

# Re-exec with the skill's venv Python if this interpreter lacks numpy or soxr.
try:
    import numpy as np  # noqa: F401
    import soxr  # noqa: F401
except ImportError:
    venv_py = Path.home() / ".chrishkai-video/venv/bin/python3"
    if venv_py.exists() and Path(sys.prefix) != venv_py.parents[1]:
        os.execv(str(venv_py), [str(venv_py), __file__, *sys.argv[1:]])
    raise

sys.path.insert(0, str(LIB))
import pacing  # noqa: E402
import reading  # noqa: E402


def load_script(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


diff_anim = load_script("diff_anim", SCRIPTS / "diff-anim.py")


class PacingSlantedTests(unittest.TestCase):
    def _anim(self, shown_q, hidden_pos=(0, -5, 0)):
        fps, sub, dur = 30, 2, 4
        S = (fps * dur - 1) * sub + 1
        cam = [[0, 0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1], [S - 1, 0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1]]
        vis_line = [[0, 0, 0.2, 0.0, *shown_q, 1, 1, 1], [S - 1, 0, 0.2, 0.0, *shown_q, 1, 1, 1]]
        hid_line = [[0, *hidden_pos, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4], [S - 1, *hidden_pos, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4]]
        objs = [
            {"name": "camera", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_live0", "letter": "A", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_live1", "letter": "B", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid0", "letter": "X", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid1", "letter": "Y", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid2", "letter": "Z", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            {"name": "beat0_hid3", "letter": "W", "parent": "root", "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
        ]
        tracks = {
            "camera": cam,
            "beat0_live0": vis_line,
            "beat0_live1": vis_line,
            "beat0_hid0": hid_line,
            "beat0_hid1": hid_line,
            "beat0_hid2": hid_line,
            "beat0_hid3": hid_line,
        }
        return {"fps": fps, "sub": sub, "frames": fps * dur, "samples": S, "objects": objs, "tracks": tracks, "scalars": {}}, [
            {"kind": "beat", "f0": 0.0, "f1": float(dur)}
        ]

    def test_hidden_parked_letters_do_not_trigger_slant(self):
        # 2 visible letters facing straight at camera (+z), outnumbered by 4 hidden letters parked underground at y=-5
        anim, segs = self._anim(shown_q=(0, 0, 0, 1))
        self.assertEqual(pacing.slanted(anim, segs), [])

    def test_truly_slanted_visible_letters_are_still_caught(self):
        # Rotate visible letters 40 degrees around Y so they genuinely face away from the camera
        rad = math.radians(40)
        q = (0, math.sin(rad / 2), 0, math.cos(rad / 2))
        anim, segs = self._anim(shown_q=q)
        res = pacing.slanted(anim, segs)
        self.assertEqual(len(res), 1)
        self.assertGreaterEqual(res[0]["deg"], 35)
        self.assertEqual(res[0]["names"], ["beat0_live0", "beat0_live1"])


class DiffAnimTests(unittest.TestCase):
    def _base_anim(self, park_x=0.0, show_lamp=True):
        F, SUB = 60, 2
        N = F * SUB - 1
        # Beat 1 visible on frames 21..40 (samples 40..79), parked outside
        star_keys = [
            [0, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [39, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [40, 0.1 + park_x, 0.1, 0, 0, 0, 0, 1, 1, 1, 1],
            [79, 0.1 + park_x, 0.1, 0, 0, 0, 0, 1, 1, 1, 1],
            [80, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [N - 1, park_x, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
        ]
        lamp_sc = [1, 1, 1] if show_lamp else [1e-4, 1e-4, 1e-4]
        lamp_keys = [
            [0, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [39, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [40, -0.5, 0.1, 0, 0, 0, 0, 1, *lamp_sc],
            [79, -0.5, 0.1, 0, 0, 0, 0, 1, *lamp_sc],
            [80, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
            [N - 1, -0.5, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4],
        ]
        return {
            "fps": 30, "frames": F, "sub": SUB, "samples": N,
            "objects": [
                {"name": "star0", "parent": "root", "geo": {"type": "box", "size": [0.1, 0.1, 0.1]}, "mat": {"type": "type"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                {"name": "lamp", "parent": "root", "geo": {"type": "box", "size": [0.1, 0.1, 0.1]}, "mat": {"type": "type"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
            ],
            "tracks": {"star0": star_keys, "lamp": lamp_keys},
            "colors": {},
            "scalars": {},
        }

    def test_parked_hidden_changes_do_not_trigger_full_rerender(self):
        old = self._base_anim(park_x=0.0, show_lamp=True)
        new = self._base_anim(park_x=0.02, show_lamp=False)
        frames, _ = diff_anim.diff_frames(old, new)
        # Only frames around Beat 1 (20..41), never frames 1..19 or 42..60!
        self.assertTrue(frames)
        self.assertGreaterEqual(min(frames), 20)
        self.assertLessEqual(max(frames), 41)
        self.assertLess(len(frames), 25)

    def test_unitscale_geo_metadata_does_not_mark_unchanged_picture_cards(self):
        old = self._base_anim(park_x=0.0, show_lamp=True)
        old["objects"].append({
            "name": "beat0_cyc",
            "parent": "root",
            "geo": {"type": "uiBox", "rect": [-750, -250, 1500, 500], "uvRect": [0, 0, 1500, 500], "thickness": 0.003},
            "mat": {"type": "ui", "image": "assets/banner.jpg"},
            "tr": [0, 0.2, -0.8, 0, 0, 0, 1, 0.6, 0.6, 0.6],
        })
        new = json.loads(json.dumps(old))
        new["objects"][-1]["geo"]["unitScale"] = 0.613333
        frames, changed = diff_anim.diff_frames(old, new)
        self.assertEqual(changed, [])
        self.assertEqual(frames, [])


class ReadingSplitCoverTests(unittest.TestCase):
    def test_vision_split_mixed_script_line_passes_with_background_duplicate(self):
        # Exact scenario from Fini.Yang 0317.png: Vision reads foreground cleanly in 2 boxes + noisy card logo at 0.30
        lines = [
            ("OpenPencil 开源", 1.0),
            ("AI 设计", 0.30),
            ("日 openPoncll", 0.30),
            ("0.8.5", 1.0),
            ("7,306 Stars", 0.50),
        ]
        status, _ = reading.match("OpenPencil 开源 AI 设计", lines, base=0.50)
        self.assertEqual(status, "ok")

    def test_genuinely_blurry_split_line_still_flags_shaky(self):
        lines = [("OpenPencil 开源", 0.32), ("AI 设计", 0.30)]
        status, _ = reading.match("OpenPencil 开源 AI 设计", lines, base=0.50)
        self.assertEqual(status, "shaky")


class CompareAndScoreTests(unittest.TestCase):
    def test_compare_frames_flag_works_without_rendered_pngs(self):
        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            (tdir / "film.json").write_text(json.dumps({"format": {"fps": 30, "duration": 30}, "posts": {}}))
            (tdir / "build").mkdir()
            (tdir / "build/timeline.json").write_text(json.dumps({
                "FPS": 30,
                "DURATION": 30,
                "SEGMENTS": [
                    {"kind": "beat", "f0": 0, "f1": 6, "storyboard": {"frames": [{"at": 4.0}]}},
                    {"kind": "beat", "f0": 6, "f1": 12, "storyboard": {"frames": [{"at": 4.5}]}},
                    {"kind": "beat", "f0": 12, "f1": 24, "storyboard": {"frames": [{"at": 9.5}]}},
                    {"kind": "beat", "f0": 24, "f1": 30, "storyboard": {"frames": [{"at": 4.8}]}},
                ],
                "STORY": {"EV": {}},
            }))
            env = {**os.environ, "FILM": str(tdir)}
            r = subprocess.run([sys.executable, str(SCRIPTS / "compare.py"), "--frames"], capture_output=True, text=True, env=env, check=True)
            nums = [int(x) for x in r.stdout.strip().split(",")]
            # opening=16 (0.5s), toy=106 (3.5s), proof=316 (10.5s), payoff=646 (21.5s), end=886 (29.5s)
            self.assertEqual(nums, [16, 106, 316, 646, 886])

    def test_score_groove_handles_unknown_mode_gracefully(self):
        src = (SKILL / "templates/isnail-30/score.py").read_text()
        self.assertIn("GROOVE_KICKS", src)
        self.assertIn("unknown groove", src)

    def test_diff_anim_tracks_modified_textures_and_since(self):
        park = [0, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4]
        show = [250, 0.35, 0, 0, 0, 0, 1, 1, 1, 1]
        cam_beat2 = [250, 0.25, 1.4, 0, 0, 0, 1, 1, 1, 1]
        cam_cta = [100, 0.25, 1.4, 0, 0, 0, 1, 1, 1, 1]
        anim = {
            "fps": 30,
            "frames": 20,
            "sub": 1,
            "objects": [
                {"name": "camera", "parent": "root", "camera": True, "geo": None, "tr": cam_beat2},
                {"name": "beat2_arch_subPlaque", "parent": "root", "geo": {"type": "uiBox"}, "mat": {"type": "ui", "image": "assets/work/props/sub-plaque.jpg"}, "tr": park},
                {"name": "beat1_card", "parent": "root", "geo": {"type": "uiBox"}, "mat": {"type": "ui", "image": "assets/work/props/other.jpg"}, "tr": show},
            ],
            "tracks": {
                # Camera is on Beat 2 (x=250) on samples 0..15, then cuts to CTA stage (x=100, 150m away) on samples 16..18.
                "camera": [[s, *(cam_beat2 if s <= 15 else cam_cta)] for s in range(19)],
                # subPlaque sits on Beat 2 unparked from sample 10 onward, so only samples 10..15 are in camera clip!
                "beat2_arch_subPlaque": [[s, *(show if s >= 10 else park)] for s in range(19)],
                "beat1_card": [[0, *show], [18, *show]],
            },
            "colors": {},
            "scalars": {},
        }
        frames, objs = diff_anim.image_frames(anim, ["assets/work/props/sub-plaque.jpg"])
        self.assertEqual(objs, ["beat2_arch_subPlaque"])
        self.assertGreaterEqual(min(frames), 10)
        self.assertLessEqual(max(frames), 18)
        self.assertNotIn(1, frames)
        self.assertNotIn(20, frames)
        # Basename matching works too
        frames_base, _ = diff_anim.image_frames(anim, ["sub-plaque.jpg"])
        self.assertEqual(frames_base, frames)
        # --since detects only files newer than reference file
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            props = fdir / "assets/work/props"
            props.mkdir(parents=True)
            other = props / "other.jpg"
            other.write_bytes(b"old")
            ref = fdir / "ref.mp4"
            ref.write_bytes(b"ref")
            sub = props / "sub-plaque.jpg"
            sub.write_bytes(b"new")
            os.utime(other, (1_000_000, 1_000_000))
            os.utime(ref, (1_000_010, 1_000_010))
            os.utime(sub, (1_000_020, 1_000_020))
            newer = diff_anim.newer_images(anim, fdir, ref)
            self.assertEqual(newer, ["assets/work/props/sub-plaque.jpg"])

    def test_run_mjs_registers_clearance_and_diff_steps(self):
        src = (SKILL / "engine/run.mjs").read_text()
        self.assertIn('case "clearance":', src)
        self.assertIn('case "diff":', src)

    def test_safezone_uses_timeline_final_for_early_two_column_hold(self):
        src = (SKILL / "engine/scripts/safezone.py").read_text()
        self.assertIn('build/timeline.json', src)
        self.assertIn('hold_from = min(hold_from', src)

    def test_check_mjs_gates_counter_on_playsAct2_and_calls_floatingSmallLetters(self):
        src = (SKILL / "engine/scripts/check.mjs").read_text()
        self.assertIn("playsAct2", src)
        self.assertIn("floatingSmallLetters", src)
        self.assertIn("offStageObjects", src)
        self.assertIn("lineOverlaps", src)
        self.assertIn("oversizedUiBoxes", src)
        self.assertIn("movieWraps", src)
        self.assertIn("filmSceneHash", src)

    def test_scene_cyclic_and_template_prop_signature_helpers(self):
        scene_src = (SKILL / "engine/scripts/scene.py").read_text()
        self.assertIn('bool(spec.get("cyclic", True))', scene_src)
        tl_src = (SKILL / "templates/isnail-30/timeline.js").read_text()
        self.assertIn("lettersWindowEnd", tl_src)
        self.assertIn("easeIn", tl_src)
        self.assertIn("qFlat", tl_src)
        self.assertIn("cutout", tl_src)
        anim_src = (SKILL / "templates/isnail-30/anim.js").read_text()
        self.assertIn("Array.isArray(SIG.at)", anim_src)
        self.assertIn("SIG_LIFT", anim_src)
        exp_src = (SKILL / "engine/scripts/export-anim.mjs").read_text()
        self.assertIn(".anim-meta.json", exp_src)
        sb_src = (SKILL / "engine/scripts/storyboard.py").read_text()
        self.assertIn('.meta.json', sb_src)

    def test_fonts_chosen_accepts_string_shorthand_and_dicts(self):
        import fonts
        parsed = fonts.chosen({
            "heavy": "Lantinghei SC:Demibold, PingFang SC:Semibold",
            "display": ["Songti SC:Bold", {"family": "Heiti SC", "style": "Medium"}],
            "why": "test reason",
        })
        self.assertEqual(parsed["heavy"], [("Lantinghei SC", "Demibold"), ("PingFang SC", "Semibold")])
        self.assertEqual(parsed["display"], [("Songti SC", "Bold"), ("Heiti SC", "Medium")])
        self.assertNotIn("why", parsed)

    def test_animatic_step_respects_frames_override_and_check_guards_blank_ui(self):
        run_src = (SKILL / "engine/run.mjs").read_text()
        self.assertIn('more.includes("--frames") ? [] : ["--frames"', run_src)
        self.assertIn('more.includes("--engine") ? [] : ["--engine", "eevee"]', run_src)
        check_src = (SCRIPTS / "check.mjs").read_text()
        self.assertIn("the scene opens assets/ui.png, but ui wrote a blank pageless texture", check_src)
        self.assertIn("cardScreenOverlaps", check_src)
        self.assertIn("heroFaceOcclusions", check_src)
        self.assertIn("confettiOverText", check_src)


class SceneBevelSpikeBlenderTest(unittest.TestCase):
    def test_blender_flattens_hairpin_curve_bevel_spike(self):
        local_mac = "/Applications/Blender.app/Contents/MacOS/Blender"
        home_mac = str(Path.home() / "Applications/Blender.app/Contents/MacOS/Blender")
        blender = (local_mac if Path(local_mac).exists() else None) or (home_mac if Path(home_mac).exists() else None) or shutil.which("blender")
        if not blender:
            self.skipTest("Blender not installed")
        # Build a tiny temporary film workspace with a hairpin-corner curve that shoots a huge miter spike under bevel!
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "film.json").write_text(json.dumps({
                "format": {"fps": 30, "duration": 1, "size": [320, 180]},
                "toy": "toy.json",
                "cta": {},
                "look": {},
            }))
            (fdir / "toy.json").write_text(json.dumps({"colors": {"body": "#2F61EB"}, "height": 0.12}))
            (fdir / "build").mkdir()
            # Near-180° hairpin spike polygon (width ~0.04 m, height ~0.04 m) + normal square
            hairpin = [[0.0, 0.0], [0.04, 0.0], [0.04, 0.04], [0.02, 0.04], [0.02002, 0.002], [0.01998, 0.04], [0.0, 0.04]]
            square = [[0.0, 0.0], [0.04, 0.0], [0.04, 0.04], [0.0, 0.04]]
            (fdir / "build/anim.json").write_text(json.dumps({
                "fps": 30, "frames": 1, "sub": 1, "samples": 1,
                "objects": [
                    {"name": "camera", "parent": "root", "camera": True, "geo": None, "tr": [0, 0, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "fx", "parent": "root", "light": True, "geo": None, "tr": [0, 1, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "spiky_single", "parent": "root", "geo": {"type": "curve", "rings": [hairpin], "depth": 0.003, "bevel": 0.0005}, "mat": {"type": "type", "color": "#FFFFFF", "emit": 0}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "spiky_sided", "parent": "root", "geo": {"type": "curve", "rings": [hairpin], "depth": 0.003, "bevel": 0.0005}, "mat": {"type": "type", "color": "#FFFFFF", "emit": 0, "side": "#111111"}, "tr": [0.1, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "clean_sq", "parent": "root", "geo": {"type": "curve", "rings": [square], "depth": 0.003, "bevel": 0.0005}, "mat": {"type": "type", "color": "#FFFFFF", "emit": 0}, "tr": [0.2, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {},
                "colors": {},
                "scalars": {"fov": [35.0], "focus": [1.0], "fstop": [5.6], "fx_energy": [1.0], "fx_color": [[1.0, 1.0, 1.0]]},
            }))
            check_expr = """
import bpy, json
deps = bpy.context.evaluated_depsgraph_get()
out = {}
for n in ("spiky_single", "spiky_sided", "clean_sq"):
    o = bpy.data.objects[n].evaluated_get(deps)
    me = bpy.data.meshes.new_from_object(o)
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    out[n] = {"x": [round(min(xs), 4), round(max(xs), 4)], "y": [round(min(ys), 4), round(max(ys), 4)], "bevel": getattr(o.data, "bevel_depth", None)}
    bpy.data.meshes.remove(me)
print("RESULT:" + json.dumps(out))
"""
            env = {**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}
            r = subprocess.run([blender, "-b", "--factory-startup", "--python-exit-code", "1", "-P", str(SCRIPTS / "scene.py"), "--python-expr", check_expr, "--", "--samples", "1", "--scale", "10"], capture_output=True, text=True, env=env)
            self.assertEqual(r.returncode, 0, msg=f"Blender failed:\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}")
            line = next(x for x in r.stdout.splitlines() if x.startswith("RESULT:"))
            data = json.loads(line.split("RESULT:", 1)[1])
            # Both hairpin curves must stay tightly bounded within [0, 0.04] (zero miter spike!)
            self.assertLessEqual(data["spiky_single"]["x"][1], 0.045)
            self.assertGreaterEqual(data["spiky_single"]["y"][0], -0.005)
            self.assertEqual(data["spiky_single"]["bevel"], 0.0)
            self.assertLessEqual(data["spiky_sided"]["x"][1], 0.045)
            self.assertGreaterEqual(data["spiky_sided"]["y"][0], -0.005)
            # Normal square keeps its bevel intact!
            self.assertAlmostEqual(data["clean_sq"]["bevel"], 0.0005, places=5)


class V089EngineImprovementTests(unittest.TestCase):
    def test_fonts_chosen_and_storyboard_shorthand_consistency(self):
        import fonts
        for spec in (
            {"heavy": "PingFang SC:Semibold", "why": "clean strokes"},
            {"heavy": {"family": "PingFang SC", "style": "Semibold"}, "why": "clean strokes"},
            {"heavy": [{"family": "PingFang SC", "style": "Semibold"}], "why": "clean strokes"},
        ):
            picked = [f"{pairs[0][0]} {pairs[0][1]}".strip() for k, pairs in fonts.chosen(spec).items() if k in ("heavy", "display") and pairs]
            self.assertEqual(picked, ["PingFang SC Semibold"])

    def test_glyphs_merge_extra_accepts_string_and_dict(self):
        sys.path.insert(0, str(SCRIPTS))
        import glyphs
        merge_extra_glyphs = glyphs.merge_extra_glyphs

        chars = {"latin": "0123456789", "cjk": "万", "heavy": "", "display": ""}
        merge_extra_glyphs(chars, "20岁+AI")
        self.assertIn("岁", chars["heavy"])
        self.assertIn("岁", chars["cjk"])
        self.assertIn("+", chars["latin"])
        self.assertIn("A", chars["latin"])

        chars2 = {"latin": "0123456789", "cjk": "万", "heavy": "", "display": ""}
        merge_extra_glyphs(chars2, {"heavy": "官方", "latin": "%"})
        self.assertEqual(chars2["heavy"], "官方")
        self.assertIn("%", chars2["latin"])

    def test_dark_picture_card_detection_and_bright_bezel_fix(self):
        import colors
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "assets/work").mkdir(parents=True)
            (fdir / "build").mkdir()
            (fdir / "film.json").write_text(json.dumps({
                "id": "dark-card-test",
                "step": "story",
                "format": {"fps": 30, "duration": 2, "size": [1920, 1080]},
                "toy": "toy.json",
                "pop": {"confetti": ["#38E0FF"]},
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.12,
                "colors": {"coat": "#F4F6FA"},
                "parts": [{"name": "body", "group": "body", "shape": "roundBox", "size": [0.06, 0.08, 0.05], "mat": "coat"}],
            }))
            # 1) Unframed dark IDE screenshot (#0E1117) -> melts into #0B0C10 dark stage
            raw_im = Image.new("RGB", (320, 200), (14, 17, 23))
            raw_im.save(fdir / "assets/work/dark.png")
            # 2) Same dark IDE screenshot wrapped in a crisp cyan window frame -> reads cleanly
            framed_im = Image.new("RGB", (320, 200), (14, 17, 23))
            d = ImageDraw.Draw(framed_im)
            d.rectangle((0, 0, 319, 199), outline=(56, 224, 255), width=8)
            framed_im.save(fdir / "assets/work/framed.png")

            (fdir / "build/anim.json").write_text(json.dumps({
                "fps": 30, "frames": 2, "sub": 1, "samples": 2,
                "objects": [
                    {"name": "camera", "parent": "root", "tr": [0, 0.2, 1.2, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat1_raw_ui", "parent": "root", "geo": {"type": "uiBox", "rect": [-160, -100, 320, 200], "thickness": 0.002}, "mat": {"type": "ui", "image": "assets/work/dark.png"}, "tr": [-0.2, 0.2, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat1_framed_ui", "parent": "root", "geo": {"type": "uiBox", "rect": [-160, -100, 320, 200], "thickness": 0.002}, "mat": {"type": "ui", "image": "assets/work/framed.png"}, "tr": [0.2, 0.2, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {"camera": [[0, 0, 0.2, 1.2, 0, 0, 0, 1, 1, 1, 1], [1, 0, 0.2, 1.2, 0, 0, 0, 1, 1, 1, 1]]},
                "scalars": {"fov": [30.0, 30.0]},
            }))
            fc = colors.film_colours(fdir)
            by_name = {c["name"]: c for c in fc["cards"]}
            self.assertTrue(by_name["beat1_raw_ui"]["melts"])
            self.assertFalse(by_name["beat1_framed_ui"]["melts"])

    def test_pacing_reports_long_sfx_cue_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "film.json").write_text(json.dumps({"format": {"fps": 30, "duration": 10, "size": [1920, 1080]}, "toy": "toy.json"}))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12}))
            (fdir / "build/anim.json").write_text(json.dumps({"fps": 30, "frames": 300, "sub": 1, "samples": 300, "objects": [], "tracks": {}, "scalars": {}}))
            (fdir / "build/timeline.json").write_text(json.dumps({
                "DURATION": 10.0, "BAR": 2.0,
                "cues": [{"t": 0.5, "kind": "pop"}, {"t": 6.8, "kind": "lock"}, {"t": 9.2, "kind": "ding"}],
            }))
            res = pacing.check(fdir)
            self.assertEqual(res["cueGaps"], [(0.5, 6.8)])

    def test_compose_example_uses_core_packs_and_renders_synth_fallback(self):
        import compose
        import synth
        src = (LIB / "compose.py").read_text()
        for removed in ("jazz_bass", "claps", "sus_cymbal", '"hihat"'):
            self.assertNotIn(removed, src)
        c = compose.Ctx()
        c.dur, c.sr, c.n = 4.0, synth.SR, int(4.0 * synth.SR)
        c.bpm, c.beat, c.bar = 120, 0.5, 2.0
        c.film, c.synth, c.real = {}, synth, None
        c.cues, c.hits = [], [2.0]
        c.sections = [{"f0": 0.0, "f1": 4.0, "kind": "beat", "name": "beats/demo.js", "music": {"groove": "light", "chords": ["C", "G"]}}]
        c.add, c.midi = compose.add, compose.midi
        buf = compose.example(c)
        self.assertEqual(buf.shape, (c.n, 2))
        self.assertGreater(float(np.abs(buf).max()), 0.05)


class V0810EngineImprovementTests(unittest.TestCase):
    def test_glyphs_harvest_js_extracts_3d_copy_and_ignores_comments_and_storyboard(self):
        sys.path.insert(0, str(SCRIPTS))
        import glyphs
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "beats").mkdir()
            (fdir / "beats/b1.js").write_text(
                """// 廢話行註解
/* 區塊註解 測試 */
export function makeBeat({ opts, glyph, kit }) {
  const HOOK_TEXT = opts.text ?? "专治痛点";
  const ln = kit.line(glyph, "57.7万 查看", 0.05);
  const chars = [..."工具箱"];
  const g = glyph.geo("display:龙海", 0.06, 0.005, 0.001);
  return {
    reads: [{ text: "把经验变成工具", at: [1.5, 5.5] }],
    storyboard: {
      part: { label: { "zh-Hant": "繁體分鏡說明唔應該入字表" } },
    },
  };
}
""",
                encoding="utf-8",
            )
            found = glyphs.harvest_js_glyphs(
                fdir,
                {"story": {"segments": [{"beat": "beats/b1.js"}]}, "cta": {}},
            )
            for ch in ("专", "查", "箱", "把"):
                self.assertIn(ch, found["heavy"])
                self.assertIn(ch, found["cjk"])
            self.assertIn("龙", found["display"])
            self.assertIn("海", found["display"])
            self.assertIn("5", found["latin"])
            self.assertIn(".", found["latin"])
            for ignored in ("廢", "註", "繁", "唔"):
                self.assertNotIn(ignored, found["heavy"])
                self.assertNotIn(ignored, found["cjk"])

    def test_pacing_unread_accepts_staggered_typing_ramp_and_flags_unlisted_line(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "film.json").write_text(json.dumps({"format": {"fps": 30, "duration": 6, "size": [1920, 1080]}, "toy": "toy.json"}))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12}))
            fps, frames = 30, 180
            letters_str = "专治痛点吧"
            objs, tracks = [], {}
            for idx, ch in enumerate(letters_str):
                name = f"beat0_ln{idx}"
                t_on = 0.40 + idx * 0.25  # 0.40s .. 1.40s (1.0s typing ramp > 0.5s!)
                f_on, f_off = int(round(t_on * fps)), int(round(5.60 * fps))
                objs.append({"name": name, "letter": ch, "line": "ln", "tr": [0, 0, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4]})
                tracks[name] = [
                    [s, 0, 0, 0, 0, 0, 1, *( [1.0, 1.0, 1.0] if f_on <= s < f_off else [1e-4, 1e-4, 1e-4] )]
                    for s in range(frames)
                ]
            (fdir / "build/anim.json").write_text(json.dumps({"fps": fps, "frames": frames, "sub": 1, "samples": frames, "objects": objs, "tracks": tracks, "scalars": {}}))
            (fdir / "build/timeline.json").write_text(json.dumps({
                "DURATION": 6.0, "BAR": 2.0,
                "SEGMENTS": [{"kind": "beat", "f0": 0.0, "f1": 6.0}],
                "cues": [{"t": 0.4, "kind": "pop"}, {"t": 3.0, "kind": "lock"}],
            }))
            # 1) `reads` starts at LOCK (1.40s) when the last letter lands, per `beats/phrase.js`: zero false warnings!
            (fdir / "build/reads.json").write_text(json.dumps([{"text": letters_str, "at": [1.4, 5.6]}]))
            self.assertEqual(pacing.check(fdir)["unread"], [])

            # 2) Missing `reads` entry still gets flagged cleanly
            (fdir / "build/reads.json").write_text(json.dumps([]))
            unread_none = pacing.check(fdir)["unread"]
            self.assertEqual(len(unread_none), 1)
            self.assertEqual(unread_none[0]["beat"], 0)

            # 3) `reads` ending 1.6s before the settled line leaves still gets flagged cleanly
            (fdir / "build/reads.json").write_text(json.dumps([{"text": letters_str, "at": [1.4, 4.0]}]))
            unread_short = pacing.check(fdir)["unread"]
            self.assertEqual(len(unread_short), 1)
            self.assertAlmostEqual(unread_short[0]["said"], 2.6, places=1)

    def test_reading_confidence_ignores_low_conf_background_duplicate(self):
        import reading
        self.assertAlmostEqual(
            reading.confidence("AI 生活家", [("AI 生活家", 1.0), ("AI 生活家 · 独立开发", 0.30)]),
            1.0,
            places=3,
        )
        self.assertAlmostEqual(
            reading.confidence("AI 生活家", [("AI 生活家", 0.30)]),
            0.30,
            places=3,
        )

    def test_two_column_long_slogan_avoids_machine_gun_letter_step(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "build/glyphs.json").write_text("{}")
            (fdir / "film.json").write_text(json.dumps({
                "id": "two-col-step",
                "template": "isnail-30",
                "theme": "x-desktop",
                "format": {"fps": 30, "bpm": 120, "duration": 30, "size": [1920, 1080]},
                "toy": "toy.json",
                "profile": {"name": "龙海", "handle": "@longhaiqwe123", "bio": ["AI 生活家"]},
                "posts": [
                    {"date": "2026-03-01", "title": "A", "counts": {"views": "1万"}, "cover": "assets/a.jpg"},
                    {"date": "2026-03-02", "title": "B", "counts": {"views": "1万"}, "cover": "assets/b.jpg"},
                ],
                "counter": {"value": 57.7, "unit": "万", "label": "查看", "display": "57.7万"},
                "cta": {
                    "layout": "two-column",
                    "slogan": [{"text": "把生活经验"}, {"text": "变成人人能用的AI工具"}],
                    "name": {"text": "龙海"},
                    "handle": {"text": "@longhaiqwe123"},
                    "prop": {"kind": "plinth"},
                },
                "story": {"exit": "jump", "segments": [{"beat": "phrase", "bars": 12, "text": "测试"}, {"story": "endCard"}]},
            }))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12, "colors": {"body": "#2F61EB"}}))
            tl_url = (SKILL / "templates/isnail-30/timeline.js").as_uri()
            code = f'import {{ EV, LETTER_STEP, SLOGAN, reads }} from {json.dumps(tl_url)}; console.log(JSON.stringify({{ EV, LETTER_STEP, SLOGAN, reads: reads() }}));'
            r = subprocess.run(["node", "--input-type=module", "-e", code], cwd=str(SKILL), env={**os.environ, "FILM": str(fdir)}, capture_output=True, text=True, check=True)
            data = json.loads(r.stdout.strip().splitlines()[-1])
            self.assertGreaterEqual(data["LETTER_STEP"], 0.048)
            self.assertGreaterEqual(data["EV"]["letters"], data["EV"]["cut"] + 0.09)
            slo_read = next(x for x in data["reads"] if x["text"] == data["SLOGAN"])
            self.assertGreaterEqual(slo_read["at"][1] - slo_read["at"][0], pacing.need(data["SLOGAN"]) - 0.05)

    def test_run_mjs_tracks_js_glyph_sources_and_incremental_previs_snapshot(self):
        run_src = (SKILL / "engine/run.mjs").read_text()
        self.assertIn('b.endsWith(".js")', run_src)
        self.assertIn("film.cta?.prop?.module", run_src)
        self.assertIn(".anim-snapshot.json", run_src)
        self.assertIn('"--since", snapPath', run_src)


class V0811EngineImprovementTests(unittest.TestCase):
    def test_pacing_shrunk_warns_when_custom_beat_toy_under_22_percent_and_honors_wide(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "toy.json").write_text(json.dumps({"height": 0.14}))
            # Toy height = 0.14 m, pop scale = 1.0, camera at z = 1.40 m, fov = 30 deg -> tan(15°) ≈ 0.2679 -> screen share ≈ 0.14 / (2 * 1.40 * 0.2679) ≈ 18.7% (< 22%)
            fps, frames = 30, 120
            anim = {
                "fps": fps,
                "frames": frames,
                "sub": 1,
                "samples": frames,
                "objects": [
                    {"name": "camera", "parent": "root", "tr": [0, 0.10, 1.40, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "hero", "parent": "root", "tr": [0, 0.07, 0.0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {
                    "camera": [[0, 0, 0.10, 1.40, 0, 0, 0, 1, 1, 1, 1], [frames - 1, 0, 0.10, 1.40, 0, 0, 0, 1, 1, 1, 1]],
                    "hero": [[0, 0, 0.07, 0.0, 0, 0, 0, 1, 1, 1, 1], [frames - 1, 0, 0.07, 0.0, 0, 0, 0, 1, 1, 1, 1]],
                },
                "scalars": {"fov": [30.0] * frames},
            }
            (fdir / "build/anim.json").write_text(json.dumps(anim))
            (fdir / "build/timeline.json").write_text(json.dumps({
                "DURATION": 4.0,
                "BAR": 2.0,
                "SEGMENTS": [{"kind": "beat", "beat": "beats/far.js", "f0": 0.0, "f1": 4.0}],
                "cues": [{"t": 0.5, "kind": "pop"}, {"t": 2.5, "kind": "lock"}],
            }))
            (fdir / "film.json").write_text(json.dumps({
                "format": {"fps": 30, "duration": 4, "size": [1920, 1080]},
                "toy": "toy.json",
                "story": {"segments": [{"beat": "beats/far.js", "bars": 2}]},
            }))
            res = pacing.check(fdir)
            self.assertEqual(len(res["shrunk"]), 1)
            self.assertAlmostEqual(res["shrunk"][0][2], 0.187, places=2)

            # Explicit `"wide": true` suppresses the shrunk warning on intentional wide reveals
            (fdir / "film.json").write_text(json.dumps({
                "format": {"fps": 30, "duration": 4, "size": [1920, 1080]},
                "toy": "toy.json",
                "story": {"segments": [{"beat": "beats/far.js", "bars": 2, "wide": True}]},
            }))
            self.assertEqual(pacing.check(fdir)["shrunk"], [])

    def test_silent_icon_ghost_filters_blurred_ring_marks_and_keeps_real_words(self):
        sys.path.insert(0, str(SCRIPTS))
        import silent
        self.assertTrue(silent.icon_ghost("D0", 0.42))
        self.assertTrue(silent.icon_ghost("OO", 0.55))
        self.assertTrue(silent.icon_ghost("Il", 0.30))
        self.assertFalse(silent.icon_ghost("D0", 0.92))
        self.assertFalse(silent.icon_ghost("24h", 0.40))
        self.assertFalse(silent.icon_ghost("AI", 0.40))
        self.assertFalse(silent.icon_ghost("阅读", 0.35))

    def test_real_instrument_and_single_hit_variant_error_suggestions(self):
        import real
        from unittest.mock import patch

        with self.assertRaises(KeyError) as ctx1:
            real.note("violins_sus", "G4", 1.0, 0.5)
        self.assertIn("violins", str(ctx1.exception))
        self.assertIn("violins_trem", str(ctx1.exception))

        class DummySingleHit:
            name = "crash"
            kind = "hit"
            vars = []

        with patch.object(real.S, "hit", side_effect=KeyError("crash has no variant 'crash'")), \
             patch.object(real.S, "load", return_value=DummySingleHit()):
            with self.assertRaises(KeyError) as ctx2:
                real.hit("cymbal", "crash", 0.5)
            self.assertIn("single-hit instrument", str(ctx2.exception))
            self.assertIn("None", str(ctx2.exception))

    def test_finish_incremental_frame_cache_reuses_untouched_pngs(self):
        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg not installed")
        import wave
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build/render").mkdir(parents=True)
            (fdir / "assets/audio").mkdir(parents=True)
            (fdir / "out").mkdir(parents=True)
            (fdir / "film.json").write_text(json.dumps({
                "id": "cache-test",
                "theme": "x-desktop",
                "output": "out/cache-test.mp4",
                "format": {"fps": 30, "duration": 0.1, "size": [64, 36]},
                "toy": "toy.json",
            }))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12, "colors": {"body": "#F4F6FA"}}))
            for idx in (1, 2, 3):
                Image.new("RGB", (64, 36), (20 * idx, 40, 80)).save(fdir / f"build/render/{idx:04d}.png")
            for wav_name in ("score.wav", "score-sfx.wav"):
                with wave.open(str(fdir / "assets/audio" / wav_name), "wb") as wf:
                    wf.setnchannels(2)
                    wf.setsampwidth(2)
                    wf.setframerate(48000)
                    wf.writeframes(b"\x00\x00\x00\x00" * 4800)

            env = {**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}
            r1 = subprocess.run([sys.executable, str(SCRIPTS / "finish.py"), "--workers", "1"], env=env, capture_output=True, text=True, check=True)
            self.assertIn("finished 3/3", r1.stdout)
            self.assertTrue((fdir / "out/cache-test.mp4").is_file())

            # Second run with `--sfx-cut`: reuses all 3 finished frames AND skips re-encoding main MP4!
            r2 = subprocess.run([sys.executable, str(SCRIPTS / "finish.py"), "--sfx-cut", "--workers", "1"], env=env, capture_output=True, text=True, check=True)
            self.assertIn("reused all 3 finished frame(s)", r2.stdout)
            self.assertIn("up to date", r2.stdout)
            self.assertTrue((fdir / "out/cache-test-sfx.mp4").is_file())

            # Touch only frame 0002.png -> reuses 2/3 unchanged frames and finishes 1!
            Image.new("RGB", (64, 36), (220, 120, 40)).save(fdir / "build/render/0002.png")
            r3 = subprocess.run([sys.executable, str(SCRIPTS / "finish.py"), "--workers", "1"], env=env, capture_output=True, text=True, check=True)
            self.assertIn("reusing 2/3 unchanged finished frame(s); finishing 1", r3.stdout)


class V0812EngineImprovementTests(unittest.TestCase):
    def test_glyphs_harvests_bannerLine_and_readoutBadge_label(self):
        glyphs_mod = load_script("glyphs_v0812", SCRIPTS / "glyphs.py")
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "beats").mkdir()
            (fdir / "beats/custom.js").write_text(
                'export function makeBeat({ glyph, kit }) {\n'
                '  const b = kit.bannerLine(glyph, "前助教公开", { em: 0.03 });\n'
                '  const c = kit.readoutBadge(glyph, { to: 1.4, label: "关注者" });\n'
                '  return { storyboard: { part: { label: { zh: "忽略分镜" } } } };\n'
                '}\n',
                encoding="utf-8",
            )
            film_json = {"story": {"segments": [{"beat": "beats/custom.js", "bars": 2}]}}
            got = glyphs_mod.harvest_js_glyphs(fdir, film_json)
            for ch in "前助教公关注者":
                self.assertIn(ch, got["heavy"])
            self.assertNotIn("忽", got["heavy"])

    def test_reading_baseline_handles_mixed_latin_I_lookalike_ceiling(self):
        from unittest.mock import patch

        fake_face = None
        for cand in ("/System/Library/Fonts/PingFang.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"):
            if Path(cand).exists():
                fake_face = (cand, 0)
                break
        if not fake_face:
            self.skipTest("No local CJK font found for PIL ImageFont")

        def fake_read(_r, paths):
            out = {}
            for i, p in enumerate(paths):
                # Variant 0 ("AI 练好听说") scores 0.5; variant 1 ("Al 练好听说") scores 0.3
                out[str(p)] = [("AI 练好听说", 0.5)] if str(p).endswith("_0.png") else [("Al 练好听说", 0.3)]
            return out

        with patch.object(reading, "read", side_effect=fake_read):
            base = reading.baseline(("vision", "mock"), ["AI 练好听说"], fake_face)
        self.assertAlmostEqual(base["AI 练好听说"], 0.3, places=3)
        # Full character match at 0.30 meets the 0.30 look-alike ceiling -> "ok"
        how, _ = reading.match("AI 练好听说", [("Al 练好听说", 0.30)], base["AI 练好听说"])
        self.assertEqual(how, "ok")
        # Missing character still fails as "wrong"
        how_bad, _ = reading.match("AI 练好听说", [("Al 练好听", 0.30)], base["AI 练好听说"])
        self.assertEqual(how_bad, "wrong")

    def test_two_column_default_glide_and_idle_keep_cta_alive_without_changing_sweep(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            g_stub = {"advance": 1.0, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            chars = "0123456789.万阅读Momo@momoAI+英语干货纯小白友好测试"
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in chars
            }))
            for mode in ("two-column", "sweep"):
                (fdir / "film.json").write_text(json.dumps({
                    "id": "cta-test",
                    "template": "isnail-30",
                    "theme": "x-desktop",
                    "format": {"fps": 30, "bpm": 120, "duration": 30, "size": [1920, 1080]},
                    "toy": "toy.json",
                    "profile": {"name": "Momo", "handle": "@momo", "bio": ["AI"]},
                    "posts": {"pinned": {"count": "42.1万"}, "retro": {"count": "35.7万"}},
                    "counter": {"value": 42.1, "unit": "万", "label": "阅读"},
                    "story": {"exit": "jump", "events": {"ride": 24.48, "final": 28.0}, "segments": [{"beat": "phrase", "bars": 12, "text": "测试"}, {"story": [24, "end"]}]},
                    "cta": {
                        "layout": mode,
                        "slogan": [{"text": "AI + 英语干货"}, {"text": "纯小白友好"}],
                        "name": {"text": "Momo"},
                        "handle": {"text": "@momo"},
                        "prop": {"kind": "plinth"},
                    },
                }))
                (fdir / "toy.json").write_text(json.dumps({
                    "height": 0.12,
                    "center": [0, 0.06, 0],
                    "colors": {"body": "#FADAE5", "plinth": "#FAF0F5", "plinthTop": "#FADAE5"},
                    "joints": {"body": {"p": [0, 0.04, 0]}, "head": {"p": [0, 0.08, 0], "parent": "body"}, "armL": {"p": [0.03, 0.06, 0], "parent": "body"}, "armR": {"p": [-0.03, 0.06, 0], "parent": "body"}, "legL": {"p": [0.015, 0.02, 0], "parent": "body"}, "legR": {"p": [-0.015, 0.02, 0], "parent": "body"}},
                    "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.05, 0], "size": [0.05, 0.06, 0.04], "mat": "body"}],
                }))
                tl_url = (SKILL / "templates/isnail-30/timeline.js").as_uri()
                anim_url = (SKILL / "templates/isnail-30/anim.js").as_uri()
                probe = (
                    f"import * as T from {json.dumps(tl_url)};"
                    f"import * as A from {json.dumps(anim_url)};"
                    "const h285 = A.mascotAt(28.5).o.head, h292 = A.mascotAt(29.2).o.head;"
                    "console.log(JSON.stringify({ glide: T.EV.glide, movedAfterFinal: Math.hypot(...h285.map((v,i)=>v-h292[i])) > 1e-4 }));"
                )
                r = subprocess.run(["node", "--input-type=module", "-e", probe], cwd=str(SKILL), env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}, capture_output=True, text=True, check=True)
                data = json.loads(r.stdout.strip().splitlines()[-1])
                if mode == "two-column":
                    self.assertGreater(data["glide"][1] - data["glide"][0], 2.0)
                    self.assertTrue(data["movedAfterFinal"])
                else:
                    self.assertFalse(data["movedAfterFinal"])

    def test_scene_bubble_shader_and_stale_resume_invalidation(self):
        blender_bin = "/Applications/Blender.app/Contents/MacOS/Blender"
        if not Path(blender_bin).exists():
            blender_bin = shutil.which("blender") or ""
        if not blender_bin:
            self.skipTest("Blender not installed")
        import time
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build/out").mkdir(parents=True)
            (fdir / "film.json").write_text(json.dumps({
                "id": "bub-test",
                "theme": "x-desktop",
                "format": {"fps": 30, "bpm": 120, "duration": 0.1, "size": [64, 36]},
                "toy": "toy.json",
                "cta": {},
                "look": {},
            }))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12, "colors": {"body": "#FADAE5"}}))
            # Frame 1 stale (older than anim.json), Frame 2 fresh (newer than anim.json)
            p1 = fdir / "build/out/0001.png"
            p2 = fdir / "build/out/0002.png"
            Image.new("RGB", (32, 18), (0, 0, 0)).save(p1)
            old_t = time.time() - 30
            os.utime(p1, (old_t, old_t))
            (fdir / "build/anim.json").write_text(json.dumps({
                "fps": 30, "sub": 1, "frames": 2, "samples": 2,
                "objects": [
                    {"name": "camera", "parent": "root", "camera": True, "geo": None, "tr": [0, 0, 1.0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "fx", "parent": "root", "light": True, "geo": None, "tr": [0, 1, 1.0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "bub", "parent": "root", "geo": {"type": "ellipsoid", "r": [0.05, 0.05, 0.05]}, "mat": {"type": "bubble", "color": "#FADCF0"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "tint_glass", "parent": "root", "geo": {"type": "ellipsoid", "r": [0.03, 0.03, 0.03]}, "mat": {"type": "glass", "color": "#C4B5FD", "clear": True}, "tr": [0.1, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {"camera": [[0, 0, 0, 1.0, 0, 0, 0, 1, 1, 1, 1], [1, 0, 0, 1.0, 0, 0, 0, 1, 1, 1, 1]]},
                "colors": {},
                "scalars": {"fov": [35.0, 35.0], "focus": [1.0, 1.0], "fstop": [5.6, 5.6], "fx_energy": [1.0, 1.0], "fx_color": [[1.0, 1.0, 1.0], [1.0, 1.0, 1.0]]},
            }))
            Image.new("RGB", (32, 18), (0, 255, 0)).save(p2)
            fresh_t = time.time() + 5
            os.utime(p2, (fresh_t, fresh_t))

            r = subprocess.run(
                [blender_bin, "-b", "--factory-startup", "--python-exit-code", "1", "-P", str(SCRIPTS / "scene.py"),
                 "--", "--engine", "eevee", "--samples", "2", "--scale", "50", "--frames", "1-2", "--out", "build/out", "--resume"],
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                capture_output=True, text=True, check=True,
            )
            self.assertIn("invalidating 1 stale frame(s)", r.stdout)
            self.assertIn("resuming: 1 fresh frame(s) already in out/", r.stdout)
            self.assertGreater(p1.stat().st_mtime, old_t + 10)
            # Fresh frame 2 stayed untouched (still pure green sentinel)
            self.assertEqual(Image.open(p2).getpixel((0, 0)), (0, 255, 0))


class V0813EngineImprovementTests(unittest.TestCase):
    def test_stagekit_paper_accepts_paper_and_fill_keyword_aliases(self):
        import stagekit
        im_pos = stagekit.paper("麦麦提", 48, "#F8FAFC", "#0F172A", seed=3)
        im_kw_paper = stagekit.paper("麦麦提", 48, paper="#F8FAFC", ink="#0F172A", seed=3)
        im_kw_fill = stagekit.paper("麦麦提", 48, fill="#F8FAFC", ink="#0F172A", seed=3)
        self.assertEqual(im_pos.size, im_kw_paper.size)
        self.assertEqual(im_pos.tobytes(), im_kw_paper.tobytes())
        self.assertEqual(im_pos.tobytes(), im_kw_fill.tobytes())

    def test_ensure_cloud_safe_movie_remuxes_mp4_and_diff_anim_tracks_movie_source(self):
        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg not installed")
        diff_mod = load_script("diff_anim_v0813", SCRIPTS / "diff-anim.py")
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "assets/work").mkdir(parents=True)
            (fdir / "film.json").write_text(json.dumps({"format": {"fps": 30, "duration": 1, "size": [64, 36]}}))
            mp4 = fdir / "assets/work/clip-wipe.mp4"
            subprocess.run([
                "ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=navy:s=64x36:r=30:d=0.1",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", str(mp4),
            ], check=True)
            pic_url = (SKILL / "engine/lib/pictures.js").as_uri()
            probe = f'import {{ ensureCloudSafeMovie }} from {json.dumps(pic_url)}; console.log(JSON.stringify(ensureCloudSafeMovie("assets/work/clip-wipe.mp4")));'
            r = subprocess.run(["node", "--input-type=module", "-e", probe], env={**os.environ, "FILM": str(fdir)}, capture_output=True, text=True, check=True)
            mkv_rel = json.loads(r.stdout.strip().splitlines()[-1])
            self.assertEqual(mkv_rel, "build/movies/assets_work_clip-wipe.mkv")
            self.assertTrue((fdir / mkv_rel).is_file())
            self.assertGreater((fdir / mkv_rel).stat().st_size, 0)

            anim = {
                "fps": 30, "sub": 1, "frames": 4, "samples": 4,
                "objects": [
                    {"name": "camera", "parent": "root", "tr": [0, 0, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat1_vid", "parent": "root", "geo": {"type": "uiBox", "rect": [-100, -56, 200, 112], "thickness": 0.002},
                     "mat": {"type": "ui", "image": "assets/work/poster.png", "movie": mkv_rel, "movieSource": "assets/work/clip-wipe.mp4"},
                     "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {"camera": [[0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1], [3, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]]},
                "colors": {}, "scalars": {},
            }
            frames_hit, objs_hit = diff_mod.image_frames(anim, ["assets/work/clip-wipe.mp4"])
            self.assertEqual(objs_hit, ["beat1_vid"])
            self.assertEqual(frames_hit, [1, 2, 3, 4])

    def test_finish_caches_and_auto_refreshes_existing_sfx_cut(self):
        if not shutil.which("ffmpeg"):
            self.skipTest("ffmpeg not installed")
        import wave
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build/render").mkdir(parents=True)
            (fdir / "assets/audio").mkdir(parents=True)
            (fdir / "out").mkdir(parents=True)
            (fdir / "film.json").write_text(json.dumps({
                "id": "sfx-cache",
                "theme": "x-desktop",
                "output": "out/sfx-cache.mp4",
                "format": {"fps": 30, "duration": 0.1, "size": [64, 36]},
                "toy": "toy.json",
            }))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12, "colors": {"body": "#F4F6FA"}}))
            for idx in (1, 2, 3):
                Image.new("RGB", (64, 36), (30 * idx, 50, 90)).save(fdir / f"build/render/{idx:04d}.png")
            for wav_name in ("score.wav", "score-sfx.wav"):
                with wave.open(str(fdir / "assets/audio" / wav_name), "wb") as wf:
                    wf.setnchannels(2)
                    wf.setsampwidth(2)
                    wf.setframerate(48000)
                    wf.writeframes(b"\x00\x00\x00\x00" * 4800)

            env = {**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}
            r1 = subprocess.run([sys.executable, str(SCRIPTS / "finish.py"), "--sfx-cut", "--workers", "1"], env=env, capture_output=True, text=True, check=True)
            self.assertIn("wrote", r1.stdout)
            sfx_path = fdir / "out/sfx-cache-sfx.mp4"
            self.assertTrue(sfx_path.is_file())
            mtime1 = sfx_path.stat().st_mtime_ns

            # Unchanged second run reports both main and sfx cuts up to date
            r2 = subprocess.run([sys.executable, str(SCRIPTS / "finish.py"), "--sfx-cut", "--workers", "1"], env=env, capture_output=True, text=True, check=True)
            self.assertIn("up to date", r2.stdout)
            self.assertIn("(sound effects only)", r2.stdout)
            self.assertEqual(sfx_path.stat().st_mtime_ns, mtime1)

            # Surgical frame update WITHOUT passing --sfx-cut still refreshes existing -sfx.mp4!
            import time
            time.sleep(0.02)
            Image.new("RGB", (64, 36), (240, 100, 30)).save(fdir / "build/render/0002.png")
            r3 = subprocess.run([sys.executable, str(SCRIPTS / "finish.py"), "--workers", "1"], env=env, capture_output=True, text=True, check=True)
            self.assertIn("wrote", r3.stdout)
            self.assertIn("(sound effects only)", r3.stdout)
            self.assertGreater(sfx_path.stat().st_mtime_ns, mtime1)

    def test_two_column_end_card_defaults_final_to_28s_and_widens_label_pad(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            g_stub = {"advance": 1.0, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            chars = "0123456789.万查看麦麦提@shengtang省算力找测试"
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in chars
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.12,
                "center": [0, 0.06, 0],
                "colors": {"body": "#1E3A8A", "plinth": "#F8FAFC", "plinthTop": "#F59E0B"},
                "joints": {"body": {"p": [0, 0.04, 0]}, "head": {"p": [0, 0.08, 0], "parent": "body"}, "armL": {"p": [0.03, 0.06, 0], "parent": "body"}, "armR": {"p": [-0.03, 0.06, 0], "parent": "body"}, "legL": {"p": [0.015, 0.02, 0], "parent": "body"}, "legR": {"p": [-0.015, 0.02, 0], "parent": "body"}},
                "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.05, 0], "size": [0.05, 0.06, 0.04], "mat": "body"}],
            }))
            widths = {}
            for mode in ("two-column", "sweep"):
                (fdir / "film.json").write_text(json.dumps({
                    "id": "cta-28",
                    "template": "isnail-30",
                    "theme": "x-desktop",
                    "format": {"fps": 30, "bpm": 120, "duration": 30, "size": [1920, 1080]},
                    "toy": "toy.json",
                    "profile": {"name": "麦麦提", "handle": "@shengtang", "bio": ["AI"]},
                    "posts": {"pinned": {"count": "9.4万"}, "retro": {"count": "2.4万"}},
                    "counter": {"value": 9.4, "unit": "万", "label": "查看", "display": "9.4万"},
                    "story": {"exit": "jump", "segments": [{"beat": "phrase", "bars": 12, "text": "测试"}, {"story": [24, "end"]}]},
                    "cta": {
                        "layout": mode,
                        "slogan": [{"text": "省算力"}, {"text": "找麦麦提"}],
                        "name": {"text": "麦麦提"},
                        "handle": {"text": "@shengtang"},
                        "prop": {"kind": "plinth"},
                    },
                }))
                tl_url = (SKILL / "templates/isnail-30/timeline.js").as_uri()
                anim_url = (SKILL / "templates/isnail-30/anim.js").as_uri()
                probe = (
                    f"import * as T from {json.dumps(tl_url)};"
                    f"import * as A from {json.dumps(anim_url)};"
                    "const o1 = A.mascotAt(28.6).o, o2 = A.mascotAt(29.2).o;"
                    "console.log(JSON.stringify({ final: T.EV.final, slo0Ratio: A.LABELS[0].W / A.LABELS[0].em, bodyMoved: Math.hypot(...o1.body.map((v,i)=>v-o2.body[i])) > 1e-4 }));"
                )
                r = subprocess.run(["node", "--input-type=module", "-e", probe], cwd=str(SKILL), env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}, capture_output=True, text=True, check=True)
                data = json.loads(r.stdout.strip().splitlines()[-1])
                self.assertEqual(data["final"], 28.0)
                widths[mode] = data["slo0Ratio"]
                if mode == "two-column":
                    self.assertTrue(data["bodyMoved"])
            self.assertGreater(widths["two-column"], widths["sweep"] + 0.2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
