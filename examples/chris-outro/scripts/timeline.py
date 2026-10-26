"""The outro's clock and layout: when everything happens and where it stands.

Times are film seconds; the music ("Funky Groove Stomp", 118.8 BPM, its first
beat at 0.108 s) starts at SONG_AT. Units: metres, Blender axes (+z up; the
phone faces -y). The toy is 120 mm tall; the iPhone 18 Pro is four times its
real size, so it stands like a tower about five toys high.
"""
FPS = 30
SONG_AT = 1.2  # film time of the song's start
BEAT = 0.505
BAR = 4 * BEAT
FIRST = 0.108  # the song's first beat


# The picture runs on an even grid of film beats; the music is re-cut to it (the user's calls,
# 2026-10-24): film beats play these song beats, in order (end exclusive). The profile's bar
# loses two (9, 10) and the avatar's swell two (13, 14); bar 6 (20-23) plays twice, so the name
# can push out slowly; then the song runs on to its end, its stinger (song beat 36) on film beat 36.
EDL = [(0, 9), (11, 13), (15, 24), (20, 44)]


def beat(n):
    """Film time of film beat n (0 = the first beat, the brass hit)."""
    return SONG_AT + FIRST + n * BEAT


def bar(n):
    """Film time of film bar n's downbeat (1 = the first)."""
    return beat(4 * (n - 1))


EV = {
    "sink": 0.0,  # the 4S of the Tim film sinks back into the dark
    "pop": beat(0),  # the brass hit: the iPhone 18 Pro springs up
    "groove": beat(2),  # the band comes in: it settles, its screen wakes on the home screen
    "push": bar(2),  # in on the X icon
    "tap": beat(6),  # the icon presses in
    "launch": beat(6) + 0.08,  # and opens full screen
    "profile": bar(3),  # his profile: held a second
    "bulge": beat(10),  # the avatar swells and wobbles, a second
    "glint": beat(11) - 0.15,
    "toy": beat(12),  # it pops into the toy
    # the handle's letters (the user's wife's idea, 2026-10-24): the page blows up around him
    # till its type is as big as the name on the floor (he is smaller than a letter, as there),
    # he drops onto @ChrisHKAI and its letters push out under him, black as printed, the C first
    "zoom": beat(12.2),
    "zoomed": beat(13.3),
    "stomp": beat(14),
    "hops": beat(23),  # three hops on the C: it turns white, gives a little, then more, then goes;
    # then a letter a beat, each turning white under him (as CLAWD's turn orange) and falling as he leaves it
    "fall": beat(34),  # the I has gone from under him: a moment hanging in the air, then down the page and on through the dark
    "sting": beat(36),  # the stinger (song 18.288): he lands on the I, the name whole on the floor; a point, a wink, the glint
    "end": beat(36) + 4.0,  # hold four seconds on the card (the user's call: two were too quick)
}
DURATION = round(EV["end"] * FPS) / FPS
FRAMES = round(DURATION * FPS)


def frame(t):
    return int(round(t * FPS)) + 1


LETTERS = "ChrisHKAI"
# they push out of the page: the C just ahead of him, filling the frame, there to land on; then
# a letter a beat, each slowly, the camera gliding along with them (the user's call: slow enough
# to read each; 2026-10-24), and a hold on the whole name
# their pace: the beats from his landing to the h, and between each letter and the next
# (OUTRO_PACE in the environment tries another; a beat each was too slow, half a beat too quick)
PACES = {
    "1": [1] * 8,
    "3/4": [0.75] * 8,
    "2/3": [2 / 3] * 8,
    "1/2": [0.5] * 8,
    "slowfast": [1, 1, 0.75, 0.75, 0.75, 0.5, 0.5, 0.5],  # C h r slow, then quicker to the I
}
PACE = __import__("os").environ.get("OUTRO_PACE", "3/4")  # the user's pick (A), 2026-10-24
_gaps = PACES[PACE]
PUSH = [beat(14) - 0.45] + [beat(14 + sum(_gaps[:k + 1])) for k in range(8)]
PUSH_DUR = [0.45] + [min(0.6, 1.2 * g * BEAT) for g in _gaps]  # how long each takes to come out
RELEASE = PUSH  # (scripts/strip.py)
# the floor lies below the blown-up page (which goes dark and away as he falls past it)
FLOOR_Z = -2.5
C_HOPS = [23, 24, 25]  # his landings on the C (beats): the third, it gives way and he springs to the h
STEP_BEATS = list(range(26, 34))  # his landings on h r i s H K A I
# each falls as he kicks off it for the next (the C on its third landing, the I half a beat after he lands)
FALL = [beat(25)] + [beat(n + 1) - 0.34 for n in STEP_BEATS[:-1]] + [beat(33.5)]
LAND = [t + 0.8 for t in FALL]  # and lands on the floor, out of sight, in its place in the name

