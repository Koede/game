// Debug tool: paints every procedural texture into one contact sheet PNG (16 tiles per row, 4x scale).
//   node scripts/texture-sheet.mjs [--out=dir] [--scale=4]
// Prints the texture name of every cell so the sheet can be read back by position.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { importSource, root } from './lib/bundle.mjs';
import { Image } from './lib/png.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const outDir = resolve(arg('out', join(root, 'dist/debug')));
const scale = Number(arg('scale', '4'));

const { paintTexture, TEXTURE_NAMES } = await importSource(`
  export { paintTexture } from 'src/render/textures';
  export { TEXTURE_NAMES } from 'src/core/registry';
`);

const perRow = 16;
const cell = 16 * scale + 4;
const rows = Math.ceil(TEXTURE_NAMES.length / perRow);
// Two backgrounds side by side: icons must read on dark UI and blocks against bright sky.
const sheet = new Image(perRow * cell * 2 + 8, rows * cell);
sheet.rect(0, 0, perRow * cell, rows * cell, 26, 22, 20);
sheet.rect(perRow * cell, 0, 8, rows * cell, 0, 0, 0);
sheet.rect(perRow * cell + 8, 0, perRow * cell, rows * cell, 150, 190, 230);

TEXTURE_NAMES.forEach((name, i) => {
  const tile = paintTexture(name);
  const x = (i % perRow) * cell + 2;
  const y = Math.floor(i / perRow) * cell + 2;
  sheet.blit(tile, 16, 16, x, y, scale);
  sheet.blit(tile, 16, 16, x + perRow * cell + 8, y, scale);
});

mkdirSync(outDir, { recursive: true });
const file = join(outDir, 'textures.png');
writeFileSync(file, sheet.toPng());
for (let r = 0; r < rows; r++) {
  console.log(`row ${String(r).padStart(2)}: ${TEXTURE_NAMES.slice(r * perRow, (r + 1) * perRow).join(' | ')}`);
}
console.log(`wrote ${file} (${TEXTURE_NAMES.length} textures, ${perRow} per row; left half on dark, right half on sky)`);
