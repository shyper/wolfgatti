#!/usr/bin/env python3
"""Preserve generated PNG masters and produce optimized alpha-preserving WebP assets."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('name')
parser.add_argument('--kind', choices=['motif', 'character', 'helper'], default='motif')
parser.add_argument('--prompt', default='')
parser.add_argument('--date', default=datetime.now(timezone.utc).date().isoformat())
args = parser.parse_args()
if not args.name.replace('-', '').isalnum():
    parser.error('The asset name must be alphanumeric with optional hyphens.')
master = ROOT / 'assets/masters' / f'{args.name}.png'
master.parent.mkdir(parents=True, exist_ok=True)
copy2(args.source, master)
folder = {'motif': 'motifs', 'character': 'characters', 'helper': 'cards'}[args.kind]
output = ROOT / 'packages/client/public' / folder / f'{args.name}.webp'
output.parent.mkdir(parents=True, exist_ok=True)
with Image.open(master) as image:
    if image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] != 0:
        raise ValueError(f'{args.name} must have real transparent alpha.')
    original_size = image.size
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    image.save(output, 'WEBP', quality=88, method=4)
    web_size = image.size
record = {
    'asset': args.name,
    'kind': args.kind,
    'tool': 'OpenAI built-in image_gen',
    'generatedFile': args.source.name,
    'date': args.date,
    'license': 'MIT, to the extent rights can be granted',
    'master': str(master.relative_to(ROOT)),
    'web': str(output.relative_to(ROOT)),
    'masterSize': original_size,
    'webSize': web_size,
    'prompt': args.prompt,
    'review': 'pending visual inspection',
}
provenance = ROOT / 'assets/provenance' / f'{args.name}.json'
provenance.parent.mkdir(parents=True, exist_ok=True)
provenance.write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'asset': args.name, 'bytes': output.stat().st_size}))
