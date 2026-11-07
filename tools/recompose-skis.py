#!/usr/bin/env python3
"""Rigidly reposition the two original generated skis without repainting either object."""
import argparse
import math
import sys
from pathlib import Path
from PIL import Image

sys.excepthook = sys.__excepthook__
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--angle', type=float, default=10)
parser.add_argument('--crossing', type=float, default=0.30)
parser.add_argument('--output', type=Path, default=ROOT / '.work/p058-geometric.png')
args = parser.parse_args()
source = Image.open(ROOT / 'assets/variants/p058-v1.png').convert('RGBA')
solid = source.getchannel('A').point(lambda value: 255 if value > 16 else 0)
columns = solid.getprojection()[0]
runs = []
start = None
for index, present in enumerate(columns + [0]):
    if present and start is None:
        start = index
    elif not present and start is not None:
        if index - start > 20:
            runs.append((start, index))
        start = None
assert len(runs) == 2, 'Expected two separate ski silhouettes.'
split = (runs[0][1] + runs[1][0]) // 2
assert source.getchannel('A').crop((split - 1, 0, split + 2, source.height)).getextrema()[1] == 0, 'The split must lie in the transparent gap.'
parts = []
for box in [(0, 0, split, source.height), (split, 0, source.width, source.height)]:
    part = source.crop(box)
    bounds = part.getchannel('A').point(lambda value: 255 if value > 16 else 0).getbbox()
    assert bounds is not None
    # Keep the full antialiased edge, excluding isolated nearly invisible generation noise.
    bounds = (max(0, bounds[0] - 4), max(0, bounds[1] - 4), min(part.width, bounds[2] + 4), min(part.height, bounds[3] + 4))
    parts.append(part.crop(bounds))

canvas = Image.new('RGBA', (source.width * 2, source.height * 2))
anchor = (canvas.width / 2, canvas.height / 2)
# Rotate complete layers, including their bindings. The rear ski is composited first.
for index, angle in [(1, -args.angle), (0, args.angle)]:
    part = parts[index]
    rotated = part.convert('RGBa').rotate(angle, resample=Image.Resampling.BICUBIC, expand=True).convert('RGBA')
    radians = math.radians(angle)
    dx = 0
    dy = (args.crossing - 0.5) * part.height
    pivot_x = rotated.width / 2 + math.cos(radians) * dx + math.sin(radians) * dy
    pivot_y = rotated.height / 2 - math.sin(radians) * dx + math.cos(radians) * dy
    position = (round(anchor[0] - pivot_x), round(anchor[1] - pivot_y))
    canvas.alpha_composite(rotated, position)

content = canvas.crop(canvas.getchannel('A').getbbox())
assert content.width <= source.width and content.height <= source.height, 'The rigid composition must fit without scaling.'
output = Image.new('RGBA', source.size)
output.alpha_composite(content, ((source.width - content.width) // 2, (source.height - content.height) // 2))
args.output.parent.mkdir(parents=True, exist_ok=True)
output.save(args.output)
print({'output': str(args.output), 'sourceSize': source.size, 'skiSizes': [p.size for p in parts], 'angle': args.angle, 'crossing': args.crossing, 'contentSize': content.size})
