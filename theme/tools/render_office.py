"""Render the Agent Agency office layout to a PNG, approximating the Pixel Agents renderer.

Mirrors webview-ui/src/office: floor/wall colorize, wall bitmask auto-tiling,
furniture top-left anchoring and zY sorting, seated characters offset 6px.
Agents are placed at seats facing computers, typing. A preview tool only - the
app remains the source of truth.

Usage: python render_office.py [repo dir] [layout.json] [out.png]
  (defaults: this repository, the newest theme/assets/default-layout-N.json,
  theme/preview/office.png)
"""
import colorsys
import glob
import json
import os
import random
import re
import sys

from pixpng import read_png, write_png

TILE = 16
VOID, WALL = 255, 0
SCALE = 3
SITTING_OFFSET = 6

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def colorize(px, color):
    r, g, b, a = px
    if a == 0:
        return px
    light = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    if color["c"]:
        light = 0.5 + (light - 0.5) * (100 + color["c"]) / 100
    if color["b"]:
        light += color["b"] / 200
    light = max(0.0, min(1.0, light))
    rr, gg, bb = colorsys.hls_to_rgb(color["h"] / 360, light, color["s"] / 100)
    return (round(rr * 255), round(gg * 255), round(bb * 255), a)


def show_on_state(cat):
    """Preview electronics as 'on' (first animation frame), as when agents are working."""
    for key in list(cat):
        if key.endswith("_OFF"):
            on = key[:-4] + "_ON_1"
            if on in cat:
                cat[key] = cat[on]


def load_catalog(dirs):
    """id -> (sprite rows, footprintH, category, orientation). Later dirs win."""
    cat = {}

    def walk(node, folder, category, orientation=None):
        orientation = node.get("orientation", orientation)
        if node.get("type") == "asset":
            sprite = read_png(os.path.join(folder, node.get("file", node["id"] + ".png")))
            cat[node["id"]] = (sprite, node["footprintH"], category, orientation)
            if node.get("mirrorSide"):
                cat[node["id"] + ":left"] = ([row[::-1] for row in sprite], node["footprintH"], category, orientation)
        for child in node.get("members", []):
            walk(child, folder, category, orientation)

    for d in dirs:
        for mpath in glob.glob(os.path.join(d, "*", "manifest.json")):
            with open(mpath) as f:
                m = json.load(f)
            walk(m, os.path.dirname(mpath), m["category"])
    return cat


def char_frame(sheets, idx, facing, frame):
    sheet = sheets[idx % len(sheets)]
    row = {"down": 0, "up": 1, "right": 2, "left": 2}[facing]
    rows = [r[frame * 16:(frame + 1) * 16] for r in sheet[row * 32:(row + 1) * 32]]
    return [r[::-1] for r in rows] if facing == "left" else rows


