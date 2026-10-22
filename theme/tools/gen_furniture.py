"""Generate Agent Agency office furniture for Pixel Agents.

A mid-size regional paper company: bullpen desks with beige CRTs, a glass-walled
manager's office, a break room, a conference room and a paper warehouse - plus
a few desk-level nods (a "best boss" mug, a stapler in jello). Original art,
drawn procedurally; no show names, logos or likenesses.

Writes assets/furniture/<ID>/manifest.json + PNGs (docs/external-assets.md).

Usage: python gen_furniture.py
"""
import json
import os
import random

from pixpng import hex_to_rgba, write_png
from sprite import Sprite, asset, member, poly, write_preview

C = {k: hex_to_rgba(v) for k, v in {
    "out": "#2a2624", "out_w": "#4a3a2e",
    "lam": "#d4cfc4", "lam_d": "#aaa498", "lam_dd": "#86807a", "metal": "#9aa0a8", "metal_d": "#6e747c",
    "metal_l": "#c8ccd0", "black": "#2e2e32", "black_l": "#4a4a50",
    "beige": "#d8ceb4", "beige_d": "#b0a68c", "screen": "#2a4a8a", "text": "#9fd0ff", "glow": "#cfe8ff",
    "wood": "#a8743f", "wood_l": "#c8955a", "wood_d": "#7d5230",
    "glass": "#a8d0e8a0", "glass_l": "#e8f6ffc0", "alu": "#c8ccd0",
    "fabric": "#8a8f98", "fabric_d": "#6e737c",
    "white": "#f2f2ee", "white_d": "#cfcfc8", "red": "#c83a32", "blue": "#3a6ac8", "jug": "#8ac8f0a8",
    "green": "#4e8a32", "green_l": "#6fae45", "green_d": "#336222", "brown": "#7a5230",
    "cork": "#c8a070", "paper": "#f4f4f0", "note_y": "#f2e070", "note_p": "#f0a0c0", "note_b": "#a0d0f0",
    "box": "#c89a62", "box_d": "#a07a48", "wrap": "#e8e8f0c0", "yellow": "#f2c230", "yellow_d": "#c89a1e",
    "gold": "#e8c045", "gold_d": "#a87e1e", "jello": "#f0d23ac0", "cake": "#f4e0c8", "icing": "#f08ab0",
    "sky": "#9cc8e8", "mountain": "#6a7a8a", "sun": "#f2d24b",
}.items()}
OUT = C["out"]


# ── Workstations ──────────────────────────────────────────────────

def desk():
    front = Sprite(48, 32)
    front.rect(1, 9, 46, 19, C["lam"])
    front.hline(1, 46, 9, C["white"])
    front.rect(1, 20, 46, 22, C["lam_d"])
    front.rect(33, 20, 45, 30, C["lam_d"])             # drawer pedestal
    for y in (23, 26):
        front.hline(34, 44, y, C["lam_dd"])
        front.rect(38, y + 1, 40, y + 1, C["metal_l"])
    front.rect(2, 23, 3, 30, C["metal_d"])               # leg
    front.outline(OUT)
    front.shadow(24, 30, 22, 2.5)

    side = Sprite(16, 64)
    side.rect(2, 6, 13, 52, C["lam"])
    side.vline(2, 6, 52, C["white"])
    side.rect(2, 53, 13, 55, C["lam_d"])
    side.rect(3, 56, 12, 62, C["lam_d"])
    side.hline(3, 12, 59, C["lam_dd"])
    side.outline(OUT)
    side.shadow(8, 62, 7, 2)
    manifest = {
        "id": "OFFICE_DESK", "name": "Office Desk", "category": "desks",
        "type": "group", "groupType": "rotation", "rotationScheme": "2-way",
        "canPlaceOnWalls": False, "canPlaceOnSurfaces": False, "backgroundTiles": 1,
        "members": [member("OFFICE_DESK_FRONT", 48, 32, 3, 2, orientation="front"),
                    member("OFFICE_DESK_SIDE", 16, 64, 1, 4, orientation="side")],
    }
    return manifest, {"OFFICE_DESK_FRONT": front, "OFFICE_DESK_SIDE": side}


