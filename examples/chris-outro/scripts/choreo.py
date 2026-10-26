"""The outro's motion, run inside scripts/scene.py (its objects are in scope):
the phone's spring, the avatar's swell, the toy (root, poses, faces, hands),
the handle's letters pushing out of the glass into a row under his feet, his
hops along it (three on the C, then a letter a beat), each letter falling as
he leaves it and landing out of sight in its place on the floor (a squash, a
puff of dust), his fall onto the I, the glint, the floor's pool of light, and
the camera (baked per frame, with the shakes of the landings).
"""
import random

rng = random.Random(7)
E = EV
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
LETTER_Y = T.LETTER["y"]
FR = list(range(1, T.FRAMES + 1))
tt = lambda f: (f - 1) / T.FPS
STRIP = json.loads((ROOT / "build/strip.json").read_text())


def ease_io(x):
    return smooth(x)


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ease_in(x):
    x = min(max(x, 0.0), 1.0)
    return x ** 2.2


def lerp(a, b, k):
    return a + (b - a) * k


def track(points, t, easing=ease_io):
    """Piecewise motion through (time, value) points, eased between each pair."""
    if t <= points[0][0]:
        return points[0][1]
    for (t0, v0), (t1, v1) in zip(points, points[1:]):
        if t <= t1:
            return lerp(v0, v1, easing((t - t0) / (t1 - t0)))
    return points[-1][1]


# ── the phone: springs up turning from its back; later fades out from the top down ──
for t, dz, rz, rx in ((E["pop"] - 0.24, -0.78, -180, 0), (E["pop"], 0.06, -70, -4), (E["pop"] + 0.16, 0.0, -14, 3),
                      (E["pop"] + 0.3, 0.018, 6, -1.5), (E["pop"] + 0.46, 0.0, -2, 0.5), (E["pop"] + 0.62, 0.0, 0, 0)):
    phone.location = PHONE_REST + Vector((0, 0, dz))
    phone.rotation_euler = (math.radians(rx), 0, math.radians(rz))
    phone.keyframe_insert("location", frame=F(t))
    phone.keyframe_insert("rotation_euler", frame=F(t))

# ── the avatar swells, wobbles and goes ────────────────────────────────────
show(avatar, E["bulge"], E["toy"])
kb = avatar.data.shape_keys.key_blocks["bulge"]
for t, v, s in ((E["bulge"], 0.0, 1.0), (E["bulge"] + 0.25, 0.28, 1.03), (E["glint"] - 0.12, 0.2, 1.0),
                (E["glint"], 0.5, 1.08), (E["glint"] + 0.2, 0.3, 1.02), (E["toy"] - 0.2, 0.45, 1.05), (E["toy"] - 0.03, 1.0, 1.25)):
    kb.value = v
    kb.keyframe_insert("value", frame=F(t))
    avatar.scale = (s, s, s)
    avatar.keyframe_insert("scale", frame=F(t))

# ── the toy: poses ─────────────────────────────────────────────────────────
REST_ROT = {b.name: b.matrix_local.to_3x3() for b in rig.data.bones}


def q(bone, rots):
    """A pose rotation from (axis, degrees) turns about rest-frame axes (applied in order)."""
    Qw = Quaternion()
    for axis, deg in rots:
        Qw = Quaternion(Vector(axis), math.radians(deg)) @ Qw
    B = REST_ROT[bone]
    return (B.inverted() @ Qw.to_matrix() @ B).to_quaternion()


ANIMATED = ["hips", "spine", "head", "upper_arm.L", "upper_arm.R", "forearm.L", "forearm.R", "hand.L", "hand.R",
            "thigh.L", "thigh.R", "foot.L", "foot.R"]
POSES = {
    "stand": {"upper_arm.L": [(Y, -9)], "upper_arm.R": [(Y, 9)]},
    "pop": {"upper_arm.L": [(Y, -75)], "upper_arm.R": [(Y, 75)], "forearm.L": [(Y, -35)], "forearm.R": [(Y, 35)],
            "thigh.L": [(Y, -10)], "thigh.R": [(Y, 10)], "head": [(X, -8)]},
    # hanging, facing the camera, both fists up beside his head on the strip's end behind him
    "hang": {"upper_arm.L": [(Y, -150), (X, 25)], "upper_arm.R": [(Y, 150), (X, 25)], "forearm.L": [(Y, -20)], "forearm.R": [(Y, 20)],
             "thigh.L": [(X, -16), (Y, -6)], "thigh.R": [(X, -4), (Y, 6)], "foot.L": [(X, 15)], "foot.R": [(X, 10)], "head": [(X, -6)]},
    "swing": {"upper_arm.L": [(Y, -150), (X, 25)], "upper_arm.R": [(Y, 150), (X, 25)], "forearm.L": [(Y, -20)], "forearm.R": [(Y, 20)],
              "thigh.L": [(X, -40)], "thigh.R": [(X, -28)], "foot.L": [(X, 25)], "foot.R": [(X, 25)], "head": [(X, 10)]},
    "watch": {"upper_arm.L": [(Y, -150), (X, 25)], "upper_arm.R": [(Y, 150), (X, 25)], "forearm.L": [(Y, -20)], "forearm.R": [(Y, 20)],
              "thigh.L": [(X, -12), (Y, -8)], "thigh.R": [(X, -2), (Y, 8)], "head": [(Z, 38), (X, 10)]},
    "fall": {"upper_arm.L": [(Y, -120)], "upper_arm.R": [(Y, 120)], "forearm.L": [(Y, -30)], "forearm.R": [(Y, 30)],
             "thigh.L": [(X, -30)], "thigh.R": [(X, -18)], "head": [(X, 8)]},
    "fall2": {"upper_arm.L": [(Y, -150), (X, -20)], "upper_arm.R": [(Y, 150), (X, -20)], "forearm.L": [(Y, 25)], "forearm.R": [(Y, -25)],
              "thigh.L": [(X, -10), (Y, -18)], "thigh.R": [(X, -38), (Y, 14)], "foot.L": [(X, 20)], "head": [(X, -12)]},
    "land": {"upper_arm.L": [(Y, -55)], "upper_arm.R": [(Y, 55)], "forearm.L": [(Y, -20)], "forearm.R": [(Y, 20)],
             "thigh.L": [(Y, -12)], "thigh.R": [(Y, 12)], "head": [(X, 8)]},
    "crouch": {"upper_arm.L": [(Y, -20), (X, 30)], "upper_arm.R": [(Y, 20), (X, 30)], "thigh.L": [(X, -10)], "thigh.R": [(X, -10)],
               "spine": [(X, 10)], "head": [(X, -6)]},
    "hop": {"upper_arm.L": [(Y, -100), (X, -20)], "upper_arm.R": [(Y, 100), (X, -20)], "forearm.L": [(Y, -30)], "forearm.R": [(Y, 30)],
            "thigh.L": [(X, -30)], "thigh.R": [(X, -30)], "foot.L": [(X, 20)], "foot.R": [(X, 20)], "head": [(X, -10)]},
    "stepL": {"thigh.L": [(X, -24)], "thigh.R": [(X, 16)], "upper_arm.L": [(X, 20), (Y, -9)], "upper_arm.R": [(X, -20), (Y, 9)]},
    "stepR": {"thigh.L": [(X, 16)], "thigh.R": [(X, -24)], "upper_arm.L": [(X, -20), (Y, -9)], "upper_arm.R": [(X, 20), (Y, 9)]},
    # leaning his left shoulder on the C, legs crossed, head tipped to the camera
    "lean": {"spine": [(Y, 11)], "head": [(Y, -6), (Z, -6)], "upper_arm.L": [(Y, -58), (X, -10)], "forearm.L": [(X, -70)],
             "upper_arm.R": [(Y, 22), (X, 12)], "forearm.R": [(X, -95), (Z, 30)], "thigh.R": [(Y, -20), (X, -4)],
             "thigh.L": [(Y, 3)], "foot.R": [(Z, 12)]},
    "point": {"spine": [(Y, 11)], "head": [(Y, -8), (Z, -6)], "upper_arm.L": [(Y, -58), (X, -10)], "forearm.L": [(X, -70)],
              "upper_arm.R": [(X, -78), (Y, 12)], "forearm.R": [(X, -12)], "thigh.R": [(Y, -20), (X, -4)],
              "thigh.L": [(Y, 3)], "foot.R": [(Z, 12)]},
    # on top of the I at the end: pointing at us, his other hand on his hip
    "finale": {"head": [(Y, -8), (X, -4)], "upper_arm.R": [(X, -78), (Y, 12)], "forearm.R": [(X, -12)],
               "upper_arm.L": [(Y, -48), (X, -12)], "forearm.L": [(X, -80)], "thigh.L": [(Y, -6)], "thigh.R": [(Y, 6)]},
}


