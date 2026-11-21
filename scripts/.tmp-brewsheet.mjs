import { writeFileSync } from 'node:fs';
import { importSource, root } from './lib/bundle.mjs';
import { Image } from './lib/png.mjs';
const { paintTexture } = await importSource(`export { paintTexture } from 'src/render/textures';`);
const names = process.argv.slice(3);
const scale = 10, cell = 16 * scale + 8, per = 8;
const rows = Math.ceil(names.length / per);
const sheet = new Image(per * cell * 2 + 8, rows * cell);
sheet.rect(0, 0, per * cell, rows * cell, 26, 22, 20);
sheet.rect(per * cell + 8, 0, per * cell, rows * cell, 150, 190, 230);
names.forEach((n, i) => {
  const t = paintTexture(n);
  for (const off of [0, per * cell + 8]) {
    const x0 = off + (i % per) * cell + 4, y0 = Math.floor(i / per) * cell + 4;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = (y * 16 + x) * 4; if (t[k + 3] === 0) continue;
      sheet.rect(x0 + x * scale, y0 + y * scale, scale, scale, t[k], t[k + 1], t[k + 2]);
    }
  }
});
writeFileSync(process.argv[2], sheet.toPng());
