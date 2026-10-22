"""Minimal dependency-free PNG read/write (8-bit RGBA / RGB, non-interlaced)."""
import struct
import zlib

_SIG = b"\x89PNG\r\n\x1a\n"


def hex_to_rgba(code):
    """'#rrggbb' or '#rrggbbaa' -> (r, g, b, a)."""
    h = code.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    a = int(h[6:8], 16) if len(h) == 8 else 255
    return (r, g, b, a)


def write_png(path, pixels):
    """pixels: list of rows, each a list of (r, g, b, a) tuples."""
    h = len(pixels)
    w = len(pixels[0])
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in pixels)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(_SIG + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def read_png(path):
    """Return rows of (r, g, b, a). Supports 8-bit RGB/RGBA/gray/gray-alpha/palette."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != _SIG:
        raise ValueError(f"{path}: not a PNG")
    pos, idat = 8, b""
    w = h = depth = ctype = interlace = None
    palette, trns = [], b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if tag == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif tag == b"PLTE":
            palette = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif tag == b"tRNS":
            trns = body
        elif tag == b"IDAT":
            idat += body
        elif tag == b"IEND":
            break
    if interlace != 0 or (depth != 8 and ctype != 3) or (ctype == 3 and depth not in (1, 2, 4, 8)):
        raise ValueError(f"{path}: unsupported PNG (depth={depth}, interlace={interlace})")
    if ctype == 3:
        return _read_indexed(zlib.decompress(idat), w, h, depth, palette, trns)
    channels = {0: 1, 2: 3, 4: 2, 6: 4}.get(ctype)
    if channels is None:
        raise ValueError(f"{path}: unsupported color type {ctype}")

    stride = w * channels
    rows = []
    for line in _unfilter(zlib.decompress(idat), h, stride, channels):
        row = []
        for x in range(w):
            px = line[x * channels:(x + 1) * channels]
            if channels == 4:
                row.append(tuple(px))
            elif channels == 3:
                row.append((px[0], px[1], px[2], 255))
            elif channels == 2:
                row.append((px[0], px[0], px[0], px[1]))
            else:
                row.append((px[0], px[0], px[0], 255))
        rows.append(row)
    return rows


def _unfilter(raw, h, stride, bpp):
    """Yield each scanline with PNG filters reversed. bpp = bytes per pixel (min 1)."""
    prev, i = bytearray(stride), 0
    for _ in range(h):
        ftype = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if ftype == 1:
                line[x] = (line[x] + a) & 0xFF
            elif ftype == 2:
                line[x] = (line[x] + b) & 0xFF
            elif ftype == 3:
                line[x] = (line[x] + (a + b) // 2) & 0xFF
            elif ftype == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 0xFF
        prev = line
        yield line


def _read_indexed(raw, w, h, depth, palette, trns):
    stride = (w * depth + 7) // 8
    per_byte = 8 // depth
    mask = (1 << depth) - 1
    rows = []
    for line in _unfilter(raw, h, stride, 1):
        row = []
        for x in range(w):
            byte = line[x // per_byte]
            shift = (per_byte - 1 - x % per_byte) * depth
            idx = (byte >> shift) & mask
            r, g, b = palette[idx]
            a = trns[idx] if idx < len(trns) else 255
            row.append((r, g, b, a))
        rows.append(row)
    return rows