def set_pose(name):
    spec = POSES[name]
    for b in ANIMATED:
        rig.pose.bones[b].rotation_quaternion = q(b, spec.get(b, []))


def key_pose(t, name):
    set_pose(name)
    for b in ANIMATED:
        rig.pose.bones[b].keyframe_insert("rotation_quaternion", frame=F(t) if t > 0 else 1)


def grip_offset(pose, side, facing_deg=0.0):
    """Where a hand's fist sits relative to the root, for an FK pose and facing (m, world)."""
    rig.location = (0, 0, 0)
    rig.rotation_euler = (0, 0, math.radians(facing_deg))
    rig.scale = (1, 1, 1)
    set_pose(pose)
    bpy.context.view_layer.update()
    return rig.matrix_world @ rig.pose.bones[f"hand.{side}"].tail


# IK on the hands for the strip's end: each fist goes to an empty, turned so its grip runs along the strip's end
GRIP = json.loads(rig["grip"])
targets, iks = {}, {}
for side in ("L", "R"):
    e = link(bpy.data.objects.new(f"grip{side}", None))
    e.rotation_mode = "QUATERNION"
    targets[side] = e
    c = rig.pose.bones[f"hand.{side}"].constraints.new("IK")
    c.target = e
    c.chain_count = 3
    c.use_rotation = True
    c.influence = 0.0
    iks[side] = c


def grip_rotation(side, along, fingers, facing_deg):
    """The hand bone's world rotation that runs its grip along `along`, fingers towards `fingers` (toy-local)."""
    fr = Matrix(GRIP[side]["frame"])  # columns u (down the hand), v (to the thumb), w (into the palm); rest, toy-local
    u0, v0 = Vector(fr.col[0]), Vector(fr.col[1])
    v1 = Vector(along).normalized()
    u1 = (Vector(fingers) - v1 * Vector(fingers).dot(v1)).normalized()
    rest = Matrix((u0, v0, u0.cross(v0))).transposed()
    want = Matrix((u1, v1, u1.cross(v1))).transposed()
    return (Matrix.Rotation(math.radians(facing_deg), 3, "Z") @ want @ rest.inverted() @ REST_ROT[f"hand.{side}"]).to_quaternion()


# ── the name: the page blows up around him; the handle's letters push out under him ──
# Once he is out of the avatar the page grows ZM times about the handle's C (the phone
# with it, its frame soon out of sight) until its type stands as tall as the name on
# the floor: he is smaller than a letter, as he will be there. The handle's letters are
# the floor's 3D letters from then on, flat and black on the glass where they were
# printed; they push out D deep in a row under him, turn white as he lands on each, and
# fall as he leaves it, landing out of sight in its place in the name far below
LH = letters[5]["top_z"]  # the letters' height (the H's)
STRIP_RUNS = STRIP["runs"]  # the handle's letters in its print (pixels of assets/name.png)
HANDLE = UI["name"]  # @ChrisHKAI on the screen (screen px: x, y, w, h)
PIVOT = Vector(T.ui_to_world(HANDLE[0] + STRIP_RUNS[0][0], HANDLE[1] + HANDLE[3] / 2, 0.0))  # the C's left edge, mid-line
ZM = LH / (0.7 * 16 * T.UI["w"] / 402 * T.PX)  # the page's growth: its 16 pt type's caps to the letters' height
# they stand off the page, as deep as on the floor (stretched deeper, their sides hid the A's
# counter and swung HKAI away from the lens: the user's eye, 2026-10-24), far enough out for him
# to stand on them clear of the page; their shadows on it set them off it
STANDOFF = 0.065
D = T.LETTER["depth"]
W_SCALE = Vector((1.0, 1.0, 1.0))
_c_left = letters[0]["x"] - letters[0]["w"] / 2
SLOT_X = [PIVOT.x + ob["x"] - _c_left for ob in letters]  # their places on the blown-up page
Z_ROW = PIVOT.z - LH / 2  # the row's foot: its middle on the handle's line
PAGE_Y = T.SCREEN_Y - 0.0009 * ZM  # the blown-up page's face (it stood 0.9 mm off the glass before it grew)
SLOT = [Vector((x, PAGE_Y - STANDOFF - D / 2, Z_ROW)) for x in SLOT_X]
TOY_Y = SLOT[0].y  # his root on the row's tops
TOP = [Vector((x + ob["top_x"], TOY_Y, Z_ROW + ob["top_z"])) for x, ob in zip(SLOT_X, letters)]
# the floor's row, far below: its I right under the page's, so he falls straight down onto it
_dx = SLOT_X[-1] - letters[-1]["x"]
for ob in letters:
    ob["x"] += _dx