def crt_pc():
    def monitor(screen_lines=None, on=False):
        s = Sprite(16, 32)
        s.rect(2, 8, 13, 19, C["beige"])                # CRT case
        s.rect(3, 9, 12, 17, C["beige_d"])
        s.rect(4, 10, 11, 16, C["screen"] if on else C["black"])
        for y, (x0, x1) in (screen_lines or []):
            s.hline(x0, x1, y, C["text"])
        if on:
            s.set(4, 10, C["glow"])
        s.rect(6, 20, 9, 21, C["beige_d"])               # stand
        s.rect(2, 23, 13, 25, C["beige"])                # keyboard
        for x in range(3, 13, 2):
            s.set(x, 24, C["beige_d"])
        s.rect(14, 24, 15, 25, C["beige"])               # mouse
        s.outline(OUT)
        return s

    frames = [
        [(11, (5, 9)), (13, (5, 10)), (15, (5, 7))],
        [(11, (5, 10)), (13, (5, 8)), (15, (5, 10))],
        [(11, (5, 8)), (13, (5, 10)), (15, (5, 9))],
    ]
    off = monitor()
    back = Sprite(16, 32)
    back.rect(2, 8, 13, 19, C["beige_d"])
    back.rect(4, 10, 11, 18, C["beige"])
    back.rect(6, 20, 9, 21, C["beige_d"])
    back.outline(OUT)
    side = Sprite(16, 32)
    side.rect(4, 8, 13, 19, C["beige"])
    side.rect(3, 9, 4, 18, C["black"])
    side.rect(7, 20, 9, 21, C["beige_d"])
    side.outline(OUT)
    sprites = {"CRT_PC_OFF": off, "CRT_PC_BACK": back, "CRT_PC_SIDE": side}
    for i, lines in enumerate(frames, 1):
        sprites[f"CRT_PC_ON_{i}"] = monitor(lines, on=True)
    manifest = {
        "id": "CRT_PC", "name": "CRT Computer", "category": "electronics",
        "type": "group", "groupType": "rotation", "rotationScheme": "3-way-mirror",
        "canPlaceOnWalls": False, "canPlaceOnSurfaces": True, "backgroundTiles": 1,
        "members": [
            {"type": "group", "groupType": "state", "orientation": "front", "members": [
                {"type": "group", "groupType": "animation", "state": "on",
                 "members": [member(f"CRT_PC_ON_{i}", 16, 32, 1, 2, frame=i - 1) for i in (1, 2, 3)]},
                member("CRT_PC_OFF", 16, 32, 1, 2, state="off"),
            ]},
            member("CRT_PC_BACK", 16, 32, 1, 2, orientation="back"),
            member("CRT_PC_SIDE", 16, 32, 1, 2, orientation="side", mirrorSide=True),
        ],
    }
    return manifest, sprites


def office_chair():
    """1x1 swivel chair (like the bundled bench), so seats sit right next to desks."""
    def base(s):
        s.vline(7, 11, 12, C["metal_d"])
        s.hline(4, 11, 13, C["metal_d"])
        for x in (4, 7, 11):
            s.set(x, 14, C["black"])

    front = Sprite(16, 16)                               # faces down: backrest behind
    base(front)
    front.rect(4, 1, 11, 7, C["black_l"])
    front.rect(3, 8, 12, 10, C["black"])
    front.rect(2, 7, 2, 9, C["black_l"])
    front.rect(13, 7, 13, 9, C["black_l"])
    front.outline(OUT)
    back = Sprite(16, 16)                                # faces up: backrest in front of the sitter
    base(back)
    back.rect(3, 4, 12, 6, C["black"])
    back.rect(4, 6, 11, 12, C["black_l"])
    back.hline(5, 10, 7, C["black"])
    back.outline(OUT)
    side = Sprite(16, 16)                                # faces right
    base(side)
    side.rect(3, 2, 5, 9, C["black_l"])
    side.rect(4, 8, 12, 10, C["black"])
    side.outline(OUT)
    manifest = {
        "id": "OFFICE_CHAIR", "name": "Office Chair", "category": "chairs",
        "type": "group", "groupType": "rotation", "rotationScheme": "3-way-mirror",
        "canPlaceOnWalls": False, "canPlaceOnSurfaces": False, "backgroundTiles": 0,
        "members": [member("OFFICE_CHAIR_FRONT", 16, 16, 1, 1, orientation="front"),
                    member("OFFICE_CHAIR_BACK", 16, 16, 1, 1, orientation="back"),
                    member("OFFICE_CHAIR_SIDE", 16, 16, 1, 1, orientation="side", mirrorSide=True)],
    }
    return manifest, {"OFFICE_CHAIR_FRONT": front, "OFFICE_CHAIR_BACK": back, "OFFICE_CHAIR_SIDE": side}


def cubicle_panel():
    s = Sprite(16, 32)
    s.rect(0, 12, 15, 28, C["fabric"])
    s.hline(0, 15, 12, C["alu"])
    s.hline(0, 15, 28, C["fabric_d"])
    for x in (0, 15):
        s.vline(x, 12, 30, C["alu"])
    return asset("CUBICLE_PANEL", "Cubicle Panel", "decor", 16, 32, 1, 2, bg=1), {"CUBICLE_PANEL": s}


def glass_wall():
    s = Sprite(16, 32)
    s.rect(0, 4, 15, 29, C["glass"])
    for x, y in ((3, 8), (4, 7), (5, 6), (11, 14), (12, 13)):
        s.set(x, y, C["glass_l"])
    s.hline(0, 15, 4, C["alu"])
    s.hline(0, 15, 29, C["alu"])
    s.hline(0, 15, 30, C["metal_d"])
    return asset("GLASS_WALL", "Glass Wall", "decor", 16, 32, 1, 2, bg=1), {"GLASS_WALL": s}


