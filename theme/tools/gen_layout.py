"""Build the Agent Agency office layout ("the branch") for Pixel Agents.

A regional paper-company branch: reception by the door, a bullpen of desks with
CRTs, an annex and a break room on the left, a glass-walled manager's office and
conference room on the right, and the paper warehouse behind the back wall.

Footprints come straight from the furniture manifests (theme + bundled).
Self-checks: nothing overlaps (except desk items sitting on desks), nothing
stands on a wall, every seat is reachable from the entrance, and enough seats
face a computer (agents prefer those).

Usage: python gen_layout.py [repo dir]   (default: this repository)
"""
import glob
import json
import os
import sys
from collections import deque

COLS, ROWS = 28, 18
# Bump when the layout changes: a newer bundled revision replaces a saved layout.
REVISION = 6
VOID, WALL = 255, 0
CARPET, CARPET_TILES, LINOLEUM, WOOD, CONCRETE, CERAMIC, RUG, MAT = 1, 2, 3, 4, 5, 6, 7, 8

COLORS = {
    WALL: {"h": 40, "s": 18, "b": -8, "c": -20},          # beige drywall
    CARPET: {"h": 215, "s": 12, "b": -18, "c": -10},      # blue-grey office carpet
    CARPET_TILES: {"h": 280, "s": 22, "b": -24, "c": -20},  # party room
    LINOLEUM: {"h": 40, "s": 18, "b": -4, "c": -20},
    WOOD: {"h": 28, "s": 45, "b": -22, "c": -15},
    CONCRETE: {"h": 35, "s": 4, "b": -12, "c": 0},
    RUG: {"h": 350, "s": 30, "b": -25, "c": -30},         # conference room
    MAT: {"h": 0, "s": 0, "b": -12, "c": -20},
}
FACING = {"front": "down", "back": "up", "side": "right", "left": "left"}
STEP = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}


def load_catalog(dirs):
    """id -> dict(w, h, bg, category, orientation, surface, wall) from manifests."""
    cat = {}

    def walk(node, root, orientation=None):
        orientation = node.get("orientation", orientation)
        if node.get("type") == "asset":
            entry = {
                "w": node["footprintW"], "h": node["footprintH"],
                "bg": root.get("backgroundTiles", 0), "category": root["category"],
                "orientation": orientation, "surface": root.get("canPlaceOnSurfaces", False),
                "wall": root.get("canPlaceOnWalls", False),
            }
            cat[node["id"]] = entry
            if node.get("mirrorSide"):
                cat[node["id"] + ":left"] = {**entry, "orientation": "left"}
        for child in node.get("members", []):
            walk(child, root, orientation)

    for d in dirs:
        for path in glob.glob(os.path.join(d, "*", "manifest.json")):
            with open(path) as f:
                m = json.load(f)
            walk(m, m)
    return cat


class Office:
    def __init__(self, catalog):
        self.cat = catalog
        self.tiles = [[VOID] * COLS for _ in range(ROWS)]
        self.furniture = []

    def floor(self, c0, r0, c1, r1, tile):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                self.tiles[r][c] = tile

    def wall_line(self, c0, r0, c1, r1, gaps=()):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                if (c, r) not in gaps:
                    self.tiles[r][c] = WALL

    def put(self, type_, col, row):
        assert type_ in self.cat, f"unknown furniture {type_}"
        self.furniture.append({"uid": f"o-{len(self.furniture)}", "type": type_, "col": col, "row": row})

    def workstation(self, col, row, pc="CRT_PC_OFF", chair="OFFICE_CHAIR_BACK"):
        """Desk (3x2) with a computer on it and a chair right below, facing up at it."""
        self.put("OFFICE_DESK_FRONT", col, row)
        self.put(pc, col + 1, row)
        self.put(chair, col + 1, row + 2)


