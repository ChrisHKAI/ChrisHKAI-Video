"""铁柱AGI (X @cgnot996) as a designer vinyl toy, sculpted as signed distance
fields (sdf.py) from his profile picture (assets/avatar.jpg, the 3D cartoon of
him), the lower body from the same cartoon on his article covers: messy black
hair swept up and over to his right, thick black frames, big brown eyes, a
small toothy smile, a grey zip hoodie (open over a white tee, the hood down,
white drawstrings), navy jeans, white sneakers. About three heads tall, 120 mm.
Started from the skill's characters/chris/sculpt.py.

Each part is meshed by marching cubes and painted per vertex, then written to
<out>/parts/<name>.npz in its own frame (metres), with <out>/chris.json listing
the parts, their bones, materials and frames, and <out>/eye.png the painted
eye. engine/scripts/import-sculpt.py brings that into a film. It is the sculpt
kit's worked example: a person, from a chibi character sheet.

Axes (Blender): +z up, he faces -y, +x is his left (L). Modelled in mm.

usage: python3 characters/chris/sculpt.py [--out <folder>] [--h 0.25] [--only head,hair]
       FILM=<film> python3 engine/scripts/import-sculpt.py <folder> --manifest chris.json
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

SKILL = Path.home() / "Developer/ChrisHKAI-Video/skills/creator-toy-intro"
sys.path.insert(0, str(SKILL / "engine/lib"))
from sdf import (Capsule, Ellipsoid, Inter, Offset, Plane, RectRing, RectSlab, RoundBox, RoundCone, Sphere, Squash, Sub,
                 Torus, Union, bezier, mesh, project, rot, tube)

argv = sys.argv[1:]
ROOT = Path(argv[argv.index("--out") + 1]).resolve() if "--out" in argv else Path(__file__).resolve().parents[1] / "build/sculpt"
OUT = ROOT / "parts"
H = float(argv[argv.index("--h") + 1]) if "--h" in argv else 0.25
ONLY = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None

COLORS = {
    "skin": "#FAD8C2",
    "blush": "#F2A08C",
    "mouth": "#7A2630",
    "tongue": "#E07A78",
    "teeth": "#FBFAF6",
    "hair": "#211C1C",
    "hairHi": "#463C3A",
    "fade": "#2C2524",
    "brow": "#191617",
    "black": "#131315",
    "pad": "#C9CDD3",
    "hoodie": "#8C9098",
    "hoodieDark": "#6C7078",
    "hoodieIn": "#5E626A",
    "tee": "#F3F3F0",
    "string": "#EEEEEA",
    "aglet": "#9A9EA6",
    "denim": "#2C3B5E",
    "denimDark": "#222F4C",
    "denimHi": "#3D4E74",
    "white": "#F5F4F0",
    "sole": "#D9D9D5",
    "lace": "#E4E6EA",
    "cup": "#F4F2EE",
    "cupSleeve": "#8A5A3C",
    "lid": "#ECEBE8",
}


def rgb(key):
    h = COLORS[key].lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def mix(a, b, t):
    t = np.clip(t, 0, 1)[:, None]
    return a * (1 - t) + b * t


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ── the head ────────────────────────────────────────────────────────────────
CRAN = Ellipsoid((0, 1.5, 84), (24, 23, 25))
FACE = Union([
    CRAN,
    Ellipsoid((0, -3.0, 69.5), (18.8, 17.2, 14.0)),  # cheeks and jaw
    Ellipsoid((0, -10.8, 60.2), (7.6, 7.4, 5.2)),  # the small chin
    Sphere((-12.8, -9.5, 69.5), 8.8),
    Sphere((12.8, -9.5, 69.5), 8.8),
], k=7)
EARS = [Sub(Ellipsoid((s * 23.6, 3.0, 76.0), (3.0, 6.4, 8.6), rot(rz=-s * 22)),
            Ellipsoid((s * 25.6, 2.4, 75.6), (1.7, 3.8, 5.6), rot(rz=-s * 22)), k=0.8) for s in (-1, 1)]
NECK = Capsule((0, 3, 49), (0, 2.5, 62), 7.6)


def surface_y(node, x, z):
    """The front surface's y at (x, z), found from in front."""
    x, z = np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float))
    o = np.column_stack([x, np.full_like(x, -45.0), z])
    return project(node, o, (0, 1, 0), far=45)[:, 1]


NOSE = Ellipsoid((0, surface_y(FACE, 0, 73.2)[0] - 1.1, 73.2), (3.3, 2.9, 3.1))
SKULL = Union([FACE, Union([NOSE], 0), *EARS, NECK], k=2.2)

