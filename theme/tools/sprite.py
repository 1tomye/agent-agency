"""Shared sprite helpers for the Agent Agency theme generators (pure Python, no deps)."""
import math

from pixpng import write_png

CLEAR = (0, 0, 0, 0)
SHADOW = (0, 0, 0, 56)


class Sprite:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[CLEAR] * w for _ in range(h)]
        self.shadow_cells = set()

    def set(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = color

    def rect(self, x0, y0, x1, y1, color):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, color)

    def hline(self, x0, x1, y, color):
        self.rect(x0, y, x1, y, color)

    def vline(self, x, y0, y1, color):
        self.rect(x, y0, x, y1, color)

    def disc(self, cx, cy, r, color, ry=None):
        ry = ry if ry is not None else r
        for y in range(math.floor(cy - ry), math.ceil(cy + ry) + 1):
            for x in range(math.floor(cx - r), math.ceil(cx + r) + 1):
                if ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    self.set(x, y, color)

    def outline(self, color):
        """Outline every opaque region with `color` (4-neighbour)."""
        solid = {(x, y) for y in range(self.h) for x in range(self.w) if self.px[y][x][3] > 0}
        for x, y in solid:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (nx, ny) not in solid:
                    self.set(nx, ny, color)

    def shadow(self, cx, cy, rx, ry):
        """Soft floor shadow, drawn only under transparent pixels."""
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x][3] == 0 and ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    self.px[y][x] = SHADOW

    def flipped(self):
        s = Sprite(self.w, self.h)
        s.px = [row[::-1] for row in self.px]
        return s


def asset(id_, name, category, w, h, fw, fh, bg=0, walls=False, surfaces=False, file=None):
    return {
        "id": id_, "name": name, "category": category, "type": "asset",
        "file": file or f"{id_}.png", "width": w, "height": h,
        "footprintW": fw, "footprintH": fh,
        "canPlaceOnWalls": walls, "canPlaceOnSurfaces": surfaces, "backgroundTiles": bg,
    }


def member(id_, w, h, fw, fh, **extra):
    return {"type": "asset", "id": id_, "file": f"{id_}.png", "width": w, "height": h,
            "footprintW": fw, "footprintH": fh, **extra}


def poly(s, pts, color):
    """Fill a polygon (even-odd rule, pixel centres)."""
    ys = [y for _, y in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        cy = y + 0.5
        xs = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 <= cy < y1) or (y1 <= cy < y0):
                xs.append(x0 + (cy - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(int(round(a)), int(round(b))):
                s.set(x, y, color)


def line(s, x0, y0, x1, y1, color):
    steps = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(steps + 1):
        s.set(round(x0 + (x1 - x0) * i / steps), round(y0 + (y1 - y0) * i / steps), color)


def write_preview(path, sprites, scale=5, bg=(78, 107, 52, 255)):
    gap = 6
    out_w = sum(s.w + gap for s in sprites) * scale
    out_h = max(s.h for s in sprites) * scale
    out = [[bg] * out_w for _ in range(out_h)]
    ox = 0
    for s in sprites:
        for y in range(s.h):
            for x in range(s.w):
                r, g, b, a = s.px[y][x]
                if a == 0:
                    continue
                for yy in range(scale):
                    row = out[y * scale + yy]
                    for xx in range(scale):
                        br, bgc, bb, _ = row[ox + x * scale + xx]
                        t = a / 255
                        row[ox + x * scale + xx] = (
                            round(r * t + br * (1 - t)), round(g * t + bgc * (1 - t)), round(b * t + bb * (1 - t)), 255)
        ox += (s.w + gap) * scale
    write_png(path, out)
