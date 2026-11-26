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


class V0814EngineImprovementTests(unittest.TestCase):
    def test_stagekit_antiglare_and_empty_avatar_socket_helpers(self):
        import stagekit
        from PIL import Image

        stark = Image.new("RGBA", (200, 100), (255, 255, 255, 255))
        warm = stagekit.antiglare(stark)
        self.assertEqual(warm.size, (200, 100))
        r, g, b, a = warm.getpixel((100, 50))
        self.assertLessEqual(max(r, g, b), 220)
        self.assertEqual(a, 255)

        card = stagekit.empty_avatar_socket(stark, 50, 40, 18, fill="#171024", outline="#F4B626", outline_w=3)
        self.assertEqual(card.getpixel((50, 40))[:3], (0x17, 0x10, 0x24))
        self.assertEqual(card.getpixel((160, 80))[:3], (255, 255, 255))
        lx, ly, dm = stagekit.card_socket_coords(card, 50, 40, 18, 0.20)
        self.assertAlmostEqual(lx, -0.05, places=6)
        self.assertAlmostEqual(ly, 0.01, places=6)
        self.assertAlmostEqual(dm, 0.036, places=6)

    def test_colors_flags_glaring_white_cards_and_reads_plated_dark_ink_on_plate_color(self):
        import colors
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "assets").mkdir()
            Image.new("RGB", (120, 80), (252, 252, 252)).save(fdir / "assets/white.png")
            (fdir / "film.json").write_text(json.dumps({
                "format": {"fps": 30, "duration": 1, "size": [1920, 1080]},
                "toy": "toy.json",
                "pop": {"confetti": ["#F4B626"]},
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.12,
                "colors": {"body": "#E8D8F8"},
                "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "size": [0.05, 0.06, 0.04], "mat": "body"}],
            }))
            char_geo = {"type": "curve", "rings": [[[0, 0], [0.02, 0], [0.02, 0.03], [0, 0.03]]], "depth": 0.004}
            anim = {
                "fps": 30, "sub": 1, "frames": 6, "samples": 6,
                "objects": [
                    {"name": "camera", "parent": "root", "camera": True, "tr": [0, 0.15, 0.9, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat1_raw_white", "parent": "root", "geo": {"type": "uiBox", "rect": [-100, -60, 200, 120], "thickness": 0.002},
                     "mat": {"type": "ui", "image": "assets/white.png"}, "tr": [-0.15, 0.15, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat1_damped_white", "parent": "root", "geo": {"type": "uiBox", "rect": [-100, -60, 200, 120], "thickness": 0.002},
                     "mat": {"type": "ui", "image": "assets/white.png", "emission": 0.78}, "tr": [0.15, 0.15, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat1_ban_ln_0", "parent": "root", "letter": "梭", "line": "beat1_ban_ln_", "letterIndex": 0, "geo": char_geo,
                     "mat": {"type": "type", "color": "#18120B", "emit": 0, "on": "#F4B626"}, "tr": [0, 0.04, 0.1, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {"camera": [[0, 0, 0.15, 0.9, 0, 0, 0, 1, 1, 1, 1], [5, 0, 0.15, 0.9, 0, 0, 0, 1, 1, 1, 1]]},
                "colors": {},
                "scalars": {"fov": [35.0] * 6},
            }
            (fdir / "build/anim.json").write_text(json.dumps(anim))
            fc = colors.film_colours(fdir)
            by_name = {c["name"]: c for c in fc["cards"]}
            self.assertTrue(by_name["beat1_raw_white"]["glares"])
            self.assertFalse(by_name["beat1_damped_white"]["glares"])
            # Plated dark ink (#18120B on #F4B626) reads at >9:1 with zero false stage-contrast errors!
            self.assertEqual(colors.problems(fc), [])

    def test_diff_anim_ignores_static_tr_on_tracked_objects_and_resolves_film_relative_args(self):
        diff_mod = load_script("diff_anim_v0814", SCRIPTS / "diff-anim.py")
        base_obj = {"name": "beat2_ban", "parent": "root", "geo": {"type": "roundBox", "size": [0.2, 0.04, 0.006]}, "mat": {"type": "paper", "color": "#F4B626"}}
        old = {
            "fps": 30, "sub": 1, "frames": 4, "samples": 4,
            "objects": [{"name": "camera", "parent": "root", "tr": [0, 0, 1, 0, 0, 0, 1, 1, 1, 1]}, {**base_obj, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]}],
            "tracks": {
                "camera": [[0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1], [3, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]],
                "beat2_ban": [[0, 0, 0.1, 0, 0, 0, 0, 1, 1, 1, 1], [3, 0, 0.1, 0, 0, 0, 0, 1, 1, 1, 1]],
            },
            "colors": {}, "scalars": {},
        }
        new = json.loads(json.dumps(old))
        new["objects"][1]["tr"] = [0, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4]
        frames, changed = diff_mod.diff_frames(old, new)
        self.assertEqual(frames, [])
        self.assertEqual(changed, [])

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "build/anim.prev.json").write_text(json.dumps(old))
            (fdir / "build/anim.json").write_text(json.dumps(new))
            r = subprocess.run(
                [sys.executable, str(SCRIPTS / "diff-anim.py"), "build/anim.prev.json", "build/anim.json"],
                cwd=str(ROOT),
                env={**os.environ, "FILM": str(fdir)},
                capture_output=True, text=True, check=True,
            )
            self.assertEqual(r.stdout.strip(), "none")

    def test_run_mjs_aliases_score_and_audio_to_sound(self):
        run_src = (SKILL / "engine/run.mjs").read_text()
        self.assertIn('ALIASES = { score: "sound", audio: "sound" }', run_src)


class V0815EngineImprovementTests(unittest.TestCase):
    def test_timeline_thins_dense_slogan_chimes_only_when_sub_75ms(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "build/glyphs.json").write_text("{}")
            chars = "0123456789.万查看测试夏林果的出海日记@momo_peggyWeb与转行实战喜欢您来找"
            g_stub = {"advance": 1.0, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in set(chars)
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.12,
                "center": [0, 0.06, 0],
                "colors": {"body": "#F8B2CB"},
                "joints": {"body": {"p": [0, 0.04, 0]}, "head": {"p": [0, 0.08, 0], "parent": "body"}},
                "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.05, 0], "size": [0.05, 0.06, 0.04], "mat": "body"}],
            }))
            base_film = {
                "id": "v0815-chimes",
                "template": "isnail-30",
                "theme": "x-desktop",
                "format": {"fps": 30, "bpm": 120, "duration": 30, "size": [1920, 1080]},
                "toy": "toy.json",
                "profile": {"name": "夏林果", "handle": "momo_peggy", "bio": ["Web"]},
                "posts": {"pinned": {"count": "1万", "cover": "assets/p.jpg"}, "retro": {"count": "1万", "cover": "assets/r.jpg"}},
                "counter": {"value": 1, "unit": "万", "label": "查看", "display": "1万"},
                "story": {
                    "exit": "jump",
                    "segments": [{"beat": "phrase", "bars": 12, "text": "测试"}, {"story": [24, "end"]}],
                    "events": {"letters": 24.44, "lettersEnd": 24.90, "final": 28.0},
                },
                "cta": {
                    "layout": "two-column",
                    "slogan": [{"text": "Web出海实战"}, {"text": "喜欢您来找我"}],
                    "name": {"text": "夏林果"},
                    "handle": {"text": "@momo_peggy"},
                    "prop": {"kind": "plinth"},
                },
            }
            (fdir / "film.json").write_text(json.dumps(base_film))
            tl_url = (SKILL / "templates/isnail-30/timeline.js").as_uri()
            probe = f'import * as T from {json.dumps(tl_url)}; console.log(JSON.stringify({{ step: T.LETTER_STEP, cues: T.soundCues().filter((c) => c.kind === "letter") }}));'
            r = subprocess.run(["node", "--input-type=module", "-e", probe], cwd=str(SKILL), env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}, capture_output=True, text=True, check=True)
            fast = json.loads(r.stdout.strip().splitlines()[-1])
            self.assertLess(fast["step"], 0.075)
            # Intermediate chimes thinned (~>= 80 ms apart) while still hitting start & red switch & end
            self.assertLess(len(fast["cues"]), 13)
            self.assertGreaterEqual(len(fast["cues"]), 4)

            # Normal slow step (>= 0.075 s) keeps 1 chime per character untouched (reference films invariant)
            slow_film = json.loads(json.dumps(base_film))
            slow_film["story"]["events"] = {"letters": 24.5, "lettersEnd": 28.0, "final": 28.0}
            (fdir / "film.json").write_text(json.dumps(slow_film))
            r2 = subprocess.run(["node", "--input-type=module", "-e", probe], cwd=str(SKILL), env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)}, capture_output=True, text=True, check=True)
            slow = json.loads(r2.stdout.strip().splitlines()[-1])
            self.assertGreaterEqual(slow["step"], 0.075)
            self.assertEqual(len(slow["cues"]), 13)

    def test_reading_baseline_measures_middle_dot_variants(self):
        from unittest import mock
        from PIL import ImageFont

        font_path = None
        for cand in [
            "/System/Library/Fonts/PingFang.ttc",
            "/System/Library/Fonts/STHeiti Light.ttc",
            "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        ]:
            if Path(cand).exists():
                font_path = cand
                break
        if font_path is None:
            self.skipTest("no CJK system font available for ImageFont.truetype")

        # Verify font can load before running baseline
        ImageFont.truetype(font_path, 40, index=0)
        seen_calls = []

        def fake_read(_r, paths):
            out = {}
            for p in paths:
                key = str(p)
                seen_calls.append(key)
                # First variant (·) returns high conf, middle-dot lookalike (•) simulates 0.30 Vision score
                conf = 0.30 if "_1.png" in key else 0.99
                out[key] = [("喜欢您来•找夏林果" if "_1.png" in key else "喜欢您来 · 找夏林果", conf)]
            return out

        with mock.patch.object(reading, "read", side_effect=fake_read):
            base = reading.baseline(("vision", "fake-bin"), ["喜欢您来 · 找夏林果"], (font_path, 0))
        self.assertGreaterEqual(len(seen_calls), 3)
        self.assertAlmostEqual(base["喜欢您来 · 找夏林果"], 0.30, places=2)

    def test_review_flags_stale_blind_notes_older_than_source(self):
        from PIL import Image

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build/previs").mkdir(parents=True)
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12, "colors": {"body": "#F8B2CB"}, "parts": []}))
            (fdir / "film.json").write_text(json.dumps({
                "id": "rev-stale",
                "template": "isnail-30",
                "theme": "x-desktop",
                "language": "zh-Hans",
                "toy": "toy.json",
                "format": {"fps": 30, "bpm": 120, "duration": 6, "size": [1920, 1080]},
                "profile": {"name": "夏林果", "handle": "momo_peggy"},
                "counter": {"value": 10, "unit": "万", "label": "查看", "display": "10万"},
                "cta": {"slogan": [{"text": "测试"}]},
            }))
            (fdir / "build/timeline.json").write_text(json.dumps({
                "DURATION": 6.0, "FPS": 30, "BPM": 120, "BAR": 2.0,
                "EV": {"cut": 4.0},
                "SEGMENTS": [{"kind": "beat", "beat": "beats/open.js", "f0": 0.0, "f1": 6.0, "why": "intro"}],
                "cues": [{"t": 0.5, "kind": "pop"}],
            }))
            (fdir / "build/anim.json").write_text(json.dumps({
                "fps": 30, "sub": 1, "frames": 180, "samples": 180,
                "objects": [], "tracks": {}, "scalars": {},
            }))
            previs_png = fdir / "build/previs/0001.png"
            Image.new("RGB", (320, 180), (16, 16, 20)).save(previs_png)
            blind_txt = fdir / "build/review-blind.txt"
            blind_txt.write_text("1. 旧版盲测\n2. B\n3. C\n4. D\n5. E\n6. F\n")
            old_t = previs_png.stat().st_mtime - 20.0
            os.utime(blind_txt, (old_t, old_t))

            r_stale = subprocess.run(
                [sys.executable, str(SCRIPTS / "review.py")],
                cwd=str(ROOT),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                capture_output=True, text=True, check=True,
            )
            self.assertIn("older than the picture being reviewed", r_stale.stdout)
            self.assertIn("EARLIER cut before this render", (fdir / "build/review.md").read_text())

            # Fresh review-blind.txt written after source clears the stale warning
            blind_txt.write_text("1. 新版盲测\n2. B\n3. C\n4. D\n5. E\n6. F\n")
            now_t = previs_png.stat().st_mtime + 5.0
            os.utime(blind_txt, (now_t, now_t))
            r_fresh = subprocess.run(
                [sys.executable, str(SCRIPTS / "review.py")],
                cwd=str(ROOT),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                capture_output=True, text=True, check=True,
            )
            self.assertNotIn("older than the picture being reviewed", r_fresh.stdout)
            self.assertNotIn("EARLIER cut before this render", (fdir / "build/review.md").read_text())

    def test_check_flags_missing_act2_pinned_cover_and_crunched_slogan_and_run_has_local_fallback(self):
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            chars = "0123456789.万查看测试夏林果@momo_peggyWeb出海实战"
            g_stub = {"advance": 1.0, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in set(chars)
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.12,
                "center": [0, 0.06, 0],
                "colors": {"body": "#F8B2CB"},
                "joints": {"body": {"p": [0, 0.04, 0]}},
                "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.05, 0], "size": [0.05, 0.06, 0.04], "mat": "body"}],
            }))
            # Plays act 2 with empty pinned.cover + crunched slogan step (< 45 ms)
            (fdir / "film.json").write_text(json.dumps({
                "id": "chk-v0815",
                "template": "isnail-30",
                "theme": "x-desktop",
                "step": "render",
                "format": {"fps": 30, "bpm": 120, "duration": 30, "size": [1920, 1080]},
                "toy": "toy.json",
                "profile": {"name": "夏林果", "handle": "momo_peggy", "bio": ["Web"]},
                "posts": {"pinned": {"count": "1万"}, "retro": {"count": "1万"}},
                "counter": {"value": 1, "unit": "万", "label": "查看", "display": "1万"},
                "story": {
                    "exit": "jump",
                    "segments": [{"story": [0, 12]}, {"story": [24, "end"]}],
                    "events": {"letters": 24.4, "lettersEnd": 24.85, "final": 28.0},
                },
                "cta": {
                    "layout": "two-column",
                    "slogan": [{"text": "Web出海实战", "paper": "cream"}, {"text": "找夏林果", "paper": "red"}],
                    "name": {"text": "夏林果", "paper": "cream"},
                    "handle": {"text": "@momo_peggy", "paper": "blue"},
                    "prop": {"kind": "plinth"},
                },
            }))
            r = subprocess.run(
                ["node", str(SCRIPTS / "check.mjs")],
                cwd=str(ROOT),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                capture_output=True, text=True,
            )
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("film.posts.pinned.cover is empty", r.stdout)
            self.assertIn("too fast to read as typing", r.stdout)

        run_src = (SKILL / "engine/run.mjs").read_text()
        self.assertIn("isRemoteBlenderWrapper(blender)", run_src)
        self.assertIn("falling back to local Blender", run_src)

    def test_v0816_steady_cta_natural_pose_and_smart_resume_invalidation(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "assets").mkdir()
            Image.new("RGB", (64, 64), (40, 50, 70)).save(fdir / "assets/avatar.jpg")
            chars = "0123456789.万查看测试梦老湿DreamAI@jackzhang123vip开源漫剧模板"
            g_stub = {"advance": 0.9, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in set(chars)
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.11,
                "center": [0, 0.05, 0],
                "colors": {"coat": "#1A2234", "skin": "#F5D0B8"},
                "joints": {
                    "body": {"p": [0, 0.03, 0], "parent": None},
                    "head": {"p": [0, 0.055, 0], "parent": "body"},
                    "armR": {"p": [-0.013, 0.05, 0], "parent": "body"},
                    "armL": {"p": [0.013, 0.05, 0], "parent": "body"},
                    "legR": {"p": [-0.008, 0.02, 0], "parent": "body"},
                    "legL": {"p": [0.008, 0.02, 0], "parent": "body"},
                },
                "parts": [
                    {"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.038, 0], "size": [0.03, 0.03, 0.02], "mat": "coat"},
                    {"name": "head", "group": "head", "shape": "ellipsoid", "pos": [0, 0.075, 0], "r": [0.032, 0.03, 0.03], "mat": "skin"},
                    {"name": "sleeveR", "group": "armR", "shape": "roundBox", "pos": [-0.016, 0.04, 0], "size": [0.008, 0.02, 0.008], "mat": "coat"},
                    {"name": "sleeveL", "group": "armL", "shape": "roundBox", "pos": [0.016, 0.04, 0], "size": [0.008, 0.02, 0.008], "mat": "coat"},
                ],
            }))
            (fdir / "film.json").write_text(json.dumps({
                "id": "steady-v0816",
                "template": "isnail-30",
                "theme": "x-desktop",
                "step": "story",
                "format": {"fps": 30, "bpm": 120, "duration": 8, "size": [1920, 1080]},
                "toy": "toy.json",
                "type": {"heavy": [{"family": "Lantinghei SC", "style": "Demibold"}], "why": "test"},
                "profile": {"name": "梦老湿", "handle": "jackzhang123vip", "avatar": "assets/avatar.jpg", "bio": ["AI"]},
                "posts": {"pinned": {"count": "1万", "cover": "assets/avatar.jpg"}, "retro": {"count": "1万"}},
                "counter": {"value": 1, "unit": "万", "label": "查看", "display": "1万"},
                "story": {
                    "duration": 32,
                    "profilePage": False,
                    "exit": "jump",
                    "segments": [{"story": [24, "end"]}],
                    "events": {"ride": 24.28, "push2": [24.34, 24.80], "glide": [24.85, 27.60], "letters": 24.45, "name": 26.55, "final": 27.80},
                },
                "cta": {
                    "layout": "two-column",
                    "slogan": [{"text": "开源漫剧模板", "paper": "cream"}, {"text": "找梦老湿", "paper": "cream"}],
                    "name": {"text": "梦老湿", "paper": "cream"},
                    "handle": {"text": "@jackzhang123vip", "paper": "blue"},
                    "prop": {"kind": "plinth"},
                },
            }))
            anim_url = (SKILL / "templates/isnail-30/anim.js").as_uri()
            probe = (
                f"import * as A from {json.dumps(anim_url)};"
                "const mid = A.mascotAt(26.0).o;"
                "const wav = A.mascotAt(28.2).o;"
                "const end = A.mascotAt(31.8).o;"
                "const hc = A.heroCentre(28.0);"
                "const maxSparkZ = Math.max(...Array.from({ length: A.SPARKS }, (_, i) => A.sparkAt(i, 28.0).tr.p[2]));"
                "console.log(JSON.stringify({ hasPresentAim: Boolean(mid.aimL && mid.aimL.k > 0.9), midArmRZ: mid.armR[2], waveArmRZ: wav.armR[2], endPointR: end.pointR, sparkBehindFace: hc[2] - maxSparkZ }));"
            )
            r_probe = subprocess.run(
                ["node", "--input-type=module", "-e", probe],
                cwd=str(SKILL),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                check=True, capture_output=True, text=True,
            )
            pdata = json.loads(r_probe.stdout.strip().splitlines()[-1])
            self.assertTrue(pdata["hasPresentAim"])
            self.assertGreater(pdata["midArmRZ"], -0.3)  # no stiff -0.5 snail A-pose
            self.assertLess(pdata["waveArmRZ"], -1.3)    # outward greeting wave after E.final
            self.assertGreater(pdata["endPointR"], 0.99) # settled camera point by end frame
            self.assertGreater(pdata["sparkBehindFace"], 0.15)  # all sparks stay >15 cm behind face

            # Verify smart --resume invalidation via .anim-snapshot.json in run.mjs
            rdir = fdir / "build/render"
            rdir.mkdir(parents=True)
            snap_anim = {
                "fps": 30, "sub": 1, "frames": 6, "samples": 6,
                "objects": [
                    {"name": "camera", "parent": "root", "tr": [0, 0, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "box", "parent": "root", "geo": {"type": "box", "size": [0.1, 0.1, 0.1]}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {"box": [[0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], [5, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]]},
                "colors": {},
                "scalars": {"fov": [30] * 6},
            }
            (rdir / ".anim-snapshot.json").write_text(json.dumps(snap_anim))
            for k in range(1, 7):
                p = rdir / f"{k:04d}.png"
                p.write_bytes(b"old")
                os.utime(p, (1000.0, 1000.0))

            # Modify ONLY frames 1-2 (indices 0-1) in new build/anim.json; frames 4-6 stay identical!
            new_anim = json.loads(json.dumps(snap_anim))
            new_anim["tracks"]["box"] = [
                [0, 0.2, 0, 0, 0, 0, 0, 1, 1, 1, 1],
                [1, 0.2, 0, 0, 0, 0, 0, 1, 1, 1, 1],
                [2, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
                [5, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
            ]
            (fdir / "build/anim.json").write_text(json.dumps(new_anim))
            film_j = json.loads((fdir / "film.json").read_text())
            film_j["format"]["duration"] = 0.2  # 6 frames at 30 fps
            (fdir / "film.json").write_text(json.dumps(film_j))

            mock_blender = fdir / "mock-blender.sh"
            mock_blender.write_text("#!/bin/sh\nexit 0\n")
            mock_blender.chmod(0o755)
            r_res = subprocess.run(
                ["node", str(SKILL / "engine/run.mjs"), "render", "--", "--samples", "48", "--scale", "100", "--resume", "--force"],
                cwd=str(ROOT),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL), "BLENDER": str(mock_blender)},
                capture_output=True, text=True,
            )
            self.assertEqual(r_res.returncode, 0, r_res.stdout + r_res.stderr)
            self.assertIn("invalidated", r_res.stdout)
            self.assertFalse((rdir / "0001.png").exists())
            self.assertTrue((rdir / "0006.png").exists())
            self.assertGreater((rdir / "0006.png").stat().st_mtime, 1500.0)

    def test_v0817_synth_drum_arg_safety_and_duplicate_cue_dedup(self):
        sys.path.insert(0, str(SKILL / "engine/lib"))
        import synth
        synth.setup(2.0, 0.5)
        # snare() works with zero args AND with an optional float duration without TypeError
        s0 = synth.snare()
        s1 = synth.snare(0.11)
        self.assertEqual(s0.ndim, 1)
        self.assertEqual(s1.ndim, 1)
        self.assertLess(len(s1), len(s0))
        # kick(0.16) and hat(0.05) treat small float durations safely as normal/closed rather than big=True/open_=True
        k_norm = synth.kick(False)
        k_float = synth.kick(0.16)
        self.assertEqual(len(k_norm), len(k_float))
        h_closed = synth.hat(False)
        h_float = synth.hat(0.05)
        self.assertEqual(len(h_closed), len(h_float))

        # Verify timeline.js deduplicates identical stacked cues (e.g. prop.js + template both adding pomf at E.ride)
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "assets").mkdir()
            (fdir / "recipes").mkdir()
            Image.new("RGB", (64, 64), (40, 50, 70)).save(fdir / "assets/avatar.jpg")
            g_stub = {"advance": 0.9, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in set("0123456789万查看兴雨@YxzRainy关注")
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.11, "center": [0, 0.05, 0], "colors": {"coat": "#1A2234"},
                "joints": {"body": {"p": [0, 0.03, 0], "parent": None}},
                "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.04, 0], "size": [0.03, 0.03, 0.02], "mat": "coat"}],
            }))
            (fdir / "recipes/prop.js").write_text(
                "export function makeProp({ E, cta, lib }) {\n"
                "  return {\n"
                "    declare() {},\n"
                "    sample() {},\n"
                "    topAt: () => cta(-0.3, 0.05, 0),\n"
                "    cues(add) { add(E.ride, 'pomf'); add(E.glint2, 'glint'); },\n"
                "  };\n"
                "}\n"
            )
            (fdir / "film.json").write_text(json.dumps({
                "id": "dedup-v0817", "template": "isnail-30", "theme": "x-desktop", "step": "story",
                "format": {"fps": 30, "bpm": 120, "duration": 6, "size": [1920, 1080]},
                "toy": "toy.json",
                "type": {"heavy": [{"family": "Lantinghei SC", "style": "Demibold"}], "why": "test"},
                "profile": {"name": "兴雨", "handle": "YxzRainy", "avatar": "assets/avatar.jpg", "bio": ["AI"]},
                "posts": {"pinned": {"count": "1万", "cover": "assets/avatar.jpg"}, "retro": {"count": "1万"}},
                "counter": {"value": 1, "unit": "万", "label": "查看", "display": "1万"},
                "story": {"duration": 30, "profilePage": False, "exit": "jump", "segments": [{"story": [24, "end"]}], "events": {"ride": 24.75, "glint2": 25.10}},
                "cta": {
                    "layout": "two-column",
                    "slogan": [{"text": "关注兴雨", "paper": "cream"}, {"text": "关注", "paper": "cream"}],
                    "name": {"text": "兴雨", "paper": "cream"},
                    "handle": {"text": "@YxzRainy", "paper": "blue"},
                    "prop": {"module": "recipes/prop.js"},
                },
            }))
            world_url = (SKILL / "templates/isnail-30/world.js").as_uri()
            r_tl = subprocess.run(
                ["node", "--input-type=module", "-e", f"import * as W from {json.dumps(world_url)}; console.log(JSON.stringify(W.timeline().cues));"],
                cwd=str(SKILL),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                check=True, capture_output=True, text=True,
            )
            cues = json.loads(r_tl.stdout.strip().splitlines()[-1])
            pomf_at_ride = [c for c in cues if c["kind"] == "pomf" and abs(c["t"] - 0.75) < 0.02]
            glint_at_g2 = [c for c in cues if c["kind"] == "glint" and abs(c["t"] - 1.10) < 0.02]
            self.assertEqual(len(pomf_at_ride), 1)
            self.assertEqual(len(glint_at_g2), 1)

    def test_v0818_plaque_helper_border_check_template_glyphs_typesheet_and_hash_diff(self):
        sys.path.insert(0, str(SKILL / "engine/lib"))
        sys.path.insert(0, str(SKILL / "engine/scripts"))
        import stagekit
        import colors
        import glyphs
        from PIL import Image, ImageDraw, ImageFont

        # 1) stagekit.plaque() renders a clean 2x-supersampled plaque with zero double-border / edge crowding,
        #    while colors.plaque_border_issues() catches a cramped 960x128 double-bordered PIL plaque
        f_default = ImageFont.load_default(size=88)
        clean_plaque = stagekit.plaque([
            [("51", f_default, (253, 216, 93), 0), ("Repos", f_default, (248, 250, 252), 12)],
            [("star", 28, (251, 191, 36), 0), ("1,973", f_default, (253, 216, 93), 12), ("Stars", f_default, (248, 250, 252), 12)],
            [("9,165", f_default, (253, 216, 93), 0), ("Followers", f_default, (248, 250, 252), 12)],
        ])
        self.assertGreaterEqual(clean_plaque.width, clean_plaque.height * 3)
        self.assertEqual(colors.plaque_border_issues(clean_plaque, has_frame=True), {"cramped": False, "doubleBorder": False})

        bad_plaque = Image.new("RGB", (960, 128), (20, 30, 48))
        bd = ImageDraw.Draw(bad_plaque)
        bd.rounded_rectangle((6, 6, 953, 121), radius=22, outline=(251, 191, 36), width=6)
        # Simulate text spanning from x=2 to x=958 right into the inner border stroke
        bd.rectangle((2, 46, 958, 82), fill=(255, 248, 235))
        self.assertEqual(colors.plaque_border_issues(bad_plaque, has_frame=True), {"cramped": True, "doubleBorder": True})

        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            # 2) stagekit.save_if_changed() preserves mtime on identical bytes and updates when content changes
            out_png = tdir / "cards/stat.png"
            self.assertTrue(stagekit.save_if_changed(clean_plaque, out_png))
            os.utime(out_png, (1234.0, 1234.0))
            self.assertFalse(stagekit.save_if_changed(clean_plaque, out_png))
            self.assertEqual(out_png.stat().st_mtime, 1234.0)
            self.assertTrue(stagekit.save_if_changed(bad_plaque, out_png))
            self.assertGreater(out_png.stat().st_mtime, 1234.0)

            # 3) glyphs.harvest_js_glyphs() extracts static characters ("万", "亿") inside `${...}` template literals
            bdir = tdir / "beats"
            bdir.mkdir(parents=True)
            (bdir / "custom.js").write_text(
                'export function makeBeat({ glyph, kit }) {\n'
                '  const b = kit.readoutBadge(glyph, { from: 1.2, to: 19.9, fmt: (v) => `${v.toFixed(1)}万`, unit: "亿" });\n'
                '  return { reads: [{ text: `19.9万 阅读` }], storyboard: { part: { label: { en: "skip" } } } };\n'
                '}\n',
                encoding="utf-8",
            )
            harv = glyphs.harvest_js_glyphs(tdir, {"story": {"segments": [{"beat": "beats/custom.js", "bars": 3}]}})
            for ch in ("万", "亿", "阅", "读"):
                self.assertIn(ch, harv["heavy"])
                self.assertIn(ch, harv["cjk"])

            # 4) typesheet.py exits with a clean message (never ValueError: max() arg is an empty sequence) when empty,
            #    and --list harvests characters from story.direction before apply-research populates cta
            fdir = tdir / "empty-film"
            fdir.mkdir()
            (fdir / "film.json").write_text(json.dumps({
                "id": "ts-empty", "template": "isnail-30", "theme": "x-desktop",
                "format": {"fps": 30, "bpm": 120, "duration": 26, "size": [1920, 1080]},
                "toy": "toy.json",
                "story": {"segments": []},
            }))
            r_ts = subprocess.run(
                [sys.executable, str(SKILL / "engine/scripts/typesheet.py"), "--faces", "Helvetica:Regular"],
                env={**os.environ, "FILM": str(fdir)},
                capture_output=True, text=True,
            )
            self.assertNotEqual(r_ts.returncode, 0)
            self.assertIn("no on-screen lines in film.json yet", r_ts.stderr + r_ts.stdout)
            self.assertNotIn("ValueError", r_ts.stderr + r_ts.stdout)

            # 5) diff-anim.py --since ignores mtime-bumped textures whose SHA-256 matches .texture-hashes.json
            import importlib.util
            spec = importlib.util.spec_from_file_location("diff_anim_mod", SKILL / "engine/scripts/diff-anim.py")
            diff_mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(diff_mod)

            ddir = tdir / "diff-film"
            (ddir / "assets").mkdir(parents=True)
            (ddir / "build/cards").mkdir(parents=True)
            (ddir / "build/render").mkdir(parents=True)
            av = ddir / "assets/avatar.png"
            pl = ddir / "build/cards/stat.png"
            av.write_bytes(b"same-avatar-bytes")
            pl.write_bytes(b"old-plaque-bytes")
            snap_file = ddir / "build/render/.anim-snapshot.json"
            anim_doc = {
                "fps": 30, "sub": 1, "frames": 10,
                "objects": [
                    {"name": "camera", "parent": "root", "tr": [0, 0, 1, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat0_avatar", "parent": "root", "geo": {"type": "plane", "w": 0.1, "h": 0.1}, "mat": {"type": "card2d", "image": "assets/avatar.png"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat2_sgh_pic", "parent": "root", "geo": {"type": "uiBox", "rect": [-1, -1, 2, 2]}, "mat": {"type": "ui", "image": "build/cards/stat.png"}, "tr": [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]},
                ],
                "tracks": {"camera": [[0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1], [9, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]]},
                "colors": {},
                "scalars": {"fov": [30] * 10},
            }
            snap_file.write_text(json.dumps(anim_doc))
            os.utime(snap_file, (1500.0, 1500.0))
            import hashlib
            (ddir / "build/render/.texture-hashes.json").write_text(json.dumps({
                "assets/avatar.png": hashlib.sha256(b"same-avatar-bytes").hexdigest(),
                "build/cards/stat.png": hashlib.sha256(b"old-plaque-bytes").hexdigest(),
            }))
            # Bump mtime of BOTH files past 1500.0, but change bytes ONLY on stat.png!
            os.utime(av, (2000.0, 2000.0))
            pl.write_bytes(b"new-upgraded-plaque-bytes")
            os.utime(pl, (2000.0, 2000.0))
            newer = diff_mod.newer_images(anim_doc, ddir, snap_file)
            self.assertEqual(newer, ["build/cards/stat.png"])

    def test_v0819_readout_glyph_harvest_and_pacing_visual_holds(self):
        sys.path.insert(0, str(SKILL / "engine/scripts"))
        import glyphs

        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            # 1) glyphs.harvest_js_glyphs() auto-harvests digits and ",.+%" into heavy, display & latin when readoutBadge / readout is called
            bdir = tdir / "beats"
            bdir.mkdir(parents=True)
            (bdir / "counter_only.js").write_text(
                'export function makeBeat({ glyph, kit }) {\n'
                '  const badge = kit.readoutBadge(glyph, { from: 0, to: 84714, fmt: { sep: true } });\n'
                '  return { storyboard: {} };\n'
                '}\n',
                encoding="utf-8",
            )
            harv = glyphs.harvest_js_glyphs(tdir, {"story": {"segments": [{"beat": "beats/counter_only.js", "bars": 3}]}})
            for ch in "0123456789,.+%":
                self.assertIn(ch, harv["heavy"])
                self.assertIn(ch, harv["latin"])

            # 2) pacing.check()["staticHolds"] warns when a custom showcase beat settles all cards by 1.2 s and holds static
            #    until 8.0 s despite background SFX cues at 3.2 s & 5.4 s, while passing staggered reveals and long quote reads
            fdir = tdir / "hold-film"
            (fdir / "build").mkdir(parents=True)
            (fdir / "film.json").write_text(json.dumps({"format": {"fps": 30, "duration": 8, "size": [1920, 1080]}, "toy": "toy.json"}))
            (fdir / "toy.json").write_text(json.dumps({"height": 0.12}))
            fps, frames = 30, 240
            park = [0, -2, 0, 0, 0, 0, 1, 1e-4, 1e-4, 1e-4]
            show = [0, 0.2, 0, 0, 0, 0, 1, 1, 1, 1]
            # Card pops in at 1.0 s (frame 30) and sits completely unchanged until 8.0 s (frame 239)
            card_static = [[s, *(show if s >= 30 else park)] for s in range(frames)]
            anim_static = {
                "fps": fps, "frames": frames, "sub": 1, "samples": frames,
                "objects": [
                    {"name": "camera", "parent": "root", "tr": [0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1]},
                    {"name": "beat0_c0_pic", "parent": "root", "geo": {"type": "uiBox", "rect": [-100, -60, 200, 120]}, "mat": {"type": "ui"}, "tr": park},
                ],
                "tracks": {
                    "camera": [[0, 0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1], [frames - 1, 0, 0.2, 1.0, 0, 0, 0, 1, 1, 1, 1]],
                    "beat0_c0_pic": card_static,
                },
                "scalars": {"fov": [30.0] * frames},
            }
            (fdir / "build/anim.json").write_text(json.dumps(anim_static))
            (fdir / "build/timeline.json").write_text(json.dumps({
                "DURATION": 8.0, "BAR": 2.0,
                "SEGMENTS": [{"kind": "beat", "f0": 0.0, "f1": 8.0}],
                "cues": [{"t": 1.0, "kind": "pop"}, {"t": 3.2, "kind": "glint"}, {"t": 5.4, "kind": "push"}, {"t": 7.7, "kind": "whooshUp"}],
            }))
            (fdir / "build/reads.json").write_text(json.dumps([{"text": "爆款短片", "at": [1.0, 7.8]}]))
            res_static = pacing.check(fdir)
            self.assertEqual(res_static["dead"], [])  # Masked from `dead` by glint/push SFX cues!
            self.assertEqual(len(res_static["staticHolds"]), 1)
            self.assertGreaterEqual(res_static["staticHolds"][0][1] - res_static["staticHolds"][0][0], 6.0)

            # Stagger a second card reveal at 4.2 s (frame 126) -> zero staticHolds!
            anim_stagger = json.loads(json.dumps(anim_static))
            anim_stagger["objects"].append({"name": "beat0_c1_pic", "parent": "root", "geo": {"type": "uiBox", "rect": [-100, -60, 200, 120]}, "mat": {"type": "ui"}, "tr": park})
            anim_stagger["tracks"]["beat0_c1_pic"] = [[s, *(show if s >= 126 else park)] for s in range(frames)]
            (fdir / "build/anim.json").write_text(json.dumps(anim_stagger))
            self.assertEqual(pacing.check(fdir)["staticHolds"], [])

    def test_v0820_typesheet_facts_fallback_and_glyphs_plus_concat(self):
        sys.path.insert(0, str(SKILL / "engine/scripts"))
        import glyphs

        with tempfile.TemporaryDirectory() as tmp:
            tdir = Path(tmp)
            # 1) glyphs.harvest_js_glyphs() extracts string suffixes concatenated via `+ "..."` inside fmt callbacks
            bdir = tdir / "beats"
            bdir.mkdir(parents=True)
            (bdir / "concat_fmt.js").write_text(
                'export function makeBeat({ glyph, kit }) {\n'
                '  const b1 = kit.readoutBadge(glyph, { from: 0.1, to: 16, fmt: (v) => v.toFixed(1) + "万" });\n'
                '  const b2 = kit.readoutBadge(glyph, { from: 1, to: 124, fmt: (v) => Math.round(v) + \'条\' });\n'
                '  return { storyboard: {} };\n'
                '}\n',
                encoding="utf-8",
            )
            harv = glyphs.harvest_js_glyphs(tdir, {"story": {"segments": [{"beat": "beats/concat_fmt.js", "bars": 3}]}})
            for ch in ("万", "条"):
                self.assertIn(ch, harv["heavy"])
                self.assertIn(ch, harv["cjk"])

            # 2) typesheet.py --list falls back to research/facts.json before apply-research populates film.json story/cta
            fdir = tdir / "pre-apply"
            (fdir / "research").mkdir(parents=True)
            (fdir / "film.json").write_text(json.dumps({
                "id": "pre-apply", "template": "isnail-30", "theme": "x-desktop",
                "format": {"fps": 30, "bpm": 120, "duration": 28, "size": [1920, 1080]},
                "toy": "toy.json",
                "story": {},
            }))
            (fdir / "research/facts.json").write_text(json.dumps({
                "profile": {"name": "司徒K", "handle": "situking"},
                "story": [{"id": "s1", "line": "五道真功夫"}],
                "recommendedDirection": "A",
                "directions": [{
                    "id": "A",
                    "hook": {"text": "拒绝黑帽套路"},
                    "frames": [{"words": ["让品牌进 AI 答案"]}],
                    "cta": {"slogan": ["AI 搜索优化", "找司徒K"]},
                }],
            }), encoding="utf-8")
            r_list = subprocess.run(
                [sys.executable, str(SKILL / "engine/scripts/typesheet.py"), "--list"],
                env={**os.environ, "FILM": str(fdir)},
                capture_output=True, text=True, check=True,
            )
            self.assertNotIn("all 0 characters", r_list.stdout)
            self.assertRegex(r_list.stdout, r"have all [1-9]\d+ characters the film shows")

    def test_v0821_expanded_chord_qualities_compose_voicing_and_check_chord_validation(self):
        sys.path.insert(0, str(SKILL / "engine/lib"))
        import synth
        import compose

        synth.setup(2.0, 0.5)
        pad_chords = synth.Chords({}, "pad")
        bed_chords = synth.Chords({}, "bed")
        for sym in ("Gmaj9", "Cm6", "F#m7b5", "D6/9", "Bbadd9", "E7sus4", "Am11", "C/E", "D5"):
            self.assertEqual(len(pad_chords[sym]), 4, sym)
            self.assertEqual(len(bed_chords[sym]), 4, sym)
            self.assertEqual(len(compose.CHORDS[sym]), 4, sym)

        tl = {
            "BPM": 120, "BEAT": 0.5, "BAR": 2.0,
            "cues": [{"t": 0.5, "kind": "pop"}],
            "SEGMENTS": [{"kind": "beat", "f0": 0.0, "f1": 2.0, "beat": "beats/voyage.js", "music": {"groove": "light", "chords": ["Cm6", "Gmaj9"]}}],
        }
        ctx = compose.context(tl, {}, synth, synth.SR, int(synth.SR * 2.0), 2.0, {"opening": [0, 2]})
        ctx.real = None
        self.assertEqual(len(ctx.chord("Gmaj9")), 4)
        buf = compose.example(ctx)
        self.assertEqual(buf.shape, (int(synth.SR * 2.0), 2))
        self.assertGreater(float(abs(buf).max()), 0.01)

        with tempfile.TemporaryDirectory() as tmp:
            fdir = Path(tmp)
            (fdir / "build").mkdir()
            (fdir / "beats").mkdir()
            g_stub = {"advance": 0.9, "rings": [[[0, 0], [0.5, 0], [0.5, 0.8], [0, 0.8]]]}
            (fdir / "build/glyphs.json").write_text(json.dumps({
                f"{role}:{ch}": g_stub for role in ("cjk", "latin", "heavy", "display") for ch in set("0123456789万阅读想风@xaiwind测试")
            }))
            (fdir / "toy.json").write_text(json.dumps({
                "height": 0.12, "center": [0, 0.06, 0], "colors": {"body": "#2F61EB"},
                "joints": {"body": {"p": [0, 0.04, 0]}},
                "parts": [{"name": "torso", "group": "body", "shape": "roundBox", "pos": [0, 0.05, 0], "size": [0.04, 0.05, 0.03], "mat": "body"}],
            }))
            (fdir / "beats/bad_chord.js").write_text(
                "export function makeBeat({ at, fov, aspect, kit }) {\n"
                "  return {\n"
                "    declare() {}, sample() {}, pose: () => null,\n"
                "    camera: kit.cameraFrom([{ t: 0, target: at(0, 0.1, 0), dist: 0.7, elev: 6, az: 0 }], { fov, aspect }),\n"
                "    cues() {}, reads: [], music: { groove: 'normal', chords: ['Cm6', 'Gmaj9', 'Gbad9'] }, storyboard: {},\n"
                "  };\n"
                "}\n",
                encoding="utf-8",
            )
            (fdir / "film.json").write_text(json.dumps({
                "id": "bad-chord", "template": "isnail-30", "theme": "x-desktop", "step": "story",
                "format": {"fps": 30, "bpm": 120, "duration": 6, "size": [1920, 1080]},
                "toy": "toy.json",
                "profile": {"name": "想风", "handle": "xaiwind", "bio": ["AI"]},
                "posts": {"pinned": {"count": "1万", "cover": "assets/a.jpg"}, "retro": {"count": "1万"}},
                "counter": {"value": 1, "unit": "万", "label": "阅读", "display": "1万"},
                "story": {"profilePage": False, "segments": [{"beat": "beats/bad_chord.js", "bars": 3}]},
                "cta": {"slogan": [{"text": "测试", "paper": "cream"}], "name": {"text": "想风"}, "handle": {"text": "@xaiwind"}, "prop": {"kind": "plinth"}},
            }))
            r_chk = subprocess.run(
                ["node", str(SKILL / "engine/scripts/check.mjs")],
                cwd=str(ROOT),
                env={**os.environ, "FILM": str(fdir), "SKILL": str(SKILL)},
                capture_output=True, text=True,
            )
            self.assertNotEqual(r_chk.returncode, 0)
            self.assertIn('unknown chord "Gbad9"', r_chk.stdout)
            self.assertNotIn("Cm6", r_chk.stdout)
            self.assertNotIn("Gmaj9", r_chk.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
