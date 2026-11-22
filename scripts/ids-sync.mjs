// Block-id lock maintenance (src/content/blockIds.lock.json: {"key": id, ...}, one per line, sorted by id).
//   npm run ids:sync           append every block key the lock does not know yet (next free ids, in registry order);
//                              a duplicated id (two lanes merged) keeps its first key, the others get new ids.
//   npm run ids:sync -- --check   exit 1 when the lock is not complete (CI / local-check).
// Ids are permanent: this script never changes or removes an existing assignment.
import * as esbuild from 'esbuild';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate } from './gen-indexes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = join(root, 'src/content/blockIds.lock.json');
const check = process.argv.includes('--check');
generate();

const res = await esbuild.build({ entryPoints: [join(root, 'src/content/blocks.ts')], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'));
const keys = mod.BLOCK_KEYS_IN_ORDER; // every block key, locked ones at their ids, unlocked appended

const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};
const taken = new Map(); // id -> key
const next = { ...lock };
let max = -1;
for (const [k, id] of Object.entries(lock)) {
  if (taken.has(id)) delete next[k]; else taken.set(id, k);
  max = Math.max(max, id);
}
const added = [];
for (const k of keys) {
  if (next[k] !== undefined) continue;
  next[k] = ++max;
  added.push(k);
}
const text = '{\n' + Object.entries(next).sort((a, b) => a[1] - b[1]).map(([k, id]) => `  ${JSON.stringify(k)}: ${id}`).join(',\n') + '\n}\n';
if (check) {
  if (added.length) { console.error(`blockIds.lock.json is missing ${added.length} block(s): ${added.slice(0, 8).join(', ')} - run npm run ids:sync`); process.exit(1); }
} else {
  if (!existsSync(LOCK) || readFileSync(LOCK, 'utf8') !== text) writeFileSync(LOCK, text);
  console.log(added.length ? `ids:sync: added ${added.length}: ${added.join(', ')}` : 'ids:sync: lock complete');
}