C_LEFT = letters[0]["x"] - letters[0]["w"] / 2
ROW_END = letters[-1]["x"] + letters[-1]["w"] / 2
ROW_C = Vector(((C_LEFT + ROW_END) / 2, LETTER_Y, T.FLOOR_Z))
floor.location.z = T.FLOOR_Z
AV_FRONT = AV_C + Vector((0, -0.05, -0.066))
UP = Vector((TOP[0].x, TOY_Y, TOP[0].z + 0.1))  # the pop throws him up over the C as the page grows
show(name_strip, T.DURATION + 1)  # the torn strip of the first cut: never seen


def zoom_k(t):
    """The page's growth at t (1 → ZM), eased."""
    return lerp(1.0, ZM, ease_io(seg(t, E["zoom"], E["zoomed"])))


# the phone grows about the pivot (keyed every frame through the zoom, so the pivot holds still);
# the giant phone goes once he has fallen past it
for f in range(F(E["zoom"]) - 1, F(E["zoomed"]) + 2):
    k = zoom_k(tt(f))
    phone.location = PIVOT + k * (PHONE_REST - PIVOT)
    phone.scale = (k, k, k)
    phone.keyframe_insert("location", frame=f)
    phone.keyframe_insert("scale", frame=f)
for _ob in [phone] + list(phone.children_recursive):  # (hiding the parent alone leaves its parts: its black glass mirrored the floor's lights)
    if _ob is not zoom_page:
        show(_ob, None, E["fall"] + 0.6)
show(zoom_page, E["zoom"], E["fall"] + 0.6)
# as he drops onto the handle the app goes, leaving a plain grey for the letters (as the screen
# does, scripts/screen.py); it goes dark as he falls down it
_znodes = zoom_page.data.materials[0].node_tree.nodes
_gone = _znodes["gone"].outputs[0]
for t, v in ((E["stomp"] - 0.3, 0.0), (E["stomp"] + 0.2, 1.0)):
    _gone.default_value = v
    _gone.keyframe_insert("default_value", frame=F(t))


def floor_top(i):
    """Where he stands on letter i on the floor (world, his root)."""
    ob = letters[i]
    return Vector((ob["x"] + ob["top_x"], LETTER_Y, T.FLOOR_Z + ob["top_z"]))


B = T.beat
C_LAND = [B(n) for n in T.C_HOPS]
STEP_LAND = [B(n) for n in T.STEP_BEATS]

# the page turns to dark mode behind him: as each letter goes white under him the page left of it
# goes black (a soft upright edge in the gap after it), so a white letter stands on black and the
# black ones still to come on white; as the I goes the black takes the whole page: into the dark below
WIPE_SOFT = 0.012  # the edge's softness (m)
_znt = zoom_page.data.materials[0].node_tree
_geo = _znt.nodes.new("ShaderNodeNewGeometry")
_sep = _znt.nodes.new("ShaderNodeSeparateXYZ")
_znt.links.new(_geo.outputs["Position"], _sep.inputs[0])
_wipe = _znt.nodes.new("ShaderNodeValue")
_wipe.name = "wipe"
_edge = _znt.nodes.new("ShaderNodeMath")
_edge.operation = "SUBTRACT"
_znt.links.new(_wipe.outputs[0], _edge.inputs[0])
_znt.links.new(_sep.outputs["X"], _edge.inputs[1])
_soft = _znt.nodes.new("ShaderNodeMapRange")
_soft.interpolation_type = "SMOOTHSTEP"
_soft.inputs["From Min"].default_value = -WIPE_SOFT
_soft.inputs["From Max"].default_value = WIPE_SOFT
_znt.links.new(_edge.outputs[0], _soft.inputs["Value"])
_znt.links.new(_soft.outputs["Result"], _znt.nodes["inkMix"].inputs["Factor"])


def gap_after(i):
    """The middle of the gap after letter i (x)."""
    right = SLOT_X[i] + letters[i]["w"] / 2
    return (right + SLOT_X[i + 1] - letters[i + 1]["w"] / 2) / 2 if i + 1 < len(letters) else right + 0.06


_w = _wipe.outputs[0]
_prev = SLOT_X[0] - letters[0]["w"] / 2 - 10.0  # nothing black yet
for t, v in ((0.0, _prev),):
    _w.default_value = v
    _w.keyframe_insert("default_value", frame=1)
for i in range(len(letters)):
    on_it = C_LAND[0] if i == 0 else STEP_LAND[i - 1]
    start = max(_prev, SLOT_X[i] - letters[i]["w"] / 2 - 0.02)  # it sweeps in from the letter's left edge
    for t, v in ((on_it - 0.01, _prev), (on_it, start), (on_it + 0.14, gap_after(i))):
        _w.default_value = v
        _w.keyframe_insert("default_value", frame=t * T.FPS + 1)
    _prev = gap_after(i)
for t, v in ((T.FALL[-1] - 0.01, _prev), (T.FALL[-1] + 0.35, _prev + 8.0)):
    _w.default_value = v
    _w.keyframe_insert("default_value", frame=t * T.FPS + 1)


def c_sink(t):
    """How far the C has given under his hops (m down, degrees tipped forward)."""
    if t < C_LAND[0]:
        return 0.0, 0.0
    if t < C_LAND[1]:
        return 0.012, 4.0
    return 0.03, 9.0


def c_top(t):
    dz, _ = c_sink(t)
    return TOP[0] - Vector((0, 0, dz))


