// Browser check of leaf decay, the chainsaw and the tractor (docs/api/leaf-decay.md, chainsaw.md, tractor.md).
//   node scripts/e2e-vehicles.mjs [--device=desktop] [--out=<dir>] [--shots=<dir>]
// Builds to a scratch dir (never dist/, so it can run beside other e2e runs). HW_GPU=1 uses the real GPU, HW_DIAG=1 logs.
// Real input: mouse / keyboard for mining, use, driving and F. __hw only sets up (give, teleport, voxels, ticks).
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const device = arg('device', 'desktop');
const out = resolve(arg('out', join(tmpdir(), 'hw-e2e-vehicles')));
const shots = resolve(arg('shots', join(root, 'test-results/e2e-vehicles')));
mkdirSync(shots, { recursive: true });
await build({ quiet: true, outDir: out });

const report = createReporter();
const { assert } = report;
const session = await openGame({ dir: out, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
const step = async (name, run) => {
  if (!ok) return console.log(`  skip ${name}`);
  const before = report.failures;
  await report.step(name, run);
  if (report.failures !== before) {
    ok = false;
    await d.shot(`FAILED-${name.replace(/\W+/g, '-')}`).catch(() => undefined);
  }
};
const block = (x, y, z) => page.evaluate(([a, b, c]) => window.__hw.app.game.state.world.getBlock(a, b, c).key, [x, y, z]);
const setBlock = (x, y, z, k) => page.evaluate(([a, b, c, key]) => window.__hw.setVoxel(a, b, c, key), [x, y, z, k]);
const slotOf = (item) => page.evaluate((i) => window.__hw.state().inventory.find((s) => s.item === i)?.slot, item);
const select = async (item) => page.evaluate((s) => window.__hw.selectSlot(s), await slotOf(item));
const crownLeaves = () => page.evaluate(([x, z, y]) => {
  let n = 0;
  for (let yy = y; yy < y + 12; yy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (window.__hw.app.game.state.world.getBlock(x + dx, yy, z + dz).key === 'oak_leaves') n++;
  return n;
}, [PX, PZ, FLOOR]);

// A flat grass platform high in the sky, far from any terrain.
const PX = 0;
const PZ = 0;
const FLOOR = 80;

let crownAfterCut = 0;

try {
  await step('a new world loads into play and a platform is built', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'hearth-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
    await page.evaluate(([x, z, y]) => {
      window.__hw.app.game.state.world.ensureLoadedAround(x, z, 2);
      for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) window.__hw.setVoxel(x + dx, y, z + dz, 'grass');
      window.__hw.clearInventory();
      window.__hw.teleport(x + 0.5, y + 1, z + 8.5);
    }, [PX, PZ, FLOOR]);
    await d.settle(800);
  });

  await step('chainsaw: Mine on a log fells the whole trunk, burns fuel, drops the logs', async () => {
    await page.evaluate(([x, z, y]) => {
      for (let h = 1; h <= 7; h++) window.__hw.setVoxel(x, y + h, z, 'oak_log');
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const h of [6, 7, 8]) if (dx || dz || h === 8) window.__hw.setVoxel(x + dx, y + h, z + dz, 'oak_leaves');
      window.__hw.give('chainsaw', 1);
      window.__hw.selectSlot(0);
      window.__hw.teleport(x + 0.5, y + 1, z + 3.5);
      window.__hw.lookAt(x, y + 1, z);
    }, [PX, PZ, FLOOR]);
    await select('chainsaw');
    const startY = (await d.state()).target.y;
    const felled = FLOOR + 7 - startY + 1;
    const fuel = () => page.evaluate(() => window.__hw.state().inventory.find((s) => s.item === 'chainsaw').durability);
    const before = await fuel();
    await d.shot('chainsaw-before');
    const got = await d.holdMine(async () => {
      await page.evaluate(([x, y, z]) => window.__hw.lookAt(x, y, z), [PX, FLOOR + 1, PZ]);
      return (await block(PX, FLOOR + 7, PZ)) === 'air';
    }, 15_000);
    const st = await d.state();
    console.log('mined', got, JSON.stringify(st.ui), JSON.stringify(st.player), JSON.stringify(st.target), st.player.selectedSlot, JSON.stringify(st.inventory.slice(0, 3)), await block(PX, FLOOR + 7, PZ), await block(PX, 82, PZ));
    for (let y = startY; y <= FLOOR + 7; y++) assert((await block(PX, y, PZ)) === 'air', `log at ${y} still stands`);
    assert((await block(PX, startY - 1, PZ)) === (startY > FLOOR + 1 ? 'oak_log' : 'grass'), 'the stump below the cut stays');
    // Count before the settle below. Leaf delay is 8-48 ticks (docs/api/leaf-decay.md); a 1.2 s settle at full
    // tick rate can finish that window, so "still there" has to be read at the moment the trunk is gone.
    crownAfterCut = await crownLeaves();
    await d.settle(1200);
    const after = await fuel();
    assert(after === before - 7 * felled, `fuel used 7 per log: ${before} -> ${after}`);
    const onGround = (await page.evaluate(() => window.__hw.groundItems())).filter((g) => g.item === 'oak_log').reduce((n, g) => n + g.count, 0);
    const have = (await d.inventory()).oak_log ?? 0;
    assert(onGround + have === felled, `${felled} logs dropped or collected, got ${onGround + have}`);
    await d.shot('chainsaw-after');
  });

  await step('leaf decay: the crown does not vanish at once, then falls away on its own', async () => {
    assert(crownAfterCut > 0, 'leaves still there right after the cut');
    await page.evaluate(() => window.__hw.tick(500));
    assert((await crownLeaves()) === 0, 'all leaves decayed');
  });

  await step('chainsaw refuel: Use with a Fuel Canister tops up a part-empty tank', async () => {
    await page.evaluate(() => {
      window.__hw.clearInventory();
      window.__hw.give('chainsaw', 1);
      window.__hw.give('fuel_canister', 2);
      const s = window.__hw.state().inventory.find((x) => x.item === 'chainsaw');
      window.__hw.app.game.state.player.inventory.get(s.slot).durability = 50;
      window.__hw.look(0, 0.4);
    });
    await select('fuel_canister');
    await d.use();
    await d.settle(400);
    const st = await page.evaluate(() => window.__hw.state().inventory);
    assert(st.find((s) => s.item === 'chainsaw').durability === 470, 'tank +420');
    assert(st.find((s) => s.item === 'fuel_canister').count === 1, 'one canister used');
  });

  await step('tractor: set it down, refuel, fit the tiller, board', async () => {
    await page.evaluate(() => {
      window.__hw.clearInventory();
      window.__hw.give('tractor', 1);
      window.__hw.give('fuel_canister', 3);
      window.__hw.give('tractor_tiller', 1);
      window.__hw.teleport(0.5, 81, 8.5);
      window.__hw.look(0, -0.7);
    });
    await select('tractor');
    await d.use();
    await d.settle(500);
    assert((await page.evaluate(() => window.__hw.app.game.vehicles.tractors.size)) === 1, 'tractor placed');
    // Face it: look at the machine's middle.
    await page.evaluate(() => {
      const t = [...window.__hw.app.game.vehicles.tractors.values()][0];
      window.__hw.lookAt(Math.floor(t.x), Math.floor(t.y + 0.8), Math.floor(t.z));
    });
    await d.shot('tractor-parked');
    await select('fuel_canister');
    await sleep(800);
    await d.use();
    await sleep(800);
    await select('tractor_tiller');
    await d.use();
    await sleep(800);
    const t = await page.evaluate(() => { const v = [...window.__hw.app.game.vehicles.tractors.values()][0]; return { fuel: v.fuel, att: v.attachment }; });
    assert(t.fuel === 150 && t.att === 'tiller', `fuel ${t.fuel}, attachment ${t.att}`);
    await page.evaluate(() => { window.__hw.clearInventory(); });
    await d.use();
    await d.settle(700);
    assert(await page.evaluate(() => window.__hw.app.game.vehicles.driving !== null), 'boarded');
    await d.shot('tractor-boarded');
  });

  await step('tractor: W drives, A steers, F tills ahead and the HUD shows', async () => {
    const pos = () => page.evaluate(() => { const t = window.__hw.app.game.vehicles.driving; return { x: t.x, z: t.z, yaw: t.yaw, fuel: t.fuel }; });
    assert(await page.locator('.hw-vehicle--on').count(), 'driving HUD visible');
    const p0 = await pos();
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyF');
    await sleep(2500);
    await page.keyboard.up('KeyF');
    await page.keyboard.up('KeyW');
    const p1 = await pos();
    assert(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 3, `drove ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`);
    assert(p1.fuel < p0.fuel, 'burnt fuel');
    const farmland = await page.evaluate(([x, z, y]) => {
      let n = 0;
      for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) if (window.__hw.app.game.state.world.getBlock(x + dx, y, z + dz).key === 'farmland') n++;
      return n;
    }, [PX, PZ, FLOOR]);
    assert(farmland >= 10, `${farmland} blocks tilled`);
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await sleep(1200);
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
    const p2 = await pos();
    assert(Math.abs(p2.yaw - p1.yaw) > 0.4, `steered ${(p2.yaw - p1.yaw).toFixed(2)} rad`);
    await d.shot('tractor-tilled');
  });

  await step('tractor: R swaps to the harvester which cuts ripe wheat only; Use gets off; it is saved', async () => {
    const t = await page.evaluate(() => { const v = window.__hw.app.game.vehicles.driving; return { x: v.x, z: v.z, yaw: v.yaw }; });
    const fx = -Math.sin(t.yaw);
    const fz = -Math.cos(t.yaw);
    const ripe = [Math.floor(t.x + fx * 2), Math.floor(t.z + fz * 2)];
    const young = [Math.floor(t.x + fx * 2 + fz * 1.2), Math.floor(t.z + fz * 2 - fx * 1.2)];
    for (const [[x, z], key] of [[ripe, 'wheat_3'], [young, 'wheat_1']]) {
      await setBlock(x, FLOOR, z, 'farmland');
      await setBlock(x, FLOOR + 1, z, key);
    }
    await page.evaluate(() => window.__hw.give('tractor_harvester', 1));
    await page.keyboard.press('KeyR');
    await sleep(300);
    assert((await page.evaluate(() => window.__hw.app.game.vehicles.driving.attachment)) === 'harvester', 'R swapped to the harvester');
    await page.keyboard.down('KeyF');
    await sleep(900);
    await page.keyboard.up('KeyF');
    const k = await block(ripe[0], FLOOR + 1, ripe[1]);
    assert(k === 'wheat_0' || k === 'air', `ripe wheat cut (now ${k})`);
    assert((await block(young[0], FLOOR + 1, young[1])) === 'wheat_1', 'young wheat left standing');
    await d.use();
    await d.settle(800);
    assert(await page.evaluate(() => window.__hw.app.game.vehicles.driving === null), 'got off');
    const saved = await page.evaluate(() => JSON.parse(window.__hw.app.game.toSaveJson()).world.extras.vehicles.tractors.length);
    assert(saved === 1, `tractor in the save document (${saved})`);
    await d.shot('tractor-off');
  });

  await step('no console errors during the run', async () => {
    assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