# ── mouths: the head is built once per mouth, swapped for expressions ───────
MZ = 64.8
MY = surface_y(SKULL, 0, MZ)[0]  # the face's front at the mouth
_PB = lambda z0, z1: ((-14, MY - 3, z0), (14, MY + 14, z1))  # a box round the mouth for planes
MOUTHS = {
    # the grin: flat on top, round below, the top teeth showing
    "grin": Sub(Ellipsoid((0, MY + 3.0, MZ + 0.4), (7.0, 4.6, 3.0)), Sphere((0, MY + 3.0, MZ + 0.4 + 30), 30.0), k=0.5),
    # effort: a wide flat slot, the teeth clenched
    "grit": Sub(Ellipsoid((0, MY + 3.0, MZ + 0.2), (9.0, 5.0, 3.0)), Sphere((0, MY + 3.0, MZ + 1.9 + 30), 30.0), k=0.4),
    # surprise: small and round
    "oh": Ellipsoid((0, MY + 2.8, MZ - 0.4), (3.4, 4.4, 3.8)),
}
TEETH = {
    "grin": Inter(Ellipsoid((0, MY + 4.5, MZ + 0.4), (6.6, 4.0, 3.3)), Plane((0, 0, MZ - 1.1), (0, 0, -1), *_PB(MZ - 4, MZ + 6)), k=0.3),
    "grit": Union([
        Inter(Ellipsoid((0, MY + 4.4, MZ + 0.2), (8.6, 4.2, 3.4)), Plane((0, 0, MZ + 0.35), (0, 0, -1), *_PB(MZ - 2, MZ + 6)), k=0.3),
        Inter(Ellipsoid((0, MY + 4.4, MZ + 0.2), (8.6, 4.2, 3.4)), Plane((0, 0, MZ - 0.05), (0, 0, 1), *_PB(MZ - 6, MZ + 2)), k=0.3),
    ]),
}
TONGUES = {
    "grin": Ellipsoid((0, MY + 4.9, MZ - 2.2), (3.9, 3.0, 1.1)),
    "oh": Ellipsoid((0, MY + 4.4, MZ - 3.3), (2.6, 3.0, 1.2)),
}

EYE_R = (4.5, 2.3, 4.7)
EYES = []
for s in (-1, 1):
    x, z = s * 10.6, 77.6
    y = surface_y(SKULL, x, z)[0]
    EYES.append({"c": np.array([x, y + 1.1, z]), "R": rot(rz=s * 17)})
SOCKETS = [Ellipsoid(e["c"] + e["R"] @ np.array([0, -0.7, 0]), (EYE_R[0] + 0.45, EYE_R[1] + 0.6, EYE_R[2] + 0.45), e["R"]) for e in EYES]


def head(mouth):
    return Sub(Sub(SKULL, MOUTHS[mouth], k=0.7), Union(SOCKETS), k=0.5)