# the floor: CLAWD's grey satin, albedo 0.15 under the word fading to black (no
# horizon) over its distances scaled by our word's width to its; rough enough that
# the letters' reflections blur
WORD_K = (ROW_END - C_LEFT) / T.CLAWD["word"]
FLOOR = T.CLAWD["floor"]
_grey = FLOOR["albedo"]
floor_mat = material("satinFloor", "#ffffff", rough=FLOOR["rough"])
_ft = floor_mat.node_tree
_fp = _ft.nodes["Principled BSDF"]
_tc = _ft.nodes.new("ShaderNodeTexCoord")
_vm = _ft.nodes.new("ShaderNodeVectorMath")
_vm.operation = "DISTANCE"
_vm.inputs[1].default_value = (ROW_C.x, 0.0, ROW_C.y)  # the floor's local xz is world xy
_ft.links.new(_tc.outputs["Object"], _vm.inputs[0])
_mr = _ft.nodes.new("ShaderNodeMapRange")
_mr.inputs["From Min"].default_value = FLOOR["fade"][0] * WORD_K
_mr.inputs["From Max"].default_value = FLOOR["fade"][1] * WORD_K
_mr.inputs["To Min"].default_value = 1.0
_mr.inputs["To Max"].default_value = 0.0
_mr.interpolation_type = "SMOOTHSTEP"
_ft.links.new(_vm.outputs["Value"], _mr.inputs["Value"])
_mc = _ft.nodes.new("ShaderNodeMix")
_mc.data_type = "RGBA"
_mc.inputs["A"].default_value = (0, 0, 0, 1)
_mc.inputs["B"].default_value = (_grey, _grey, _grey, 1)
_ft.links.new(_mr.outputs["Result"], _mc.inputs["Factor"])
_ft.links.new(_mc.outputs["Result"], _fp.inputs["Base Color"])
_sp = _ft.nodes.new("ShaderNodeMath")  # the sheen fades too, so no far edge catches the light
_sp.operation = "MULTIPLY"
_sp.inputs[1].default_value = 0.3
_ft.links.new(_mr.outputs["Result"], _sp.inputs[0])
_ft.links.new(_sp.outputs[0], _fp.inputs["Specular IOR Level"])
floor.data.materials[0] = floor_mat

# the lights on the row: a key with a soft pool, a cool rim from behind, a little fill
for _n in ("KeyDown", "RimDown", "FillDown"):
    bpy.data.objects.remove(bpy.data.objects[_n], do_unlink=True)


def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()


_aimc = ROW_C + Vector((0, 0, 0.1))
for _name, _kind, _p, _loc, _col, _size in (
    ("KeyDown", "SPOT", 40, (-0.3, -0.9, 2.4), "#ffffff", 0.6),
    # a broad soft key from the front, 60 degrees of spread, so the faces read clean white
    ("KeyFront", "AREA", 3, (0.0, -2.6, 1.0), "#ffffff", 1.2),
    ("RimDown", "AREA", 25, (0.4, 1.3, 1.2), "#cfdcff", 1.2),
    ("FillDown", "AREA", 8, (1.8, -1.6, 0.5), "#fff5ee", 1.4),
):
    _ld = bpy.data.lights.new(_name, _kind)
    _ld.energy = _p
    _ld.color = lin(_col)[:3]
    if _kind == "SPOT":
        _ld.spot_size = math.radians(52)
        _ld.spot_blend = 0.9
        _ld.shadow_soft_size = _size
    else:
        _ld.shape = "DISK"
        _ld.size = _size
        if _name == "KeyFront":
            _ld.spread = math.radians(42)
    _ob = link(bpy.data.objects.new(_name, _ld))
    _ob.location = ROW_C + Vector(_loc)
    aim(_ob, _aimc)
    # these light the letters and him, not the floor: their glare on the satin (the rim's
    # mirror image lies on the floor in front of the row) burnt out the frame
    _rc = bpy.data.collections.get("notFloor") or bpy.data.collections.new("notFloor")
    if floor.name not in _rc.objects:
        _rc.objects.link(floor)
        for _co in _rc.collection_objects:
            _co.light_linking.link_state = "EXCLUDE"
    _ob.light_linking.receiver_collection = _rc

# the pool on the floor, as CLAWD's lamp throws one: a soft spot from overhead, bright
# under the word and falling off toward the lens; diffuse only (no glare)
_pl = bpy.data.lights.new("Pool", "SPOT")
_pl.energy = 600
_pl.spot_size = 2 * math.atan(0.5 * (ROW_END - C_LEFT) / 2.0)
_pl.spot_blend = 1.0
_pl.shadow_soft_size = 0.5
_pl.color = lin("#fffaf5")[:3]
_pool = link(bpy.data.objects.new("Pool", _pl))
_pool.location = ROW_C + Vector((0, 0.25, 2.0))
aim(_pool, ROW_C + Vector((0, 0.15, 0)))
_pool.visible_glossy = False
# the floor only: from straight above it burnt the letters' tops out
_of = bpy.data.collections.new("onlyFloor")
_of.objects.link(floor)
for _co in _of.collection_objects:
    _co.light_linking.link_state = "INCLUDE"
_pool.light_linking.receiver_collection = _of


def hop(t, t0, a, b, h=0.05, dur=0.34):
    """A hop from a to b taking off at t0: (location, squash)."""
    k = seg(t, t0, t0 + dur)
    loc = a.lerp(b, ease_io(k)) + Vector((0, 0, h * math.sin(math.pi * k)))
    squash = 1.0
    if t0 - 0.12 <= t < t0:
        squash = 1 - 0.1 * math.sin(math.pi * seg(t, t0 - 0.12, t0))  # crouch
    elif t0 + dur <= t < t0 + dur + 0.12:
        squash = 1 - 0.12 * math.sin(math.pi * seg(t, t0 + dur, t0 + dur + 0.12))  # land
    return loc, squash


ON_I = floor_top(len(letters) - 1)  # where he lands, on the stinger
C_OFF = C_LAND[-1] + 0.06  # the C goes from under him: he springs for the h