def glass_wall_v():
    """1x1 so a vertical run seals every tile."""
    s = Sprite(16, 16)
    s.rect(6, 0, 9, 15, C["glass"])
    s.vline(6, 0, 15, C["alu"])
    s.vline(9, 0, 15, C["alu"])
    s.set(7, 5, C["glass_l"])
    s.set(8, 4, C["glass_l"])
    return asset("GLASS_WALL_V", "Glass Wall (vertical)", "decor", 16, 16, 1, 1), {"GLASS_WALL_V": s}


# ── Office fixtures ───────────────────────────────────────────────

def filing_cabinet():
    s = Sprite(16, 32)
    s.rect(2, 8, 13, 30, C["metal"])
    s.hline(2, 13, 8, C["metal_l"])
    for y in (13, 18, 23):
        s.hline(2, 13, y, C["metal_d"])
    for y in (10, 15, 20, 25):
        s.rect(6, y, 9, y, C["metal_l"])
        s.rect(5, y + 1, 10, y + 1, C["paper"])            # drawer labels
    s.outline(OUT)
    s.shadow(7.5, 31, 7, 1)
    return asset("FILING_CABINET", "Filing Cabinet", "storage", 16, 32, 1, 2, bg=1), {"FILING_CABINET": s}


def water_cooler():
    s = Sprite(16, 32)
    s.disc(7.5, 8, 4, C["jug"], ry=5)                    # bottle
    s.rect(6, 12, 9, 13, C["jug"])
    s.rect(3, 14, 12, 30, C["white"])
    s.rect(3, 14, 12, 15, C["white_d"])
    s.set(5, 19, C["blue"])
    s.set(10, 19, C["red"])
    s.rect(5, 22, 10, 23, C["metal_d"])
    s.outline(OUT)
    s.set(6, 6, C["glass_l"])
    s.shadow(7.5, 31, 6, 1)
    return asset("WATER_COOLER", "Water Cooler", "decor", 16, 32, 1, 2, bg=1), {"WATER_COOLER": s}


def copier():
    s = Sprite(32, 32)
    s.rect(3, 12, 28, 29, C["white_d"])
    s.rect(3, 10, 28, 13, C["white"])                    # lid
    s.rect(20, 14, 26, 17, C["black"])                   # control panel
    s.set(21, 15, C["green_l"])
    s.set(23, 15, C["red"])
    s.rect(5, 18, 18, 20, C["paper"])                    # output tray
    for y in (22, 25):
        s.hline(4, 27, y, C["lam_dd"])                   # paper drawers
    s.outline(OUT)
    s.shadow(16, 30.5, 14, 1.5)
    return asset("COPIER", "Copier", "decor", 32, 32, 2, 2, bg=1), {"COPIER": s}


def vending_machine():
    s = Sprite(16, 48)
    s.rect(1, 10, 14, 46, C["red"])
    s.rect(3, 13, 10, 36, C["black"])                    # window
    colors = [C["yellow"], C["blue"], C["green_l"], C["icing"], C["white"]]
    for row, y in enumerate(range(15, 35, 5)):
        for x in range(4, 10, 2):
            s.rect(x, y, x + 1, y + 2, colors[(row + x) % len(colors)])
        s.hline(3, 10, y + 3, C["metal_d"])
    s.rect(11, 15, 13, 24, C["metal_l"])                 # keypad
    s.rect(4, 39, 10, 42, C["black"])                    # drop slot
    s.outline(OUT)
    s.shadow(7.5, 47, 7, 1)
    return asset("VENDING_MACHINE", "Vending Machine", "decor", 16, 48, 1, 3, bg=2), {"VENDING_MACHINE": s}


def fridge():
    s = Sprite(16, 48)
    s.rect(1, 10, 14, 46, C["white"])
    s.hline(1, 14, 22, C["white_d"])
    s.vline(12, 13, 19, C["metal_d"])                    # handles
    s.vline(12, 25, 33, C["metal_d"])
    for x, y, col in ((4, 14, C["note_y"]), (7, 15, C["note_p"]), (4, 27, C["note_b"])):
        s.rect(x, y, x + 2, y + 2, col)                  # magnets & notes
    s.outline(OUT)
    s.shadow(7.5, 47, 7, 1)
    return asset("FRIDGE", "Fridge", "decor", 16, 48, 1, 3, bg=2), {"FRIDGE": s}


def kitchen_counter():
    s = Sprite(32, 32)
    s.rect(1, 16, 30, 29, C["wood_l"])                   # cabinets
    s.rect(1, 14, 30, 16, C["lam"])                      # countertop
    s.vline(15, 17, 29, C["wood_d"])
    for x in (7, 22):
        s.rect(x, 21, x + 1, 22, C["metal_l"])
    s.rect(3, 6, 13, 13, C["black_l"])                   # microwave
    s.rect(4, 7, 10, 12, C["black"])
    s.rect(11, 8, 12, 11, C["green_l"])
    s.rect(19, 5, 25, 13, C["black"])                    # coffee maker
    s.rect(20, 10, 24, 13, C["brown"])
    s.outline(OUT)
    s.shadow(16, 30.5, 14, 1.5)
    return asset("KITCHEN_COUNTER", "Kitchen Counter", "decor", 32, 32, 2, 2, bg=1), {"KITCHEN_COUNTER": s}


