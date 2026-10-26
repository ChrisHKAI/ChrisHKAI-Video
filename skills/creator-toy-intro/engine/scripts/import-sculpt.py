"""The sculpt kit's last step: brings a sculpted toy (a person, usually) into
the film as toy.json + build/toy/<part>.npz.

A sculpt is a folder a sculpt script wrote (engine/lib/sdf.py does the
shapes and the marching cubes): a manifest JSON and one .npz per part.
  manifest: { units: "m", facing: "-y" (Blender: +z up) | "+z" (+y up),
              height_mm, parts: [{ name, file, bone, material, frame? { c, R } }],
              bones: [{ name, head, tail, parent }], variants? { group: { name: [parts] } } }
  part.npz: verts (m, in the part's frame), faces, normals, color (sRGB 0–1), rough
The bones map onto the story's rig contract (hips/spine → body, head and
brows → head, upper arm/forearm/hand → armR/armL, thigh/foot → legR/legL;
override with --map bone=joint,…). Of swappable variants (mouth shapes, hands)
the first of each group is used. The eyes' painted texture (an eye.png beside
the manifest, mapped over the eye piece's front) is baked into their vertex
colours. Materials become finishes: skin, glass for lenses, gloss for eyes
and frames, vinyl otherwise.

usage: FILM=<film folder> python3 engine/scripts/import-sculpt.py <sculpt folder> [--manifest chris.json] [--map a=b,…]
writes toy.json and build/toy/*.npz in the film
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from film import FILM  # noqa: E402  the film workspace (FILM env var)

argv = sys.argv[1:]
SRC = Path(argv[0]).resolve()
man = SRC / (argv[argv.index("--manifest") + 1] if "--manifest" in argv else next(p.name for p in SRC.glob("*.json")))
M = json.loads(man.read_text())
OUT = FILM / "build/toy"
OUT.mkdir(parents=True, exist_ok=True)

# the rig contract: the story poses body, head, armR/L, legR/L (R = the toy's right = -x)
MAP = {"root": "body", "hips": "body", "spine": "body", "head": "head", "brow.R": "head", "brow.L": "head",
       "upper_arm.R": "armR", "forearm.R": "armR", "hand.R": "armR", "upper_arm.L": "armL", "forearm.L": "armL", "hand.L": "armL",
       "thigh.R": "legR", "foot.R": "legR", "thigh.L": "legL", "foot.L": "legL"}
if "--map" in argv:
    MAP.update(dict(kv.split("=") for kv in argv[argv.index("--map") + 1].split(",")))
# where each joint turns: the first bone that maps onto it
JOINT_BONE = {"body": "hips", "head": "head", "armR": "upper_arm.R", "armL": "upper_arm.L", "legR": "thigh.R", "legL": "thigh.L"}
PARENT = {"body": None, "head": "body", "armR": "body", "armL": "body", "legR": None, "legL": None}
FINISH = {"skin": "skin", "lens": "glass", "eye": "gloss", "frame": "gloss", "teeth": "gloss", "pad": "glass"}

# Blender's axes (+z up, facing -y) → the engine's (+y up, facing +z): (x, y, z) → (x, z, -y)
B2T = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64) if M.get("facing", "-y") == "-y" else np.eye(3)


def lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


bones = {b["name"]: b for b in M["bones"]}
# of each group of variants the first shows; the others' parts stay out
var = M.get("variants", {})
default = {n for g in var.values() for n in next(iter(g.values()))}
hidden = {n for g in var.values() for parts in g.values() for n in parts} - default
eye_png = SRC / "eye.png"
eye = np.asarray(Image.open(eye_png).convert("RGB"), dtype=np.float64) / 255 if eye_png.exists() else None

parts, used = [], set()
for p in M["parts"]:
    if p["name"] in hidden:
        continue
    z = np.load(SRC / p["file"])
    v = z["verts"].astype(np.float64)
    col = z["color"].astype(np.float64)
    if p["material"] == "eye" and eye is not None:
        # the eye texture over the piece's front: u across x (9.2 mm), v up z (10 mm)
        u = np.clip(v[:, 0] / 0.0092 + 0.5, 0, 1)
        w = np.clip(v[:, 2] / 0.0100 + 0.5, 0, 1)
        h, wd = eye.shape[:2]
        col = eye[((1 - w) * (h - 1)).round().astype(int), (u * (wd - 1)).round().astype(int)]
    nrm = z["normals"].astype(np.float64)
    if "frame" in p:
        R, c = np.array(p["frame"]["R"]), np.array(p["frame"]["c"])
        v, nrm = v @ R.T + c, nrm @ R.T
    v, nrm = v @ B2T.T, nrm @ B2T.T
    f = z["faces"].astype(np.int32)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    if (fn * nrm[f[:, 0]]).sum() < 0:  # wind the faces outward
        f = f[:, ::-1].copy()
    np.savez_compressed(OUT / f"{p['name']}.npz", verts=v.astype(np.float32), faces=f, color=lin(np.clip(col, 0, 1)).astype(np.float32), rough=z["rough"].astype(np.float32))
    joint = MAP.get(p["bone"], "body")
    used.add(joint)
    parts.append({"name": p["name"], "shape": "mesh", "file": f"build/toy/{p['name']}.npz", "pos": [0, 0, 0], "mat": "paint", "finish": FINISH.get(p["material"], "vinyl"), "group": joint})
    print(f"{p['name']:12s} {len(v):7d} verts → {joint}", flush=True)

joints = {}
for j in ["body", "head", "armR", "armL", "legR", "legL"]:
    if j in used:
        b = bones.get(JOINT_BONE[j])
        joints[j] = {"p": [round(x, 6) for x in (np.array(b["head"]) @ B2T.T).tolist()] if b else [0, 0, 0], "parent": PARENT[j]}
H = M.get("height_mm", 120) / 1000
# glasses make the signature move a push of their left hinge (the frame's outermost front at +x, mm)
sig = {"move": "wave"}
frame = next((p for p in parts if p["finish"] == "gloss" and "glass" in p["name"]), None)
if frame:
    v = np.load(FILM / frame["file"])["verts"]
    hinge = v[v[:, 0] > v[:, 0].max() - 0.002]
    sig = {"move": "glasses", "at": [round(float(x) * 1000, 1) for x in hinge.mean(0)]}
toy = {"name": M.get("name", SRC.name), "kit": "sculpt", "signature": sig, "height": H, "center": [0, round(0.44 * H, 4), 0], "colors": {}, "finish": {}, "joints": joints, "parts": parts}
(FILM / "toy.json").write_text(json.dumps(toy, ensure_ascii=False, indent=1))
print(f"toy.json: {len(parts)} parts on {', '.join(joints)}; height {H * 1000:.0f} mm")
