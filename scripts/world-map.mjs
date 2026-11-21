// Debug tool: renders a top-down map and a vertical cross-section of generated terrain to PNG files.
//   node scripts/world-map.mjs [--seed=hearth] [--chunks=24] [--out=dir]
// Useful for judging biomes, shores, caves and ore distribution without starting the game.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { importSource, root } from './lib/bundle.mjs';
import { Image } from './lib/png.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const seedText = arg('seed', 'hearth');
const span = Number(arg('chunks', '24'));
const outDir = resolve(arg('out', join(root, 'dist/debug')));

const game = await importSource(`
  export { generateChunk, findSpawn, biomeAt } from 'src/world/worldgen';
  export { BLOCKS } from 'src/core/registry';
  export { seedFromString } from 'src/core/math';
  export { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, voxelId, voxelIndex } from 'src/core/types';
`);
const { generateChunk, findSpawn, biomeAt, BLOCKS, seedFromString, CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, voxelId, voxelIndex } = game;
const seed = seedFromString(seedText);

const COLORS = {
  air: [150, 190, 230], corestone: [20, 18, 22], stone: [120, 118, 116], rubble: [105, 102, 100], dirt: [112, 82, 56],
  grass: [94, 142, 66], sand: [214, 196, 140], gravel: [140, 134, 128], clay: [160, 150, 170], snow: [238, 242, 246],
  ice: [170, 208, 235], basalt: [58, 54, 62], limestone: [196, 190, 170], water: [52, 104, 176], lava: [240, 110, 30],
  oak_log: [92, 68, 44], oak_leaves: [58, 108, 48], pine_log: [70, 52, 38], pine_leaves: [38, 82, 62],
  tall_grass: [110, 160, 76], dry_shrub: [150, 126, 80], coal_ore: [30, 30, 34], copper_ore: [214, 120, 60],
  tin_ore: [200, 214, 222], iron_ore: [176, 96, 80], sulfur_ore: [232, 220, 60], quartz_ore: [250, 240, 250],
  bauxite: [190, 80, 50], wolframite: [70, 90, 140], spodumene: [220, 150, 220], pitchblende: [90, 220, 90],
  oil_shale: [80, 60, 20],
};
const colorOf = (key) => COLORS[key] ?? [255, 0, 255];

const half = Math.floor(span / 2);
const spawn = findSpawn(seed);
const scx = Math.floor(spawn.x / CHUNK_SIZE);
const scz = Math.floor(spawn.z / CHUNK_SIZE);
const size = span * CHUNK_SIZE;
const top = new Image(size, size);
const section = new Image(size, WORLD_HEIGHT * 2);
const counts = new Map();
const biomes = new Map();
let genMs = 0;

for (let dz = 0; dz < span; dz++) {
  for (let dx = 0; dx < span; dx++) {
    const cx = scx - half + dx;
    const cz = scz - half + dz;
    const t0 = performance.now();
    const voxels = generateChunk(seed, cx, cz);
    genMs += performance.now() - t0;
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = cx * CHUNK_SIZE + x;
        const wz = cz * CHUNK_SIZE + z;
        if (x === 8 && z === 8) biomes.set(biomeAt(seed, wx, wz), (biomes.get(biomeAt(seed, wx, wz)) ?? 0) + 1);
        let topY = -1;
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
          const key = BLOCKS[voxelId(voxels[voxelIndex(x, y, z)])].key;
          if (key !== 'air') counts.set(key, (counts.get(key) ?? 0) + 1);
          if (topY < 0 && key !== 'air') topY = y;
        }
        const key = topY < 0 ? 'air' : BLOCKS[voxelId(voxels[voxelIndex(x, topY, z)])].key;
        const shade = 0.55 + 0.45 * Math.min(1, Math.max(0, (topY - 20) / 60));
        const [r, g, b] = colorOf(key);
        top.set(dx * CHUNK_SIZE + x, dz * CHUNK_SIZE + z, r * shade, g * shade, b * shade);
        if (wz === spawn.z) {
          for (let y = 0; y < WORLD_HEIGHT; y++) {
            const k = BLOCKS[voxelId(voxels[voxelIndex(x, y, z)])].key;
            const [sr, sg, sb] = colorOf(k);
            section.rect(dx * CHUNK_SIZE + x, (WORLD_HEIGHT - 1 - y) * 2, 1, 2, sr, sg, sb);
          }
        }
      }
    }
  }
}
const sx = spawn.x - (scx - half) * CHUNK_SIZE;
const sz = spawn.z - (scz - half) * CHUNK_SIZE;
top.rect(sx - 2, sz - 2, 5, 5, 255, 0, 0);
top.rect(sx - 1, sz - 1, 3, 3, 255, 255, 255);
section.rect(sx, 0, 1, WORLD_HEIGHT * 2, 255, 0, 0, 255);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `map-${seedText}.png`), top.toPng());
writeFileSync(join(outDir, `section-${seedText}.png`), section.toPng());

const chunks = span * span;
console.log(`seed "${seedText}" (${seed}), ${chunks} chunks around spawn (${spawn.x}, ${spawn.y}, ${spawn.z}), sea level ${SEA_LEVEL}`);
console.log(`generateChunk: ${(genMs / chunks).toFixed(1)} ms average`);
console.log('biomes (chunk centres):', Object.fromEntries(biomes));
const perChunk = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / chunks).toFixed(1)}`);
console.log('blocks per chunk:', perChunk.join(', '));
console.log(`wrote ${join(outDir, `map-${seedText}.png`)} and section-${seedText}.png`);