def break_table():
    s = Sprite(32, 32)
    s.disc(15.5, 18, 12, C["lam_d"], ry=6)
    s.disc(15.5, 17, 12, C["lam"], ry=5.5)
    s.rect(14, 23, 17, 29, C["metal_d"])
    s.hline(10, 21, 29, C["metal_d"])
    s.outline(OUT)
    s.shadow(16, 30.5, 10, 1.5)
    return asset("BREAK_TABLE", "Break Room Table", "desks", 32, 32, 2, 2, bg=1), {"BREAK_TABLE": s}


def conference_table():
    s = Sprite(64, 32)
    s.rect(2, 10, 61, 21, C["wood"])
    s.hline(2, 61, 10, C["wood_l"])
    s.rect(2, 22, 61, 24, C["wood_d"])
    for x in (4, 59):
        s.rect(x, 25, x + 1, 30, C["wood_d"])
    for x in (12, 28, 44):                               # papers + a speakerphone
        s.rect(x, 13, x + 4, 16, C["paper"])
    s.rect(30, 17, 33, 18, C["black"])
    s.outline(C["out_w"])
    s.shadow(32, 30, 30, 2)
    return asset("CONFERENCE_TABLE", "Conference Table", "desks", 64, 32, 4, 2, bg=1), {"CONFERENCE_TABLE": s}


def reception_desk():
    s = Sprite(48, 32)
    s.rect(1, 8, 46, 12, C["wood_l"])                    # raised counter
    s.rect(1, 13, 46, 29, C["wood"])
    for x in range(6, 44, 8):
        s.vline(x, 14, 28, C["wood_d"])
    s.rect(18, 6, 26, 9, C["paper"])                     # sign-in sheet
    s.hline(19, 25, 7, C["text"])
    s.rect(34, 5, 37, 8, C["black"])                     # phone
    s.outline(C["out_w"])
    s.shadow(24, 30.5, 22, 1.5)
    return asset("RECEPTION_DESK", "Reception Desk", "desks", 48, 32, 3, 2, bg=1), {"RECEPTION_DESK": s}


def couch():
    s = Sprite(32, 32)
    s.rect(2, 12, 29, 20, C["fabric_d"])                 # back
    s.rect(1, 20, 30, 27, C["fabric"])                   # seat
    s.rect(1, 15, 4, 27, C["fabric_d"])                  # arms
    s.rect(27, 15, 30, 27, C["fabric_d"])
    s.vline(15, 20, 26, C["fabric_d"])
    s.outline(OUT)
    s.shadow(16, 29.5, 14, 1.5)
    return asset("OFFICE_COUCH", "Couch", "decor", 32, 32, 2, 2, bg=1), {"OFFICE_COUCH": s}


# ── Walls ─────────────────────────────────────────────────────────

def whiteboard():
    s = Sprite(32, 32)
    s.rect(2, 6, 29, 24, C["white"])
    s.rect(2, 6, 29, 6, C["alu"])
    for x0, x1, y, col in ((5, 18, 10, C["blue"]), (5, 14, 13, C["red"]), (5, 20, 16, C["blue"]), (20, 26, 12, C["green"])):
        s.hline(x0, x1, y, col)
    s.rect(22, 15, 26, 19, C["blue"])                    # a hopeful chart
    s.rect(2, 25, 29, 26, C["alu"])                      # marker tray
    s.outline(OUT)
    return asset("WHITEBOARD_WALL", "Whiteboard", "wall", 32, 32, 2, 2, walls=True), {"WHITEBOARD_WALL": s}


def corkboard():
    s = Sprite(32, 32)
    s.rect(2, 8, 29, 24, C["cork"])
    for x, y, col in ((5, 10, C["note_y"]), (12, 12, C["paper"]), (19, 10, C["note_p"]), (24, 15, C["note_b"]),
                      (7, 17, C["paper"]), (15, 18, C["note_y"])):
        s.rect(x, y, x + 3, y + 3, col)
        s.set(x + 1, y, C["red"])
    s.outline(C["out_w"])
    return asset("CORKBOARD", "Corkboard", "wall", 32, 32, 2, 2, walls=True), {"CORKBOARD": s}


def motivational_poster():
    s = Sprite(16, 32)
    s.rect(2, 6, 13, 26, C["black"])                     # frame
    s.rect(3, 7, 12, 19, C["sky"])
    poly(s, [(3, 19), (6, 12), (8, 15), (10, 10), (13, 19)], C["mountain"])
    s.set(11, 9, C["sun"])
    s.hline(4, 11, 22, C["white"])                       # inspiring word
    s.hline(5, 10, 24, C["lam_dd"])
    s.outline(OUT)
    return asset("MOTIVATIONAL_POSTER", "Motivational Poster", "wall", 16, 32, 1, 2, walls=True), {"MOTIVATIONAL_POSTER": s}


