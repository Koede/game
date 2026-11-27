// Phone-portrait screenshot of the area-drawn blocks side by side (art consistency check).
//   node scripts/shoot-area-art.mjs --out=<dir-with-a-build> --shots=<dir> [--name=before|after]
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const device = 'phonePortrait';
const dir = e2eDist(root, argv);
await ensureBuilt(argv, dir);
const shots = resolve(flag('shots', join(root, 'test-results/area-art')));
const name = flag('name', 'shot');
mkdirSync(shots, { recursive: true });
const ROWS = [
  ['red_stained_plank', 'yellow_stained_plank', 'blue_stained_plank', 'green_stained_plank', 'black_stained_plank', 'white_stained_plank'],
  ['dining_table', 'bookshelf', 'wool_bedding', 'stripped_oak_log', 'brick_pillar', 'brick_chimney'],
  ['bronze_plate_block', 'rivet_plate_block', 'jukebox', 'wall_clock', 'quest_board', 'insulated_wall'],
  ['boiler_plate', 'steam_kettle', 'safety_valve', 'boiler_gauge_glass', 'steam_tank', 'steam_pipe'],
  ['ruined_machine', 'repaired_machine', 'waypoint_stone', 'cave_cairn', 'party_button', 'glassware_brass'],
];
const session = await openGame({ dir, device });
const { page, errors } = session;
const d = new Driver(page, device, (n) => page.screenshot({ path: join(shots, `${device}-${n}.png`) }));
try {
  await page.waitForSelector('.hw-title', { timeout: 30_000 });
  await page.fill('.hw-title input', 'hearth-art');
  await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
  await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
  await d.settle(1500);
  await d.hw((rows) => {
    const hw = window.__hw;
    const p = hw.state().player;
    // A flat stone stage high above the terrain, with the wall of blocks 5 in front of the player.
    const x0 = Math.floor(p.x) - 3;
    const y0 = Math.floor(p.y) + 30;
    const z0 = Math.floor(p.z);
    for (let x = x0 - 3; x < x0 + 10; x++) for (let z = z0 - 6; z < z0 + 10; z++) hw.setVoxel(x, y0 - 1, z, 'stone');
    rows.forEach((row, r) => row.forEach((b, i) => hw.setVoxel(x0 + i, y0 + (rows.length - r), z0 - 5, b)));
    hw.teleport(x0 + 2.5, y0, z0 + 8);
    hw.setTime(0.25);
  }, ROWS);
  await d.settle(1500);
  await d.hw(() => {
    const p = window.__hw.state().player;
    window.__hw.lookAt(p.x, p.y + 3.5, p.z - 13);
  });
  await d.settle(1500);
  await d.shot(name);
} finally {
  await session.close();
}
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
