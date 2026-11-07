import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const catalog = await json('assets/catalog.json');
assert.deepEqual(catalog.map((card) => card.id), Array.from({ length: 168 }, (_, i) => i + 1));
assert.deepEqual(await json('packages/client/src/data/cards.json'), catalog);
const assets = catalog.map((card) => [`p${String(card.id).padStart(3, '0')}`, 'motifs']);
assets.push(...['wolf', 'painter-elephant', 'curator-peacock'].map((name) => [name, 'characters']));
assets.push(['canvas-brushed-v1', 'card-backgrounds', 1170, 'card-background-canvas-v1']);
assets.push(...['swapThemes', 'swapHand', 'plusMinus', 'ask'].flatMap((id) => [
  [`helper-${id}`, 'cards'], [`helper-${id}-back`, 'cards'],
]));
const seen = new Set();
const versions = await json('packages/client/src/data/artwork-versions.json');
assert.equal(Object.keys(versions).length, assets.length, 'The artwork version map must cover every shipped illustration and background.');
for (const [name, folder, maxEdge = 768, provenanceName = name] of assets) {
  const filename = `packages/client/public/${folder}/${name}.webp`;
  const image = await readFile(path.join(root, filename));
  assert.equal(image.toString('ascii', 0, 4), 'RIFF', `Invalid WebP: ${name}`);
  assert.equal(image.toString('ascii', 8, 12), 'WEBP', `Invalid WebP: ${name}`);
  let alpha = false;
  let dimensions;
  for (let offset = 12; offset + 8 <= image.length;) {
    const type = image.toString('ascii', offset, offset + 4);
    const size = image.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert(start + size <= image.length, `Truncated WebP: ${name}`);
    if (type === 'VP8X') {
      alpha = (image[start] & 0x10) !== 0;
      dimensions = [image.readUIntLE(start + 4, 3) + 1, image.readUIntLE(start + 7, 3) + 1];
    }
    offset = start + size + (size % 2);
  }
  assert(alpha, `Missing WebP alpha channel: ${name}`);
  assert(dimensions && Math.max(...dimensions) <= maxEdge, `Unexpected web dimensions: ${name}`);
  const digest = createHash('sha256').update(image).digest('hex');
  assert(!seen.has(digest), `Duplicate artwork: ${name}`);
  seen.add(digest);
  assert.equal(versions[`/${folder}/${name}.webp`], digest.slice(0, 12), `Stale artwork fingerprint: ${name}`);
  const record = await json(`assets/provenance/${provenanceName}.json`);
  assert.equal(record.web, filename);
  assert(record.prompt && record.tool && record.date, `Incomplete provenance: ${name}`);
  const master = await readFile(path.join(root, record.master));
  assert.equal(master.toString('ascii', 1, 4), 'PNG', `Invalid master: ${name}`);
  assert.equal(master[25], 6, `Master must have an RGBA channel: ${name}`);
  assert.deepEqual(record.webSize, dimensions, `Incorrect provenance size: ${name}`);
  await stat(path.join(root, record.master));
}
const vectorFiles = ['back', ...['swapThemes', 'swapHand', 'plusMinus', 'ask'].flatMap((id) => [`helper-${id}`, `helper-${id}-back`])]
  .map((name) => `packages/client/public/cards/${name}.svg`);
vectorFiles.push('packages/client/public/favicon.svg', 'packages/client/src/assets/logo.svg');
for (const filename of vectorFiles) {
  const svg = await readFile(path.join(root, filename), 'utf8');
  assert(svg.includes('<svg') && svg.includes('</svg>'), `Invalid vector asset: ${filename}`);
  assert(!/<image\b/i.test(svg), `Unexpected embedded raster image: ${filename}`);
}
console.log(`Validated ${catalog.length} motifs, 3 characters, 1 shared card background, 8 helper faces and ${vectorFiles.length} original vector assets, including alpha, masters, provenance and fingerprints.`);