def wall_clock():
    s = Sprite(16, 32)
    s.disc(7.5, 12, 5, C["white"])
    s.vline(7, 9, 12, C["black"])
    s.hline(7, 10, 12, C["black"])
    s.outline(OUT)
    return asset("OFFICE_CLOCK", "Wall Clock", "wall", 16, 32, 1, 2, walls=True), {"OFFICE_CLOCK": s}


def window_blinds():
    s = Sprite(32, 32)
    s.rect(2, 4, 29, 26, C["sky"])
    for y in range(5, 26, 2):
        s.hline(3, 28, y, C["white_d"])
    s.rect(2, 4, 29, 4, C["white"])
    s.vline(15, 4, 26, C["white"])
    s.outline(OUT)
    return asset("WINDOW_BLINDS", "Window with Blinds", "wall", 32, 32, 2, 2, walls=True), {"WINDOW_BLINDS": s}


def trophy_shelf():
    s = Sprite(32, 32)
    s.rect(1, 20, 30, 22, C["wood"])
    for x in (4, 11, 18, 25):                            # little gold award statues
        s.rect(x, 17, x + 3, 19, C["black_l"])
        s.vline(x + 1, 11, 16, C["gold"])
        s.vline(x + 2, 11, 16, C["gold_d"])
        s.disc(x + 1.5, 10, 1.5, C["gold"])
    s.outline(C["out_w"])
    return asset("AWARD_SHELF", "Awards Shelf", "wall", 32, 32, 2, 2, walls=True), {"AWARD_SHELF": s}