def root_at(t):
    """The toy's root: location, facing (deg about z), scale (x/y, z)."""
    if t < E["toy"]:
        return AV_FRONT, 0.0, (1e-4, 1e-4)
    if t < E["stomp"] - 0.3:  # pops out of the avatar, up and over the C, as the page grows under him
        s = track([(E["toy"], 0.55), (E["toy"] + 0.08, 1.14), (E["toy"] + 0.17, 0.94), (E["toy"] + 0.28, 1.0)], t, ease_out)
        bob = Vector((0, 0, 0.01 * math.sin(2 * math.pi * seg(t, E["zoomed"], E["stomp"] - 0.3))))
        return AV_FRONT.lerp(UP, ease_io(seg(t, E["toy"], E["zoomed"]))) + bob, 0.0, (s, s)
    if t < E["stomp"]:  # drops onto the handle: the C pushes out under his feet
        return UP.lerp(TOP[0], ease_in(seg(t, E["stomp"] - 0.3, E["stomp"]))), 0.0, (1.0, 1.0)
    if t < C_LAND[0] - 0.46:
        sq = 1 - 0.18 * math.sin(math.pi * seg(t, E["stomp"], E["stomp"] + 0.16))
        return TOP[0], 0.0, (2 - sq, sq)
    for land in C_LAND[:2] + [C_LAND[2]]:  # three hops on the C, sinking with it
        if t < land + 0.06:
            loc, sq = hop(t, land - 0.34, c_top(land - 0.4), c_top(land + 0.01), h=0.07)
            return loc, 0.0, (2 - sq, sq)
    if t < STEP_LAND[0] + 0.12:  # the C gives way: a scramble for the h
        loc, sq = hop(t, C_OFF, c_top(C_OFF), TOP[1], h=0.08, dur=STEP_LAND[0] - C_OFF)
        return loc, 0.0, (2 - sq, sq)
    for i in range(1, len(STEP_LAND)):  # then a letter a beat, higher over the gap between Chris and HKAI
        if t < STEP_LAND[i] + 0.12:
            gap = abs(TOP[i + 1].x - TOP[i].x)
            loc, sq = hop(t, STEP_LAND[i] - 0.34, TOP[i], TOP[i + 1], h=0.04 + 0.35 * gap)
            return loc, 0.0, (2 - sq, sq)
    if t < E["fall"]:  # the I has gone: a beat in the air, legs going
        return TOP[-1] + Vector((0, 0, 0.008 * math.sin(40 * (t - T.FALL[-1])) * (t > T.FALL[-1]))), 0.0, (1.0, 1.0)
    if t < E["sting"] + 0.26:  # down the phone and on through the dark, onto the I
        tj = E["sting"] - E["fall"]
        tau = min(t - E["fall"], tj)
        a = TOP[-1]
        loc = a.lerp(ON_I, ease_io(tau / tj))
        v0 = 0.25
        g = 2 * (a.z - ON_I.z + v0 * tj) / (tj * tj)  # a slow cartoon gravity, landing on the beat
        loc.z = max(a.z + v0 * tau - 0.5 * g * tau * tau, ON_I.z)
        sq = 1 - 0.12 * math.sin(math.pi * seg(t, E["sting"], E["sting"] + 0.26))  # gentle: a quick squash smeared under the blur
        return loc, 0.0, (2 - sq, sq)
    return ON_I, 0.0, (1.0, 1.0)


for f in FR:
    loc, rz, (sxy, sz) = root_at(tt(f))
    rig.location = loc
    rig.rotation_euler = (0, 0, math.radians(rz))
    rig.scale = (sxy, sxy, sz)
    for p in ("location", "rotation_euler", "scale"):
        rig.keyframe_insert(p, frame=f)

# ── the toy: poses, hands, faces ───────────────────────────────────────────
POSES["look"] = {"head": [(Z, 40), (X, 12)], "upper_arm.L": [(Y, -9)], "upper_arm.R": [(Y, 9)]}
key_pose(0.0, "pop")
key_pose(E["toy"] + 0.3, "pop")
key_pose(E["stomp"] - 0.25, "hop")
key_pose(E["stomp"], "land")
key_pose(E["stomp"] + 0.2, "stand")
key_pose(T.PUSH[3], "look")  # watching his name push out along the screen
key_pose(T.PUSH[-1] + 0.4, "look")
key_pose(C_LAND[0] - 0.6, "stand")
for land in C_LAND[:2]:
    key_pose(land - 0.44, "crouch")
    key_pose(land - 0.34, "hop")
    key_pose(land, "land")
    key_pose(land + 0.16, "stand")
key_pose(C_LAND[2] - 0.44, "crouch")
key_pose(C_LAND[2] - 0.34, "hop")
key_pose(C_LAND[2], "land")
key_pose(C_OFF + 0.05, "fall")  # the C goes: arms up, scrambling
for i, land in enumerate(STEP_LAND):
    key_pose(land, "land")
    if i + 1 < len(STEP_LAND):
        key_pose(STEP_LAND[i + 1] - 0.44, "crouch")
        key_pose(STEP_LAND[i + 1] - 0.34, "hop")
key_pose(STEP_LAND[-1] + 0.16, "stand")
# the I goes: legs going in the air, then down the phone and on through the dark
_t, _k = T.FALL[-1] + 0.04, 0
while _t < E["sting"] - 0.15:
    key_pose(_t, ("fall", "fall2")[_k % 2])
    _t, _k = _t + (0.15 if _t < E["fall"] else 0.45), _k + 1  # slow swings: quick ones smeared him under the motion blur
key_pose(E["sting"] - 0.22, "fall2")
key_pose(E["sting"] + 0.04, "land")
key_pose(E["sting"] + 0.14, "finale")
key_pose(E["end"], "finale")

for t, hl, hr in ((0.0, "open", "open"), (E["stomp"] + 0.3, "relaxed", "relaxed"), (C_OFF, "open", "open"),
                  (STEP_LAND[0] + 0.3, "relaxed", "relaxed"), (T.FALL[-1], "open", "open"), (E["sting"], "relaxed", "point")):
    chris_rig.hand(rig, "L", hl, F(t) if t > 0 else 1)
    chris_rig.hand(rig, "R", hr, F(t) if t > 0 else 1)

for t, face in ((0.0, "surprise"), (E["toy"] + 0.25, "grin"), (E["stomp"] - 0.25, "surprise"), (E["stomp"] + 0.1, "grin"),
                (T.PUSH[4], "happy"), (C_LAND[0], "grin"), (C_LAND[1], "effort"), (C_LAND[2] + 0.02, "surprise"),
                (STEP_LAND[0] + 0.1, "happy"), (STEP_LAND[3], "grin"), (STEP_LAND[4], "happy"),
                (T.FALL[-1] + 0.05, "surprise"), (E["fall"] + 0.5, "happy"), (E["sting"] - 0.3, "surprise"),
                (E["sting"], "wink")):
    chris_rig.expression(rig, face, F(t) if t > 0 else 1)

# ── the letters: out of the glass, under his feet, down to the floor ───────
dust_mat = material("dust", "#c9c5be", rough=0.95)
_nt = dust_mat.node_tree  # soft at its edges: clear where the surface turns away
_lw = _nt.nodes.new("ShaderNodeLayerWeight")
_lw.inputs["Blend"].default_value = 0.6
_pw = _nt.nodes.new("ShaderNodeMath")
_pw.operation = "POWER"
_pw.inputs[1].default_value = 0.6
_nt.links.new(_lw.outputs["Facing"], _pw.inputs[0])
_inv = _nt.nodes.new("ShaderNodeMath")
_inv.operation = "SUBTRACT"
_inv.inputs[0].default_value = 0.85
_nt.links.new(_pw.outputs[0], _inv.inputs[1])
_nt.links.new(_inv.outputs[0], _nt.nodes["Principled BSDF"].inputs["Alpha"])
Ff = lambda t: t * T.FPS + 1  # an exact (fractional) frame
SHAKES = []


