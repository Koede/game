// Rewrites tests/golden/content.json from the registry (npm run golden:update). Review the diff like a lockfile.
import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './gen-indexes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
generate();
const res = await esbuild.build({ entryPoints: [join(root, 'src/content/goldenSnapshot.ts')], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(res.outputFiles[0].text).toString('base64'));
const snap = mod.contentSnapshot();
mkdirSync(join(root, 'tests/golden'), { recursive: true });
// One entry per line keeps the diff readable.
const part = (o) => '{\n' + Object.entries(o).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n  }';
const text = '{\n' + Object.entries(snap).map(([k, o]) => `  ${JSON.stringify(k)}: ${part(o)}`).join(',\n') + '\n}\n';
writeFileSync(join(root, 'tests/golden/content.json'), text);
console.log('golden: ' + Object.entries(snap).map(([k, o]) => `${Object.keys(o).length} ${k}`).join(', '));