def office_cast(layout, theme_dir, app_dir, count=9):
    """Agents typing at seats that face computers, plus a couple of walkers."""
    import random
    from gen_layout import compute_seats, desk_tiles_of, load_catalog as load_meta
    meta = load_meta([os.path.join(app_dir, "webview-ui", "public", "assets", "furniture"),
                      os.path.join(theme_dir, "furniture")])
    furniture = layout["furniture"]
    seats = compute_seats(furniture, meta, desk_tiles_of(furniture, meta))
    pcs = {(f["col"], f["row"]) for f in furniture if meta.get(f["type"], {}).get("category") == "electronics"}
    step = {"up": (0, -1), "down": (0, 1), "left": (-1, 0), "right": (1, 0)}

    def at_pc(seat):
        c, r, facing = seat
        dc, dr = step[facing]
        return any((c + dc + k * (dr != 0), r + dr + k * (dc != 0)) in pcs for k in (-1, 0, 1))

    # The boss sits at the desk with the mug, in the last sheet (agents never wear it).
    mug = next((f for f in furniture if f["type"] == "BEST_BOSS_MUG"), None)
    boss_seat = min(seats, key=lambda s: abs(s[0] - mug["col"]) + abs(s[1] - mug["row"])) if mug else None
    seats = [s for s in seats if s != boss_seat]
    ranked = sorted(seats, key=lambda s: not at_pc(s))
    rng = random.Random(3)
    chosen = ranked[:count]
    cast = [(i % 6, c, r, facing, 3 + i % 2, True) for i, (c, r, facing) in enumerate(chosen)]
    if boss_seat:
        cast.append((6, boss_seat[0], boss_seat[1], boss_seat[2], 3, True))
    cast += [(rng.randrange(6), 8, 7, "down", 0, False), (rng.randrange(6), 14, 14, "right", 2, False)]
    return cast


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(ROOT)
    layouts = glob.glob(os.path.join(ROOT, "assets", "default-layout-*.json"))
    newest = max(layouts, key=lambda p: int(re.search(r"(\d+)\.json$", p).group(1)), default=None)
    layout_path = sys.argv[2] if len(sys.argv) > 2 else newest
    if not layout_path:
        sys.exit("No layout found; run gen_layout.py first.")
    out_path = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, "preview", "office.png")
    bundled = os.path.join(repo, "webview-ui", "public", "assets")
    theme = os.path.join(ROOT, "assets")

    with open(layout_path) as f:
        layout = json.load(f)
    cols, rows = layout["cols"], layout["rows"]
    tiles = [layout["tiles"][r * cols:(r + 1) * cols] for r in range(rows)]
    colors = [layout["tileColors"][r * cols:(r + 1) * cols] for r in range(rows)]

    floors = [read_png(p) for p in sorted(glob.glob(os.path.join(theme, "floors", "floor_*.png")),
                                          key=lambda p: int(p.rsplit("_", 1)[1].split(".")[0]))]
    wall = read_png(os.path.join(theme, "walls", "wall_0.png"))
    wall_pieces = [[r[(m % 4) * 16:(m % 4) * 16 + 16] for r in wall[(m // 4) * 32:(m // 4) * 32 + 32]] for m in range(16)]
    catalog = load_catalog([os.path.join(bundled, "furniture"), os.path.join(theme, "furniture")])
    show_on_state(catalog)
    sheets = [read_png(p) for p in sorted(glob.glob(os.path.join(theme, "characters", "char_*.png")))]

    canvas = [[(24, 22, 28, 255)] * (cols * TILE) for _ in range(rows * TILE)]

    def blit(sprite, x0, y0, color=None):
        for y, row in enumerate(sprite):
            for x, px in enumerate(row):
                if px[3] == 0:
                    continue
                if color:
                    px = colorize(px, color)
                cx, cy = x0 + x, y0 + y
                if 0 <= cx < cols * TILE and 0 <= cy < rows * TILE:
                    if px[3] < 255:
                        br, bg_, bb, _ = canvas[cy][cx]
                        t = px[3] / 255
                        px = (round(px[0] * t + br * (1 - t)), round(px[1] * t + bg_ * (1 - t)),
                              round(px[2] * t + bb * (1 - t)), 255)
                    canvas[cy][cx] = px

    # Floors (unsorted, underneath everything)
    for r in range(rows):
        for c in range(cols):
            t = tiles[r][c]
            if t not in (VOID, WALL):
                blit(floors[t - 1], c * TILE, r * TILE, colors[r][c])

    drawables = []  # (zY, sprite, x, y, color)
    for r in range(rows):
        for c in range(cols):
            if tiles[r][c] != WALL:
                continue
            mask = 0
            if r > 0 and tiles[r - 1][c] == WALL: mask |= 1
            if c < cols - 1 and tiles[r][c + 1] == WALL: mask |= 2
            if r < rows - 1 and tiles[r + 1][c] == WALL: mask |= 4
            if c > 0 and tiles[r][c - 1] == WALL: mask |= 8
            piece = wall_pieces[mask]
            drawables.append(((r + 1) * TILE, piece, c * TILE, r * TILE + TILE - len(piece), colors[r][c]))

    desk_z = {}
    for item in layout["furniture"]:
        entry = catalog.get(item["type"])
        if entry and entry[2] == "desks":
            sprite, fh = entry[0], entry[1]
            for dr in range(fh):
                for dc in range(len(sprite[0]) // TILE):
                    desk_z[(item["col"] + dc, item["row"] + dr)] = item["row"] * TILE + len(sprite)

    missing = set()
    for item in layout["furniture"]:
        entry = catalog.get(item["type"])
        if not entry:
            missing.add(item["type"])
            continue
        sprite, fh, category, orientation = entry
        x, y = item["col"] * TILE, item["row"] * TILE
        z = y + len(sprite)
        if category == "chairs":
            z = (item["row"] + fh) * TILE + 1 if orientation == "back" else (item["row"] + 1) * TILE
        elif (item["col"], item["row"]) in desk_z or (item["col"], item["row"] + 1) in desk_z:
            dz = max(desk_z.get((item["col"], item["row"]), 0), desk_z.get((item["col"], item["row"] + 1), 0))
            if category != "desks" and dz + 0.5 > z:
                z = dz + 0.5
        drawables.append((z, sprite, x, y, None))

    cast_list = office_cast(layout, theme, repo)
    for cast in cast_list:
        idx, c, r, facing, frame = cast[:5]
        seated = cast[5] if len(cast) > 5 else True
        cy = r * TILE + TILE // 2
        sprite = char_frame(sheets, idx, facing, frame)
        y = cy + (SITTING_OFFSET if seated else 0) - 32
        drawables.append((cy + TILE // 2 + 0.25, sprite, c * TILE, y, None))

    for z, sprite, x, y, color in sorted(drawables, key=lambda d: d[0]):
        blit(sprite, x, y, color)

    # Crop to the used area (skip void rows/cols), then scale up.
    used_r = [r for r in range(rows) if any(t != VOID for t in tiles[r])]
    used_c = [c for c in range(cols) if any(tiles[r][c] != VOID for r in range(rows))]
    top = max(0, (used_r[0] - 1) * TILE)
    bottom = (used_r[-1] + 1) * TILE
    left, right = used_c[0] * TILE, (used_c[-1] + 1) * TILE
    out = []
    for y in range(top, bottom):
        row = [px for px in canvas[y][left:right] for _ in range(SCALE)]
        out.extend([row] * SCALE)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    write_png(out_path, out)
    print(f"rendered -> {out_path}")
    if missing:
        print("WARNING: furniture types not found:", ", ".join(sorted(missing)))


if __name__ == "__main__":
    main()