def keyl(ob, t, loc=None, scale=None, rot=None, white=None):
    """Key a letter at an exact time: any of its location, scale, rotation (deg) and whiteness."""
    if loc is not None:
        ob.location = loc
        ob.keyframe_insert("location", frame=Ff(t))
    if scale is not None:
        ob.scale = scale
        ob.keyframe_insert("scale", frame=Ff(t))
    if rot is not None:
        ob.rotation_euler = tuple(math.radians(v) for v in rot)
        ob.keyframe_insert("rotation_euler", frame=Ff(t))
    if white is not None:
        ob["white"] = white
        ob.keyframe_insert('["white"]', frame=Ff(t))


mul = lambda v, a, b, c: Vector((v.x * a, v.y * b, v.z * c))
FLAT = 0.012  # flat on the glass: printed
for i, ob in enumerate(letters):
    push, fall, land = T.PUSH[i], T.FALL[i], T.LAND[i]
    on_it = C_LAND[0] if i == 0 else STEP_LAND[i - 1]  # the landing that turns it white
    ob["white"] = 0.0
    show(ob, E["zoom"])
    # printed: flat and black on the glass, growing with the page (keyed every frame, about the pivot)
    flat_at = Vector((SLOT_X[i], T.SCREEN_Y - 0.0015 * ZM, Z_ROW))  # just off the page as it grows
    for f in range(F(E["zoom"]) - 1, F(E["zoomed"]) + 2):
        k = zoom_k(tt(f)) / ZM
        ob.location = PIVOT + k * (flat_at - PIVOT)
        ob.scale = (k, FLAT * k, k)
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("scale", frame=f)
    keyl(ob, 0.0, rot=(0, 0, 0), white=0.0)
    keyl(ob, push - 0.01, flat_at, Vector((1, FLAT, 1)))
    # it pushes out of the glass, with a little overshoot
    dur = T.PUSH_DUR[i]
    keyl(ob, push + 0.55 * dur, SLOT[i] + Vector((0, -0.01, 0)), mul(W_SCALE, 1.04, 1.15, 1.04))
    keyl(ob, push + 0.8 * dur, SLOT[i], mul(W_SCALE, 0.98, 0.97, 0.98))
    keyl(ob, push + dur, SLOT[i], W_SCALE)
    # white under his feet, with a pop
    keyl(ob, on_it - 0.01, white=0.0)
    keyl(ob, on_it + 0.03, white=1.0)
    here, tip = SLOT[i], 0.0
    if i == 0:  # the C gives under his first two hops, a little and then more
        for land_c in C_LAND[:2]:
            dz, tip = c_sink(land_c + 0.01)
            prev_dz, prev_tip = c_sink(land_c - 0.01)
            keyl(ob, land_c - 0.01, SLOT[0] - Vector((0, 0, prev_dz)), None, (prev_tip, 0, 0))
            keyl(ob, land_c + 0.06, SLOT[0] - Vector((0, 0, dz)), None, (tip, 0, 0))
        for dt, sx, sz in ((-0.01, 1.0, 1.0), (0.04, 1.06, 0.9), (0.11, 0.98, 1.04), (0.16, 1.0, 1.0)):
            keyl(ob, C_LAND[0] + dt, None, mul(W_SCALE, sx, sx, sz))
        here = SLOT[0] - Vector((0, 0, dz))
        SHAKES += [(C_LAND[0], 0.003), (C_LAND[1], 0.005)]
    else:  # each squashes under his landing as it turns white
        for dt, sx, sz in ((-0.01, 1.0, 1.0), (0.04, 1.06, 0.9), (0.11, 0.98, 1.04), (0.16, 1.0, 1.0)):
            keyl(ob, on_it + dt, None, mul(W_SCALE, sx, sx, sz))
    # it goes from under him: a real drop out of the frame, then (out of sight) on down to the floor
    spin = rng.uniform(-25, 25)
    keyl(ob, fall, here, W_SCALE, (tip, 0, 0))
    keyl(ob, fall + 0.15, here + Vector((0, -0.01, -0.12)), W_SCALE, (tip - 6, spin * 0.3, 0))
    keyl(ob, fall + 0.3, here + Vector((0, -0.04, -0.5)), W_SCALE, (tip - 15, spin, 0))
    goal = Vector((ob["x"], LETTER_Y, T.FLOOR_Z))
    keyl(ob, lerp(fall + 0.3, land, 0.5), here.lerp(goal, 0.6) + Vector((0, 0, 0.3)), Vector((1, 1, 1)), (rng.uniform(-30, 30), spin, 0))
    keyl(ob, land - 1.2 / T.FPS, goal + Vector((0, 0, 0.03)), Vector((1, 1, 1)), (rng.uniform(-6, 6), 0, rng.uniform(-5, 5)))
    keyl(ob, land, goal, None, (0, 0, 0))
    for dt, sx, sz in ((0.035, 1.1, 0.8), (0.1, 0.96, 1.07), (0.17, 1.01, 0.98), (0.24, 1.0, 1.0)):
        keyl(ob, land + dt, None, Vector((sx, sx, sz)))
    for j in range(12):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, segments=14, ring_count=8)
        d = bpy.context.object
        d.data.materials.append(dust_mat)
        a = 2 * math.pi * j / 12 + rng.uniform(-0.2, 0.2)
        base = goal + Vector((0, 0, 0.01))
        r0 = rng.uniform(0.018, 0.034)
        d.scale = (1e-4,) * 3
        d.keyframe_insert("scale", frame=1)
        for t, rr, s in ((land - 1 / T.FPS, 0.0, 1e-4), (land, ob["w"] * 0.5, r0 * 0.5), (land + 0.3, ob["w"] * 0.5 + 0.09, r0 * 0.8),
                         (land + 0.7, ob["w"] * 0.5 + 0.15, 1e-4)):
            d.location = base + Vector((math.cos(a) * rr, math.sin(a) * rr * 0.5, rr * 0.12))
            d.scale = (s, s, s * 0.7)
            d.keyframe_insert("location", frame=Ff(t))
            d.keyframe_insert("scale", frame=Ff(t))