def party_banner():
    s = Sprite(32, 32)
    colors = [C["red"], C["yellow"], C["blue"], C["green_l"], C["icing"]]
    for i, x in enumerate(range(1, 31, 5)):
        sag = 3 - abs(i - 3)
        poly(s, [(x, 8 + sag), (x + 4, 8 + sag), (x + 2, 13 + sag)], colors[i % len(colors)])
    for x in range(0, 32):
        s.set(x, 8 + (3 - abs(x // 5 - 3)), C["out_w"])
    return asset("PARTY_BANNER", "Party Banner", "wall", 32, 32, 2, 2, walls=True), {"PARTY_BANNER": s}


# ── Plants ────────────────────────────────────────────────────────

def ficus(dying=False):
    rng = random.Random(77 if dying else 7)
    s = Sprite(16, 32)
    s.rect(4, 24, 11, 30, C["box_d"] if dying else C["brown"])   # pot
    s.hline(3, 12, 24, C["wood_d"])
    leaf = C["box"] if dying else C["green"]
    leaf_l = C["yellow_d"] if dying else C["green_l"]
    if dying:
        s.vline(7, 14, 23, C["wood_d"])
        for x, y in ((5, 15), (9, 17), (6, 19), (10, 21)):
            s.set(x, y, leaf)
            s.set(x, y + 1, leaf_l)
    else:
        s.vline(7, 10, 23, C["wood_d"])
        for cx, cy, r in ((7.5, 10, 5), (4.5, 15, 3.5), (10.5, 15, 3.5)):
            s.disc(cx, cy, r, leaf)
        for _ in range(10):
            x, y = rng.randint(3, 12), rng.randint(6, 17)
            if s.px[y][x] == leaf:
                s.set(x, y, leaf_l)
    s.outline(OUT)
    s.shadow(7.5, 31, 5, 1)
    id_ = "SAD_PLANT" if dying else "FICUS"
    return asset(id_, "Sad Plant" if dying else "Ficus", "decor", 16, 32, 1, 2, bg=1), {id_: s}


def plant_ficus():
    return ficus()


def plant_sad():
    return ficus(dying=True)


# ── Warehouse ─────────────────────────────────────────────────────

def paper_boxes():
    s = Sprite(16, 32)
    for y0 in (20, 12):
        s.rect(1, y0, 14, y0 + 7, C["box"])
        s.hline(1, 14, y0, C["box_d"])
        s.rect(4, y0 + 3, 11, y0 + 4, C["paper"])        # label
    s.vline(7, 12, 27, C["box_d"])                       # tape
    s.outline(OUT)
    s.shadow(7.5, 30.5, 7, 1)
    return asset("PAPER_BOXES", "Paper Boxes", "storage", 16, 32, 1, 2, bg=1), {"PAPER_BOXES": s}


def paper_pallet():
    s = Sprite(32, 32)
    s.rect(2, 26, 29, 29, C["wood"])                     # pallet
    for x in (3, 15, 27):
        s.rect(x, 28, x + 1, 29, C["wood_d"])
    s.rect(3, 10, 28, 25, C["paper"])                    # reams
    for y in range(12, 25, 3):
        s.hline(3, 28, y, C["white_d"])
    s.rect(3, 10, 28, 25, C["wrap"])                     # shrink wrap sheen
    s.vline(8, 11, 24, C["white"])
    s.outline(OUT)
    s.shadow(16, 30.5, 14, 1.5)
    return asset("PAPER_PALLET", "Pallet of Paper", "decor", 32, 32, 2, 2, bg=1), {"PAPER_PALLET": s}


def warehouse_shelf():
    s = Sprite(32, 48)
    for x in (1, 30):
        s.rect(x, 4, x + 1, 46, C["blue"])
    for y in (16, 30, 44):
        s.rect(1, y, 31, y + 1, C["yellow_d"])
        for x in range(4, 28, 8):
            s.rect(x, y - 9, x + 6, y - 1, C["box"])
            s.hline(x, x + 6, y - 9, C["box_d"])
            s.rect(x + 2, y - 6, x + 4, y - 5, C["paper"])
    s.outline(OUT)
    s.shadow(16, 47, 14, 1)
    return asset("WAREHOUSE_SHELF", "Warehouse Shelf", "decor", 32, 48, 2, 3, bg=2), {"WAREHOUSE_SHELF": s}


def forklift():
    s = Sprite(32, 32)
    s.rect(10, 12, 25, 25, C["yellow"])                  # body
    s.rect(12, 6, 13, 13, C["black"])                    # cage
    s.rect(22, 6, 23, 13, C["black"])
    s.hline(12, 23, 6, C["black"])
    s.rect(15, 14, 20, 18, C["black_l"])                 # seat
    s.vline(5, 4, 27, C["metal_d"])                      # mast
    s.vline(7, 4, 27, C["metal_d"])
    s.rect(1, 25, 8, 26, C["metal"])                     # forks
    for x in (13, 22):
        s.disc(x, 26, 2.5, C["black"])
    s.outline(OUT)
    s.shadow(15, 30, 13, 1.5)
    return asset("FORKLIFT", "Forklift", "decor", 32, 32, 2, 2, bg=1), {"FORKLIFT": s}


# ── Desk-level nods (sit on desks and tables) ─────────────────────

def surface_item(id_, name, draw):
    s = Sprite(16, 16)
    draw(s)
    s.outline(OUT)
    return asset(id_, name, "misc", 16, 16, 1, 1, surfaces=True), {id_: s}


def best_boss_mug():
    def draw(s):
        s.rect(5, 6, 10, 12, C["white"])
        s.rect(11, 7, 12, 10, C["white"])                # handle
        s.set(11, 8, (0, 0, 0, 0))
        s.hline(6, 9, 8, C["black"])                     # "WORLD'S BEST..."
        s.hline(6, 9, 10, C["red"])
    return surface_item("BEST_BOSS_MUG", "World's Best Boss Mug", draw)


def jello_stapler():
    def draw(s):
        s.rect(3, 6, 12, 12, C["jello"])
        s.rect(5, 8, 10, 9, C["black"])                  # a stapler, suspended
        s.rect(5, 10, 10, 10, C["metal_d"])
        s.set(4, 7, C["glass_l"])
    return surface_item("JELLO_STAPLER", "Stapler in Jello", draw)


def teapot():
    def draw(s):
        s.disc(7.5, 9.5, 3.5, C["white"], ry=3)
        s.rect(6, 5, 9, 6, C["white_d"])
        s.rect(11, 8, 13, 9, C["white"])                 # spout
        s.rect(2, 8, 3, 10, C["white"])                  # handle
        s.set(7, 9, C["note_b"])
    return surface_item("TEAPOT", "Teapot", draw)


def birthday_cake():
    def draw(s):
        s.rect(3, 8, 12, 12, C["cake"])
        s.hline(3, 12, 8, C["icing"])
        for x in (5, 8, 11):
            s.vline(x, 5, 7, C["note_b"])
            s.set(x, 4, C["sun"])
    return surface_item("BIRTHDAY_CAKE", "Birthday Cake", draw)


def paper_stack():
    def draw(s):
        for i, y in enumerate((11, 9, 7)):
            s.rect(4 - i % 2, y, 11 - i % 2, y + 1, C["paper"])
            s.hline(4 - i % 2, 11 - i % 2, y + 1, C["white_d"])
    return surface_item("PAPER_STACK", "Paper Stack", draw)


# ── Party room (the annex, repurposed) ────────────────────────────

def party_table():
    s = Sprite(48, 32)
    s.rect(1, 10, 46, 19, C["white"])                    # tablecloth
    for x in range(1, 47, 4):
        s.vline(x, 19, 22, C["icing"])                   # scalloped skirt
        s.vline(x + 1, 19, 21, C["icing"])
    s.rect(1, 19, 46, 19, C["white_d"])
    s.rect(6, 9, 15, 15, C["cake"])                      # sheet cake
    s.hline(6, 15, 9, C["icing"])
    for x in (8, 11, 14):
        s.vline(x, 6, 8, C["note_b"])
        s.set(x, 5, C["sun"])
    s.disc(26, 13, 4.5, C["glass"], ry=3)                # punch bowl
    s.disc(26, 12.5, 3.5, C["red"], ry=2)
    for x in (34, 38, 42):                               # cups
        s.rect(x, 12, x + 2, 15, C["note_b"] if x != 38 else C["note_y"])
    s.outline(OUT)
    s.shadow(24, 30, 22, 2)
    return asset("PARTY_TABLE", "Party Table", "desks", 48, 32, 3, 2, bg=1), {"PARTY_TABLE": s}


def balloons():
    s = Sprite(16, 32)
    colors = [C["red"], C["yellow"], C["blue"], C["note_p"]]
    for i, (cx, cy) in enumerate(((5, 6), (10, 5), (7.5, 10), (12, 11))):
        s.vline(round(cx), round(cy) + 4, 27, C["lam_dd"])   # strings
    for i, (cx, cy) in enumerate(((5, 6), (10, 5), (7.5, 10), (12, 11))):
        s.disc(cx, cy, 3, colors[i], ry=3.6)
        s.set(round(cx) - 1, round(cy) - 2, C["white"])
    s.rect(6, 27, 9, 29, C["metal_d"])                   # weight
    s.outline(OUT)
    s.shadow(7.5, 30.5, 4, 1)
    return asset("BALLOONS", "Balloons", "decor", 16, 32, 1, 2, bg=1), {"BALLOONS": s}


def gift_pile():
    s = Sprite(16, 16)
    for x0, y0, w, h, col in ((1, 8, 7, 6, C["blue"]), (8, 9, 6, 5, C["red"]), (4, 3, 6, 5, C["green_l"])):
        s.rect(x0, y0, x0 + w - 1, y0 + h - 1, col)
        s.vline(x0 + w // 2, y0, y0 + h - 1, C["yellow"])    # ribbon
        s.hline(x0, x0 + w - 1, y0 + h // 2, C["yellow"])
    s.set(6, 2, C["yellow"])
    s.set(8, 2, C["yellow"])
    s.outline(OUT)
    s.shadow(7.5, 14.5, 7, 1.2)
    return asset("GIFT_PILE", "Pile of Presents", "decor", 16, 16, 1, 1), {"GIFT_PILE": s}


# ── Warehouse hoops ───────────────────────────────────────────────

def basketball_hoop():
    s = Sprite(16, 48)
    s.rect(7, 14, 8, 44, C["metal_d"])                  # pole
    s.rect(4, 44, 11, 46, C["black"])                   # weighted base
    s.rect(1, 2, 14, 12, C["white"])                    # backboard
    s.rect(5, 5, 10, 9, (0, 0, 0, 0))
    s.rect(5, 5, 10, 9, C["white"])
    for x0, y0, x1, y1 in ((5, 5, 10, 5), (5, 9, 10, 9)):
        s.hline(x0, x1, y0, C["red"])
    s.vline(5, 5, 9, C["red"])
    s.vline(10, 5, 9, C["red"])
    s.hline(4, 11, 12, C["red"])                        # rim
    for x in (5, 7, 9, 11):                             # net
        s.vline(x, 13, 15, C["white_d"])
    s.outline(OUT)
    s.shadow(7.5, 47, 5, 1)
    return asset("BASKETBALL_HOOP", "Basketball Hoop", "decor", 16, 48, 1, 3, bg=2), {"BASKETBALL_HOOP": s}


def court_lines():
    """Painted half-court markings: a walk-over decal (every row is background)."""
    w, h = 96, 48
    s = Sprite(w, h)
    paint = (238, 238, 230, 150)
    s.rect(0, 1, w - 1, 1, paint)                       # sidelines
    s.rect(0, h - 2, w - 1, h - 2, paint)
    s.vline(0, 1, h - 2, paint)                         # half-court line
    lane_x0 = w - 34
    s.rect(lane_x0, 14, w - 1, 14, paint)               # the lane (key)
    s.rect(lane_x0, 33, w - 1, 33, paint)
    s.vline(lane_x0, 14, 33, paint)
    for y in range(4, h - 4):                           # three-point arc
        dy = (y - 23.5) / 20
        if abs(dy) <= 1:
            x = round(w - 1 - 46 * (1 - dy * dy) ** 0.5)
            s.set(x, y, paint)
    for y in range(17, 31):                             # free-throw circle
        dy = (y - 23.5) / 7
        if abs(dy) <= 1:
            s.set(round(lane_x0 - 7 * (1 - dy * dy) ** 0.5), y, paint)
    return asset("COURT_LINES", "Court Lines", "decor", w, h, 6, 3, bg=3), {"COURT_LINES": s}


def basketball():
    s = Sprite(16, 16)
    s.disc(7.5, 10, 3, hex_to_rgba("#e0782a"))
    s.vline(7, 7, 13, C["black"])
    s.hline(5, 10, 10, C["black"])
    s.outline(OUT)
    s.shadow(7.5, 13.5, 3, 0.8)
    return asset("BASKETBALL", "Basketball", "decor", 16, 16, 1, 1, bg=1), {"BASKETBALL": s}


# ── More office nods ──────────────────────────────────────────────

def pretzel_cart():
    s = Sprite(32, 32)
    s.rect(3, 14, 28, 26, C["red"])                     # cart body
    s.rect(3, 14, 28, 15, C["white"])
    s.rect(5, 6, 26, 13, C["glass"])                    # display case
    s.rect(5, 6, 26, 6, C["alu"])
    for x in (8, 15, 22):                               # pretzels
        s.disc(x + 1, 10, 2.5, hex_to_rgba("#b8702a"), ry=2)
        s.set(x + 1, 10, C["glass"][:3] + (0,))
    for x in (6, 25):
        s.disc(x, 27, 2, C["black"])                    # wheels
    s.hline(1, 4, 18, C["metal_d"])                     # push bar
    s.outline(OUT)
    s.shadow(16, 30, 13, 1.5)
    return asset("PRETZEL_CART", "Pretzel Cart", "decor", 32, 32, 2, 2, bg=1), {"PRETZEL_CART": s}


def candy_bowl():
    def draw(s):
        s.disc(7.5, 10, 4.5, C["glass"], ry=3)
        for x, y, col in ((6, 9, C["red"]), (8, 10, C["yellow"]), (9, 8, C["blue"]), (5, 11, C["green_l"])):
            s.set(x, y, col)
    return surface_item("CANDY_BOWL", "Candy Bowl", draw)


def bobblehead():
    def draw(s):
        s.rect(6, 11, 9, 13, C["black_l"])               # base
        s.rect(6, 8, 9, 10, C["yellow_d"])               # body
        s.disc(7.5, 5.5, 2.8, C["cake"])                 # big head
        s.hline(6, 9, 3, C["brown"])
        s.set(6, 5, C["black"])
        s.set(9, 5, C["black"])
    return surface_item("BOBBLEHEAD", "Bobblehead", draw)


def beet_crate():
    s = Sprite(16, 16)
    s.rect(1, 6, 14, 14, C["wood"])
    s.hline(1, 14, 10, C["wood_d"])
    for x in (3, 7, 11):                                # beets peeking out
        s.disc(x + 1, 5, 2, hex_to_rgba("#8a1e3e"))
        s.set(x + 1, 2, C["green_l"])
        s.set(x + 2, 2, C["green"])
    s.outline(OUT)
    s.shadow(7.5, 15, 7, 1)
    return asset("BEET_CRATE", "Crate of Beets", "storage", 16, 16, 1, 1), {"BEET_CRATE": s}


def dart_board():
    s = Sprite(16, 32)
    s.disc(7.5, 12, 6, C["black"])
    s.disc(7.5, 12, 4.5, C["red"])
    s.disc(7.5, 12, 3, C["paper"])
    s.disc(7.5, 12, 1.5, C["green"])
    s.set(9, 11, C["yellow"])                           # a dart
    s.set(10, 10, C["yellow"])
    s.outline(OUT)
    return asset("DART_BOARD", "Dart Board", "wall", 16, 32, 1, 2, walls=True), {"DART_BOARD": s}


def employee_plaque():
    s = Sprite(16, 32)
    s.rect(2, 6, 13, 22, C["wood"])
    s.rect(4, 8, 11, 15, C["white"])                    # photo
    s.disc(7.5, 11, 2, C["cake"])
    s.rect(5, 14, 10, 15, C["blue"])
    s.rect(4, 17, 11, 19, C["gold"])                    # brass nameplate
    s.outline(C["out_w"])
    return asset("EMPLOYEE_PLAQUE", "Employee of the Month", "wall", 16, 32, 1, 2, walls=True), {"EMPLOYEE_PLAQUE": s}


ITEMS = [desk, crt_pc, office_chair, cubicle_panel, glass_wall, glass_wall_v,
         filing_cabinet, water_cooler, copier, vending_machine, fridge, kitchen_counter, break_table,
         conference_table, reception_desk, couch,
         whiteboard, corkboard, motivational_poster, wall_clock, window_blinds, trophy_shelf, party_banner,
         plant_ficus, plant_sad, paper_boxes, paper_pallet, warehouse_shelf, forklift,
         best_boss_mug, jello_stapler, teapot, birthday_cake, paper_stack,
         party_table, balloons, gift_pile,
         basketball_hoop, court_lines, basketball, pretzel_cart, candy_bowl, bobblehead, beet_crate,
         dart_board, employee_plaque]


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base = os.path.join(root, "assets", "furniture")
    preview = []
    for item in ITEMS:
        manifest, sprites = item()
        folder = os.path.join(base, manifest["id"])
        os.makedirs(folder, exist_ok=True)
        for name, sprite in sprites.items():
            write_png(os.path.join(folder, f"{name}.png"), sprite.px)
        with open(os.path.join(folder, "manifest.json"), "w") as f:
            json.dump(manifest, f, indent=2)
        seen = []
        for sp in sprites.values():
            if sp not in seen:
                seen.append(sp)
        preview.extend(seen)
        print(f"{manifest['id']:<20} {manifest['category']:<12} {len(sprites)} sprite(s)")
    os.makedirs(os.path.join(root, "preview"), exist_ok=True)
    write_preview(os.path.join(root, "preview", "furniture.png"), preview, scale=4, bg=(150, 156, 168, 255))
    print("preview -> preview/furniture.png")


if __name__ == "__main__":
    main()
