// Phone/desktop check of bees and pollination: a beehive made at the workbench and set among flowers is settled by a
// swarm, bees fly round it, nearby wheat says it is pollinated, Use takes honeycomb (a sting bare-handed, calm with a
// Bee Smoker), and the comb presses into honey and beeswax, the wax into candles.
//   node scripts/e2e-bees.mjs [--no-build] [--device=phonePortrait]
// `window.__hw` only sets up (blocks, items, time) and reads state; crafting, placing and Use go through the real controls.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-bees');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);

const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
const label = () => page.locator('.hw-cross__label').innerText().catch(() => '');
const count = async (item) => (await d.state()).inventory.filter((s) => s.item === item).reduce((n, s) => n + s.count, 0);
let P = null;
let hive = null;
try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'bees-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('a meadow yard: grass, poppies and skybells, a watered wheat row and a workbench', async () => {
    P = await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.setTime(0.3);
      hw.setWeather('clear');
      const p = hw.state().player;
      const gy = Math.floor(p.y) + 6, x0 = Math.floor(p.x), z0 = Math.floor(p.z);
      for (let x = x0 - 7; x <= x0 + 7; x++) for (let z = z0 - 7; z <= z0 + 7; z++) {
        hw.setVoxel(x, gy - 2, z, 'stone');
        hw.setVoxel(x, gy - 1, z, 'grass');
        for (let y = gy; y <= gy + 8; y++) hw.setVoxel(x, y, z, 'air');
      }
      // Flowers in a ring 3-5 blocks out (wherever the hive goes near the player, they are in its reach).
      for (let x = x0 - 5; x <= x0 + 5; x++) for (let z = z0 - 5; z <= z0 + 5; z++) {
        const r = Math.max(Math.abs(x - x0), Math.abs(z - z0));
        if (r >= 4 && (x + z) % 2 === 0 && z !== z0 - 5) hw.setVoxel(x, gy, z, (x * 7 + z) % 3 === 0 ? 'skybell' : 'ember_poppy');
      }
      // Wheat on farmland with water beside it, along the north edge.
      for (let x = x0 - 2; x <= x0 + 2; x++) {
        hw.setVoxel(x, gy - 1, z0 - 5, 'farmland');
        hw.setVoxel(x, gy, z0 - 5, 'wheat_1');
      }
      for (let x = x0 - 2; x <= x0 + 2; x++) hw.setVoxel(x, gy - 1, z0 - 6, 'water');
      hw.setVoxel(x0 - 3, gy, z0 + 2, 'workbench');
      hw.teleport(x0 + 0.5, gy, z0 + 0.5);
      hw.give('plank', 7);
      hw.give('fiber', 5);
      hw.give('cord', 2);
      return { gy, x0, z0, bench: { x: x0 - 3, y: gy, z: z0 + 2 } };
    });
    await d.settle(800);
  });

  await report.step('the workbench makes a Beehive and a Bee Smoker', async () => {
    await d.useBlock(P.bench);
    await d.make('beehive');
    await d.make('bee_smoker');
    await d.shot('01-workbench');
    await d.closeScreen();
    assert((await count('beehive')) === 1, 'a beehive in the pack');
    assert((await count('bee_smoker')) === 1, 'a smoker in the pack');
  });

  await report.step('the hive is placed among the flowers and a swarm moves in', async () => {
    hive = await d.placeHeld('beehive', P.bench);
    assert(hive !== null, 'placed the hive');
    if (!hive) return;
    const empty = await d.hw((h) => window.__hw.app.game.state.sim.hiveAt(h.x, h.y, h.z), hive);
    assert(empty && empty.settled === false, `new hive is empty: ${JSON.stringify(empty)}`);
    await d.hw(() => window.__hw.tick(20 * 25));
    const e = await d.hw((h) => window.__hw.app.game.state.sim.hiveAt(h.x, h.y, h.z), hive);
    assert(e?.settled === true, `settled: ${JSON.stringify(e)}`);
    await d.aimAt(hive);
    await d.settle(1200);
    const text = await label();
    assert(/Beehive - busy on \d+ flowers/.test(text), `crosshair: ${text}`);
  });

  await report.step('bees fly round the hive (a close look)', async () => {
    const n = await d.hw(() => window.__hw.app.game.state.sim.buzzingHives().length);
    assert(n === 1, `buzzing hives ${n}`);
    await d.hw((h) => {
      const hw = window.__hw;
      hw.teleport(h.x + 0.5, h.y, h.z + 3.2);
      hw.lookAt(h.x, h.y + 0.3, h.z);
    }, hive);
    await d.settle(1500);
    await d.shot('02-bees');
  });

  await report.step('wheat beside the hive says the bees are pollinating it', async () => {
    const wheat = await d.hw(({ P, hive }) => {
      const sim = window.__hw.app.game.state.sim;
      for (let x = P.x0 - 2; x <= P.x0 + 2; x++) {
        const v = sim.cropView(x, P.gy, P.z0 - 5);
        if (v?.pollinated && Math.abs(x - hive.x) <= 5 && Math.abs(P.z0 - 5 - hive.z) <= 5) return { x, y: P.gy, z: P.z0 - 5 };
      }
      return null;
    }, { P, hive });
    assert(wheat !== null, 'a pollinated wheat');
    if (!wheat) return;
    await d.approach(wheat);
    await d.settle(1200);
    const text = await label();
    assert(/Wheat - growing.*bees pollinating/.test(text), `crosshair: ${text}`);
    await d.shot('03-pollinated');
  });

  await report.step('Use bare-handed takes a comb and the bees sting; with the smoker they stay calm', async () => {
    await d.hw((h) => { window.__hw.app.game.state.sim.hiveAt(h.x, h.y, h.z).combs = 3; }, hive);
    await d.hw((h) => { window.__hw.teleport(h.x + 0.5, h.y, h.z + 2.2); }, hive);
    await d.selectEmptyHand();
    const hp0 = (await d.state()).player.health;
    assert(await d.approach(hive), 'aim at the hive');
    await d.use();
    await waitFor(page, () => window.__hw.state().inventory.some((s) => s.item === 'honeycomb'), 'honeycomb', { timeout: 5000 });
    const hp1 = (await d.state()).player.health;
    assert(hp1 < hp0, `stung: ${hp0} -> ${hp1}`);
    await d.shot('04-stung');
    await d.selectItem('bee_smoker');
    await d.settle(600);
    assert(await d.approach(hive), 'aim at the hive again');
    await d.use();
    await waitFor(page, () => window.__hw.state().inventory.filter((s) => s.item === 'honeycomb').reduce((n, s) => n + s.count, 0) >= 2, 'second comb', { timeout: 5000 });
    const hp2 = (await d.state()).player.health;
    assert(hp2 >= hp1, `calm with the smoker: ${hp1} -> ${hp2}`);
    await d.settle(300);
    await d.shot('05-smoker');
  });

  await report.step('the workbench presses comb into honey and beeswax, and the wax into candles', async () => {
    await d.hw(() => window.__hw.give('glass_beaker', 2));
    await d.useBlock(P.bench);
    await d.make('honey');
    assert((await count('honey')) === 1 && (await count('beeswax')) === 1, 'honey and beeswax');
    await d.make('beeswax_candle');
    assert((await count('beeswax_candle')) === 2, 'two candles');
    await d.shot('06-honey');
    await d.closeScreen();
  });

  await report.step('a beeswax candle placed by the hive', async () => {
    const at = await d.placeHeld('beeswax_candle', hive);
    assert(at !== null, 'candle placed');
    await d.hw(() => window.__hw.setTime(0.75));
    await d.hw((h) => { const hw = window.__hw; hw.teleport(h.x + 0.5, h.y, h.z + 3.2); hw.lookAt(h.x, h.y + 0.2, h.z); }, hive);
    await d.settle(1500);
    const n = await d.hw(() => window.__hw.app.game.state.sim.buzzingHives().length);
    assert(n === 0, 'bees are in for the night');
    await d.aimAt(hive);
    await d.settle(1200);
    const text = await label();
    assert(/asleep for the night/.test(text), `crosshair: ${text}`);
    await d.shot('07-night');
  });

  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
