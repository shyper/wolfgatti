// Fails if the German and English locale files do not have the same keys.
import { readFileSync } from 'node:fs';

const dir = new URL('../packages/client/src/locales/', import.meta.url);
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const keys = (lang) => new Set(flat(JSON.parse(readFileSync(new URL(`${lang}.json`, dir), 'utf8'))));

const de = keys('de');
const en = keys('en');
const missingEn = [...de].filter((k) => !en.has(k));
const missingDe = [...en].filter((k) => !de.has(k));
if (missingEn.length || missingDe.length) {
  if (missingEn.length) console.error('missing in en:', missingEn.join(', '));
  if (missingDe.length) console.error('missing in de:', missingDe.join(', '));
  process.exit(1);
}
console.log(`i18n ok: ${de.size} keys in de and en`);