def paint_head(mouth):
    def paint(v, n):
        col = np.tile(rgb("skin"), (len(v), 1))
        # blush on the cheeks
        for s in (-1, 1):
            d = np.linalg.norm((v - [s * 13.8, -17.5, 68.5]) / [6.5, 9, 4.2], axis=1)
            col = mix(col, rgb("blush"), 0.6 * (1 - smooth(0.3, 1.0, d)))
        # the undercut: short hair from above the ears round the back to the nape
        back = smooth(-4, 14, v[:, 1])
        z0 = 81.5 - 15.5 * back  # the fade's lower edge: above the ears, down to the nape at the back
        side = np.maximum(smooth(-15, -9, v[:, 1]), smooth(17.5, 20.0, np.abs(v[:, 0])))  # not on the face: the temples and back
        ear = np.zeros(len(v))
        for s in (-1, 1):
            ear = np.maximum(ear, 1 - smooth(0.15, 0.7, EARS[(s + 1) // 2](v)))  # the ear itself, not the skull behind it
        fade = smooth(z0, z0 + 4.0, v[:, 2]) * side * (1 - ear)
        col = mix(col, rgb("fade"), 0.96 * fade)
        # the mouth's inside
        inside = MOUTHS[mouth](v) < 0.2
        col[inside] = rgb("mouth")
        return col, np.where(inside, 0.5, 0.42)
    return paint


# ── eyes shut: a lid over the socket and a stroke ───────────────────────────
def lid(i):
    e = EYES[i]
    return Ellipsoid(e["c"] + e["R"] @ np.array([0, 1.0, 0]), (EYE_R[0] + 0.45, EYE_R[1], EYE_R[2] + 0.45), e["R"])


def lash(i, shape):
    """A dark stroke over the shut lid: "happy" (an arch) or "squint" (> or <, pointing at the nose)."""
    e, s = EYES[i], (-1, 1)[i]
    if shape == "happy":
        xs = np.linspace(-3.9, 3.9, 9)
        zs = -0.9 + 2.6 * (1 - (xs / 3.9) ** 2)
    else:
        xs = np.array([s * 3.6, -s * 3.2, s * 3.6])
        zs = np.array([2.3, 0.0, -2.3])
    L = lid(i)
    pts = []
    for x, z in zip(xs, zs):
        o = e["c"] + e["R"] @ np.array([x, -12.0, z])
        pts.append(project(L, o, e["R"] @ np.array([0, 1.0, 0]), far=14)[0] - e["R"] @ np.array([0, 0.25, 0]))
    r = 0.62 if shape == "happy" else 0.7
    return tube(pts, [r * 0.7] + [r] * (len(pts) - 2) + [r * 0.7], k=0.3)


def brow(s):
    xs = s * np.array([3.6, 7.6, 11.6, 15.2])
    zs = np.array([85.4, 86.7, 86.8, 85.8])
    ys = surface_y(SKULL, xs, zs) - 0.2
    return tube(np.column_stack([xs, ys, zs]), [1.7, 2.05, 1.95, 1.3], k=0.6)


# ── the glasses ─────────────────────────────────────────────────────────────
RIM = {"x": 10.6, "hx": 8.4, "hy": 5.5, "rc": 2.6, "y": -24.4, "z": 77.6, "w": 0.85, "t": 0.85}


def glasses():
    parts = []
    for s in (-1, 1):
        R = rot(rx=90, rz=s * 10)  # the ring's local z points along -y (the face), turned out at the sides
        c = np.array([s * RIM["x"], RIM["y"], RIM["z"]])
        parts.append(RectRing(c, RIM["hx"], RIM["hy"], RIM["rc"], RIM["w"], RIM["t"], 0.45, R))
        # the temple: from the outer edge back over the ear
        o = c + R @ np.array([s * (RIM["hx"] - 0.2), 3.0, 0])
        pts = [o]
        for y, z in ((-14, 80.6), (-4, 80.8), (4.5, 80.2)):
            x = project(SKULL, (s * 40, y, z), (-s, 0, 0), far=40)[0, 0] + s * 0.7
            pts.append(np.array([x, y, z]))
        pts.append(np.array([s * 22.4, 8.5, 75.5]))
        parts.append(tube(pts, [0.8, 0.65, 0.6, 0.55, 0.5], k=0.4))
    # the bridge, arched over the nose
    xi = RIM["x"] - RIM["hx"] + 0.4
    br = bezier(np.array([-xi, RIM["y"], 79.6]), np.array([0, RIM["y"] - 0.4, 81.0]), np.array([xi, RIM["y"], 79.6]), 5)
    parts.append(tube(br, [0.75] * 5, k=0.3))
    return Union(parts, k=0.4)


def lenses():
    return Union([RectSlab(np.array([s * RIM["x"], RIM["y"], RIM["z"]]), RIM["hx"] - 0.6, RIM["hy"] - 0.6, RIM["rc"] - 0.6, 0.15,
                           rot(rx=90, rz=s * 10)) for s in (-1, 1)])


def pads():
    ny = surface_y(SKULL, 2.9, 75.2)[0]
    return Union([Ellipsoid((s * 2.9, ny - 0.8, 75.2), (0.7, 0.45, 1.2), rot(rz=s * 25)) for s in (-1, 1)]
                 + [Capsule((s * 2.6, RIM["y"] + 0.2, 79.0), (s * 2.9, ny - 1.0, 75.6), 0.25) for s in (-1, 1)], k=0.2)


# ── the hair ────────────────────────────────────────────────────────────────
# a big messy mass swept up and over to his right, falling forward at the
# front; his far left lies down towards the ear; behind the crown it all
# flows down the back. Under the mass, a short undercut (painted on the head).
CAP_C, CAP_R = np.array([-0.8, 3.0, 92.0]), np.array([29.2, 28.6, 27.2])
WHORL = np.array([0.12, 0.35, 0.93]) / np.linalg.norm([0.12, 0.35, 0.93])


def hair_region():
    tilt = np.array([0.2, 0, -1.0])  # the edge: z = 93.5 + 0.2 x (higher on his left, over the undercut)
    front = Inter(Plane((0, 0, 93.5), tilt, (-45, -45, 85), (45, 45, 130)),
                  Plane((0, -19.0, 99.0), (0, -0.55, -0.83), (-45, -45, 85), (45, 45, 130)), k=3)
    back = Inter(Plane((0, 6.0, 0), (0, -1, 0), (-45, 3.0, 60), (45, 45, 130)),
                 Plane((0, 0, 77.0), (0, 0, -1), (-45, -45, 74.0), (45, 45, 130)), k=4)
    return Union([front, back], k=7)


def hair():
    rng = np.random.default_rng(5)
    region = hair_region()
    mass = Inter(Ellipsoid(CAP_C, CAP_R), region, k=1.6)
    tufts = []

    def tuft(p, nrm, d, flow, L, r0, lift):
        flow = flow - nrm * (flow @ nrm)
        flow /= np.linalg.norm(flow) + 1e-6
        p0 = p - nrm * 1.8
        p1 = p + flow * L * 0.5 + nrm * r0 * 0.3
        p2 = p + flow * L + nrm * L * lift + rng.normal(0, 0.4, 3)
        t = np.linspace(0, 1, 7)
        clump = tube(bezier(p0, p1, p2, 7), r0 * (1 - 0.62 * t ** 1.3), k=0.6)
        tufts.append(Squash(clump, p, nrm, 0.5))

    def flow_at(p, d):
        behind = smooth(5, 15, p[1])
        front = smooth(-0.3, -0.75, d[1])
        big = np.array([-1.0, -0.15, -0.2]) + np.array([-0.5, -0.35, 0.55]) * front
        small = np.array([1.0, 0.2, -0.9])
        w = smooth(13.0, 21.0, p[0])  # his far left lies down towards the ear
        f = big * (1 - w) + small * w
        away = d - WHORL * (d @ WHORL)
        away /= np.linalg.norm(away) + 1e-6
        return f * (1 - behind) + away * 1.4 * behind, w, front, behind

    def root(d):
        p = CAP_C + CAP_R * d
        nrm = d / CAP_R
        return p, nrm / np.linalg.norm(nrm)

    n_pts = 105
    for i in range(n_pts):
        zc = 1 - 2 * (i + 0.5) / n_pts
        a = i * np.pi * (3 - np.sqrt(5)) + rng.uniform(-0.15, 0.15)
        d = np.array([np.sqrt(1 - zc * zc) * np.cos(a), np.sqrt(1 - zc * zc) * np.sin(a), zc])
        p, nrm = root(d)
        if region(p[None])[0] > -2.5:
            continue
        flow, w, front, behind = flow_at(p, d)
        top = smooth(0.55, 0.9, d[2]) * (1 - w) * (1 - behind)
        L = rng.uniform(8.5, 12) + 2.5 * front * (1 - w) - 3.5 * w
        r0 = rng.uniform(4.6, 5.6) - 0.7 * w
        lift = rng.uniform(0.04, 0.12) + 0.22 * top + 0.2 * front * (1 - w) - 0.06 * w
        tuft(p, nrm, d, flow, L, r0, lift)
    return Union([mass, Union(tufts, k=1.4)], k=1.8)


def paint_hair(v, n):
    up = smooth(-0.1, 0.9, n[:, 2])
    out = smooth(0.0, 0.8, np.linalg.norm((v - CAP_C) / CAP_R, axis=1) - 1.0) * 0.5
    col = mix(rgb("hair"), rgb("hairHi"), 0.5 * up + out * 0.6)
    return col, np.full(len(v), 0.58)


# ── the body: a grey zip hoodie open over a white tee, the hood down ───────
HOODIE = Union([
    Ellipsoid((0, 0.8, 47.0), (14.6, 11.2, 10.8)),
    RoundBox((0, 0.5, 36.4), (14.2, 11.2, 9.8), 6.4),
    RoundBox((0, 0.4, 28.2), (14.6, 11.4, 2.7), 2.5),  # the ribbed hem, over the top of the jeans
    Sphere((-12.4, 0.8, 50.0), 6.2),
    Sphere((12.4, 0.8, 50.0), 6.2),
], k=4)
HOODIE = Sub(HOODIE, Capsule((0, 1.2, 52.5), (0, 1.6, 64), 6.9), k=1.0)
# the hood lying round the back of the neck (lower at the back), open at the front
HOOD = Union([
    Inter(Torus((0, 3.4, 54.2), 9.4, 3.3, rot(rx=-20)), Plane((0, -3.0, 0), (0, -1, 0), (-20, -3.0, 40), (20, 20, 70)), k=1.5),
    Ellipsoid((0, 10.2, 51.5), (8.6, 3.6, 6.4)),
], k=2.0)
TORSO = Union([HOODIE, HOOD], k=1.2)


def opening(z):
    """Half the width of the open front at height z: narrow at the hem, wide at the neck."""
    return 2.2 + 2.9 * smooth(38.0, 54.0, z)


def torso():
    return TORSO


def paint_torso(v, n):
    col = np.tile(rgb("hoodie"), (len(v), 1))
    z, ax = v[:, 2], np.abs(v[:, 0])
    front = (v[:, 1] < -4.0) & (z > 30.4) & (z < 56.0)
    w = opening(z)
    col[front & (ax < w)] = rgb("tee")
    tape = front & (ax >= w) & (ax < w + 1.0)
    col[tape] = rgb("hoodieDark")
    # the ribbed hem: darker, with ribs
    hem = 1 - smooth(30.0, 30.8, z)
    rib = 0.5 + 0.5 * np.sin(np.arctan2(v[:, 1], v[:, 0]) * 60)
    col = mix(col, rgb("hoodieDark"), hem * (0.55 + 0.25 * rib))
    # the hood's inside and its shadowed back
    hood = smooth(49.0, 53.0, z) * smooth(2.0, 6.0, v[:, 1])
    col = mix(col, rgb("hoodieIn"), 0.35 * hood)
    return col, np.full(len(v), 0.6)


def zip_edges():
    """The zip's two edges down the open front, raised a little."""
    parts = []
    for s in (-1, 1):
        zs = np.linspace(30.6, 53.0, 9)
        xs = s * (opening(zs) + 0.5)
        ys = surface_y(HOODIE, xs, zs) + 0.15
        parts.append(tube(np.column_stack([xs, ys, zs]), [0.55] * len(zs), k=0.3))
    return Union(parts)


STRING_TOP = 53.2


def strings():
    """The hood's white drawstrings hanging down the chest, metal tips."""
    parts = []
    for s in (-1, 1):
        zs = np.array([STRING_TOP, 49.0, 45.0, 41.4])
        xs = s * np.array([4.6, 4.9, 5.1, 5.2])
        ys = surface_y(HOODIE, xs, zs) - 0.7
        parts.append(tube(np.column_stack([xs, ys, zs]), [0.62, 0.6, 0.58, 0.58], k=0.3))
        parts.append(Capsule((xs[-1], ys[-1], zs[-1] + 0.2), (xs[-1], ys[-1] - 0.1, zs[-1] - 2.4), 0.78))
    return Union(parts, k=0.2)


def paint_strings(v, n):
    tip = 1 - smooth(41.0, 41.6, v[:, 2])
    col = mix(np.tile(rgb("string"), (len(v), 1)), rgb("aglet"), tip)
    return col, np.where(tip > 0.5, 0.25, 0.55)


def hips():
    return RoundBox((0, 0.5, 26.4), (13.2, 9.8, 4.0), 3.6)


LEG = {"hip": 7.0, "cuff": 9.4, "shoe": 10.2}


def leg(s):
    x0, x1 = s * LEG["hip"], s * LEG["cuff"]
    shaft = RoundCone((x0, 0.6, 26.0), (x1, 0.2, 11.0), 6.3, 5.9)
    hem = Capsule((x1, 0.2, 9.6), (x1, 0.2, 11.4), 6.05)
    return Union([shaft, hem], k=1.2)


def paint_leg(v, n, s):
    col = np.tile(rgb("denim"), (len(v), 1))
    # a lighter wear on the front of the thigh, the hem a little darker
    wear = smooth(-2.0, -5.5, v[:, 1]) * (1 - np.abs(np.clip((v[:, 2] - 19.0) / 6.0, -1, 1)))
    col = mix(col, rgb("denimHi"), 0.45 * wear)
    hem = 1 - smooth(11.6, 12.4, v[:, 2])
    col = mix(col, rgb("denimDark"), 0.5 * hem)
    return col, np.full(len(v), 0.68)


def shoe(s):
    x = s * LEG["shoe"]
    sole = RoundBox((x, -2.2, 1.7), (8.3, 14.2, 1.7), 1.5)
    upper = Union([Ellipsoid((x, -8.4, 4.2), (7.8, 7.6, 4.2)), Ellipsoid((x, 3.4, 5.6), (7.6, 9.0, 5.6))], k=4)
    upper = Inter(upper, Plane((0, 0, 1.6), (0, 0, -1), (x - 12, -20, 1.0), (x + 12, 16, 16)), k=0.4)
    return Union([sole, upper], k=0.6)


def paint_shoe(v, n, s):
    sole = 1 - smooth(3.2, 3.8, v[:, 2])
    col = mix(np.tile(rgb("white"), (len(v), 1)), rgb("sole"), sole)
    return col, np.where(sole > 0.5, 0.55, 0.36)


def laces(s):
    x = s * LEG["shoe"]
    bars = []
    for y in (-6.8, -4.2, -1.6):
        z = project(shoe(s), (x, y, 20), (0, 0, -1), far=20)[0, 2]
        bars.append(RoundBox((x, y, z + 0.1), (3.0, 0.75, 0.55), 0.45))
    return Union(bars)


def heel_tab(s):
    return RoundBox((s * LEG["shoe"], 12.0, 6.6), (2.6, 1.1, 3.0), 0.9)


ARM = {"shoulder": (13.4, 0.8, 50.0), "sleeve": (18.6, 0.6, 43.0), "elbow": (20.2, 0.5, 39.2), "wrist": (23.0, 0.2, 30.8)}


def P3(key, s):
    x, y, z = ARM[key]
    return np.array([s * x, y, z])


def sleeve(s):
    """The sleeve's top at the shoulder, a little fuller than the arm under it."""
    a, b = P3("shoulder", s) + [s * 0.2, 0, 0], P3("sleeve", s)
    return RoundCone(a, b, 6.0, 5.0)


def upper_arm(s):
    return RoundCone((s * 16.8, 0.6, 46.5), P3("elbow", s), 4.7, 4.4)


def forearm(s):
    return Union([RoundCone(P3("elbow", s), P3("wrist", s), 4.4, 4.0),
                  # the ribbed cuff, a touch tighter
                  RoundCone(P3("wrist", s) + (P3("elbow", s) - P3("wrist", s)) * 0.22, P3("wrist", s), 4.1, 3.9)], k=0.6)


def paint_forearm(v, n, s):
    W, E = P3("wrist", s), P3("elbow", s)
    u = (W - E) / np.linalg.norm(W - E)
    t = (v - E) @ u / np.linalg.norm(W - E)
    cuff = smooth(0.74, 0.8, t)
    rib = 0.5 + 0.5 * np.sin(np.arctan2(v[:, 1] - W[1], v[:, 0] - W[0]) * 40)
    col = mix(np.tile(rgb("hoodie"), (len(v), 1)), rgb("hoodieDark"), cuff * (0.5 + 0.25 * rib))
    return col, np.full(len(v), 0.6)


def hand_frame(s):
    """The hand's frame at the wrist: u down the hand, v to the thumb, w into the palm."""
    W, E = P3("wrist", s), P3("elbow", s)
    u = (W - E) / np.linalg.norm(W - E)
    w = np.array([-s, 0.0, 0.0]) - u * (-s * u[0])
    w /= np.linalg.norm(w)
    v = np.cross(w, u) * s
    v = v if v[1] < 0 else -v  # the thumb to the front
    return W, np.column_stack([u, v, w])


ROPE_R = 1.1  # the rope a gripping hand closes round (mm)
GRIP_C = np.array([7.0, 0.0, 2.9])  # the rope's axis through the fist (hand frame), along v


def hand(s, kind):
    W, R = hand_frame(s)
    at = lambda q: W + R @ np.asarray(q, float)
    palm = Ellipsoid(at((3.8, 0, 0.3)), (5.0, 4.6, 3.0), R)
    vs = (2.9, 1.0, -0.9, -2.7)  # index to little finger
    if kind == "relaxed":
        fingers = [RoundCone(at((7.2, v, 0.3)), at((10.3, v - 0.2, 1.9)), 1.35, 1.15) for v in vs]
        thumb = RoundCone(at((2.6, 3.4, 1.0)), at((5.6, 4.7, 2.5)), 1.65, 1.3)
    elif kind == "open":
        fingers = [RoundCone(at((7.2, v, 0.2)), at((11.6, v * 1.3, -0.3)), 1.35, 1.1) for v in vs]
        thumb = RoundCone(at((2.6, 3.4, 0.8)), at((5.2, 6.8, 0.4)), 1.65, 1.3)
    else:
        # a fist: each finger an arc round an axis along v
        def curl(v, c, rad, a0, a1, r0=1.35, r1=1.2):
            a = np.radians(np.linspace(a0, a1, 7))
            pts = [at((c[0] + rad * np.cos(t), v, c[2] + rad * np.sin(t))) for t in a]
            return tube(pts, np.linspace(r0, r1, 7), k=0.3)
        if kind == "grip":
            fingers = [curl(v, GRIP_C, ROPE_R + 1.3, -105, 150) for v in vs]
            thumb = tube([at((2.8, 3.6, 1.2)), at((5.4, 3.6, 4.4)), at((7.8, 2.4, 5.0))], [1.65, 1.45, 1.25], k=0.4)
        else:  # point: the index finger out straight, the rest curled tight
            c = np.array([6.4, 0.0, 1.9])
            fingers = [RoundCone(at((7.2, 2.9, 0.3)), at((12.4, 2.9, 0.6)), 1.35, 1.1)]
            fingers += [curl(v, c, 1.6, -100, 170, 1.35, 1.25) for v in vs[1:]]
            thumb = tube([at((2.8, 3.6, 1.2)), at((5.0, 3.2, 3.8)), at((6.8, 1.0, 4.0))], [1.65, 1.45, 1.25], k=0.4)
    return Union([palm, Union(fingers, k=0.5), thumb], k=0.9)


# the coffee was tried and dropped by the user ("唔要咖啡了"): COFFEE turns it back on
COFFEE = False

# the takeaway cup, upright at his right side, the hand round it from the outside:
# the palm on the cup's outer side, four fingers wrapped round its front, the thumb behind
CUP = {"c": np.array([-21.8, -1.2, 0.0]), "top": 25.6, "bottom": 12.0, "rt": 4.4, "rb": 3.5}


def cup_r(z):
    return CUP["rb"] + (CUP["rt"] - CUP["rb"]) * (z - CUP["bottom"]) / (CUP["top"] - CUP["bottom"])


def cup():
    cx, cy = CUP["c"][:2]
    t, b = CUP["top"], CUP["bottom"]
    body = RoundCone((cx, cy, b - 3.0), (cx, cy, t + 3.0), cup_r(b - 3.0), cup_r(t + 3.0))
    body = Inter(body, Plane((0, 0, t), (0, 0, 1), (cx - 9, cy - 9, b - 4), (cx + 9, cy + 9, t + 4)), k=0.5)
    body = Inter(body, Plane((0, 0, b), (0, 0, -1), (cx - 9, cy - 9, b - 4), (cx + 9, cy + 9, t + 4)), k=0.8)
    lid = Union([
        RoundBox((cx, cy, t + 0.5), (0.1, 0.1, 0.45), 0.0) if False else Capsule((cx, cy, t + 0.3), (cx, cy, t + 0.7), CUP["rt"] + 0.35),
        Capsule((cx, cy, t + 0.9), (cx, cy, t + 1.6), CUP["rt"] - 0.7),
        Capsule((cx, cy - 2.2, t + 1.9), (cx, cy - 2.2, t + 2.2), 0.8),  # the sip hole's spout
    ], k=0.5)
    return Union([body, lid], k=0.3)


def paint_cup(v, n):
    z = v[:, 2]
    sleeve = smooth(19.4, 19.7, z) * (1 - smooth(23.6, 23.9, z))
    lid = smooth(CUP["top"] - 0.1, CUP["top"] + 0.3, z)
    col = mix(np.tile(rgb("cup"), (len(v), 1)), rgb("cupSleeve"), sleeve)
    col = mix(col, rgb("lid"), lid)
    return col, np.where(sleeve > 0.5, 0.6, 0.35)


def cup_hand():
    cx, cy = CUP["c"][:2]
    W = P3("wrist", -1)
    palm_c = np.array([cx - cup_r(18.5) - 1.6, cy + 0.2, 19.0])
    palm = Ellipsoid(palm_c, (2.6, 4.2, 4.6))
    wrist = Capsule(W, palm_c + [0.3, 0, 2.6], 3.2)
    fingers = []
    for z, a1 in ((18.7, 300), (17.0, 310), (15.3, 305), (13.7, 290)):
        r = cup_r(z) + 0.85
        ang = np.radians(np.linspace(185, a1, 8))
        pts = [np.array([cx + r * np.cos(q), cy + r * np.sin(q), z]) for q in ang]
        fingers.append(tube(pts, np.linspace(1.3, 1.1, 8), k=0.3))
    r = cup_r(20.6) + 0.9
    ang = np.radians(np.linspace(175, 120, 6))
    thumb = tube([np.array([cx + r * np.cos(q), cy + r * np.sin(q), 20.6]) for q in ang], np.linspace(1.6, 1.3, 6), k=0.3)
    return Union([palm, wrist, Union(fingers, k=0.5), thumb], k=0.9)


# ── parts, bones ────────────────────────────────────────────────────────────
def uniform(key, rough):
    return lambda v, n: (np.tile(rgb(key), (len(v), 1)), np.full(len(v), rough))


def side(s):
    return "L" if s > 0 else "R"


PARTS = [
    # name, sdf, bone, material, paint, voxel scale, frame (c, R) or None
    ("head", lambda: head("grin"), "head", "skin", paint_head("grin"), 1.0, None),
    ("head_grit", lambda: head("grit"), "head", "skin", paint_head("grit"), 1.0, None),
    ("head_oh", lambda: head("oh"), "head", "skin", paint_head("oh"), 1.0, None),
    ("hair", hair, "head", "hair", paint_hair, 1.0, None),
    ("teeth", lambda: TEETH["grin"], "head", "teeth", uniform("teeth", 0.25), 0.5, None),
    ("teeth_grit", lambda: TEETH["grit"], "head", "teeth", uniform("teeth", 0.25), 0.5, None),
    ("tongue", lambda: TONGUES["grin"], "head", "tongue", uniform("tongue", 0.35), 0.6, None),
    ("tongue_oh", lambda: TONGUES["oh"], "head", "tongue", uniform("tongue", 0.35), 0.6, None),
    ("glasses", glasses, "head", "frame", uniform("black", 0.18), 0.5, None),
    ("lenses", lenses, "head", "lens", uniform("white", 0.0), 0.6, None),
    ("pads", pads, "head", "pad", uniform("pad", 0.3), 0.4, None),
    ("torso", torso, "spine", "shirt", paint_torso, 1.0, None),
    ("zip", zip_edges, "spine", "shirt", uniform("hoodieDark", 0.5), 0.5, None),
    ("strings", strings, "spine", "shirt", paint_strings, 0.4, None),
    ("hips", hips, "hips", "pants", uniform("denim", 0.68), 1.2, None),
]
for i, s in enumerate((-1, 1)):
    S = side(s)
    PARTS += [
        (f"brow{S}", lambda s=s: brow(s), f"brow.{S}", "hair", uniform("brow", 0.45), 0.5, None),
        (f"eye{S}", lambda i=i: Ellipsoid(EYES[i]["c"], EYE_R, EYES[i]["R"]), "head", "eye", uniform("white", 0.1), 0.4, EYES[i]),
        (f"lid{S}", lambda i=i: lid(i), "head", "skin", uniform("skin", 0.42), 0.5, None),
        (f"lash{S}_happy", lambda i=i: lash(i, "happy"), "head", "hair", uniform("brow", 0.4), 0.4, None),
        (f"lash{S}_squint", lambda i=i: lash(i, "squint"), "head", "hair", uniform("brow", 0.4), 0.4, None),
        (f"leg{S}", lambda s=s: leg(s), f"thigh.{S}", "pants", lambda v, n, s=s: paint_leg(v, n, s), 1.0, None),
        (f"shoe{S}", lambda s=s: shoe(s), f"foot.{S}", "shoe", lambda v, n, s=s: paint_shoe(v, n, s), 1.0, None),
        (f"laces{S}", lambda s=s: laces(s), f"foot.{S}", "shoe", uniform("lace", 0.4), 0.6, None),
        (f"heelTab{S}", lambda s=s: heel_tab(s), f"foot.{S}", "shoe", uniform("sole", 0.4), 0.6, None),
        (f"sleeve{S}", lambda s=s: sleeve(s), f"upper_arm.{S}", "shirt", uniform("hoodie", 0.6), 0.8, None),
        (f"upperArm{S}", lambda s=s: upper_arm(s), f"upper_arm.{S}", "shirt", uniform("hoodie", 0.6), 0.8, None),
        (f"forearm{S}", lambda s=s: forearm(s), f"forearm.{S}", "shirt", lambda v, n, s=s: paint_forearm(v, n, s), 0.6, None),
    ]
    for kind in ("relaxed", "grip", "point", "open"):
        make = (lambda: cup_hand()) if (COFFEE and s < 0 and kind == "relaxed") else (lambda s=s, kind=kind: hand(s, kind))
        PARTS.append((f"hand{S}" + ("" if kind == "relaxed" else f"_{kind}"), make,
                      f"hand.{S}", "skin", uniform("skin", 0.42), 0.5, None))
if COFFEE:
    PARTS.append(("cup", cup, "hand.R", "cup", paint_cup, 0.5, None))

# swappable pieces: in each group one variant shows at a time (the first is the default)
VARIANTS = {
    "mouth": {"grin": ["head", "teeth", "tongue"], "grit": ["head_grit", "teeth_grit"], "oh": ["head_oh", "tongue_oh"]},
}
for S in ("L", "R"):
    VARIANTS[f"eye.{S}"] = {"open": [f"eye{S}"], "happy": [f"lid{S}", f"lash{S}_happy"], "squint": [f"lid{S}", f"lash{S}_squint"]}
    VARIANTS[f"hand.{S}"] = {k: [f"hand{S}" + ("" if k == "relaxed" else f"_{k}")] for k in ("relaxed", "grip", "point", "open")}

BONES = [
    # name, head, tail, parent (mm)
    ("root", (0, 0, 0), (0, 0, 10), None),
    ("hips", (0, 0.5, 27.0), (0, 0.5, 31.0), "root"),
    ("spine", (0, 0.5, 29.0), (0, 0.8, 50.0), "hips"),
    ("head", (0, 2.5, 53.0), (0, 2.0, 84.0), "spine"),
]
for s in (-1, 1):
    S = side(s)
    BONES += [
        (f"upper_arm.{S}", tuple(P3("shoulder", s)), tuple(P3("elbow", s)), "spine"),
        (f"forearm.{S}", tuple(P3("elbow", s)), tuple(P3("wrist", s)), f"upper_arm.{S}"),
        # the hand's tail is the middle of the fist (where a gripped rope runs), so an IK target puts the rope there
        (f"hand.{S}", tuple(P3("wrist", s)), tuple(hand_frame(s)[0] + hand_frame(s)[1] @ GRIP_C), f"forearm.{S}"),
        (f"brow.{S}", (s * 10.0, -19.0, 87.0), (s * 10.0, -19.0, 92.0), "head"),
        (f"thigh.{S}", (s * LEG["hip"], 0.6, 25.5), (s * LEG["cuff"], 0.2, 9.5), "hips"),
        (f"foot.{S}", (s * LEG["shoe"], 0.6, 8.5), (s * LEG["shoe"], -12.0, 2.0), f"thigh.{S}"),
    ]


def eye_texture(path, n=512):
    """The painted eye, mapped over the eye piece's front (x across, z up)."""
    from PIL import Image, ImageDraw
    big = n * 4
    im = Image.new("RGB", (big, big), COLORS["teeth"])
    d = ImageDraw.Draw(im)
    S = lambda u, v, r: (int((u - r) * big), int((v - r) * big), int((u + r) * big), int((v + r) * big))
    for i in range(48):  # the iris, dark at the top to warm brown below
        t = i / 47
        r = 0.40 * (1 - t * 0.55)
        top, bot = np.array([0x22, 0x13, 0x0C]), np.array([0x7A, 0x4A, 0x2A])
        c = top + (bot - top) * (0.25 + 0.75 * t ** 0.7)
        d.ellipse(S(0.5, 0.5 + 0.08 * t, r), fill=tuple(int(x) for x in c))
    d.ellipse(S(0.5, 0.5, 0.40), outline=(0x24, 0x14, 0x0D), width=int(0.035 * big))
    d.ellipse(S(0.5, 0.53, 0.165), fill=(0x12, 0x0A, 0x07))
    lid = [(int(u * big), int((0.17 + 0.16 * (2 * u - 1) ** 2) * big)) for u in np.linspace(0, 1, 64)]
    d.polygon([(0, 0), *lid, (big, 0)], fill=(0x1B, 0x13, 0x11))
    d.ellipse(S(0.37, 0.36, 0.10), fill=(255, 255, 255))
    d.ellipse(S(0.63, 0.66, 0.045), fill=(255, 255, 255))
    im.resize((n, n), Image.LANCZOS).save(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    eye_texture(ROOT / "eye.png")
    meta = {"units": "m", "facing": "-y", "height_mm": 120, "colors": COLORS, "parts": [],
            "bones": [{"name": n, "head": [c / 1000 for c in h], "tail": [c / 1000 for c in t], "parent": p} for n, h, t, p in BONES],
            "variants": VARIANTS,
            # where a gripping hand holds its rope: the axis through the fist (rest pose, m)
            "grip": {side(s): {"c": ((hand_frame(s)[0] + hand_frame(s)[1] @ GRIP_C) / 1000).tolist(),
                               "axis": hand_frame(s)[1][:, 1].tolist(), "frame": hand_frame(s)[1].tolist(),
                               "rope_radius": ROPE_R / 1000} for s in (-1, 1)}}
    for name, make, bone, mat, paint, hs, frame in PARTS:
        entry = {"name": name, "file": f"parts/{name}.npz", "bone": bone, "material": mat}
        if frame is not None:
            entry["frame"] = {"c": (frame["c"] / 1000).tolist(), "R": frame["R"].tolist()}
        meta["parts"].append(entry)
        if ONLY and name not in ONLY:
            continue
        t0 = time.time()
        node = make()
        v, f, nrm = mesh(node, H * hs)
        nrm = -nrm if (nrm * (v - v.mean(0))).sum() < 0 else nrm
        col, rough = paint(v, nrm)
        c, R = (frame["c"], frame["R"]) if frame is not None else (np.zeros(3), np.eye(3))
        local = (v - c) @ R
        np.savez_compressed(OUT / f"{name}.npz", verts=(local / 1000).astype(np.float32), faces=f.astype(np.int32),
                            normals=(nrm @ R).astype(np.float32), color=col.astype(np.float32), rough=rough.astype(np.float32))
        print(f"{name:10s} {len(v):7d} verts  {time.time() - t0:5.1f}s", flush=True)
    (ROOT / "tiezhu.json").write_text(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main()
