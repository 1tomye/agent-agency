"""Generate the Agent Agency icon: a beige CRT with "AA" on its screen.

Writes every icon the app ships (all scaled from one 32x32 pixel drawing):
  icon.png                                   128x128  VS Code extension icon
  webview-ui/public/icons/icon-256.png       256x256  web app manifest
  webview-ui/public/icons/icon-512.png       512x512  web app manifest
  webview-ui/public/apple-touch-icon*.png    180x180  iOS home screen
  webview-ui/public/favicon.ico              16+32    browser tab

Usage: python gen_icon.py [repo dir]   (default: this repository)
"""
import os
import struct
import sys
import zlib

from pixpng import hex_to_rgba, write_png

GLYPH_A = [".w.", "w.w", "www", "w.w", "w.w"]


def draw_art():
    """32x32 icon drawn from rectangles, so everything lines up."""
    g = [["n"] * 32 for _ in range(32)]

    def rect(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                g[y][x] = c

    def frame(x0, y0, x1, y1, c):
        for x in range(x0, x1 + 1):
            g[y0][x] = g[y1][x] = c
        for y in range(y0, y1 + 1):
            g[y][x0] = g[y][x1] = c

    frame(1, 1, 30, 30, "B")                     # tile border
    for x, y in ((1, 1), (30, 1), (1, 30), (30, 30)):
        g[y][x] = "."                            # rounded corners
    rect(5, 5, 26, 21, "o")                      # CRT outline
    rect(6, 6, 25, 20, "b")                      # beige case
    rect(7, 7, 24, 18, "c")                      # bezel
    rect(8, 8, 23, 17, "s")                      # screen
    g[9][9] = "S"                                # glare
    for gx in (11, 17):                          # "AA", centred on the screen
        for dy, row in enumerate(GLYPH_A):
            for dx, ch in enumerate(row):
                if ch == "w":
                    g[10 + dy][gx + dx] = "w"
    rect(13, 21, 18, 23, "o")                    # stand
    rect(14, 21, 17, 23, "d")
    rect(7, 24, 24, 27, "o")                     # keyboard
    rect(8, 25, 23, 26, "b")
    for x in range(9, 23, 2):
        g[25][x] = "k"
    for y in range(32):                          # outside the tile is transparent
        for x in range(32):
            if x in (0, 31) or y in (0, 31):
                g[y][x] = "."
    return ["".join(row) for row in g]


ART = draw_art()

PALETTE = {
    ".": (0, 0, 0, 0),
    "B": hex_to_rgba("#0a0a14"),   # tile border
    "n": hex_to_rgba("#1e1e2e"),   # tile background (the app's panel colour)
    "o": hex_to_rgba("#2a2624"),   # outline
    "b": hex_to_rgba("#d8ceb4"),   # beige case
    "d": hex_to_rgba("#b0a68c"),   # stand
    "c": hex_to_rgba("#b0a68c"),   # bezel
    "s": hex_to_rgba("#2a4a8a"),   # screen
    "S": hex_to_rgba("#cfe8ff"),   # screen glare
    "w": hex_to_rgba("#ffffff"),   # "AA"
    "k": hex_to_rgba("#86807a"),   # keys
}


def pixels():
    assert all(len(r) == 32 for r in ART), [len(r) for r in ART]
    return [[PALETTE[c] for c in row] for row in ART]


def scale(px, k):
    return [[p for p in row for _ in range(k)] for row in px for _ in range(k)]


def pad(px, size, fill):
    h, w = len(px), len(px[0])
    top, left = (size - h) // 2, (size - w) // 2
    out = [[fill] * size for _ in range(size)]
    for y in range(h):
        out[top + y][left:left + w] = px[y]
    return out


def png_bytes(px):
    h, w = len(px), len(px[0])
    raw = b"".join(b"\x00" + bytes(v for p in row for v in p) for row in px)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def write_ico(path, images):
    """ICO holding PNG images (supported by every current browser)."""
    header = struct.pack("<HHH", 0, 1, len(images))
    entries, blobs, offset = b"", b"", 6 + 16 * len(images)
    for px in images:
        data = png_bytes(px)
        size = len(px)
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    with open(path, "wb") as f:
        f.write(header + entries + blobs)


def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    art = pixels()
    public = os.path.join(repo, "webview-ui", "public")
    os.makedirs(os.path.join(public, "icons"), exist_ok=True)
    write_png(os.path.join(repo, "icon.png"), scale(art, 4))
    write_png(os.path.join(public, "icons", "icon-256.png"), scale(art, 8))
    write_png(os.path.join(public, "icons", "icon-512.png"), scale(art, 16))
    touch = pad(scale(art, 5), 180, PALETTE["n"])
    for name in ("apple-touch-icon.png", "apple-touch-icon-precomposed.png"):
        write_png(os.path.join(public, name), touch)
    small = [row[::2] for row in art[::2]]
    write_ico(os.path.join(public, "favicon.ico"), [small, art])
    write_png(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "preview", "icon.png"),
              scale(art, 8))
    print("icons written")


if __name__ == "__main__":
    main()
