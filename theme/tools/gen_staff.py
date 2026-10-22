"""Generate the Agent Agency office staff sprite sheets for Pixel Agents.

Output matches the Pixel Agents character format (core/src/assets/constants.ts):
112x96 PNG = 3 direction rows (down, up, right) x 7 frames of 16x32.
Frames 0-2 walk, 3-4 typing, 5-6 reading (a sheet of paper).

Six original office archetypes for agents (intern, salesperson, receptionist,
accountant, warehouse, HR) plus the boss NPC as the last sheet, drawn procedurally. Inspired by the feel of a TV paper-company
office, not by any show's characters, actors or branding.

Usage: python gen_staff.py [out_dir]
"""
import os
import sys

from pixpng import hex_to_rgba, write_png

W, H = 16, 32
FRAMES = 7
DIRS = ("down", "up", "right")
TRANSPARENT = (0, 0, 0, 0)


def R(pad, content):
    """One 16-px grid row: `pad` transparent cells, then content, right-padded."""
    row = "." * pad + content
    assert len(row) <= W, row
    return row + "." * (W - len(row))


class Canvas:
    def __init__(self):
        self.px = [[None] * W for _ in range(H)]

    def get(self, x, y):
        return self.px[y][x] if 0 <= x < W and 0 <= y < H else None

    def set(self, x, y, code):
        if 0 <= x < W and 0 <= y < H:
            self.px[y][x] = code

    def blit(self, rows, x0=0, y0=0, remap=None):
        for dy, row in enumerate(rows):
            for dx, code in enumerate(row):
                if code == ".":
                    continue
                if remap:
                    code = remap.get(code, code)
                self.set(x0 + dx, y0 + dy, code)

    def shape(self, cells):
        """Draw {(x, y): code} cells and auto-outline them."""
        for (x, y), code in cells.items():
            self.set(x, y, code)
        for x, y in cells:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (nx, ny) not in cells:
                    self.set(nx, ny, "o")


# --- Body templates ---------------------------------------------------------
# Codes: o outline, e eye, s/S skin, h/H hair, t/T torso, r sleeve, b belt,
# p/P legs, f boots, a/A gear, m gear highlight, c accent, g beard,
# w parchment, l ink.

HEAD_Y = 8
HEAD = {
    "down": [
        R(5, "oooooo"),
        R(4, "ohhhhhho"),
        R(3, "ohhhhhhhho"),
        R(3, "ohhhhhhhho"),
        R(3, "ohssssssho"),
        R(3, "o" + "s" * 8 + "o"),
        R(3, "o" + "sesssses" + "o"),
        R(3, "o" + "s" * 8 + "o"),
        R(3, "oS" + "s" * 6 + "So"),
        R(4, "o" + "S" * 6 + "o"),
        R(5, "oooooo"),
    ],
    "up": [
        R(5, "oooooo"),
        R(4, "ohhhhhho"),
        *[R(3, "o" + "h" * 8 + "o")] * 6,
        R(3, "oH" + "h" * 6 + "Ho"),
        R(4, "o" + "H" * 6 + "o"),
        R(5, "oooooo"),
    ],
    "right": [
        R(5, "ooooooo"),
        R(4, "o" + "h" * 7 + "o"),
        R(4, "o" + "h" * 7 + "o"),
        R(4, "o" + "h" * 7 + "o"),
        R(4, "ohhhhssso"),
        R(4, "ohhhsssso"),
        R(4, "ohhssseso"),
        R(4, "ohSssssso"),
        R(4, "oHssssss" + "o"),
        R(5, "oSSSSSo"),
        R(6, "ooooo"),
    ],
}

