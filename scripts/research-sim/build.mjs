// Builds the research simulator page: bundles main.ts (the game's real research engine) into page.html.
// node scripts/research-sim/build.mjs --out=<file.html>
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = (process.argv.find((a) => a.startsWith('--out=')) ?? '--out=research-sim.html').slice(6);
const res = await build({ entryPoints: [join(here, 'main.ts')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = readFileSync(join(here, 'page.html'), 'utf8').replace('/*BUNDLE*/', () => js);
writeFileSync(out, page);
console.log(`research sim: ${out} (${Math.round(page.length / 1024)} KB)`);
