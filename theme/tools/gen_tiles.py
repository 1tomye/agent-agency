"""Generate Agent Agency office floors and walls for Pixel Agents.

Pixel Agents tints floors and walls at runtime (luminance -> lightness, hue and
saturation from the layout), so these are grayscale.

  floors/floor_N.png  16x16, used by tile type FLOOR_{N+1}
  walls/wall_0.png    64x128 auto-tile pieces: the silhouette of Pixel Agents'
                      wall (wall_template.png, MIT), repainted as drywall with
                      a baseboard.

Usage: python gen_tiles.py
"""
import os
import random

from pixpng import read_png, write_png

T = 16


def gray(v):
    v = max(0, min(255, int(round(v))))
    return (v, v, v, 255)


def tile(fn):
    return [[gray(fn(x, y)) for x in range(T)] for y in range(T)]


def noise(seed):
    rng = random.Random(seed)
    table = [[rng.random() for _ in range(T)] for _ in range(T)]
    return lambda x, y: table[y % T][x % T]


def office_carpet():
    n, fleck = noise(1), noise(2)
    def px(x, y):
        v = 150 + n(x, y) * 10
        if fleck(x, y) > 0.9:
            v += 16
        elif fleck(x, y) < 0.08:
            v -= 14
        return v
    return tile(px)


def carpet_tiles():
    n = noise(3)
    def px(x, y):
        quadrant = (x // 8 + y // 8) % 2
        v = 148 + n(x, y) * 8 + quadrant * 6
        # Woven direction alternates per tile
        if (x if quadrant else y) % 2 == 0:
            v -= 5
        if x % 8 == 7 or y % 8 == 7:
            v -= 10
        return v
    return tile(px)


def linoleum():
    n = noise(4)
    def px(x, y):
        dark = ((x // 8) + (y // 8)) % 2
        return (120 if dark else 182) + n(x, y) * 6
    return tile(px)


def wood():
    n = noise(5)
    def px(x, y):
        row = y // 4
        seam = (row * 5 + 2) % T
        if y % 4 == 3 or x == seam:
            return 100
        v = 150 + (row % 2) * 10 + n(x, y) * 8
        if (x + row * 3) % 7 == 0:
            v -= 10
        return v
    return tile(px)


def concrete():
    n, pit = noise(6), noise(7)
    def px(x, y):
        v = 160 + n(x, y) * 14
        if pit(x, y) > 0.94:
            v -= 30
        if x == 0 or y == 0:
            v -= 22                                   # expansion joints
        return v
    return tile(px)


def ceramic():
    n = noise(8)
    def px(x, y):
        if x % 4 == 3 or y % 4 == 3:
            return 128                                # grout
        return 190 + n(x, y) * 8
    return tile(px)


def patterned_rug():
    def px(x, y):
        cx, cy = x % 8 - 3.5, y % 8 - 3.5
        d = abs(cx) + abs(cy)
        if d < 1.5:
            return 200
        if d < 3:
            return 120
        return 160
    return tile(px)


def entry_mat():
    def px(x, y):
        if x in (0, 15) or y in (0, 15):
            return 90
        return 110 + (10 if y % 2 else 0)             # ribbed
    return tile(px)


def flat():
    return tile(lambda x, y: 167)


FLOORS = [
    ("office-carpet", office_carpet),
    ("carpet-tiles", carpet_tiles),
    ("linoleum", linoleum),
    ("wood", wood),
    ("concrete", concrete),
    ("ceramic", ceramic),
    ("patterned-rug", patterned_rug),
    ("entry-mat", entry_mat),
    ("flat", flat),
]


def drywall(template):
    """Repaint the template wall's cap and face as drywall with a baseboard."""
    outline_lum = min(px[0] for row in template for px in row if px[3])
    n = noise(9)
    out = []
    for y, row in enumerate(template):
        out_row = []
        for x, px in enumerate(row):
            if px[3] == 0 or px[0] == outline_lum:
                out_row.append(px)
                continue
            ly = y % 32
            if px[0] < 230:                           # top cap (seen from above)
                out_row.append(gray(205 + n(x, y) * 6))
                continue
            if ly >= 27:                              # baseboard
                out_row.append(gray(120 if ly == 27 else 140))
            elif ly == 17:                            # chair rail
                out_row.append(gray(170))
            else:
                out_row.append(gray(214 + n(x, y) * 6 - (8 if ly > 17 else 0)))
        out.append(out_row)
    return out


def write_preview(path, floors, wall, scale=6):
    bg = (60, 60, 70, 255)
    tiles_w = 3 * T
    out_w = (tiles_w + 4) * len(floors) * scale
    out_h = (tiles_w + 4 + len(wall)) * scale
    out = [[bg] * max(out_w, len(wall[0]) * scale) for _ in range(out_h)]

    def put(px_rows, ox, oy, reps=1):
        for ry in range(reps):
            for rx in range(reps):
                for y, row in enumerate(px_rows):
                    for x, p in enumerate(row):
                        if p[3] == 0:
                            continue
                        for yy in range(scale):
                            for xx in range(scale):
                                out[(oy + ry * T + y) * scale + yy][(ox + rx * T + x) * scale + xx] = p

    for i, f in enumerate(floors):
        put(f, i * (tiles_w + 4), 0, reps=3)
    put(wall, 0, tiles_w + 4)
    write_png(path, out)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    floor_dir = os.path.join(root, "assets", "floors")
    wall_dir = os.path.join(root, "assets", "walls")
    os.makedirs(floor_dir, exist_ok=True)
    os.makedirs(wall_dir, exist_ok=True)
    floors = []
    for i, (name, fn) in enumerate(FLOORS):
        f = fn()
        write_png(os.path.join(floor_dir, f"floor_{i}.png"), f)
        floors.append(f)
        print(f"floor_{i}.png  {name}  (tile type {i + 1})")
    template = read_png(os.path.join(os.path.dirname(os.path.abspath(__file__)), "wall_template.png"))
    wall = drywall(template)
    write_png(os.path.join(wall_dir, "wall_0.png"), wall)
    print("wall_0.png  drywall + baseboard")
    write_preview(os.path.join(root, "preview", "tiles.png"), floors, wall)
    print("preview -> preview/tiles.png")


if __name__ == "__main__":
    main()