# the I squashes under him as he lands on it, on the stinger
for dt, sx, sz in ((-0.01, 1.0, 1.0), (0.04, 1.05, 0.9), (0.11, 0.98, 1.04), (0.2, 1.0, 1.0)):
    keyl(letters[-1], E["sting"] + dt, None, Vector((sx, sx, sz)))
SHAKES += [(C_LAND[2], 0.008)] + [(t, 0.003) for t in STEP_LAND] + [(E["sting"], 0.002)]

# ── the camera ─────────────────────────────────────────────────────────────
icon = UI["xicon"]
ICON_C = Vector(T.ui_to_world(icon[0] + icon[2] / 2, icon[1] + icon[3] / 2))
# the lens: the phone's shots at 26 degrees (vertical, on our 24 mm sensor); on the
# floor CLAWD's 35 mm full frame (20.25 mm tall at 16:9), the same view on ours.
# Into the floor's lens on the way down, in the dark; a shot framed on the phone's
# lens keeps its subject's size (ZOOM scales its distance)
LENS_PHONE = cam_data.lens
LENS_FLOOR = T.CLAWD["lens"] * 24 / 20.25


def on_floor(t):
    """1 on the floor (CLAWD's look), 0 up at the phone; the change made in the dark of the fall."""
    return ease_io(seg(t, E["fall"] + 0.25, E["sting"] - 0.15))


lens_at = lambda t: lerp(LENS_PHONE, LENS_FLOOR, on_floor(t))
SKY = w_light.inputs["Strength"].default_value  # the world's soft light up at the phone: none in CLAWD's black void
ZOOM = lambda t: lens_at(t) / LENS_PHONE
HFOV = math.atan(12 / LENS_FLOOR * 16 / 9)  # half the horizontal view on the floor
EYE = T.CLAWD["eye"] * LH  # the camera's height on the floor: CLAWD's, about the letters' tops


def low(z, d):
    """The elevation (degrees) that puts the camera at EYE, aimed at height z from d away."""
    return math.degrees(math.asin((EYE - z) / d))


def toy_c(t, up=0.06):
    loc, _, _ = root_at(t)
    return loc + Vector((0, 0, up))


# the whole name square on: the row fills 84% of the frame's width
WIDE_D = (ROW_END - C_LEFT) / 2 / 0.84 / math.tan(HFOV)
# on the page, on the phone's lens, close (the user's call, 2026-10-24: as close as the snail
# film, things cut by the frame's edges): a letter, or him
VFOV = math.atan(12 / LENS_PHONE)  # half the vertical view on the phone's lens
LETTER_D = LH / 0.58 / 2 / math.tan(VFOV)  # a letter a little over half of the frame's height
TOY_D = 0.129 / 0.45 / 2 / math.tan(VFOV)  # he, 0.129 m tall, near half of it (the zoom's size, which the user liked)
HOP_D = 0.42 / 2 / math.tan(VFOV)  # hopping: four or five letters whole under him, his hops clear of the frame's top


def push_x(t):
    """The camera along the row as the letters push out: a slow, steady glide, at each one as it comes."""
    pts = [(T.PUSH[i] + 0.15, SLOT_X[i]) for i in range(1, len(SLOT_X))]
    return track(pts, t, lambda x: x)


_xs = [root_at(tt(f))[0].x for f in FR]


# the blown-up screen's left edge: the hop frame keeps clear of it (beyond is the phone's frame)
SCREEN_LEFT = PIVOT.x - (HANDLE[0] + STRIP_RUNS[0][0]) * T.PX * ZM


def follow_x(t):
    """His x, smoothed over half a second: the camera follows each hop a little behind."""
    i = min(max(int(round(t * T.FPS)), 0), len(_xs) - 1)
    win = _xs[max(i - 8, 0):i + 9]
    return max(sum(win) / len(win), SCREEN_LEFT + HOP_D * math.tan(math.atan(12 / LENS_PHONE * 16 / 9)) + 0.04)


_zs = [root_at(tt(f))[0].z for f in FR]


def follow_z(t):
    """His height, smoothed the same: a hop lifts the frame a little."""
    i = min(max(int(round(t * T.FPS)), 0), len(_zs) - 1)
    win = _zs[max(i - 8, 0):i + 9]
    return sum(win) / len(win)


# and on the page, on the phone's lens: the row fills 80% of it
ROW_P = (SLOT_X[0] - letters[0]["w"] / 2 + SLOT_X[-1] + letters[-1]["w"] / 2) / 2
WALL_D = (ROW_END - C_LEFT) / 2 / 0.88 / math.tan(math.atan(12 / LENS_PHONE * 16 / 9))

SHOTS = [
    # (start, end of the blend into it, target, azimuth, elevation, distance)
    (0.0, 0.0, lambda t: PHONE_REST + Vector((0, 0, -0.05)), lambda t: 0, lambda t: 4, lambda t: lerp(1.75, 1.6, seg(t, 1.2, 3.3))),
    (E["push"], E["tap"] - 0.05, lambda t: ICON_C, lambda t: -3, lambda t: 3, lambda t: 0.5),
    (E["launch"] + 0.1, E["profile"], lambda t: PHONE_REST + Vector((-0.02, 0, 0.105)), lambda t: 0, lambda t: 3, lambda t: lerp(0.66, 0.6, seg(t, E["profile"], E["bulge"]))),
    (E["bulge"], E["toy"] - 0.1, lambda t: AV_C + Vector((0.004, 0, -0.004)), lambda t: -4, lambda t: 2, lambda t: 0.3),
    (E["toy"] - 0.05, E["toy"] + 0.15, lambda t: AV_C + Vector((0, -0.04, -0.01)), lambda t: -10, lambda t: 4, lambda t: 0.4),
    # the page blows up behind him: the camera holds him, the page grows past
    (E["zoom"], E["zoom"] + 0.3, lambda t: toy_c(t, 0.06), lambda t: -10, lambda t: 4, lambda t: 0.45),
    # in close, as the snail film is: the C bursts out of the page filling most of the frame
    (T.PUSH[0] - 0.25, T.PUSH[0], lambda t: Vector((SLOT_X[0], SLOT[0].y, Z_ROW + 0.5 * LH)), lambda t: -4, lambda t: 3,
     lambda t: LETTER_D),
    # he drops in on it: up to him, the C cut by the frame's foot
    (E["stomp"] - 0.15, E["stomp"] + 0.25, lambda t: Vector((TOP[0].x, TOY_Y, Z_ROW + LH + 0.05)), lambda t: -10, lambda t: 4,
     lambda t: TOY_D),
    # along the row as h r i s come out, slowly, each big as it comes
    (T.PUSH[1] - 0.12, T.PUSH[1] + 0.25, lambda t: Vector((push_x(t), SLOT[0].y, Z_ROW + 0.5 * LH)), lambda t: -5, lambda t: 3,
     lambda t: LETTER_D),
    # back out to the whole name as H K A I pop in, and a beat on it, to read it
    (T.PUSH[-2] + 0.1, T.PUSH[-1] + 0.5, lambda t: Vector((ROW_P, TOY_Y, Z_ROW + 0.75 * LH)), lambda t: 0, lambda t: 2,
     lambda t: WALL_D),
    # then in to him on the C for the hops, and with him, hop by hop, up and down too
    (C_LAND[0] + 0.2, C_LAND[1] - 0.1, lambda t: Vector((follow_x(t), TOY_Y, follow_z(t) + 0.03)), lambda t: -4, lambda t: 4,
     lambda t: HOP_D),
    # the I goes: down with him all the way, past the page as it goes dark, into the floor's lens, onto the I
    (T.FALL[-1], E["fall"] - 0.02, lambda t: Vector((toy_c(t).x, toy_c(t).y, max(toy_c(t, 0.05).z - 0.02, T.FLOOR_Z + 0.06))), lambda t: -18, lambda t: 1,
     lambda t: 0.5 * ZOOM(t)),
    # the stinger on the I, then out to the whole name with him on top: the card, held
    (E["sting"] + 0.2, E["sting"] + 1.2, lambda t: ROW_C + Vector((0.0, 0, 0.8 * LH)), lambda t: 0, lambda t: low(0.8 * LH, WIDE_D * 1.05),
     lambda t: WIDE_D * 1.05),
]


