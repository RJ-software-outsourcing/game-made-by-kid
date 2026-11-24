"""Store a set of identically framed paint photographs in one indexed PNG.

All paints share a single silhouette and pixel index plane. Each palette entry
retains the measured color of that surface under each real paint scheme.
"""
import heapq
from pathlib import Path
import struct
import sys
import zlib

import numpy as np
from PIL import Image, PngImagePlugin


def pack(source, target, paints):
    images = [np.asarray(Image.open(source / (name + '.png')).convert('RGBA')) for name in paints]
    alphas = np.stack([im[:, :, 3].ravel() for im in images])
    alpha = np.median(alphas, axis=0).astype(np.uint8)
    spread = np.ptp(alphas, axis=0)
    # Browsers may round fractional MSAA coverage by a level across swatches.
    if spread.mean() > .35 or np.mean(spread > 8) > .002:
        raise ValueError(f'Paint changed silhouette: mean spread {spread.mean():.2f}, max {spread.max()}')
    covered = np.flatnonzero(alpha)
    coverage = alpha[covered].astype(np.float32) / 255
    rgb = np.column_stack([im.reshape(-1, 4)[covered, :3] for im in images]).astype(np.float32)
    # Quantize premultiplied RGB together with coverage. An antialiased edge
    # should have similar error against pale selected and darker unselected cards.
    data = np.column_stack((rgb * coverage[:, None], coverage * 255))
    weights = np.tile([.84, 1.14, .78], len(paints)).tolist() + [len(paints) * 1.9]
    cells, leaves = [], []
    next_id = 0

    def add(ids):
        nonlocal next_id
        features = data[ids]
        variance = features.var(axis=0) * weights
        channel = int(variance.argmax())
        error = variance[channel] * ids.size
        if error < 1.e-4:
            leaves.append(ids)
            return
        next_id += 1
        heapq.heappush(cells, (-error, next_id, channel, ids))

    add(np.arange(covered.size))
    # Index zero is fully transparent. Use the rest for lit metal, coatings,
    # mixed edge pixels, glass, dents, screws, shadows and specular highlights.
    while cells and len(cells) + len(leaves) < 255:
        _, _, channel, ids = heapq.heappop(cells)
        values = data[ids, channel]
        low = values < (float(values.min()) + float(values.max())) * .5
        if not low.any() or low.all():
            leaves.append(ids)
            continue
        add(ids[low])
        add(ids[~low])
    leaves.extend(entry[3] for entry in cells)
    indices = np.zeros(alpha.size, dtype=np.uint8)
    tables = np.zeros((len(paints), 256, 3), dtype=np.uint8)
    transparency = np.zeros(256, dtype=np.uint8)
    for index, ids in enumerate(leaves, 1):
        indices[covered[ids]] = index
        mean = data[ids].mean(axis=0, dtype=np.float64)
        transparency[index] = np.uint8(np.clip(np.rint(mean[-1]), 1, 255))
        tables[:, index] = np.rint((mean[:-1] * 255 / mean[-1]).reshape(-1, 3)).clip(0, 255).astype(np.uint8)
    image = Image.frombytes('P', (images[0].shape[1], images[0].shape[0]), indices.tobytes())
    image.putpalette(tables[paints.index('night')].tobytes())
    # Registered PNG framing + CRC allow switching PLTE bytes without decoding
    # pixels or running a shader. Standard readers display the Steel Blue sheet.
    palettes = bytearray()
    for name, table in zip(paints, tables):
        label = name.encode('ascii')
        rgb = table.tobytes()
        palettes.extend(bytes([len(label)]) + label + rgb + struct.pack('>I', zlib.crc32(b'PLTE' + rgb)))
    info = PngImagePlugin.PngInfo()
    info.add(b'rpLt', bytes(palettes))
    image.save(target, optimize=True, transparency=transparency.tobytes(), pnginfo=info)
    # Verify every scheme against its own PBR render after compositing over
    # the actual shelf color. Report the worst visible RGB RMS in display sRGB.
    bg = np.array([220., 218., 193.], dtype=np.float32)
    coverage = coverage[:, None]
    remapped = indices[covered]
    output_alpha = transparency[remapped, None] / 255
    errors = []
    for swatch, im in enumerate(images):
        ref = im.reshape(-1, 4)[covered, :3] * coverage + bg * (1 - coverage)
        decoded = tables[swatch, remapped] * output_alpha + bg * (1 - output_alpha)
        errors.append(float(np.sqrt(np.mean((decoded - ref) ** 2))))
    worst = max(errors)
    print(f'{target.name}: {target.stat().st_size:,} bytes, worst paint RMS {worst:.1f}/255')
    if worst > 12:
        raise ValueError('Insufficient palette fidelity')


if __name__ == '__main__':
    pack(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:])