TORSO_Y = 19
TORSO = {
    "down": [
        R(3, "o" + "t" * 8 + "o"),
        R(3, "o" + "t" * 8 + "o"),
        R(3, "oT" + "t" * 6 + "To"),
        R(3, "oT" + "t" * 6 + "To"),
        R(3, "o" + "b" * 8 + "o"),
        R(3, "o" + "p" * 8 + "o"),
    ],
    "right": [
        R(5, "o" + "t" * 5 + "o"),
        R(5, "o" + "t" * 5 + "o"),
        R(5, "oT" + "t" * 4 + "o"),
        R(5, "oT" + "t" * 4 + "o"),
        R(5, "o" + "b" * 5 + "o"),
        R(5, "o" + "p" * 5 + "o"),
    ],
}
TORSO["up"] = TORSO["down"]

LEG_Y = 25
LEG_L = [".oppo", ".oppo", ".oppo", ".oPpo", ".offo", "offfo", "ooooo"]
LEG_R = ["oppo.", "oppo.", "oppo.", "opPo.", "offo.", "offfo", "ooooo"]
LEG_SIDE = ["oppo.", "oppo.", "oppo.", "oPpo.", "offo.", "offfo", "ooooo"]
BACK_LEG = {"p": "P"}

ARM_Y = 18
ARM_L = [".o", "or", "or", "or", "or", "os", ".o"]
ARM_L_RAISED = [".o", "or", "or", "or", "os", ".o"]
ARM_R = [row[::-1] for row in ARM_L]
ARM_R_RAISED = [row[::-1] for row in ARM_L_RAISED]
NO_HAND = {"s": "r"}

ARM_SIDE = ["oro", "oro", "oro", "oro", "oso", ".o."]
ARM_SIDE_TYPE = [
    ["oro...", "oro...", "orooo.", "orrrso", "oooooo"],
    ["oro...", "orooo.", "orrrso", "oooooo"],
]


# --- Pose builders ----------------------------------------------------------

def draw_legs(c, d, frame):
    if d == "right":
        if frame == 0:
            c.blit(LEG_SIDE, 4, LEG_Y, BACK_LEG)
            c.blit(LEG_SIDE, 8, LEG_Y)
        elif frame == 2:
            c.blit(LEG_SIDE, 8, LEG_Y, BACK_LEG)
            c.blit(LEG_SIDE, 4, LEG_Y)
        else:
            c.blit(LEG_SIDE, 6, LEG_Y)
        return
    # Front/back stride: the forward leg lifts one pixel.
    c.blit(LEG_L, 3, LEG_Y - (1 if frame == 0 else 0))
    c.blit(LEG_R, 8, LEG_Y - (1 if frame == 2 else 0))


def draw_arms(c, d, frame):
    """Arms behind/at the body. Front-of-body items are drawn in draw_props."""
    if d == "right":
        if frame in (3, 4):
            c.blit(ARM_SIDE_TYPE[frame - 3], 7, TORSO_Y)
        elif frame in (5, 6):
            c.blit(ARM_SIDE_TYPE[0], 7, TORSO_Y)
        else:
            c.blit(ARM_SIDE, 7 + {0: 1, 2: -1}.get(frame, 0), TORSO_Y)
        return

    hide = NO_HAND if (d == "up" or frame >= 3) else None
    left_up = frame in (2, 3)    # walk swing / typing alternation
    right_up = frame in (0, 4)
    c.blit(ARM_L_RAISED if left_up else ARM_L, 1, ARM_Y, hide)
    c.blit(ARM_R_RAISED if right_up else ARM_R, 13, ARM_Y, hide)


def draw_props(c, d, frame):
    """Hands and held items in front of the body."""
    if d == "down" and frame in (3, 4):
        # Hands working on the desk, alternating.
        for x, raised in ((4, frame == 3), (10, frame == 4)):
            y = 22 if raised else 23
            c.blit(["ss", "oo"], x, y)
    elif d == "down" and frame in (5, 6):
        # Scroll held at the ends; the ink line moves as the page is read.
        c.blit(["oooooooo", "swwwwwws", "swwwwwws", "oooooooo"], 4, 20)
        c.blit(["ll"], *((6, 21) if frame == 5 else (8, 22)))
    elif d == "right" and frame in (5, 6):
        ink = ["owo", "olo", "owo", "olo"] if frame == 5 else ["olo", "owo", "olo", "owo"]
        c.blit(["ooo", *ink, "ooo"], 11, 18)
        c.set(11, 22, "s")