def view(shot, t):
    _, _, tgt, az, el, dist = shot
    c = tgt(t)
    a, e = math.radians(az(t)), math.radians(el(t))
    pos = c + dist(t) * Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    return pos, c


def shake(t):
    amp = 0.0
    for t0, a in SHAKES:
        if t >= t0:
            amp += a * math.exp(-(t - t0) * 12) * math.sin((t - t0) * 90)
    return amp


cam.rotation_mode = "QUATERNION"
for f in FR:
    t = tt(f)
    i = max(j for j, s in enumerate(SHOTS) if t >= s[0])
    pos, tgt = view(SHOTS[i], t)
    if i > 0 and SHOTS[i][1] > SHOTS[i][0]:
        k = ease_io(seg(t, SHOTS[i][0], SHOTS[i][1]))
        p0, t0 = view(SHOTS[i - 1], t)
        pos, tgt = p0.lerp(pos, k), t0.lerp(tgt, k)
    sh = shake(t)
    pos = pos + Vector((sh * 0.5, 0, sh))
    cam.location = pos
    cam.rotation_quaternion = (tgt - pos).to_track_quat("-Z", "Y")
    focus.location = tgt
    cam_data.lens = lens_at(t)
    cam_data.keyframe_insert("lens", frame=f)
    w_light.inputs["Strength"].default_value = SKY * (1 - on_floor(t))
    w_light.inputs["Strength"].keyframe_insert("default_value", frame=f)
    cam.keyframe_insert("location", frame=f)
    cam.keyframe_insert("rotation_quaternion", frame=f)
    focus.keyframe_insert("location", frame=f)

# a soft light riding with the camera on the way down, so he reads in the dark between the page
# and the floor (on him alone)
_fl = bpy.data.lights.new("FallKey", "AREA")
_fl.shape, _fl.size = "DISK", 0.3
_fl.color = lin("#fff6ee")[:3]
fall_key = link(bpy.data.objects.new("FallKey", _fl))
fall_key.parent = cam
fall_key.location = (-0.22, 0.2, 0.0)  # camera space: up and to the left of the lens
_toy = bpy.data.collections.new("toyOnly")
for _o in bpy.data.collections["ChrisToy"].all_objects:
    if _o.type == "MESH":
        _toy.objects.link(_o)
for _co in _toy.collection_objects:
    _co.light_linking.link_state = "INCLUDE"
fall_key.light_linking.receiver_collection = _toy
for t, v in ((E["fall"] + 0.1, 0.0), (E["fall"] + 0.4, 5.0), (E["sting"] + 0.2, 5.0), (E["sting"] + 0.7, 0.0)):
    _fl.energy = v
    _fl.keyframe_insert("energy", frame=F(t))

# straight lines between the per-frame keys of his root and the camera: Bezier curves through
# them overshot at a sudden stop (his landing on the I, at about 10 m/s), and the motion blur,
# which samples between frames, drew him dipping into the letter and back: a smear
from bpy_extras import anim_utils  # noqa: E402


def linear_keys(id_, paths=None):
    ad = id_.animation_data
    bag = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot) if ad and ad.action else None
    for fc in (bag.fcurves if bag else []):
        if paths is None or fc.data_path in paths:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


linear_keys(rig, ("location", "rotation_euler", "scale"))
linear_keys(cam)
linear_keys(focus)

# ── the glint on his glasses, with the stinger ─────────────────────────────
glint_mat = material("glint", "#ffffff", emit="#ffffff", strength=40)
glint = link(bpy.data.objects.new("glint", None))
for i, (sx, sz) in enumerate(((0.03, 0.002), (0.002, 0.03))):
    g = box(f"glintRay{i}", (sx, 0.0004, sz), 0.0003, glint_mat)
    g.parent = glint
GLINT_AT = Vector((-0.0195, -0.0265, 0.0848))  # his right rim's top outer corner, in the rest pose
head_bone = rig.data.bones["head"]
glint.scale = (1e-4,) * 3
for p in ("location", "scale"):
    glint.keyframe_insert(p, frame=1)
for f in range(F(E["sting"]) - 1, F(E["sting"] + 0.4) + 1):
    t = tt(f)
    scene.frame_set(f)
    m = rig.matrix_world @ rig.pose.bones["head"].matrix @ head_bone.matrix_local.inverted()
    glint.location = m @ GLINT_AT + (cam.location - m @ GLINT_AT).normalized() * 0.003
    s = math.sin(math.pi * seg(t, E["sting"] + 0.02, E["sting"] + 0.36)) ** 2
    glint.scale = (max(s, 1e-4),) * 3
    glint.rotation_euler = (0, math.radians(30 * seg(t, E["sting"], E["sting"] + 0.4)), 0)
    for p in ("location", "scale", "rotation_euler"):
        glint.keyframe_insert(p, frame=f)
