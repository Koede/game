// Builds the Hearthwatt Codex into dist-codex/: codex.html (artifact body), codex-data.json, index.html (local preview wrapper).
// Usage: node scripts/codex/build.mjs [outDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './extract.mjs';

const here = dirname(fileURLToPath(import.meta.url));

export async function buildCodex(outDir = resolve(here, '../../dist-codex')) {
  const { data, unknownTextures } = await extract();
  data.progression = JSON.parse(readFileSync(join(here, 'progression.json'), 'utf8'));
  const body = readFileSync(join(here, 'page.html'), 'utf8');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'codex-data.json'), JSON.stringify(data));
  writeFileSync(join(outDir, 'codex.html'), body);
  writeFileSync(join(outDir, 'index.html'),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
  const n = (o) => Object.keys(o).length;
  console.log(`codex: ${n(data.items)} items, ${data.recipes.length} recipes, ${data.blocks.length} blocks, ${n(data.tex)} textures -> ${outDir}`);
  if (unknownTextures.length) console.warn(`codex: textures not paintable (shown as missing): ${unknownTextures.join(', ')}`);
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildCodex(process.argv[2] ? resolve(process.argv[2]) : undefined);