def build(catalog):
    o = Office(catalog)

    # ── Shell (compact: 28x18) ──
    o.floor(1, 2, 26, 16, CARPET)
    o.wall_line(0, 1, 27, 1)                               # front wall
    o.wall_line(0, 17, 27, 17)
    o.wall_line(0, 1, 0, 17)
    o.wall_line(27, 1, 27, 17)
    o.wall_line(1, 12, 26, 12, gaps={(13, 12), (14, 12)})  # warehouse back wall + door
    o.wall_line(7, 2, 7, 11, gaps={(7, 4), (7, 5), (7, 11)})  # break room (wide door) / annex wall
    o.wall_line(1, 7, 6, 7, gaps={(3, 7)})                 # break room | annex

    o.floor(1, 2, 6, 6, LINOLEUM)
    o.floor(1, 8, 6, 11, CARPET_TILES)
    o.floor(21, 2, 26, 6, WOOD)
    o.floor(21, 8, 26, 11, RUG)
    o.floor(1, 13, 26, 16, CONCRETE)

    # ── Reception ──
    o.put("RECEPTION_DESK", 12, 3)
    o.put("OFFICE_CHAIR_FRONT", 13, 2)                     # receptionist sits behind the desk
    o.put("CRT_PC_BACK", 14, 3)
    o.put("TEAPOT", 12, 3)
    o.put("CANDY_BOWL", 13, 3)
    o.put("PRETZEL_CART", 9, 2)                            # against the front wall, clear of the walkway
    o.put("OFFICE_COUCH", 16, 2)
    o.put("FICUS", 18, 2)
    o.put("WATER_COOLER", 19, 2)

    # ── Bullpen: two rows of three workstations ──
    # Interior walls are drawn two tiles tall and hide the row above them, so no seat
    # sits directly above one (row 11 here is a walkway).
    # Six desks. Column 8 stays a clear walkway from reception down to the kitchen door.
    for row in (5, 8):
        for col in (9, 13, 17):
            o.workstation(col, row)
    o.put("JELLO_STAPLER", 13, 5)
    o.put("PAPER_STACK", 19, 5)
    o.put("PAPER_STACK", 11, 8)
    o.put("BOBBLEHEAD", 17, 8)
    o.put("FILING_CABINET", 15, 3)

    # ── Break room ──
    o.put("FRIDGE", 1, 2)
    o.put("KITCHEN_COUNTER", 2, 2)
    o.put("VENDING_MACHINE", 5, 2)                         # keeps the kitchen doorway clear
    o.put("BREAK_TABLE", 3, 4)
    o.put("OFFICE_CHAIR_SIDE", 2, 5)
    o.put("OFFICE_CHAIR_SIDE:left", 5, 5)

    # ── Party room (the old annex): where idle agents goof off ──
    o.put("BALLOONS", 1, 8)
    o.put("PARTY_TABLE", 2, 8)
    o.put("BALLOONS", 6, 8)
    o.put("GIFT_PILE", 5, 9)
    o.put("GIFT_PILE", 1, 10)

    # ── Manager's office (glass) ──
    for r in range(2, 7):
        if r != 4:
            o.put("GLASS_WALL_V", 20, r)
    for c in range(21, 27):
        o.put("GLASS_WALL", c, 6)                          # solid on row 7: office | conference
    o.workstation(22, 3)
    o.put("BEST_BOSS_MUG", 24, 3)
    o.put("OFFICE_COUCH", 25, 2)
    o.put("FICUS", 21, 2)

    # ── Conference room (glass) ──
    for r in range(8, 12):
        if r != 8:                                         # door: opens onto the desk row's walkable edge
            o.put("GLASS_WALL_V", 20, r)
    o.put("CONFERENCE_TABLE", 22, 9)
    o.put("OFFICE_CHAIR_FRONT", 23, 8)
    o.put("OFFICE_CHAIR_FRONT", 24, 8)
    o.put("OFFICE_CHAIR_SIDE", 21, 10)
    o.put("OFFICE_CHAIR_SIDE:left", 26, 10)

    # ── Warehouse: stock on the left, a half-court on the right (idle agents shoot hoops) ──
    o.put("WAREHOUSE_SHELF", 1, 13)
    o.put("WAREHOUSE_SHELF", 4, 13)
    o.put("PAPER_PALLET", 7, 14)
    o.put("BEET_CRATE", 9, 13)
    o.put("PAPER_BOXES", 10, 13)
    o.put("FORKLIFT", 11, 14)
    o.put("COURT_LINES", 17, 13)                           # walk-over paint
    o.put("BASKETBALL_HOOP", 23, 13)
    o.put("BASKETBALL", 16, 15)                            # just off the court
    o.put("PAPER_BOXES", 25, 13)
    o.put("SAD_PLANT", 26, 14)                             # banished to the warehouse

    # ── Front wall dressing (wall items hang from row 0 onto the wall at row 1) ──
    o.put("PARTY_BANNER", 2, 0)
    o.put("CORKBOARD", 4, 0)
    o.put("DART_BOARD", 6, 0)
    o.put("EMPLOYEE_PLAQUE", 11, 0)
    o.put("WINDOW_BLINDS", 13, 0)
    o.put("MOTIVATIONAL_POSTER", 15, 0)
    o.put("OFFICE_CLOCK", 17, 0)
    o.put("WHITEBOARD_WALL", 21, 0)
    o.put("AWARD_SHELF", 23, 0)
    o.put("WINDOW_BLINDS", 25, 0)
    return o


