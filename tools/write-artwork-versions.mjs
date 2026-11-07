/** Fingerprint web artwork so browsers can keep stable card IDs without serving stale images. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = path.join(root, 'packages/client');
const catalog = JSON.parse(await readFile(path.join(client, 'src/data/cards.json'), 'utf8'));
const files = catalog.map((card) => `/motifs/p${String(card.id).padStart(3, '0')}.webp`);
files.push(...['wolf', 'painter-elephant', 'curator-peacock'].map((name) => `/characters/${name}.webp`));
files.push('/card-backgrounds/canvas-brushed-v1.webp');
files.push(...['swapThemes', 'swapHand', 'plusMinus', 'ask'].flatMap((id) => [
  `/cards/helper-${id}.webp`, `/cards/helper-${id}-back.webp`,
]));
const versions = {};
for (const filename of files) {
  const bytes = await readFile(path.join(client, 'public', filename));
  versions[filename] = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}
await writeFile(path.join(client, 'src/data/artwork-versions.json'), JSON.stringify(versions, null, 2) + '\n');
console.log(`Fingerprinted ${files.length} artwork files.`);