# --- Office wear --------------------------------------------------------------

def draw_tie(c, d):
    """White collar + tie down the shirt front (front view only)."""
    if d == "down":
        c.set(6, TORSO_Y, "n")
        c.set(9, TORSO_Y, "n")
        for y in range(TORSO_Y, TORSO_Y + 4):
            c.set(7, y, "k")
            c.set(8, y, "k")
        c.set(7, TORSO_Y + 4, "k")
    elif d == "right":
        c.set(10, TORSO_Y, "n")
        c.set(10, TORSO_Y + 1, "k")
        c.set(10, TORSO_Y + 2, "k")


def draw_jacket_opening(c, d):
    """Suit jacket lapels: a V of shirt showing at the front."""
    if d == "down":
        for y, (l, r) in ((TORSO_Y, (6, 9)), (TORSO_Y + 1, (7, 8))):
            for x in range(l, r + 1):
                if c.get(x, y) == "t":
                    c.set(x, y, "n")


def draw_glasses(c, d):
    eye_y = HEAD_Y + 6
    if d == "down":
        for x in (5, 10):
            c.set(x, eye_y, "q")
        for x in (4, 6, 9, 11):
            c.set(x, eye_y, "q")
        c.set(7, eye_y, "q")
        c.set(8, eye_y, "q")
    elif d == "right":
        c.set(10, eye_y, "q")
        c.set(11, eye_y, "q")
        c.set(9, eye_y, "q")


def draw_ponytail(c, d):
    if d == "up":
        c.shape({(7, HEAD_Y + 9): "h", (8, HEAD_Y + 9): "h", (7, HEAD_Y + 10): "h", (8, HEAD_Y + 10): "h",
                 (7, HEAD_Y + 11): "H", (8, HEAD_Y + 11): "H"})
    elif d == "right":
        c.shape({(4, HEAD_Y + 5): "h", (3, HEAD_Y + 6): "h", (3, HEAD_Y + 7): "h", (3, HEAD_Y + 8): "H"})
    else:
        # longer hair at the sides of the face
        for y in range(HEAD_Y + 4, HEAD_Y + 9):
            c.set(3, y, "h")
            c.set(12, y, "h")
        c.set(3, HEAD_Y + 9, "o")
        c.set(12, HEAD_Y + 9, "o")


def draw_bob(c, d):
    """Chin-length bob: hair covers the sides of the face."""
    if d == "down":
        for y in range(HEAD_Y + 4, HEAD_Y + 9):
            c.set(4, y, "h")
            c.set(11, y, "H")
    elif d == "right":
        for y in range(HEAD_Y + 4, HEAD_Y + 9):
            c.set(5, y, "H")


def draw_hardhat(c, d):
    off = 1 if d == "right" else 0
    cells = {}
    for x in range(4, 12):
        cells[(x + off, HEAD_Y)] = "a"
    for x in range(3, 13):
        cells[(x + off, HEAD_Y + 1)] = "a"
        cells[(x + off, HEAD_Y + 2)] = "A"
    for x in range(5, 11):
        cells[(x + off, HEAD_Y - 1)] = "a"
    c.shape(cells)
    c.set(6 + off, HEAD_Y, "m")


def draw_vest(c, d):
    """Hi-vis vest: orange body with two reflective stripes."""
    for y in range(TORSO_Y, TORSO_Y + 4):
        for x in range(16):
            if c.get(x, y) in ("t", "T"):
                c.set(x, y, "v" if c.get(x, y) == "t" else "V")
    for x in range(16):
        if c.get(x, TORSO_Y + 2) in ("v", "V"):
            c.set(x, TORSO_Y + 2, "y")