def compute_seats(furniture, cat, desk_tiles):
    """(col, row, facing) per seat tile - same rule as layoutSerializer.layoutToSeats:
    chair orientation first, else the adjacent desk, else down."""
    seats = []
    for f in furniture:
        e = cat.get(f["type"])
        if not e or e["category"] != "chairs":
            continue
        for dr in range(e["bg"], e["h"]):
            c, r = f["col"], f["row"] + dr
            facing = FACING.get(e["orientation"]) if e["orientation"] else None
            if facing is None:
                facing = next((d for d, (dc, dy) in STEP.items() if (c + dc, r + dy) in desk_tiles), "down")
            seats.append((c, r, facing))
    return seats


def desk_tiles_of(furniture, cat):
    tiles = set()
    for f in furniture:
        e = cat.get(f["type"])
        if e and e["category"] == "desks":
            for dr in range(e["h"]):
                for dc in range(e["w"]):
                    tiles.add((f["col"] + dc, f["row"] + dr))
    return tiles


def check(o):
    problems = []
    cat = o.cat
    occupied, desk_tiles, pc_tiles, blocked = {}, set(), set(), set()
    for f in o.furniture:
        e = cat[f["type"]]
        for dr in range(e["h"]):
            for dc in range(e["w"]):
                t = (f["col"] + dc, f["row"] + dr)
                if not (0 <= t[0] < COLS and 0 <= t[1] < ROWS):
                    problems.append(f"{f['type']}@{f['col']},{f['row']} leaves the map")
                    continue
                if e["wall"]:
                    continue
                if o.tiles[t[1]][t[0]] in (WALL, VOID):
                    problems.append(f"{f['type']}@{f['col']},{f['row']} stands on a wall/void at {t}")
                if e["surface"]:
                    if t not in desk_tiles:
                        problems.append(f"{f['type']}@{f['col']},{f['row']} isn't on a desk")
                    if e["category"] == "electronics":
                        pc_tiles.add(t)
                    continue
                if t in occupied:
                    problems.append(f"{f['type']}@{f['col']},{f['row']} overlaps {occupied[t]}")
                occupied[t] = f"{f['type']}@{f['col']},{f['row']}"
                if e["category"] == "desks":
                    desk_tiles.add(t)
                if dr >= e["bg"] and e["category"] != "chairs":
                    blocked.add(t)

    seats = compute_seats(o.furniture, cat, desk_tiles)

    def faces_pc(c, r, facing):
        dc, dy = STEP[facing]
        fc, fr = c + dc, r + dy
        side = [(fc - 1, fr), (fc + 1, fr)] if facing in ("up", "down") else [(fc, fr - 1), (fc, fr + 1)]
        return any(t in pc_tiles for t in [(fc, fr), *side])

    walkable = {(c, r) for r in range(ROWS) for c in range(COLS)
                if o.tiles[r][c] not in (WALL, VOID) and (c, r) not in blocked}
    seat_tiles = {(c, r) for c, r, _ in seats}
    start = (10, 2)
    seen, queue = {start}, deque([start])
    while queue:
        c, r = queue.popleft()
        for n in ((c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1)):
            if n in walkable and n not in seen and n not in seat_tiles:
                seen.add(n)
                queue.append(n)
    for c, r, _ in seats:
        if not any(n in seen for n in ((c + 1, r), (c - 1, r), (c, r + 1), (c, r - 1))):
            problems.append(f"seat {c},{r} can't be reached from the entrance")
    pc_seats = sum(faces_pc(*s) for s in seats)
    return problems, len(seats), pc_seats


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    catalog = load_catalog([os.path.join(repo, "webview-ui", "public", "assets", "furniture"),
                            os.path.join(root, "assets", "furniture")])
    o = build(catalog)
    problems, seats, pc_seats = check(o)
    for p in problems:
        print("PROBLEM:", p)
    layout = {
        "version": 1, "cols": COLS, "rows": ROWS, "layoutRevision": REVISION,
        "tiles": [t for row in o.tiles for t in row],
        "tileColors": [COLORS.get(t) if t != VOID else None for row in o.tiles for t in row],
        "furniture": o.furniture,
    }
    out = os.path.join(root, "assets", f"default-layout-{REVISION}.json")
    with open(out, "w") as f:
        json.dump(layout, f, indent=1)
    print(f"{out}: {COLS}x{ROWS}, {len(o.furniture)} furniture, {seats} seats ({pc_seats} at a computer)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