# ── layout (m) ──────────────────────────────────────────────────────────────
K = 4.0  # the phone's scale
PHONE = {"w": 0.0719 * K, "h": 0.1500 * K, "d": 0.00875 * K, "r": 0.0122 * K}
SCREEN = {"w": 0.0666 * K, "h": 0.1448 * K, "r": 0.0105 * K}
UI = {"w": 1206, "h": 2622}  # the screen's pixels (402 x 874 points at 3x)
PX = SCREEN["w"] / UI["w"]  # metres per screen pixel
# the phone floats in the air above the floor, its screen to -y, centred on x = 0
LIFT = 2.0  # the phone floats this high above the floor (its bottom): out of sight of the floor
PHONE_AT = (0.0, 0.0, PHONE["h"] / 2 + LIFT)
SCREEN_Y = -PHONE["d"] / 2  # the glass's front


def ui_to_world(x, y, lift=0.0):
    """A point on the screen given in screen pixels (from the top left) -> world."""
    return (
        PHONE_AT[0] + (x - UI["w"] / 2) * PX,
        SCREEN_Y - lift,
        PHONE_AT[2] + (UI["h"] / 2 - y) * PX,
    )


# the letters stand on the floor in front of the phone; the C's left edge just
# right of where he falls. Smooth enamel, like the toy, all in his soft white
# (characters/chris-toy/chris.py; the user's pick, 2026-10-23), round bevels
# 0.22 / 0.08 / 0.0065 at first; cut by 32% so he stands about a letter tall and
# reads in the end card (the user's pick, 2026-10-24: build/research/toy-size.jpg)
LETTER = {"cap": 0.15, "depth": 0.0475, "y": -0.15, "bevel": 0.0044}
# ── the floor's look: CLAWD's, all of it (reference/clawd-pixar/prompt.pdf; the
# user's call, 2026-10-24: "follow all of its design"), its sizes scaled to our word
# the letters' face (`--font` in scripts/scene.py tries another; build/fonts from scripts/fonts.py)
FONTS = {
    "archivo": "assets/archivo-black/ArchivoBlack-Regular.ttf",  # CLAWD's heavy grotesque
    "sfheavy": "build/fonts/SFPro-Heavy.ttf",
    "sfbold": "build/fonts/SFPro-Bold.ttf",
    "helvetica": "build/fonts/HelveticaNeue-Bold.ttf",
    "avenir": "build/fonts/AvenirNext-Heavy.ttf",
    "avenirbold": "build/fonts/AvenirNext-Bold.ttf",
    "din": "build/fonts/DINAlternate-Bold.ttf",
}
FONT = "sfheavy"  # the user's pick, 2026-10-24: the clearest, and the X profile's own family
CLAWD = {
    "depth": 0.16 / 0.42,  # its letters' depth, of their height
    "word": 2.36,  # its word's width on the end card (m): its floor's distances scale by ours to it
    "floor": {"albedo": 0.15, "fade": (1.1, 3.8), "rough": 0.32},  # satin, fading to black: no horizon
    "lens": 35,  # mm, full frame, low and centred
    "eye": 0.4 / 0.42,  # the camera's height, of the letters'
    # measured on its frames (build/research/spacing/clawd-*.png): to match, not to set
    "measured": {"p99": (219, 233), "clipped": 0.0, "floorByWord": (160, 200), "plasterFront": (228, 227, 223)},
}
# the letters' colour schemes (Chris, HKAI): `--letters` picks one in scripts/scene.py
PALETTES = {
    "white": ["#F2F2F0"] * 9,  # PIXAR's white: its lit fronts measure (228, 227, 223), near neutral
    "cream": ["#E8E6E1"] * 9,  # the first white: it read beige under the warm key (the user's no, 2026-10-24)
    "marigold": ["#E6A23C"] * 9,  # warm against his blue tee (cobalt + marigold/mustard)
    "orange": ["#D9673A"] * 9,  # burnt orange: blue's complement, earthy not bright
    "whiteGold": ["#E8E6E1"] * 5 + ["#E6A23C"] * 4,
    "whiteBlue": ["#E8E6E1"] * 5 + ["#1767EC"] * 4,  # the first try: the user's no (2026-10-23)
}
LETTER_COLOR = PALETTES["white"]
# pure black, as the handle prints them, until he lands on them; and how much they shine then
# (`--ink` in scripts/scene.py tries another): "chanel" is the jet black of a printed logo
INKS = {"soft": ("#050505", 0.08, 0.45), "chanel": ("#000000", 0.02, 0.3)}
LETTER_INK, INK_SHINE, INK_ROUGH = INKS["chanel"]
# how the letters are spaced (`--spacing` picks one in scripts/scene.py): "font" sets
# them on SF Pro's own side bearings, as its designers spaced it (straight stems get
# the most air, rounds less, diagonals tuck in), the bevel's growth given back,
# plus `track` x the cap height between every pair; "box", the first try: a fixed
# 1 cm between the letters' boxes, which crammed H K and left A I wide open
SPACINGS = {
    "box": {"mode": "box"},
    "font": {"mode": "font", "track": 0.0},
    "font5": {"mode": "font", "track": 0.05},
    "font10": {"mode": "font", "track": 0.10},
}
# opened 10% (the user's D, 2026-10-23): set tight, the 3D letters' sides ran them together
SPACING = SPACINGS["font10"]
# his hops along the letter tops after he lands on the C: one per beat, the I on the stinger
HOP_BEATS = list(range(29, 37))