def draw_cardigan(c, d):
    """Open cardigan over a blouse: a strip of blouse down the middle."""
    if d == "down":
        for y in range(TORSO_Y, TORSO_Y + 4):
            c.set(7, y, "n")
            c.set(8, y, "n")
    elif d == "right":
        for y in range(TORSO_Y, TORSO_Y + 4):
            c.set(10, y, "n")


def bald_top(c, d):
    """Thinning on top: skin crown, hair only at the sides (front/side views)."""
    if d == "up":
        return
    for y in (HEAD_Y + 1, HEAD_Y + 2):
        for x in range(16):
            if c.get(x, y) == "h":
                c.set(x, y, "s")


def draw_lanyard(c, d):
    """Polo collar + an ID badge on a lanyard."""
    if d == "down":
        c.set(6, TORSO_Y, "c")
        c.set(9, TORSO_Y, "c")
        for i, y in enumerate(range(TORSO_Y, TORSO_Y + 2)):
            c.set(6 + i, y + 1, "k")
            c.set(9 - i, y + 1, "k")
        c.set(7, TORSO_Y + 3, "c")
        c.set(8, TORSO_Y + 3, "c")
    elif d == "right":
        c.set(10, TORSO_Y + 2, "c")


def draw_slick_hair(c, d):
    """Side-swept, a little too much product: a shine line across the top."""
    if d == "up":
        return
    y = HEAD_Y + 2
    xs = [x for x in range(16) if c.get(x, y) == "h"]
    for x in xs[1:-1:2]:
        c.set(x, y, "H")
    if d == "down":
        c.set(5, HEAD_Y + 4, "h")                      # swoop over the forehead
        c.set(6, HEAD_Y + 4, "h")


# --- Staff --------------------------------------------------------------------
# Original office archetypes. Not modelled on any show's characters or actors.

BASE = {
    "o": "#1e1a17", "e": "#1e1a17",
    "s": "#e8b48a", "S": "#c98d64",
    "w": "#f4f4f0", "l": "#8aa0c0",            # paper and its ruled lines
    "n": "#f2f2ee", "q": "#2a2a2e",
}

CHARACTERS = [
    {
        "name": "intern",
        "hair": ("#c89a5a", "#a07a42"),
        "extras": (draw_lanyard,),
        "colors": {
            "t": "#5a9a5e", "T": "#447a48", "r": "#5a9a5e", "b": "#3a3a3a",
            "p": "#b8a07a", "P": "#9a845e", "f": "#4a3424", "k": "#3a6ac8", "c": "#f2f2ee",
        },
    },
    {
        "name": "salesperson",
        "hair": ("#6b4a2b", "#4e351e"),
        "extras": (draw_tie, draw_glasses),
        "colors": {
            "t": "#9cc4e8", "T": "#7aa6d0", "r": "#9cc4e8", "b": "#3a3a3a",
            "p": "#4a4f5a", "P": "#383c45", "f": "#2a1e14", "k": "#2c3a5e",
        },
    },
    {
        "name": "receptionist",
        "hair": ("#a0522d", "#7a3c1e"),
        "extras": (draw_cardigan, draw_ponytail),
        "skin": ("#f0c8a0", "#d8a87e"),
        "colors": {
            "t": "#e89ab0", "T": "#cc7a94", "r": "#e89ab0", "b": "#cc7a94",
            "p": "#5a4a6a", "P": "#463858", "f": "#2a2228",
        },
    },
    {
        "name": "accountant",
        "hair": ("#9a9a9a", "#767676"),
        "extras": (bald_top, draw_glasses, draw_tie),
        "skin": ("#c68a5e", "#a86e46"),
        "colors": {
            "t": "#4e7a4e", "T": "#3a5e3a", "r": "#f2f2ee", "b": "#3a5e3a",
            "p": "#b8a07a", "P": "#9a845e", "f": "#3a2a1e", "k": "#6a3a3a",
        },
    },
    {
        "name": "warehouse",
        "hair": ("#2a1e14", "#1e140c"),
        "head_extra": draw_hardhat,
        "extras": (draw_vest,),
        "skin": ("#8d5a3a", "#6e4228"),
        "colors": {
            "t": "#8a8a8a", "T": "#6e6e6e", "r": "#8a8a8a", "b": "#3a3a3a",
            "p": "#3e5a8a", "P": "#2e4468", "f": "#4a3424",
            "a": "#f2c230", "A": "#c89a1e", "m": "#fff0a0",
            "v": "#f07a22", "V": "#c85e14", "y": "#e8f0f0",
        },
    },
    {
        "name": "hr",
        "hair": ("#5e4430", "#463220"),
        "extras": (draw_cardigan, draw_bob),
        "colors": {
            "t": "#c8b490", "T": "#a89470", "r": "#c8b490", "b": "#a89470",
            "p": "#7a6a52", "P": "#62543e", "f": "#2a2018",
        },
    },
    {
        # Last sheet = the boss NPC (agents are never dressed in it; see core agentPaletteCount).
        "name": "boss",
        "hair": ("#241a12", "#16100a"),
        "extras": (draw_jacket_opening, draw_tie, draw_slick_hair),
        "colors": {
            "t": "#26304e", "T": "#1a2238", "r": "#26304e", "b": "#1a2238",
            "p": "#26304e", "P": "#1a2238", "f": "#121212", "k": "#c8281e",
        },
    },
]


