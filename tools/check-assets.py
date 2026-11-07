#!/usr/bin/env python3
"""Check the complete card catalog, masters, provenance and transparent web artwork."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'assets/catalog.json').read_text())
assert [card['id'] for card in catalog] == list(range(1, 169)), 'Expected exactly 168 ordered, unique card IDs.'
client = json.loads((ROOT / 'packages/client/src/data/cards.json').read_text())
assert client == catalog, 'The client catalog must match the source catalog.'
assets = [(f"p{card['id']:03}", 'motifs') for card in catalog]
assets += [(name, 'characters') for name in ['wolf', 'painter-elephant', 'curator-peacock']]
assets += [('canvas-brushed-v1', 'card-backgrounds')]
assets += [(f'helper-{name}{side}', 'cards') for name in ['swapThemes', 'swapHand', 'plusMinus', 'ask'] for side in ['', '-back']]
seen = set()
for name, folder in assets:
    path = ROOT / 'packages/client/public' / folder / f'{name}.webp'
    assert path.is_file(), f'Missing artwork: {path.relative_to(ROOT)}'
    provenance_name = 'card-background-canvas-v1' if folder == 'card-backgrounds' else name
    record = json.loads((ROOT / 'assets/provenance' / f'{provenance_name}.json').read_text())
    assert (ROOT / record['master']).is_file(), f'Missing master: {name}'
    assert record['prompt'], f'Missing prompt: {name}'
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest not in seen, f'Duplicate image: {name}'
    seen.add(digest)
    with Image.open(path) as image:
        assert image.mode == 'RGBA', f'Missing alpha: {name}'
        lo, hi = image.getchannel('A').getextrema()
        assert lo == 0 and hi > 240, f'Unexpected alpha range: {name}'
        limit = 1170 if folder == 'card-backgrounds' else 768
        assert max(image.size) <= limit, f'Oversized web image: {name}'
print(f'Validated {len(catalog)} motif cards, 3 characters, the shared background and 8 helper faces, including masters and provenance.')