def render_frame(char, d, frame):
    c = Canvas()
    draw_legs(c, d, frame)
    c.blit(TORSO[d], 0, TORSO_Y)
    draw_arms(c, d, frame)
    c.blit(HEAD[d], 0, HEAD_Y)
    for extra in char.get("extras", ()):
        extra(c, d)
    if "head_extra" in char:
        char["head_extra"](c, d)
    draw_props(c, d, frame)
    return c


def palette_for(char):
    pal = dict(BASE)
    pal["h"], pal["H"] = char["hair"]
    if "skin" in char:
        pal["s"], pal["S"] = char["skin"]
    pal.update(char["colors"])
    return {k: hex_to_rgba(v) for k, v in pal.items()}


def render_sheet(char):
    pal = palette_for(char)
    sheet = [[TRANSPARENT] * (W * FRAMES) for _ in range(H * len(DIRS))]
    for di, d in enumerate(DIRS):
        for f in range(FRAMES):
            c = render_frame(char, d, f)
            for y in range(H):
                for x in range(W):
                    code = c.px[y][x]
                    if code is not None:
                        if code not in pal:
                            raise KeyError(f"{char['name']}: no color for code {code!r}")
                        sheet[di * H + y][f * W + x] = pal[code]
    return sheet


def write_preview(sheets, path, scale=5, bg="#6e7480"):
    bg_px = hex_to_rgba(bg)
    sw, sh = len(sheets[0][0]), len(sheets[0])
    gap = 4
    out_w = (sw + gap) * len(sheets) * scale
    out_h = sh * scale
    out = [[bg_px] * out_w for _ in range(out_h)]
    for i, sheet in enumerate(sheets):
        ox = i * (sw + gap) * scale
        for y in range(sh):
            for x in range(sw):
                px = sheet[y][x]
                if px[3] == 0:
                    continue
                for yy in range(scale):
                    row = out[y * scale + yy]
                    for xx in range(scale):
                        row[ox + x * scale + xx] = px
    write_png(path, out)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "assets", "characters")
    os.makedirs(out_dir, exist_ok=True)
    sheets = []
    for i, char in enumerate(CHARACTERS):
        sheet = render_sheet(char)
        write_png(os.path.join(out_dir, f"char_{i}.png"), sheet)
        sheets.append(sheet)
        print(f"char_{i}.png  {char['name']}")
    preview_dir = os.path.join(root, "preview")
    os.makedirs(preview_dir, exist_ok=True)
    write_preview(sheets, os.path.join(preview_dir, "characters.png"))
    print(f"preview -> {os.path.join(preview_dir, 'characters.png')}")


if __name__ == "__main__":
    main()
